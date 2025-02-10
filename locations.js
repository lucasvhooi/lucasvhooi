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
                event.stopPropagation(); // Prevent event bubbling
                showLocationDetails(locationData, locationItem, continentKey);
            };
            locationSubList.appendChild(locationItem);
        });

        // Append elements
        locationList.appendChild(continentDiv);
        locationList.appendChild(locationSubList);
    });
}

function toggleLocations(continentId) {
    let locationSubList = document.getElementById(continentId);
    
    if (locationSubList.style.display === "none" || locationSubList.style.display === "") {
        locationSubList.style.display = "block";
    } else {
        locationSubList.style.display = "none";
    }
}

function showLocationDetails(location, locationItem, continentId) {
    console.log("Displaying details for:", location.name); // Debugging

    // Remove any previous details
    document.querySelectorAll(".location-details").forEach(el => el.remove());

    // Create new details div
    const detailsDiv = document.createElement("div");
    detailsDiv.classList.add("location-details");
    detailsDiv.style.display = "block"; // Force it to be visible

    detailsDiv.innerHTML = `
        <h2>${location.name}</h2>
        <p>${location.description}</p>
        <p><strong>Population:</strong> ${location.population}</p>
        <p><strong>Wealth Level:</strong> ${location.wealth}</p>
    `;

    if (location.map) {
        const img = document.createElement("img");
        img.src = location.map;
        img.alt = location.name;
        img.loading = "lazy";
        detailsDiv.appendChild(img);
    }

    // Insert it directly below the clicked location
    locationItem.insertAdjacentElement("afterend", detailsDiv);
}

