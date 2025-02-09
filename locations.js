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
            locationItem.onclick = () => showLocationDetails(locationData, continentKey);
            locationSubList.appendChild(locationItem);
        });

        // Create location details div
        const locationDetails = document.createElement("div");
        locationDetails.id = `${continentKey}_location_details`;
        locationDetails.classList.add("location-details");
        locationDetails.style.display = "none";

        // Append elements
        locationList.appendChild(continentDiv);
        locationList.appendChild(locationSubList);
        locationList.appendChild(locationDetails);
    });
}

function toggleLocations(continentId) {
    let locationSubList = document.getElementById(continentId);
    let locationDetails = document.getElementById(continentId + "_location_details");

    if (locationSubList.style.display === "none" || locationSubList.style.display === "") {
        locationSubList.style.display = "block";
        locationDetails.style.display = "none"; // Hide location details when opening the list
    } else {
        locationSubList.style.display = "none";
        locationDetails.style.display = "none"; // Hide location details when closing the list
    }
}

function showLocationDetails(location, continentId) {
    let detailsDiv = document.getElementById(`${continentId}_location_details`);

    // Populate location details
    detailsDiv.innerHTML = `
        <h2>${location.name}</h2>
        <p>${location.description}</p>
        <p><strong>Population:</strong> ${location.population}</p>
        <p><strong>Wealth Level:</strong> ${location.wealth}</p>
    `;

    // Add location image if available
    if (location.map) {
        const img = document.createElement("img");
        img.src = location.map;
        img.alt = location.name;
        img.loading = "lazy"; // Lazy load for performance
        detailsDiv.appendChild(img);
    }

    // Make sure the details div is visible
    detailsDiv.style.display = "block";
}
