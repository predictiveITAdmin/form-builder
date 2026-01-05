// middleware/hasPermissions.js
const hasPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    console.log(req.user);
    const userPermissions = req.user?.permissions;

    if (!userPermissions || !(userPermissions instanceof Set)) {
      return res.status(403).json({
        success: false,
        message: "Permissions not loaded",
      });
    }

    if (userPermissions.has("*")) {
      return next();
    }

    const missing = requiredPermissions.filter(
      (perm) => !userPermissions.has(perm)
    );

    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        missingPermissions: missing,
      });
    }

    return next();
  };
};

const hasAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions;

    if (!userPermissions || !(userPermissions instanceof Set)) {
      return res.status(403).json({
        success: false,
        message: "Permissions not loaded",
      });
    }

    if (userPermissions.has("*")) {
      return next();
    }

    const hasAtLeastOne = requiredPermissions.some((perm) =>
      userPermissions.has(perm)
    );

    if (!hasAtLeastOne) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        requiredAnyOf: requiredPermissions,
      });
    }
    return next();
  };
};

module.exports = { hasPermissions, hasAnyPermission };
