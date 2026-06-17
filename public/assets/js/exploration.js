'use strict';
import { db } from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const _session = (() => { try { return JSON.parse(localStorage.getItem('playerSession')); } catch { return null; } })();
const isAdmin = _session?.role === 'admin';
const cid = _session?.campaignId;
if (!cid) { window.location.href = '/campaigns'; throw new Error('No campaign selected'); }

const charactersRef = ref(db, `campaigns/${cid}/characters`);

// ── State ─────────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  villain: { icon: 'lucide:skull',      color: '#c04040', label: 'Villain' },
  ally:    { icon: 'lucide:handshake',  color: '#40a070', label: 'Ally'    },
  deity:   { icon: 'lucide:sun',        color: '#c8a440', label: 'Deity'   },
  npc:     { icon: 'lucide:user-round', color: '#5080b0', label: 'NPC'     },
  creature:{ icon: 'lucide:paw-print', color: '#a06030', label: 'Creature'},
};

let characters  = [];
let editingId   = null;
let searchQuery = "";
let sortField   = null;
let sortDir     = 'asc';
let filterRace  = "";
let filterRole  = "";
let selectedRole = "";
let currentPage = 1;
const CHARS_PER_PAGE = 30;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const charsGrid       = document.getElementById("chars-grid");
const charsPagination = document.getElementById("chars-pagination");
const charsSearch     = document.getElementById("chars-search");
const charAddBtn      = document.getElementById("char-add-btn");
const charCount       = document.getElementById("char-count");
const raceFilterEl    = document.getElementById("race-filter");
const charsContent    = document.querySelector(".chars-content");
const charDetailPanel   = document.getElementById("char-detail-panel");
const cdpTitle          = document.getElementById("cdp-title");
const cdpHeroImg        = document.getElementById("cdp-hero-img");
const cdpHeroPlaceholder = document.getElementById("cdp-hero-placeholder");
const cdpMeta           = document.getElementById("cdp-meta");
const cdpDescription    = document.getElementById("cdp-description");
const cdpNotes          = document.getElementById("cdp-notes");
const cdpActions        = document.getElementById("cdp-actions");
let   _activeCharRow  = null;

const charModal       = document.getElementById("char-modal");
const charModalTitle  = document.getElementById("char-modal-title");
const charPicPreview  = document.getElementById("char-pic-preview");
const charPicFile     = document.getElementById("char-pic-file");
const charUploadBtn   = document.getElementById("char-upload-btn");
const charUploadStatus = document.getElementById("char-upload-status");
const charPicture     = document.getElementById("char-picture");
const charName        = document.getElementById("char-name");
const charProfession  = document.getElementById("char-profession");
const charRace        = document.getElementById("char-race");
const charAge         = document.getElementById("char-age");
const charDescription = document.getElementById("char-description");
const charNotes       = document.getElementById("char-notes");
const charEncountered = document.getElementById("char-encountered");
const charError       = document.getElementById("char-error");
const charSave        = document.getElementById("char-save");
const charCancel      = document.getElementById("char-cancel");
const charModalClose  = document.getElementById("char-modal-close");

// ── Stat bar / role filter ────────────────────────────────────────────────────
document.querySelectorAll(".chars-stat-card").forEach(card => {
  card.addEventListener("click", () => {
    filterRole = card.dataset.role;
    currentPage = 1;
    _updateStatUI();
    renderChars();
  });
});

function _updateStatUI() {
  document.querySelectorAll(".chars-stat-card").forEach(card => {
    card.classList.toggle("active", card.dataset.role === filterRole);
  });
}

function updateStatCounts() {
  const all = isAdmin ? characters : characters.filter(c => c.encountered);
  document.getElementById("stat-total").textContent   = all.length;
  document.getElementById("stat-villains").textContent = all.filter(c => c.role === "villain").length;
  document.getElementById("stat-allies").textContent   = all.filter(c => c.role === "ally").length;
  document.getElementById("stat-deities").textContent  = all.filter(c => c.role === "deity").length;
  document.getElementById("stat-npcs").textContent      = all.filter(c => c.role === "npc").length;
  document.getElementById("stat-creatures").textContent = all.filter(c => c.role === "creature").length;
}

