// ── Firebase ──────────────────────────────────────────────────────────────────
import { db, storage }                            from "./firebase.js";
import { ref, set, remove, onValue }              from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject }
                                                  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getSession }                             from "./auth.js";

// ── Remember last location — redirect if user came back from a location ───────
const _savedLoc = sessionStorage.getItem("lastLocationId");
if (_savedLoc) {
  sessionStorage.setItem("mapRedirected", "1");
  sessionStorage.removeItem("lastLocationId");
  window.location.replace("location.html?id=" + _savedLoc);
}

// ── Transform State ──────────────────────────────────────────────────────────
let scale    = 1;
let minScale = 1;
let originX  = 0;
let originY  = 0;

const mapContainer = document.getElementById("map-container");
const mapWrapper   = document.getElementById("map-wrapper");
const mapImage     = document.getElementById("map-image");
const markerLayer  = document.getElementById("marker-layer");

mapImage.draggable = false;
mapImage.addEventListener("dragstart", e => e.preventDefault());

// ── Area + pen overlay layers — live inside the wrapper so they pan/zoom with
// the map. The SVG holds polygon fills/borders; HTML layers hold labels and the
// in-progress pen vertices (kept as HTML so they stay perfectly round). ────────
const SVG_NS = "http://www.w3.org/2000/svg";
const areaSvg = document.createElementNS(SVG_NS, "svg");
areaSvg.id = "area-layer";
areaSvg.setAttribute("viewBox", "0 0 100 100");
areaSvg.setAttribute("preserveAspectRatio", "none");

const penDrawGroup = document.createElementNS(SVG_NS, "g");
penDrawGroup.id = "pen-draw";
areaSvg.appendChild(penDrawGroup);

const areaLabelLayer = document.createElement("div");
areaLabelLayer.id = "area-label-layer";

const penLayer = document.createElement("div");
penLayer.id = "pen-layer";

mapWrapper.insertBefore(areaSvg, markerLayer);
mapWrapper.insertBefore(areaLabelLayer, markerLayer);
mapWrapper.insertBefore(penLayer, markerLayer);

// ── Cached values — read once, never pay layout cost again ───────────────────
let _cachedRect = { left: 0, top: 0, width: 0, height: 0 };
function _updateCachedRect() {
  _cachedRect = mapContainer.getBoundingClientRect();
}
requestAnimationFrame(_updateCachedRect);

// Natural image dimensions — set once when the image loads.
let _imgNW = 0, _imgNH = 0;

// ── Core transform ───────────────────────────────────────────────────────────
// All writes go through here — a single compositor-friendly property.
function updateTransform() {
  mapWrapper.style.transform = `translate3d(${originX}px,${originY}px,0) scale(${scale})`;
}

// Counter-scale: keep pins a constant screen size regardless of zoom.
// Written directly as an inline style on each marker element — avoids the
// CSS-variable cascade that forces a style recalc on every child simultaneously.
function flushCounterScale() {
  const t = `translate3d(-50%,-50%,0) scale(${1 / scale})`;
  _markerEls.forEach(({ el }) => { el.style.transform = t; });
  areaLabelLayer.querySelectorAll(".area-label").forEach(el => { el.style.transform = t; });
  penLayer.querySelectorAll(".pen-vertex").forEach(el => { el.style.transform = t; });
}

// Debounce flush 120 ms after the last wheel tick; re-enable pointer events.
let _wheelFlushTimer = 0;
function scheduleCounterScaleFlush() {
  clearTimeout(_wheelFlushTimer);
  _wheelFlushTimer = setTimeout(() => {
    flushCounterScale();
    markerLayer.classList.remove("gesturing");
  }, 120);
}

// rAF throttle — one DOM write per display frame, regardless of event rate.
let _rafPending = false;
function scheduleTransform() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => {
    clampToBounds();
    updateTransform();
    _rafPending = false;
  });
}

// ── Fit map to container ─────────────────────────────────────────────────────
function fitMapToContainer() {
  _updateCachedRect();
  if (!_imgNW || !_imgNH) return;

  const scaleX = _cachedRect.width  / _imgNW;
  const scaleY = _cachedRect.height / _imgNH;
  scale    = Math.max(scaleX, scaleY);
  minScale = scale;

  originX = (_cachedRect.width  - _imgNW * scale) / 2;
  originY = (_cachedRect.height - _imgNH * scale) / 2;

  clampToBounds();
  updateTransform();
  flushCounterScale();
}

// Image load — cache natural dimensions once, size wrapper once, then fit.
function _onImageLoad() {
  _imgNW = mapImage.naturalWidth;
  _imgNH = mapImage.naturalHeight;
  mapWrapper.style.width  = `${_imgNW}px`;
  mapWrapper.style.height = `${_imgNH}px`;
  _updateCachedRect();
  fitMapToContainer();
  mapImage.style.display = "block";
}

if (mapImage.complete && mapImage.naturalWidth) {
  _onImageLoad();
} else {
  mapImage.addEventListener("load", _onImageLoad);
}
mapImage.addEventListener("error", () => {
  _setMapUrl(null);
  _mapInitialized = false;
  _updateMapState();
});

// Throttle resize to one refit per frame — avoids flooding fitMapToContainer.
let _resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(fitMapToContainer);
}, { passive: true });

// ── Bounds clamp ─────────────────────────────────────────────────────────────
function clampToBounds() {
  if (!_imgNW) return;
  const minX = Math.min(0, _cachedRect.width  - _imgNW * scale);
  const minY = Math.min(0, _cachedRect.height - _imgNH * scale);
  originX = Math.min(0, Math.max(minX, originX));
  originY = Math.min(0, Math.max(minY, originY));
}

// ── Zoom quality ─────────────────────────────────────────────────────────────
// Switch to nearest-neighbour during active zoom; restore 150 ms after last event.
let _imgQualityTimer = 0;
function _setFastRendering()        { mapImage.style.imageRendering = "pixelated"; }
function _restoreRendering()        { mapImage.style.imageRendering = ""; }
function _scheduleRenderingRestore() {
  clearTimeout(_imgQualityTimer);
  _imgQualityTimer = setTimeout(_restoreRendering, 150);
}

// ── Wheel zoom ────────────────────────────────────────────────────────────────
mapContainer.addEventListener("wheel", function(e) {
  e.preventDefault();
  _setFastRendering();
  _scheduleRenderingRestore();

  // Suppress marker :hover recalcs for the duration of the wheel gesture.
  markerLayer.classList.add("gesturing");

  const zoomIntensity = 0.001;
  let newScale = scale * (1 - e.deltaY * zoomIntensity);
  newScale = Math.min(Math.max(newScale, minScale), 5);

  const mouseX = e.clientX - _cachedRect.left;
  const mouseY = e.clientY - _cachedRect.top;
  originX -= (mouseX - originX) * (newScale / scale - 1);
  originY -= (mouseY - originY) * (newScale / scale - 1);
  scale = newScale;

  scheduleTransform();
  scheduleCounterScaleFlush();
}, { passive: false });

// ── Pan (Desktop) ─────────────────────────────────────────────────────────────
let _isDragging = false;
let _didDrag    = false;
let _startX, _startY;

mapContainer.addEventListener("pointerdown", function(e) {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  if (e.target.closest("#map-empty-state")) return;
  _isDragging = true;
  _didDrag    = false;
  _startX = e.clientX;
  _startY = e.clientY;
  mapContainer.style.cursor = (placingMode || penMode) ? "crosshair" : "grabbing";
  mapContainer.setPointerCapture(e.pointerId);
  // Suppress marker hover recalcs while panning.
  markerLayer.classList.add("gesturing");
});

