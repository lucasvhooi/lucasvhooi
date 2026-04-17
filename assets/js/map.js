// ── Firebase ──────────────────────────────────────────────────────────────────
import { db }                                     from "./firebase.js";
import { ref, set, remove, onValue }              from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const markersRef   = ref(db, "markers");
const countriesRef = ref(db, "countries");

// ── Remember last location — redirect if user came back from a location ───────
const _savedLoc = sessionStorage.getItem("lastLocationId");
if (_savedLoc) {
  window.location.replace("location.html?id=" + _savedLoc);
}

// ── Transform State ──────────────────────────────────────────────────────────
let scale = 1;
let minScale = 1;
let originX = 0;
let originY = 0;

const mapContainer = document.getElementById("map-container");
const mapWrapper   = document.getElementById("map-wrapper");
const mapImage     = document.getElementById("map-image");
const markerLayer  = document.getElementById("marker-layer");

mapImage.draggable = false;
mapImage.addEventListener("dragstart", (e) => e.preventDefault());

// Cache container rect to avoid layout thrashing in touch hot-path
let _cachedRect = { left: 0, top: 0, width: 0, height: 0 };
function _updateCachedRect() {
  _cachedRect = mapContainer.getBoundingClientRect();
}
window.addEventListener("resize", _updateCachedRect, { passive: true });
// Will be updated once on first layout
requestAnimationFrame(_updateCachedRect);

function updateTransform() {
  // translate3d forces GPU compositing — only touch the composited property
  mapWrapper.style.transform = `translate3d(${originX}px, ${originY}px, 0) scale(${scale})`;
}

// --counter-scale triggers a style recalc on every marker — only flush it
// when the gesture ends, not on every move frame.
function flushCounterScale() {
  mapWrapper.style.setProperty("--counter-scale", 1 / scale);
}

// Debounced flush for wheel zoom (fires 120ms after the last wheel event)
let _wheelFlushTimer = 0;
function scheduleCounterScaleFlush() {
  clearTimeout(_wheelFlushTimer);
  _wheelFlushTimer = setTimeout(flushCounterScale, 120);
}

// rAF throttle — batch all move events into one DOM write per display frame
let rafPending = false;
function scheduleTransform() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    clampToBounds();
    updateTransform();
    rafPending = false;
  });
}

function fitMapToContainer() {
  _updateCachedRect();
  const containerRect = _cachedRect;
  if (!mapImage.naturalWidth || !mapImage.naturalHeight) return;

  mapWrapper.style.width  = `${mapImage.naturalWidth}px`;
  mapWrapper.style.height = `${mapImage.naturalHeight}px`;

  const scaleX = containerRect.width  / mapImage.naturalWidth;
  const scaleY = containerRect.height / mapImage.naturalHeight;

  scale    = Math.max(scaleX, scaleY);
  minScale = scale;

  const scaledWidth  = mapImage.naturalWidth  * scale;
  const scaledHeight = mapImage.naturalHeight * scale;

  originX = (containerRect.width  - scaledWidth)  / 2;
  originY = (containerRect.height - scaledHeight) / 2;

  clampToBounds();
  updateTransform();
  flushCounterScale();
}

if (mapImage.complete) {
  fitMapToContainer();
} else {
  mapImage.addEventListener("load", fitMapToContainer);
}

window.addEventListener("resize", fitMapToContainer);

function clampToBounds() {
  const scaledWidth  = mapImage.naturalWidth  * scale;
  const scaledHeight = mapImage.naturalHeight * scale;

  const minX = Math.min(0, _cachedRect.width  - scaledWidth);
  const minY = Math.min(0, _cachedRect.height - scaledHeight);

  originX = Math.min(0, Math.max(minX, originX));
  originY = Math.min(0, Math.max(minY, originY));
}

