// Workflows/queries.js
const { getPool, query } = require("../../db/pool");
const crypto = require("crypto");

function normalizeRunStatus(status) {
  const s = String(status || "").toLowerCase();
  if (!["not_started", "in_progress", "completed", "cancelled"].includes(s)) {
    return "in_progress";
  }
  return s;
}

async function recomputeWorkflowRunStatus(runId, client = null) {
  const runner = client ? client : { query };

  // If run is cancelled, keep cancelled.
  const runRes = await runner.query(
    `
    SELECT workflow_run_id, status
    FROM workflow_runs
    WHERE workflow_run_id = $1
    `,
    [runId],
  );

  if (!runRes?.rows?.length) throw new Error(`Workflow run ${runId} not found`);

  const currentStatus = normalizeRunStatus(runRes.rows[0].status);
  if (currentStatus === "cancelled")
    return { run_id: runId, status: "cancelled" };

  // Count required items that are NOT done.
  // Required = wf.required = true
  // Done statuses = submitted, skipped
  const reqRes = await runner.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE wf.required = TRUE)                         AS required_total,
      COUNT(*) FILTER (WHERE wf.required = TRUE AND wi.status IN ('submitted','skipped')) AS required_done
    FROM workflow_items wi
    JOIN workflow_forms wf
      ON wf.workflow_form_id = wi.workflow_form_id
    WHERE wi.workflow_run_id = $1
    `,
    [runId],
  );

  const requiredTotal = Number(reqRes.rows[0]?.required_total ?? 0);
  const requiredDone = Number(reqRes.rows[0]?.required_done ?? 0);

  let nextStatus = "in_progress";
  if (requiredTotal === 0) nextStatus = "completed";
  else if (requiredDone >= requiredTotal) nextStatus = "completed";

  if (nextStatus !== "completed") {
    const touchedRes = await runner.query(
      `
      SELECT COUNT(*) AS touched
      FROM workflow_items
      WHERE workflow_run_id = $1
        AND status <> 'not_started'
      `,
      [runId],
    );
    const touched = Number(touchedRes.rows[0]?.touched ?? 0);
    nextStatus = touched > 0 ? "in_progress" : "not_started";
  }

  if (nextStatus !== currentStatus) {
    await runner.query(
      `
      UPDATE workflow_runs
      SET status = $2, updated_at = NOW()
      WHERE workflow_run_id = $1
      `,
      [runId, nextStatus],
    );
  }

  return {
    run_id: runId,
    status: nextStatus,
    required_total: requiredTotal,
    required_done: requiredDone,
  };
}

async function createWorkflow({
  workflow_key,
  title,
  description = null,
  status = "Active",
  created_by = null,
}) {
  const sql = `
      INSERT INTO workflows (workflow_key, title, description, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING workflow_id, workflow_key, title, description, status, created_by, created_at, updated_at
    `;
  const params = [workflow_key, title, description, status, created_by];
  const rows = await query(sql, params);
  return rows?.[0] ?? null;
}

async function getWorkflowById(workflowId) {
  const sql = `
      SELECT
        w.workflow_id,
        w.workflow_key,
        w.title,
        w.description,
        w.status,
        w.created_by,
        cu.display_name AS created_by_name,
        w.created_at,
        w.updated_at
      FROM workflows w
      LEFT JOIN Users cu ON cu.user_id = w.created_by
      WHERE w.workflow_id = $1
    `;
  const rows = await query(sql, [workflowId]);
  return rows?.[0] ?? null;
}

async function listWorkflows({ status = null } = {}) {
  const params = [];
  let where = "";

  if (status && String(status).trim()) {
    params.push(String(status).trim());
    where = `WHERE w.status = $${params.length}`;
  }

  const sql = `
      SELECT
        w.workflow_id,
        w.workflow_key,
        w.title,
        w.description,
        w.status,
        w.created_by,
        cu.display_name AS created_by_name,
        w.created_at,
        w.updated_at
      FROM workflows w
      LEFT JOIN Users cu
        ON cu.user_id = w.created_by
      ${where}
      ORDER BY w.title ASC, w.workflow_id ASC
    `;

  return await query(sql, params);
}

async function listWorkflowRuns({
  userId = null,
  workflow_id = null,
  status = null,
} = {}) {
  const params = [];
  const where = [];

  if (workflow_id) {
    params.push(Number(workflow_id));
    where.push(`wr.workflow_id = $${params.length}`);
  }

  if (status && String(status).trim()) {
    params.push(String(status).trim());
    where.push(`wr.status = $${params.length}`);
  }

  // User scoping (optional): "runs I'm involved in"
  if (userId) {
    params.push(Number(userId));
    where.push(`
        (
          wr.created_by = $${params.length}
          OR EXISTS (
            SELECT 1
            FROM workflow_items wi2
            WHERE wi2.workflow_run_id = wr.workflow_run_id
              AND wi2.assigned_user_id = $${params.length}
          )
        )
      `);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
      WITH item_counts AS (
        SELECT
          wi.workflow_run_id,
          COUNT(*) FILTER (WHERE wf.required = TRUE) AS required_total,
          COUNT(*) FILTER (
            WHERE wf.required = TRUE
              AND wi.status IN ('submitted','skipped')
          ) AS required_done
        FROM workflow_items wi
        JOIN workflow_forms wf
          ON wf.workflow_form_id = wi.workflow_form_id
        GROUP BY wi.workflow_run_id
      )
      SELECT
        wr.workflow_run_id,
        wr.workflow_id,
        w.title AS workflow_title,
        wr.display_name,
        wr.status,
        wr.locked_at,
        wr.locked_by,
        lu.display_name AS locked_by_name,
        wr.cancelled_at,
        wr.cancelled_reason,
        wr.created_by,
        cu.display_name AS created_by_name,
        wr.created_at,
        wr.updated_at,
  
        COALESCE(ic.required_total, 0) AS required_total,
        COALESCE(ic.required_done, 0)  AS required_done
      FROM workflow_runs wr
      JOIN workflows w
        ON w.workflow_id = wr.workflow_id
      LEFT JOIN item_counts ic
        ON ic.workflow_run_id = wr.workflow_run_id
      LEFT JOIN Users lu
        ON lu.user_id = wr.locked_by
      LEFT JOIN Users cu
        ON cu.user_id = wr.created_by
      ${whereSql}
      ORDER BY wr.created_at DESC, wr.workflow_run_id DESC
    `;

  return await query(sql, params);
}

