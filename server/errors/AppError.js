class AppError extends Error {
  constructor(message, statusCode = 500, details = null, code = null) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details ?? undefined;
    this.code = code ?? undefined; // optional app-specific code
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
