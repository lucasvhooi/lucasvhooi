import { db }                          from "./firebase.js";
import { ref, set, remove, onValue }  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { NPC_NAMES, AGE_RANGES, DEFAULT_PROFESSIONS, RACE_PROFESSIONS, RACE_BASE_WEIGHTS, ELF_SUBTYPE_WEIGHTS, NPC_TRAITS } from "./npc-data.js";
import { parseTags, formatGold, getDisplayTags } from "./item-utils.js";
import { openGivePanel } from "./give-to-player.js";

// ── Setup ─────────────────────────────────────────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const locationId = params.get("id");
const _session = (() => { try { return JSON.parse(localStorage.getItem('playerSession')); } catch { return null; } })();
const isAdmin = _session?.role === 'admin';
const cid = _session?.campaignId;
if (!cid) { window.location.href = '/campaigns'; throw new Error('No campaign selected'); }

if (!locationId) {
  document.getElementById("loc-title").textContent = "Location not found";
}

// Remember this location so the Map tab can return here.
// If we just got here via a map redirect, don't re-set the flag (breaks the loop).
const _wasMapRedirected = sessionStorage.getItem("mapRedirected");
if (_wasMapRedirected) {
  sessionStorage.removeItem("mapRedirected");
} else if (locationId) {
  sessionStorage.setItem("lastLocationId", locationId);
}

// "Back to Map" clears the saved location so map.html shows the actual map
document.getElementById("back-to-map")?.addEventListener("click", () => {
  sessionStorage.removeItem("lastLocationId");
});

if (!isAdmin) document.body.classList.add("player-view");

// Firebase refs
const markerDbRef     = ref(db, `campaigns/${cid}/markers/${locationId}`);
const infoRef         = ref(db, `campaigns/${cid}/locations/${locationId}/info`);
const subMarkersRef   = ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers`);
const npcsRef         = ref(db, `campaigns/${cid}/locations/${locationId}/npcs`);

// ── State ─────────────────────────────────────────────────────────────────────
let markerData          = null;
let locationInfo        = {};
let subMarkers          = [];
let npcs                = [];
let placingMode         = false;
let pendingCoords       = null;
let editingSubId        = null;
let editingNpcId        = null;
let isDraggingBuilding  = false;
let dragSrcId           = null;
let isDayTime           = true;
let currentTavernMarker = null;

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const locTitle        = document.getElementById("loc-title");
const locStats        = document.getElementById("loc-stats");
const locMapContainer = document.getElementById("loc-map-container");
const locMapImg       = document.getElementById("loc-map-img");
const locMapPlaceholder = document.getElementById("loc-map-placeholder");
const locMarkerLayer  = document.getElementById("loc-marker-layer");
const locDescText     = document.getElementById("loc-desc-text");
const locDescEmpty    = document.getElementById("loc-desc-empty");
const locNpcList      = document.getElementById("loc-npc-list");
const locPlacingBanner = document.getElementById("loc-placing-banner");

// ── Firebase Listeners ────────────────────────────────────────────────────────
onValue(markerDbRef, snapshot => {
  markerData = snapshot.val();
  if (markerData) renderHero();
  else locTitle.textContent = "Unknown Location";
});

onValue(infoRef, snapshot => {
  locationInfo = snapshot.val() || {};
  renderDescription();
  renderMapImage();
  renderFeatureImage();
});

onValue(subMarkersRef, snapshot => {
  const data = snapshot.val();
  subMarkers = data ? Object.values(data) : [];
  renderSubMarkers();
  if (isAdmin && !isDraggingBuilding) renderBuildings();
});

onValue(npcsRef, snapshot => {
  const data = snapshot.val();
  npcs = data ? Object.values(data) : [];
  renderNpcs();
});

// Global items (for shop modal)
let globalItems = [];
onValue(ref(db, `campaigns/${cid}/items`), snapshot => {
  const data = snapshot.val();
  globalItems = data ? Object.values(data) : [];
});

// Global lore (for library modal)
let loreItems = [];
onValue(ref(db, `campaigns/${cid}/lore`), snapshot => {
  const data = snapshot.val();
  loreItems = data ? Object.values(data) : [];
});

// ── Render Hero ───────────────────────────────────────────────────────────────
function renderHero() {
  document.title = `${markerData.name} — DnD Campaign`;
  locTitle.textContent = markerData.name;

  const parts = [];
  if (markerData.type)       parts.push(`<span class="stat-badge">${markerData.type}</span>`);
  if (markerData.population) parts.push(`<span class="stat-badge"><iconify-icon icon="lucide:users"></iconify-icon> ${markerData.population}</span>`);
  if (markerData.wealth)     parts.push(`<span class="stat-badge"><iconify-icon icon="game-icons:coins"></iconify-icon> ${markerData.wealth}</span>`);
  if (markerData.mainRace)   parts.push(`<span class="stat-badge"><iconify-icon icon="lucide:building-2"></iconify-icon> ${markerData.mainRace}</span>`);
  if (markerData.religion)   parts.push(`<span class="stat-badge"><iconify-icon icon="lucide:sun"></iconify-icon> ${markerData.religion}</span>`);
  if (isAdmin) {
    const explored = markerData.explored === true;
    parts.push(`<span class="stat-badge ${explored ? "explored-badge" : "unexplored-badge"}">${explored ? "Explored" : "Unexplored"}</span>`);
  }
  locStats.innerHTML = parts.join("");
}

// ── Render Description ────────────────────────────────────────────────────────
function renderDescription() {
  const desc = locationInfo.description;
  if (desc) {
    locDescText.textContent = desc;
    locDescText.style.display = "block";
    locDescEmpty.style.display = "none";
  } else {
    locDescText.style.display = "none";
    locDescEmpty.style.display = "block";
  }
}

// ── Render Feature Image (location banner) ────────────────────────────────────
const locFeatureImg   = document.getElementById("loc-feature-img");
const locFeatureImgPh = document.getElementById("loc-feature-img-ph");

function renderFeatureImage() {
  const url = locationInfo.featureImageUrl;
  if (url) {
    locFeatureImg.src = url;
    locFeatureImg.style.display = "block";
    locFeatureImgPh.style.display = "none";
  } else {
    locFeatureImg.style.display = "none";
    locFeatureImgPh.style.display = "flex";
  }
}

// ── Render Map Image ──────────────────────────────────────────────────────────
function renderMapImage() {
  const url = locationInfo.mapImageUrl;
  if (url) {
    locMapImg.src = url;
    locMapImg.style.display = "block";
    locMapPlaceholder.style.display = "none";
  } else {
    locMapImg.style.display = "none";
    locMapPlaceholder.style.display = "flex";
  }
}

// ── Sub-markers ───────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Forge:   "#FF7043",
  Shop:    "#66BB6A",
  Tavern:  "#FFA726",
  House:   "#78909C",
  Temple:  "#CE93D8",
  Guard:   "#42A5F5",
  Market:  "#FFEE58",
  Library: "#A1887F",
  Other:   "#BDBDBD"
};

function markerDisplayType(marker) {
  return (marker.type === "Other" && marker.customType)
    ? marker.customType
    : (marker.type || "Other");
}

function renderSubMarkers() {
  locMarkerLayer.innerHTML = "";

  subMarkers.forEach(marker => {
    // Players only see markers the DM has marked as discovered
    if (!isAdmin && !marker.discovered) return;

    const el = document.createElement("div");
    el.className    = "loc-marker";
    el.dataset.id   = marker.id;
    el.style.left   = marker.x + "%";
    el.style.top    = marker.y + "%";
    el.addEventListener("pointerdown", e => e.stopPropagation());

    const pin = document.createElement("div");
    pin.className  = "loc-marker-pin";
    pin.style.background = TYPE_COLORS[marker.type] || "#BDBDBD";

    const ownerNpc = marker.ownerId ? npcs.find(n => n.id === marker.ownerId) : null;

    const tooltip = document.createElement("div");
    tooltip.className = "loc-marker-tooltip";
    tooltip.innerHTML = `
      ${marker.picture ? `<img class="tooltip-img" src="${marker.picture}" alt="${marker.name}" />` : ""}
      <div class="tooltip-name">${marker.name}</div>
      <div class="tooltip-type">${markerDisplayType(marker)}${marker.shopSubtype ? ` · ${marker.shopSubtype}` : ""}</div>
      ${ownerNpc ? `<div class="tooltip-owner"><iconify-icon icon="lucide:user"></iconify-icon> ${ownerNpc.name}</div>` : ""}
      ${isAdmin ? `<button class="tooltip-view-btn">View</button>` : ""}
    `;
    if (isAdmin) {
      tooltip.querySelector(".tooltip-view-btn").addEventListener("click", e => {
        e.stopPropagation();
        openShopModal(marker);
      });
    }

    el.appendChild(pin);
    el.appendChild(tooltip);

    if (isAdmin) {
      const controls = document.createElement("div");
      controls.className = "loc-marker-controls";

      const editBtn = document.createElement("button");
      editBtn.className   = "marker-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", e => { e.stopPropagation(); openSubMarkerModal(marker.id); });

      const delBtn = document.createElement("button");
      delBtn.className   = "marker-delete-btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm(`Delete "${marker.name}"? This cannot be undone.`)) return;
        remove(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${marker.id}`));
      });

      controls.appendChild(editBtn);
      controls.appendChild(delBtn);
      el.appendChild(controls);
    }

    // Tap to toggle tooltip on mobile; also sync building card highlight
    el.addEventListener("click", () => {
      const isActive = el.classList.contains("active");
      locMarkerLayer.querySelectorAll(".loc-marker.active").forEach(m => m.classList.remove("active"));
      highlightBuildingCard(isActive ? null : marker.id);
      if (!isActive) el.classList.add("active");
    });

    locMarkerLayer.appendChild(el);
  });
}

// Dismiss sub-marker tooltip when clicking outside
document.addEventListener("click", e => {
  if (!e.target.closest(".loc-marker") && !e.target.closest(".building-card")) {
    locMarkerLayer.querySelectorAll(".loc-marker.active").forEach(m => m.classList.remove("active"));
    highlightBuildingCard(null);
  }
});

// ── Sub-marker Placing ────────────────────────────────────────────────────────
const locBtnPlace = document.getElementById("loc-btn-place");

if (locBtnPlace) {
  locBtnPlace.addEventListener("pointerdown", e => e.stopPropagation());
  locBtnPlace.addEventListener("click", () => {
    placingMode = !placingMode;
    locBtnPlace.textContent = placingMode ? "Cancel Placing" : "Place Marker";
    locBtnPlace.classList.toggle("active", placingMode);
    locMapContainer.classList.toggle("placing-mode", placingMode);
    locPlacingBanner.classList.toggle("visible", placingMode);
  });
}

// Click on location map to place a sub-marker
locMapContainer.addEventListener("click", e => {
  if (!placingMode || !isAdmin) return;
  if (e.target.closest(".loc-marker") || e.target.closest(".loc-dm-toolbar")) return;

  const rect = locMapContainer.getBoundingClientRect();
  pendingCoords = {
    x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100)),
    y: Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100))
  };
  openSubMarkerModal(null);
});

// Touch tap to place
locMapContainer.addEventListener("touchend", e => {
  if (!placingMode || !isAdmin) return;
  if (e.changedTouches.length !== 1) return;
  const touch = e.changedTouches[0];
  const rect  = locMapContainer.getBoundingClientRect();
  const dx = Math.abs(touch.clientX - rect.left);
  if (dx > rect.width) return; // outside
  pendingCoords = {
    x: Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width)  * 100)),
    y: Math.max(0, Math.min(100, ((touch.clientY - rect.top)  / rect.height) * 100))
  };
  openSubMarkerModal(null);
});

