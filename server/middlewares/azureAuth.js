const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const tenantId = process.env.AZURE_TENANT_ID; // required
const allowedAud = new Set(
  (process.env.AZURE_ALLOWED_AUDIENCES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header, cb) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

function extractClaims(decoded) {
  const email =
    decoded.email ||
    (Array.isArray(decoded.emails) ? decoded.emails[0] : null) ||
    decoded.preferred_username ||
    null;

  // App Roles show up in `roles`. Groups may show up in `groups`.
  const roles = new Set(Array.isArray(decoded.roles) ? decoded.roles : []);
  const groups = new Set(Array.isArray(decoded.groups) ? decoded.groups : []);

  return {
    oid: decoded.oid || decoded.sub,
    tid: decoded.tid,
    email,
    name: decoded.name || decoded.given_name || null,
    roles,
    groups,
    raw: decoded,
  };
}

function verifyToken(required = true) {
  return (req, res, next) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      if (required)
        return res.status(401).json({ error: "Missing bearer token" });
      req.azureUser = null;
      return next();
    }

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        audience: (raw, decoded) =>
          allowedAud.size === 0 || allowedAud.has(decoded.aud),
      },
      (err, decoded) => {
        if (err)
          return res
            .status(401)
            .json({ error: "Invalid token", detail: err.message });
        req.azureUser = extractClaims(decoded);
        next();
      }
    );
  };
}

module.exports = {
  azureAuth: () => verifyToken(true),
  optionalAzureAuth: () => verifyToken(false),
};
