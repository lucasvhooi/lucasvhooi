'use strict';
// ── Tier A storage guardrails ───────────────────────────────────────────────
// A soft, per-owner storage meter. Usage is tracked as a running byte counter at
// users/{uid}/storage/bytes, maintained client-side as things are uploaded and
// removed. It is NOT tamper-proof — a determined user can desync the counter.
// The hard limits that cannot be bypassed live in storage.rules (per-file size)
// and database.rules.json (per-field length). A precisely-enforced, billable
// quota would need Cloud Functions (Tier B). See project memory.
import { db, storage } from "./firebase.js";
import { ref, get, onValue, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// Limits (bytes). Tune these to your plan — this is the "base purchase" cap.
export const STORAGE_LIMITS = {
  account: 200 * 1024 * 1024, // total per account/owner — 200 MB
  image:     5 * 1024 * 1024, // max single image    — 5 MB
  map:      20 * 1024 * 1024, // max single map file  — 20 MB (matches storage.rules)
};

export function formatBytes(n) {
  n = Number(n) || 0;
  if (n < 0) n = 0;
  if (n < 1024)               return n + " B";
  if (n < 1024 * 1024)        return (n / 1024).toFixed(0) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
  return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// Approximate the stored size of a value about to be written. For base64 data
// URLs (our in-DB images) the string length is a close proxy for stored bytes.
export function byteLength(value) {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  try { return JSON.stringify(value).length; } catch { return 0; }
}

export class QuotaError extends Error {
  constructor(message, code) { super(message); this.name = "QuotaError"; this.code = code; }
}

export async function getUsage(uid) {
  if (!uid) return 0;
  try { const s = await get(ref(db, `users/${uid}/storage/bytes`)); return s.val() || 0; }
  catch { return 0; }
}

// The account's storage cap: the user's plan/limitBytes if set, else the default.
// Mirrors the Cloud Function's DEFAULT_LIMIT.
export async function getAccountLimit(uid) {
  if (!uid) return STORAGE_LIMITS.account;
  try {
    const s = await get(ref(db, `users/${uid}/plan/limitBytes`));
    const v = Number(s.val());
    return v > 0 ? v : STORAGE_LIMITS.account;
  } catch { return STORAGE_LIMITS.account; }
}

// Live-update both the usage and the plan limit. cb receives ({ used, limit }).
export function watchStorage(uid, cb) {
  if (!uid) { cb({ used: 0, limit: STORAGE_LIMITS.account }); return () => {}; }
  let used = 0, limit = STORAGE_LIMITS.account;
  const u1 = onValue(ref(db, `users/${uid}/storage/bytes`),  s => { used  = s.val() || 0; cb({ used, limit }); });
  const u2 = onValue(ref(db, `users/${uid}/plan/limitBytes`), s => { const v = Number(s.val()); limit = v > 0 ? v : STORAGE_LIMITS.account; cb({ used, limit }); });
  return () => { u1(); u2(); };
}

// Live-update a callback whenever the owner's usage changes. Returns the unsub fn.
export function watchUsage(uid, cb) {
  if (!uid) { cb(0); return () => {}; }
  return onValue(ref(db, `users/${uid}/storage/bytes`), s => cb(s.val() || 0));
}

// Throw a QuotaError if adding `addBytes` would break the per-file cap or fill
// the account. Call this BEFORE uploading/writing.
export async function assertCanStore(uid, addBytes, perFileMax) {
  addBytes = Number(addBytes) || 0;
  if (perFileMax && addBytes > perFileMax) {
    throw new QuotaError(`That file is too large — max ${formatBytes(perFileMax)}.`, "file-too-large");
  }
  const [used, limit] = await Promise.all([getUsage(uid), getAccountLimit(uid)]);
  if (used + addBytes > limit) {
    const free = Math.max(0, limit - used);
    throw new QuotaError(
      `Your account storage is full (${formatBytes(used)} of ${formatBytes(limit)} used, ${formatBytes(free)} free).`,
      "account-full"
    );
  }
  return true;
}

// Adjust the counter by delta (positive when adding, negative when removing).
// Clamped at 0. Safe to fire-and-forget.
export async function accrueUsage(uid, deltaBytes) {
  deltaBytes = Number(deltaBytes) || 0;
  if (!uid || !deltaBytes) return;
  try {
    await runTransaction(ref(db, `users/${uid}/storage/bytes`), cur => {
      const next = (cur || 0) + deltaBytes;
      return next < 0 ? 0 : next;
    });
  } catch (e) { /* soft meter — never block the user on a counter write */ }
}

// ── Firebase Storage helpers ────────────────────────────────────────────────
// Convert a `data:` URL (e.g. canvas.toDataURL output) into a Blob for upload.
export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = String(dataUrl).split(",");
  const mime = (meta.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin  = atob(b64);
  const arr  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Upload an image Blob/File to Storage at `path`, tagged with `ownerId` so the
// metering Cloud Function attributes its bytes to the campaign owner. The server
// trigger updates users/{ownerId}/storage/bytes — do NOT call accrueUsage for
// Storage uploads. Returns { url, path, size }.
export async function uploadImageToStorage({ blob, path, ownerId }) {
  const r = sRef(storage, path);
  await uploadBytes(r, blob, {
    contentType:    blob.type || "image/jpeg",
    customMetadata: { ownerId: ownerId || "" },
  });
  const url = await getDownloadURL(r);
  return { url, path, size: blob.size };
}

// Delete a Storage object by path; the onStorageDelete trigger releases its
// bytes from the owner's counter. No-op / swallow if it's already gone.
export async function deleteStorageObject(path) {
  if (!path) return;
  try { await deleteObject(sRef(storage, path)); } catch (e) { /* already removed */ }
}

// Paint a compact usage meter into `el`. Pass the live `used` byte count.
export function renderUsageMeter(el, used) {
  if (!el) return;
  const limit = STORAGE_LIMITS.account;
  const pct   = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "#e07070" : pct >= 75 ? "#d6a44c" : "#70b890";
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
      <span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#888880">Account Storage</span>
      <span style="font-size:11px;color:${color}">${formatBytes(used)} / ${formatBytes(limit)}</span>
    </div>
    <div style="height:6px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};transition:width 0.3s,background 0.3s"></div>
    </div>`;
}