// ── Sub-marker Modal ──────────────────────────────────────────────────────────
const locMarkerModal   = document.getElementById("loc-marker-modal");
const lmTitle          = document.getElementById("lm-title");
const lmName           = document.getElementById("lm-name");
const lmType           = document.getElementById("lm-type");
const lmCustomTypeRow  = document.getElementById("lm-custom-type-row");
const lmCustomType     = document.getElementById("lm-custom-type");
const lmSubtypeRow     = document.getElementById("lm-subtype-row");
const lmSubtype        = document.getElementById("lm-subtype");
const lmInvTagsRow     = document.getElementById("lm-inv-tags-row");
const lmInvTags        = document.getElementById("lm-inv-tags");
const lmInvTagBtns     = document.getElementById("lm-inv-tag-btns");
const lmTavernSection  = document.getElementById("lm-tavern-section");
const lmTavernTables   = document.getElementById("lm-tavern-tables");
const lmRoomCount      = document.getElementById("lm-room-count");
const lmTavernWealthBtns = document.getElementById("lm-tavern-wealth-btns");
const lmServantsList   = document.getElementById("lm-servants-list");
let selectedTavernWealth = "Middle Class";
const lmOwner          = document.getElementById("lm-owner");
const lmNotes          = document.getElementById("lm-notes");
const lmPicture        = document.getElementById("lm-picture");
const lmUploadBtn      = document.getElementById("lm-upload-btn");
const lmPicFile        = document.getElementById("lm-pic-file");
const lmUploadStatus   = document.getElementById("lm-upload-status");
const lmError          = document.getElementById("lm-error");
const lmSave           = document.getElementById("lm-save");
const lmCancel         = document.getElementById("lm-cancel");

function getAllInventoryTags() {
  const tagSet = new Set();
  globalItems.forEach(item => getDisplayTags(item.tags).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

function renderInvTagButtons() {
  const selected = new Set(parseTags(lmInvTags.value));
  lmInvTagBtns.innerHTML = "";
  getAllInventoryTags().forEach(tag => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "inv-tag-btn" + (selected.has(tag) ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      const cur = new Set(parseTags(lmInvTags.value));
      if (cur.has(tag)) { cur.delete(tag); } else { cur.add(tag); }
      lmInvTags.value = [...cur].join(", ");
      renderInvTagButtons();
    });
    lmInvTagBtns.appendChild(btn);
  });
}

function updateMarkerTypeFields() {
  const t = lmType.value;
  lmCustomTypeRow.style.display  = (t === "Other")  ? "" : "none";
  lmSubtypeRow.style.display     = (t === "Shop" || t === "Market") ? "" : "none";
  lmTavernSection.style.display  = (t === "Tavern") ? "" : "none";
  lmInvTagsRow.style.display     = (t !== "House" && t !== "Tavern") ? "" : "none";
  if (t === "Tavern") populateServantsSection();
  renderInvTagButtons();
}

function syncTavernWealthBtns() {
  lmTavernWealthBtns.querySelectorAll(".wealth-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wealth === selectedTavernWealth);
  });
}

lmTavernWealthBtns.querySelectorAll(".wealth-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedTavernWealth = btn.dataset.wealth;
    syncTavernWealthBtns();
  });
});

function populateServantsSection(existingServants = []) {
  const servantSet = new Set(existingServants);
  lmServantsList.innerHTML = "";
  if (npcs.length === 0) {
    lmServantsList.innerHTML = '<p class="empty-hint" style="margin:4px 0;font-size:12px">No NPCs in this location yet.</p>';
    return;
  }
  const sorted = [...npcs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  sorted.forEach((npc, i) => {
    const item = document.createElement("label");
    item.className = "servant-item";
    item.innerHTML = `
      <input type="checkbox" class="servant-checkbox" value="${npc.id}" ${servantSet.has(npc.id) ? "checked" : ""} />
      <span>#${String(i + 1).padStart(3, "0")} ${npc.name}${npc.role ? ` — ${npc.role}` : ""}</span>
    `;
    lmServantsList.appendChild(item);
  });
}

function getSelectedServants() {
  return [...lmServantsList.querySelectorAll(".servant-checkbox:checked")].map(cb => cb.value);
}

function populateOwnerSelect(selectedId) {
  lmOwner.innerHTML = `<option value="">— None —</option>`;
  const sorted = [...npcs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  sorted.forEach((npc, i) => {
    const opt = document.createElement("option");
    opt.value = npc.id;
    opt.textContent = `#${String(i + 1).padStart(3, "0")} ${npc.name}${npc.role ? ` — ${npc.role}` : ""}`;
    if (npc.id === selectedId) opt.selected = true;
    lmOwner.appendChild(opt);
  });
}

function openSubMarkerModal(id) {
  editingSubId = id;
  lmError.textContent = "";
  const m = id ? subMarkers.find(s => s.id === id) : null;

  if (m) {
    lmTitle.textContent  = "Edit Marker";
    lmName.value         = m.name          || "";
    lmType.value         = m.type          || "Forge";
    lmCustomType.value   = m.customType    || "";
    lmSubtype.value      = m.shopSubtype   || "";
    lmInvTags.value      = m.inventoryTags || "";
    lmNotes.value        = m.notes         || "";
    lmPicture.value      = m.picture       || "";
    selectedTavernWealth = m.tavernWealth  || "Middle Class";
    lmTavernTables.value = m.tavernTables  || 6;
    lmRoomCount.value    = m.roomCount     ?? 4;
    populateOwnerSelect(m.ownerId || "");
  } else {
    lmTitle.textContent  = "Place Marker";
    lmName.value = lmNotes.value = lmCustomType.value = lmSubtype.value = lmInvTags.value = lmPicture.value = "";
    lmType.value = "Forge";
    selectedTavernWealth = "Middle Class";
    lmTavernTables.value = 6;
    lmRoomCount.value    = 4;
    populateOwnerSelect("");
  }
  if (lmUploadStatus) lmUploadStatus.textContent = "";

  updateMarkerTypeFields();
  // If editing a tavern, re-populate servants with the saved list (overrides the empty call above)
  if (m?.type === "Tavern") {
    populateServantsSection(m.servants || []);
    syncTavernWealthBtns();
  }
  locMarkerModal.classList.add("open");
  lmName.focus();
}

function closeSubMarkerModal() {
  locMarkerModal.classList.remove("open");
  pendingCoords = null;
  editingSubId  = null;
  if (placingMode) {
    placingMode = false;
    if (locBtnPlace) {
      locBtnPlace.textContent = "Place Marker";
      locBtnPlace.classList.remove("active");
    }
    locMapContainer.classList.remove("placing-mode");
    locPlacingBanner.classList.remove("visible");
  }
}

lmSave.addEventListener("click", () => {
  const name = lmName.value.trim();
  if (!name) { lmError.textContent = "Name is required."; return; }

  const id             = editingSubId || generateId();
  const existing       = editingSubId ? subMarkers.find(m => m.id === editingSubId) : null;
  const prevOwnerId    = existing?.ownerId || null;
  const newOwnerId     = lmOwner.value || null;
  const isTavern       = lmType.value === "Tavern";
  const newServants    = isTavern ? getSelectedServants() : [];
  const prevServants   = existing?.servants || [];

  set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${id}`), {
    id,
    name,
    type:               lmType.value,
    customType:         (lmType.value === "Other" && lmCustomType.value.trim()) ? lmCustomType.value.trim() : null,
    shopSubtype:        ((lmType.value === "Shop" || lmType.value === "Market") && lmSubtype.value.trim()) ? lmSubtype.value.trim() : null,
    inventoryTags:      lmInvTags.value.trim() || null,
    tavernTables:       isTavern ? (parseInt(lmTavernTables.value, 10) || 6)  : null,
    roomCount:          isTavern ? (parseInt(lmRoomCount.value,    10) || 0)  : null,
    tavernWealth:       isTavern ? selectedTavernWealth : null,
    servants:           (isTavern && newServants.length > 0) ? newServants : null,
    // Preserve generated data across edits
    generatedInventory: existing?.generatedInventory || null,
    seating:            (isTavern && existing?.seating) ? existing.seating : null,
    ownerId:            newOwnerId,
    notes:              lmNotes.value.trim() || null,
    picture:            lmPicture.value.trim() || null,
    x:                  existing ? existing.x : pendingCoords.x,
    y:                  existing ? existing.y : pendingCoords.y,
    order:              existing ? (existing.order !== undefined ? existing.order : subMarkers.length) : subMarkers.length,
    discovered:         existing?.discovered || false
  });

  // Auto-update NPC roles based on ownership changes
  if (newOwnerId !== prevOwnerId) {
    if (newOwnerId) {
      set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${newOwnerId}/role`), `Owner ${name}`);
    }
    if (prevOwnerId) {
      const prevNpc    = npcs.find(n => n.id === prevOwnerId);
      const randomRole = pickProfession(prevNpc?.race || null);
      set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${prevOwnerId}/role`), randomRole);
    }
  } else if (newOwnerId && existing && name !== existing.name) {
    set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${newOwnerId}/role`), `Owner ${name}`);
  }

  // Auto-update servant roles
  const prevServantSet = new Set(prevServants);
  const newServantSet  = new Set(newServants);

  // Newly added servants get "Waiter at [name]"
  newServantSet.forEach(npcId => {
    if (!prevServantSet.has(npcId)) {
      set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npcId}/role`), `Waiter at ${name}`);
    }
  });

  // Removed servants (or type changed away from Tavern) revert to random profession
  prevServantSet.forEach(npcId => {
    if (!newServantSet.has(npcId)) {
      const npc = npcs.find(n => n.id === npcId);
      set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npcId}/role`), pickProfession(npc?.race || null));
    }
  });

  // If tavern was renamed, update all retained servants' roles
  if (isTavern && existing && name !== existing.name) {
    newServantSet.forEach(npcId => {
      if (prevServantSet.has(npcId)) {
        set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npcId}/role`), `Waiter at ${name}`);
      }
    });
  }

  closeSubMarkerModal();
});

lmType.addEventListener("change", updateMarkerTypeFields);
lmCancel.addEventListener("click", closeSubMarkerModal);
locMarkerModal.addEventListener("click", e => { if (e.target === locMarkerModal) closeSubMarkerModal(); });

// Marker image upload
if (lmUploadBtn && lmPicFile) {
  lmUploadBtn.addEventListener("click", () => lmPicFile.click());
  lmPicFile.addEventListener("change", async () => {
    const file = lmPicFile.files[0];
    if (!file) return;
    lmUploadStatus.textContent = "Compressing…";
    lmUploadStatus.className = "lm-upload-status uploading";
    lmUploadBtn.disabled = true;
    try {
      const base64 = await compressImage(file, 600, 0.82);
      lmPicture.value = base64;
      lmUploadStatus.innerHTML = 'Image ready <iconify-icon icon="lucide:check"></iconify-icon>';
      lmUploadStatus.className = "lm-upload-status done";
      setTimeout(() => { lmUploadStatus.textContent = ""; }, 3000);
    } catch {
      lmUploadStatus.textContent = "Upload failed.";
      lmUploadStatus.className = "lm-upload-status error";
    } finally {
      lmUploadBtn.disabled = false;
      lmPicFile.value = "";
    }
  });
}

// ── Buildings List (DM only — mirrors sub-markers) ───────────────────────────
const locBuildingsList = document.getElementById("loc-buildings-list");

function renderBuildings() {
  locBuildingsList.innerHTML = "";

  if (subMarkers.length === 0) {
    locBuildingsList.innerHTML = `<p class="empty-hint">No markers placed on the map yet.</p>`;
    return;
  }

  // Sort by saved order, falling back to stable array position
  const sorted = [...subMarkers].sort((a, b) => {
    const ao = a.order !== undefined ? a.order : Infinity;
    const bo = b.order !== undefined ? b.order : Infinity;
    return ao - bo;
  });

  sorted.forEach(marker => {
    const card = document.createElement("div");
    card.className  = "building-card" + (marker.discovered ? " building-discovered" : "");
    card.dataset.id = marker.id;
    card.draggable  = true;

    const color  = TYPE_COLORS[marker.type] || "#BDBDBD";
    const bOwner = marker.ownerId ? npcs.find(n => n.id === marker.ownerId) : null;

    card.innerHTML = `
      <iconify-icon icon="lucide:grip-vertical" class="building-drag-handle" title="Drag to reorder"></iconify-icon>
      <div class="building-dot" style="background:${color}"></div>
      <div class="building-info">
        <div class="building-name">${marker.name}</div>
        <div class="building-type">${markerDisplayType(marker)}${marker.shopSubtype ? ` · ${marker.shopSubtype}` : ""}${bOwner ? ` · ${bOwner.name}` : ""}</div>
        ${marker.notes ? `<div class="building-notes">${marker.notes}</div>` : ""}
      </div>
      <div class="building-card-actions">
        <button class="building-open-btn dm-btn dm-btn-sm" title="View shop">Open</button>
        <button class="building-vis-btn${marker.discovered ? " active" : ""}" title="${marker.discovered ? "Hide from players" : "Reveal to players"}"><iconify-icon icon="lucide:eye"></iconify-icon></button>
      </div>
    `;

    // ── Open shop modal ─────────────────────────────────────────────────────
    card.querySelector(".building-open-btn").addEventListener("click", e => {
      e.stopPropagation();
      openShopModal(marker);
    });

    // ── Reveal/hide toggle ──────────────────────────────────────────────────
    card.querySelector(".building-vis-btn").addEventListener("click", e => {
      e.stopPropagation();
      set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${marker.id}/discovered`), !marker.discovered);
    });

    // ── Highlight on click ──────────────────────────────────────────────────
    card.addEventListener("click", () => {
      if (isDraggingBuilding) return;
      const alreadyHighlighted = card.classList.contains("highlighted");
      locMarkerLayer.querySelectorAll(".loc-marker.active").forEach(m => m.classList.remove("active"));
      highlightBuildingCard(null);
      if (!alreadyHighlighted) {
        highlightBuildingCard(marker.id);
        const mapMarker = locMarkerLayer.querySelector(`[data-id="${marker.id}"]`);
        if (mapMarker) {
          mapMarker.classList.add("active");
          document.getElementById("sec-map").scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });

    // ── Drag-and-drop reordering ────────────────────────────────────────────
    card.addEventListener("dragstart", e => {
      isDraggingBuilding = true;
      dragSrcId = marker.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const dragging = locBuildingsList.querySelector(".building-card.dragging");
      if (!dragging || dragging === card) return;
      const rect = card.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        locBuildingsList.insertBefore(dragging, card);
      } else {
        locBuildingsList.insertBefore(dragging, card.nextSibling);
      }
    });

    card.addEventListener("drop", e => {
      e.preventDefault();
      // Write new order from current DOM position to Firebase
      const cards = [...locBuildingsList.querySelectorAll(".building-card")];
      cards.forEach((c, idx) => {
        set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${c.dataset.id}/order`), idx);
      });
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      locBuildingsList.querySelectorAll(".building-card.drag-over").forEach(c => c.classList.remove("drag-over"));
      isDraggingBuilding = false;
      dragSrcId = null;
      renderBuildings();
    });

    locBuildingsList.appendChild(card);
  });
}

function highlightBuildingCard(id) {
  if (!locBuildingsList) return;
  locBuildingsList.querySelectorAll(".building-card").forEach(c => {
    c.classList.toggle("highlighted", c.dataset.id === id);
  });
}

// ── NPC Rendering ─────────────────────────────────────────────────────────────
function renderNpcs() {
  locNpcList.innerHTML = "";

  if (npcs.length === 0) {
    locNpcList.innerHTML = `<p class="empty-hint">No NPCs added yet.</p>`;
    return;
  }

  let sorted = [...npcs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  if (npcSearchQuery) {
    const q = npcSearchQuery.toLowerCase();
    sorted = sorted.filter(n =>
      (n.name        || "").toLowerCase().includes(q) ||
      (n.race        || "").toLowerCase().includes(q) ||
      (n.role        || "").toLowerCase().includes(q) ||
      (n.description || "").toLowerCase().includes(q)
    );
  }

  if (sorted.length === 0 && npcs.length > 0) {
    locNpcList.innerHTML = `<p class="empty-hint">No NPCs match your search.</p>`;
    return;
  }

  sorted.forEach((npc, index) => {
    const card = document.createElement("div");
    card.className = "npc-card" + (npc.talkedTo ? " npc-talked" : "");

    const num      = String(index + 1).padStart(3, "0");
    const agePart  = npc.age ? `Age ${npc.age}` : null;
    const subtitle = [npc.race, npc.role, agePart].filter(Boolean).join(" • ");

    card.innerHTML = `
      <div class="npc-header">
        <div class="npc-num">#${num}</div>
        <div class="npc-main">
          <div class="npc-name">${npc.name}</div>
          ${subtitle ? `<div class="npc-subtitle">${subtitle}</div>` : ""}
        </div>
        <div class="npc-actions">
          <button class="npc-talk-btn${npc.talkedTo ? " active" : ""}" title="${npc.talkedTo ? "Mark as not talked to" : "Mark as talked to"}"><iconify-icon icon="lucide:check"></iconify-icon></button>
          <button class="marker-edit-btn dm-btn dm-btn-sm npc-edit-btn">Edit</button>
          <button class="marker-delete-btn dm-btn dm-btn-sm npc-del-btn">Del</button>
        </div>
      </div>
      ${npc.description ? `<p class="npc-desc">${npc.description}</p>` : ""}
      ${npc.notes ? `<div class="npc-notes">DM: ${npc.notes}</div>` : ""}
    `;

    card.querySelector(".npc-talk-btn").addEventListener("click", () => {
      set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npc.id}/talkedTo`), !npc.talkedTo);
    });
    card.querySelector(".npc-edit-btn").addEventListener("click", () => openNpcModal(npc.id));
    card.querySelector(".npc-del-btn").addEventListener("click",  () => remove(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npc.id}`)));

    locNpcList.appendChild(card);
  });
}

// ── NPC Modal ─────────────────────────────────────────────────────────────────
const locNpcModal = document.getElementById("loc-npc-modal");
const lnTitle     = document.getElementById("ln-title");
const lnName      = document.getElementById("ln-name");
const lnRace      = document.getElementById("ln-race");
const lnRole      = document.getElementById("ln-role");
const lnAge       = document.getElementById("ln-age");
const lnDesc      = document.getElementById("ln-desc");
const lnNotes     = document.getElementById("ln-notes");
const lnError     = document.getElementById("ln-error");
const lnSave      = document.getElementById("ln-save");
const lnCancel    = document.getElementById("ln-cancel");

function openNpcModal(id) {
  editingNpcId = id;
  lnError.textContent = "";

  if (id) {
    const n = npcs.find(n => n.id === id);
    lnTitle.textContent = "Edit NPC";
    lnName.value  = n.name        || "";
    lnRace.value  = n.race        || "";
    lnRole.value  = n.role        || "";
    lnAge.value   = n.age         || "";
    lnDesc.value  = n.description || "";
    lnNotes.value = n.notes       || "";
  } else {
    lnTitle.textContent = "Add NPC";
    lnName.value = lnRace.value = lnRole.value = lnAge.value = lnDesc.value = lnNotes.value = "";
  }

  locNpcModal.classList.add("open");
  lnName.focus();
}

function closeNpcModal() {
  locNpcModal.classList.remove("open");
  editingNpcId = null;
}

lnSave.addEventListener("click", () => {
  const name = lnName.value.trim();
  if (!name) { lnError.textContent = "Name is required."; return; }

  const id        = editingNpcId || generateId();
  const existing  = editingNpcId ? npcs.find(n => n.id === editingNpcId) : null;
  const ageVal    = parseInt(lnAge.value, 10);

  set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${id}`), {
    id,
    name,
    race:        lnRace.value.trim()  || null,
    role:        lnRole.value.trim()  || null,
    age:         isNaN(ageVal) ? null : ageVal,
    description: lnDesc.value.trim()  || null,
    notes:       lnNotes.value.trim() || null,
    createdAt:   existing?.createdAt  || Date.now(),
    talkedTo:    existing?.talkedTo   || false
  });

  closeNpcModal();
});