// ── Role selector (modal) ─────────────────────────────────────────────────────
document.querySelectorAll(".role-sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedRole = btn.dataset.role;
    _syncRoleButtons();
  });
});

function _syncRoleButtons() {
  document.querySelectorAll(".role-sel-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.role === selectedRole);
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────
if (isAdmin) {
  charAddBtn.style.display = "inline-flex";
  charAddBtn.addEventListener("click", () => openEditModal());
}

// ── Sort controls ─────────────────────────────────────────────────────────────
document.querySelectorAll(".sort-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    if (sortField === field) {
      if (sortDir === 'asc') { sortDir = 'desc'; }
      else { sortField = null; sortDir = 'asc'; }
    } else {
      sortField = field;
      sortDir = 'asc';
    }
    currentPage = 1;
    _updateSortUI();
    renderChars();
  });
});

function _updateSortUI() {
  document.querySelectorAll(".sort-btn").forEach(btn => {
    const field = btn.dataset.sort;
    const icon  = btn.querySelector("iconify-icon");
    btn.classList.toggle("active", sortField === field);
    if (icon) {
      icon.setAttribute("icon", sortField === field
        ? (sortDir === 'asc' ? "lucide:chevron-up" : "lucide:chevron-down")
        : "lucide:chevrons-up-down");
    }
  });
}

// ── Race filter ───────────────────────────────────────────────────────────────
if (raceFilterEl) {
  raceFilterEl.addEventListener("change", () => {
    filterRace = raceFilterEl.value;
    currentPage = 1;
    renderChars();
  });
}

function updateRaceFilter() {
  if (!raceFilterEl) return;
  const races = [...new Set(characters.map(c => c.race).filter(Boolean))].sort();
  const current = raceFilterEl.value;
  raceFilterEl.innerHTML = '<option value="">All</option>' +
    races.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  if (races.includes(current)) raceFilterEl.value = current;
}

// ── Firebase listener ─────────────────────────────────────────────────────────
onValue(charactersRef, snap => {
  const data = snap.val();
  characters = data ? Object.values(data) : [];
  updateRaceFilter();
  updateStatCounts();
  renderChars();
});

