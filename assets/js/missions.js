document.addEventListener("DOMContentLoaded", () => {
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  fetch("../assets/data/missions.json")
    .then(response => response.json())
    .then(data => loadMissions(data.locations, isAdmin))
    .catch(error => console.error("Error loading missions:", error));
});

function loadMissions(locations, isAdmin) {
  const locationList = document.getElementById("location-list");
  locationList.innerHTML = ""; // Clear existing content

  Object.keys(locations).forEach(locationKey => {
    const locationData = locations[locationKey];

    // Location name (clickable)
    const locationDiv = document.createElement("div");
    locationDiv.classList.add("location");
    locationDiv.textContent = locationData.name;
    locationDiv.onclick = () => toggleMissions(locationKey);

    // Hidden mission list
    const missionList = document.createElement("ul");
    missionList.classList.add("mission-list");
    missionList.id = locationKey;
    missionList.style.display = "none";

    // Populate missions
    locationData.missions.forEach(mission => {
      // Show all if DM; else only "Encountered: yes"
      if (isAdmin || (mission.Encountered && mission.Encountered.toLowerCase() === "yes")) {
        const missionItem = document.createElement("li");
        missionItem.textContent = mission.title;
        missionItem.onclick = (event) => {
          event.stopPropagation();
          showMissionDetails(mission, missionItem);
        };
        missionList.appendChild(missionItem);
      }
    });

    locationList.appendChild(locationDiv);
    locationList.appendChild(missionList);
  });
}

function toggleMissions(locationId) {
  const missionList = document.getElementById(locationId);
  missionList.style.display = (missionList.style.display === "none" || missionList.style.display === "")
    ? "block"
    : "none";
}

/********************************************************************
 * Creates a 5e-style stat block from boss.stats (AC, HP, Speed, etc.)
 ********************************************************************/
