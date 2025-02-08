// ----- Missions Code (used only in the Missions tab) -----
const missions = {
    gelonus_1: {
        title: "Retrieve the Lost Relic",
        description: "The ancient relic of the Sun God has been stolen. Venture into the dark caves to retrieve it before it falls into the wrong hands."
    },
    gelonus_2: {
        title: "Defend the Temple",
        description: "A sacred temple is under attack. Gather warriors and protect it before it's too late."
    },
    arcadia_1: {
        title: "Defend the Village",
        description: "A band of marauders is heading towards Beckinsdale. Gather your allies and defend the town."
    },
    arcadia_2: {
        title: "Hunt the Shadow Beast",
        description: "A mysterious beast is attacking travelers in the forest. Track it down and eliminate the threat."
    },
    elysium_colony_1: {
        title: "Explore the Ruins",
        description: "Legends speak of treasures hidden deep within the ruins of Azmos Roots. Beware of traps and unknown dangers."
    },
    elysium_colony_2: {
        title: "Find the Lost Explorer",
        description: "A famous explorer went missing. Follow their trail and uncover their fate."
    },
    thule_1: {
        title: "Stop the Frostborn Raiders",
        description: "A group of frostborn raiders are attacking caravans. Put an end to their rampage."
    },
    thule_2: {
        title: "Deliver the King's Message",
        description: "The king has an urgent message for a distant lord. Deliver it safely through dangerous lands."
    },
    elysium_1: {
        title: "Seal the Ancient Portal",
        description: "A portal leading to the underworld has opened. Find a way to seal it before creatures emerge."
    },
    elysium_2: {
        title: "Rescue the Healer",
        description: "A powerful healer has been captured by bandits. Rescue them before they are sold off."
    },
    hermesia_1: {
        title: "Recover the Stolen Artifact",
        description: "An artifact of great value was stolen from the royal vault. Track the thieves and retrieve it."
    },
    hermesia_2: {
        title: "Track the Hidden Smugglers",
        description: "Smugglers have been operating in the city. Locate their hideout and bring them to justice."
    },
    noxus_1: {
        title: "Infiltrate the Dark Guild",
        description: "The Dark Guild is planning an assassination. Infiltrate and uncover their plan."
    },
    noxus_2: {
        title: "Escape the Cursed Dungeon",
        description: "You’ve been trapped in a dungeon filled with cursed traps. Find a way out before it's too late."
    },
    pythos_1: {
        title: "Decipher the Ancient Script",
        description: "A scholar needs help deciphering an ancient text. Find missing pieces to complete the work."
    },
    pythos_2: {
        title: "Defeat the Basilisk",
        description: "A basilisk has been terrorizing the region. Slay the beast before it petrifies more victims."
    }
  };
  
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
  
  
  