// ── Zoom quality ─────────────────────────────────────────────────────────────
// Switch to nearest-neighbour during active zoom to avoid expensive resampling
// on every frame. Quality is restored 150 ms after the last zoom event.
let _imgQualityTimer = 0;
function _setFastRendering() {
  mapImage.style.imageRendering = 'pixelated';
}
function _restoreRendering() {
  mapImage.style.imageRendering = '';
}
function _scheduleRenderingRestore() {
  clearTimeout(_imgQualityTimer);
  _imgQualityTimer = setTimeout(_restoreRendering, 150);
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
mapContainer.addEventListener("wheel", function(e) {
  e.preventDefault();
  _setFastRendering();
  _scheduleRenderingRestore();
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
});

// ── Pan (Desktop) ─────────────────────────────────────────────────────────────
let isDragging  = false;
let didDrag     = false;
let startX, startY;

mapContainer.addEventListener("pointerdown", function(e) {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  isDragging = true;
  didDrag    = false;
  startX = e.clientX;
  startY = e.clientY;
  mapContainer.style.cursor = placingMode ? "crosshair" : "grabbing";
  mapContainer.setPointerCapture(e.pointerId);
});

mapContainer.addEventListener("pointermove", function(e) {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;
  startX = e.clientX;
  startY = e.clientY;
  originX += dx;
  originY += dy;
  scheduleTransform();
});

mapContainer.addEventListener("pointerup", function(e) {
  if (!isDragging) return;
  isDragging = false;

  // Place marker on clean click (no drag) in placing mode
  if (placingMode && !didDrag && isAdmin && e.pointerType === "mouse") {
    const clickX = e.clientX - _cachedRect.left;
    const clickY = e.clientY - _cachedRect.top;
    pendingCoords   = screenToPct(clickX, clickY);
    pendingCoords.x = Math.max(0, Math.min(100, pendingCoords.x));
    pendingCoords.y = Math.max(0, Math.min(100, pendingCoords.y));
    openPlaceModal();
    return;
  }

  mapContainer.style.cursor = placingMode ? "crosshair" : "grab";
});

mapContainer.addEventListener("pointercancel", function() {
  isDragging = false;
  mapContainer.style.cursor = placingMode ? "crosshair" : "grab";
});

// ── Touch Support ─────────────────────────────────────────────────────────────
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  let touchStartX = 0, touchStartY = 0;
  let isPinching = false;
  let initialDistance = 0;
  let initialScale = scale;

  function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  mapContainer.addEventListener("touchstart", function(e) {
    _updateCachedRect();
    // Disable marker hit-testing during gesture to avoid hover recalcs
    markerLayer.style.pointerEvents = "none";
    if (e.touches.length === 2) {
      isPinching = true;
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = scale;
      _setFastRendering();
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  mapContainer.addEventListener("touchmove", function(e) {
    e.preventDefault();
    if (isPinching && e.touches.length === 2) {
      const newDistance = getDistance(e.touches[0], e.touches[1]);
      let newScale = initialScale * (newDistance / initialDistance);
      newScale = Math.min(Math.max(newScale, minScale), 5);

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - _cachedRect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - _cachedRect.top;
      originX -= (midX - originX) * (newScale / scale - 1);
      originY -= (midY - originY) * (newScale / scale - 1);

      scale = newScale;
      scheduleTransform();
    } else if (e.touches.length === 1 && !isPinching) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      originX += currentX - touchStartX;
      originY += currentY - touchStartY;
      touchStartX = currentX;
      touchStartY = currentY;
      scheduleTransform();
    }
  }, { passive: false });

  function onTouchDone() {
    _restoreRendering();
    markerLayer.style.pointerEvents = "";
    flushCounterScale();
  }

  mapContainer.addEventListener("touchcancel", onTouchDone, { passive: true });

  mapContainer.addEventListener("touchend", function(e) {
    if (e.touches.length < 2) isPinching = false;
    if (e.touches.length === 0) {
      // Restore marker interaction and sync counter-scale now that gesture is done
      onTouchDone();
    }

    // Tap to place marker (DM on mobile)
    if (placingMode && isAdmin && !isPinching && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);
      if (dx < 12 && dy < 12) {
        const rect = mapContainer.getBoundingClientRect();
        pendingCoords   = screenToPct(touch.clientX - rect.left, touch.clientY - rect.top);
        pendingCoords.x = Math.max(0, Math.min(100, pendingCoords.x));
        pendingCoords.y = Math.max(0, Math.min(100, pendingCoords.y));
        openPlaceModal();
      }
    }
  });
}

// ── Marker System ─────────────────────────────────────────────────────────────
const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();
let markers       = [];
let countries     = [];
let placingMode   = false;
let pendingCoords = null;
let editingId     = null;

// ── Country colours ───────────────────────────────────────────────────────────
const COUNTRY_COLORS = [
  "#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c",
  "#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a",
  "#ff5722","#78909c"
];

function saveMarker(marker) {
  set(ref(db, "markers/" + marker.id), marker);
}

function deleteMarkerById(id) {
  remove(ref(db, "markers/" + id));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Convert screen coords (relative to container) → image-percentage coords
function screenToPct(screenX, screenY) {
  const imageX = (screenX - originX) / scale;
  const imageY = (screenY - originY) / scale;
  return {
    x: (imageX / mapImage.naturalWidth)  * 100,
    y: (imageY / mapImage.naturalHeight) * 100
  };
}

function renderMarkers() {
  markerLayer.innerHTML = "";

  markers.forEach(marker => {
    if (!isAdmin && marker.explored !== true) return;

    const el = document.createElement("div");
    el.className          = "map-marker";
    el.dataset.id         = marker.id;
    el.dataset.type       = marker.type || "Other";
    el.dataset.explored   = marker.explored !== false ? "true" : "false";

    // Percentage positions relative to the wrapper's natural image size
    el.style.left = marker.x + "%";
    el.style.top  = marker.y + "%";

    // Stop pointerdown from bubbling to mapContainer (prevents drag hijack)
    el.addEventListener("pointerdown", (e) => e.stopPropagation());

    // Pin dot
    const pin = document.createElement("div");
    pin.className = "marker-pin";

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "marker-tooltip";

    let html = `<div class="tooltip-name">${marker.name}</div>`;
    if (marker.type) {
      html += `<div class="tooltip-type">${marker.type}</div>`;
    }
    if (marker.population) {
      html += `<div class="tooltip-row">Population: ${marker.population}</div>`;
    }
    if (marker.wealth) {
      html += `<div class="tooltip-row">Wealth: ${marker.wealth}</div>`;
    }
    if (marker.mainRace) {
      html += `<div class="tooltip-row">Majority: ${marker.mainRace}</div>`;
    }
    if (marker.religion) {
      html += `<div class="tooltip-row">Religion: ${marker.religion}</div>`;
    }
    if (isAdmin && marker.notes) {
      html += `<div class="tooltip-notes">${marker.notes}</div>`;
    }
    tooltip.innerHTML = html;

    el.appendChild(pin);
    el.appendChild(tooltip);

    // DM-only edit/delete controls
    if (isAdmin) {
      const controls = document.createElement("div");
      controls.className = "marker-dm-controls";

      const editBtn = document.createElement("button");
      editBtn.className   = "marker-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditModal(marker.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className   = "marker-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${marker.name}"? This cannot be undone.`)) return;
        deleteMarkerById(marker.id);
      });

      controls.appendChild(editBtn);
      controls.appendChild(deleteBtn);
      el.appendChild(controls);
    }

    // Click / tap → open location detail page (save id so Map tab returns here)
    el.addEventListener("click", () => {
      sessionStorage.setItem("lastLocationId", marker.id);
      window.location.href = `location.html?id=${marker.id}`;
    });

    markerLayer.appendChild(el);
  });
}

