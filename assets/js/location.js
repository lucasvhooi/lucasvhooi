import { db }                          from "./firebase.js";
import { ref, set, remove, onValue }  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { NPC_NAMES, AGE_RANGES, DEFAULT_PROFESSIONS, RACE_PROFESSIONS, RACE_BASE_WEIGHTS, ELF_SUBTYPE_WEIGHTS, NPC_TRAITS } from "./npc-data.js";
import { parseTags, formatGold }       from "./item-utils.js";

// ── Setup ─────────────────────────────────────────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const locationId = params.get("id");
const isAdmin    = localStorage.getItem("isAdmin") === "true";

if (!locationId) {
  document.getElementById("loc-title").textContent = "Location not found";
}

if (!isAdmin) document.body.classList.add("player-view");

// Firebase refs
const markerDbRef     = ref(db, `markers/${locationId}`);
const infoRef         = ref(db, `locations/${locationId}/info`);
const subMarkersRef   = ref(db, `locations/${locationId}/subMarkers`);
const npcsRef         = ref(db, `locations/${locationId}/npcs`);

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
onValue(ref(db, "items"), snapshot => {
  const data = snapshot.val();
  globalItems = data ? Object.values(data) : [];
});

// ── Render Hero ───────────────────────────────────────────────────────────────
function renderHero() {
  document.title = `${markerData.name} — DnD Campaign`;
  locTitle.textContent = markerData.name;

  const parts = [];
  if (markerData.type)       parts.push(`<span class="stat-badge">${markerData.type}</span>`);
  if (markerData.population) parts.push(`<span class="stat-badge">&#128100; ${markerData.population}</span>`);
  if (markerData.wealth)     parts.push(`<span class="stat-badge">&#128176; ${markerData.wealth}</span>`);
  if (markerData.mainRace)   parts.push(`<span class="stat-badge">&#127981; ${markerData.mainRace}</span>`);
  if (markerData.religion)   parts.push(`<span class="stat-badge">&#9763; ${markerData.religion}</span>`);
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
  Forge:  "#FF7043",
  Shop:   "#66BB6A",
  Tavern: "#FFA726",
  House:  "#78909C",
  Temple: "#CE93D8",
  Guard:  "#42A5F5",
  Market: "#FFEE58",
  Other:  "#BDBDBD"
};

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
      <div class="tooltip-name">${marker.name}</div>
      <div class="tooltip-type">${marker.type || "Other"}</div>
      ${ownerNpc ? `<div class="tooltip-owner">&#128100; ${ownerNpc.name}</div>` : ""}
      ${marker.notes && isAdmin ? `<div class="tooltip-notes">${marker.notes}</div>` : ""}
      <button class="tooltip-view-btn">View</button>
    `;
    tooltip.querySelector(".tooltip-view-btn").addEventListener("click", e => {
      e.stopPropagation();
      openShopModal(marker);
    });

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
        remove(ref(db, `locations/${locationId}/subMarkers/${marker.id}`));
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
const locMarkerModal = document.getElementById("loc-marker-modal");
const lmTitle        = document.getElementById("lm-title");
const lmName         = document.getElementById("lm-name");
const lmType         = document.getElementById("lm-type");
const lmOwner        = document.getElementById("lm-owner");
const lmNotes        = document.getElementById("lm-notes");
const lmError        = document.getElementById("lm-error");
const lmSave         = document.getElementById("lm-save");
const lmCancel       = document.getElementById("lm-cancel");

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

  if (id) {
    const m = subMarkers.find(m => m.id === id);
    lmTitle.textContent = "Edit Marker";
    lmName.value  = m.name  || "";
    lmType.value  = m.type  || "Forge";
    lmNotes.value = m.notes || "";
    populateOwnerSelect(m.ownerId || "");
  } else {
    lmTitle.textContent = "Place Marker";
    lmName.value = lmNotes.value = "";
    lmType.value = "Forge";
    populateOwnerSelect("");
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

  const id       = editingSubId || generateId();
  const existing = editingSubId ? subMarkers.find(m => m.id === editingSubId) : null;

  set(ref(db, `locations/${locationId}/subMarkers/${id}`), {
    id,
    name,
    type:       lmType.value,
    ownerId:    lmOwner.value || null,
    notes:      lmNotes.value.trim() || null,
    x:          existing ? existing.x : pendingCoords.x,
    y:          existing ? existing.y : pendingCoords.y,
    order:      existing ? (existing.order !== undefined ? existing.order : subMarkers.length) : subMarkers.length,
    discovered: existing?.discovered || false
  });

  closeSubMarkerModal();
});

lmCancel.addEventListener("click", closeSubMarkerModal);
locMarkerModal.addEventListener("click", e => { if (e.target === locMarkerModal) closeSubMarkerModal(); });

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
      <div class="building-drag-handle" title="Drag to reorder">&#9776;</div>
      <div class="building-dot" style="background:${color}"></div>
      <div class="building-info">
        <div class="building-name">${marker.name}</div>
        <div class="building-type">${marker.type || "Other"}${bOwner ? ` · ${bOwner.name}` : ""}</div>
        ${marker.notes ? `<div class="building-notes">${marker.notes}</div>` : ""}
      </div>
      <div class="building-card-actions">
        <button class="building-open-btn dm-btn dm-btn-sm" title="View shop">Open</button>
        <button class="building-vis-btn${marker.discovered ? " active" : ""}" title="${marker.discovered ? "Hide from players" : "Reveal to players"}">&#128065;</button>
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
      set(ref(db, `locations/${locationId}/subMarkers/${marker.id}/discovered`), !marker.discovered);
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
        set(ref(db, `locations/${locationId}/subMarkers/${c.dataset.id}/order`), idx);
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

  const sorted = [...npcs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

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
          <button class="npc-talk-btn${npc.talkedTo ? " active" : ""}" title="${npc.talkedTo ? "Mark as not talked to" : "Mark as talked to"}">&#10003;</button>
          <button class="marker-edit-btn dm-btn dm-btn-sm npc-edit-btn">Edit</button>
          <button class="marker-delete-btn dm-btn dm-btn-sm npc-del-btn">Del</button>
        </div>
      </div>
      ${npc.description ? `<p class="npc-desc">${npc.description}</p>` : ""}
      ${npc.notes ? `<div class="npc-notes">DM: ${npc.notes}</div>` : ""}
    `;

    card.querySelector(".npc-talk-btn").addEventListener("click", () => {
      set(ref(db, `locations/${locationId}/npcs/${npc.id}/talkedTo`), !npc.talkedTo);
    });
    card.querySelector(".npc-edit-btn").addEventListener("click", () => openNpcModal(npc.id));
    card.querySelector(".npc-del-btn").addEventListener("click",  () => remove(ref(db, `locations/${locationId}/npcs/${npc.id}`)));

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

  set(ref(db, `locations/${locationId}/npcs/${id}`), {
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
  set(ref(db, `locations/${locationId}/info/description`), ldText.value.trim() || null);
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
      await set(ref(db, `locations/${locationId}/info/mapImageUrl`), base64);
    } catch (err) {
      locMapPlaceholder.innerHTML = `<span style="color:#E57373">Upload failed. Try a smaller image.</span>`;
    }

    locMapUpload.value = "";
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

    // Build batch with deduplication — reroll if name already exists
    const usedNames = new Set(npcs.map(n => n.name));
    const batch = [];
    const baseTime = Date.now();
    for (let i = 0; i < count; i++) {
      let npc;
      let tries = 0;
      do {
        npc = generateOneNpc();
        tries++;
      } while (usedNames.has(npc.name) && tries < 25);
      usedNames.add(npc.name);
      npc.createdAt = baseTime + i;
      batch.push(npc);
    }

    try {
      await Promise.all(batch.map(npc =>
        set(ref(db, `locations/${locationId}/npcs/${npc.id}`), npc)
      ));
      genStatus.style.color = "#88cc88";
      genStatus.textContent = `✓ ${count} NPCs generated.`;
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
    remove(ref(db, `locations/${locationId}/npcs`));
    genStatus.style.color = "#aaa";
    genStatus.textContent = "All NPCs cleared.";
    setTimeout(() => { genStatus.textContent = ""; }, 3000);
  });
}