mapContainer.addEventListener("pointermove", function(e) {
  if (!_isDragging) return;
  const dx = e.clientX - _startX;
  const dy = e.clientY - _startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _didDrag = true;
  _startX = e.clientX;
  _startY = e.clientY;
  originX += dx;
  originY += dy;
  scheduleTransform();
}, { passive: true });

mapContainer.addEventListener("pointerup", function(e) {
  if (!_isDragging) return;
  _isDragging = false;
  markerLayer.classList.remove("gesturing");

  if (penMode && !_didDrag && isAdmin && e.pointerType === "mouse") {
    penClickAt(e.clientX - _cachedRect.left, e.clientY - _cachedRect.top);
    return;
  }

  if (placingMode && !_didDrag && isAdmin && e.pointerType === "mouse") {
    const clickX = e.clientX - _cachedRect.left;
    const clickY = e.clientY - _cachedRect.top;
    pendingCoords   = screenToPct(clickX, clickY);
    pendingCoords.x = Math.max(0, Math.min(100, pendingCoords.x));
    pendingCoords.y = Math.max(0, Math.min(100, pendingCoords.y));
    openPlaceModal();
    return;
  }

  mapContainer.style.cursor = (placingMode || penMode) ? "crosshair" : "grab";
});

// Rubber-band preview line following the cursor while drawing.
mapContainer.addEventListener("pointermove", function(e) {
  if (!penMode || e.pointerType !== "mouse") return;
  penCursor = { x: e.clientX - _cachedRect.left, y: e.clientY - _cachedRect.top };
  updatePenDraw();
}, { passive: true });

mapContainer.addEventListener("pointercancel", function() {
  _isDragging = false;
  mapContainer.style.cursor = (placingMode || penMode) ? "crosshair" : "grab";
  markerLayer.classList.remove("gesturing");
});

