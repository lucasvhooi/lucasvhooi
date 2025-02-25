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
// Desktop: use mouse wheel
mapContainer.addEventListener("wheel", function(e) {
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
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  // Variables for panning
  let touchStartX = 0, touchStartY = 0;
  // Variables for pinch zoom
  let isPinching = false;
  let initialDistance = 0;
  let initialScale = scale;
  
  function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  mapContainer.addEventListener('touchstart', function(e) {
    if(e.touches.length === 2) {
      // Start pinch zoom
      isPinching = true;
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = scale;
    } else if(e.touches.length === 1) {
      // Single touch for panning
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });
  
  mapContainer.addEventListener('touchmove', function(e) {
    if (isPinching && e.touches.length === 2) {
      // Update pinch zoom
      const newDistance = getDistance(e.touches[0], e.touches[1]);
      let zoomFactor = newDistance / initialDistance;
      let newScale = initialScale * zoomFactor;
      newScale = Math.min(Math.max(newScale, 0.1), 5);
      
      // Optionally, compute mid-point to adjust origin for better centering
      const rect = mapContainer.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      originX -= (midX - originX) * (newScale / scale - 1);
      originY -= (midY - originY) * (newScale / scale - 1);
      
      scale = newScale;
      updateTransform();
      e.preventDefault();
    } else if(e.touches.length === 1 && !isPinching) {
      // Panning with one finger
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
  
  mapContainer.addEventListener('touchend', function(e) {
    // Reset pinch flag when fewer than 2 touches remain
    if (e.touches.length < 2) {
      isPinching = false;
    }
  });
  
} else {
  // Desktop: Toggle panning on/off with left mouse click.
  let panningActive = false;
  let lastX, lastY;
  
  mapContainer.addEventListener("mousedown", function(e) {
    if (e.button === 0) {
      // Only toggle if clicking on the container (and not on markers)
      if (
        e.target.id === "map-container" ||
        e.target.id === "map-wrapper" ||
        e.target.id === "map-image"
      ) {
        if (!panningActive) {
          panningActive = true;
          lastX = e.clientX;
          lastY = e.clientY;
          mapContainer.style.cursor = 'grabbing';
        } else {
          panningActive = false;
          mapContainer.style.cursor = 'grab';
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
// Save the savedMarkers array to localStorage
function saveMarkers() {
  localStorage.setItem("markers", JSON.stringify(savedMarkers));
}

// Load saved markers from localStorage and create DOM elements for them
function loadSavedMarkers() {
  const stored = localStorage.getItem("markers");
  if (stored) {
    savedMarkers = JSON.parse(stored);
    savedMarkers.forEach(markerObj => {
      createMarkerElement(markerObj);
    });
  }
}

// Create a marker DOM element based on a marker object and attach event listeners
function createMarkerElement(markerObj) {
  const markerEl = document.createElement("div");
  markerEl.className = "marker";
  markerEl.style.left = markerObj.x + "px";
  markerEl.style.top = markerObj.y + "px";
  markerEl.dataset.id = markerObj.id; // assign unique ID

  if (markerObj.place) {
    markerEl.dataset.place = JSON.stringify(markerObj.place);
    markerEl.title = markerObj.place.name;
  }
  
  // Add a delete cross if in admin mode
  if (isAdmin) {
    const delBtn = document.createElement("span");
    delBtn.textContent = "×";
    delBtn.className = "delete-btn";
    // Stop propagation so the marker's own tap/click isn't triggered
    delBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      deleteMarker(markerEl);
    });
    markerEl.appendChild(delBtn);
  }
  
  // Allow both click and touchend on marker to open modal for assignment
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
  
  // Create a unique ID for the marker (using timestamp)
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

/* --- Delete Marker Function --- */
function deleteMarker(markerEl) {
  const markerId = markerEl.dataset.id;
  // Remove from DOM
  markersContainer.removeChild(markerEl);
  // Remove from savedMarkers array
  savedMarkers = savedMarkers.filter(m => m.id !== markerId);
  saveMarkers();
}

/* --- Modal & Loading Locations from JSON --- */
// Load locations from external JSON file
function loadLocations() {
  fetch('locations.json')
    .then(response => response.json())
    .then(data => {
      flattenedPlaces = flattenPlaces(data);
    })
    .catch(error => {
      console.error("Error loading locations.json:", error);
    });
}

// Flatten nested location JSON into an array of options
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

// Load JSON data on page load
loadLocations();
// Load saved markers from localStorage
loadSavedMarkers();

// Modal elements
const markerModal = document.getElementById("marker-modal");
const placeSelect = document.getElementById("place-select");
const placeInfo = document.getElementById("place-info"); // For detailed info
const saveMarkerBtn = document.getElementById("save-marker");
const cancelMarkerBtn = document.getElementById("cancel-marker");

let currentMarker = null;

// When the select option changes, update detailed info in the modal
placeSelect.addEventListener("change", function() {
  const selectedIndex = placeSelect.value;
  const selectedPlace = flattenedPlaces[selectedIndex];
  placeInfo.innerHTML = `<p><strong>${selectedPlace.name}</strong></p>
                         <p>${selectedPlace.description || "No description available."}</p>
                         ${ selectedPlace.map ? `<img src="${selectedPlace.map}" alt="${selectedPlace.name}" style="max-width:100%; height:auto;">` : ""}`;
});

// Open the modal and populate the select element with places
function openMarkerModal(marker) {
  currentMarker = marker;
  placeSelect.innerHTML = "";
  flattenedPlaces.forEach((place, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${place.name} (${place.continent})`;
    placeSelect.appendChild(option);
  });
  // Trigger a change to display info for the first option by default
  placeSelect.dispatchEvent(new Event("change"));
  markerModal.style.display = "flex";
}

function closeMarkerModal() {
  markerModal.style.display = "none";
  currentMarker = null;
}

// When "Save" is clicked, assign the selected place to the marker and update storage
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

cancelMarkerBtn.addEventListener("click", function() {
  closeMarkerModal();
});
