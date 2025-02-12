document.addEventListener("DOMContentLoaded", () => {
  // Determine if the user is in admin mode or not.
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  fetch("missions.json")
    .then(response => response.json())
    .then(data => loadMissions(data.locations, isAdmin))
    .catch(error => console.error("Error loading missions:", error));
});

function loadMissions(locations, isAdmin) {
  const locationList = document.getElementById("location-list");
  locationList.innerHTML = ""; // Clear any existing content

  Object.keys(locations).forEach(locationKey => {
    const locationData = locations[locationKey];

    // Create a div for the location name
    const locationDiv = document.createElement("div");
    locationDiv.classList.add("location");
    locationDiv.textContent = locationData.name;
    locationDiv.onclick = () => toggleMissions(locationKey);

    // Create an unordered list to hold the missions
    const missionList = document.createElement("ul");
    missionList.classList.add("mission-list");
    missionList.id = locationKey;
    missionList.style.display = "none"; // Hide the mission list by default

    // Loop through each mission in the location
    locationData.missions.forEach(mission => {
      // If in admin mode, show all missions; otherwise, show only missions with Encountered === "yes"
      if (isAdmin || (mission.Encountered && mission.Encountered.toLowerCase() === "yes")) {
        const missionItem = document.createElement("li");
        missionItem.textContent = mission.title;
        missionItem.onclick = (event) => {
          event.stopPropagation(); // Prevent the location's click event from firing
          showMissionDetails(mission, missionItem);
        };
        missionList.appendChild(missionItem);
      }
    });

    // Append the location div and its mission list to the main container
    locationList.appendChild(locationDiv);
    locationList.appendChild(missionList);
  });
}

// Toggles the visibility of the mission list for a location
function toggleMissions(locationId) {
  const missionList = document.getElementById(locationId);
  missionList.style.display = (missionList.style.display === "none" || missionList.style.display === "")
    ? "block"
    : "none";
}

function showMissionDetails(mission, missionItem) {
  console.log("Displaying mission details for:", mission.title);

  // Remove any previously displayed mission details
  document.querySelectorAll(".mission-details").forEach(el => el.remove());

  // Create a new div to show the mission details
  const detailsDiv = document.createElement("div");
  detailsDiv.classList.add("mission-details");
  detailsDiv.style.display = "block";

  detailsDiv.innerHTML = `
    <h2>${mission.title}</h2>
    <p>${mission.description}</p>
  `;

  // If there are any images, add them
  if (mission.images && mission.images.length > 0) {
    const imagesDiv = document.createElement("div");
    imagesDiv.classList.add("mission-images");

    mission.images.forEach(imageUrl => {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = mission.title;
      img.loading = "lazy"; // Use lazy loading for performance
      imagesDiv.appendChild(img);
    });

    detailsDiv.appendChild(imagesDiv);
  }

  // Insert the mission details immediately after the clicked mission item
  missionItem.insertAdjacentElement("afterend", detailsDiv);
}
