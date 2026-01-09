const AppError = require("./AppError");

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details = null, code = "UNAUTHORIZED") {
    super(message, 401, details, code);
  }
}

module.exports = UnauthorizedError;