// ── Place Mode ────────────────────────────────────────────────────────────────
const btnPlaceMarker = document.getElementById("btn-place-marker");

// Stop toolbar events from bubbling to the map container
const dmToolbar = document.getElementById("dm-toolbar");
if (dmToolbar) {
  dmToolbar.addEventListener("click",       (e) => e.stopPropagation());
  dmToolbar.addEventListener("pointerdown", (e) => e.stopPropagation());
}

// Banner shown at bottom of map when placing mode is active
const placingBanner = document.createElement("div");
placingBanner.id = "placing-banner";
placingBanner.textContent = "Click anywhere on the map to place a marker";
mapContainer.appendChild(placingBanner);

if (btnPlaceMarker) {
  btnPlaceMarker.addEventListener("click", () => {
    placingMode = !placingMode;
    btnPlaceMarker.textContent = placingMode ? "Cancel Placing" : "Place Marker";
    btnPlaceMarker.classList.toggle("active", placingMode);
    mapContainer.classList.toggle("placing-mode", placingMode);
    placingBanner.classList.toggle("visible", placingMode);
  });
}

// Placing is handled in pointerup above.

// ── Marker Modal ──────────────────────────────────────────────────────────────
const markerModal  = document.getElementById("marker-modal");
const modalTitle   = document.getElementById("modal-title");
const mName        = document.getElementById("m-name");
const mType        = document.getElementById("m-type");
const mPopulation  = document.getElementById("m-population");
const mWealth      = document.getElementById("m-wealth");
const mMainRace    = document.getElementById("m-main-race");
const mReligion    = document.getElementById("m-religion");
const mExplored    = document.getElementById("m-explored");
const mNotes       = document.getElementById("m-notes");
const modalError   = document.getElementById("modal-error");
const mSave        = document.getElementById("m-save");
const mCancel      = document.getElementById("m-cancel");

