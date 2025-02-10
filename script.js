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
                showMissionDetails(mission, missionItem);
            };
            missionList.appendChild(missionItem);
        });

        // Append elements
        locationList.appendChild(locationDiv);
        locationList.appendChild(missionList);
    });
}

// Toggle mission list visibility
function toggleMissions(locationId) {
    const missionList = document.getElementById(locationId);

    if (missionList.style.display === "none" || missionList.style.display === "") {
        missionList.style.display = "block";
    } else {
        missionList.style.display = "none";
    }
}

function showMissionDetails(mission, missionItem) {
    console.log("Displaying mission details for:", mission.title); // Debugging

    // Remove any previous mission details
    document.querySelectorAll(".mission-details").forEach(el => el.remove());

    // Create new mission details div
    const detailsDiv = document.createElement("div");
    detailsDiv.classList.add("mission-details");
    detailsDiv.style.display = "block"; // Ensure it's visible

    detailsDiv.innerHTML = `
        <h2>${mission.title}</h2>
        <p>${mission.description}</p>
    `;

    // Check if there are images and add them
    if (mission.images && mission.images.length > 0) {
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

    // Insert details directly below the clicked mission item
    missionItem.insertAdjacentElement("afterend", detailsDiv);
}
