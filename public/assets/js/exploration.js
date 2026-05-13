'use strict';
import { db }                              from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();

const charactersRef = ref(db, "characters");

// ── State ─────────────────────────────────────────────────────────────────────
let characters  = [];
let editingId   = null;
let searchQuery = "";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const charGrid       = document.getElementById("char-grid");
const charEmpty      = document.getElementById("char-empty");
const charSearch     = document.getElementById("char-search");
const charAddBtn     = document.getElementById("char-add-btn");
const charModal      = document.getElementById("char-modal");
const charModalTitle = document.getElementById("char-modal-title");
const charViewModal  = document.getElementById("char-view-modal");
const charViewContent = document.getElementById("char-view-content");

// Editor fields
const charPicPreview   = document.getElementById("char-pic-preview");
const charPicFile      = document.getElementById("char-pic-file");
const charUploadBtn    = document.getElementById("char-upload-btn");
const charUploadStatus = document.getElementById("char-upload-status");
const charPicture      = document.getElementById("char-picture");
const charName        = document.getElementById("char-name");
const charProfession  = document.getElementById("char-profession");
const charRace        = document.getElementById("char-race");
const charAge         = document.getElementById("char-age");
const charDescription = document.getElementById("char-description");
const charNotes       = document.getElementById("char-notes");
const charError       = document.getElementById("char-error");
const charSave        = document.getElementById("char-save");
const charCancel      = document.getElementById("char-cancel");
const charModalClose  = document.getElementById("char-modal-close");
const charViewClose   = document.getElementById("char-view-close");

// ── Firebase listener ─────────────────────────────────────────────────────────
onValue(charactersRef, snap => {
  const data = snap.val();
  characters = data ? Object.values(data) : [];
  renderGrid();
});

// ── Render ────────────────────────────────────────────────────────────────────
function renderGrid() {
  charGrid.innerHTML = "";
  const q = searchQuery.toLowerCase();

  const visible = characters.filter(c => {
    if (!isAdmin && !c.encountered) return false;
    if (q) {
      const haystack = [c.name, c.profession, c.race, c.description].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  charEmpty.style.display = visible.length === 0 ? "block" : "none";
  visible.forEach(c => charGrid.appendChild(buildCard(c)));
}

function buildCard(c) {
  const card = document.createElement("div");
  card.className = `char-card${!c.encountered ? " char-not-encountered" : ""}`;

  const picHtml = c.picture
    ? `<img class="char-card-pic" src="${esc(c.picture)}" alt="${esc(c.name)}" />`
    : `<div class="char-card-pic char-card-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`;

  card.innerHTML = `
    ${picHtml}
    <div class="char-card-body">
      <div class="char-card-name">${esc(c.name || "")}</div>
      ${c.profession ? `<div class="char-card-meta">${esc(c.profession)}</div>` : ""}
      ${(c.race || c.age) ? `<div class="char-card-sub">${[c.race ? esc(c.race) : "", c.age ? `Age ${esc(String(c.age))}` : ""].filter(Boolean).join(" · ")}</div>` : ""}
    </div>
    ${isAdmin ? `
      <div class="char-card-dm">
        <button class="char-encounter-btn${c.encountered ? " encountered" : ""}" title="${c.encountered ? "Mark not encountered" : "Mark encountered"}"><iconify-icon icon="lucide:eye"></iconify-icon></button>
        <button class="char-edit-btn" title="Edit"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
        <button class="char-del-btn" title="Delete"><iconify-icon icon="lucide:x"></iconify-icon></button>
      </div>` : ""}
  `;

  // Click card body to open detail view
  card.querySelector(".char-card-body").addEventListener("click", () => openViewModal(c));
  card.querySelector(".char-card-pic")?.addEventListener("click", () => openViewModal(c));

  if (isAdmin) {
    card.querySelector(".char-encounter-btn").addEventListener("click", e => {
      e.stopPropagation();
      set(ref(db, `characters/${c.id}/encountered`), !c.encountered);
    });
    card.querySelector(".char-edit-btn").addEventListener("click", e => {
      e.stopPropagation();
      openEditModal(c);
    });
    card.querySelector(".char-del-btn").addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`Delete "${c.name}"?`)) remove(ref(db, `characters/${c.id}`));
    });
  }

  return card;
}

