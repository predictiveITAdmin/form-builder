const { query } = require("../db/pool");

const maintenanceMiddleware = async (req, res, next) => {
  // Always allow health checks, authentication, and settings (so admins can disable it)
  const allowedPrefixes = [
    "/api/health",
    "/api/verify",
    "/api/auth",
    "/api/settings",
    "/api-docs"
  ];

  if (allowedPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  try {
    const settingsRes = await query(`SELECT value FROM public.settings WHERE property = 'maintenance_mode'`);
    if (settingsRes.length > 0 && settingsRes[0].value === 'true') {
      return res.status(503).json({
        success: false,
        message: "System is currently in maintenance mode. Please try again later.",
        maintenance: true
      });
    }
  } catch (err) {
    console.error("[Maintenance Middleware] Error checking maintenance mode", err);
  }

  next();
};

module.exports = maintenanceMiddleware;