function createBossStatBlock(stats) {
  const statBlockDiv = document.createElement("div");
  statBlockDiv.classList.add("boss-stat-block");

  // AC, HP, Speed
  if (stats["Armor Class"]) {
    statBlockDiv.innerHTML += `<p><strong>Armor Class:</strong> ${stats["Armor Class"]}</p>`;
  }
  if (stats["Hit Points"]) {
    statBlockDiv.innerHTML += `<p><strong>Hit Points:</strong> ${stats["Hit Points"]}</p>`;
  }
  if (stats["Speed"]) {
    statBlockDiv.innerHTML += `<p><strong>Speed:</strong> ${stats["Speed"]}</p>`;
  }

  // STR, DEX, CON, INT, WIS, CHA
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

  // Other fields (Saving Throws, Resistances, etc.)
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

/******************************************************
 * Displays mission details, phases, LOOT, BOSSES, etc.
 ******************************************************/
function showMissionDetails(mission, missionItem) {
  console.log("Displaying mission details for:", mission.title);

  // Remove old details
  document.querySelectorAll(".mission-details").forEach(el => el.remove());

  // Create container
  const detailsDiv = document.createElement("div");
  detailsDiv.classList.add("mission-details");
  detailsDiv.style.display = "block";

  // Title & description
  detailsDiv.innerHTML = `<h2>${mission.title}</h2>`;
  if (mission.description) {
    detailsDiv.innerHTML += `<p>${mission.description}</p>`;
  }

  // Mission images
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

  // Mission phases
  if (mission.phases && mission.phases.length > 0) {
    const phasesDiv = document.createElement("div");
    phasesDiv.classList.add("mission-phases");

    mission.phases.forEach(phase => {
      const phaseDiv = document.createElement("div");
      phaseDiv.classList.add("mission-phase");

      phaseDiv.innerHTML = `<h3>Phase ${phase.phase}: ${phase.title}</h3>`;

      
      if (phase.description) {
        phaseDiv.innerHTML += `<p>${phase.description}</p>`;

        if (phase.puzzleSteps && Array.isArray(phase.puzzleSteps) && phase.puzzleSteps.length > 0) {
          const puzzleStepsDiv = document.createElement("div");
          puzzleStepsDiv.classList.add("mission-puzzle-steps");
        
          // Create header with toggle arrow (default closed state)
          const puzzleHeader = document.createElement("h4");
          puzzleHeader.classList.add("toggle-header");
          puzzleHeader.innerHTML = `Puzzle Steps <span class="toggle-arrow">►</span>`;
          puzzleStepsDiv.appendChild(puzzleHeader);
        
          // Create container for puzzle step content, hidden by default
          const puzzleContent = document.createElement("div");
          puzzleContent.classList.add("toggle-content", "hidden");
        
          phase.puzzleSteps.forEach((step, index) => {
            const stepDiv = document.createElement("div");
            stepDiv.classList.add("puzzle-step");
        
            // Build HTML for each step, including puzzle title if provided
            stepDiv.innerHTML = `
              <p><strong>Step ${index + 1}:</strong></p>
              ${step.title ? `<p><strong>Title:</strong> ${step.title}</p>` : ""}
              <p><strong>Setup:</strong> ${step.setup ? step.setup : "N/A"}</p>
              <p><strong>Solution:</strong> ${step.solution ? step.solution : "N/A"}</p>
              <p><strong>Reward:</strong> ${step.reward ? step.reward : "N/A"}</p>
            `;
            puzzleContent.appendChild(stepDiv);
          });
        
          puzzleStepsDiv.appendChild(puzzleContent);
        
          // Toggle event for the puzzle steps section
          puzzleHeader.addEventListener("click", () => {
            puzzleContent.classList.toggle("hidden");
            const arrow = puzzleHeader.querySelector(".toggle-arrow");
            arrow.textContent = (arrow.textContent === "►") ? "▼" : "►";
          });
        
          phaseDiv.appendChild(puzzleStepsDiv);
        }
        
        
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

  

  // DM sections
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  if (isAdmin) {
    /************
     * LOOT
     ************/
    if (mission.loot && mission.loot.length > 0) {
      const lootDiv = document.createElement("div");
      lootDiv.classList.add("mission-loot");

      // Create the heading with an arrow
      const lootHeader = document.createElement("h3");
      lootHeader.classList.add("toggle-header");
      lootHeader.innerHTML = `Loot <span class="toggle-arrow">▼</span>`;
      lootDiv.appendChild(lootHeader);

      // Create a container for loot items
      const lootContent = document.createElement("div");
      lootContent.classList.add("toggle-content");

      mission.loot.forEach(item => {
        lootContent.innerHTML += `<p><strong>${item.name}</strong>: ${item.description} (Value: ${item.value})</p>`;
      });
      lootDiv.appendChild(lootContent);

      // Add toggle event
      lootHeader.addEventListener("click", () => {
        lootContent.classList.toggle("hidden");
        const arrow = lootHeader.querySelector(".toggle-arrow");
        arrow.textContent = (arrow.textContent === "▼") ? "►" : "▼";
      });

      detailsDiv.appendChild(lootDiv);
    }

    /************
     * BOSSES
     ************/
    if (mission.bosses && mission.bosses.length > 0) {
      const bossesDiv = document.createElement("div");
      bossesDiv.classList.add("mission-bosses");

      // Bosses heading with arrow
      const bossesHeader = document.createElement("h3");
      bossesHeader.classList.add("toggle-header");
      bossesHeader.innerHTML = `Bosses <span class="toggle-arrow">▼</span>`;
      bossesDiv.appendChild(bossesHeader);

      // Container for boss data
      const bossesContent = document.createElement("div");
      bossesContent.classList.add("toggle-content");

      // For each boss
      mission.bosses.forEach(boss => {
        const bossContainer = document.createElement("div");
        bossContainer.classList.add("boss-container");

        // Boss name
        bossContainer.innerHTML += `<h4 class="boss-name">${boss.name}</h4>`;

        // Stat block
        if (boss.stats && typeof boss.stats === "object") {
          const statBlock = createBossStatBlock(boss.stats);
          bossContainer.appendChild(statBlock);
        }

        // Abilities
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

        bossesContent.appendChild(bossContainer);
      });

      bossesDiv.appendChild(bossesContent);

      // Toggle event for bosses
      bossesHeader.addEventListener("click", () => {
        bossesContent.classList.toggle("hidden");
        const arrow = bossesHeader.querySelector(".toggle-arrow");
        arrow.textContent = (arrow.textContent === "▼") ? "►" : "▼";
      });

      detailsDiv.appendChild(bossesDiv);
    }
  }

  // Insert the mission details after the clicked mission item
  missionItem.insertAdjacentElement("afterend", detailsDiv);
}
