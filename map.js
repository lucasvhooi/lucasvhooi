// Initialize transformation values
let scale = 1;
let originX = 0;
let originY = 0;

const mapContainer = document.getElementById("map-container");
const mapWrapper = document.getElementById("map-wrapper");

// Update the transform on the map wrapper
function updateTransform() {
  mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
}

/* --- Zooming (Desktop) --- */
mapContainer.addEventListener("wheel", function(e) {
  e.preventDefault();
  const zoomIntensity = 0.001;
  let newScale = scale * (1 - e.deltaY * zoomIntensity);
  newScale = Math.min(Math.max(newScale, 0.1), 5);
  
  const rect = mapContainer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Adjust the origin so the zoom centers on the pointer
  originX -= (mouseX - originX) * (newScale / scale - 1);
  originY -= (mouseY - originY) * (newScale / scale - 1);
  
  scale = newScale;
  updateTransform();
});

/* --- Panning (Desktop) --- */
let isDragging = false;
let startX, startY;

mapContainer.addEventListener("mousedown", function(e) {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  mapContainer.style.cursor = "grabbing";
});

document.addEventListener("mousemove", function(e) {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  startX = e.clientX;
  startY = e.clientY;
  originX += dx;
  originY += dy;
  updateTransform();
});

document.addEventListener("mouseup", function() {
  if (isDragging) {
    isDragging = false;
    mapContainer.style.cursor = "grab";
  }
});

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
      newScale = Math.min(Math.max(newScale, 0.1), 5);
      
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
}
