const AppError = require("./AppError");

class ConflictError extends AppError {
  constructor(message = "Conflict", details = null, code = "CONFLICT") {
    super(message, 409, details, code);
  }
}

module.exports = ConflictError;
