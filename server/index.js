const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { errorHandler } = require("./middlewares/error");
const authRoutes = require("./services/auth/routes");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { query } = require("./db/pool");
// Import API From Services
const formsRoutes = require("./services/forms/routes");

dotenv.config();

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173/",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET || "asd213213ds123d123v",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
    },
  })
);

app.use("/api/auth", authRoutes);

app.use(errorHandler);

app.get("/api/health", async (req, res) => {
  try {
    const [row] = await query("SELECT 1 AS ok");
    if (row?.ok !== 1) {
      return res.status(500).json({ status: "fail" });
    }
    res.json({
      status: "ok",
      dbStatus: "up",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      error: err.message,
    });
  }
});

app.get("/verify", (req, res) => {
  const { account } = req.session;
  console.log(account);
  res.json({
    authenticated: true,
    user: {
      name: account?.name,
      username: account?.username || account?.homeAccountId,
      oid: account?.localAccountId,
    },
  });
});

app.use("/api/forms", formsRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