// ── Touch Support ─────────────────────────────────────────────────────────────
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  let _touchStartX = 0, _touchStartY = 0;
  let _isPinching  = false;
  let _initDist    = 0;
  let _initScale   = scale;

  function _dist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  mapContainer.addEventListener("touchstart", function(e) {
    if (e.target.closest("#location-panel")) return;
    if (e.target.closest("#map-empty-state")) return;
    _updateCachedRect();
    markerLayer.classList.add("gesturing");
    if (e.touches.length === 2) {
      _isPinching = true;
      _initDist   = _dist(e.touches[0], e.touches[1]);
      _initScale  = scale;
      _setFastRendering();
    } else if (e.touches.length === 1) {
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  mapContainer.addEventListener("touchmove", function(e) {
    if (e.target.closest("#location-panel")) return;
    if (e.target.closest("#map-empty-state")) return;
    e.preventDefault();
    if (_isPinching && e.touches.length === 2) {
      const newDist  = _dist(e.touches[0], e.touches[1]);
      let newScale   = _initScale * (newDist / _initDist);
      newScale       = Math.min(Math.max(newScale, minScale), 5);
      const midX     = (e.touches[0].clientX + e.touches[1].clientX) / 2 - _cachedRect.left;
      const midY     = (e.touches[0].clientY + e.touches[1].clientY) / 2 - _cachedRect.top;
      originX -= (midX - originX) * (newScale / scale - 1);
      originY -= (midY - originY) * (newScale / scale - 1);
      scale = newScale;
      scheduleTransform();
    } else if (e.touches.length === 1 && !_isPinching) {
      const cx = e.touches[0].clientX;
      const cy = e.touches[0].clientY;
      originX += cx - _touchStartX;
      originY += cy - _touchStartY;
      _touchStartX = cx;
      _touchStartY = cy;
      scheduleTransform();
    }
  }, { passive: false });

  function _onTouchDone() {
    _restoreRendering();
    markerLayer.classList.remove("gesturing");
    flushCounterScale();
  }

  mapContainer.addEventListener("touchcancel", _onTouchDone, { passive: true });

  mapContainer.addEventListener("touchend", function(e) {
    if (e.touches.length < 2) _isPinching = false;
    if (e.touches.length === 0) _onTouchDone();

    if (!placingMode && !_isPinching && e.changedTouches.length === 1) {
      if (!e.target.closest(".map-marker")) {
        document.querySelectorAll(".map-marker.active").forEach(m => m.classList.remove("active"));
      }
    }

    if ((placingMode || penMode) && isAdmin && !_isPinching && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      if (Math.abs(touch.clientX - _touchStartX) < 12 &&
          Math.abs(touch.clientY - _touchStartY) < 12) {
        const rect = mapContainer.getBoundingClientRect();
        if (penMode) {
          penClickAt(touch.clientX - rect.left, touch.clientY - rect.top);
        } else {
          pendingCoords   = screenToPct(touch.clientX - rect.left, touch.clientY - rect.top);
          pendingCoords.x = Math.max(0, Math.min(100, pendingCoords.x));
          pendingCoords.y = Math.max(0, Math.min(100, pendingCoords.y));
          openPlaceModal();
        }
      }
    }
  });
}

// ── Marker System ─────────────────────────────────────────────────────────────
const isAdmin = (() => {
  try { return JSON.parse(localStorage.getItem("playerSession"))?.role === "admin"; }
  catch { return false; }
})();

const session      = getSession();
const _cid         = session?.campaignId || "default";
const mapsRef      = ref(db, `campaigns/${_cid}/maps`);
const markersRef   = ref(db, `campaigns/${_cid}/markers`);
const countriesRef = ref(db, `campaigns/${_cid}/countries`);
let uploadedMaps   = [];
let _mapsModalOpen = false;
let _mapInitialized = false;

// Per-campaign localStorage key so switching campaigns doesn't carry over old maps
function _mapKey()       { return `currentMapUrl_${session?.campaignId || "default"}`; }
function _getMapUrl()    { return localStorage.getItem(_mapKey()); }
function _setMapUrl(url) { url ? localStorage.setItem(_mapKey(), url) : localStorage.removeItem(_mapKey()); }

function _updateMapState() {
  const emptyState  = document.getElementById("map-empty-state");
  const emptyDm     = document.getElementById("map-empty-dm");
  const emptyPlayer = document.getElementById("map-empty-player");

  if (uploadedMaps.length === 0) {
    _mapInitialized           = false;
    _setMapUrl(null);
    mapImage.style.display    = "none";
    emptyState.style.display  = "flex";
    emptyDm.style.display     = isAdmin ? "flex" : "none";
    emptyPlayer.style.display = isAdmin ? "none" : "flex";
    return;
  }

  emptyState.style.display = "none";

  if (!_mapInitialized) {
    _mapInitialized  = true;
    const savedUrl   = _getMapUrl();
    const validSaved = savedUrl && uploadedMaps.find(m => m.url === savedUrl);
    const urlToUse   = validSaved ? savedUrl : uploadedMaps[0].url;
    if (!validSaved) _setMapUrl(urlToUse);
    mapImage.src = urlToUse;
  }
}

onValue(mapsRef, snap => {
  uploadedMaps = snap.val()
    ? Object.values(snap.val()).sort((a, b) => b.timestamp - a.timestamp)
    : [];
  _updateMapState();
  if (_mapsModalOpen) _renderMapsGrid();
});

let markers       = [];
let countries     = [];
let placingMode   = false;
let pendingCoords = null;
let editingId     = null;

const COUNTRY_COLORS = [
  "#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c",
  "#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a",
  "#ff5722","#78909c"
];

// ── Marker Type Registry ──────────────────────────────────────────────────────
// Each type carries its own colour + icon. Built-ins ship with the app; DMs can
// add custom types stored under campaigns/{cid}/markerTypes.
const markerTypesRef = ref(db, `campaigns/${_cid}/markerTypes`);

const BUILTIN_TYPES = [
  { name: "City",     color: "#e74c3c", icon: "game-icons:castle" },
  { name: "Town",     color: "#e67e22", icon: "game-icons:village" },
  { name: "Village",  color: "#f1c40f", icon: "game-icons:hut" },
  { name: "Dungeon",  color: "#9b59b6", icon: "game-icons:dungeon-gate" },
  { name: "Landmark", color: "#1abc9c", icon: "lucide:landmark" },
  { name: "Cave",     color: "#78909c", icon: "game-icons:cave-entrance" },
  { name: "Ruin",     color: "#8d6e63", icon: "game-icons:broken-wall" },
  { name: "Other",    color: "#3498db", icon: "lucide:map-pin" },
];

let customTypes = []; // [{ id, name, color, icon }]

function allTypes()      { return BUILTIN_TYPES.concat(customTypes); }
function typeInfo(name)  {
  return allTypes().find(t => t.name === name)
      || BUILTIN_TYPES[BUILTIN_TYPES.length - 1]; // fall back to "Other"
}

// Icon choices offered when creating a custom type.
const ICON_LIBRARY = [
  "lucide:castle","lucide:landmark","lucide:building-2","lucide:house",
  "lucide:store","lucide:warehouse","lucide:church","lucide:tent-tree",
  "lucide:mountain","lucide:mountain-snow","lucide:trees","lucide:tree-pine",
  "lucide:waves","lucide:anchor","lucide:ship","lucide:sailboat",
  "lucide:flag","lucide:crown","lucide:gem","lucide:pickaxe",
  "lucide:wheat","lucide:flame","lucide:skull","lucide:swords",
  "game-icons:castle","game-icons:village","game-icons:dungeon-gate","game-icons:cave-entrance",
  "game-icons:broken-wall","game-icons:lighthouse","game-icons:volcano","game-icons:treasure-map",
];

// ── Areas (pen-tool land overlays) ────────────────────────────────────────────
const areasRef = ref(db, `campaigns/${_cid}/areas`);
let areas = []; // [{ id, name, color, points:[{x,y}] }]

function saveMarker(marker)     { set(ref(db, `campaigns/${_cid}/markers/` + marker.id), marker); }
function deleteMarkerById(id)   { remove(ref(db, `campaigns/${_cid}/markers/` + id)); }
function generateId()           { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function screenToPct(screenX, screenY) {
  return {
    x: ((screenX - originX) / scale / _imgNW) * 100,
    y: ((screenY - originY) / scale / _imgNH) * 100
  };
}

// ── Differential marker rendering ─────────────────────────────────────────────
// Tracks id → { el, hash } so unchanged markers are never touched (no DOM
// teardown, no layout invalidation, no event-listener churn).
const _markerEls = new Map();

function renderMarkers() {
  const visible = new Set();

  markers.forEach(marker => {
    if (!isAdmin && marker.explored !== true) return;
    visible.add(marker.id);

    const hash = JSON.stringify(marker);
    const existing = _markerEls.get(marker.id);
    if (existing && existing.hash === hash) return; // nothing changed

    if (existing) existing.el.remove();

    const el = _buildMarkerEl(marker);
    _markerEls.set(marker.id, { el, hash });
    markerLayer.appendChild(el);
  });

  // Remove markers that were deleted or are no longer visible.
  _markerEls.forEach((data, id) => {
    if (!visible.has(id)) {
      data.el.remove();
      _markerEls.delete(id);
    }
  });

  // Apply correct counter-scale to newly added elements.
  flushCounterScale();
}

// Tear down every marker element and rebuild — used when the type registry
// changes (colours/icons live outside the per-marker hash).
function forceRerenderMarkers() {
  _markerEls.forEach(d => d.el.remove());
  _markerEls.clear();
  renderMarkers();
}

function _buildMarkerEl(marker) {
  const el = document.createElement("div");
  el.className        = "map-marker";
  el.dataset.id       = marker.id;
  el.dataset.type     = marker.type || "Other";
  el.dataset.explored = marker.explored !== false ? "true" : "false";
  el.style.left       = marker.x + "%";
  el.style.top        = marker.y + "%";
  // Initial transform — flushCounterScale will update this correctly.
  el.style.transform  = `translate3d(-50%,-50%,0) scale(${1 / scale})`;

  // Stop pointerdown from bubbling to mapContainer (prevents drag hijack).
  el.addEventListener("pointerdown", e => e.stopPropagation());

  // Pin — icon + colour both come from the marker's category (type registry).
  // Unexplored markers are dimmed via the data-explored attribute (see CSS).
  const info = typeInfo(marker.type);
  el.style.setProperty("--mc", info.color);
  const pin = document.createElement("div");
  pin.className = "marker-pin";
  pin.innerHTML = `<iconify-icon icon="${info.icon}"></iconify-icon>`;

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "marker-tooltip";
  let html = `<div class="tooltip-name">${esc(marker.name)}</div>`;
  if (marker.type)                html += `<div class="tooltip-type">${esc(marker.type)}</div>`;
  if (marker.population)         html += `<div class="tooltip-row">Population: ${esc(marker.population)}</div>`;
  if (marker.wealth)             html += `<div class="tooltip-row">Wealth: ${esc(marker.wealth)}</div>`;
  if (marker.mainRace)           html += `<div class="tooltip-row">Majority: ${esc(marker.mainRace)}</div>`;
  if (marker.religion)           html += `<div class="tooltip-row">Religion: ${esc(marker.religion)}</div>`;
  if (isAdmin && marker.notes)   html += `<div class="tooltip-notes">${esc(marker.notes)}</div>`;
  if (window.matchMedia("(pointer: coarse)").matches) {
    html += `<div class="tooltip-tap-hint">Tap again to open <iconify-icon icon="lucide:arrow-right"></iconify-icon></div>`;
  }
  tooltip.innerHTML = html;

  el.appendChild(pin);
  el.appendChild(tooltip);

  // DM controls
  if (isAdmin) {
    const controls = document.createElement("div");
    controls.className = "marker-dm-controls";

    const editBtn = document.createElement("button");
    editBtn.className   = "marker-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", e => { e.stopPropagation(); openEditModal(marker.id); });

    const deleteBtn = document.createElement("button");
    deleteBtn.className   = "marker-delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Delete "${marker.name}"? This cannot be undone.`)) return;
      deleteMarkerById(marker.id);
    });

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);
    el.appendChild(controls);
  }

  // Click / tap
  el.addEventListener("click", () => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      if (el.classList.contains("active")) {
        sessionStorage.setItem("lastLocationId", marker.id);
        window.location.href = `location.html?id=${marker.id}`;
      } else {
        document.querySelectorAll(".map-marker.active").forEach(m => m.classList.remove("active"));
        el.classList.add("active");
      }
    } else {
      sessionStorage.setItem("lastLocationId", marker.id);
      window.location.href = `location.html?id=${marker.id}`;
    }
  });

  return el;
}

// ── Place Mode ────────────────────────────────────────────────────────────────
const btnPlaceMarker = document.getElementById("btn-place-marker");

const dmToolbar = document.getElementById("dm-toolbar");
if (dmToolbar) {
  dmToolbar.addEventListener("click",       e => e.stopPropagation());
  dmToolbar.addEventListener("pointerdown", e => e.stopPropagation());
}

