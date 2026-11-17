// Cloud save codes. A code is the whole credential for one explorer's save, so it is
// long and random (12 random characters = 60 bits) plus 4 check characters that only
// this server can compute. A made-up code fails the check without touching storage.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U (easy to misread)

function secret() {
  const s = process.env.SYNC_SECRET;
  if (!s || s.length < 32) throw Object.assign(new Error("SYNC_SECRET is not configured"), { status: 503 });
  return s;
}
const mac = (label, text) => createHmac("sha256", secret()).update(label + ":" + text).digest();
const toChars = (buf, n) => Array.from(buf.subarray(0, n), b => ALPHABET[b % 32]).join("");
const check = body => toChars(mac("check", body), 4);

// Accepts what a person might type: lowercase, dashes, spaces, O for 0, I or L for 1.
export function normalize(input) {
  return String(input || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
}
export function newCode() {
  let body = "";
  for (let i = 0; i < 12; i++) body += ALPHABET[randomInt(32)];
  return body + check(body);
}
export function isValid(code) {
  if (code.length !== 16 || [...code].some(c => !ALPHABET.includes(c))) return false;
  return timingSafeEqual(Buffer.from(check(code.slice(0, 12))), Buffer.from(code.slice(12)));
}
// Where a save lives in storage. Not reversible to the code.
export const uid = code => mac("uid", code).toString("hex").slice(0, 40);
export const pretty = code => code.match(/.{4}/g).join("-");

export function familyKeyOk(given) {
  const want = (process.env.FAMILY_KEY || "").trim().toLowerCase();
  const got = String(given || "").trim().toLowerCase();
  if (want.length < 8) throw Object.assign(new Error("FAMILY_KEY is not configured"), { status: 503 });
  const a = mac("fam", want), b = mac("fam", got);
  return timingSafeEqual(a, b);
}
