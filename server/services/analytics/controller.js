const svc = require("./queries");

async function getHomeDashboard(req, res, next) {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const data = await svc.getHomeDashboardData(userId);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getHomeDashboard,
};