lnCancel.addEventListener("click", closeNpcModal);
locNpcModal.addEventListener("click", e => { if (e.target === locNpcModal) closeNpcModal(); });

document.getElementById("loc-add-npc-btn").addEventListener("click", () => openNpcModal(null));

// ── NPC Generator Toggle ──────────────────────────────────────────────────────
const npcGeneratorPanel = document.getElementById("npc-generator-panel");
const toggleGenBtn      = document.getElementById("loc-toggle-gen-btn");
let generatorOpen = false;

if (toggleGenBtn && npcGeneratorPanel) {
  toggleGenBtn.addEventListener("click", () => {
    generatorOpen = !generatorOpen;
    npcGeneratorPanel.style.display = generatorOpen ? "" : "none";
    toggleGenBtn.innerHTML = generatorOpen ? 'Generator <iconify-icon icon="lucide:chevron-down"></iconify-icon>' : 'Generator <iconify-icon icon="lucide:chevron-right"></iconify-icon>';
  });
}

// ── NPC Search ────────────────────────────────────────────────────────────────
let npcSearchQuery = "";
const npcSearchInput = document.getElementById("npc-search");
if (npcSearchInput) {
  npcSearchInput.addEventListener("input", e => {
    npcSearchQuery = e.target.value;
    renderNpcs();
  });
}

// ── Description Edit ──────────────────────────────────────────────────────────
const locDescModal = document.getElementById("loc-desc-modal");
const ldText       = document.getElementById("ld-text");
const ldSave       = document.getElementById("ld-save");
const ldCancel     = document.getElementById("ld-cancel");

document.getElementById("loc-edit-desc-btn").addEventListener("click", () => {
  ldText.value = locationInfo.description || "";
  locDescModal.classList.add("open");
  ldText.focus();
});

ldSave.addEventListener("click", () => {
  set(ref(db, `campaigns/${cid}/locations/${locationId}/info/description`), ldText.value.trim() || null);
  locDescModal.classList.remove("open");
});

ldCancel.addEventListener("click", () => locDescModal.classList.remove("open"));
locDescModal.addEventListener("click", e => { if (e.target === locDescModal) locDescModal.classList.remove("open"); });

// ── Map Image Upload (compressed base64 → Realtime Database) ─────────────────
const locMapUpload = document.getElementById("loc-map-upload");

function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

if (locMapUpload) {
  locMapUpload.addEventListener("change", async () => {
    const file = locMapUpload.files[0];
    if (!file) return;

    locMapPlaceholder.innerHTML = `<span style="color:#aaa">Compressing&hellip;</span>`;
    locMapPlaceholder.style.display = "flex";
    locMapImg.style.display = "none";

    try {
      const base64 = await compressImage(file);
      await set(ref(db, `campaigns/${cid}/locations/${locationId}/info/mapImageUrl`), base64);
    } catch (err) {
      locMapPlaceholder.innerHTML = `<span style="color:#E57373">Upload failed. Try a smaller image.</span>`;
    }

    locMapUpload.value = "";
  });
}