const placingBanner = document.createElement("div");
placingBanner.id          = "placing-banner";
placingBanner.textContent = "Click anywhere on the map to place a marker";
mapContainer.appendChild(placingBanner);

if (btnPlaceMarker) {
  btnPlaceMarker.addEventListener("click", () => {
    if (!placingMode && penMode) exitPenMode();
    placingMode = !placingMode;
    const pmIcon = btnPlaceMarker.querySelector("iconify-icon");
    if (pmIcon) pmIcon.setAttribute("icon", placingMode ? "lucide:x" : "lucide:map-pin-plus");
    btnPlaceMarker.title = placingMode ? "Cancel Placing" : "Place Marker";
    btnPlaceMarker.classList.toggle("active", placingMode);
    mapContainer.classList.toggle("placing-mode", placingMode);
    placingBanner.classList.toggle("visible", placingMode);
  });
}

// ── Marker Modal ──────────────────────────────────────────────────────────────
const markerModal = document.getElementById("marker-modal");
const modalTitle  = document.getElementById("modal-title");
const mName       = document.getElementById("m-name");
const mType       = document.getElementById("m-type");
const mPopulation = document.getElementById("m-population");
const mWealth     = document.getElementById("m-wealth");
const mMainRace   = document.getElementById("m-main-race");
const mReligion   = document.getElementById("m-religion");
const mExplored   = document.getElementById("m-explored");
const mNotes      = document.getElementById("m-notes");
const modalError  = document.getElementById("modal-error");
const mSave       = document.getElementById("m-save");
const mCancel     = document.getElementById("m-cancel");
const mTypePreview = document.getElementById("m-type-preview");

// Rebuild the type <select> from the registry (built-ins + custom types).
function populateTypeSelect(selected) {
  const keep = selected ?? mType.value;
  mType.innerHTML = "";
  allTypes().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    mType.appendChild(opt);
  });
  if (keep && allTypes().some(t => t.name === keep)) mType.value = keep;
  updateTypePreview();
}

// Show the selected type's icon + colour beneath the dropdown.
function updateTypePreview() {
  if (!mTypePreview) return;
  const info = typeInfo(mType.value);
  mTypePreview.innerHTML =
    `<span class="m-type-chip" style="--mc:${info.color}"><iconify-icon icon="${info.icon}"></iconify-icon></span>` +
    `<span class="m-type-chip-label">${esc(info.name)}</span>`;
}

mType.addEventListener("change", updateTypePreview);

function openPlaceModal() {
  editingId             = null;
  modalTitle.textContent = "Place Marker";
  mName.value = mPopulation.value = mWealth.value = mReligion.value = mNotes.value = "";
  mType.value       = "City";
  mMainRace.value   = "";
  mExplored.checked = false;
  modalError.textContent = "";
  updateTypePreview();
  populateCountrySelect("");
  markerModal.classList.add("open");
  mName.focus();
}

function openEditModal(id) {
  const marker = markers.find(m => m.id === id);
  if (!marker) return;
  editingId              = id;
  modalTitle.textContent = "Edit Marker";
  mName.value            = marker.name       || "";
  mType.value            = marker.type       || "City";
  mPopulation.value      = marker.population || "";
  mWealth.value          = marker.wealth     || "";
  mMainRace.value        = marker.mainRace   || "";
  mReligion.value        = marker.religion   || "";
  mExplored.checked      = marker.explored   === true;
  mNotes.value           = marker.notes      || "";
  modalError.textContent = "";
  updateTypePreview();
  populateCountrySelect(marker.countryId || "");
  markerModal.classList.add("open");
  mName.focus();
}

function exitPlaceMode() {
  placingMode = false;
  if (btnPlaceMarker) {
    const pmIcon = btnPlaceMarker.querySelector("iconify-icon");
    if (pmIcon) pmIcon.setAttribute("icon", "lucide:map-pin-plus");
    btnPlaceMarker.title = "Place Marker";
    btnPlaceMarker.classList.remove("active");
  }
  mapContainer.classList.remove("placing-mode");
  placingBanner.classList.remove("visible");
}

function closeMarkerModal(wasEditing) {
  markerModal.classList.remove("open");
  pendingCoords = null;
  editingId     = null;
  if (!wasEditing && placingMode) exitPlaceMode();
}

mSave.addEventListener("click", () => {
  const name = mName.value.trim();
  if (!name) { modalError.textContent = "Name is required."; return; }

  const wasEditing = !!editingId;
  if (wasEditing) {
    const existing = markers.find(m => m.id === editingId);
    if (existing) {
      saveMarker({
        ...existing,
        name,
        type:       mType.value,
        population: mPopulation.value.trim() || null,
        wealth:     mWealth.value.trim()     || null,
        mainRace:   mMainRace.value          || null,
        religion:   mReligion.value.trim()   || null,
        explored:   mExplored.checked,
        notes:      mNotes.value.trim()      || null,
        countryId:  mCountry.value           || null
      });
    }
  } else {
    saveMarker({
      id:         generateId(),
      name,
      type:       mType.value,
      population: mPopulation.value.trim() || null,
      wealth:     mWealth.value.trim()     || null,
      mainRace:   mMainRace.value          || null,
      religion:   mReligion.value.trim()   || null,
      explored:   mExplored.checked,
      notes:      mNotes.value.trim()      || null,
      countryId:  mCountry.value           || null,
      x:          pendingCoords.x,
      y:          pendingCoords.y
    });
  }
  closeMarkerModal(wasEditing);
});

mCancel.addEventListener("click", () => closeMarkerModal(!!editingId));
markerModal.addEventListener("click", e => { if (e.target === markerModal) closeMarkerModal(!!editingId); });
mName.addEventListener("keydown", e => { if (e.key === "Enter") mSave.click(); });

// ── Show DM Toolbar ───────────────────────────────────────────────────────────
if (isAdmin && dmToolbar) dmToolbar.style.display = "flex";

// ── Firebase Live Sync ────────────────────────────────────────────────────────
onValue(markersRef, snapshot => {
  markers = snapshot.val() ? Object.values(snapshot.val()) : [];
  renderMarkers();
  renderLocationList();
});

onValue(countriesRef, snapshot => {
  countries = snapshot.val() ? Object.values(snapshot.val()) : [];

  if (!_defaultCollapseApplied) {
    _defaultCollapseApplied = true;
    countries.forEach(c => collapsedCountries.add(c.id));
    collapsedCountries.add("__unassigned__");
  }

  renderLocationList();
  populateCountrySelect();
});

onValue(markerTypesRef, snapshot => {
  customTypes = snapshot.val() ? Object.values(snapshot.val()) : [];
  populateTypeSelect(mType.value);
  forceRerenderMarkers();
  renderCustomTypeList();
});

onValue(areasRef, snapshot => {
  areas = snapshot.val() ? Object.values(snapshot.val()) : [];
  renderAreas();
});

// ── Location Panel ────────────────────────────────────────────────────────────
const locationPanel   = document.getElementById("location-panel");
const lpOpenBtn       = document.getElementById("lp-open-btn");
const lpCloseBtn      = document.getElementById("lp-close-btn");
const lpBody          = document.getElementById("lp-body");
const lpSearch        = document.getElementById("lp-search");
const lpAddCountryBtn = document.getElementById("lp-add-country-btn");
const lpResizeHandle  = document.getElementById("lp-resize-handle");

let lpSearchQuery = "";
const collapsedCountries    = new Set();
let _defaultCollapseApplied = false;

