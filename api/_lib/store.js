// Storage for cloud saves: one small private JSON file per explorer.
// On Vercel this is a private Blob store. On a developer's machine it is a folder.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class Conflict extends Error {}

const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;
const onVercel = () => !!process.env.VERCEL;

// ───────── Vercel Blob (private store)
const blob = {
  async read(key) {
    const { get } = await import("@vercel/blob");
    const r = await get(key, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return { text: await new Response(r.stream).text(), etag: r.blob.etag };
  },
  async write(key, text, { ifMatch, create } = {}) {
    const { put, BlobPreconditionFailedError } = await import("@vercel/blob");
    try {
      const b = await put(key, text, { access: "private", addRandomSuffix: false, allowOverwrite: !create,
        contentType: "application/json", ...(ifMatch ? { ifMatch } : {}) });
      return { etag: b.etag };
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(e.message || "")) throw new Conflict();
      throw e;
    }
  },
  async remove(key) { const { del } = await import("@vercel/blob"); await del(key); },
  async countFolders(prefix) {
    const { list } = await import("@vercel/blob");
    const r = await list({ prefix, mode: "folded", limit: 1000 });
    return (r.folders || []).length;
  },
};

// ───────── local folder (development and tests)
const dir = () => process.env.SYNC_DATA_DIR || path.resolve(".data");
const etagOf = text => `"${createHash("sha1").update(text).digest("hex")}"`;
const file = {
  async read(key) {
    try { const text = await readFile(path.join(dir(), key), "utf8"); return { text, etag: etagOf(text) }; }
    catch { return null; }
  },
  async write(key, text, { ifMatch, create } = {}) {
    const cur = await file.read(key);
    if (create && cur) throw new Conflict();
    if (ifMatch && (!cur || cur.etag !== ifMatch)) throw new Conflict();
    const full = path.join(dir(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text);
    return { etag: etagOf(text) };
  },
  async remove(key) { await rm(path.dirname(path.join(dir(), key)), { recursive: true, force: true }); },
  async countFolders(prefix) {
    try { return (await readdir(path.join(dir(), prefix), { withFileTypes: true })).filter(d => d.isDirectory()).length; }
    catch { return 0; }
  },
};

function pick() {
  if (blobToken()) return blob;
  if (onVercel()) throw Object.assign(new Error("Blob storage is not connected to this project"), { status: 503 });
  return file;
}
export const read = key => pick().read(key);
export const write = (key, text, opts) => pick().write(key, text, opts);
export const remove = key => pick().remove(key);
export const countFolders = prefix => pick().countFolders(prefix);
