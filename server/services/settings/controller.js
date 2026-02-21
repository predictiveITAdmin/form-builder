const queries = require("./queries");

async function getSettings(req, res) {
  try {
    const settings = await queries.getAllSettings();
    // Transform array of rows into a key-value map for easier consumption
    const settingsMap = settings.reduce((acc, current) => {
      acc[current.property] = current.value;
      return acc;
    }, {});
    
    return res.json({ success: true, settings: settingsMap, raw: settings });
  } catch (err) {
    console.error("Error fetching settings:", err);
    return res.status(500).json({ success: false, message: "Error fetching settings" });
  }
}

async function updateSettings(req, res) {
  try {
    const { settings } = req.body; // Expecting an array of { property, value, meta } or a key-value object
    if (!settings) {
      return res.status(400).json({ success: false, message: "Missing settings data" });
    }

    const userId = req.user?.userId;

    const updated = [];
    if (Array.isArray(settings)) {
      for (const item of settings) {
        const result = await queries.updateSetting(item.property, item.value, item.meta, userId);
        updated.push(result);
      }
    } else {
      for (const [key, value] of Object.entries(settings)) {
        const result = await queries.updateSetting(key, value, null, userId);
        updated.push(result);
      }
    }

    return res.json({ success: true, message: "Settings updated successfully", updated });
  } catch (err) {
    console.error("Error updating settings:", err);
    return res.status(500).json({ success: false, message: "Error updating settings", error: err.message });
  }
}

const { getPool } = require("../../db/pool");

// In-memory map to store active transactions mapped by txId
const activeTransactions = new Map();

async function runRawSql(req, res) {
  try {
    const { query, action, txId } = req.body;
    // action: 'execute', 'commit', 'rollback'

    if (action === 'commit' || action === 'rollback') {
      if (!txId || !activeTransactions.has(txId)) {
        return res.status(400).json({ success: false, message: "Transaction not found or expired" });
      }

      const tx = activeTransactions.get(txId);
      clearTimeout(tx.timeout);

      try {
        if (action === 'commit') {
          await tx.client.query('COMMIT');
        } else {
          await tx.client.query('ROLLBACK');
        }
      } catch (err) {
        console.error(`Error during ${action}:`, err);
      } finally {
        tx.client.release();
        activeTransactions.delete(txId);
      }

      return res.json({ success: true, message: `Transaction ${action} successful` });
    }

    // Default action is 'execute'
    if (!query) {
      return res.status(400).json({ success: false, message: "No SQL query provided" });
    }

    const pool = await getPool();
    const client = await pool.connect();
    
    // Start a transaction
    await client.query('BEGIN');
    
    let result;
    try {
      result = await client.query(query);
    } catch (err) {
      // Query failed, rollback immediately and release
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: "SQL Execution Error",
        error: err.message
      });
    }

    // Determine if it was just a SELECT query
    const isSelect = query.trim().toLowerCase().startsWith('select');

    if (isSelect) {
      // For SELECT queries, we don't need to hold the transaction. Release immediately.
      await client.query('ROLLBACK');
      client.release();
      
      return res.json({
        success: true,
        command: result.command,
        rowCount: result.rowCount,
        rows: result.rows,
        needsCommit: false
      });
    }

    // For non-SELECT, we hold the transaction
    const newTxId = require('crypto').randomUUID();
    
    // Auto-rollback if not committed within 2 minutes to prevent connection leaks
    const timeout = setTimeout(async () => {
      if (activeTransactions.has(newTxId)) {
        const tx = activeTransactions.get(newTxId);
        try {
          await tx.client.query('ROLLBACK');
        } catch (e) {} finally {
          tx.client.release();
          activeTransactions.delete(newTxId);
        }
      }
    }, 120000);

    activeTransactions.set(newTxId, { client, timeout });

    return res.json({
      success: true,
      command: result.command,
      rowCount: result.rowCount,
      rows: result.rows,
      txId: newTxId,
      needsCommit: true
    });
    
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Server Error",
      error: err.message
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  runRawSql
};