if (isAdmin) lpAddCountryBtn.style.display = "inline-flex";

lpOpenBtn.addEventListener("pointerdown",     e => e.stopPropagation());
locationPanel.addEventListener("pointerdown", e => e.stopPropagation());
locationPanel.addEventListener("wheel",       e => e.stopPropagation(), { passive: true });

lpOpenBtn.addEventListener("click", e => {
  e.stopPropagation();
  locationPanel.classList.add("open");
  lpOpenBtn.style.display = "none";
});

lpCloseBtn.addEventListener("click", () => {
  locationPanel.classList.remove("open");
  lpOpenBtn.style.display = "flex";
});

lpSearch.addEventListener("input", () => {
  lpSearchQuery = lpSearch.value.trim().toLowerCase();
  renderLocationList();
});

// ── Panel resize ──────────────────────────────────────────────────────────────
let _isResizing       = false;
let _resizeStartX     = 0;
let _resizeStartWidth = 0;
const LP_MIN = 200, LP_MAX = 520;

lpResizeHandle.addEventListener("pointerdown", e => {
  _isResizing       = true;
  _resizeStartX     = e.clientX;
  _resizeStartWidth = locationPanel.offsetWidth;
  document.body.style.userSelect = "none";
  lpResizeHandle.setPointerCapture(e.pointerId);
  e.stopPropagation();
});
lpResizeHandle.addEventListener("pointermove", e => {
  if (!_isResizing) return;
  const w = Math.min(LP_MAX, Math.max(LP_MIN, _resizeStartWidth + (_resizeStartX - e.clientX)));
  locationPanel.style.width = w + "px";
});
lpResizeHandle.addEventListener("pointerup",     () => { _isResizing = false; document.body.style.userSelect = ""; });
lpResizeHandle.addEventListener("pointercancel", () => { _isResizing = false; document.body.style.userSelect = ""; });

// ── Render location list ──────────────────────────────────────────────────────
function renderLocationList() {
  lpBody.innerHTML = "";

  const vis = markers.filter(m => {
    if (!isAdmin && m.explored !== true) return false;
    if (!lpSearchQuery) return true;
    return (m.name || "").toLowerCase().includes(lpSearchQuery)
        || (m.type || "").toLowerCase().includes(lpSearchQuery);
  });

  if (vis.length === 0) {
    lpBody.innerHTML = `<p class="lp-empty">${lpSearchQuery ? "No matches found." : "No locations added yet."}</p>`;
    return;
  }

  if (countries.length === 0) {
    vis.forEach(m => lpBody.appendChild(buildLocationItem(m)));
    return;
  }

  const groups = countries.map(c => ({ type: "country", country: c, items: vis.filter(m => m.countryId === c.id) }));
  const unassigned = vis.filter(m => !m.countryId || !countries.find(c => c.id === m.countryId));
  if (unassigned.length > 0) groups.push({ type: "unassigned", items: unassigned });

  groups.forEach(g => {
    if (g.items.length === 0 && lpSearchQuery) return;
    lpBody.appendChild(g.type === "country" ? buildCountrySection(g.country, g.items) : buildUnassignedSection(g.items));
  });
}

