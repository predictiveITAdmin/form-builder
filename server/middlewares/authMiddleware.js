const jwt = require("jsonwebtoken");
const { azureAuth } = require("./azureAuth");

const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET ||
        "adb854535074b282f32dc1d1204e5d6634a203c964463abfb20xc",
      { ignoreExpiration: false }
    );
    if (decoded.userId) {
      req.user = {
        type: "external",
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        displayName: decoded.displayName,
      };
      return next();
    }
  } catch (jwtError) {
    // Not a valid external JWT, try Azure AD verification
    // This is expected for Azure tokens, so we continue
  }
  const jwksClient = require("jwks-rsa");
  const tenantId = process.env.AZURE_TENANT_ID;
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
  });

  function getKey(header, cb) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return cb(err);
      cb(null, key.getPublicKey());
    });
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
      if (err) {
        // Neither external JWT nor Azure token is valid
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
      const email =
        decoded.email ||
        (Array.isArray(decoded.emails) ? decoded.emails[0] : null) ||
        decoded.preferred_username ||
        null;

      const roles = new Set(Array.isArray(decoded.roles) ? decoded.roles : []);
      const groups = new Set(
        Array.isArray(decoded.groups) ? decoded.groups : []
      );

      req.user = {
        type: "internal",
        oid: decoded.oid || decoded.sub,
        email,
        name: decoded.name || decoded.given_name || null,
        roles,
        groups,
      };

      return next();
    }
  );
};