// ── Feature image upload ──────────────────────────────────────────────────────
const locFeatureUpload = document.getElementById("loc-feature-upload");
if (locFeatureUpload) {
  locFeatureUpload.addEventListener("change", async () => {
    const file = locFeatureUpload.files[0];
    if (!file) return;
    locFeatureImgPh.innerHTML = `<span style="color:#aaa;font-size:13px">Compressing…</span>`;
    locFeatureImgPh.style.display = "flex";
    locFeatureImg.style.display = "none";
    try {
      const base64 = await compressImage(file, 1200, 0.85);
      await set(ref(db, `campaigns/${cid}/locations/${locationId}/info/featureImageUrl`), base64);
    } catch {
      locFeatureImgPh.innerHTML = `<span style="color:#E57373;font-size:13px">Upload failed.</span>`;
    }
    locFeatureUpload.value = "";
  });
}

// ── DM Controls visibility ────────────────────────────────────────────────────
if (isAdmin) {
  document.getElementById("loc-dm-toolbar").style.display    = "flex";
  document.getElementById("loc-edit-desc-btn").style.display = "inline-block";
  document.getElementById("sec-buildings").style.display     = "block";
  document.getElementById("sec-npcs").style.display          = "block";
  const hint = document.getElementById("loc-upload-hint");
  if (hint) hint.style.display = "block";
  const featureUploadBtn = document.getElementById("loc-feature-upload-btn");
  if (featureUploadBtn) featureUploadBtn.style.display = "flex";
}

// ── NPC Generator ─────────────────────────────────────────────────────────────
const genBtn      = document.getElementById("gen-btn");
const genClearBtn = document.getElementById("gen-clear-btn");
const genCountEl  = document.getElementById("gen-count");
const genStatus   = document.getElementById("gen-status");

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

function parsePopulation(str) {
  if (!str) return 1000;
  const s = str.toString().replace(/,/g, "").trim().toLowerCase();
  const k = s.match(/^([\d.]+)\s*k$/);
  if (k) return parseFloat(k[1]) * 1000;
  const n = parseFloat(s);
  return isNaN(n) ? 1000 : n;
}

function expandElf(isElfDominant) {
  const pool = isElfDominant ? ELF_SUBTYPE_WEIGHTS.dominant : ELF_SUBTYPE_WEIGHTS.default;
  return weightedPick(pool);
}

function pickRace(mainRace, popNum) {
  const allRaces = Object.keys(RACE_BASE_WEIGHTS);
  const isElfMain = mainRace === "Elf";

  // For an elf city, treat the three elf sub-types as the dominant group
  const effectiveMain = isElfMain ? "Elf" : mainRace;

  let baseRace;
  if (!effectiveMain) {
    baseRace = weightedPick(allRaces.map(r => ({ name: r, weight: RACE_BASE_WEIGHTS[r] })));
  } else {
    let mainPct;
    if      (popNum >= 10000) mainPct = 48;
    else if (popNum >= 5000)  mainPct = 55;
    else if (popNum >= 1000)  mainPct = 65;
    else if (popNum >= 500)   mainPct = 75;
    else                      mainPct = 82;

    const otherPct   = 100 - mainPct;
    const otherRaces = allRaces.filter(r => r !== effectiveMain);
    const totalBase  = otherRaces.reduce((s, r) => s + RACE_BASE_WEIGHTS[r], 0);

    const items = [{ name: effectiveMain, weight: mainPct }];
    otherRaces.forEach(r => {
      items.push({ name: r, weight: (RACE_BASE_WEIGHTS[r] / totalBase) * otherPct });
    });
    baseRace = weightedPick(items);
  }

  // Expand any "Elf" result into a sub-type
  if (baseRace === "Elf") {
    return expandElf(isElfMain);
  }
  return baseRace;
}

function pickName(race) {
  const pool    = NPC_NAMES[race] || NPC_NAMES["Human"];
  const isMale  = Math.random() < 0.5;
  const first   = isMale ? pool.male[Math.floor(Math.random() * pool.male.length)]
                         : pool.female[Math.floor(Math.random() * pool.female.length)];
  const surname = pool.surname[Math.floor(Math.random() * pool.surname.length)];
  return first + " " + surname;
}

function pickProfession(race) {
  const table = RACE_PROFESSIONS[race] || DEFAULT_PROFESSIONS;
  return weightedPick(table);
}

function pickAge(race) {
  const [min, max] = AGE_RANGES[race] || [18, 65];
  // Skew towards younger-middle (most people aren't ancient)
  const raw = min + Math.pow(Math.random(), 1.6) * (max - min);
  return Math.round(raw);
}

function pickTrait() {
  return NPC_TRAITS[Math.floor(Math.random() * NPC_TRAITS.length)];
}

function generateOneNpc() {
  const mainRace = markerData?.mainRace || null;
  const popNum   = parsePopulation(markerData?.population);
  const race     = pickRace(mainRace, popNum);
  const name     = pickName(race);
  const role     = pickProfession(race);
  const age      = pickAge(race);
  const trait    = pickTrait();
  const id       = generateId();

  return {
    id,
    name,
    race,
    role,
    age,
    description: `A ${trait} ${race.toLowerCase()} working as a ${role.toLowerCase()}.`,
    notes:       null,
    createdAt:   Date.now() + Math.floor(Math.random() * 1000) // slight spread so ordering is stable
  };
}

if (genBtn) {
  genBtn.addEventListener("click", async () => {
    const count = Math.max(1, Math.min(500, parseInt(genCountEl.value, 10) || 20));
    genBtn.disabled = true;
    genStatus.style.color = "#aaa";
    genStatus.textContent = `Generating ${count} NPCs…`;

    // Build batch — deduplicate full names AND first names to reduce repetition
    const usedNames      = new Set(npcs.map(n => n.name));
    const usedFirstNames = new Set(npcs.map(n => n.name.split(" ")[0]));
    const batch = [];
    const baseTime = Date.now();
    for (let i = 0; i < count; i++) {
      let npc;
      let tries = 0;
      do {
        npc = generateOneNpc();
        tries++;
      } while ((usedNames.has(npc.name) || usedFirstNames.has(npc.name.split(" ")[0])) && tries < 40);
      usedNames.add(npc.name);
      usedFirstNames.add(npc.name.split(" ")[0]);
      npc.createdAt = baseTime + i;
      batch.push(npc);
    }

    try {
      await Promise.all(batch.map(npc =>
        set(ref(db, `campaigns/${cid}/locations/${locationId}/npcs/${npc.id}`), npc)
      ));
      genStatus.style.color = "#88cc88";
      genStatus.innerHTML = `<iconify-icon icon="lucide:check"></iconify-icon> ${count} NPCs generated.`;
    } catch {
      genStatus.style.color = "#E57373";
      genStatus.textContent = "Generation failed — check Firebase rules.";
    }

    genBtn.disabled = false;
    setTimeout(() => { genStatus.textContent = ""; }, 4000);
  });
}

if (genClearBtn) {
  genClearBtn.addEventListener("click", () => {
    if (!confirm(`Delete all ${npcs.length} NPCs in this location? This cannot be undone.`)) return;
    remove(ref(db, `campaigns/${cid}/locations/${locationId}/npcs`));
    genStatus.style.color = "#aaa";
    genStatus.textContent = "All NPCs cleared.";
    setTimeout(() => { genStatus.textContent = ""; }, 3000);
  });
}

// ── Shop Modal ────────────────────────────────────────────────────────────────
const shopModal           = document.getElementById("shop-modal");
const shopClose           = document.getElementById("shop-close");
const shName              = document.getElementById("sh-name");
const shMeta              = document.getElementById("sh-meta");
const shOwner             = document.getElementById("sh-owner");
const shInventory         = document.getElementById("sh-inventory");
const shInventorySection  = document.getElementById("sh-inventory-section");
const shTypeDot           = document.getElementById("sh-type-dot");
const shRarityFilter      = document.getElementById("sh-rarity-filter");
const shGenerateBtn       = document.getElementById("sh-generate-btn");
const shTavernSection     = document.getElementById("sh-tavern-section");
const shTavernMeta        = document.getElementById("sh-tavern-meta");
const shTavernServants    = document.getElementById("sh-tavern-servants");
const shTavernGenBtn      = document.getElementById("sh-tavern-gen-btn");
const shTavernSeating     = document.getElementById("sh-tavern-seating");
const shTavernMenu        = document.getElementById("sh-tavern-menu");
const shTavernRooms       = document.getElementById("sh-tavern-rooms");
const shRoomsStatus       = document.getElementById("sh-rooms-status");
const shRoomsGrid         = document.getElementById("sh-rooms-grid");
const shopModalBox        = shopModal.querySelector(".shop-modal-box");

const INVENTORY_TYPES = new Set(["Shop", "Market", "Forge"]);

let shopRarityFilter = "all";

// Which item tags each shop type automatically carries
const SHOP_TYPE_TAGS = {
  "Forge":   ["weapon", "melee", "armor", "shield", "ammunition", "tool", "forge"],
  "Shop":    ["adventuring", "potion", "tool", "light"],
  "Tavern":  ["food", "drink", "ale", "wine", "potion"],
  "Temple":  ["potion", "healing", "protection", "holy"],
  "Guard":   ["weapon", "melee", "ranged", "armor", "shield", "ammunition"],
  "Market":  ["adventuring", "food", "tool", "light"],
  "Library": ["book", "scroll", "map", "arcane", "lore"],
  "House":   [],
  "Other":   []
};

// Rarity distribution weights for shop generation
const RARITY_WEIGHTS = {
  "common":      60,  // 60% chance
  "uncommon":    25,  // 25% chance
  "rare":        10,  // 10% chance
  "very rare":   4,   // 4% chance
  "legendary":   1    // 1% chance
};

// Rarity color mapping
const RARITY_COLORS = {
  "common":      "#9e9e9e",
  "uncommon":    "#4caf50",
  "rare":        "#2196f3",
  "very rare":   "#9c27b0",
  "legendary":   "#ff9800"
};

