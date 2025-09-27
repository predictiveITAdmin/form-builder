const GROUP_ROLE_MAP = (() => {
  try {
    return JSON.parse(process.env.AZURE_GROUP_ROLE_MAP || "{}");
  } catch {
    return {};
  }
})();

function resolveUserRoles(azureUser) {
  if (!azureUser) return new Set();
  const roles = new Set(azureUser.roles);

  // Map groups to roles
  for (const g of azureUser.groups) {
    const mapped = GROUP_ROLE_MAP[g];
    if (mapped) roles.add(mapped);
  }
  return roles;
}

function requireAny(...allowed) {
  const needed = new Set(allowed.flat());
  return (req, res, next) => {
    const roles = resolveUserRoles(req.azureUser);
    for (const r of roles) if (needed.has(r)) return next();
    return res
      .status(403)
      .json({ error: "Forbidden", needAnyOf: Array.from(needed) });
  };
}

module.exports = { requireAny, resolveUserRoles };
