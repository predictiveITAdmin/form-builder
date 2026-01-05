const crypto = require("crypto");
const { URL } = require("url");
const http = require("node:http");
const https = require("node:https");

function sign(body, secret) {
  if (!secret) return null;
  const h = crypto.createHmac("sha256", secret);
  h.update(body, "utf8");
  return "sha256=" + h.digest("hex");
}

function postJson(urlStr, payload, { timeoutMs = 8000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const client = url.protocol === "http:" ? http : https;

    const req = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: url.pathname + (url.search || ""),
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            return reject(
              new Error(
                `Webhook ${res.statusCode} ${
                  res.statusMessage
                }: ${chunks?.slice(0, 500)}`
              )
            );
          }
          resolve({ statusCode: res.statusCode, body: chunks });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function deliverWithRetry(
  { url, secret, timeoutMs, retryCount },
  payload
) {
  const body = JSON.stringify(payload);
  const headers = {};
  const sig = sign(body, secret);
  if (sig) headers["X-RPA-Signature"] = sig;
  headers["X-Form-Id"] = String(payload.form.id);
  headers["X-Response-Id"] = String(payload.response.id);

  let attempt = 0;
  const max = Math.max(0, Number(retryCount ?? 3));
  const baseDelay = 750;

  while (true) {
    try {
      await postJson(url, body, { timeoutMs, headers });
      return;
    } catch (err) {
      if (attempt >= max) throw err;
      const sleep = baseDelay * Math.pow(2, attempt); // 0.75s, 1.5s, 3s, ...
      await new Promise((r) => setTimeout(r, sleep));
      attempt++;
    }
  }
}

module.exports = { deliverWithRetry };
