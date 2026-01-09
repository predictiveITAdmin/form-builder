const AppError = require("./AppError");

class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details = null, code = "FORBIDDEN") {
    super(message, 403, details, code);
  }
}

module.exports = ForbiddenError;
