// ── Firebase ──────────────────────────────────────────────────────────────────
import { db, storage }                            from "./firebase.js";
import { ref, set, remove, onValue }              from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject }
                                                  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getSession }                             from "./auth.js";
import { buildDefaultClimates, CLIMATE_FIELDS }   from "./default-climates.js";
import { STORAGE_LIMITS, assertCanStore, QuotaError } from "./storage-quota.js";

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

// Pins normally hold a constant screen size (counter-scale = 1/scale). When the
// map is zoomed out they'd dominate the view, so we shrink them a little: at the
// most-zoomed-out level they sit at ~70%, easing back to full size by ~2× zoom.
function _markerCounterScale() {
  const z = minScale ? scale / minScale : 1;          // 1 = fully zoomed out
  const f = Math.min(1, 0.78 + 0.22 * (z - 1));        // 0.78 → 1.0 across the first 2×
  return f / scale;
}

// Counter-scale: written directly as an inline style on each marker element —
// avoids the CSS-variable cascade that forces a style recalc on every child.
function flushCounterScale() {
  const markerT = `translate3d(-50%,-50%,0) scale(${_markerCounterScale()})`;
  const t       = `translate3d(-50%,-50%,0) scale(${1 / scale})`;
  _markerEls.forEach(({ el }) => { el.style.transform = markerT; });
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
// Middle mouse button drags the map. Left mouse is reserved for actions —
// placing markers, drawing areas, and selecting markers/areas.
let _isPanning  = false;   // middle-button drag in progress
let _didDrag    = false;
let _actionDown = false;   // left-button press while a placing/pen mode is active
let _startX, _startY;

// Suppress the browser's middle-click autoscroll so middle-drag pans cleanly.
mapContainer.addEventListener("mousedown", e => { if (e.button === 1) e.preventDefault(); });

mapContainer.addEventListener("pointerdown", function(e) {
  if (e.pointerType !== "mouse") return;
  if (e.target.closest("#map-empty-state")) return;

  // Middle mouse → pan the map.
  if (e.button === 1) {
    e.preventDefault();
    _isPanning = true;
    _didDrag   = false;
    _startX    = e.clientX;
    _startY    = e.clientY;
    mapContainer.style.cursor = "grabbing";
    mapContainer.setPointerCapture(e.pointerId);
    // Suppress marker hover recalcs while panning.
    markerLayer.classList.add("gesturing");
    return;
  }

  // Left mouse in an action mode → a click places/draws, a drag pans the map.
  if (e.button === 0 && (placingMode || penMode)) {
    _actionDown = true;
    _didDrag    = false;
    _startX     = e.clientX;
    _startY     = e.clientY;
    mapContainer.setPointerCapture(e.pointerId);
  }
});

mapContainer.addEventListener("pointermove", function(e) {
  if (_isPanning) {
    const dx = e.clientX - _startX;
    const dy = e.clientY - _startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _didDrag = true;
    _startX = e.clientX;
    _startY = e.clientY;
    originX += dx;
    originY += dy;
    scheduleTransform();
  } else if (_actionDown) {
    const dx = e.clientX - _startX;
    const dy = e.clientY - _startY;
    // Past the click threshold this becomes a pan — so you can navigate the map
    // without leaving draw/place mode. A point is only placed on a clean click.
    if (!_didDrag && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      _didDrag = true;
      markerLayer.classList.add("gesturing");
    }
    if (_didDrag) {
      originX += dx;
      originY += dy;
      _startX = e.clientX;
      _startY = e.clientY;
      scheduleTransform();
    }
  }
}, { passive: true });

mapContainer.addEventListener("pointerup", function(e) {
  if (_isPanning && e.button === 1) {
    _isPanning = false;
    markerLayer.classList.remove("gesturing");
    mapContainer.style.cursor = (placingMode || penMode) ? "crosshair" : "";
    return;
  }

  if (_actionDown && e.button === 0) {
    _actionDown = false;
    markerLayer.classList.remove("gesturing");
    if (_didDrag || !isAdmin) return;
    if (penMode) {
      penClickAt(e.clientX - _cachedRect.left, e.clientY - _cachedRect.top);
    } else if (placingMode) {
      const clickX = e.clientX - _cachedRect.left;
      const clickY = e.clientY - _cachedRect.top;
      pendingCoords   = screenToPct(clickX, clickY);
      pendingCoords.x = Math.max(0, Math.min(100, pendingCoords.x));
      pendingCoords.y = Math.max(0, Math.min(100, pendingCoords.y));
      openPlaceModal();
    }
  }
});

// Rubber-band preview line following the cursor while drawing.
mapContainer.addEventListener("pointermove", function(e) {
  if (!penMode || e.pointerType !== "mouse") return;
  penCursor = { x: e.clientX - _cachedRect.left, y: e.clientY - _cachedRect.top };
  updatePenDraw();
}, { passive: true });

mapContainer.addEventListener("pointercancel", function() {
  _isPanning  = false;
  _actionDown = false;
  mapContainer.style.cursor = (placingMode || penMode) ? "crosshair" : "";
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
  try { return JSON.parse(localStorage.getItem("playerSession"))?.campaignRole === "dm"; }
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
let areas = []; // [{ id, name, color, points:[{x,y}], climateId, creatures:[{name,rarity}] }]

// ── Climate Registry ──────────────────────────────────────────────────────────
// User-defined climates with a FIXED field schema (see CLIMATE_FIELDS) so the
// keys stay stable for later code use. Stored under campaigns/{cid}/climates.
const climatesRef = ref(db, `campaigns/${_cid}/climates`);
let climates = []; // [{ id, name, color, temp, precipitation, terrain }]
function climateInfo(id) { return climates.find(c => c.id === id) || null; }

// Backfill the base climates into campaigns that predate the feature. We seed
// once (guarded by a `climatesSeeded` flag) and only when the campaign has no
// climates of its own — so a DM who deletes them all won't have them reappear.
const climatesSeededRef = ref(db, `campaigns/${_cid}/climatesSeeded`);
let _climatesLoaded = false, _seedFlagLoaded = false, _climatesSeeded = false, _seedAttempted = false;
function _maybeSeedClimates() {
  if (!isAdmin || _seedAttempted) return;
  if (!_climatesLoaded || !_seedFlagLoaded) return;   // wait for both reads
  if (_climatesSeeded || climates.length > 0) return; // already seeded or has data
  _seedAttempted = true;
  set(climatesRef, buildDefaultClimates());
  set(climatesSeededRef, true);
}

// One-time migration: older climates stored values as a free-form
// `fields: [{label, value}]` array. Map the known labels onto the fixed keys
// and drop the array. Runs only for admins; once `fields` is gone it's a no-op.
const _CLIMATE_LABEL_ALIASES = {
  temp:          ["avg temperature", "avg temp", "temperature", "temp"],
  precipitation: ["precipitation", "precip", "rainfall"],
  terrain:       ["terrain"],
};
function _migrateLegacyClimates() {
  if (!isAdmin) return;
  climates.forEach(cl => {
    if (cl.fields == null) return; // already on the new schema
    const arr = Array.isArray(cl.fields) ? cl.fields : Object.values(cl.fields);
    const byLabel = {};
    arr.forEach(f => { if (f && f.label) byLabel[String(f.label).toLowerCase()] = f.value || ""; });

    const migrated = { id: cl.id, name: cl.name, color: cl.color || "#3498db" };
    CLIMATE_FIELDS.forEach(f => {
      let v = (cl[f.key] != null && cl[f.key] !== "") ? cl[f.key] : "";
      if (!v) {
        for (const alias of (_CLIMATE_LABEL_ALIASES[f.key] || [f.label.toLowerCase()])) {
          if (byLabel[alias] != null) { v = byLabel[alias]; break; }
        }
      }
      migrated[f.key] = v;
    });
    set(ref(db, `campaigns/${_cid}/climates/${cl.id}`), migrated);
  });
}

// ── Enemy library ──────────────────────────────────────────────────────────────
// The same campaign-scoped enemy templates the Combat + Database tabs use. The
// area editor's creature search picks from this list (read-only here).
const enemyTemplatesRef = ref(db, `campaigns/${_cid}/enemyTemplates`);
let enemyLib = []; // [{ id, name, cr, hp, ac, ... }]

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
  el.style.transform  = `translate3d(-50%,-50%,0) scale(${_markerCounterScale()})`;

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

// DM toolbar visibility + the Locations button's home (corner vs. toolbar) are
// handled by syncToolbarLayout(), set up once the Locations button is defined.

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

onValue(climatesRef, snapshot => {
  climates = snapshot.val() ? Object.values(snapshot.val()) : [];
  _climatesLoaded = true;
  _migrateLegacyClimates();
  populateClimateSelect(amClimate?.value || "");
  renderClimateList();
  _maybeSeedClimates();
});

onValue(climatesSeededRef, snapshot => {
  _climatesSeeded = snapshot.val() === true;
  _seedFlagLoaded = true;
  _maybeSeedClimates();
});

onValue(enemyTemplatesRef, snapshot => {
  enemyLib = snapshot.val()
    ? Object.values(snapshot.val()).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    : [];
  // Refresh the open results dropdown if the modal is mid-search.
  if (areaModal && areaModal.classList.contains("open")) renderCreatureResults();
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
  // Hide the floating corner button while the panel is open; when it's docked
  // inside the toolbar (mobile), leave it in place — no need to remove it.
  if (lpOpenBtn.parentElement !== dmToolbar) lpOpenBtn.style.display = "none";
});

lpCloseBtn.addEventListener("click", () => {
  locationPanel.classList.remove("open");
  lpOpenBtn.style.display = "flex";
});

// ── Toolbar layout ────────────────────────────────────────────────────────────
// Mobile: the Locations button joins the DM's bottom toolbar dock.
// Desktop (and players on mobile): it floats in the corner, toolbar stays DM-only.
const _mqMobile = window.matchMedia("(max-width: 600px)");
function syncToolbarLayout() {
  if (!dmToolbar) return;
  if (isAdmin && _mqMobile.matches) {
    if (lpOpenBtn.parentElement !== dmToolbar) dmToolbar.appendChild(lpOpenBtn);
  } else if (lpOpenBtn.parentElement !== mapContainer) {
    mapContainer.appendChild(lpOpenBtn);
  }
  dmToolbar.style.display = isAdmin ? "flex" : "none";
}
_mqMobile.addEventListener("change", syncToolbarLayout);
syncToolbarLayout();

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
      <iconify-icon class="lp-collapse-ind" icon="${isCollapsed ? "lucide:chevron-right" : "lucide:chevron-down"}"></iconify-icon>
      <div class="lp-country-dot" style="background:${country.color || "#888"}"></div>
      <span class="lp-country-name">${esc(country.name)}</span>
      <span class="lp-country-count">${items.length}</span>
    </div>
    <div class="lp-country-right">
      ${isAdmin ? `
        <button class="lp-icon-btn lp-edit-country" title="Edit" data-id="${country.id}"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
        <button class="lp-icon-btn lp-del-country"  title="Delete" data-id="${country.id}"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>
      ` : ""}
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

  header.addEventListener("click", () => {
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
      <iconify-icon class="lp-collapse-ind" icon="${isCollapsed ? "lucide:chevron-right" : "lucide:chevron-down"}"></iconify-icon>
      <div class="lp-country-dot" style="background:#555"></div>
      <span class="lp-country-name" style="color:#888">Unassigned</span>
      <span class="lp-country-count">${items.length}</span>
    </div>`;

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "lp-country-items" + (isCollapsed ? " collapsed" : "");
  items.forEach(m => itemsWrap.appendChild(buildLocationItem(m)));

  header.addEventListener("click", () => {
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
  const info = typeInfo(marker.type);
  item.innerHTML = `
    <span class="lp-item-icon ${explored ? "" : "lp-item-unexplored"}" style="--mc:${info.color}"><iconify-icon icon="${info.icon}"></iconify-icon></span>
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

  // Account-storage quota check before we upload.
  try {
    await assertCanStore(session.id, file.size, STORAGE_LIMITS.map);
  } catch (err) {
    mapsErrorEl.textContent = err instanceof QuotaError ? err.message : "Could not verify storage quota.";
    return;
  }

  mapsErrorEl.textContent = "";
  _setUploadBusy(true);

  const mapId    = generateId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path     = `campaigns/${_cid}/maps/${session.id}/${mapId}_${safeName}`;
  const fileRef  = storageRef(storage, path);
  const task     = uploadBytesResumable(fileRef, file, { customMetadata: { uploadedBy: session.id, ownerId: session.id } });

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
  // Climate tab
  _selClimateColor    = COUNTRY_COLORS[0];
  if (clName)  clName.value = "";
  if (clError) clError.textContent = "";
  _buildClimateColorSwatches();
  renderClimateList();
  _switchEditorTab("types");
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
//  Climates (general editor — second tab)
// ════════════════════════════════════════════════════════════════════════════
const edTabs          = document.querySelectorAll(".ed-tab");
const edPanelTypes    = document.getElementById("ed-tab-types");
const edPanelClimates = document.getElementById("ed-tab-climates");
const clName          = document.getElementById("cl-name");
const clColorSwatches = document.getElementById("cl-color-swatches");
const clError         = document.getElementById("cl-error");
const clAdd           = document.getElementById("cl-add");
const clList          = document.getElementById("cl-list");

let _selClimateColor = COUNTRY_COLORS[0];

function _switchEditorTab(tab) {
  edTabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (edPanelTypes)    edPanelTypes.style.display    = tab === "types"    ? "" : "none";
  if (edPanelClimates) edPanelClimates.style.display = tab === "climates" ? "" : "none";
}
edTabs.forEach(b => b.addEventListener("click", () => _switchEditorTab(b.dataset.tab)));

function _buildClimateColorSwatches() {
  if (!clColorSwatches) return;
  clColorSwatches.innerHTML = "";
  COUNTRY_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "country-color-swatch" + (color === _selClimateColor ? " selected" : "");
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      _selClimateColor = color;
      clColorSwatches.querySelectorAll(".country-color-swatch")
        .forEach(s => s.classList.toggle("selected", s.title === color));
    });
    clColorSwatches.appendChild(sw);
  });
}

// ── Climate field controls ───────────────────────────────────────────────────
// Each climate field renders a typed control so stored values stay structured
// enough for the travel planner to read later: a numeric temperature range, a
// fixed precipitation scale, and a combinable terrain list. `persist(value)`
// writes the field back to Firebase.

// Pull the signed numbers out of any legacy/free-form temp string.
function _parseTempRange(v) {
  const n = String(v == null ? "" : v).match(/-?\d+(?:\.\d+)?/g) || [];
  return { min: n[0] != null ? n[0] : "", max: n[1] != null ? n[1] : "" };
}
function _formatTempRange(min, max, unit) {
  min = String(min).trim(); max = String(max).trim();
  if (min === "" && max === "") return "";
  return `${min}–${max}${unit || ""}`;
}
// Split a stored list on commas (and legacy "&" / "and" separators).
function _parseClimateList(v) {
  return String(v == null ? "" : v)
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function _buildClimateText(row, f, cl, persist) {
  const input = document.createElement("input");
  input.className = "cl-f-input";
  input.type = "text";
  input.placeholder = f.placeholder || "";
  input.value = cl[f.key] || "";
  input.addEventListener("change", () => persist(input.value.trim()));
  input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
  row.appendChild(input);
}

function _buildClimateRange(row, f, cl, persist) {
  const { min, max } = _parseTempRange(cl[f.key]);
  const wrap = document.createElement("div");
  wrap.className = "cl-range";
  const mkNum = (val, ph) => {
    const i = document.createElement("input");
    i.className = "cl-f-input cl-f-num";
    i.type = "number";
    i.inputMode = "numeric";
    i.placeholder = ph;
    i.value = val;
    return i;
  };
  const lo = mkNum(min, "min"), hi = mkNum(max, "max");
  const commit = () => persist(_formatTempRange(lo.value, hi.value, f.unit));
  [lo, hi].forEach(i => {
    i.addEventListener("change", commit);
    i.addEventListener("keydown", e => { if (e.key === "Enter") i.blur(); });
  });
  wrap.append(lo,
    Object.assign(document.createElement("span"), { className: "cl-range-sep", textContent: "–" }),
    hi);
  if (f.unit) wrap.appendChild(
    Object.assign(document.createElement("span"), { className: "cl-range-unit", textContent: f.unit }));
  row.appendChild(wrap);
}

function _buildClimateSelect(row, f, cl, persist) {
  const sel = document.createElement("select");
  sel.className = "cl-f-input cl-f-select";
  const cur = cl[f.key] || "";
  const opts = [""].concat(f.options || []);
  if (cur && !opts.includes(cur)) opts.push(cur); // keep a legacy/custom value
  opts.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o === "" ? (f.placeholder || "Select…") : o;
    sel.appendChild(opt);
  });
  sel.value = cur;
  sel.addEventListener("change", () => persist(sel.value));
  row.appendChild(sel);
}

