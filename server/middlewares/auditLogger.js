const { query } = require("../db/pool");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const {
  getUserPermissionsByUserId,
  getUserByEntraObjectId,
} = require("../services/auth/queries");

// ─── Azure JWKS client (same config as authMiddleware) ───────────────────────
const tenantId = process.env.AZURE_TENANT_ID;
const allowedAud = new Set(
  (process.env.AZURE_ALLOWED_AUDIENCES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const azureClient = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
});

function getAzureKey(header, cb) {
  azureClient.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

// ─── Sensitive field redaction ────────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "ssn",
  "creditcard",
]);

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const clean = { ...body };
  for (const key of Object.keys(clean)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) clean[key] = "[REDACTED]";
  }
  return clean;
}

// ─── URL parsing helpers ──────────────────────────────────────────────────────
// ─── Route map: matches Express-style patterns to resource metadata ───────────
// Order matters — more specific patterns must come before generic ones.
const ROUTE_DEFINITIONS = [
  // ── Auth / Users / Roles ──────────────────────────────────────────────────
  {
    pattern: /^\/api\/auth\/users\/([^/]+)\/roles$/,
    resourceType: "user_roles",
    idParam: 1,
  },
  {
    pattern: /^\/api\/auth\/users\/([^/]+)$/,
    resourceType: "users",
    idParam: 1,
  },
  { pattern: /^\/api\/auth\/users$/, resourceType: "users", idParam: null },
  {
    pattern: /^\/api\/auth\/roles\/permissions\/([^/]+)$/,
    resourceType: "role_permissions",
    idParam: 1,
  },
  {
    pattern: /^\/api\/auth\/roles\/permissions$/,
    resourceType: "role_permissions",
    idParam: null,
  },
  {
    pattern: /^\/api\/auth\/roles\/([^/]+)$/,
    resourceType: "roles",
    idParam: 1,
  },
  { pattern: /^\/api\/auth\/roles$/, resourceType: "roles", idParam: null },
  {
    pattern: /^\/api\/auth\/permissions$/,
    resourceType: "permissions",
    idParam: null,
  },
  {
    pattern: /^\/api\/auth\/createUser$/,
    resourceType: "users",
    idParam: null,
  },
  { pattern: /^\/api\/auth\/login$/, resourceType: "auth", idParam: null },
  {
    pattern: /^\/api\/auth\/forgotPassword$/,
    resourceType: "auth",
    idParam: null,
  },
  {
    pattern: /^\/api\/auth\/createPassword$/,
    resourceType: "auth",
    idParam: null,
  },
  { pattern: /^\/api\/auth\/me$/, resourceType: "auth", idParam: null },
  { pattern: /^\/api\/auth\//, resourceType: "auth", idParam: null },

  // ── Forms ─────────────────────────────────────────────────────────────────
  {
    pattern: /^\/api\/forms\/webhooks\/options-callback$/,
    resourceType: "form_webhooks",
    idParam: null,
  },
  {
    pattern: /^\/api\/forms\/draft$/,
    resourceType: "form_drafts",
    idParam: null,
  },
  {
    pattern: /^\/api\/forms\/published\/workflowForms$/,
    resourceType: "forms",
    idParam: null,
  },
  {
    pattern: /^\/api\/forms\/published$/,
    resourceType: "forms",
    idParam: null,
  },
  {
    pattern: /^\/api\/forms\/options-jobs\/([^/]+)$/,
    resourceType: "form_option_jobs",
    idParam: 1,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/assignUsers$/,
    resourceType: "form_users",
    idParam: 1,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/getUsers$/,
    resourceType: "form_users",
    idParam: 1,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/fields\/([^/]+)\/files$/,
    resourceType: "form_files",
    idParam: 1,
    subIdParam: 2,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/fields\/([^/]+)\/options$/,
    resourceType: "form_field_options",
    idParam: 1,
    subIdParam: 2,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/submit$/,
    resourceType: "form_submissions",
    idParam: 1,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/delete$/,
    resourceType: "forms",
    idParam: 1,
  },
  {
    pattern: /^\/api\/forms\/([^/]+)\/([^/]+)$/,
    resourceType: "form_sessions",
    idParam: 1,
    subIdParam: 2,
  },
  { pattern: /^\/api\/forms\/([^/]+)$/, resourceType: "forms", idParam: 1 },
  { pattern: /^\/api\/forms$/, resourceType: "forms", idParam: null },

  // ── Responses ─────────────────────────────────────────────────────────────
  {
    pattern: /^\/api\/responses\/([^/]+)$/,
    resourceType: "responses",
    idParam: 1,
  },
  { pattern: /^\/api\/responses$/, resourceType: "responses", idParam: null },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    pattern: /^\/api\/analytics\/admin$/,
    resourceType: "analytics",
    idParam: null,
  },
  {
    pattern: /^\/api\/analytics\/home$/,
    resourceType: "analytics",
    idParam: null,
  },
  { pattern: /^\/api\/analytics\//, resourceType: "analytics", idParam: null },

  // ── Workflows ─────────────────────────────────────────────────────────────
  {
    pattern: /^\/api\/workflows\/workflow-items\/add$/,
    resourceType: "workflow_items",
    idParam: null,
  },
  {
    pattern: /^\/api\/workflows\/workflow-items\/mark-submitted$/,
    resourceType: "workflow_items",
    idParam: null,
  },
  {
    pattern: /^\/api\/workflows\/workflow-items\/([^/]+)\/assign$/,
    resourceType: "workflow_items",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-items\/([^/]+)\/start$/,
    resourceType: "workflow_items",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-items\/([^/]+)\/skip$/,
    resourceType: "workflow_items",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-items\/([^/]+)\/changeName$/,
    resourceType: "workflow_items",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-runs\/([^/]+)\/lock$/,
    resourceType: "workflow_runs",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-runs\/([^/]+)\/cancel$/,
    resourceType: "workflow_runs",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-runs\/([^/]+)$/,
    resourceType: "workflow_runs",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-runs$/,
    resourceType: "workflow_runs",
    idParam: null,
  },
  {
    pattern: /^\/api\/workflows\/workflow-forms\/([^/]+)$/,
    resourceType: "workflow_forms",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflow-forms$/,
    resourceType: "workflow_forms",
    idParam: null,
  },
  {
    pattern: /^\/api\/workflows\/workflows\/([^/]+)\/forms\/([^/]+)$/,
    resourceType: "workflow_forms",
    idParam: 1,
    subIdParam: 2,
  },
  {
    pattern: /^\/api\/workflows\/workflows\/([^/]+)\/forms$/,
    resourceType: "workflow_forms",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflows\/([^/]+)$/,
    resourceType: "workflows",
    idParam: 1,
  },
  {
    pattern: /^\/api\/workflows\/workflows$/,
    resourceType: "workflows",
    idParam: null,
  },
  {
    pattern: /^\/api\/workflows\/mytasks$/,
    resourceType: "workflow_tasks",
    idParam: null,
  },
];

/**
 * Matches a request path against known route definitions.
 * Returns { resourceType, resourceId, subResourceId }
 */
function parseRoute(path) {
  // Strip query string just in case
  const cleanPath = path.split("?")[0];

  for (const def of ROUTE_DEFINITIONS) {
    const match = cleanPath.match(def.pattern);
    if (match) {
      return {
        resourceType: def.resourceType,
        resourceId: def.idParam ? (match[def.idParam] ?? null) : null,
        subResourceId: def.subIdParam ? (match[def.subIdParam] ?? null) : null,
      };
    }
  }

  // Fallback: unknown route — still capture the top-level service name
  const fallback = cleanPath.match(/^\/api\/([^/]+)/);
  return {
    resourceType: fallback ? fallback[1] : "unknown",
    resourceId: null,
    subResourceId: null,
  };
}

function parseResourceId(path) {
  const ROUTE_SEGMENTS = new Set([
    "api",
    "forms",
    "responses",
    "workflows",
    "analytics",
    "auth",
  ]);
  const match = path.match(/\/([a-zA-Z0-9_-]{1,64})$/);
  return match && !ROUTE_SEGMENTS.has(match[1]) ? match[1] : null;
}

// ─── Core: resolve the user identity from the request ────────────────────────
// Mirrors authMiddleware exactly but:
//   - never calls next() / sends responses
//   - never throws — always resolves (with nulls if unauthenticated/public)
async function resolveAuditUser(req) {
  const nullUser = {
    user_id: null,
    username: null,
    user_name: null,
    auth_source: null,
  };

  try {
    // 1️⃣ Session auth (Azure SSO) ─────────────────────────────────────────
    if (req.session?.account) {
      try {
        const resolvedUser = await getUserByEntraObjectId(
          req.session.account.localAccountId,
        );
        return {
          user_id: resolvedUser?.user_id || req.session.account.localAccountId,
          username: req.session.account.username || null,
          user_name: req.session.account.name || null,
          auth_source: "session",
        };
      } catch {
        // DB lookup failed — fall back to raw session data
        return {
          user_id: req.session.account.localAccountId || null,
          username: req.session.account.username || null,
          user_name: req.session.account.name || null,
          auth_source: "session",
        };
      }
    }

    // 2️⃣ No auth header → public endpoint, still audit but no user ────────
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return nullUser;

    const token = authHeader.slice(7);

    // 3️⃣ Local JWT (HS256) ────────────────────────────────────────────────
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: false,
      });

      if (decoded?.userId) {
        return {
          user_id: decoded.userId,
          username: decoded.email || null,
          user_name: decoded.displayName || null,
          auth_source: "jwt",
        };
      }
    } catch {
      // Not a local JWT — fall through to Azure
    }

    // 4️⃣ Azure Bearer Token (RS256) ───────────────────────────────────────
    return await new Promise((resolve) => {
      jwt.verify(
        token,
        getAzureKey,
        {
          algorithms: ["RS256"],
          issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          audience: (raw, decoded) =>
            allowedAud.size === 0 || allowedAud.has(decoded.aud),
        },
        (err, decoded) => {
          if (err || !decoded) return resolve(nullUser);

          const email =
            decoded.email ||
            (Array.isArray(decoded.emails) ? decoded.emails[0] : null) ||
            decoded.preferred_username ||
            null;

          resolve({
            user_id: decoded.oid || decoded.sub || null,
            username: email,
            user_name: decoded.name || decoded.given_name || null,
            auth_source: "azure",
          });
        },
      );
    });
  } catch {
    return nullUser;
  }
}