// ── Render ────────────────────────────────────────────────────────────────────
function renderChars() {
  charsGrid.innerHTML = "";

  let filtered = [...characters];

  if (!isAdmin) {
    filtered = filtered.filter(c => c.encountered);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      [c.name, c.profession, c.race, c.description].join(" ").toLowerCase().includes(q)
    );
  }

  if (filterRace) {
    filtered = filtered.filter(c => c.race === filterRace);
  }

  if (filterRole) {
    filtered = filtered.filter(c => c.role === filterRole);
  }

  if (sortField === 'name') {
    filtered.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  } else if (sortField === 'profession') {
    filtered.sort((a, b) => {
      const ap = a.profession || '', bp = b.profession || '';
      return sortDir === 'asc' ? ap.localeCompare(bp) : bp.localeCompare(ap);
    });
  } else if (sortField === 'race') {
    filtered.sort((a, b) => {
      const ar = a.race || '', br = b.race || '';
      return sortDir === 'asc' ? ar.localeCompare(br) : br.localeCompare(ar);
    });
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (charCount) {
    charCount.textContent = filtered.length === characters.length
      ? `${filtered.length} character${filtered.length !== 1 ? 's' : ''}`
      : `${filtered.length} of ${characters.length}`;
  }

  if (filtered.length === 0) {
    charsGrid.innerHTML = `<p class="chars-empty">${characters.length === 0 ? "No characters added yet." : "No characters match your search."}</p>`;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(filtered.length / CHARS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const pageChars = filtered.slice((currentPage - 1) * CHARS_PER_PAGE, currentPage * CHARS_PER_PAGE);

  pageChars.forEach(c => {
    const row = document.createElement("div");
    row.className = "char-row" + (!c.encountered ? " char-not-encountered" : "");

    const picHtml = c.picture
      ? `<img class="char-row-avatar" src="${esc(c.picture)}" alt="${esc(c.name)}" />`
      : `<div class="char-row-avatar char-row-avatar-ph"><iconify-icon icon="lucide:user" style="font-size:15px"></iconify-icon></div>`;

    const roleCfg = c.role ? ROLE_CONFIG[c.role] : null;
    const roleBadgeHtml = roleCfg
      ? `<span class="char-row-role-badge" style="--rc:${roleCfg.color}"><iconify-icon icon="${roleCfg.icon}" style="font-size:9px;vertical-align:-1px"></iconify-icon> ${roleCfg.label}</span>`
      : '';

    row.innerHTML = `
      <div class="char-row-main">
        <div class="char-row-name-wrap">
          ${picHtml}
          <div class="char-row-name-block">
            <div class="char-row-name">${esc(c.name || "")}</div>
            ${c.race ? `<div class="char-row-subrace">${esc(c.race)}</div>` : ''}
            ${roleBadgeHtml}
          </div>
        </div>
      </div>
      <div class="char-row-profession">${c.profession ? esc(c.profession) : '<span class="char-row-empty">—</span>'}</div>
      <div class="char-row-race">${c.race ? esc(c.race) : '<span class="char-row-empty">—</span>'}</div>
      <div class="char-row-age">${c.age ? esc(String(c.age)) : '<span class="char-row-empty">—</span>'}</div>
      <div class="char-row-actions">
        ${isAdmin ? `
          <button class="row-action-btn char-encounter-btn${c.encountered ? ' encountered' : ''}" title="${c.encountered ? 'Mark not encountered' : 'Mark encountered'}">
            <iconify-icon icon="${c.encountered ? 'lucide:eye' : 'lucide:eye-off'}"></iconify-icon>
          </button>
          <button class="row-action-btn char-edit-btn" title="Edit"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
          <button class="row-action-btn danger char-del-btn" title="Delete"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>
        ` : ''}
      </div>
    `;

    row.addEventListener("click", e => {
      if (row._swiped) return;
      if (e.target.closest(".char-row-actions")) return;
      openCharPanel(c, row);
    });

    // Swipe-to-delete wrapper (admin only; the red layer is revealed as the row slides left)
    const swipe = document.createElement("div");
    swipe.className = "char-swipe";

    if (isAdmin) {
      row.querySelector(".char-encounter-btn").addEventListener("click", e => {
        e.stopPropagation();
        set(ref(db, `campaigns/${cid}/characters/${c.id}/encountered`), !c.encountered);
      });
      row.querySelector(".char-edit-btn").addEventListener("click", e => {
        e.stopPropagation();
        openEditModal(c);
      });
      row.querySelector(".char-del-btn").addEventListener("click", e => {
        e.stopPropagation();
        if (confirm(`Delete "${c.name}"?`)) {
          remove(ref(db, `campaigns/${cid}/characters/${c.id}`));
          if (_activeCharRow === row) closeCharPanel();
        }
      });

      const delLayer = document.createElement("div");
      delLayer.className = "char-swipe-delete";
      delLayer.innerHTML = '<iconify-icon icon="lucide:trash-2"></iconify-icon>';
      swipe.appendChild(delLayer);
      attachSwipeToDelete(swipe, row, c);
    }

    swipe.appendChild(row);
    charsGrid.appendChild(swipe);
  });

  renderPagination(totalPages);
}

// ── Swipe-to-delete (mobile, Spotify-style) ────────────────────────────────────
// Drag a card left past the threshold to delete it; a short drag snaps back.
// Touch-only, so desktop pointer interaction is unaffected.
function attachSwipeToDelete(swipe, row, c) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;

  row.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dragging = true; decided = false; horizontal = false;
    row.style.transition = "none";
  }, { passive: true });

  row.addEventListener("touchmove", e => {
    if (!dragging) return;
    const ddx = e.touches[0].clientX - startX;
    const ddy = e.touches[0].clientY - startY;
    if (!decided && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      decided = true;
      horizontal = Math.abs(ddx) > Math.abs(ddy);
    }
    if (!horizontal) return;        // vertical gesture → let the page scroll
    e.preventDefault();             // we own the horizontal gesture
    dx = Math.max(-row.offsetWidth, Math.min(0, ddx));
    row.style.transform = `translateX(${dx}px)`;
  }, { passive: false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    row.style.transition = "";
    const threshold = Math.min(120, row.offsetWidth * 0.4);
    if (dx < -threshold) {
      row.style.transform = "translateX(-100%)";
      row.style.opacity = "0";
      row._swiped = true;
      setTimeout(() => {
        remove(ref(db, `campaigns/${cid}/characters/${c.id}`));
        if (_activeCharRow === row) closeCharPanel();
      }, 180);
    } else {
      row.style.transform = "";
      if (Math.abs(dx) > 8) { row._swiped = true; setTimeout(() => { row._swiped = false; }, 60); }
    }
  };
  row.addEventListener("touchend", finish);
  row.addEventListener("touchcancel", finish);
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(totalPages) {
  if (!charsPagination) return;
  if (totalPages <= 1) { charsPagination.innerHTML = ''; return; }

  const range = _getPageRange(currentPage, totalPages);
  charsPagination.innerHTML = `
    <button class="page-nav-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
      <iconify-icon icon="lucide:chevron-left"></iconify-icon>
    </button>
    ${range.map(p => p === '…'
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-nav-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      <iconify-icon icon="lucide:chevron-right"></iconify-icon>
    </button>
  `;

  charsPagination.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p >= 1 && p <= totalPages) { currentPage = p; renderChars(); }
    });
  });
}