function buildCountrySection(country, items) {
  const isCollapsed = collapsedCountries.has(country.id);
  const section = document.createElement("div");
  section.className = "lp-country-section";

  const header = document.createElement("div");
  header.className = "lp-country-header";
  header.innerHTML = `
    <div class="lp-country-left">
      <div class="lp-country-dot" style="background:${country.color || "#888"}"></div>
      <span class="lp-country-name">${esc(country.name)}</span>
      <span class="lp-country-count">${items.length}</span>
    </div>
    <div class="lp-country-right">
      ${isAdmin ? `
        <button class="lp-icon-btn lp-edit-country" title="Edit" data-id="${country.id}"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
        <button class="lp-icon-btn lp-del-country"  title="Delete" data-id="${country.id}"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>
      ` : ""}
      <button class="lp-icon-btn lp-collapse-btn">${isCollapsed
        ? '<iconify-icon icon="lucide:chevron-right"></iconify-icon>'
        : '<iconify-icon icon="lucide:chevron-down"></iconify-icon>'}</button>
    </div>`;

  if (country.description) {
    const desc = document.createElement("div");
    desc.className   = "lp-country-desc";
    desc.textContent = country.description;
    header.appendChild(desc);
  }

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "lp-country-items" + (isCollapsed ? " collapsed" : "");
  items.forEach(m => itemsWrap.appendChild(buildLocationItem(m)));

  header.querySelector(".lp-collapse-btn").addEventListener("click", e => {
    e.stopPropagation();
    collapsedCountries.has(country.id) ? collapsedCountries.delete(country.id) : collapsedCountries.add(country.id);
    renderLocationList();
  });

  if (isAdmin) {
    header.querySelector(".lp-edit-country").addEventListener("click", e => { e.stopPropagation(); openCountryModal(country.id); });
    header.querySelector(".lp-del-country").addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Delete region "${country.name}"? Markers will become unassigned.`)) return;
      remove(ref(db, `campaigns/${_cid}/countries/${country.id}`));
      markers.filter(m => m.countryId === country.id).forEach(m => set(ref(db, `campaigns/${_cid}/markers/${m.id}/countryId`), null));
    });
  }

  section.appendChild(header);
  section.appendChild(itemsWrap);
  return section;
}

function buildUnassignedSection(items) {
  const isCollapsed = collapsedCountries.has("__unassigned__");
  const section = document.createElement("div");
  section.className = "lp-country-section lp-unassigned-section";

  const header = document.createElement("div");
  header.className = "lp-country-header";
  header.innerHTML = `
    <div class="lp-country-left">
      <div class="lp-country-dot" style="background:#555"></div>
      <span class="lp-country-name" style="color:#888">Unassigned</span>
      <span class="lp-country-count">${items.length}</span>
    </div>
    <div class="lp-country-right">
      <button class="lp-icon-btn lp-collapse-btn">${isCollapsed
        ? '<iconify-icon icon="lucide:chevron-right"></iconify-icon>'
        : '<iconify-icon icon="lucide:chevron-down"></iconify-icon>'}</button>
    </div>`;

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "lp-country-items" + (isCollapsed ? " collapsed" : "");
  items.forEach(m => itemsWrap.appendChild(buildLocationItem(m)));

  header.querySelector(".lp-collapse-btn").addEventListener("click", e => {
    e.stopPropagation();
    collapsedCountries.has("__unassigned__") ? collapsedCountries.delete("__unassigned__") : collapsedCountries.add("__unassigned__");
    renderLocationList();
  });

  section.appendChild(header);
  section.appendChild(itemsWrap);
  return section;
}

function buildLocationItem(marker) {
  const item = document.createElement("div");
  item.className = "lp-item";
  const explored = marker.explored === true;
  item.innerHTML = `
    <div class="lp-item-dot ${explored ? "lp-dot-explored" : "lp-dot-unexplored"}"></div>
    <div class="lp-item-info">
      <span class="lp-item-name">${esc(marker.name)}</span>
      <span class="lp-item-type">${esc(marker.type || "")}</span>
    </div>
    <button class="lp-item-goto" title="Focus on map"><iconify-icon icon="lucide:arrow-right"></iconify-icon></button>`;

  item.querySelector(".lp-item-goto").addEventListener("click", e => { e.stopPropagation(); focusMarker(marker); });
  item.addEventListener("click", () => {
    sessionStorage.setItem("lastLocationId", marker.id);
    window.location.href = `location.html?id=${marker.id}`;
  });
  return item;
}

function focusMarker(marker) {
  _updateCachedRect();
  originX = _cachedRect.width  / 2 - (marker.x / 100) * _imgNW * scale;
  originY = _cachedRect.height / 2 - (marker.y / 100) * _imgNH * scale;
  clampToBounds();
  updateTransform();

  const pin = markerLayer.querySelector(`[data-id="${marker.id}"] .marker-pin`);
  if (pin) {
    pin.classList.remove("focused");
    void pin.offsetWidth;
    pin.classList.add("focused");
    setTimeout(() => pin.classList.remove("focused"), 1400);
  }
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Country Modal ─────────────────────────────────────────────────────────────
const countryModal    = document.getElementById("country-modal");
const cmModalTitle    = document.getElementById("cm-modal-title");
const cmName          = document.getElementById("cm-name");
const cmDesc          = document.getElementById("cm-desc");
const cmColorSwatches = document.getElementById("cm-color-swatches");
const cmError         = document.getElementById("cm-error");
const cmSave          = document.getElementById("cm-save");
const cmCancel        = document.getElementById("cm-cancel");

let _editingCountryId    = null;
let _selectedCountryColor = COUNTRY_COLORS[0];

lpAddCountryBtn.addEventListener("click", () => openCountryModal(null));

function openCountryModal(id) {
  _editingCountryId = id;
  const existing    = id ? countries.find(c => c.id === id) : null;
  cmModalTitle.textContent = existing ? "Edit Region" : "Add Region";
  cmName.value             = existing?.name        || "";
  cmDesc.value             = existing?.description || "";
  _selectedCountryColor    = existing?.color || COUNTRY_COLORS[0];
  cmError.textContent      = "";
  _buildColorSwatches();
  countryModal.classList.add("open");
  cmName.focus();
}

function _buildColorSwatches() {
  cmColorSwatches.innerHTML = "";
  COUNTRY_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "country-color-swatch" + (color === _selectedCountryColor ? " selected" : "");
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      _selectedCountryColor = color;
      cmColorSwatches.querySelectorAll(".country-color-swatch").forEach(s => s.classList.toggle("selected", s.title === color));
    });
    cmColorSwatches.appendChild(sw);
  });
}

function closeCountryModal() { countryModal.classList.remove("open"); _editingCountryId = null; }

cmSave.addEventListener("click", () => {
  const name = cmName.value.trim();
  if (!name) { cmError.textContent = "Name is required."; return; }
  const id = _editingCountryId || generateId();
  set(ref(db, `campaigns/${_cid}/countries/${id}`), { id, name, color: _selectedCountryColor, description: cmDesc.value.trim() || null });
  closeCountryModal();
});

cmCancel.addEventListener("click", closeCountryModal);
countryModal.addEventListener("click", e => { if (e.target === countryModal) closeCountryModal(); });

// ── Country select in marker modal ────────────────────────────────────────────
const mCountry    = document.getElementById("m-country");
const mCountryRow = document.getElementById("m-country-row");

if (!isAdmin) mCountryRow.style.display = "none";

function populateCountrySelect(selectedId) {
  mCountry.innerHTML = `<option value="">— None —</option>`;
  countries.forEach(c => {
    const opt = document.createElement("option");
    opt.value       = c.id;
    opt.textContent = c.name;
    opt.style.color = c.color || "";
    if (c.id === selectedId) opt.selected = true;
    mCountry.appendChild(opt);
  });
}

// ── Maps Gallery ──────────────────────────────────────────────────────────────
const mapsModal        = document.getElementById("maps-modal");
const mapsGrid         = document.getElementById("maps-grid");
const mapsFileInputs   = ["maps-file-input-toolbar","maps-file-input-empty","maps-file-input-modal"]
                           .map(id => document.getElementById(id)).filter(Boolean);
const mapsUploadBtn    = document.getElementById("maps-upload-btn");
const mapsProgressWrap = document.getElementById("maps-upload-progress");
const mapsProgressFill = document.getElementById("maps-progress-fill");
const mapsProgressText = document.getElementById("maps-progress-text");
const mapsErrorEl      = document.getElementById("maps-upload-error");

// Only DM can upload — hide the upload row for regular players
if (!isAdmin) document.getElementById("maps-upload-row").style.display = "none";
document.getElementById("maps-close-btn").addEventListener("click", _closeMapsModal);
mapsModal.addEventListener("click", e => { if (e.target === mapsModal) _closeMapsModal(); });

function _openMapsModal() {
  _mapsModalOpen = true;
  _renderMapsGrid();
  mapsModal.classList.add("open");
}

function _closeMapsModal() {
  _mapsModalOpen = false;
  mapsModal.classList.remove("open");
}

function _renderMapsGrid() {
  mapsErrorEl.textContent = "";
  if (uploadedMaps.length === 0) {
    mapsGrid.innerHTML = `<p class="maps-empty">No maps uploaded yet. Be the first!</p>`;
    return;
  }
  const activeSrc = mapImage.src;
  mapsGrid.innerHTML = "";
  uploadedMaps.forEach(m => {
    const canDelete = isAdmin || (session && m.uploadedBy === session.id);
    const isActive  = m.url === activeSrc;
    const card = document.createElement("div");
    card.className = "map-card" + (isActive ? " map-card-active" : "");
    card.innerHTML = `
      <div class="map-card-thumb" style="background-image:url('${m.url}')"></div>
      <div class="map-card-info">
        <span class="map-card-name">${esc(m.name)}</span>
        <span class="map-card-by">by ${esc(m.uploaderName || "Unknown")}</span>
      </div>
      <div class="map-card-actions">
        <button class="map-card-view">${isActive ? "Viewing" : "View"}</button>
        ${canDelete ? `<button class="map-card-del">Delete</button>` : ""}
      </div>`;

    if (!isActive) {
      card.querySelector(".map-card-view").addEventListener("click", () => _setCurrentMap(m.url));
    }
    card.querySelector(".map-card-del")?.addEventListener("click", async e => {
      e.stopPropagation();
      if (!confirm(`Delete "${m.name}"?`)) return;
      try {
        if (m.storagePath) await deleteObject(storageRef(storage, m.storagePath));
      } catch (_) {}
      await remove(ref(db, `campaigns/${_cid}/maps/${m.id}`));
      if (mapImage.src === m.url) { _setMapUrl(null); _mapInitialized = false; }
    });
    mapsGrid.appendChild(card);
  });
}

function _setCurrentMap(url) {
  _mapInitialized = true;
  _setMapUrl(url);
  mapImage.src = url;
  document.getElementById("map-empty-state").style.display = "none";
  _renderMapsGrid();
  _closeMapsModal();
}

function _setUploadBusy(busy) {
  mapsFileInputs.forEach(inp => {
    if (!inp || !inp.parentElement) return;
    inp.parentElement.style.pointerEvents = busy ? "none" : "";
    inp.parentElement.style.opacity       = busy ? "0.5"  : "";
  });
  mapsProgressWrap.style.display = busy ? "flex" : "none";
  if (busy) mapsProgressFill.style.width = "0%";
}

async function _handleFileChange(e) {
  const inp  = e.target;
  const file = inp.files[0];
  if (!file) return;
  inp.value = "";
  if (!_mapsModalOpen) _openMapsModal();

  if (!file.type.startsWith("image/")) {
    mapsErrorEl.textContent = "Please select an image file."; return;
  }
  if (file.size > 20 * 1024 * 1024) {
    mapsErrorEl.textContent = "File must be under 20 MB."; return;
  }
  if (!session) { mapsErrorEl.textContent = "Not logged in."; return; }

  mapsErrorEl.textContent = "";
  _setUploadBusy(true);

  const mapId    = generateId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path     = `campaigns/${_cid}/maps/${session.id}/${mapId}_${safeName}`;
  const fileRef  = storageRef(storage, path);
  const task     = uploadBytesResumable(fileRef, file, { customMetadata: { uploadedBy: session.id } });

  task.on("state_changed",
    snap => {
      const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
      mapsProgressFill.style.width = pct + "%";
      mapsProgressText.textContent = `Uploading… ${pct}%`;
    },
    err => {
      console.error("Storage upload failed:", err?.code, err?.message, err);
      _setUploadBusy(false);
      mapsErrorEl.textContent = `Upload failed (${err?.code || "unknown"}). Check console for details.`;
    },
    async () => {
      try {
        const url = await getDownloadURL(fileRef);
        await set(ref(db, `campaigns/${_cid}/maps/${mapId}`), {
          id:           mapId,
          name:         file.name.replace(/\.[^.]+$/, ""),
          url,
          uploadedBy:   session.id,
          uploaderName: session.username,
          timestamp:    Date.now(),
          storagePath:  path,
        });
        _setUploadBusy(false);
        _setCurrentMap(url);
      } catch (err) {
        console.error("Post-upload DB write failed:", err?.code, err?.message, err);
        _setUploadBusy(false);
        mapsErrorEl.textContent = `Saved to storage but failed to register map (${err?.code || "unknown"}). Check console.`;
      }
    }
  );
}

mapsFileInputs.forEach(inp => inp.addEventListener("change", _handleFileChange));


// ════════════════════════════════════════════════════════════════════════════
//  Custom Marker Types
// ════════════════════════════════════════════════════════════════════════════
const btnManageTypes  = document.getElementById("btn-manage-types");
const typeModal       = document.getElementById("type-modal");
const ttName          = document.getElementById("tt-name");
const ttColorSwatches = document.getElementById("tt-color-swatches");
const ttIconGrid      = document.getElementById("tt-icon-grid");
const ttList          = document.getElementById("tt-list");
const ttError         = document.getElementById("tt-error");
const ttSave          = document.getElementById("tt-save");
const ttClose         = document.getElementById("tt-close");

let _selTypeColor = COUNTRY_COLORS[0];
let _selTypeIcon  = ICON_LIBRARY[0];

function openTypeModal() {
  ttName.value        = "";
  _selTypeColor       = COUNTRY_COLORS[0];
  _selTypeIcon        = ICON_LIBRARY[0];
  ttError.textContent = "";
  _buildTypeColorSwatches();
  _buildTypeIconGrid();
  renderCustomTypeList();
  typeModal.classList.add("open");
  ttName.focus();
}
function closeTypeModal() { typeModal.classList.remove("open"); }

function _buildTypeColorSwatches() {
  ttColorSwatches.innerHTML = "";
  COUNTRY_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "country-color-swatch" + (color === _selTypeColor ? " selected" : "");
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      _selTypeColor = color;
      ttColorSwatches.querySelectorAll(".country-color-swatch")
        .forEach(s => s.classList.toggle("selected", s.title === color));
    });
    ttColorSwatches.appendChild(sw);
  });
}

function _buildTypeIconGrid() {
  ttIconGrid.innerHTML = "";
  ICON_LIBRARY.forEach(icon => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "tt-icon-cell" + (icon === _selTypeIcon ? " selected" : "");
    cell.innerHTML = `<iconify-icon icon="${icon}"></iconify-icon>`;
    cell.addEventListener("click", () => {
      _selTypeIcon = icon;
      ttIconGrid.querySelectorAll(".tt-icon-cell").forEach(c => c.classList.remove("selected"));
      cell.classList.add("selected");
    });
    ttIconGrid.appendChild(cell);
  });
}

function renderCustomTypeList() {
  if (!ttList) return;
  if (customTypes.length === 0) {
    ttList.innerHTML = `<p class="tt-empty">No custom types yet.</p>`;
    return;
  }
  ttList.innerHTML = "";
  customTypes.forEach(t => {
    const row = document.createElement("div");
    row.className = "tt-row";
    row.innerHTML =
      `<span class="m-type-chip" style="--mc:${t.color}"><iconify-icon icon="${t.icon}"></iconify-icon></span>` +
      `<span class="tt-row-name">${esc(t.name)}</span>` +
      `<button class="tt-row-del" title="Delete type"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>`;
    row.querySelector(".tt-row-del").addEventListener("click", () => {
      if (!confirm(`Delete type "${t.name}"? Markers using it will fall back to "Other".`)) return;
      remove(ref(db, `campaigns/${_cid}/markerTypes/${t.id}`));
    });
    ttList.appendChild(row);
  });
}

if (btnManageTypes) btnManageTypes.addEventListener("click", openTypeModal);
if (ttClose)        ttClose.addEventListener("click", closeTypeModal);
if (ttSave) ttSave.addEventListener("click", () => {
  const name = ttName.value.trim();
  if (!name) { ttError.textContent = "Name is required."; return; }
  if (allTypes().some(t => t.name.toLowerCase() === name.toLowerCase())) {
    ttError.textContent = "A type with that name already exists."; return;
  }
  const id = generateId();
  set(ref(db, `campaigns/${_cid}/markerTypes/${id}`), { id, name, color: _selTypeColor, icon: _selTypeIcon });
  ttName.value        = "";
  ttError.textContent = "";
  // The list + dropdown refresh through the markerTypes onValue listener.
});
if (typeModal) typeModal.addEventListener("click", e => { if (e.target === typeModal) closeTypeModal(); });
if (ttName)    ttName.addEventListener("keydown", e => { if (e.key === "Enter") ttSave.click(); });


// ════════════════════════════════════════════════════════════════════════════
//  Pen Tool — draw land areas
// ════════════════════════════════════════════════════════════════════════════
const btnDrawArea = document.getElementById("btn-draw-area");
let penMode   = false;
let penPoints = [];     // [{x,y}] in percent
let penCursor = null;   // {x,y} container-relative px (rubber-band target)

// Percent point → container-relative px (inverse of screenToPct).
function pctToScreen(p) {
  return {
    x: (p.x / 100) * _imgNW * scale + originX,
    y: (p.y / 100) * _imgNH * scale + originY,
  };
}

const penControls = document.createElement("div");
penControls.id = "pen-controls";
penControls.innerHTML =
  `<span class="pen-hint">Click to add points · click the first point to close</span>` +
  `<button id="pen-undo" class="pen-ctrl-btn" title="Undo last point"><iconify-icon icon="lucide:undo-2"></iconify-icon></button>` +
  `<button id="pen-finish" class="pen-ctrl-btn pen-ctrl-finish" title="Finish area"><iconify-icon icon="lucide:check"></iconify-icon> Finish</button>` +
  `<button id="pen-cancel" class="pen-ctrl-btn pen-ctrl-cancel" title="Cancel"><iconify-icon icon="lucide:x"></iconify-icon></button>`;
mapContainer.appendChild(penControls);
penControls.addEventListener("pointerdown", e => e.stopPropagation());
penControls.querySelector("#pen-undo").addEventListener("click",   () => { penPoints.pop(); updatePenDraw(); });
penControls.querySelector("#pen-finish").addEventListener("click", finishPen);
penControls.querySelector("#pen-cancel").addEventListener("click", () => { penPoints = []; exitPenMode(); });

function enterPenMode() {
  if (placingMode) exitPlaceMode();
  penMode   = true;
  penPoints = [];
  penCursor = null;
  if (btnDrawArea) btnDrawArea.classList.add("active");
  mapContainer.classList.add("placing-mode"); // reuse crosshair cursor
  penControls.classList.add("visible");
  updatePenDraw();
}

function exitPenMode() {
  penMode   = false;
  penCursor = null;
  penPoints = [];
  if (btnDrawArea) btnDrawArea.classList.remove("active");
  mapContainer.classList.remove("placing-mode");
  penControls.classList.remove("visible");
  updatePenDraw();
}

if (btnDrawArea) btnDrawArea.addEventListener("click", () => { penMode ? exitPenMode() : enterPenMode(); });

function penClickAt(cx, cy) {
  const pct = screenToPct(cx, cy);
  pct.x = Math.max(0, Math.min(100, pct.x));
  pct.y = Math.max(0, Math.min(100, pct.y));
  // Close the shape when the click lands on the first vertex.
  if (penPoints.length >= 3) {
    const f = pctToScreen(penPoints[0]);
    if (Math.hypot(cx - f.x, cy - f.y) < 16) { finishPen(); return; }
  }
  penPoints.push(pct);
  updatePenDraw();
}

function updatePenDraw() {
  penDrawGroup.innerHTML = "";
  penLayer.innerHTML     = "";
  if (!penMode || penPoints.length === 0) { flushCounterScale(); return; }

  const ptsStr = penPoints.map(p => `${p.x},${p.y}`).join(" ");

  if (penPoints.length >= 3) {
    const fill = document.createElementNS(SVG_NS, "polygon");
    fill.setAttribute("points", ptsStr);
    fill.setAttribute("class", "pen-preview-fill");
    penDrawGroup.appendChild(fill);
  }

  const line = document.createElementNS(SVG_NS, "polyline");
  line.setAttribute("points", ptsStr);
  line.setAttribute("class", "pen-preview-line");
  penDrawGroup.appendChild(line);

  if (penCursor) {
    const last = penPoints[penPoints.length - 1];
    const cur  = screenToPct(penCursor.x, penCursor.y);
    const rb = document.createElementNS(SVG_NS, "line");
    rb.setAttribute("x1", last.x); rb.setAttribute("y1", last.y);
    rb.setAttribute("x2", cur.x);  rb.setAttribute("y2", cur.y);
    rb.setAttribute("class", "pen-preview-rubber");
    penDrawGroup.appendChild(rb);
  }

  penPoints.forEach((p, i) => {
    const dot = document.createElement("div");
    dot.className  = "pen-vertex" + (i === 0 ? " pen-vertex-first" : "");
    dot.style.left = p.x + "%";
    dot.style.top  = p.y + "%";
    penLayer.appendChild(dot);
  });

  flushCounterScale();
}

function finishPen() {
  if (penPoints.length < 3) return;
  _pendingAreaPoints = penPoints.slice();
  exitPenMode();
  openAreaModal(null);
}


// ════════════════════════════════════════════════════════════════════════════
//  Areas — render + naming/edit modal
// ════════════════════════════════════════════════════════════════════════════
function _centroid(points) {
  // Area-weighted polygon centroid; falls back to vertex average if degenerate.
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i], p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    a += cross; cx += (p0.x + p1.x) * cross; cy += (p0.y + p1.y) * cross;
  }
  if (Math.abs(a) < 1e-6) {
    const n = points.length;
    return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function renderAreas() {
  areaSvg.querySelectorAll(".area-poly").forEach(n => n.remove());
  areaLabelLayer.innerHTML = "";

  areas.forEach(area => {
    if (!area.points || area.points.length < 3) return;
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", area.points.map(p => `${p.x},${p.y}`).join(" "));
    poly.setAttribute("class", "area-poly");
    poly.style.setProperty("--ac", area.color || "#3498db");
    if (isAdmin) {
      poly.style.cursor = "pointer";
      poly.style.pointerEvents = "auto";
      poly.addEventListener("click", () => { if (!penMode && !placingMode) openAreaModal(area.id); });
    }
    areaSvg.appendChild(poly);

    const c = _centroid(area.points);
    const label = document.createElement("div");
    label.className = "area-label";
    label.style.left = c.x + "%";
    label.style.top  = c.y + "%";
    label.style.setProperty("--ac", area.color || "#3498db");
    label.textContent = area.name || "";
    if (isAdmin) {
      label.style.cursor = "pointer";
      label.style.pointerEvents = "auto";
      label.addEventListener("click", () => { if (!penMode && !placingMode) openAreaModal(area.id); });
    }
    areaLabelLayer.appendChild(label);
  });

  // Keep the in-progress pen group above the saved areas.
  areaSvg.appendChild(penDrawGroup);
  flushCounterScale();
}

const areaModal       = document.getElementById("area-modal");
const amTitle         = document.getElementById("am-title");
const amName          = document.getElementById("am-name");
const amColorSwatches = document.getElementById("am-color-swatches");
const amError         = document.getElementById("am-error");
const amSave          = document.getElementById("am-save");
const amCancel        = document.getElementById("am-cancel");
const amDelete        = document.getElementById("am-delete");

let _editingAreaId     = null;
let _pendingAreaPoints = null;
let _selAreaColor      = COUNTRY_COLORS[0];

function openAreaModal(id) {
  _editingAreaId = id;
  const existing = id ? areas.find(a => a.id === id) : null;
  amTitle.textContent    = existing ? "Edit Area" : "Name Area";
  amName.value           = existing?.name || "";
  _selAreaColor          = existing?.color || COUNTRY_COLORS[0];
  amError.textContent    = "";
  amDelete.style.display = existing ? "inline-flex" : "none";
  _buildAreaColorSwatches();
  areaModal.classList.add("open");
  amName.focus();
}
function closeAreaModal() {
  areaModal.classList.remove("open");
  _editingAreaId     = null;
  _pendingAreaPoints = null;
}

function _buildAreaColorSwatches() {
  amColorSwatches.innerHTML = "";
  COUNTRY_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "country-color-swatch" + (color === _selAreaColor ? " selected" : "");
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      _selAreaColor = color;
      amColorSwatches.querySelectorAll(".country-color-swatch")
        .forEach(s => s.classList.toggle("selected", s.title === color));
    });
    amColorSwatches.appendChild(sw);
  });
}

if (amSave) amSave.addEventListener("click", () => {
  const name = amName.value.trim();
  if (!name) { amError.textContent = "Name is required."; return; }
  const existing = _editingAreaId ? areas.find(a => a.id === _editingAreaId) : null;
  const id       = _editingAreaId || generateId();
  const points   = _pendingAreaPoints || existing?.points;
  if (!points || points.length < 3) { amError.textContent = "Area shape is missing."; return; }
  set(ref(db, `campaigns/${_cid}/areas/${id}`), { id, name, color: _selAreaColor, points });
  closeAreaModal();
});
if (amCancel) amCancel.addEventListener("click", closeAreaModal);
if (amDelete) amDelete.addEventListener("click", () => {
  if (!_editingAreaId) return;
  if (!confirm("Delete this area?")) return;
  remove(ref(db, `campaigns/${_cid}/areas/${_editingAreaId}`));
  closeAreaModal();
});
if (areaModal) areaModal.addEventListener("click", e => { if (e.target === areaModal) closeAreaModal(); });
if (amName)    amName.addEventListener("keydown", e => { if (e.key === "Enter") amSave.click(); });