// ── Shop Modal ────────────────────────────────────────────────────────────────
const shopModal      = document.getElementById("shop-modal");
const shopClose      = document.getElementById("shop-close");
const shName         = document.getElementById("sh-name");
const shMeta         = document.getElementById("sh-meta");
const shOwner        = document.getElementById("sh-owner");
const shInventory    = document.getElementById("sh-inventory");
const shManage       = document.getElementById("sh-manage");
const shStockSearch  = document.getElementById("sh-stock-search");
const shStockList    = document.getElementById("sh-stock-list");
const shTypeDot      = document.getElementById("sh-type-dot");
const shRarityFilter = document.getElementById("sh-rarity-filter");
const shGenerateBtn  = document.getElementById("sh-generate-btn");

let shopStockQuery   = "";
let shopRarityFilter = "all";

// Which item tags each shop type automatically carries
const SHOP_TYPE_TAGS = {
  "Forge":   ["weapon", "melee", "armor", "shield", "ammunition", "tool", "forge"],
  "Shop":    ["adventuring", "potion", "tool", "light"],
  "Tavern":  ["food", "drink", "ale", "wine", "potion"],
  "Temple":  ["potion", "healing", "protection", "holy"],
  "Guard":   ["weapon", "melee", "ranged", "armor", "shield", "ammunition"],
  "Market":  ["adventuring", "food", "tool", "light"],
  "House":   [],
  "Other":   []
};

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
  const p = basePrice * mult;
  if (p >= 100) return Math.round(p);
  if (p >= 10)  return Math.round(p * 2) / 2;
  if (p >= 1)   return Math.round(p * 10) / 10;
  return Math.round(p * 100) / 100;
}