function _buildClimateMulti(row, f, cl, persist) {
  const selected = _parseClimateList(cl[f.key]);
  const wrap = document.createElement("div");
  wrap.className = "cl-multi";
  const chips = document.createElement("div");
  chips.className = "cl-chips";
  const sel = document.createElement("select");
  sel.className = "cl-f-input cl-f-select cl-multi-select";
  wrap.append(chips, sel);
  row.appendChild(wrap);

  const commit = () => persist(selected.join(", "));

  const renderChips = () => {
    chips.innerHTML = "";
    if (selected.length === 0) {
      chips.appendChild(Object.assign(document.createElement("span"),
        { className: "cl-chips-empty", textContent: "None yet" }));
    }
    selected.forEach((t, idx) => {
      const chip = document.createElement("span");
      chip.className = "cl-chip";
      chip.appendChild(Object.assign(document.createElement("span"), { textContent: t }));
      const x = document.createElement("button");
      x.type = "button";
      x.className = "cl-chip-x";
      x.title = "Remove";
      x.textContent = "×";
      x.addEventListener("click", () => {
        selected.splice(idx, 1); commit(); renderChips(); renderOptions();
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
  };

  const renderOptions = () => {
    sel.innerHTML = "";
    sel.appendChild(Object.assign(document.createElement("option"),
      { value: "", textContent: f.placeholder || "Add…" }));
    (f.options || []).filter(o => !selected.includes(o)).forEach(o => {
      sel.appendChild(Object.assign(document.createElement("option"),
        { value: o, textContent: o }));
    });
    sel.appendChild(Object.assign(document.createElement("option"),
      { value: "__custom__", textContent: "Custom…" }));
    sel.value = "";
  };

  sel.addEventListener("change", () => {
    let v = sel.value;
    if (v === "__custom__") v = (prompt("Add a custom terrain:") || "").trim();
    if (v && !selected.includes(v)) {
      selected.push(v); commit(); renderChips();
    }
    renderOptions();
  });

  renderChips();
  renderOptions();
}

function renderClimateList() {
  if (!clList) return;
  if (climates.length === 0) {
    clList.innerHTML = `<p class="tt-empty">No climates yet.</p>`;
    return;
  }
  clList.innerHTML = "";
  climates.forEach(cl => {
    const card = document.createElement("div");
    card.className = "cl-card";
    card.style.setProperty("--ac", cl.color || "#3498db");
    card.innerHTML = `
      <div class="cl-card-hdr">
        <span class="cl-dot"></span>
        <span class="cl-card-name">${esc(cl.name)}</span>
        <button class="cl-del" title="Delete climate"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>
      </div>
      <div class="cl-fields"></div>`;

    // Fixed fields — DMs edit values only; labels (and keys) are constant.
    // The control rendered depends on the field's `type` (see CLIMATE_FIELDS).
    // Each persists on commit — one write per edit, not per keystroke.
    const fieldsWrap = card.querySelector(".cl-fields");
    CLIMATE_FIELDS.forEach(f => {
      const row = document.createElement("div");
      row.className = "cl-field-row cl-field-" + (f.type || "text");
      row.appendChild(Object.assign(document.createElement("span"),
        { className: "cl-f-l", textContent: f.label }));
      const persist = v => set(ref(db, `campaigns/${_cid}/climates/${cl.id}/${f.key}`), v);

      if      (f.type === "range")       _buildClimateRange(row, f, cl, persist);
      else if (f.type === "select")      _buildClimateSelect(row, f, cl, persist);
      else if (f.type === "multiselect") _buildClimateMulti(row, f, cl, persist);
      else                               _buildClimateText(row, f, cl, persist);

      fieldsWrap.appendChild(row);
    });

    card.querySelector(".cl-del").addEventListener("click", () => {
      if (!confirm(`Delete climate "${cl.name}"?`)) return;
      remove(ref(db, `campaigns/${_cid}/climates/${cl.id}`));
    });

    clList.appendChild(card);
  });
}

if (clAdd) clAdd.addEventListener("click", () => {
  const name = clName.value.trim();
  if (!name) { clError.textContent = "Name is required."; return; }
  if (climates.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    clError.textContent = "A climate with that name already exists."; return;
  }
  const id = generateId();
  // Create with the fixed fields blank — the DM fills them in on the card below.
  const climate = { id, name, color: _selClimateColor };
  CLIMATE_FIELDS.forEach(f => { climate[f.key] = ""; });
  set(ref(db, `campaigns/${_cid}/climates/${id}`), climate);
  clName.value = ""; clError.textContent = "";
  // List refreshes via the climates onValue listener.
});
if (clName) clName.addEventListener("keydown", e => { if (e.key === "Enter") clAdd.click(); });


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
  mapContainer.classList.add("pen-mode");     // disables marker selection (see CSS)
  penControls.classList.add("visible");
  updatePenDraw();
}

function exitPenMode() {
  penMode   = false;
  penCursor = null;
  penPoints = [];
  if (btnDrawArea) btnDrawArea.classList.remove("active");
  mapContainer.classList.remove("placing-mode");
  mapContainer.classList.remove("pen-mode");
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

// Absolute polygon area (shoelace) — used to order overlapping areas.
function _polyArea(points) {
  if (!points || points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i], p1 = points[(i + 1) % points.length];
    a += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(a) / 2;
}

// Ray-casting point-in-polygon (points share the same percent space).
function _pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function _ringPath(points) {
  return "M" + points.map(p => `${p.x},${p.y}`).join("L") + "Z";
}

// Do segments p1→p2 and p3→p4 cross? (proper intersection via orientation signs)
function _segIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// Two polygons overlap if either contains a vertex of the other, or their
// edges cross (the cross-overlap case where no vertex sits inside).
function _polysOverlap(a, b) {
  if (a.some(p => _pointInPoly(p, b))) return true;
  if (b.some(p => _pointInPoly(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (_segIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

function renderAreas() {
  areaSvg.querySelectorAll(".area-poly").forEach(n => n.remove());
  let defs = areaSvg.querySelector("defs");
  if (defs) defs.remove();
  defs = document.createElementNS(SVG_NS, "defs");
  areaSvg.appendChild(defs);
  areaLabelLayer.innerHTML = "";

  // Paint the largest areas first so smaller, nested ones (lakes, enclaves)
  // stack on top — keeping the inner area clickable instead of being buried.
  const ordered = areas
    .filter(a => a.points && a.points.length >= 3)
    .sort((a, b) => _polyArea(b.points) - _polyArea(a.points));

  ordered.forEach(area => {
    const ring = _ringPath(area.points);

    // Knock a hole wherever a smaller area overlaps this one, so the fills
    // never blend through — each region shows exactly one area's colour. The
    // fill is clipped to this area's own outline so a partially overlapping
    // neighbour's cut ring can't spill colour past the border.
    let d = ring;
    ordered.forEach(other => {
      if (other === area) return;
      if (_polyArea(other.points) >= _polyArea(area.points)) return;
      if (_polysOverlap(area.points, other.points)) d += _ringPath(other.points);
    });

    const clipId = "area-clip-" + area.id;
    const clip = document.createElementNS(SVG_NS, "clipPath");
    clip.id = clipId;
    const clipShape = document.createElementNS(SVG_NS, "path");
    clipShape.setAttribute("d", ring);
    clip.appendChild(clipShape);
    defs.appendChild(clip);

    const poly = document.createElementNS(SVG_NS, "path");
    poly.setAttribute("d", d);
    poly.setAttribute("class", "area-poly area-fill");
    poly.setAttribute("clip-path", `url(#${clipId})`);
    poly.style.setProperty("--ac", area.color || "#3498db");
    if (isAdmin) {
      poly.style.cursor = "pointer";
      poly.style.pointerEvents = "auto";
      poly.addEventListener("click", () => { if (!penMode && !placingMode) openAreaModal(area.id); });
    }
    areaSvg.appendChild(poly);

    // Border is its own ring-only path so cut rings never add stray strokes
    // and the clip doesn't shave the real outline.
    const border = document.createElementNS(SVG_NS, "path");
    border.setAttribute("d", ring);
    border.setAttribute("class", "area-poly area-stroke");
    border.style.setProperty("--ac", area.color || "#3498db");
    areaSvg.appendChild(border);

    // Label sits at its saved spot if the DM has dragged it, else the centroid.
    const c = (area.labelX != null && area.labelY != null)
      ? { x: area.labelX, y: area.labelY }
      : _centroid(area.points);
    const label = document.createElement("div");
    label.className = "area-label";
    label.style.left = c.x + "%";
    label.style.top  = c.y + "%";
    label.style.setProperty("--ac", area.color || "#3498db");
    label.textContent = area.name || "";
    if (isAdmin) {
      label.style.cursor = "grab";
      label.style.pointerEvents = "auto";
      _enableLabelDrag(label, area);
    }
    areaLabelLayer.appendChild(label);
  });

  // Keep the in-progress pen group above the saved areas.
  areaSvg.appendChild(penDrawGroup);
  flushCounterScale();
}

// Drag a label to reposition it; a clean click (no drag) opens the area modal.
function _enableLabelDrag(label, area) {
  let downX, downY, startLeft, startTop, dragging = false, captured = false;

  label.addEventListener("pointerdown", e => {
    if (penMode || placingMode) return;
    e.stopPropagation();
    downX = e.clientX; downY = e.clientY;
    startLeft = parseFloat(label.style.left) || 0;
    startTop  = parseFloat(label.style.top)  || 0;
    dragging  = false;
    captured  = true;
    label.setPointerCapture(e.pointerId);
  });

  label.addEventListener("pointermove", e => {
    if (!captured) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (!dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!dragging) { dragging = true; label.classList.add("dragging"); label.style.cursor = "grabbing"; }
    // Screen px → wrapper percent (wrapper is scaled by `scale`, sized _imgNW×_imgNH).
    const nx = Math.max(0, Math.min(100, startLeft + (dx / scale / _imgNW) * 100));
    const ny = Math.max(0, Math.min(100, startTop  + (dy / scale / _imgNH) * 100));
    label.style.left = nx + "%";
    label.style.top  = ny + "%";
  });

  label.addEventListener("pointerup", e => {
    if (!captured) return;
    captured = false;
    label.classList.remove("dragging");
    label.style.cursor = "grab";
    label.releasePointerCapture(e.pointerId);
    if (dragging) {
      set(ref(db, `campaigns/${_cid}/areas/${area.id}/labelX`), parseFloat(label.style.left));
      set(ref(db, `campaigns/${_cid}/areas/${area.id}/labelY`), parseFloat(label.style.top));
    } else if (!penMode && !placingMode) {
      openAreaModal(area.id);
    }
  });
}

const areaModal       = document.getElementById("area-modal");
const amTitle         = document.getElementById("am-title");
const amName          = document.getElementById("am-name");
const amDesc          = document.getElementById("am-desc");
const amClose         = document.getElementById("am-close");
const amColorSwatches = document.getElementById("am-color-swatches");
const amError         = document.getElementById("am-error");
const amSave          = document.getElementById("am-save");
const amCancel        = document.getElementById("am-cancel");
const amDelete        = document.getElementById("am-delete");
const amClimate       = document.getElementById("am-climate");
const amCreatureName    = document.getElementById("am-creature-name");
const amCreatureRarity  = document.getElementById("am-creature-rarity");
const amCreatureResults = document.getElementById("am-creature-results");
const amCreatureList    = document.getElementById("am-creature-list");

let _editingAreaId     = null;
let _pendingAreaPoints = null;
let _selAreaColor      = COUNTRY_COLORS[0];
let _areaCreatures     = []; // working copy while the modal is open

function openAreaModal(id) {
  _editingAreaId = id;
  const existing = id ? areas.find(a => a.id === id) : null;
  amTitle.textContent    = existing ? "Edit Area" : "Name Area";
  amName.value           = existing?.name || "";
  if (amDesc) amDesc.value = existing?.description || "";
  _selAreaColor          = existing?.color || COUNTRY_COLORS[0];
  _areaCreatures         = (existing?.creatures || []).map(c => ({ ...c }));
  amError.textContent    = "";
  amDelete.style.display = existing ? "inline-flex" : "none";
  _buildAreaColorSwatches();
  populateClimateSelect(existing?.climateId || "");
  if (amCreatureName) amCreatureName.value = "";
  _hideCreatureResults();
  renderAreaCreatures();
  areaModal.classList.add("open");
  amName.focus();
}
function closeAreaModal() {
  areaModal.classList.remove("open");
  _editingAreaId     = null;
  _pendingAreaPoints = null;
  _areaCreatures     = [];
  if (amCreatureName) amCreatureName.value = "";
  _hideCreatureResults();
}

// Climate dropdown — built from the climate registry.
function populateClimateSelect(selectedId) {
  if (!amClimate) return;
  amClimate.innerHTML = `<option value="">— None —</option>`;
  climates.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    amClimate.appendChild(opt);
  });
}

const RARITY_CLASS = { Common: "rar-common", Uncommon: "rar-uncommon", Rare: "rar-rare" };

function renderAreaCreatures() {
  if (!amCreatureList) return;
  if (_areaCreatures.length === 0) {
    amCreatureList.innerHTML = `<p class="am-creature-empty">No creatures added yet.</p>`;
    return;
  }
  amCreatureList.innerHTML = "";
  _areaCreatures.forEach((c, i) => {
    const rarity = c.rarity || "Common";
    const row = document.createElement("div");
    row.className = "am-creature-row";
    row.innerHTML =
      `<span class="am-creature-cname">${esc(c.name)}</span>` +
      `<select class="am-creature-rar-select ${RARITY_CLASS[rarity] || "rar-common"}">` +
        ["Common", "Uncommon", "Rare"].map(r =>
          `<option value="${r}"${r === rarity ? " selected" : ""}>${r}</option>`).join("") +
      `</select>` +
      `<button type="button" class="am-creature-del" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>`;

    const sel = row.querySelector(".am-creature-rar-select");
    sel.addEventListener("change", () => {
      _areaCreatures[i].rarity = sel.value;
      // Recolour the select to match the chosen rarity.
      sel.className = "am-creature-rar-select " + (RARITY_CLASS[sel.value] || "rar-common");
    });

    row.querySelector(".am-creature-del").addEventListener("click", () => {
      _areaCreatures.splice(i, 1);
      renderAreaCreatures();
    });
    amCreatureList.appendChild(row);
  });
}

// ── Creature search — picks only from the campaign's enemy library ────────────
// Adding a creature requires selecting an entry from the shared enemy templates
// (same library as the Combat + Database tabs), so area encounters stay in sync.
function _addAreaCreature(tmpl) {
  if (!tmpl || !tmpl.name) return;
  if (_areaCreatures.some(c => c.name === tmpl.name)) {
    // Already listed — just bump its rarity to the current selection.
    _areaCreatures.find(c => c.name === tmpl.name).rarity = amCreatureRarity.value || "Common";
  } else {
    _areaCreatures.push({ name: tmpl.name, rarity: amCreatureRarity.value || "Common" });
  }
  amCreatureName.value = "";
  _hideCreatureResults();
  renderAreaCreatures();
  amCreatureName.focus();
}

function _hideCreatureResults() {
  if (!amCreatureResults) return;
  amCreatureResults.classList.remove("open");
  amCreatureResults.innerHTML = "";
}

// Render the dropdown of enemy-library matches for the current search query.
function renderCreatureResults() {
  if (!amCreatureResults || !amCreatureName) return;
  const q = amCreatureName.value.trim().toLowerCase();
  if (!q) { _hideCreatureResults(); return; }

  const matches = enemyLib
    .filter(t => (t.name || "").toLowerCase().includes(q))
    .slice(0, 12);

  amCreatureResults.innerHTML = "";
  if (matches.length === 0) {
    amCreatureResults.innerHTML =
      `<div class="am-creature-result-empty">${enemyLib.length
        ? "No matching creatures in the library."
        : "Enemy library is empty — add templates in the Combat tab."}</div>`;
    amCreatureResults.classList.add("open");
    return;
  }

  matches.forEach(t => {
    const meta = [
      t.cr != null && t.cr !== "" ? `CR ${esc(String(t.cr))}` : null,
      t.hp != null && t.hp !== "" ? `HP ${esc(String(t.hp))}` : null,
      t.ac != null && t.ac !== "" ? `AC ${esc(String(t.ac))}` : null,
    ].filter(Boolean).join(" · ");
    const row = document.createElement("div");
    row.className = "am-creature-result";
    row.innerHTML =
      `<span class="acr-name">${esc(t.name)}</span>` +
      (meta ? `<span class="acr-meta">${meta}</span>` : "");
    // mousedown (not click) so the input's blur handler doesn't close us first.
    row.addEventListener("mousedown", e => { e.preventDefault(); _addAreaCreature(t); });
    amCreatureResults.appendChild(row);
  });
  amCreatureResults.classList.add("open");
}

if (amCreatureName) {
  amCreatureName.addEventListener("input", renderCreatureResults);
  amCreatureName.addEventListener("focus", renderCreatureResults);
  amCreatureName.addEventListener("blur",  () => setTimeout(_hideCreatureResults, 150));
  amCreatureName.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      // Library-only: Enter adds the single match if the query is unambiguous.
      e.preventDefault();
      const q = amCreatureName.value.trim().toLowerCase();
      if (!q) return;
      const exact   = enemyLib.find(t => (t.name || "").toLowerCase() === q);
      const matches = enemyLib.filter(t => (t.name || "").toLowerCase().includes(q));
      if (exact)               _addAreaCreature(exact);
      else if (matches.length === 1) _addAreaCreature(matches[0]);
    } else if (e.key === "Escape") {
      _hideCreatureResults();
    }
  });
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
  const area = { id, name, color: _selAreaColor, points };
  // Preserve a dragged label position across edits.
  if (existing?.labelX != null && existing?.labelY != null) {
    area.labelX = existing.labelX;
    area.labelY = existing.labelY;
  }
  const desc = amDesc ? amDesc.value.trim() : "";
  if (desc)                         area.description = desc;
  if (amClimate && amClimate.value) area.climateId = amClimate.value;
  if (_areaCreatures.length)        area.creatures = _areaCreatures.map(c => ({ ...c }));
  set(ref(db, `campaigns/${_cid}/areas/${id}`), area);
  closeAreaModal();
});
if (amCancel) amCancel.addEventListener("click", closeAreaModal);
if (amClose)  amClose.addEventListener("click", closeAreaModal);
if (amDelete) amDelete.addEventListener("click", () => {
  if (!_editingAreaId) return;
  if (!confirm("Delete this area?")) return;
  remove(ref(db, `campaigns/${_cid}/areas/${_editingAreaId}`));
  closeAreaModal();
});
if (areaModal) areaModal.addEventListener("click", e => { if (e.target === areaModal) closeAreaModal(); });
if (amName)    amName.addEventListener("keydown", e => { if (e.key === "Enter") amSave.click(); });