function _getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const lo = Math.max(2, current - 2);
  const hi = Math.min(total - 1, current + 2);
  if (lo > 2) pages.push('…');
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function openCharPanel(c, rowEl) {
  if (_activeCharRow) _activeCharRow.classList.remove('active');
  _activeCharRow = rowEl;
  rowEl.classList.add('active');

  cdpTitle.textContent = c.name || "";

  if (c.picture) {
    cdpHeroImg.src = esc(c.picture);
    cdpHeroImg.alt = esc(c.name);
    cdpHeroImg.style.display = "";
    cdpHeroPlaceholder.style.display = "none";
  } else {
    cdpHeroImg.style.display = "none";
    cdpHeroImg.src = "";
    cdpHeroPlaceholder.style.display = "";
  }

  const panelRoleCfg = c.role ? ROLE_CONFIG[c.role] : null;
  cdpMeta.innerHTML = [
    panelRoleCfg ? `<span class="cdp-badge cdp-badge-role" style="--rc:${panelRoleCfg.color}"><iconify-icon icon="${panelRoleCfg.icon}" style="font-size:10px;vertical-align:-1px;margin-right:3px"></iconify-icon>${panelRoleCfg.label}</span>` : '',
    c.profession ? `<span class="cdp-badge"><iconify-icon icon="lucide:briefcase" style="font-size:10px;vertical-align:-1px;margin-right:3px"></iconify-icon>${esc(c.profession)}</span>` : '',
    c.race       ? `<span class="cdp-badge"><iconify-icon icon="lucide:dna" style="font-size:10px;vertical-align:-1px;margin-right:3px"></iconify-icon>${esc(c.race)}</span>` : '',
    c.age        ? `<span class="cdp-badge"><iconify-icon icon="lucide:hourglass" style="font-size:10px;vertical-align:-1px;margin-right:3px"></iconify-icon>Age ${esc(String(c.age))}</span>` : '',
    !c.encountered ? '<span class="cdp-badge cdp-badge-unenc">Not Encountered</span>' : '',
  ].join('');

  cdpDescription.innerHTML = c.description
    ? `<p class="cdp-section-label">Description</p><div class="cdp-desc-text">${escBr(c.description)}</div>`
    : '';

  cdpNotes.innerHTML = (isAdmin && c.notes)
    ? `<p class="cdp-section-label" style="margin-top:14px"><iconify-icon icon="lucide:eye" style="font-size:11px;vertical-align:-1px;margin-right:4px"></iconify-icon>DM Notes</p><div class="cdp-desc-text cdp-notes-text">${escBr(c.notes)}</div>`
    : '';

  cdpActions.innerHTML = isAdmin ? `
    <div class="cdp-action-row">
      <button class="dm-btn dm-btn-sm cdp-edit-btn">
        <iconify-icon icon="lucide:pencil" style="font-size:12px;vertical-align:-1px;margin-right:4px"></iconify-icon>Edit
      </button>
    </div>
  ` : '';

  if (isAdmin) {
    const editBtn = cdpActions.querySelector('.cdp-edit-btn');
    if (editBtn) editBtn.addEventListener('click', () => openEditModal(c));
  }

  charDetailPanel.classList.add('open');
  charsContent?.classList.add('panel-open');

  const body = charDetailPanel.querySelector('.cdp-body');
  if (body) body.scrollTop = 0;
}