// Persist generated inventory for a shop (6–15 random items from its pool)
async function generateShopInventory(marker) {
  const pool = getShopPool(marker);
  if (pool.length === 0) return;

  const count = 6 + Math.floor(Math.random() * 10); // 6–15
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  // Clear old generated set, write new one
  await set(ref(db, `locations/${locationId}/subMarkers/${marker.id}/generatedInventory`),
    Object.fromEntries(picked.map(i => [i.id, true]))
  );
}

// Items eligible for this shop based on its type tags
function getShopPool(marker) {
  const typeTags = SHOP_TYPE_TAGS[marker.type] || [];
  if (typeTags.length === 0) return [];
  return globalItems.filter(item => parseTags(item.tags).some(t => typeTags.includes(t)));
}

function getShopItems(marker) {
  const generatedIds = marker.generatedInventory || {};
  const manualIds    = marker.inventory || {};

  // If a generated inventory exists, use it; otherwise fall back to full type pool
  const hasSeed = Object.keys(generatedIds).length > 0;
  let items;

  if (hasSeed) {
    const allIds = new Set([...Object.keys(generatedIds), ...Object.keys(manualIds)]);
    items = globalItems.filter(i => allIds.has(i.id));
  } else {
    const typeTags = SHOP_TYPE_TAGS[marker.type] || [];
    items = typeTags.length > 0
      ? globalItems.filter(item => parseTags(item.tags).some(t => typeTags.includes(t)))
      : [];

    // Merge any manually added extras
    const autoIds = new Set(items.map(i => i.id));
    Object.keys(manualIds).forEach(id => {
      if (!autoIds.has(id)) {
        const item = globalItems.find(i => i.id === id);
        if (item) items.push(item);
      }
    });
  }

  return items;
}

