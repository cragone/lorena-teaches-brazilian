// Tarpit-friendly honeypot. Zero dependencies. Fake data only (see ../HONEYPOT.md).
// Env: PORT (default 4100), HONEYPOT_URL, HITS_FILE (default ./hits.jsonl)
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 4100);
const BASE = (process.env.HONEYPOT_URL || "https://api.charlesragone.com").replace(/\/$/, "");
const HITS = process.env.HITS_FILE || new URL("./hits.jsonl", import.meta.url).pathname;
const MAX_DELAYED = 50;
const TRAP = /^\/(api|admin|internal)(\/|$)/;
const out = fs.createWriteStream(HITS, { flags: "a" });
let delayed = 0;

const num = (seed) => parseInt(crypto.createHash("md5").update(seed).digest("hex").slice(0, 8), 16);
const FIRST = ["ana", "bruno", "carla", "diego", "elisa", "felipe", "gabi", "hugo", "iris", "joao"];

function fake(path, query) {
  const h = num(path), page = Math.max(1, parseInt(query.get("page")) || 1);
  const seg = path.split("/").filter(Boolean);
  const root = "/" + seg[0];
  const users = Array.from({ length: 10 }, (_, i) => {
    const id = (page - 1) * 10 + i + 1;
    const n = FIRST[(h + id) % 10];
    return { id, name: n, email: `${n}${id}@example.invalid`, role: id % 7 ? "user" : "admin",
      links: { self: `${BASE}${root}/v2/users/${id}`, orders: `${BASE}${root}/v2/users/${id}/orders` } };
  });
  return {
    data: users,
    page, per_page: 10, total: 48213,
    next: `${BASE}${path}?page=${page + 1}`,
    prev: page > 1 ? `${BASE}${path}?page=${page - 1}` : null,
    _links: {
      users: `${BASE}${root}/v2/users`, export: `${BASE}${root}/v2/export?token=tmp_${h.toString(36)}`,
      config: `${BASE}/internal/v1/config`, admin: `${BASE}/admin/api/sessions`,
    },
  };
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname.slice(0, 256);
  out.write(JSON.stringify({
    ts: new Date().toISOString(), ip: req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress,
    method: req.method, path, query: url.search.slice(0, 256), host: req.headers.host,
    ua: String(req.headers["user-agent"] || "").slice(0, 200), referer: String(req.headers.referer || "").slice(0, 200),
  }) + "\n");
  req.resume(); // discard any body

  const send = () => {
    if (res.destroyed) return;
    if (!TRAP.test(path)) { res.writeHead(404, { "content-type": "application/json" }); return res.end('{"error":"not_found"}'); }
    res.writeHead(200, { "content-type": "application/json", "x-powered-by": "Express" });
    res.end(JSON.stringify(fake(path, url.searchParams)));
  };

  if (!TRAP.test(path) || delayed >= MAX_DELAYED) return send(); // over cap: answer immediately, no held socket
  delayed++;
  let done = false;
  const release = () => { if (!done) { done = true; delayed--; } };
  res.on("close", release);
  setTimeout(() => { release(); send(); }, 1000 + Math.random() * 2000);
}).listen(PORT, () => console.log(`honeypot on :${PORT}, logging to ${HITS}`));
