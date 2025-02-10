document.addEventListener("DOMContentLoaded", () => {
    fetch("missions.json")
        .then(response => response.json())
        .then(data => loadMissions(data.locations))
        .catch(error => console.error("Error loading missions:", error));
});

function loadMissions(locations) {
    const locationList = document.getElementById("location-list");
    locationList.innerHTML = ""; // Clear existing content

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
        missionList.style.display = "none"; // Hide initially

        locationData.missions.forEach(mission => {
            const missionItem = document.createElement("li");
            missionItem.textContent = mission.title;
            missionItem.onclick = (event) => {
                event.stopPropagation(); // Prevent bubbling
                toggleMissionDetails(mission, missionItem);
            };
            missionList.appendChild(missionItem);
        });

        // Append elements
        locationList.appendChild(locationDiv);
        locationList.appendChild(missionList);
    });
}

// 🔹 Toggle mission list visibility & close mission details when closing a category
function toggleMissions(locationId) {
    const missionList = document.getElementById(locationId);
    
    if (missionList.style.display === "none" || missionList.style.display === "") {
        // Open the list and close all mission details
        closeAllMissionDetails();
        missionList.style.display = "block";
    } else {
        // Close the list and any open mission details
        missionList.style.display = "none";
        closeAllMissionDetails();
    }
}

// 🔹 Close all mission details
function closeAllMissionDetails() {
    document.querySelectorAll(".mission-details").forEach(el => el.remove());
}

// 🔹 Toggle individual mission details (press again to close)
function toggleMissionDetails(mission, missionItem) {
    // Check if this mission already has details open
    let existingDetails = missionItem.nextElementSibling;
    if (existingDetails && existingDetails.classList.contains("mission-details")) {
        existingDetails.remove(); // Close the details if already open
        return;
    }

    // Otherwise, close other mission details and show the new one
    closeAllMissionDetails();

    const detailsDiv = document.createElement("div");
    detailsDiv.classList.add("mission-details");
    detailsDiv.style.display = "block";

    detailsDiv.innerHTML = `
        <h2>${mission.title}</h2>
        <p>${mission.description}</p>
    `;

    if (mission.images && mission.images.length > 0) {
        const imagesDiv = document.createElement("div");
        imagesDiv.classList.add("mission-images");

        mission.images.forEach(imageUrl => {
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = mission.title;
            img.loading = "lazy";
            imagesDiv.appendChild(img);
        });

        detailsDiv.appendChild(imagesDiv);
    }

    // Insert details directly below the clicked mission
    missionItem.insertAdjacentElement("afterend", detailsDiv);
}
