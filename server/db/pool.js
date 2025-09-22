const sql = require("mssql");

let poolPromise;

function envBool(name, def = "true") {
  return String(process.env[name] ?? def).toLowerCase() === "true";
}

function getEnv() {
  return {
    server: process.env.SQL_SERVER || "localhost",
    instance: process.env.SQL_INSTANCE || "",
    port: Number(process.env.SQL_PORT || 1433),
    database: process.env.SQL_DATABASE || "erp-itbd",
    user: process.env.SQL_USER || "sa",
    password: process.env.SQL_PASSWORD || "",
    encrypt: envBool("SQL_ENCRYPT", "true"),
    trustServerCertificate: envBool("SQL_TRUST_SERVER_CERT", "true"),
    poolMax: Number(process.env.SQL_POOL_MAX || 10),
    poolMin: Number(process.env.SQL_POOL_MIN || 0),
    poolIdle: Number(process.env.SQL_POOL_IDLE_MS || 30000),
  };
}

function buildConnectionString(e) {
  const serverPart = e.instance
    ? `${e.server}\\${e.instance}`
    : `${e.server},${e.port}`;

  const parts = [
    `Server=${serverPart}`,
    `Database=${e.database}`,
    `User Id=${e.user}`,
    `Password=***redacted***`,
    `Encrypt=${e.encrypt ? "True" : "False"}`,
    `TrustServerCertificate=${e.trustServerCertificate ? "True" : "False"}`,
  ];
  return parts.join(";") + ";";
}

function buildMssqlConfig(e) {
  const cfg = {
    server: e.server,
    database: e.database,
    user: e.user,
    password: e.password,
    pool: {
      max: e.poolMax,
      min: e.poolMin,
      idleTimeoutMillis: e.poolIdle,
    },
    options: {
      encrypt: e.encrypt,
      trustServerCertificate: e.trustServerCertificate,
      enableArithAbort: true,
    },
  };

  if (e.instance) {
    cfg.options.instanceName = e.instance;
  } else {
    cfg.port = e.port;
  }
  return cfg;
}

async function getPool() {
  if (!poolPromise) {
    const env = getEnv();
    const cfg = buildMssqlConfig(env);
    const cs = buildConnectionString(env);
    console.log(`[db] Connecting with: ${cs}`);

    const pool = new sql.ConnectionPool(cfg);
    poolPromise = pool.connect().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

async function query(text, params = {}) {
  const pool = await getPool();
  const req = pool.request();
  for (const [k, v] of Object.entries(params)) req.input(k, v);
  const result = await req.query(text);
  return result.recordset;
}

async function closePool() {
  try {
    if (poolPromise) {
      const pool = await poolPromise;
      await pool.close();
    }
  } catch {}
}

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

module.exports = { sql, getPool, query, buildConnectionString };
