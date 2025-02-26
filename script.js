/******************************************************
 * script.js
 * Loads missions from JSON and displays them in a list.
 * If DM mode (admin), also shows hidden missions & extra info.
 ******************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Determine if the user is in admin mode or not.
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  fetch("missions.json")
    .then(response => response.json())
    .then(data => loadMissions(data.locations, isAdmin))
    .catch(error => console.error("Error loading missions:", error));
});

/**
 * Loads the mission data and populates the mission list for each location.
 */
function loadMissions(locations, isAdmin) {
  const locationList = document.getElementById("location-list");
  locationList.innerHTML = ""; // Clear any existing content

  // For each location, create a clickable div and a hidden list of missions
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

    // Loop through each mission in this location
    locationData.missions.forEach(mission => {
      // If in admin mode, show all missions; otherwise, only show Encountered === "yes"
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

/**
 * Toggles the visibility of the mission list for a location.
 */
function toggleMissions(locationId) {
  const missionList = document.getElementById(locationId);
  missionList.style.display = (missionList.style.display === "none" || missionList.style.display === "")
    ? "block"
    : "none";
}

/***************************************************
 * Helper: Creates a 5e-style stat block from a
 * boss.stats object. Returns a <div> with HTML.
 **************************************************/
function createBossStatBlock(stats) {
  // Create the overall container
  const statBlockDiv = document.createElement("div");
  statBlockDiv.classList.add("boss-stat-block");

  // Armor Class, Hit Points, Speed (only if present)
  if (stats["Armor Class"]) {
    statBlockDiv.innerHTML += `<p><strong>Armor Class:</strong> ${stats["Armor Class"]}</p>`;
  }
  if (stats["Hit Points"]) {
    statBlockDiv.innerHTML += `<p><strong>Hit Points:</strong> ${stats["Hit Points"]}</p>`;
  }
  if (stats["Speed"]) {
    statBlockDiv.innerHTML += `<p><strong>Speed:</strong> ${stats["Speed"]}</p>`;
  }

  // If the boss has STR/DEX/CON/INT/WIS/CHA, display them in a small table
  const coreAbilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  const hasAllSix = coreAbilities.every(ab => stats[ab]);
  if (hasAllSix) {
    const table = document.createElement("table");
    table.classList.add("boss-ability-scores");

    let thead = "<thead><tr>";
    coreAbilities.forEach(ab => {
      thead += `<th>${ab}</th>`;
    });
    thead += "</tr></thead>";

    let tbody = "<tbody><tr>";
    coreAbilities.forEach(ab => {
      tbody += `<td>${stats[ab]}</td>`;
    });
    tbody += "</tr></tbody>";

    table.innerHTML = thead + tbody;
    statBlockDiv.appendChild(table);
  }

  // Display other stats (Saving Throws, Resistances, etc.) if they exist
  const otherKeys = [
    "Saving Throws", "Skills", "Damage Resistances", "Damage Immunities",
    "Condition Immunities", "Senses", "Languages", "Challenge", "Legendary Resistance"
  ];
  otherKeys.forEach(key => {
    if (stats[key]) {
      statBlockDiv.innerHTML += `<p><strong>${key}:</strong> ${stats[key]}</p>`;
    }
  });

  return statBlockDiv;
}

/**
 * Main function: Called when a mission is clicked.
 * Shows mission details, phases, loot, and bosses in 5e style.
 */
function showMissionDetails(mission, missionItem) {
  console.log("Displaying mission details for:", mission.title);

  // Remove any previously displayed mission details
  document.querySelectorAll(".mission-details").forEach(el => el.remove());

  // Create a new container for the mission details
  const detailsDiv = document.createElement("div");
  detailsDiv.classList.add("mission-details");
  detailsDiv.style.display = "block";

  // 1. Mission title & description
  detailsDiv.innerHTML = `<h2>${mission.title}</h2>`;
  if (mission.description) {
    detailsDiv.innerHTML += `<p>${mission.description}</p>`;
  }

  // 2. Mission images
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

  // 3. Mission phases
  if (mission.phases && mission.phases.length > 0) {
    const phasesDiv = document.createElement("div");
    phasesDiv.classList.add("mission-phases");

    mission.phases.forEach(phase => {
      const phaseDiv = document.createElement("div");
      phaseDiv.classList.add("mission-phase");

      phaseDiv.innerHTML = `<h3>Phase ${phase.phase}: ${phase.title}</h3>`;
      if (phase.description) {
        phaseDiv.innerHTML += `<p>${phase.description}</p>`;
      }

      // Phase images
      if (phase.images && phase.images.length > 0) {
        const phaseImagesDiv = document.createElement("div");
        phaseImagesDiv.classList.add("phase-images");
        phase.images.forEach(phaseImageUrl => {
          const img = document.createElement("img");
          img.src = phaseImageUrl;
          img.alt = `${mission.title} - Phase ${phase.phase}`;
          img.loading = "lazy";
          phaseImagesDiv.appendChild(img);
        });
        phaseDiv.appendChild(phaseImagesDiv);
      }

      phasesDiv.appendChild(phaseDiv);
    });

    detailsDiv.appendChild(phasesDiv);
  }

  // 4. DM-only sections: Loot & Bosses
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  if (isAdmin) {
    // Loot
    if (mission.loot && mission.loot.length > 0) {
      const lootDiv = document.createElement("div");
      lootDiv.classList.add("mission-loot");
      lootDiv.innerHTML = `<h3>Loot</h3>`;
      mission.loot.forEach(item => {
        lootDiv.innerHTML += `<p><strong>${item.name}</strong>: ${item.description} (Value: ${item.value})</p>`;
      });
      detailsDiv.appendChild(lootDiv);
    }

    // Bosses
    if (mission.bosses && mission.bosses.length > 0) {
      const bossesDiv = document.createElement("div");
      bossesDiv.classList.add("mission-bosses");
      bossesDiv.innerHTML = `<h3>Bosses</h3>`;

      mission.bosses.forEach(boss => {
        const bossContainer = document.createElement("div");
        bossContainer.classList.add("boss-container");

        // Boss Name
        bossContainer.innerHTML += `<h4 class="boss-name">${boss.name}</h4>`;

        // Stat Block (only if we have an object)
        if (boss.stats && typeof boss.stats === "object") {
          const statBlock = createBossStatBlock(boss.stats);
          bossContainer.appendChild(statBlock);
        }

        // Abilities array (if it exists)
        if (boss.abilities && Array.isArray(boss.abilities) && boss.abilities.length > 0) {
          const abilitiesDiv = document.createElement("div");
          abilitiesDiv.classList.add("boss-abilities");
          abilitiesDiv.innerHTML = `<h5>Abilities</h5><ul></ul>`;
          const ul = abilitiesDiv.querySelector("ul");

          boss.abilities.forEach(ability => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${ability.name}:</strong> ${ability.description}`;
            ul.appendChild(li);
          });

          bossContainer.appendChild(abilitiesDiv);
        }

        // Boss description
        if (boss.description) {
          bossContainer.innerHTML += `<p class="boss-description">${boss.description}</p>`;
        }

        bossesDiv.appendChild(bossContainer);
      });

      detailsDiv.appendChild(bossesDiv);
    }
  }

  // 5. Insert the mission details immediately after the clicked mission item
  missionItem.insertAdjacentElement("afterend", detailsDiv);
}
