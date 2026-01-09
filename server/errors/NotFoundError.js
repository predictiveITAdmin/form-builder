const AppError = require("./AppError");

class NotFoundError extends AppError {
  constructor(message = "Not Found", details = null, code = "NOT_FOUND") {
    super(message, 404, details, code);
  }
}

module.exports = NotFoundError;