// -------------------------
// Workflow Forms
// -------------------------
async function createWorkflowForm({
  workflow_id,
  form_id,
  required = false,
  allow_multiple = false,
  sort_order = 50,
  default_name = null,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  const sql = `
    INSERT INTO public.workflow_forms 
      (workflow_id, form_id, required, allow_multiple, sort_order, created_at, updated_at, default_name)
    VALUES 
      ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
    RETURNING workflow_id, form_id, required, allow_multiple, sort_order, updated_at, default_name
  `;

  const params = [
    workflow_id,
    form_id,
    required,
    allow_multiple,
    sort_order,
    default_name,
  ];

  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } catch (err) {
    throw new Error("Unable to add Form to the Template. " + err.message);
  } finally {
    client.release();
  }
}

async function removeWorkflowForm(workflow_form_id) {
  const pool = await getPool();
  const client = await pool.connect();
  const sql = `DELETE FROM public.workflow_forms WHERE workflow_form_id = $1 returning workflow_id, form_id, sort_order`;
  const params = [workflow_form_id];
  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } catch (e) {
    throw new Error("Unable to Remove Form from Template. " + e.message);
  } finally {
    client.release();
  }
}

async function updateWorkflowForm({
  workflow_form_id,
  required = false,
  allow_multiple = false,
  sort_order = 50,
  default_name = null,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  const sql = `
    UPDATE public.workflow_forms
    SET
      required = $2,
      allow_multiple = $3,
      sort_order = $4,
      updated_at = NOW()
      default_name = $5
    WHERE workflow_form_id = $1
    RETURNING
      workflow_form_id,
      workflow_id,
      form_id,
      required,
      default_name,
      allow_multiple,
      sort_order,
      updated_at
  `;

  const params = [
    workflow_form_id,
    required,
    allow_multiple,
    sort_order,
    default_name,
  ];

  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } catch (err) {
    throw new Error("Unable to update Workflow Form. " + err.message);
  } finally {
    client.release();
  }
}

async function getWorkflowForm(workflow_form_id) {
  const sql = `SELECT workflow_form_id, workflow_id, form_id, required, allow_multiple, sort_order, created_at, updated_at
	FROM public.workflow_forms WHERE workflow_form_id = $1;`;
  const params = [workflow_form_id];
  try {
    const result = await query(sql, params);
    return result;
  } catch (err) {
    throw new Error("Could not get Workflow Form. " + err);
  }
}

