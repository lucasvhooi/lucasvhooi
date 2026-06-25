// ── Essolis Cloud Functions — Tier B storage metering ───────────────────────
// Phase 1: maintain a server-authored usage counter at users/{uid}/storage/bytes.
// These triggers run with Admin privileges, so the counter they write can be
// trusted (clients will become read-only on it in a later phase). They ONLY
// adjust the counter — over-quota ENFORCEMENT (delete-back-out for model A, or
// Firestore pre-auth for model B) is intentionally not here yet, so deploying
// this can never delete a user's files.
import { setGlobalOptions } from "firebase-functions/v2";
import { onObjectFinalized, onObjectDeleted } from "firebase-functions/v2/storage";
import { onValueDeleted, onValueWritten } from "firebase-functions/v2/database";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

const BUCKET = "essolis-4ecf2.firebasestorage.app";
// Default per-account cap; keep in sync with STORAGE_LIMITS.account in
// public/assets/js/storage-quota.js. A user's plan/limitBytes overrides it.
const DEFAULT_LIMIT = 25 * 1024 * 1024; // 25 MB (test-phase cap)

// Run close to the europe-west1 Realtime Database. NOTE: a Storage-triggered
// function must be in the SAME region as the bucket. If `firebase deploy`
// fails with a region/location error, set this to your bucket's region
// (Firebase console → Storage → Files → the location shown at the top).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

initializeApp();
const db = getDatabase();

// We only meter objects under campaigns/… (maps today; cover, location and
// character images once they're migrated off base64). Uploads are DM-only, so
// the uploader is the campaign owner — meter to them. Prefer an explicit
// `ownerId` metadata tag, fall back to the maps flow's `uploadedBy`.
function ownerOf(obj) {
  return (obj.metadata && (obj.metadata.ownerId || obj.metadata.uploadedBy)) || null;
}
function isMetered(obj) {
  return typeof obj.name === "string" && obj.name.startsWith("campaigns/");
}
function adjust(uid, delta) {
  return db.ref(`users/${uid}/storage/bytes`).transaction((b) => Math.max(0, (b || 0) + delta));
}

export const onStorageUpload = onObjectFinalized(async (event) => {
  const obj = event.data;
  if (!isMetered(obj)) return;
  const uid = ownerOf(obj);
  const size = Number(obj.size || 0);
  if (!uid || !size) return;

  // Count it, then enforce (model A: optimistic + cleanup).
  const res   = await adjust(uid, size);
  const total = (res && res.snapshot && res.snapshot.val()) || 0;

  const limitSnap = await db.ref(`users/${uid}/plan/limitBytes`).get();
  const limit = Number(limitSnap.val()) || DEFAULT_LIMIT;

  if (total > limit) {
    // Over quota — delete the just-uploaded object. Its onStorageDelete fires
    // and releases the bytes from the counter, so we don't decrement here.
    try {
      await getStorage().bucket(obj.bucket || BUCKET).file(obj.name).delete();
    } catch (e) {
      console.error(`Failed to remove over-quota object ${obj.name}:`, e);
      await adjust(uid, -size); // delete failed — roll the counter back manually
    }
    // Flag the account so the UI can tell the user their upload was rejected.
    await db.ref(`users/${uid}/storage/lastRejected`).set(Date.now());
  }
});

export const onStorageDelete = onObjectDeleted(async (event) => {
  const obj = event.data;
  if (!isMetered(obj)) return;
  const uid = ownerOf(obj);
  if (uid) await adjust(uid, -Number(obj.size || 0));
});

// When a campaign is deleted from the database, cascade-delete all of its
// Storage objects (maps, cover, location & character images). Each removed
// object fires onStorageDelete above, which releases its bytes from the
// owner's counter — so no orphaned files and the meter stays accurate.
// Mirror campaign membership into the lightweight campaignCards/{cid} node so the
// campaigns list can render without downloading each campaign's full content.
// Fires on any membership change (create, join, leave, admin edit) — small data.
export const onMembersChanged = onValueWritten("/campaigns/{cid}/members", async (event) => {
  const cid   = event.params.cid;
  const after = event.data.after.exists() ? event.data.after.val() : null;
  await db.ref(`campaignCards/${cid}/members`).set(after);
});

export const onCampaignDeleted = onValueDeleted("/campaigns/{cid}", async (event) => {
  const cid = event.params.cid;
  await db.ref(`campaignCards/${cid}`).remove().catch(() => {});
  try {
    await getStorage().bucket(BUCKET).deleteFiles({ prefix: `campaigns/${cid}/` });
  } catch (e) {
    console.error(`Storage cleanup failed for campaign ${cid}:`, e);
  }
});
