document.addEventListener("DOMContentLoaded", () => {
    fetch("missions.json")
        .then(response => response.json())
        .then(data => loadMissions(data.locations))
        .catch(error => console.error("Error loading missions:", error));
});

function loadMissions(locations) {
    const locationList = document.getElementById("location-list");
    locationList.innerHTML = ""; // Clear any existing content

    Object.keys(locations).forEach(locationKey => {
        const locationData = locations[locationKey];

        // Create location div
        const locationDiv = document.createElement("div");
        locationDiv.classList.add("location");
        locationDiv.textContent = locationData.name;
        locationDiv.onclick = () => toggleMissions(locationKey);

        // Create mission list
        const missionList = document.createElement("ul");
        missionList.classList.add("mission-list");
        missionList.id = locationKey;

        locationData.missions.forEach(mission => {
            const missionItem = document.createElement("li");
            missionItem.textContent = mission.title;
            missionItem.onclick = () => showMission(mission, locationKey);
            missionList.appendChild(missionItem);
        });

        // Create mission details div
        const missionDetails = document.createElement("div");
        missionDetails.id = `${locationKey}_mission_details`;
        missionDetails.classList.add("mission-details");

        // Append elements
        locationList.appendChild(locationDiv);
        locationList.appendChild(missionList);
        locationList.appendChild(missionDetails);
    });
}

// Toggle mission list visibility
function toggleMissions(locationId) {
    const missionList = document.getElementById(locationId);
    if (missionList) {
        missionList.style.display = missionList.style.display === "block" ? "none" : "block";
    }
}

function showMission(mission, locationId) {
    let detailsDiv = document.getElementById(`${locationId}_mission_details`);

    // If the div doesn't exist, create it
    if (!detailsDiv) {
        detailsDiv = document.createElement("div");
        detailsDiv.id = `${locationId}_mission_details`;
        detailsDiv.classList.add("mission-details");
        document.getElementById(locationId).after(detailsDiv); // Insert it after the mission list
    }

    // Populate mission details
    detailsDiv.innerHTML = `
        <h2>${mission.title}</h2>
        <p>${mission.description}</p>
    `;

    // Add images if available
    if (mission.images.length > 0) {
        const imagesDiv = document.createElement("div");
        imagesDiv.classList.add("mission-images");

        mission.images.forEach(imageUrl => {
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = mission.title;
            img.loading = "lazy"; // Lazy load for performance
            imagesDiv.appendChild(img);
        });

        detailsDiv.appendChild(imagesDiv);
    }

    // Make sure the details div is visible
    detailsDiv.style.display = "block";
}


  
  // Toggle location mission lists and hide mission details if closing the location list (missions tab only)
  function toggleMissions(locationId) {
    let missionList = document.getElementById(locationId);
    let missionDetails = document.getElementById(locationId + "_mission_details");
  
    if (missionList.style.display === "none" || missionList.style.display === "") {
        missionList.style.display = "block";
        missionDetails.style.display = "none";
    } else {
        missionList.style.display = "none";
        missionDetails.style.display = "none";
    }
  }
  
  
  