async function listWorkflowForms() {
  const sql = `SELECT workflow_form_id, workflow_id, wf.default_name, wf.form_id, f.title, f.description, f.status, wf.required, wf.allow_multiple, wf.sort_order, wf.created_at, wf.updated_at
	FROM public.workflow_forms wf LEFT JOIN Forms f on f.form_id = wf.form_id;`;
  try {
    const result = await query(sql);
    return result;
  } catch (err) {
    throw new Error("Could not get Workflow Form. " + err);
  }
}

// -------------------------
// Workflow Runs
// -------------------------

/**
 * Create a workflow run and seed initial items.
 * - inserts workflow_runs
 * - inserts workflow_items (sequence_num = 1 per workflow_form)
 * - recompute status
 */
async function createWorkflowRun({ workflow_id, display_name, created_by }) {
  if (!workflow_id) throw new Error("workflow_id is required");
  if (!display_name || !String(display_name).trim())
    throw new Error("display_name is required");

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert run
    const runRes = await client.query(
      `
      INSERT INTO workflow_runs (workflow_id, display_name, status, created_by, created_at, updated_at)
      VALUES ($1, $2, 'not_started', $3, NOW(), NOW())
      RETURNING workflow_run_id, workflow_id, display_name, status, created_at, updated_at
      `,
      [workflow_id, String(display_name).trim(), created_by ?? null],
    );

    const run = runRes.rows[0];

    // Fetch workflow forms rules and seed items
    const wfFormsRes = await client.query(
      `
      SELECT workflow_form_id, required, allow_multiple, sort_order, default_name
      FROM workflow_forms
      WHERE workflow_id = $1
      ORDER BY sort_order ASC, workflow_form_id ASC
      `,
      [workflow_id],
    );

    if (wfFormsRes.rows.length) {
      const values = [];
      const placeholders = [];

      wfFormsRes.rows.forEach((row, idx) => {
        const o = idx * 7;
        placeholders.push(
          `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`,
        );
        values.push(
          run.workflow_run_id, // workflow_run_id
          row.workflow_form_id, // workflow_form_id
          1, // sequence_num
          "not_started", // status
          null, // assigned_user_id
          row.required ? null : null,
          row.default_name ?? null, // skipped_reason
        );
      });

      await client.query(
        `
        INSERT INTO workflow_items
          (workflow_run_id, workflow_form_id, sequence_num, status, assigned_user_id, skipped_reason, display_name)
        VALUES ${placeholders.join(", ")}
        `,
        values,
      );
    }

    // Recompute status after seeding
    const status = await recomputeWorkflowRunStatus(
      run.workflow_run_id,
      client,
    );

    await client.query("COMMIT");
    return { run, status };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Dashboard view:
 * - run header
 * - items with form titles, required flags, allow_multiple, assignment
 * - progress counts
 */
async function getWorkflowRunDashboard(runId) {
  const sql = `
    WITH item_data AS (
      SELECT
        wi.workflow_item_id,
        wi.workflow_run_id,
        wi.workflow_form_id,
        wi.sequence_num,
        wi.status AS item_status,
        wi.assigned_user_id,
        wi.display_name,
        au.display_name AS assigned_user_name,
        wi.skipped_reason,
        wi.completed_at,
        wi.created_at AS item_created_at,
        wi.updated_at AS item_updated_at,

        wf.required,
        wf.allow_multiple,
        wf.sort_order,

        f.form_id,
        f.title AS form_title,
        f.form_key

      FROM workflow_items wi
      JOIN workflow_forms wf
        ON wf.workflow_form_id = wi.workflow_form_id
      JOIN Forms f
        ON f.form_id = wf.form_id
      LEFT JOIN Users au
        ON au.user_id = wi.assigned_user_id
      WHERE wi.workflow_run_id = $1
    )
    SELECT
      wr.workflow_run_id,
      wr.workflow_id,
      w.title AS workflow_title,
      wr.display_name,
      wr.status,
      wr.locked_at,
      wr.locked_by,
      lu.display_name AS locked_by_name,
      wr.created_by,
      cu.display_name AS created_by_name,
      wr.created_at,
      wr.updated_at,

      -- progress: required done / required total
      (SELECT COUNT(*) FROM item_data WHERE required = TRUE) AS required_total,
      (SELECT COUNT(*) FROM item_data WHERE required = TRUE AND item_status IN ('submitted','skipped')) AS required_done,

      -- items as JSON array (stable ordering)
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'workflow_item_id', workflow_item_id,
            'workflow_form_id', workflow_form_id,
            'sequence_num', sequence_num,
            'status', item_status,
            'assigned_user_id', assigned_user_id,
            'assigned_user_name', assigned_user_name,
            'skipped_reason', skipped_reason,
            'completed_at', completed_at,
            'required', required,
            'allow_multiple', allow_multiple,
            'sort_order', sort_order,
            'form_id', form_id,
            'form_title', form_title,
            'form_key', form_key,
            'display_name', id.display_name
          )
          ORDER BY sort_order ASC, workflow_form_id ASC, sequence_num ASC
        ) FILTER (WHERE workflow_item_id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM workflow_runs wr
    JOIN workflows w
      ON w.workflow_id = wr.workflow_id
    LEFT JOIN Users lu
      ON lu.user_id = wr.locked_by
    LEFT JOIN Users cu
      ON cu.user_id = wr.created_by
    LEFT JOIN item_data id
      ON id.workflow_run_id = wr.workflow_run_id
    WHERE wr.workflow_run_id = $1
    GROUP BY
      wr.workflow_run_id, wr.workflow_id, w.title, wr.display_name, wr.status,
      wr.locked_at, wr.locked_by, lu.display_name,
      wr.created_by, cu.display_name,
      wr.created_at, wr.updated_at;
  `;

  const res = await query(sql, [runId]);
  return res?.[0] ?? null;
}

async function lockWorkflowRun(runId, lockedByUserId) {
  const sql = `
    UPDATE workflow_runs
    SET locked_at = NOW(), locked_by = $2, updated_at = NOW()
    WHERE workflow_run_id = $1
    RETURNING workflow_run_id, locked_at, locked_by, status;
  `;
  const res = await query(sql, [runId, lockedByUserId ?? null]);
  return res?.[0] ?? null;
}

async function cancelWorkflowRun(runId, cancelledByUserId, reason = null) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const res = await client.query(
      `
      UPDATE workflow_runs
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_reason = $2,
          updated_at = NOW()
      WHERE workflow_run_id = $1
      RETURNING workflow_run_id, status, cancelled_at, cancelled_reason
      `,
      [runId, reason ?? null],
    );

    await client.query("COMMIT");
    return res.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// -------------------------
// Workflow Items
// -------------------------

async function assignWorkflowItem(itemId, assignedUserId) {
  const sql = `
    UPDATE workflow_items
    SET assigned_user_id = $2, updated_at = NOW()
    WHERE workflow_item_id = $1
    RETURNING workflow_item_id, workflow_run_id, assigned_user_id, status;
  `;
  const res = await query(sql, [itemId, assignedUserId ?? null]);
  return res?.[0] ?? null;
}

/**
 * Start item:
 * - set item status to in_progress if currently not_started
 * - find existing session OR create one
 *
 * IMPORTANT: you need to match your existing formsessions columns.
 * From your response queries, formsessions includes:
 * session_id, created_at, updated_at, completed_at, expires_at, current_step, total_steps, is_active, session_token, is_completed:contentReference[oaicite:3]{index=3}
 *
 * We'll only insert required columns + rely on DB defaults where possible.
 */
async function startWorkflowItem(itemId, userId) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Pull item + form info
    const itemRes = await client.query(
      `
      SELECT
        wi.workflow_item_id,
        wi.workflow_run_id,
        wi.workflow_form_id,
        wi.status AS item_status,
        wr.status AS run_status,
        wr.locked_at,
        wf.form_id,
        (SELECT COUNT(*) FROM formfields ff where ff.form_id = wf.form_id) as total_steps
      FROM workflow_items wi
      JOIN workflow_runs wr
        ON wr.workflow_run_id = wi.workflow_run_id
      JOIN workflow_forms wf
        ON wf.workflow_form_id = wi.workflow_form_id
      WHERE wi.workflow_item_id = $1
      `,
      [itemId],
    );

    if (!itemRes.rows.length)
      throw new Error(`Workflow item ${itemId} not found`);
    const item = itemRes.rows[0];

    if (String(item.run_status).toLowerCase() === "cancelled") {
      throw new Error("Workflow run is cancelled");
    }

    // Flip to in_progress if needed
    if (String(item.item_status).toLowerCase() === "not_started") {
      await client.query(
        `
        UPDATE workflow_items
        SET status = 'in_progress', updated_at = NOW()
        WHERE workflow_item_id = $1
        `,
        [itemId],
      );
    }

    // Ensure run status is at least in_progress
    await recomputeWorkflowRunStatus(item.workflow_run_id, client);

    // Find existing active session for this item/user (prefer active)
    const existingSession = await client.query(
      `
      SELECT session_id, session_token, is_active, is_completed, created_at, updated_at
      FROM formsessions
      WHERE workflow_item_id = $1
        AND workflow_run_id = $2
        AND user_id = $3
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 1
      `,
      [itemId, item.workflow_run_id, userId],
    );

    if (existingSession.rows.length) {
      await client.query("COMMIT");
      return {
        workflow_item_id: itemId,
        workflow_run_id: item.workflow_run_id,
        form_id: item.form_id,
        session: existingSession.rows[0],
        reused: true,
      };
    }
    const token = crypto.randomUUID();

    // Create a new session
    // NOTE: adjust columns to match your existing schema if needed.
    const sessionRes = await client.query(
      `
      INSERT INTO formsessions
        (form_id, user_id, session_token, current_step, total_steps, is_completed, expires_at, client_ip, user_agent, created_at, updated_at,
         workflow_run_id, workflow_item_id)
      VALUES
        ($1, $2, $3, 1 , $4, FALSE, (NOW() + INTERVAL '3 months'), NULL, NULL, NOW(), NOW(), $5, $6)
      RETURNING session_id, session_token, is_active, is_completed, created_at, updated_at
      `,
      [
        item.form_id,
        userId,
        token,
        item.total_steps,
        item.workflow_run_id,
        itemId,
      ],
    );

    await client.query("COMMIT");
    return {
      workflow_item_id: itemId,
      workflow_run_id: item.workflow_run_id,
      form_id: item.form_id,
      session: sessionRes.rows[0],
      reused: false,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function skipWorkflowItem(itemId, skippedByUserId, reason) {
  if (!reason || !String(reason).trim())
    throw new Error("Skip reason is required");

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const itemRes = await client.query(
      `
      SELECT wi.workflow_item_id, wi.workflow_run_id, wr.status AS run_status
      FROM workflow_items wi
      JOIN workflow_runs wr ON wr.workflow_run_id = wi.workflow_run_id
      WHERE wi.workflow_item_id = $1
      `,
      [itemId],
    );

    if (!itemRes.rows.length)
      throw new Error(`Workflow item ${itemId} not found`);
    const { workflow_run_id, run_status } = itemRes.rows[0];

    if (String(run_status).toLowerCase() === "cancelled") {
      throw new Error("Workflow run is cancelled");
    }

    await client.query(
      `
      UPDATE workflow_items
      SET status = 'skipped',
          skipped_reason = $2,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE workflow_item_id = $1
      `,
      [itemId, String(reason).trim()],
    );

    const status = await recomputeWorkflowRunStatus(workflow_run_id, client);

    await client.query("COMMIT");
    return { workflow_item_id: itemId, workflow_run_id, status };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Add another item instance for repeatable forms.
 * You can call this with either:
 * - (runId, workflowFormId) or
 * - (existingItemId) and infer workflow_form_id + run_id
 */
async function addRepeatWorkflowItem({
  runId,
  workflowFormId,
  fromItemId = null,
  assigned_user_id = null,
  display_name,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let resolvedRunId = runId;
    let resolvedWfFormId = workflowFormId;

    if (fromItemId) {
      const baseRes = await client.query(
        `
        SELECT workflow_run_id, workflow_form_id
        FROM workflow_items
        WHERE workflow_item_id = $1
        `,
        [fromItemId],
      );
      if (!baseRes.rows.length)
        throw new Error(`Workflow item ${fromItemId} not found`);
      resolvedRunId = baseRes.rows[0].workflow_run_id;
      resolvedWfFormId = baseRes.rows[0].workflow_form_id;
    }

    if (!resolvedRunId || !resolvedWfFormId) {
      throw new Error("runId and workflowFormId (or fromItemId) are required");
    }

    // Check run not locked/cancelled and form allow_multiple
    const gateRes = await client.query(
      `
      SELECT
        wr.status AS run_status,
        wr.locked_at,
        wf.allow_multiple
      FROM workflow_runs wr
      JOIN workflow_forms wf
        ON wf.workflow_form_id = $2
      WHERE wr.workflow_run_id = $1
      `,
      [resolvedRunId, resolvedWfFormId],
    );

    if (!gateRes.rows.length)
      throw new Error("Run or workflow form rule not found");

    const { run_status, locked_at, allow_multiple } = gateRes.rows[0];

    if (String(run_status).toLowerCase() === "cancelled") {
      throw new Error("Workflow run is cancelled");
    }
    if (locked_at) {
      throw new Error("Workflow run is locked");
    }
    if (!allow_multiple) {
      throw new Error("This workflow form does not allow multiple submissions");
    }

    // Next sequence number
    const seqRes = await client.query(
      `
      SELECT COALESCE(MAX(sequence_num), 0) AS max_seq
      FROM workflow_items
      WHERE workflow_run_id = $1
        AND workflow_form_id = $2
      `,
      [resolvedRunId, resolvedWfFormId],
    );

    const nextSeq = Number(seqRes.rows[0]?.max_seq ?? 0) + 1;

    const insRes = await client.query(
      `
      INSERT INTO workflow_items
        (workflow_run_id, workflow_form_id, sequence_num, status, assigned_user_id, created_at, updated_at, display_name)
      VALUES
        ($1, $2, $3, 'not_started', $4, NOW(), NOW(), $5)
      RETURNING workflow_item_id, workflow_run_id, workflow_form_id, sequence_num, status, assigned_user_id
      `,
      [
        resolvedRunId,
        resolvedWfFormId,
        nextSeq,
        assigned_user_id ?? null,
        display_name,
      ],
    );

    // New item means run should not be completed anymore if it was
    const status = await recomputeWorkflowRunStatus(resolvedRunId, client);

    await client.query("COMMIT");
    return { item: insRes.rows[0], status };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// -------------------------
// Optional: hook you call from "response submitted" flow
// -------------------------

/**
 * When a response is finalized (your existing response submission pipeline),
 * call this if response has workflow_run_id + workflow_item_id set.
 *
 * - set item submitted
 * - set completed_at
 * - recompute run
 */
async function markWorkflowItemSubmitted({
  workflow_item_id,
  workflow_run_id,
}) {
  if (!workflow_item_id || !workflow_run_id) return null;

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE workflow_items
      SET status = 'submitted',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE workflow_item_id = $1
        AND workflow_run_id = $2
      `,
      [workflow_item_id, workflow_run_id],
    );

    const status = await recomputeWorkflowRunStatus(workflow_run_id, client);

    await client.query("COMMIT");
    return { workflow_item_id, workflow_run_id, status };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getTasks(userId) {
  const sql = `SELECT wi.workflow_item_id, 
	wi.workflow_run_id, 
	wi.workflow_form_id, 
	wi.sequence_num, 
	wi.status, 
	wi.assigned_user_id, 
	wi.skipped_reason, 
	wi.completed_at, 
	wi.created_at, 
	wi.updated_at,
	f.form_id,
	f.title,
  f.form_key,
	f.description,
	u.display_name,
	wr.display_name,
	wr.status,
	wr.cancelled_at
	FROM public.workflow_items wi
	LEFT JOIN workflow_forms wf on wf.workflow_form_id = wi.workflow_form_id
	LEFT JOIN Forms f on f.form_id = wf.form_id
	LEFT JOIN Users u on u.user_id = wi.assigned_user_id
	LEFT JOIN Workflow_runs wr on wr.workflow_run_id = wi.workflow_run_id
	WHERE wi.status not ilike '%skipped%'
	AND wr.cancelled_at is null
	AND wr.status not ilike '%completed%'
	AND wi.assigned_user_id = $1
	ORDER BY sequence_num;`;

  return await query(sql, [userId]);
}

async function changeItemDisplayName(display_name, item_id) {
  const pool = await getPool();
  const client = await pool.connect();

  const sql = `UPDATE public.workflow_items SET display_name = $1 WHERE workflow_item_id = $2`;
  try {
    await client.query("BEGIN");
    client.query(sql, [display_name, item_id]);
    await client.query("COMMIT");
    return {
      status: "Success",
      message: "Successfully Updated the name",
      display_name: display_name,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  listWorkflowRuns,

  // workflow_forms
  createWorkflowForm,
  removeWorkflowForm,
  getWorkflowForm,
  listWorkflowForms,
  updateWorkflowForm,

  // runs
  createWorkflowRun,
  getWorkflowRunDashboard,
  lockWorkflowRun,
  cancelWorkflowRun,

  // items
  assignWorkflowItem,
  startWorkflowItem,
  skipWorkflowItem,
  addRepeatWorkflowItem,
  markWorkflowItemSubmitted,
  changeItemDisplayName,

  // shared
  recomputeWorkflowRunStatus,
  getTasks,
};
