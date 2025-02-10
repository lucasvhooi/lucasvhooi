document.addEventListener("DOMContentLoaded", () => {
    fetch("locations.json")
        .then(response => response.json())
        .then(data => loadContinents(data.continents))
        .catch(error => console.error("Error loading locations:", error));
});

function loadContinents(continents) {
    const locationList = document.getElementById("location-list");
    locationList.innerHTML = ""; // Clear existing content

    Object.keys(continents).forEach(continentKey => {
        const continentData = continents[continentKey];

        // Create continent div
        const continentDiv = document.createElement("div");
        continentDiv.classList.add("continent");
        continentDiv.textContent = continentData.name;
        continentDiv.onclick = () => toggleLocations(continentKey);

        // Create locations list
        const locationSubList = document.createElement("ul");
        locationSubList.classList.add("location-list");
        locationSubList.id = continentKey;
        locationSubList.style.display = "none"; // Hide initially

        Object.keys(continentData.locations).forEach(locationKey => {
            const locationData = continentData.locations[locationKey];

            const locationItem = document.createElement("li");
            locationItem.textContent = locationData.name;
            locationItem.onclick = (event) => {
                event.stopPropagation(); // Prevent bubbling
                toggleLocationDetails(locationData, locationItem);
            };
            locationSubList.appendChild(locationItem);
        });

        // Append elements
        locationList.appendChild(continentDiv);
        locationList.appendChild(locationSubList);
    });
}

// 🔹 Toggle location lists & close location details when closing a continent
function toggleLocations(continentId) {
    const locationSubList = document.getElementById(continentId);

    if (locationSubList.style.display === "none" || locationSubList.style.display === "") {
        // Open the list and close all location details
        closeAllLocationDetails();
        locationSubList.style.display = "block";
    } else {
        // Close the list and any open location details
        locationSubList.style.display = "none";
        closeAllLocationDetails();
    }
}

// 🔹 Close all location details
function closeAllLocationDetails() {
    document.querySelectorAll(".location-details").forEach(el => el.remove());
}

// 🔹 Toggle individual location details (press again to close)
function toggleLocationDetails(location, locationItem) {
    // Check if this location already has details open
    let existingDetails = locationItem.nextElementSibling;
    if (existingDetails && existingDetails.classList.contains("location-details")) {
        existingDetails.remove(); // Close the details if already open
        return;
    }

    // Otherwise, close other location details and show the new one
    // Otherwise, close other location details and show the new one
    closeAllLocationDetails();

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

    // Insert details directly below the clicked location
    locationItem.insertAdjacentElement("afterend", detailsDiv);
}