function closeCharPanel() {
  if (_activeCharRow) { _activeCharRow.classList.remove('active'); _activeCharRow = null; }
  charDetailPanel.classList.remove('open');
  charsContent?.classList.remove('panel-open');
}

document.getElementById("cdp-close").addEventListener("click", closeCharPanel);
// On mobile the panel is a centered modal — clicking the backdrop closes it
charDetailPanel.addEventListener("click", e => { if (e.target === charDetailPanel) closeCharPanel(); });

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEditModal(c = null) {
  editingId             = c ? c.id : null;
  charModalTitle.textContent = c ? "Edit Character" : "New Character";
  charPicture.value     = c ? (c.picture     || "") : "";
  charName.value        = c ? (c.name        || "") : "";
  charProfession.value  = c ? (c.profession  || "") : "";
  charRace.value        = c ? (c.race        || "") : "";
  charAge.value         = c ? (c.age != null ? String(c.age) : "") : "";
  charDescription.value = c ? (c.description || "") : "";
  charNotes.value       = c ? (c.notes       || "") : "";
  charEncountered.checked = c ? (c.encountered ?? false) : false;
  selectedRole = c ? (c.role || "") : "";
  _syncRoleButtons();
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
  charPicPreview.innerHTML = url
    ? `<img src="${esc(url)}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : '<iconify-icon icon="lucide:user"></iconify-icon>';
}

charPicture.addEventListener("input", updatePicPreview);

// ── Image upload ──────────────────────────────────────────────────────────────
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
    charUploadStatus.innerHTML = 'Ready <iconify-icon icon="lucide:check"></iconify-icon>';
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

charPicPreview.addEventListener("click", () => charPicFile.click());
charUploadBtn.addEventListener("click", () => charPicFile.click());
charPicFile.addEventListener("change", () => {
  const file = charPicFile.files[0];
  if (file) { uploadImage(file); charPicFile.value = ""; }
});
charPicPreview.addEventListener("dragover", e => { e.preventDefault(); charPicPreview.classList.add("drag-over"); });
charPicPreview.addEventListener("dragleave", () => charPicPreview.classList.remove("drag-over"));
charPicPreview.addEventListener("drop", e => {
  e.preventDefault();
  charPicPreview.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) uploadImage(file);
});

// ── Modal controls ────────────────────────────────────────────────────────────
charModalClose.addEventListener("click", closeEditModal);
charCancel.addEventListener("click", closeEditModal);
charModal.addEventListener("click", e => { if (e.target === charModal) closeEditModal(); });

charSave.addEventListener("click", async () => {
  const name = charName.value.trim();
  if (!name) { charError.textContent = "Name is required."; return; }
  charError.textContent = "";

  const id = editingId || push(charactersRef).key;
  const payload = {
    id,
    name,
    profession:  charProfession.value.trim() || null,
    race:        charRace.value.trim()       || null,
    age:         charAge.value.trim()        || null,
    description: charDescription.value.trim() || null,
    notes:       charNotes.value.trim()      || null,
    picture:     charPicture.value.trim()    || null,
    encountered: charEncountered.checked,
    role:        selectedRole                || null,
  };

  await set(ref(db, `campaigns/${cid}/characters/${id}`), payload);
  closeEditModal();
});

// ── Search ────────────────────────────────────────────────────────────────────
charsSearch.addEventListener("input", () => {
  searchQuery = charsSearch.value.trim();
  currentPage = 1;
  renderChars();
});

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (charModal.classList.contains("open")) closeEditModal();
    else if (charDetailPanel.classList.contains("open")) closeCharPanel();
  }
});

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escBr(str) { return esc(str).replace(/\n/g, "<br>"); }
