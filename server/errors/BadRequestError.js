const AppError = require("./AppError");

class BadRequestError extends AppError {
  constructor(message = "Bad Request", details = null, code = "BAD_REQUEST") {
    super(message, 400, details, code);
  }
}

module.exports = BadRequestError;