// ── Tavern Menus — race-themed, split drinks / foods ─────────────────────────
const RACE_MENUS = {
  Human: {
    drinks: [
      { name: "Ale",               basePriceCp:  4 },
      { name: "Dark Stout",        basePriceCp:  6 },
      { name: "Common Wine",       basePriceCp: 10 },
      { name: "Fine Wine",         basePriceCp: 30 },
      { name: "Mead",              basePriceCp:  5 },
      { name: "Spiced Cider",      basePriceCp:  5 },
      { name: "Watered Wine",      basePriceCp:  3 },
    ],
    foods: [
      { name: "Hearty Stew",       basePriceCp:  6 },
      { name: "Bread & Cheese",    basePriceCp:  3 },
      { name: "Roasted Chicken",   basePriceCp: 12 },
      { name: "Meat Pie",          basePriceCp: 10 },
      { name: "Vegetable Soup",    basePriceCp:  4 },
      { name: "Smoked Sausage",    basePriceCp:  8 },
      { name: "Traveler's Meal",   basePriceCp:  8 },
      { name: "Porridge & Honey",  basePriceCp:  3 },
      { name: "Salted Pork Strips",basePriceCp:  5 },
      { name: "Potato & Herb Mash",basePriceCp:  4 },
    ],
  },
  Elf: {
    drinks: [
      { name: "Elven Moonwine",       basePriceCp: 25 },
      { name: "Silverleaf Tea",       basePriceCp:  8 },
      { name: "Forest Bloom Spirits", basePriceCp: 18 },
      { name: "Dewdrop Nectar",       basePriceCp: 14 },
      { name: "Starwater",            basePriceCp:  6 },
      { name: "Pale Elderflower Wine",basePriceCp: 20 },
      { name: "Dawnmist Cordial",     basePriceCp: 10 },
    ],
    foods: [
      { name: "Honeyed Fruit Platter",  basePriceCp: 12 },
      { name: "Moonleaf Salad",         basePriceCp:  8 },
      { name: "Roasted Venison",        basePriceCp: 18 },
      { name: "Elderflower Bread",      basePriceCp:  4 },
      { name: "Herb-Glazed Quail",      basePriceCp: 20 },
      { name: "Crystallized Berries",   basePriceCp:  6 },
      { name: "Acorn Cake",             basePriceCp:  5 },
      { name: "Roasted Root Medley",    basePriceCp:  7 },
      { name: "Willow-Smoked Trout",    basePriceCp: 15 },
      { name: "Sweetgrass Flatbread",   basePriceCp:  4 },
    ],
  },
  Dwarf: {
    drinks: [
      { name: "Dark Mountain Stout",  basePriceCp:  7 },
      { name: "Rockfire Whisky",      basePriceCp: 15 },
      { name: "Cave Moss Ale",        basePriceCp:  5 },
      { name: "Iron Brew",            basePriceCp:  6 },
      { name: "Molten Gold Mead",     basePriceCp: 12 },
      { name: "Tunnel-Aged Porter",   basePriceCp:  8 },
      { name: "Stonewort Beer",       basePriceCp:  4 },
      { name: "Ancestor's Reserve",   basePriceCp: 25 },
    ],
    foods: [
      { name: "Stone-Bread Loaf",       basePriceCp:  3 },
      { name: "Grilled Cave Mushrooms", basePriceCp:  6 },
      { name: "Roasted Boar",           basePriceCp: 18 },
      { name: "Iron Pot Stew",          basePriceCp:  8 },
      { name: "Smoked Tunnel Fish",     basePriceCp: 10 },
      { name: "Pickled Beet Wedge",     basePriceCp:  3 },
      { name: "Salted Hardtack",        basePriceCp:  2 },
      { name: "Deep-Fried Root Cakes",  basePriceCp:  5 },
      { name: "Braised Mountain Goat",  basePriceCp: 15 },
      { name: "Miners' Cheese Board",   basePriceCp:  7 },
    ],
  },
  Halfling: {
    drinks: [
      { name: "Green Leaf Tea",      basePriceCp:  4 },
      { name: "Pipeweed Cider",      basePriceCp:  6 },
      { name: "Meadow Wine",         basePriceCp:  8 },
      { name: "Warm Spiced Cider",   basePriceCp:  5 },
      { name: "Strawberry Cordial",  basePriceCp:  7 },
      { name: "Cream Stout",         basePriceCp:  6 },
      { name: "Honeybee Mead",       basePriceCp:  9 },
    ],
    foods: [
      { name: "Mushroom Pasty",         basePriceCp:  8 },
      { name: "Hearty Breakfast Plate", basePriceCp: 12 },
      { name: "Honey Cake",             basePriceCp:  5 },
      { name: "Baked Potato & Herbs",   basePriceCp:  6 },
      { name: "Second Breakfast Plate", basePriceCp: 10 },
      { name: "Seed Bread",             basePriceCp:  3 },
      { name: "Jam Tart",               basePriceCp:  4 },
      { name: "Fried Egg & Bacon",      basePriceCp:  9 },
      { name: "Hobbit's Cheese Toast",  basePriceCp:  5 },
      { name: "Vegetable Pot Pie",      basePriceCp:  8 },
    ],
  },
  Gnome: {
    drinks: [
      { name: "Fizzing Ginger Brew",     basePriceCp:  8 },
      { name: "Sparkling Cogsworth Ale", basePriceCp: 10 },
      { name: "Electric Blue Concoction",basePriceCp: 15 },
      { name: "Glowing Amber Tonic",     basePriceCp: 12 },
      { name: "Bubbly Mischief",         basePriceCp:  7 },
      { name: "Tinker's Reserve Whisky", basePriceCp: 18 },
      { name: "Fizzy Root Extract",      basePriceCp:  5 },
    ],
    foods: [
      { name: "Crystallized Beetle Biscuit",basePriceCp: 6 },
      { name: "Spiced Pumpkin Pie",         basePriceCp: 8 },
      { name: "Alchemical Candy",           basePriceCp: 5 },
      { name: "Gear-Shaped Gingerbread",    basePriceCp: 4 },
      { name: "Mushroom & Cream Tart",      basePriceCp: 9 },
      { name: "Smoked Radish Medley",       basePriceCp: 6 },
      { name: "Compressed Nutloaf",         basePriceCp: 5 },
      { name: "Inventor's Mystery Stew",    basePriceCp: 7 },
    ],
  },
  Orc: {
    drinks: [
      { name: "Bloodfire Grog",      basePriceCp:  6 },
      { name: "Iron Gut Ale",        basePriceCp:  4 },
      { name: "Black Tar Beer",      basePriceCp:  3 },
      { name: "Warchief's Reserve",  basePriceCp: 20 },
      { name: "Boar Bone Broth",     basePriceCp:  4 },
      { name: "Battlefield Rot-gut", basePriceCp:  2 },
      { name: "Fermented Tusk Milk", basePriceCp:  3 },
    ],
    foods: [
      { name: "Charred Boar Haunch", basePriceCp: 14 },
      { name: "Bone Broth Bowl",     basePriceCp:  4 },
      { name: "Grilled Warg Meat",   basePriceCp: 12 },
      { name: "Salted Meat Strip",   basePriceCp:  5 },
      { name: "War Bread",           basePriceCp:  2 },
      { name: "Marrow Cracker",      basePriceCp:  4 },
      { name: "Tusk Root Stew",      basePriceCp:  7 },
      { name: "Scorched Beast Ribs", basePriceCp: 10 },
      { name: "Twice-Boiled Offal",  basePriceCp:  3 },
    ],
  },
  Tiefling: {
    drinks: [
      { name: "Brimstone Whisky",    basePriceCp: 18 },
      { name: "Hellfire Brandy",     basePriceCp: 22 },
      { name: "Shadow Wine",         basePriceCp: 15 },
      { name: "Infernal Spiced Rum", basePriceCp: 12 },
      { name: "Ember Gin",           basePriceCp: 14 },
      { name: "Smoldering Cider",    basePriceCp:  8 },
      { name: "Ash-Black Stout",     basePriceCp:  6 },
    ],
    foods: [
      { name: "Devil's Tongue Soup",    basePriceCp: 10 },
      { name: "Charred Pepper Skewer",  basePriceCp:  8 },
      { name: "Fire-Roasted Lamb",      basePriceCp: 16 },
      { name: "Sulfur Salt Bread",      basePriceCp:  4 },
      { name: "Scorched Corn Flatbread",basePriceCp:  3 },
      { name: "Cinder-Spiced Stew",     basePriceCp:  9 },
      { name: "Seared Blood Sausage",   basePriceCp:  7 },
      { name: "Hellpepper Skewers",     basePriceCp:  6 },
    ],
  },
  Dragonborn: {
    drinks: [
      { name: "Dragonscale Stout",     basePriceCp:  8 },
      { name: "Ember Cider",           basePriceCp:  7 },
      { name: "Blazing Mead",          basePriceCp: 12 },
      { name: "Scale-Polished Spirits",basePriceCp: 20 },
      { name: "Volcanic Red Wine",     basePriceCp: 18 },
      { name: "Smoldering Amber Ale",  basePriceCp:  6 },
    ],
    foods: [
      { name: "Flame-Seared Steak",    basePriceCp: 18 },
      { name: "Dragon Pepper Stew",    basePriceCp: 10 },
      { name: "Scorched Bone Marrow",  basePriceCp:  8 },
      { name: "Fire-Kissed Flatbread", basePriceCp:  4 },
      { name: "Charred Egg on Spit",   basePriceCp:  5 },
      { name: "Ember-Smoked Ribs",     basePriceCp: 16 },
      { name: "Ash-Roasted Root",      basePriceCp:  5 },
      { name: "Spit-Roasted Serpent",  basePriceCp: 12 },
    ],
  },
  Goblin: {
    drinks: [
      { name: "Swamp Brew",          basePriceCp:  2 },
      { name: "Rotten Apple Cider",  basePriceCp:  2 },
      { name: "Mudwater Special",    basePriceCp:  1 },
      { name: "Fermented Bog Juice", basePriceCp:  2 },
      { name: "Mystery Grog",        basePriceCp:  3 },
    ],
    foods: [
      { name: "Rat-on-a-Stick",      basePriceCp:  3 },
      { name: "Mystery Stew",        basePriceCp:  2 },
      { name: "Mushroom Skewer",     basePriceCp:  3 },
      { name: "Boiled Whatever",     basePriceCp:  1 },
      { name: "Scorched Crust Bread",basePriceCp:  2 },
      { name: "Pickled Bug Snack",   basePriceCp:  2 },
      { name: "Slimy Cave Surprise", basePriceCp:  1 },
    ],
  },
};

const TAVERN_WEALTH_MULT = { "Poor": 0.55, "Middle Class": 1.0, "Rich": 2.6 };

function resolveRaceMenu(race) {
  if (!race) return "Human";
  const r = race.toLowerCase();
  if (r.includes("elf") || r === "drow")         return "Elf";
  if (r.includes("dwarf"))                        return "Dwarf";
  if (r.includes("halfling"))                     return "Halfling";
  if (r.includes("gnome"))                        return "Gnome";
  if (r.includes("orc"))                          return "Orc";
  if (r.includes("tiefling"))                     return "Tiefling";
  if (r.includes("dragonborn"))                   return "Dragonborn";
  if (r.includes("goblin"))                       return "Goblin";
  return "Human";
}

// Deterministic price multiplier per shop+item combo (0.85 – 1.15)
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function shopPrice(basePrice, shopId, itemId) {
  const h = hashCode(shopId + itemId);
  const mult = 0.85 + (h % 10000) / 10000 * 0.30;
  const p = Math.max(basePrice * mult, 0.01); // always at least 1 cp
  if (p >= 100) return Math.round(p);
  if (p >= 10)  return Math.round(p * 2) / 2;
  if (p >= 1)   return Math.round(p * 10) / 10;
  return Math.max(Math.round(p * 100) / 100, 0.01);
}

// Pick rarity based on weighted distribution
function pickRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return "common";
}