function openPlaceModal() {
  editingId = null;
  modalTitle.textContent = "Place Marker";
  mName.value       = "";
  mType.value       = "City";
  mPopulation.value = "";
  mWealth.value     = "";
  mMainRace.value   = "";
  mReligion.value   = "";
  mExplored.checked = false;
  mNotes.value      = "";
  modalError.textContent = "";
  populateCountrySelect("");
  markerModal.classList.add("open");
  mName.focus();
}

function openEditModal(id) {
  const marker = markers.find(m => m.id === id);
  if (!marker) return;

  editingId = id;
  modalTitle.textContent  = "Edit Marker";
  mName.value             = marker.name       || "";
  mType.value             = marker.type       || "City";
  mPopulation.value       = marker.population || "";
  mWealth.value           = marker.wealth     || "";
  mMainRace.value         = marker.mainRace   || "";
  mReligion.value         = marker.religion   || "";
  mExplored.checked       = marker.explored   === true;
  mNotes.value            = marker.notes      || "";
  modalError.textContent  = "";
  populateCountrySelect(marker.countryId || "");
  markerModal.classList.add("open");
  mName.focus();
}

function exitPlaceMode() {
  placingMode = false;
  if (btnPlaceMarker) {
    btnPlaceMarker.textContent = "Place Marker";
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
  if (!name) {
    modalError.textContent = "Name is required.";
    return;
  }

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

// Close modal on overlay click
markerModal.addEventListener("click", (e) => {
  if (e.target === markerModal) closeMarkerModal(!!editingId);
});

// Allow Enter to submit the form
mName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") mSave.click();
});


// ── Show DM Toolbar ───────────────────────────────────────────────────────────
if (isAdmin && dmToolbar) {
  dmToolbar.style.display = "flex";
}

// ── Firebase Live Sync ────────────────────────────────────────────────────────
onValue(markersRef, snapshot => {
  const data = snapshot.val();
  markers = data ? Object.values(data) : [];
  renderMarkers();
  renderLocationList();
});

const DEFAULT_COUNTRIES = [
  { name: "Gelonus",         color: "#e74c3c" },
  { name: "Elysium Coloney", color: "#e67e22" },
  { name: "Arcadia",         color: "#2ecc71" },
  { name: "Thule",           color: "#3498db" },
  { name: "Hermesia",        color: "#9b59b6" },
  { name: "Elysium",         color: "#1abc9c" },
  { name: "Noxus",           color: "#e91e63" },
  { name: "Pythos",          color: "#f1c40f" },
];

let _countriesSeeded = false;

onValue(countriesRef, snapshot => {
  const data = snapshot.val();
  countries = data ? Object.values(data) : [];

  // One-time seed on first load when the list is empty
  if (!_countriesSeeded && countries.length === 0) {
    _countriesSeeded = true;
    DEFAULT_COUNTRIES.forEach(c => {
      const id = generateId();
      set(ref(db, `countries/${id}`), { id, name: c.name, color: c.color, description: null });
    });
    return; // onValue fires again once the writes land
  }
  _countriesSeeded = true;

  // Collapse all countries by default on first load
  if (!_defaultCollapseApplied) {
    _defaultCollapseApplied = true;
    countries.forEach(c => collapsedCountries.add(c.id));
    collapsedCountries.add("__unassigned__");
  }

  renderLocationList();
  populateCountrySelect();
});

// ── Location Panel ────────────────────────────────────────────────────────────
const locationPanel  = document.getElementById("location-panel");
const lpOpenBtn      = document.getElementById("lp-open-btn");
const lpCloseBtn     = document.getElementById("lp-close-btn");
const lpBody         = document.getElementById("lp-body");
const lpSearch       = document.getElementById("lp-search");
const lpAddCountryBtn = document.getElementById("lp-add-country-btn");
const lpResizeHandle = document.getElementById("lp-resize-handle");

let lpSearchQuery = "";
const collapsedCountries = new Set();  // ids of collapsed country sections
let _defaultCollapseApplied = false;

