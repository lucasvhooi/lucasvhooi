// ── Firebase ──────────────────────────────────────────────────────────────────
import { db }                                     from "./firebase.js";
import { ref, set, remove, onValue }              from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const markersRef = ref(db, "markers");

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

// ── Zoom ─────────────────────────────────────────────────────────────────────
mapContainer.addEventListener("wheel", function(e) {
  e.preventDefault();
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
    // Disable marker hit-testing during gesture to avoid hover recalcs
    markerLayer.style.pointerEvents = "none";
    if (e.touches.length === 2) {
      isPinching = true;
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = scale;
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
const isAdmin     = localStorage.getItem("isAdmin") === "true";
let markers       = [];
let placingMode   = false;
let pendingCoords = null;
let editingId     = null;

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
        notes:      mNotes.value.trim()      || null
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
// Fires immediately on load and again whenever any marker is added/edited/deleted
onValue(markersRef, (snapshot) => {
  const data = snapshot.val();
  markers = data ? Object.values(data) : [];
  renderMarkers();
});
