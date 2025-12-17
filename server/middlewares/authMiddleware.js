const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const tenantId = process.env.AZURE_TENANT_ID;
const allowedAud = new Set(
  (process.env.AZURE_ALLOWED_AUDIENCES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const azureClient = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
});

function getAzureKey(header, cb) {
  azureClient.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

const authMiddleware = (req, res, next) => {
  /* -------------------------------------------------
     1️⃣ SESSION AUTH (Azure SSO)
  -------------------------------------------------- */
  if (req.session?.account) {
    console.log("entered");
    req.user = {
      ...req.session.account,
      authSource: "session",
      type: "internal",
    };
    return next();
  }

  /* -------------------------------------------------
     2️⃣ AUTH HEADER (JWT or Azure Bearer)
  -------------------------------------------------- */
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = authHeader.slice(7);

  /* -------------------------------------------------
     3️⃣ LOCAL JWT (HS256)
  -------------------------------------------------- */
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: false,
    });

    if (decoded?.userId) {
      req.user = {
        type: "external",
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        displayName: decoded.displayName,
        authSource: "jwt",
      };
      return next();
    }
  } catch (err) {
    console.log(err);
    // Not a local JWT → continue to Azure
  }

  /* -------------------------------------------------
     4️⃣ AZURE BEARER TOKEN (RS256)
  -------------------------------------------------- */
  jwt.verify(
    token,
    getAzureKey,
    {
      algorithms: ["RS256"],
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: (raw, decoded) =>
        allowedAud.size === 0 || allowedAud.has(decoded.aud),
    },
    (err, decoded) => {
      if (err) {
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

      req.user = {
        type: "internal",
        oid: decoded.oid || decoded.sub,
        email,
        name: decoded.name || decoded.given_name || null,
        roles: new Set(decoded.roles || []),
        groups: new Set(decoded.groups || []),
        authSource: "azure",
      };

      return next();
    }
  );
};

module.exports = { authMiddleware };
