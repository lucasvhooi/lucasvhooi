// location.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("../assets/data/locations.json")
    .then(response => response.json())
    .then(data => loadContinents(data.continents))
    .catch(error => console.error("Error loading locations:", error));
});

function loadContinents(continents) {
  const locationList = document.getElementById("location-list");
  locationList.innerHTML = ""; // Clear any existing content

  // Read the login mode from localStorage:
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  Object.keys(continents).forEach(continentKey => {
    const continentData = continents[continentKey];

    // Create a clickable continent div.
    const continentDiv = document.createElement("div");
    continentDiv.classList.add("continent");
    continentDiv.textContent = continentData.name;
    continentDiv.onclick = () => toggleLocations(continentKey);

    // Create an unordered list for the locations within the continent.
    const locationSubList = document.createElement("ul");
    locationSubList.classList.add("location-list");
    locationSubList.id = continentKey;
    locationSubList.style.display = "none"; // Hide initially

    Object.keys(continentData.locations).forEach(locationKey => {
      const locationData = continentData.locations[locationKey];

      // In admin mode show every location.
      // In player mode, only show if Encountered is "yes" (case‑insensitive).
      if (isAdmin || (locationData.Encountered && locationData.Encountered.toLowerCase() === "yes")) {
        const locationItem = document.createElement("li");
        locationItem.textContent = locationData.name;
        locationItem.onclick = (event) => {
          event.stopPropagation(); // Prevent the continent click from toggling the list again.
          toggleLocationDetails(locationData, locationItem);
        };
        locationSubList.appendChild(locationItem);
      }
    });

    // Only add the continent section if there is at least one location to show (or if admin mode is active).
    if (isAdmin || locationSubList.children.length > 0) {
      locationList.appendChild(continentDiv);
      locationList.appendChild(locationSubList);
    }
  });
}

function toggleLocations(continentId) {
  const locationSubList = document.getElementById(continentId);
  if (locationSubList.style.display === "none" || locationSubList.style.display === "") {
    closeAllLocationDetails();
    locationSubList.style.display = "block";
  } else {
    locationSubList.style.display = "none";
    closeAllLocationDetails();
  }
}

function closeAllLocationDetails() {
  document.querySelectorAll(".location-details").forEach(el => el.remove());
}

function toggleLocationDetails(location, locationItem) {
  // If details are already shown, remove them.
  let existingDetails = locationItem.nextElementSibling;
  if (existingDetails && existingDetails.classList.contains("location-details")) {
    existingDetails.remove();
    return;
  }

  closeAllLocationDetails();

  // Create a container for the location details.
  const detailsDiv = document.createElement("div");
  detailsDiv.classList.add("location-details");
  detailsDiv.style.display = "block";

  let detailsHTML = `<h2>${location.name}</h2>`;
  if (location.description) {
    detailsHTML += `<p>${location.description}</p>`;
  }
  if (location.population !== null && location.population !== undefined) {
    detailsHTML += `<p><strong>Population:</strong> ${location.population}</p>`;
  }
  if (location.wealth) {
    detailsHTML += `<p><strong>Wealth Level:</strong> ${location.wealth}</p>`;
  }
  detailsDiv.innerHTML = detailsHTML;

  if (location.map) {
    const img = document.createElement("img");
    img.src = location.map;
    img.alt = location.name;
    img.loading = "lazy";
    detailsDiv.appendChild(img);
  }

  // Insert the details right after the clicked location item.
  locationItem.insertAdjacentElement("afterend", detailsDiv);
}