// Persist generated inventory for a shop (6–15 random items from its pool, weighted by rarity)
async function generateShopInventory(marker) {
  const pool = getShopPool(marker);
  if (pool.length === 0) return;

  const count = 6 + Math.floor(Math.random() * 10); // 6–15

  // Group pool by rarity
  const poolByRarity = {};
  for (const item of pool) {
    const tags = parseTags(item.tags);
    const rarity = getItemRarity(item);
    if (!poolByRarity[rarity]) poolByRarity[rarity] = [];
    poolByRarity[rarity].push(item);
  }

  const picked = [];
  const pickedIds = new Set();

  // Generate items with rarity weighting
  for (let i = 0; i < count && picked.length < Math.min(count, pool.length); i++) {
    const targetRarity = pickRarity();
    const rarityPool = poolByRarity[targetRarity] || pool;

    // Try to find an unpicked item of the target rarity
    let available = rarityPool.filter(item => !pickedIds.has(item.id));
    if (available.length === 0) {
      // Fall back to any unpicked item
      available = pool.filter(item => !pickedIds.has(item.id));
    }
    if (available.length === 0) break;

    const selected = available[Math.floor(Math.random() * available.length)];
    picked.push(selected);
    pickedIds.add(selected.id);
  }

  // Clear old generated set, write new one
  await set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${marker.id}/generatedInventory`),
    Object.fromEntries(picked.map(i => [i.id, true]))
  );
}

// Items eligible for this shop based on its type tags (custom tags override defaults)
function getShopPool(marker) {
  const typeTags = (marker.inventoryTags && parseTags(marker.inventoryTags).length > 0)
    ? parseTags(marker.inventoryTags)
    : (SHOP_TYPE_TAGS[marker.type] || []);
  if (typeTags.length === 0) return [];
  return globalItems.filter(item => parseTags(item.tags).some(t => typeTags.includes(t)));
}

function getShopItems(marker) {
  const generatedIds = marker.generatedInventory || {};
  const manualIds    = marker.inventory || {};

  const hasSeed   = Object.keys(generatedIds).length > 0;
  const hasManual = Object.keys(manualIds).length > 0;

  // Return empty until inventory is explicitly generated or manually set
  if (!hasSeed && !hasManual) return [];

  const allIds = new Set([...Object.keys(generatedIds), ...Object.keys(manualIds)]);
  return globalItems.filter(i => allIds.has(i.id));
}

function getItemRarity(item) {
  if (item.rarity) return item.rarity;
  const tags = parseTags(item.tags);
  for (const r of ["legendary", "very rare", "rare", "uncommon", "common"]) {
    if (tags.includes(r)) return r;
  }
  return "common";
}

function renderShopInventory(marker) {
  shInventory.innerHTML = "";

  let items = getShopItems(marker);

  // Apply rarity filter
  if (shopRarityFilter !== "all") {
    items = items.filter(i => parseTags(i.tags).includes(shopRarityFilter));
  }

  if (items.length === 0) {
    const hasInventory = Object.keys(marker.generatedInventory || {}).length > 0 || Object.keys(marker.inventory || {}).length > 0;
    let msg;
    if (!hasInventory) {
      msg = isAdmin
        ? 'No inventory yet. Press "Generate Inventory" to stock this place.'
        : 'Nothing for sale here yet.';
    } else {
      msg = 'No items match this filter.';
    }
    shInventory.innerHTML = `<p class="shop-empty">${msg}</p>`;
    return;
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  items.forEach(item => {
    const price = shopPrice(item.price, marker.id, item.id);
    const tags  = getDisplayTags(item.tags);
    const rarity = getItemRarity(item);
    const rarityColor = RARITY_COLORS[rarity] || "#9e9e9e";

    const rarityClass = rarity ? "rarity-" + rarity.replace(" ", "-") : "";
    const row = document.createElement("div");
    row.className = `shop-item-row${rarityClass ? " " + rarityClass : ""}`;
    row.innerHTML = `
      <div class="shop-item-header">
        <div class="shop-item-rarity-dot ${rarityClass}" style="background-color: ${rarityColor}" title="${rarity}"></div>
        <div class="shop-item-name">${item.name}</div>
      </div>
      ${tags.length ? `<div class="shop-item-tags">${tags.map(t => { const rc = {"common":"rarity-tag-common","uncommon":"rarity-tag-uncommon","rare":"rarity-tag-rare","very rare":"rarity-tag-very-rare","legendary":"rarity-tag-legendary"}[t]; return `<span class="item-tag${rc ? " " + rc : ""}">${t}</span>`; }).join("")}</div>` : ""}
      ${item.description ? `<div class="shop-item-desc">${item.description}</div>` : ""}
      <div class="shop-item-price">${formatGold(price)}</div>
      ${isAdmin ? `<button class="shop-give-btn" title="Give to player">+</button>` : ""}
    `;

    // Click to toggle description (but not on the give button)
    row.addEventListener("click", e => {
      if (e.target.closest(".shop-give-btn")) return;
      row.classList.toggle("description-visible");
    });

    if (isAdmin) {
      const giveBtn = row.querySelector(".shop-give-btn");
      giveBtn.addEventListener("click", e => {
        e.stopPropagation();
        openGivePanel(giveBtn, {
          name:        item.name,
          type:        item.type || "misc",
          description: item.description || null,
          quantity:    1,
          value:       item.price ? String(item.price) : null,
          rarity:      item.rarity || null,
          tags:        item.tags || null,
          id:          item.id,
        });
      });
    }

    shInventory.appendChild(row);
  });
}

// ── Tavern Generation & Rendering ─────────────────────────────────────────────
async function generateTavernSeating(marker, dayTime = true) {
  const tableCount    = marker.tavernTables || 6;
  const BAR_SEATS     = 4;
  // Night: busier — more bar occupancy, more seats per table, more travelers
  const barFillRate   = dayTime ? 0.45 : 0.82;
  const travelerPct   = dayTime ? 0.05 : 0.09;
  const maxSeatsTable = dayTime ? 3    : 4;

  // Exclude owner + servants from patron pool
  const excluded = new Set([
    ...(marker.servants || []),
    ...(marker.ownerId ? [marker.ownerId] : [])
  ]);
  const localPool = [...npcs].filter(n => !excluded.has(n.id));
  for (let i = localPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [localPool[i], localPool[j]] = [localPool[j], localPool[i]];
  }

  const totalSlots    = BAR_SEATS + tableCount * maxSeatsTable;
  const travelerCount = Math.max(1, Math.round(totalSlots * travelerPct));
  const localCount    = Math.min(localPool.length, totalSlots - travelerCount);

  // Bar
  let localIdx = 0;
  const barSlots = [];
  for (let i = 0; i < BAR_SEATS; i++) {
    if (localIdx < localCount && Math.random() < barFillRate) {
      barSlots.push({ npcId: localPool[localIdx++].id });
    } else if (Math.random() < travelerPct * 4) {
      barSlots.push({ traveler: generateOneNpc() });
    } else {
      barSlots.push(null);
    }
  }

  // Tables
  const tableSlots = [];
  for (let t = 0; t < tableCount; t++) {
    const minSeats   = dayTime ? 0 : 1;
    const seatsCount = minSeats + Math.floor(Math.random() * maxSeatsTable);
    const seats = [];
    for (let s = 0; s < seatsCount; s++) {
      if (localIdx < localCount) {
        seats.push({ npcId: localPool[localIdx++].id });
      } else if (Math.random() < travelerPct * 2) {
        seats.push({ traveler: generateOneNpc() });
      }
    }
    if (seats.length > 0) tableSlots.push(seats);
  }

  // ── Room occupancy ────────────────────────────────────────────────────────
  const roomCount = marker.roomCount || 0;
  const rooms = [];
  if (roomCount > 0) {
    // Collect all placed patrons, keeping travelers and locals separate
    const allPlaced  = [...barSlots.filter(s => s !== null), ...tableSlots.flat()];
    const travelers  = allPlaced.filter(s => s.traveler);
    const locals     = allPlaced.filter(s => s.npcId);

    // Shuffle locals so we pick random ones, not always the first
    for (let i = locals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [locals[i], locals[j]] = [locals[j], locals[i]];
    }

    // Target occupancy: day 20-45 %, night 55-90 %
    const minOcc = dayTime ? 0.20 : 0.55;
    const maxOcc = dayTime ? 0.45 : 0.90;
    const targetGuests = Math.round(roomCount * (minOcc + Math.random() * (maxOcc - minOcc)));

    // Shuffle both pools independently
    for (let i = travelers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [travelers[i], travelers[j]] = [travelers[j], travelers[i]];
    }

    const guestPool = [];

    // 1. Locals who stayed too late and rented a room (bulk of occupancy)
    for (const local of locals) {
      if (guestPool.length >= targetGuests) break;
      guestPool.push(local);
    }

    // 2. Travelers from the tavern always need a room (far from home)
    for (const t of travelers) {
      if (guestPool.length >= targetGuests) break;
      guestPool.push(t);
    }

    // 3. Extra bed-only travelers only if locals + seated travelers didn't fill the target
    const maxBedOnly = Math.max(0, Math.ceil(targetGuests * 0.35));
    let bedOnlyAdded = 0;
    while (guestPool.length < targetGuests && bedOnlyAdded < maxBedOnly) {
      guestPool.push({ traveler: generateOneNpc() });
      bedOnlyAdded++;
    }

    // Shuffle final pool so room numbers are mixed (not always locals first)
    for (let i = guestPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [guestPool[i], guestPool[j]] = [guestPool[j], guestPool[i]];
    }

    for (let i = 0; i < roomCount; i++) {
      rooms.push(i < guestPool.length ? guestPool[i] : null);
    }
  }

  const seating = { bar: barSlots, tables: tableSlots, rooms };
  await set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${marker.id}/seating`), seating);
  return seating;
}

