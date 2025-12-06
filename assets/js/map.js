// Initialize transformation values
let scale = 1;
let minScale = 1;
let originX = 0;
let originY = 0;

const mapContainer = document.getElementById("map-container");
const mapWrapper = document.getElementById("map-wrapper");
const mapImage = document.getElementById("map-image");

// Prevent the browser's default image drag behavior, which interrupts panning
mapImage.draggable = false;
mapImage.addEventListener("dragstart", (e) => e.preventDefault());

// Update the transform on the map wrapper
function updateTransform() {
  mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
}

// Fit the map image within the container on load and resize
function fitMapToContainer() {
  const containerRect = mapContainer.getBoundingClientRect();

  if (!mapImage.naturalWidth || !mapImage.naturalHeight) {
    return;
  }

  // Size the wrapper to the image's natural dimensions so scaling behaves predictably
  mapWrapper.style.width = `${mapImage.naturalWidth}px`;
  mapWrapper.style.height = `${mapImage.naturalHeight}px`;

  const scaleX = containerRect.width / mapImage.naturalWidth;
  const scaleY = containerRect.height / mapImage.naturalHeight;

  // Use the larger scale so the map fully covers the container without borders
  scale = Math.max(scaleX, scaleY);
  minScale = scale;

  const scaledWidth = mapImage.naturalWidth * scale;
  const scaledHeight = mapImage.naturalHeight * scale;

  originX = (containerRect.width - scaledWidth) / 2;
  originY = (containerRect.height - scaledHeight) / 2;

  clampToBounds();
  updateTransform();
}

if (mapImage.complete) {
  fitMapToContainer();
} else {
  mapImage.addEventListener("load", fitMapToContainer);
}

window.addEventListener("resize", fitMapToContainer);

function clampToBounds() {
  const containerRect = mapContainer.getBoundingClientRect();
  const scaledWidth = mapImage.naturalWidth * scale;
  const scaledHeight = mapImage.naturalHeight * scale;

  const minX = Math.min(0, containerRect.width - scaledWidth);
  const minY = Math.min(0, containerRect.height - scaledHeight);

  originX = Math.min(0, Math.max(minX, originX));
  originY = Math.min(0, Math.max(minY, originY));
}

/* --- Zooming (Desktop) --- */
mapContainer.addEventListener("wheel", function(e) {
  e.preventDefault();
  const zoomIntensity = 0.001;
  let newScale = scale * (1 - e.deltaY * zoomIntensity);
  newScale = Math.min(Math.max(newScale, minScale), 5);
  
  const rect = mapContainer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Adjust the origin so the zoom centers on the pointer
  originX -= (mouseX - originX) * (newScale / scale - 1);
  originY -= (mouseY - originY) * (newScale / scale - 1);
  
  scale = newScale;
  clampToBounds();
  updateTransform();
});

/* --- Panning (Desktop with Pointer Events) --- */
let isDragging = false;
let startX, startY;

mapContainer.addEventListener("pointerdown", function(e) {
  if (e.pointerType !== "mouse" || e.button !== 0) return; // Only respond to primary mouse button
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  mapContainer.style.cursor = "grabbing";
  mapContainer.setPointerCapture(e.pointerId);
});

mapContainer.addEventListener("pointermove", function(e) {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  startX = e.clientX;
  startY = e.clientY;
  originX += dx;
  originY += dy;
  clampToBounds();
  updateTransform();
});

function endDrag() {
  if (isDragging) {
    isDragging = false;
    mapContainer.style.cursor = "grab";
  }
}

mapContainer.addEventListener("pointerup", endDrag);
mapContainer.addEventListener("pointercancel", endDrag);

/* --- Touch Support (Mobile) --- */
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
      let newScale = initialScale * (newDistance / initialDistance);
      newScale = Math.min(Math.max(newScale, minScale), 5);
      
      const rect = mapContainer.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      originX -= (midX - originX) * (newScale / scale - 1);
      originY -= (midY - originY) * (newScale / scale - 1);
      
      scale = newScale;
      clampToBounds();
      updateTransform();
      e.preventDefault();
    } else if (e.touches.length === 1 && !isPinching) {
      let currentX = e.touches[0].clientX;
      let currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dy = currentY - touchStartY;
      originX += dx;
      originY += dy;
      clampToBounds();
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
}