// ── Detail view modal ─────────────────────────────────────────────────────────
function openViewModal(c) {
  charViewContent.innerHTML = `
    <div class="char-view-inner">
      <div class="char-view-pic-wrap">
        ${c.picture
          ? `<img class="char-view-pic" src="${esc(c.picture)}" alt="${esc(c.name)}" />`
          : `<div class="char-view-pic char-view-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
      </div>
      <div class="char-view-details">
        <h2 class="char-view-name">${esc(c.name || "")}</h2>
        <div class="char-view-tags">
          ${c.profession ? `<span class="char-view-tag">${esc(c.profession)}</span>` : ""}
          ${c.race ? `<span class="char-view-tag">${esc(c.race)}</span>` : ""}
          ${c.age ? `<span class="char-view-tag">Age ${esc(String(c.age))}</span>` : ""}
        </div>
        ${c.description ? `<p class="char-view-desc">${escBr(c.description)}</p>` : ""}
        ${isAdmin && c.notes ? `
          <div class="char-view-notes">
            <div class="char-view-notes-label"><iconify-icon icon="lucide:eye"></iconify-icon> DM Notes</div>
            <p class="char-view-notes-body">${escBr(c.notes)}</p>
          </div>` : ""}
      </div>
    </div>
  `;
  charViewModal.classList.add("open");
}

charViewClose.addEventListener("click", () => charViewModal.classList.remove("open"));
charViewModal.addEventListener("click", e => { if (e.target === charViewModal) charViewModal.classList.remove("open"); });

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEditModal(c = null) {
  editingId = c ? c.id : null;
  charModalTitle.textContent = c ? "Edit Character" : "New Character";
  charPicture.value     = c ? (c.picture     || "") : "";
  charName.value        = c ? (c.name        || "") : "";
  charProfession.value  = c ? (c.profession  || "") : "";
  charRace.value        = c ? (c.race        || "") : "";
  charAge.value         = c ? (c.age != null ? String(c.age) : "") : "";
  charDescription.value = c ? (c.description || "") : "";
  charNotes.value       = c ? (c.notes       || "") : "";
  charError.textContent = "";
  updatePicPreview();
  charModal.classList.add("open");
  charName.focus();
}

function closeEditModal() {
  charModal.classList.remove("open");
  editingId = null;
}

function updatePicPreview() {
  const url = charPicture.value.trim();
  if (url) {
    charPicPreview.innerHTML = `<img src="${esc(url)}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  } else {
    charPicPreview.innerHTML = '<iconify-icon icon="lucide:user"></iconify-icon>';
  }
}

charPicture.addEventListener("input", updatePicPreview);

// ── Image upload (canvas resize → base64, no Firebase Storage needed) ────────
function resizeToBase64(file, maxPx = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; } }
      else        { if (h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx; } }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

async function uploadImage(file) {
  charUploadStatus.textContent = "Processing…";
  charUploadStatus.className = "char-upload-status uploading";
  charPicPreview.classList.add("uploading");
  charUploadBtn.disabled = true;

  try {
    const dataUrl = await resizeToBase64(file);
    charPicture.value = dataUrl;
    updatePicPreview();
    charUploadStatus.innerHTML = 'Image ready <iconify-icon icon="lucide:check"></iconify-icon>';
    charUploadStatus.className = "char-upload-status done";
    setTimeout(() => { charUploadStatus.textContent = ""; }, 3000);
  } catch (err) {
    charUploadStatus.textContent = "Failed: " + (err.message || err);
    charUploadStatus.className = "char-upload-status error";
  } finally {
    charPicPreview.classList.remove("uploading");
    charUploadBtn.disabled = false;
  }
}

// Clicking the preview circle or the upload button triggers file picker
charPicPreview.addEventListener("click", () => charPicFile.click());
charUploadBtn.addEventListener("click", () => charPicFile.click());
charPicFile.addEventListener("change", () => {
  const file = charPicFile.files[0];
  if (file) { uploadImage(file); charPicFile.value = ""; }
});

// Drag-and-drop onto the preview circle
charPicPreview.addEventListener("dragover", e => { e.preventDefault(); charPicPreview.classList.add("drag-over"); });
charPicPreview.addEventListener("dragleave", () => charPicPreview.classList.remove("drag-over"));
charPicPreview.addEventListener("drop", e => {
  e.preventDefault();
  charPicPreview.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) uploadImage(file);
});

charModalClose.addEventListener("click", closeEditModal);
charCancel.addEventListener("click", closeEditModal);
charModal.addEventListener("click", e => { if (e.target === charModal) closeEditModal(); });

charSave.addEventListener("click", async () => {
  const name = charName.value.trim();
  if (!name) { charError.textContent = "Name is required."; return; }
  charError.textContent = "";

  const existing = editingId ? characters.find(c => c.id === editingId) : null;
  const payload = {
    id:          editingId || push(charactersRef).key,
    name,
    profession:  charProfession.value.trim() || null,
    race:        charRace.value.trim() || null,
    age:         charAge.value.trim() || null,
    description: charDescription.value.trim() || null,
    notes:       charNotes.value.trim() || null,
    picture:     charPicture.value.trim() || null,
    encountered: existing ? (existing.encountered ?? false) : false,
  };

  await set(ref(db, `characters/${payload.id}`), payload);
  closeEditModal();
});

// ── Search ────────────────────────────────────────────────────────────────────
charSearch.addEventListener("input", () => {
  searchQuery = charSearch.value.trim();
  renderGrid();
});

// ── DM: show add button ───────────────────────────────────────────────────────
if (isAdmin) {
  charAddBtn.style.display = "inline-flex";
  charAddBtn.addEventListener("click", () => openEditModal());
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    charModal.classList.remove("open");
    charViewModal.classList.remove("open");
  }
});

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escBr(str) { return esc(str).replace(/\n/g, "<br>"); }