// ─── Only audit mutating methods ──────────────────────────────────────────────
const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ─── The middleware ───────────────────────────────────────────────────────────
async function auditLogger(req, res, next) {
  if (!AUDITED_METHODS.has(req.method)) return next();

  // Resolve user in parallel with the request — don't block it
  const userPromise = resolveAuditUser(req);

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    originalEnd(...args);

    // Fire-and-forget after response is flushed
    setImmediate(async () => {
      try {
        const user = await userPromise;
        const { resourceType, resourceId, subResourceId } = parseRoute(
          req.originalUrl,
        );

        await query(
          `INSERT INTO audit_logs
        (user_id, username, user_name, auth_source, ip_address,
         http_method, route, resource_type, resource_id, sub_resource_id,
         request_body, response_status, session_id, user_agent)
       VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
          [
            user.user_id,
            user.username,
            user.user_name,
            user.auth_source,
            req.ip || null,
            req.method,
            req.originalUrl,
            resourceType,
            resourceId,
            subResourceId, // e.g. fieldId inside a form, formId inside a workflow
            JSON.stringify(sanitizeBody(req.body)),
            res.statusCode,
            req.session?.id || null,
            req.headers["user-agent"] || null,
          ],
        );
      } catch (err) {
        console.error("[audit] Failed to write audit log:", err.message);
      }
    });
  };

  next();
}

module.exports = { auditLogger, resolveAuditUser };
