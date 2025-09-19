const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { errorHandler } = require("./middlewares/error");
const authRoutes = require("./services/auth/routes");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const { ensureAuthenticated } = require("./middlewares/auth");

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
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

app.use("/auth", authRoutes);

app.use(errorHandler);

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  })
);

app.get("/verify", ensureAuthenticated, (req, res) => {
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