// Show admin-only panel controls
if (isAdmin) {
  lpAddCountryBtn.style.display = "inline-flex";
}

// Prevent clicks/drags on the button and panel from bubbling into the map's
// pointerdown handler (which would call setPointerCapture and swallow the click).
lpOpenBtn.addEventListener("pointerdown",      e => e.stopPropagation());
locationPanel.addEventListener("pointerdown",  e => e.stopPropagation());

// Prevent scrolling inside the panel from zooming the map.
locationPanel.addEventListener("wheel", e => e.stopPropagation(), { passive: true });

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
let isResizing       = false;
let resizeStartX     = 0;
let resizeStartWidth = 0;
const LP_MIN = 200;
const LP_MAX = 520;

lpResizeHandle.addEventListener("pointerdown", e => {
  isResizing       = true;
  resizeStartX     = e.clientX;
  resizeStartWidth = locationPanel.offsetWidth;
  document.body.style.userSelect = "none";
  lpResizeHandle.setPointerCapture(e.pointerId);
  e.stopPropagation();
});

lpResizeHandle.addEventListener("pointermove", e => {
  if (!isResizing) return;
  const dx = resizeStartX - e.clientX;
  const w  = Math.min(LP_MAX, Math.max(LP_MIN, resizeStartWidth + dx));
  locationPanel.style.width = w + "px";
});

lpResizeHandle.addEventListener("pointerup",     () => { isResizing = false; document.body.style.userSelect = ""; });
lpResizeHandle.addEventListener("pointercancel", () => { isResizing = false; document.body.style.userSelect = ""; });

