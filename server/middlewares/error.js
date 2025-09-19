function errorHandler(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "invalid_token" });
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
}

module.exports = { errorHandler };
