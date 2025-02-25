// Check if the user is in admin mode
const isAdmin = localStorage.getItem("isAdmin") === "true";

// Initial transform values for zoom and pan
let scale = 1;
let originX = 0;
let originY = 0;

const mapContainer = document.getElementById("map-container");
const mapWrapper = document.getElementById("map-wrapper");
const markersContainer = document.getElementById("markers-container");

// Global variable to store flattened place options (loaded from locations.json)
let flattenedPlaces = [];

// Global array to store marker objects for persistence
// Each marker object: { id, x, y, place }
let savedMarkers = [];

// Update the transform on the map wrapper
function updateTransform() {
  mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
}

/* --- Zooming --- */
// Disable zoom if modal is open
mapContainer.addEventListener("wheel", function(e) {
  if (markerModal.style.display === "flex") return; // do not zoom when popup is open
  e.preventDefault();
  const zoomIntensity = 0.001;
  const delta = e.deltaY;
  let newScale = scale * (1 - delta * zoomIntensity);
  newScale = Math.min(Math.max(newScale, 0.1), 5);
  const rect = mapContainer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  originX -= (mouseX - originX) * (newScale / scale - 1);
  originY -= (mouseY - originY) * (newScale / scale - 1);
  scale = newScale;
  updateTransform();
});

/* --- Panning & Pinch-Zoom on Mobile --- */
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  // Variables for single-touch panning
  let touchStartX = 0, touchStartY = 0;
  // Variables for pinch zoom
  let isPinching = false;
  let initialDistance = 0;
  let initialScale = scale;
  
  function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  mapContainer.addEventListener("touchstart", function(e) {
    if (e.touches.length === 2) {
      isPinching = true;
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = scale;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });
  
  mapContainer.addEventListener("touchmove", function(e) {
    if (isPinching && e.touches.length === 2) {
      const newDistance = getDistance(e.touches[0], e.touches[1]);
      let zoomFactor = newDistance / initialDistance;
      let newScale = initialScale * zoomFactor;
      newScale = Math.min(Math.max(newScale, 0.1), 5);
      
      // Use midpoint between touches for centering
      const rect = mapContainer.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      originX -= (midX - originX) * (newScale / scale - 1);
      originY -= (midY - originY) * (newScale / scale - 1);
      
      scale = newScale;
      updateTransform();
      e.preventDefault();
    } else if (e.touches.length === 1 && !isPinching) {
      let currentX = e.touches[0].clientX;
      let currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dy = currentY - touchStartY;
      originX += dx;
      originY += dy;
      updateTransform();
      touchStartX = currentX;
      touchStartY = currentY;
      e.preventDefault();
    }
  }, { passive: false });
  
  mapContainer.addEventListener("touchend", function(e) {
    if (e.touches.length < 2) {
      isPinching = false;
    }
  });
} else {
  // Desktop: Toggle panning on/off with left mouse click.
  let panningActive = false;
  let lastX, lastY;
  
  mapContainer.addEventListener("mousedown", function(e) {
    if (e.button === 0) { // Left mouse button
      if (
        e.target.id === "map-container" ||
        e.target.id === "map-wrapper" ||
        e.target.id === "map-image"
      ) {
        if (!panningActive) {
          panningActive = true;
          lastX = e.clientX;
          lastY = e.clientY;
          mapContainer.style.cursor = "grabbing";
        } else {
          panningActive = false;
          mapContainer.style.cursor = "grab";
        }
      }
    }
  });
  
  document.addEventListener("mousemove", function(e) {
    if (panningActive) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      originX += dx;
      originY += dy;
      updateTransform();
    }
  });
}

/* --- Persistence Functions --- */
// Save markers to localStorage
function saveMarkers() {
  localStorage.setItem("markers", JSON.stringify(savedMarkers));
}

// Load saved markers from localStorage and create their DOM elements
function loadSavedMarkers() {
  const stored = localStorage.getItem("markers");
  if (stored) {
    savedMarkers = JSON.parse(stored);
    savedMarkers.forEach(markerObj => {
      createMarkerElement(markerObj);
    });
  }
}

// Create a marker DOM element based on a marker object
function createMarkerElement(markerObj) {
  const markerEl = document.createElement("div");
  markerEl.className = "marker";
  markerEl.style.left = markerObj.x + "px";
  markerEl.style.top = markerObj.y + "px";
  markerEl.dataset.id = markerObj.id;
  
  if (markerObj.place) {
    markerEl.dataset.place = JSON.stringify(markerObj.place);
    markerEl.title = markerObj.place.name;
  }
  
  // Allow click/touch to open modal for assignment (admin mode)
  markerEl.addEventListener("click", function(e) {
    e.stopPropagation();
    if (!isAdmin) return;
    openMarkerModal(markerEl);
  });
  markerEl.addEventListener("touchend", function(e) {
    e.stopPropagation();
    if (!isAdmin) return;
    openMarkerModal(markerEl);
  });
  
  markersContainer.appendChild(markerEl);
}

