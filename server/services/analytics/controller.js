const svc = require("./queries");

async function getHomeDashboard(req, res, next) {
  /*
    #swagger.tags = ['Analytics']
    #swagger.summary = 'Get personalized home dashboard data'
    #swagger.responses[200] = {
      description: 'Fetched home dashboard',
      schema: { totalTasks: 5, pendingForms: 2 }
    }
  */
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const data = await svc.getHomeDashboardData(userId);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

async function getAdminDashboard(req, res, next) {
  /*
    #swagger.tags = ['Analytics']
    #swagger.summary = 'Get admin system-wide analytics'
    #swagger.responses[200] = {
      description: 'Fetched admin dashboard',
      schema: { activeUsers: 150, totalWorkflows: 30 }
    }
  */
  try {
    // auth middleware already guarantees req.user, and route checks admin perms
    const data = await svc.getAdminDashboardData();
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getHomeDashboard,
  getAdminDashboard,
};