function showNpcPopup(npc, isLocal, anchor) {
  document.querySelectorAll(".npc-info-popup").forEach(p => p.remove());

  const popup = document.createElement("div");
  popup.className = "npc-info-popup";

  const sub = [npc.race, !isLocal ? "Traveler" : null, npc.role, npc.age ? `Age ${npc.age}` : null]
    .filter(Boolean).join(" · ");

  popup.innerHTML = `
    <button class="npc-popup-close">&times;</button>
    <div class="npc-popup-name">${npc.name}</div>
    ${sub ? `<div class="npc-popup-sub">${sub}</div>` : ""}
    ${npc.description ? `<p class="npc-popup-desc">${npc.description}</p>` : ""}
    ${npc.notes && isAdmin ? `<div class="npc-popup-notes"><iconify-icon icon="lucide:lock"></iconify-icon> ${npc.notes}</div>` : ""}
  `;

  document.body.appendChild(popup);

  const aRect = anchor.getBoundingClientRect();
  const pw    = 270;
  let left    = Math.min(aRect.left, window.innerWidth - pw - 12);
  left = Math.max(left, 8);
  popup.style.cssText = `position:fixed;left:${left}px;top:${aRect.bottom + 8}px;width:${pw}px;z-index:600;`;

  requestAnimationFrame(() => {
    const pr = popup.getBoundingClientRect();
    if (pr.bottom > window.innerHeight - 12) {
      popup.style.top = Math.max(8, aRect.top - pr.height - 8) + "px";
    }
  });

  popup.querySelector(".npc-popup-close").addEventListener("click", e => {
    e.stopPropagation();
    popup.remove();
  });
  const close = ev => {
    if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener("click", close); }
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

function renderNpcChip(seat) {
  if (!seat) return null;
  const div = document.createElement("div");
  div.style.cursor = "pointer";
  div.title = "Click for details";

  let npcData = null;
  let isLocal = false;

  if (seat.npcId) {
    const npc = npcs.find(n => n.id === seat.npcId);
    if (!npc) return null;
    // Exclude tavern staff (servants/waiters and owner) — they are working, not seated as patrons
    const excluded = new Set([
      ...(currentTavernMarker?.servants || []),
      ...(currentTavernMarker?.ownerId ? [currentTavernMarker.ownerId] : [])
    ]);
    if (excluded.has(seat.npcId)) return null;
    npcData = npc;
    isLocal = true;
    div.className = "npc-chip local";
    div.innerHTML = `
      <iconify-icon icon="lucide:user" class="npc-chip-icon"></iconify-icon>
      <span class="npc-chip-name">${npc.name}</span>
      <span class="npc-chip-role">${[npc.race, npc.role].filter(Boolean).join(" · ")}</span>
    `;
  } else if (seat.traveler) {
    npcData = seat.traveler;
    div.className = "npc-chip traveler";
    div.innerHTML = `
      <div class="npc-chip-header-row">
        <span class="npc-chip-name">${seat.traveler.name}</span>
        <span class="npc-chip-traveler-tag">Traveler</span>
      </div>
      <span class="npc-chip-role">${[seat.traveler.race, seat.traveler.role].filter(Boolean).join(" · ")}</span>
    `;
  }

  if (npcData) {
    div.addEventListener("click", e => { e.stopPropagation(); showNpcPopup(npcData, isLocal, div); });
  }
  return div;
}

function renderSeating(marker) {
  shTavernSeating.innerHTML = "";
  const seating = marker.seating;

  if (!seating) {
    shTavernSeating.innerHTML = isAdmin
      ? `<p class="shop-empty">No patrons yet. Press "Generate Patrons" to fill the tavern.</p>`
      : `<p class="shop-empty">The tavern is quiet.</p>`;
    return;
  }

  const container = document.createElement("div");

  // Bar
  const filledBarSlots = (seating.bar || []).filter(s => s !== null);
  if (filledBarSlots.length > 0) {
    const barDiv = document.createElement("div");
    barDiv.className = "tavern-bar";
    barDiv.innerHTML = `<div class="tavern-bar-title"><iconify-icon icon="lucide:wine"></iconify-icon> Bar</div>`;
    const barSeats = document.createElement("div");
    barSeats.className = "tavern-bar-seats";
    filledBarSlots.forEach(slot => {
      const chip = renderNpcChip(slot);
      if (chip) barSeats.appendChild(chip);
    });
    barDiv.appendChild(barSeats);
    container.appendChild(barDiv);
  }

  // Tables
  const tables = seating.tables || [];
  if (tables.length > 0) {
    const tablesTitle = document.createElement("div");
    tablesTitle.className = "tavern-bar-title";
    tablesTitle.style.marginTop = "10px";
    tablesTitle.innerHTML = '<iconify-icon icon="lucide:table-2"></iconify-icon> Tables';
    container.appendChild(tablesTitle);

    const grid = document.createElement("div");
    grid.className = "tavern-tables-grid";

    tables.forEach((tableSeats, idx) => {
      if (!tableSeats || tableSeats.length === 0) return;
      const card = document.createElement("div");
      card.className = "tavern-table-card";
      card.innerHTML = `<div class="tavern-table-label">Table ${idx + 1}</div>`;
      const seatCol = document.createElement("div");
      seatCol.className = "tavern-table-seats";
      tableSeats.forEach(seat => {
        const chip = renderNpcChip(seat);
        if (chip) seatCol.appendChild(chip);
      });
      if (seatCol.children.length > 0) {
        card.appendChild(seatCol);
        grid.appendChild(card);
      }
    });

    if (grid.children.length > 0) container.appendChild(grid);
  }

  if (container.children.length === 0) {
    shTavernSeating.innerHTML = isAdmin
      ? `<p class="shop-empty">No patrons yet. Press "Generate Patrons".</p>`
      : `<p class="shop-empty">The tavern is quiet.</p>`;
  } else {
    shTavernSeating.appendChild(container);
  }
}

function getRoomPrice(marker, rooms) {
  const baseGp = { "Poor": 0.5, "Middle Class": 1.0, "Rich": 3.0 }[marker.tavernWealth || "Middle Class"] ?? 1.0;
  const total    = marker.roomCount || 0;
  if (total === 0) return baseGp;
  const occupied  = rooms.filter(r => r !== null).length;
  const occupancy = occupied / total;
  const surge = occupancy >= 0.9 ? 1.7 : occupancy >= 0.7 ? 1.4 : occupancy >= 0.5 ? 1.2 : 1.0;
  return Math.round(baseGp * surge * 100) / 100;
}

function renderRooms(marker) {
  const roomCount = marker.roomCount || 0;
  if (roomCount === 0) { shTavernRooms.style.display = "none"; return; }

  const rooms    = marker.seating?.rooms || [];
  const occupied = rooms.filter(r => r !== null).length;
  const price    = getRoomPrice(marker, rooms);
  const occupancy = roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0;

  const surgeLabel = occupancy >= 90 ? " · High demand!" : occupancy >= 70 ? " · Busy" : "";
  shTavernRooms.style.display = "";
  shRoomsStatus.innerHTML = `${formatGold(price)}/night · ${occupied}/${roomCount} occupied${surgeLabel}`;
  shRoomsStatus.className = "rooms-status-badge" + (occupancy >= 90 ? " surge" : occupancy >= 70 ? " busy" : "");

  shRoomsGrid.innerHTML = "";
  for (let i = 0; i < roomCount; i++) {
    const room = rooms[i] ?? null;
    const card = document.createElement("div");

    if (room?.npcId) {
      const npc = npcs.find(n => n.id === room.npcId);
      card.className = "room-card occupied";
      card.innerHTML = `
        <div class="room-num">Room ${i + 1}</div>
        <div class="room-guest"><iconify-icon icon="lucide:user"></iconify-icon> ${npc ? npc.name : "Unknown"}</div>
        ${npc ? `<div class="room-guest-sub">${[npc.race, npc.role].filter(Boolean).join(" · ")}</div>` : ""}
      `;
    } else if (room?.traveler) {
      const t = room.traveler;
      card.className = "room-card occupied traveler-room";
      card.innerHTML = `
        <div class="room-num">Room ${i + 1} <span class="room-traveler-tag">Traveler</span></div>
        <div class="room-guest"><iconify-icon icon="lucide:user"></iconify-icon> ${t.name}</div>
        <div class="room-guest-sub">${[t.race, t.role].filter(Boolean).join(" · ")}</div>
      `;
    } else {
      card.className = "room-card vacant";
      card.innerHTML = `
        <div class="room-num">Room ${i + 1}</div>
        <div class="room-vacant-label"><iconify-icon icon="lucide:check"></iconify-icon> Vacant</div>
      `;
    }

    card.addEventListener("click", e => {
      if ((room?.npcId || room?.traveler)) {
        e.stopPropagation();
        const npcData = room.npcId ? npcs.find(n => n.id === room.npcId) : room.traveler;
        if (npcData) showNpcPopup(npcData, !!room.npcId, card);
      }
    });

    shRoomsGrid.appendChild(card);
  }
}

function renderMenuSection(items, wealth) {
  const mult = TAVERN_WEALTH_MULT[wealth] || 1.0;
  return items.map(item => {
    const priceGp = (item.basePriceCp * mult) / 100;
    return `<div class="tavern-menu-item">
      <span class="tavern-menu-name">${item.name}</span>
      <span class="tavern-menu-price">${formatGold(priceGp)}</span>
    </div>`;
  }).join("");
}

function renderTavernView(marker) {
  const wealth      = marker.tavernWealth || "Middle Class";
  const wealthClass = wealth === "Poor" ? "poor" : wealth === "Rich" ? "rich" : "middle";

  // Meta row
  const timeLabel = isDayTime ? '<iconify-icon icon="lucide:sun"></iconify-icon> Day' : '<iconify-icon icon="lucide:moon"></iconify-icon> Night';
  shTavernMeta.innerHTML = `
    <span class="tavern-wealth-badge ${wealthClass}">${wealth}</span>
    <span class="tavern-tables-badge"><iconify-icon icon="lucide:table-2"></iconify-icon> ${marker.tavernTables || 6} tables</span>
    <span class="tavern-time-badge ${isDayTime ? "day" : "night"}">${timeLabel}</span>
  `;

  // Staff
  const servantNpcs = (marker.servants || []).map(id => npcs.find(n => n.id === id)).filter(Boolean);
  if (servantNpcs.length > 0) {
    shTavernServants.style.display = "";
    shTavernServants.innerHTML = `<div class="tavern-servants-title">Staff on Duty</div>`;
    const staffRow = document.createElement("div");
    staffRow.className = "tavern-staff-cards";
    servantNpcs.forEach(n => {
      const card = document.createElement("div");
      card.className = "tavern-staff-card";
      card.innerHTML = `
        <iconify-icon icon="lucide:user" class="staff-card-icon"></iconify-icon>
        <div class="staff-card-info">
          <div class="staff-card-name">${n.name}</div>
          <div class="staff-card-role">${n.role || "Staff"}${n.race ? ` · ${n.race}` : ""}</div>
        </div>
      `;
      staffRow.appendChild(card);
    });
    shTavernServants.appendChild(staffRow);
  } else {
    shTavernServants.innerHTML = "";
    shTavernServants.style.display = "none";
  }

  // Actions: day/night toggle + generate button
  const actionsDiv = shTavernSection.querySelector(".sh-tavern-actions");
  actionsDiv.innerHTML = "";

  const toggleWrap = document.createElement("div");
  toggleWrap.className = "daynight-toggle";

  const dayBtn = document.createElement("button");
  dayBtn.className = "daynight-btn" + (isDayTime ? " active" : "");
  dayBtn.innerHTML = '<iconify-icon icon="lucide:sun"></iconify-icon> Day';

  const nightBtn = document.createElement("button");
  nightBtn.className = "daynight-btn" + (!isDayTime ? " active" : "");
  nightBtn.innerHTML = '<iconify-icon icon="lucide:moon"></iconify-icon> Night';

  dayBtn.onclick = () => {
    if (isDayTime) return;
    isDayTime = true;
    dayBtn.classList.add("active");
    nightBtn.classList.remove("active");
    shopModalBox.classList.remove("night-mode");
    renderTavernView(currentTavernMarker);
  };
  nightBtn.onclick = () => {
    if (!isDayTime) return;
    isDayTime = false;
    nightBtn.classList.add("active");
    dayBtn.classList.remove("active");
    shopModalBox.classList.add("night-mode");
    renderTavernView(currentTavernMarker);
  };

  toggleWrap.appendChild(dayBtn);
  toggleWrap.appendChild(nightBtn);
  actionsDiv.appendChild(toggleWrap);

  if (isAdmin) {
    shTavernGenBtn.style.display = "inline-block";
    shTavernGenBtn.innerHTML = '<iconify-icon icon="lucide:zap"></iconify-icon> Generate Patrons';
    shTavernGenBtn.onclick = async () => {
      shTavernGenBtn.disabled  = true;
      shTavernGenBtn.innerHTML = "Generating&#8230;";
      const seating = await generateTavernSeating(currentTavernMarker, isDayTime);
      const updated = { ...currentTavernMarker, seating };
      renderSeating(updated);
      renderRooms(updated);
      shTavernGenBtn.disabled  = false;
      shTavernGenBtn.innerHTML = '<iconify-icon icon="lucide:zap"></iconify-icon> Generate Patrons';
    };
    actionsDiv.appendChild(shTavernGenBtn);
  } else {
    shTavernGenBtn.style.display = "none";
  }

  // Seating
  renderSeating(marker);

  // Rooms
  renderRooms(marker);

  // Menu — race-themed, split into Drinks and Foods
  const raceKey  = resolveRaceMenu(markerData?.mainRace || null);
  const menu     = RACE_MENUS[raceKey] || RACE_MENUS.Human;
  shTavernMenu.innerHTML = `
    <div class="tavern-menu-category">
      <div class="tavern-menu-cat-title"><iconify-icon icon="lucide:wine"></iconify-icon> Drinks</div>
      <div class="tavern-menu-grid">${renderMenuSection(menu.drinks, wealth)}</div>
    </div>
    <div class="tavern-menu-category">
      <div class="tavern-menu-cat-title"><iconify-icon icon="lucide:utensils"></iconify-icon> Food</div>
      <div class="tavern-menu-grid">${renderMenuSection(menu.foods, wealth)}</div>
    </div>
  `;
  if (raceKey !== "Human") {
    const label = document.createElement("div");
    label.className = "tavern-menu-race-label";
    label.textContent = `${raceKey} cuisine`;
    shTavernMenu.prepend(label);
  }
}

function openShopModal(marker) {
  // DM edit button
  const shEditBtn = document.getElementById("sh-edit-btn");
  if (shEditBtn) {
    shEditBtn.style.display = isAdmin ? "inline-flex" : "none";
    if (isAdmin) shEditBtn.onclick = () => { closeShopModal(); openSubMarkerModal(marker.id); };
  }

  // DM persist toggle
  const shPersistBtn = document.getElementById("sh-persist-btn");
  if (shPersistBtn) {
    if (isAdmin && INVENTORY_TYPES.has(marker.type)) {
      shPersistBtn.style.display = "inline-flex";
      const updatePersistBtn = (persisted) => {
        shPersistBtn.innerHTML = persisted ? '<iconify-icon icon="lucide:pin"></iconify-icon> Pinned' : '<iconify-icon icon="lucide:pin"></iconify-icon> Pin Shop';
        shPersistBtn.classList.toggle("sh-persist-active", !!persisted);
        shPersistBtn.title = persisted
          ? "Shop is pinned — inventory won't be overwritten. Click to unpin."
          : "Pin shop — locks inventory across sessions so Generate won't overwrite it.";
      };
      updatePersistBtn(marker.persisted);
      shPersistBtn.onclick = async () => {
        const next = !marker.persisted;
        await set(ref(db, `campaigns/${cid}/locations/${locationId}/subMarkers/${marker.id}/persisted`), next);
        marker.persisted = next;
        updatePersistBtn(next);
        // Also update generate button state
        shGenerateBtn.disabled = next;
        shGenerateBtn.title = next ? "Unpin the shop to allow regenerating inventory" : "";
      };
    } else {
      shPersistBtn.style.display = "none";
    }
  }

  // Header
  shTypeDot.style.background = TYPE_COLORS[marker.type] || "#BDBDBD";
  shName.textContent = marker.name;
  shMeta.innerHTML   = `<span class="shop-type-badge">${markerDisplayType(marker)}${marker.shopSubtype ? ` · ${marker.shopSubtype}` : ""}</span>`;

  // Owner — show to everyone
  const owner = marker.ownerId ? npcs.find(n => n.id === marker.ownerId) : null;
  if (owner) {
    const subtitle = [owner.race, owner.role].filter(Boolean).join(" · ");
    shOwner.innerHTML = `
      <div class="shop-owner-info">
        <iconify-icon icon="lucide:user" class="shop-owner-icon"></iconify-icon>
        <div>
          <div class="shop-owner-name">${owner.name}</div>
          ${subtitle ? `<div class="shop-owner-sub">${subtitle}</div>` : ""}
        </div>
      </div>
    `;
  } else {
    shOwner.innerHTML = "";
  }

  // Building notes/description — show to everyone
  const shNotes = document.getElementById("sh-notes");
  if (shNotes) {
    if (marker.notes) { shNotes.textContent = marker.notes; shNotes.style.display = ""; }
    else              { shNotes.style.display = "none"; }
  }

  // Tavern section — DM sees full detail, players see only a hint
  const isTavern = marker.type === "Tavern";
  const shTavernPlayer = document.getElementById("sh-tavern-player");
  if (isTavern) {
    if (isAdmin) {
      shTavernSection.style.display = "";
      if (shTavernPlayer) shTavernPlayer.style.display = "none";
      currentTavernMarker = marker;
      shopModalBox.classList.toggle("night-mode", !isDayTime);
      renderTavernView(marker);
    } else {
      shTavernSection.style.display = "none";
      if (shTavernPlayer) shTavernPlayer.style.display = "";
      shopModalBox.classList.remove("night-mode");
    }
  } else {
    shTavernSection.style.display = "none";
    if (shTavernPlayer) shTavernPlayer.style.display = "none";
    shopModalBox.classList.remove("night-mode");
  }

  // Library section
  const isLibrary = marker.type === "Library";
  document.getElementById("sh-library-section").style.display = isLibrary ? "" : "none";
  if (isLibrary) renderLibrarySection();

  // Inventory section — DM only
  const hasInventoryUI = INVENTORY_TYPES.has(marker.type);
  shInventorySection.style.display = (hasInventoryUI && isAdmin) ? "" : "none";

  if (hasInventoryUI && isAdmin) {
    // Rarity filter
    shopRarityFilter = "all";
    shRarityFilter.querySelectorAll(".rarity-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.rarity === "all");
      btn.onclick = () => {
        shRarityFilter.querySelectorAll(".rarity-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        shopRarityFilter = btn.dataset.rarity;
        renderShopInventory(marker);
      };
    });

    // Generate inventory button — disabled when pinned
    if (getShopPool(marker).length > 0) {
      shGenerateBtn.style.display = "inline-block";
      shGenerateBtn.disabled = !!marker.persisted;
      shGenerateBtn.title = marker.persisted ? "Unpin the shop to allow regenerating inventory" : "";
      shGenerateBtn.onclick = async () => {
        if (marker.persisted) return;
        shGenerateBtn.disabled = true;
        shGenerateBtn.textContent = "Generating…";
        await generateShopInventory(marker);
        const updated = subMarkers.find(m => m.id === marker.id) || marker;
        renderShopInventory(updated);
        shGenerateBtn.disabled = false;
        shGenerateBtn.innerHTML = '<iconify-icon icon="lucide:zap"></iconify-icon> Generate Inventory';
      };
    } else {
      shGenerateBtn.style.display = "none";
    }

    renderShopInventory(marker);
  }

  shopModal.classList.add("open");
}

function closeShopModal() {
  shopModal.classList.remove("open");
}

// ── Library Section ───────────────────────────────────────────────────────────
let libFilter = "all";

function renderLibrarySection() {
  const grid      = document.getElementById("sh-library-grid");
  const countEl   = document.getElementById("sh-library-count");
  const emptyEl   = document.getElementById("sh-library-empty");
  const filterTabs = document.getElementById("lib-filter-tabs");

  // Wire up filter tabs (only once by checking dataset flag)
  if (!filterTabs.dataset.wired) {
    filterTabs.dataset.wired = "1";
    filterTabs.querySelectorAll(".lib-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        filterTabs.querySelectorAll(".lib-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        libFilter = btn.dataset.filter;
        renderLibrarySection();
      });
    });
  }

  const available = loreItems.filter(item => item.availableInLibrary);
  const filtered  = libFilter === "all" ? available : available.filter(i => i.type === libFilter);

  const books   = available.filter(i => i.type === "book").length;
  const scrolls = available.filter(i => i.type === "scroll").length;
  const parts   = [];
  if (books)   parts.push(`${books} book${books   !== 1 ? "s" : ""}`);
  if (scrolls) parts.push(`${scrolls} scroll${scrolls !== 1 ? "s" : ""}`);
  countEl.textContent = parts.length ? parts.join(" · ") : "";

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = `lib-card lib-card-${item.type}${item.discovered ? " lib-card-revealed" : ""}`;
    card.title = item.title + (item.writer ? ` — ${item.writer}` : "");

    const revealedBadge = item.discovered
      ? `<div class="lib-revealed-overlay" title="Revealed to party"><iconify-icon icon="lucide:check" class="lib-overlay-check"></iconify-icon><span class="lib-overlay-text">IN LORE</span></div>`
      : "";

    if (item.type === "book") {
      const color = item.coverColor || "#8b4513";
      card.innerHTML = `
        <div class="lib-book-cover" style="--cover-color:${color}">
          <div class="lib-book-spine"></div>
          <div class="lib-book-front">
            <div class="lib-book-title">${escLoc(item.title || "")}</div>
            ${item.writer ? `<div class="lib-book-writer">${escLoc(item.writer)}</div>` : ""}
          </div>
        </div>
        ${revealedBadge}
        <div class="lib-card-label">${escLoc(item.title || "")}</div>
      `;
    } else {
      card.innerHTML = `
        <div class="lib-scroll-cover">
          <div class="lib-scroll-roll top"></div>
          <div class="lib-scroll-body">
            <div class="lib-scroll-title">${escLoc(item.title || "")}</div>
            ${item.writer ? `<div class="lib-scroll-writer">${escLoc(item.writer)}</div>` : ""}
          </div>
          <div class="lib-scroll-roll bottom"></div>
        </div>
        ${revealedBadge}
        <div class="lib-card-label">${escLoc(item.title || "")}</div>
      `;
    }

    // Click on the visual part opens the reader
    const visual = card.querySelector(".lib-book-cover, .lib-scroll-cover");
    if (visual) visual.addEventListener("click", () => openLibraryReader(item));

    // Admin: reveal/unreveal button
    if (isAdmin) {
      const revealBtn = document.createElement("button");
      revealBtn.className = item.discovered
        ? "lib-reveal-btn lib-reveal-btn-done"
        : "lib-reveal-btn";
      revealBtn.innerHTML = item.discovered ? '<iconify-icon icon="lucide:check"></iconify-icon> In Lore' : '<iconify-icon icon="lucide:plus"></iconify-icon> Reveal';
      revealBtn.title = item.discovered
        ? "Click to hide from party's lore journal"
        : "Mark as discovered — party will see this in their Lore tab";
      revealBtn.addEventListener("click", e => {
        e.stopPropagation();
        const newDiscovered = !item.discovered;
        set(ref(db, `campaigns/${cid}/lore/${item.id}/discovered`), newDiscovered);
        // Update local state immediately for instant visual feedback
        const localItem = loreItems.find(x => x.id === item.id);
        if (localItem) localItem.discovered = newDiscovered;
        renderLibrarySection();
      });
      card.appendChild(revealBtn);
    }

    grid.appendChild(card);
  });
}

