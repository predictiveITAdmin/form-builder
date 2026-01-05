const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const {
  getUserPermissionsByUserId,
  getUserByEntraObjectId,
} = require("../services/auth/queries");

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

/* -------------------------------------------------
   Helper: Attach permissions once identity is known
-------------------------------------------------- */
async function attachPermissions(req) {
  if (!req.user?.userId) return;

  const permissions = await getUserPermissionsByUserId(req.user.userId);

  req.user.permissions = new Set(permissions.map((p) => p.permission_code));
}

const authMiddleware = async (req, res, next) => {
  try {
    /* -------------------------------------------------
       1️⃣ SESSION AUTH (Azure SSO)
    -------------------------------------------------- */
    if (req.session?.account) {
      const resolvedUser = await getUserByEntraObjectId(
        req.session.account.localAccountId
      );
      req.user = {
        ...req.session.account,
        userId: resolvedUser.user_id,
        authSource: "session",
        type: "internal",
      };

      await attachPermissions(req);
      return next();
    }

    /* -------------------------------------------------
       2️⃣ AUTH HEADER REQUIRED
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

        await attachPermissions(req);
        return next();
      }
    } catch (err) {
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
      async (err, decoded) => {
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
          userId: decoded.oid || decoded.sub, // map Azure identity → local user
          oid: decoded.oid,
          email,
          name: decoded.name || decoded.given_name || null,
          roles: new Set(decoded.roles || []),
          groups: new Set(decoded.groups || []),
          authSource: "azure",
        };

        await attachPermissions(req);
        return next();
      }
    );
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = { authMiddleware };
