const { Pool } = require("pg");

let pool;

function envBool(name, def = "true") {
  return String(process.env[name] ?? def).toLowerCase() === "true";
}

function getEnv() {
  return {
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE || "form-builder",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "",
    ssl: envBool("PG_SSL", "false"),
    poolMax: Number(process.env.PG_POOL_MAX || 10),
    poolMin: Number(process.env.PG_POOL_MIN || 0),
    poolIdle: Number(process.env.PG_POOL_IDLE_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT || 10000),
  };
}

function buildConnectionString(e) {
  const parts = [
    `Host=${e.host}`,
    `Port=${e.port}`,
    `Database=${e.database}`,
    `Username=${e.user}`,
    `Password=***redacted***`,
    `SSL Mode=${e.ssl ? "Require" : "Disable"}`,
  ];
  return parts.join(";") + ";";
}

function buildPgConfig(e) {
  const cfg = {
    host: e.host,
    port: e.port,
    database: e.database,
    user: e.user,
    password: e.password,
    max: e.poolMax,
    min: e.poolMin,
    idleTimeoutMillis: e.poolIdle,
    connectionTimeoutMillis: e.connectionTimeoutMillis,
  };

  if (e.ssl) {
    cfg.ssl = {
      rejectUnauthorized: false, // Similar to trustServerCertificate
    };
  }

  return cfg;
}

async function getPool() {
  if (!pool) {
    const env = getEnv();
    const cfg = buildPgConfig(env);
    const cs = buildConnectionString(env);
    console.log(`[db] Connecting with: ${cs}`);

    pool = new Pool(cfg);

    pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err);
    });

    // Test the connection
    try {
      const client = await pool.connect();
      client.release();
    } catch (err) {
      pool = undefined;
      throw err;
    }
  }
  return pool;
}

async function query(text, params = []) {
  const pool = await getPool();
  // PostgreSQL uses $1, $2, etc. for parameterized queries
  const result = await pool.query(text, params);
  return result.rows;
}

async function closePool() {
  try {
    if (pool) {
      await pool.end();
      pool = undefined;
    }
  } catch (err) {
    console.error("[db] Error closing pool:", err);
  }
}

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

module.exports = { Pool, getPool, query, buildConnectionString };
