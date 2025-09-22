const ensureAuthenticated = (req, res, next) => {
  console.log(req.session);
  if (req.session?.isAuthenticated && req.session?.account) return next();
  res.status(401).json({ authenticated: false });
};

module.exports = { ensureAuthenticated };
