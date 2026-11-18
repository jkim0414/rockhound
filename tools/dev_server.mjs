// Local development server: the static app plus the cloud-save API, with saves kept
// in the .data folder instead of the real cloud.
//   node tools/dev_server.mjs 5173 [5174 ...]
// Two ports act like two separate devices (each address has its own browser storage).
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.SYNC_SECRET ||= "dev-only-secret-0123456789abcdef0123456789abcdef";
process.env.FAMILY_KEY ||= "dev-family-key";
const { default: sync } = await import("../api/sync.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const HIDDEN = /^\/(api|tools|node_modules|\.[^/]+)(\/|$)/;

async function serve(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/sync") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = null; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    return sync(req, res);
  }
  if (url.pathname.startsWith("/_vercel/")) {            // visit counting only exists on the live site
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    return res.end("/* analytics is off on this computer */");
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const full = path.join(root, rel);
  if (HIDDEN.test(rel) || !full.startsWith(root + path.sep)) { res.statusCode = 404; return res.end("Not found"); }
  try {
    const data = await readFile(full);
    res.setHeader("Content-Type", TYPES[path.extname(full)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(data);
  } catch { res.statusCode = 404; res.end("Not found"); }
}

const ports = process.argv.slice(2).map(Number).filter(Boolean);
for (const port of ports.length ? ports : [5173]) http.createServer(serve).listen(port, () => console.log(`Rockhound dev server: http://localhost:${port}`));
