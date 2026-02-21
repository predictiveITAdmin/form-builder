const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middlewares/errorHandler");
const authRoutes = require("./services/auth/routes");
const formsRoutes = require("./services/forms/routes");
const responseRoutes = require("./services/responses/routes");
const analyticRoutes = require("./services/analytics/routes");
const workflowRoutes = require("./services/workflows/routes");
const settingsRoutes = require("./services/settings/routes");
const { query } = require("./db/pool");
const { auditLogger } = require("./middlewares/auditLogger");
const { initCronJobs } = require("./cron");
dotenv.config();

const app = express();

app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // limit each IP to 200 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
});

// Moderate limiter for form submissions / responses
const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions, please slow down." },
});
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- CORS ---
/**
 * Preferred config:
 * - CORS_ORIGINS="https://automation.predictiveit.com,http://localhost:5173"
 * OR
 * - FRONTEND_URL="https://automation.predictiveit.com"
 */
const corsOrigins = new Set(
  (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const microsoftOrigins = [
  "https://login.microsoftonline.com",
  "https://login.microsoft.com",
  "https://login.live.com",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (corsOrigins.has(origin) || microsoftOrigins.includes(origin)) {
        return cb(null, true);
      }


      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

// --- Sessions ---
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "sid",
    secret:
      process.env.EXPRESS_SESSION_SECRET || "dev-insecure-secret-change-me",
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh expiry on activity (optional but usually nicer)
    cookie: {
      httpOnly: true,
      secure: isProd, // must be true in prod if you're using HTTPS
      sameSite: isProd ? "none" : "lax", // "none" required if cross-site cookies; safe if you ever split domains
      maxAge: Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 24), // 1 day default
    },
  }),
);

app.use(auditLogger);

// --- Routes ---
app.get("/api/health", async (req, res) => {
  try {
    const [row] = await query("SELECT 1 AS ok");
    if (row?.ok !== 1) {
      return res.status(500).json({ status: "fail", dbStatus: "down" });
    }

    return res.json({
      status: "ok",
      dbStatus: "up",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    return res.status(500).json({
      status: "fail",
      dbStatus: "down",
      error: err.message,
    });
  }
});

app.get("/api/verify", (req, res) => {
  const account = req.session?.account;

  const authenticated = Boolean(account);
  return res.json({
    authenticated,
    user: authenticated
      ? {
          name: account?.name,
          username: account?.username || account?.homeAccountId,
          oid: account?.localAccountId,
        }
      : null,
  });
});

app.use("/api", globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/analytics", analyticRoutes);
app.use("/api/responses", submitLimiter, responseRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit", require("./services/audit/routes"));

// Optional: central error handler (keep if your project uses it)
app.use(errorHandler);

// --- Listen ---
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`[server] Server running on port ${port}`);
  
  // Register Scheduled Tasks
  initCronJobs();
});