function escLoc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Library Reader ────────────────────────────────────────────────────────────
const libReader        = document.getElementById("lib-reader");
const libReaderClose   = document.getElementById("lib-reader-close");
const libReaderBook    = document.getElementById("lib-reader-book");
const libReaderScroll  = document.getElementById("lib-reader-scroll");
const libReaderCover   = document.getElementById("lib-reader-cover");
const libReaderSpine   = document.getElementById("lib-reader-spine");
const libReaderCoverTitle  = document.getElementById("lib-reader-cover-title");
const libReaderCoverWriter = document.getElementById("lib-reader-cover-writer");
const libReaderPageTitle   = document.getElementById("lib-reader-page-title");
const libReaderPageContent = document.getElementById("lib-reader-page-content");
const libReaderPageNum     = document.getElementById("lib-reader-page-num");
const libReaderPrev        = document.getElementById("lib-reader-prev");
const libReaderNext        = document.getElementById("lib-reader-next");
const libReaderScrollTitle   = document.getElementById("lib-reader-scroll-title");
const libReaderScrollWriter  = document.getElementById("lib-reader-scroll-writer");
const libReaderScrollContent = document.getElementById("lib-reader-scroll-content");

let libReaderPageIndex = 0;
let libReaderPages     = [];

function openLibraryReader(item) {
  libReaderBook.style.display   = "none";
  libReaderScroll.style.display = "none";

  if (item.type === "book") {
    const color = item.coverColor || "#8b4513";
    libReaderCover.style.setProperty("--cover-color", color);
    libReaderSpine.style.setProperty("--cover-color", color);
    libReaderCoverTitle.textContent  = item.title || "";
    libReaderCoverWriter.textContent = item.writer ? `by ${item.writer}` : "";

    libReaderPages = item.pages || [];
    if (libReaderPages.length === 0) libReaderPages = [{ title: "", content: "" }];
    libReaderPageIndex = 0;
    renderLibReaderPage();
    libReaderBook.style.display = "flex";
  } else {
    libReaderScrollTitle.textContent   = item.title || "";
    libReaderScrollWriter.textContent  = item.writer ? `by ${item.writer}` : "";
    libReaderScrollContent.textContent = item.content || "";
    libReaderScroll.style.display = "flex";
  }

  libReader.classList.add("open");
}

function renderLibReaderPage() {
  const page = libReaderPages[libReaderPageIndex] || {};
  libReaderPageTitle.textContent   = page.title || "";
  libReaderPageContent.textContent = page.content || "";
  libReaderPageNum.textContent     = `Page ${libReaderPageIndex + 1} of ${libReaderPages.length}`;
  libReaderPrev.disabled = libReaderPageIndex === 0;
  libReaderNext.disabled = libReaderPageIndex === libReaderPages.length - 1;
}

libReaderPrev.addEventListener("click", () => {
  if (libReaderPageIndex > 0) { libReaderPageIndex--; renderLibReaderPage(); }
});
libReaderNext.addEventListener("click", () => {
  if (libReaderPageIndex < libReaderPages.length - 1) { libReaderPageIndex++; renderLibReaderPage(); }
});

libReaderClose.addEventListener("click", () => libReader.classList.remove("open"));
libReader.addEventListener("click", e => { if (e.target === libReader) libReader.classList.remove("open"); });

shopClose.addEventListener("click", closeShopModal);
shopModal.addEventListener("click", e => { if (e.target === shopModal) closeShopModal(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