/* --- Admin Mode: Place Marker on Right-Click --- */
mapContainer.addEventListener("contextmenu", function(e) {
  if (!isAdmin) return;
  e.preventDefault();
  const rect = mapContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Convert screen coordinates to map coordinates
  const mapX = (clickX - originX) / scale;
  const mapY = (clickY - originY) / scale;
  
  const markerId = Date.now().toString();
  const markerObj = {
    id: markerId,
    x: mapX,
    y: mapY,
    place: null
  };
  savedMarkers.push(markerObj);
  saveMarkers();
  createMarkerElement(markerObj);
});

/* --- Modal & Location Selection --- */
// Load locations from external JSON file
function loadLocations() {
  fetch("locations.json")
    .then(response => response.json())
    .then(data => {
      flattenedPlaces = flattenPlaces(data);
    })
    .catch(error => {
      console.error("Error loading locations.json:", error);
    });
}

// Flatten nested JSON structure into an array of options
function flattenPlaces(data) {
  const options = [];
  for (const continentKey in data.continents) {
    const continent = data.continents[continentKey];
    for (const locKey in continent.locations) {
      const loc = continent.locations[locKey];
      options.push({
        continent: continent.name,
        key: locKey,
        name: loc.name,
        description: loc.description,
        map: loc.map
      });
    }
  }
  return options;
}

// Load locations and saved markers on page load
loadLocations();
loadSavedMarkers();

// Modal elements
const markerModal = document.getElementById("marker-modal");
const placeSelect = document.getElementById("place-select");
const placeInfo = document.getElementById("place-info"); // For detailed info display
const saveMarkerBtn = document.getElementById("save-marker");
const cancelMarkerBtn = document.getElementById("cancel-marker");
const deleteMarkerBtn = document.getElementById("delete-marker");

let currentMarker = null;

// When the select option changes, update the detailed info in the popup
placeSelect.addEventListener("change", function() {
  const selectedIndex = placeSelect.value;
  const selectedPlace = flattenedPlaces[selectedIndex];
  placeInfo.innerHTML = `<p style="color: black;"><strong>${selectedPlace.name}</strong></p>
                         <p style="color: black;">${selectedPlace.description || "No description available."}</p>
                         ${
                           selectedPlace.map
                             ? `<img src="${selectedPlace.map}" alt="${selectedPlace.name}" style="max-width:200px; height:auto;">`
                             : ""
                         }`;
});

// Close modal when clicking outside the modal content
markerModal.addEventListener("click", function(e) {
  if (e.target === markerModal) {
    closeMarkerModal();
  }
});

// Open the modal for a marker
function openMarkerModal(marker) {
  currentMarker = marker;
  // Populate the dropdown with options from flattenedPlaces
  placeSelect.innerHTML = "";
  flattenedPlaces.forEach((place, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${place.name} (${place.continent})`;
    placeSelect.appendChild(option);
  });
  // If the marker already has an assigned place, pre-select it
  if (currentMarker.dataset.place) {
    const assigned = JSON.parse(currentMarker.dataset.place);
    const idx = flattenedPlaces.findIndex(p => p.name === assigned.name);
    if (idx >= 0) {
      placeSelect.value = idx;
    }
  }
  // Trigger a change event to update detailed info in the popup
  placeSelect.dispatchEvent(new Event("change"));
  
  // Show delete button only if marker already has a place assigned and in admin mode
  if (isAdmin && currentMarker.dataset.place) {
    deleteMarkerBtn.style.display = "block";
  } else {
    deleteMarkerBtn.style.display = "none";
  }
  
  markerModal.style.display = "flex";
}

// Close the modal
function closeMarkerModal() {
  markerModal.style.display = "none";
  currentMarker = null;
}

// Save the selected location to the marker and update storage
saveMarkerBtn.addEventListener("click", function() {
  if (currentMarker) {
    const selectedIndex = placeSelect.value;
    const selectedPlace = flattenedPlaces[selectedIndex];
    currentMarker.dataset.place = JSON.stringify(selectedPlace);
    currentMarker.title = selectedPlace.name;
    
    // Update the corresponding marker object in savedMarkers
    const markerId = currentMarker.dataset.id;
    const markerObj = savedMarkers.find(m => m.id === markerId);
    if (markerObj) {
      markerObj.place = selectedPlace;
      saveMarkers();
    }
  }
  closeMarkerModal();
});

// Cancel button just closes the modal
cancelMarkerBtn.addEventListener("click", function() {
  closeMarkerModal();
});

// Delete marker button in the popup (cross)
deleteMarkerBtn.addEventListener("click", function(e) {
  e.stopPropagation();
  if (currentMarker) {
    const markerId = currentMarker.dataset.id;
    markersContainer.removeChild(currentMarker);
    savedMarkers = savedMarkers.filter(m => m.id !== markerId);
    saveMarkers();
  }
  closeMarkerModal();
});