// ── Render location list ──────────────────────────────────────────────────────
function renderLocationList() {
  lpBody.innerHTML = "";

  const visibleMarkers = markers.filter(m => {
    if (!isAdmin && m.explored !== true) return false;
    if (!lpSearchQuery) return true;
    return (m.name || "").toLowerCase().includes(lpSearchQuery)
        || (m.type || "").toLowerCase().includes(lpSearchQuery);
  });

  if (visibleMarkers.length === 0) {
    lpBody.innerHTML = `<p class="lp-empty">${lpSearchQuery ? "No matches found." : "No locations added yet."}</p>`;
    return;
  }

  // Group by country
  const groups = [];
  countries.forEach(c => {
    const items = visibleMarkers.filter(m => m.countryId === c.id);
    groups.push({ type: "country", country: c, items });
  });
  const unassigned = visibleMarkers.filter(m => !m.countryId || !countries.find(c => c.id === m.countryId));
  if (unassigned.length > 0) {
    groups.push({ type: "unassigned", items: unassigned });
  }

  // If no countries exist at all, render a flat list
  if (countries.length === 0) {
    visibleMarkers.forEach(m => lpBody.appendChild(buildLocationItem(m)));
    return;
  }

  groups.forEach(group => {
    if (group.items.length === 0 && lpSearchQuery) return; // hide empty groups when searching

    if (group.type === "country") {
      lpBody.appendChild(buildCountrySection(group.country, group.items));
    } else {
      lpBody.appendChild(buildUnassignedSection(group.items));
    }
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
        <button class="lp-icon-btn lp-edit-country" title="Edit country" data-id="${country.id}">&#9998;</button>
        <button class="lp-icon-btn lp-del-country"  title="Delete country" data-id="${country.id}">&#128465;</button>
      ` : ""}
      <button class="lp-icon-btn lp-collapse-btn" title="${isCollapsed ? "Expand" : "Collapse"}">${isCollapsed ? "&#9654;" : "&#9660;"}</button>
    </div>
  `;

  if (country.description) {
    const desc = document.createElement("div");
    desc.className = "lp-country-desc";
    desc.textContent = country.description;
    header.appendChild(desc);
  }

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "lp-country-items" + (isCollapsed ? " collapsed" : "");
  items.forEach(m => itemsWrap.appendChild(buildLocationItem(m)));

  // Collapse toggle
  header.querySelector(".lp-collapse-btn").addEventListener("click", e => {
    e.stopPropagation();
    if (collapsedCountries.has(country.id)) {
      collapsedCountries.delete(country.id);
    } else {
      collapsedCountries.add(country.id);
    }
    renderLocationList();
  });

  // Edit country
  if (isAdmin) {
    header.querySelector(".lp-edit-country").addEventListener("click", e => {
      e.stopPropagation();
      openCountryModal(country.id);
    });
    header.querySelector(".lp-del-country").addEventListener("click", e => {
      e.stopPropagation();
      if (!confirm(`Delete country "${country.name}"? Markers will become unassigned.`)) return;
      remove(ref(db, `countries/${country.id}`));
      // Clear countryId from markers
      markers.filter(m => m.countryId === country.id).forEach(m => {
        set(ref(db, `markers/${m.id}/countryId`), null);
      });
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
      <button class="lp-icon-btn lp-collapse-btn">${isCollapsed ? "&#9654;" : "&#9660;"}</button>
    </div>
  `;


  const itemsWrap = document.createElement("div");
  itemsWrap.className = "lp-country-items" + (isCollapsed ? " collapsed" : "");
  items.forEach(m => itemsWrap.appendChild(buildLocationItem(m)));

  header.querySelector(".lp-collapse-btn").addEventListener("click", e => {
    e.stopPropagation();
    collapsedCountries.has("__unassigned__")
      ? collapsedCountries.delete("__unassigned__")
      : collapsedCountries.add("__unassigned__");
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
    <button class="lp-item-goto" title="Focus on map">&#10148;</button>
  `;

  item.querySelector(".lp-item-goto").addEventListener("click", e => {
    e.stopPropagation();
    focusMarker(marker);
  });

  item.addEventListener("click", () => {
    sessionStorage.setItem("lastLocationId", marker.id);
    window.location.href = `location.html?id=${marker.id}`;
  });

  return item;
}

function focusMarker(marker) {
  _updateCachedRect();
  const imageX = (marker.x / 100) * mapImage.naturalWidth;
  const imageY = (marker.y / 100) * mapImage.naturalHeight;
  originX = _cachedRect.width  / 2 - imageX * scale;
  originY = _cachedRect.height / 2 - imageY * scale;
  clampToBounds();
  updateTransform();

  // Flash the pin
  const pin = markerLayer.querySelector(`[data-id="${marker.id}"] .marker-pin`);
  if (pin) {
    pin.classList.remove("focused");
    void pin.offsetWidth; // force reflow to restart animation
    pin.classList.add("focused");
    setTimeout(() => pin.classList.remove("focused"), 1400);
  }
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Country Modal ─────────────────────────────────────────────────────────────
const countryModal   = document.getElementById("country-modal");
const cmModalTitle   = document.getElementById("cm-modal-title");
const cmName         = document.getElementById("cm-name");
const cmDesc         = document.getElementById("cm-desc");
const cmColorSwatches = document.getElementById("cm-color-swatches");
const cmError        = document.getElementById("cm-error");
const cmSave         = document.getElementById("cm-save");
const cmCancel       = document.getElementById("cm-cancel");

let editingCountryId  = null;
let selectedCountryColor = COUNTRY_COLORS[0];

lpAddCountryBtn.addEventListener("click", () => openCountryModal(null));

function openCountryModal(id) {
  editingCountryId = id;
  const existing   = id ? countries.find(c => c.id === id) : null;
  cmModalTitle.textContent     = existing ? "Edit Country" : "Add Country";
  cmName.value                 = existing ? (existing.name  || "") : "";
  cmDesc.value                 = existing ? (existing.description || "") : "";
  selectedCountryColor         = existing ? (existing.color || COUNTRY_COLORS[0]) : COUNTRY_COLORS[0];
  cmError.textContent          = "";
  buildCountryColorSwatches();
  countryModal.classList.add("open");
  cmName.focus();
}

function buildCountryColorSwatches() {
  cmColorSwatches.innerHTML = "";
  COUNTRY_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = "country-color-swatch" + (color === selectedCountryColor ? " selected" : "");
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      selectedCountryColor = color;
      cmColorSwatches.querySelectorAll(".country-color-swatch").forEach(s =>
        s.classList.toggle("selected", s.title === color));
    });
    cmColorSwatches.appendChild(sw);
  });
}

function closeCountryModal() {
  countryModal.classList.remove("open");
  editingCountryId = null;
}

cmSave.addEventListener("click", () => {
  const name = cmName.value.trim();
  if (!name) { cmError.textContent = "Name is required."; return; }
  const id = editingCountryId || generateId();
  set(ref(db, `countries/${id}`), {
    id,
    name,
    color:       selectedCountryColor,
    description: cmDesc.value.trim() || null
  });
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
