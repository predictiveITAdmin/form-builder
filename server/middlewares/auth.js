const ensureAuthenticated = (req, res, next) => {

  if (req.session?.isAuthenticated && req.session?.account) return next();
  res.status(401).json({ authenticated: false });
};

module.exports = { ensureAuthenticated };
