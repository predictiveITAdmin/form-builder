const AppError = require("../errors/AppError");

// Optional: hide stack traces in prod
const isProd = process.env.NODE_ENV === "production";

// Postgres helpers (if you're using pg)
function isPgError(err) {
  return Boolean(err && err.code && typeof err.code === "string");
}

// Common PG codes you’ll actually hit
function mapPgError(err) {
  // Unique violation
  if (err.code === "23505") {
    return new AppError(
      "Duplicate value violates unique constraint",
      409,
      {
        constraint: err.constraint,
        detail: err.detail,
      },
      "UNIQUE_VIOLATION"
    );
  }

  // Foreign key violation
  if (err.code === "23503") {
    return new AppError(
      "Referenced resource does not exist",
      400,
      {
        constraint: err.constraint,
        detail: err.detail,
      },
      "FK_VIOLATION"
    );
  }

  // Not-null violation
  if (err.code === "23502") {
    return new AppError(
      "Missing required field",
      400,
      {
        column: err.column,
        detail: err.detail,
      },
      "NOT_NULL_VIOLATION"
    );
  }

  // Check constraint violation
  if (err.code === "23514") {
    return new AppError(
      "Invalid value (check constraint failed)",
      400,
      {
        constraint: err.constraint,
        detail: err.detail,
      },
      "CHECK_VIOLATION"
    );
  }

  return null;
}

module.exports = function errorHandler(err, req, res, next) {
  // 1) Normalize weird thrown things into Errors
  let normalizedErr = err;

  if (!normalizedErr) {
    normalizedErr = new AppError("Unknown error", 500);
  } else if (typeof normalizedErr === "string") {
    normalizedErr = new AppError(normalizedErr, 500);
  } else if (!(normalizedErr instanceof Error)) {
    normalizedErr = new AppError("Non-error thrown", 500, {
      thrown: normalizedErr,
    });
  }

  // 2) Map DB errors into meaningful HTTP errors
  if (isPgError(normalizedErr) && !(normalizedErr instanceof AppError)) {
    const mapped = mapPgError(normalizedErr);
    if (mapped) normalizedErr = mapped;
  }

  // 3) Determine status
  const status = normalizedErr.statusCode || 500;

  // 4) Build response payload (consistent shape)
  const payload = {
    error: normalizedErr.name || "Error",
    message: normalizedErr.message || "Internal Server Error",
  };

  if (normalizedErr.code) payload.code = normalizedErr.code;
  if (normalizedErr.details) payload.details = normalizedErr.details;

  // Add request id if you have one (good for log correlation)
  // if (req.id) payload.requestId = req.id;

  // 5) Logging
  const logMeta = {
    method: req.method,
    path: req.originalUrl || req.url,
    status,
  };

  if (status >= 500) {
    console.error("[ERROR]", logMeta, normalizedErr);
  } else {
    // Keep it quieter for 4xx unless you want noisy logs
    console.warn("[WARN]", logMeta, {
      name: normalizedErr.name,
      message: normalizedErr.message,
      code: normalizedErr.code,
    });
  }

  // 6) Hide stack in prod
  if (!isProd) {
    payload.stack = normalizedErr.stack;
  }

  return res.status(status).json(payload);
};
