function saneParams(obj = {}) {
  const p = {};
  for (const [k, v] of Object.entries(obj)) p[k] = v === undefined ? null : v;
  return p;
}

module.exports = saneParams;
