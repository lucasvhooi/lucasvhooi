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

/* --- Panning --- */
// Determine if the device supports touch
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  // Mobile: use standard drag behavior with touch events
  let touchStartX = 0, touchStartY = 0;
  mapContainer.addEventListener('touchstart', function(e) {
    if(e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });
  mapContainer.addEventListener('touchmove', function(e) {
    if(e.touches.length === 1) {
      let currentX = e.touches[0].clientX;
      let currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dy = currentY - touchStartY;
      originX += dx;
      originY += dy;
      updateTransform();
      touchStartX = currentX;
      touchStartY = currentY;
    }
    e.preventDefault();
  }, { passive: false });
} else {
  // Desktop: Toggle panning on/off with left mouse clicks.
  let panningActive = false;
  let lastX, lastY;

  mapContainer.addEventListener("mousedown", function(e) {
    if (e.button === 0) { // Left mouse button
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

  // On left-click, open the modal to assign/update place (admin mode only)
  markerEl.addEventListener("click", function(e) {
    e.stopPropagation();
    if (!isAdmin) return;
    openMarkerModal(markerEl);
  });

  markersContainer.appendChild(markerEl);
}

/* --- Admin Mode: Place Marker on Right-Click --- */
mapContainer.addEventListener("contextmenu", function(e) {
  if (!isAdmin) return; // Only admin can place markers
  e.preventDefault();
  const rect = mapContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Convert click coordinates to map coordinates
  const mapX = (clickX - originX) / scale;
  const mapY = (clickY - originY) / scale;
  
  // Create a unique ID for the marker (using timestamp)
  const markerId = Date.now().toString();

  // Create a marker object and add it to savedMarkers
  const markerObj = {
    id: markerId,
    x: mapX,
    y: mapY,
    place: null
  };
  savedMarkers.push(markerObj);
  saveMarkers();

  // Create the corresponding marker element
  createMarkerElement(markerObj);
});

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
const saveMarkerBtn = document.getElementById("save-marker");
const cancelMarkerBtn = document.getElementById("cancel-marker");

let currentMarker = null;

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