function renderShopInventory(marker) {
  shInventory.innerHTML = "";

  let items = getShopItems(marker);

  // Apply rarity filter
  if (shopRarityFilter !== "all") {
    items = items.filter(i => parseTags(i.tags).includes(shopRarityFilter));
  }

  if (items.length === 0) {
    shInventory.innerHTML = `<p class="shop-empty">${globalItems.length === 0 ? 'No items in the database yet. Add items on the Items page.' : 'No items match this filter.'}</p>`;
    return;
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  items.forEach(item => {
    const price = shopPrice(item.price, marker.id, item.id);
    const tags  = parseTags(item.tags);
    const row   = document.createElement("div");
    row.className = "shop-item-row";
    row.innerHTML = `
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        ${tags.length ? `<div class="shop-item-tags">${tags.map(t => `<span class="item-tag">${t}</span>`).join("")}</div>` : ""}
        ${item.description ? `<div class="shop-item-desc">${item.description}</div>` : ""}
      </div>
      <div class="shop-item-price">${formatGold(price)}</div>
    `;
    shInventory.appendChild(row);
  });
}

function renderStockList(marker) {
  shStockList.innerHTML = "";
  const manualIds  = marker.inventory || {};
  const typeTags   = SHOP_TYPE_TAGS[marker.type] || [];
  const autoIds    = new Set(
    typeTags.length > 0
      ? globalItems.filter(i => parseTags(i.tags).some(t => typeTags.includes(t))).map(i => i.id)
      : []
  );
  const q = shopStockQuery.toLowerCase();

  let filtered = [...globalItems];
  if (q) filtered = filtered.filter(i =>
    i.name.toLowerCase().includes(q) ||
    parseTags(i.tags).some(t => t.includes(q))
  );
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    shStockList.innerHTML = `<p class="shop-empty">No items found. Add items on the Items page.</p>`;
    return;
  }

  filtered.forEach(item => {
    const isAuto   = autoIds.has(item.id);
    const isManual = !!manualIds[item.id];
    const checked  = isAuto || isManual;
    const row = document.createElement("div");
    row.className = "stock-row" + (checked ? " in-stock" : "") + (isAuto ? " stock-auto" : "");
    row.innerHTML = `
      <label class="stock-label">
        <input type="checkbox" class="stock-check" ${checked ? "checked" : ""} ${isAuto ? "disabled" : ""} />
        <span class="stock-item-name">${item.name}</span>
        <span class="stock-item-price">${formatGold(item.price)} base</span>
        ${isAuto ? `<span class="stock-auto-badge">auto</span>` : ""}
      </label>
    `;
    if (!isAuto) {
      row.querySelector(".stock-check").addEventListener("change", e => {
        if (e.target.checked) {
          set(ref(db, `locations/${locationId}/subMarkers/${marker.id}/inventory/${item.id}`), true);
        } else {
          remove(ref(db, `locations/${locationId}/subMarkers/${marker.id}/inventory/${item.id}`));
        }
        row.classList.toggle("in-stock", e.target.checked);
      });
    }
    shStockList.appendChild(row);
  });
}

function openShopModal(marker) {
  // Header
  shTypeDot.style.background = TYPE_COLORS[marker.type] || "#BDBDBD";
  shName.textContent = marker.name;
  shMeta.innerHTML   = `<span class="shop-type-badge">${marker.type || "Other"}</span>`;

  // Owner
  const owner = marker.ownerId ? npcs.find(n => n.id === marker.ownerId) : null;
  if (owner) {
    const subtitle = [owner.race, owner.role].filter(Boolean).join(" · ");
    shOwner.innerHTML = `
      <div class="shop-owner-info">
        <span class="shop-owner-icon">&#128100;</span>
        <div>
          <div class="shop-owner-name">${owner.name}</div>
          ${subtitle ? `<div class="shop-owner-sub">${subtitle}</div>` : ""}
        </div>
      </div>
    `;
  } else {
    shOwner.innerHTML = "";
  }

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

  // Generate inventory button (DM only, only for shop types with a pool)
  if (isAdmin && (SHOP_TYPE_TAGS[marker.type] || []).length > 0) {
    shGenerateBtn.style.display = "inline-block";
    shGenerateBtn.onclick = async () => {
      shGenerateBtn.disabled = true;
      shGenerateBtn.textContent = "Generating…";
      await generateShopInventory(marker);
      // Firebase onValue will update marker; re-read from subMarkers
      const updated = subMarkers.find(m => m.id === marker.id) || marker;
      renderShopInventory(updated);
      renderStockList(updated);
      shGenerateBtn.disabled = false;
      shGenerateBtn.textContent = "⚡ Generate Inventory";
    };
  } else {
    shGenerateBtn.style.display = "none";
  }

  // Inventory
  renderShopInventory(marker);

  // DM stock management
  if (isAdmin) {
    shManage.style.display = "block";
    shopStockQuery = "";
    shStockSearch.value = "";
    renderStockList(marker);

    shStockSearch.oninput = e => {
      shopStockQuery = e.target.value;
      renderStockList(marker);
    };
  } else {
    shManage.style.display = "none";
  }

  shopModal.classList.add("open");
}

function closeShopModal() {
  shopModal.classList.remove("open");
  shopStockQuery = "";
}

shopClose.addEventListener("click", closeShopModal);
shopModal.addEventListener("click", e => { if (e.target === shopModal) closeShopModal(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
