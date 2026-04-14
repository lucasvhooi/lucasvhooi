'use strict';

// ── Conditions ────────────────────────────────────────────────────────────────
const CONDITIONS = [
  { id: "blinded",       label: "Blinded",      icon: "●",  color: "#9e9e9e" },
  { id: "charmed",       label: "Charmed",       icon: "♥",  color: "#e91e8c" },
  { id: "concentrating", label: "Conc.",         icon: "◎",  color: "#7c4dff" },
  { id: "deafened",      label: "Deafened",      icon: "♦",  color: "#78909c" },
  { id: "exhausted",     label: "Exhausted",     icon: "~",  color: "#795548" },
  { id: "frightened",    label: "Frightened",    icon: "!",  color: "#ff7043" },
  { id: "grappled",      label: "Grappled",      icon: "⛓",  color: "#ff9800" },
  { id: "incapacitated", label: "Incap.",        icon: "✕",  color: "#9e9e9e" },
  { id: "invisible",     label: "Invisible",     icon: "◌",  color: "#e0e0e0" },
  { id: "paralyzed",     label: "Paralyzed",     icon: "⚡",  color: "#ffeb3b" },
  { id: "petrified",     label: "Petrified",     icon: "◆",  color: "#a0a0a0" },
  { id: "poisoned",      label: "Poisoned",      icon: "☠",  color: "#66bb6a" },
  { id: "prone",         label: "Prone",         icon: "↓",  color: "#ff9800" },
  { id: "restrained",    label: "Restrained",    icon: "⊗",  color: "#8d6e63" },
  { id: "stunned",       label: "Stunned",       icon: "◉",  color: "#ce93d8" },
  { id: "unconscious",   label: "Unconscious",   icon: "☁",  color: "#546e7a" },
  { id: "raging",        label: "Raging",        icon: "▲",  color: "#ef5350" },
  { id: "hidden",        label: "Hidden",        icon: "◐",  color: "#607d8b" },
];

// ── Monster presets ───────────────────────────────────────────────────────────
// { name, ac, hp (avg), initMod (DEX mod), cr }
const MONSTER_PRESETS = [
  // ── Common humanoids ──
  { name: "Bandit",           ac: 12, hp: 11,  initMod:  1, cr: "1/8"  },
  { name: "Bandit Captain",   ac: 15, hp: 65,  initMod:  2, cr: "2"    },
  { name: "Cultist",          ac: 12, hp: 9,   initMod:  1, cr: "1/8"  },
  { name: "Cult Fanatic",     ac: 13, hp: 33,  initMod:  2, cr: "2"    },
  { name: "Guard",            ac: 16, hp: 11,  initMod:  1, cr: "1/8"  },
  { name: "Knight",           ac: 18, hp: 52,  initMod:  0, cr: "3"    },
  { name: "Gladiator",        ac: 16, hp: 112, initMod:  2, cr: "5"    },
  { name: "Veteran",          ac: 17, hp: 58,  initMod:  1, cr: "3"    },
  { name: "Mage",             ac: 12, hp: 40,  initMod:  2, cr: "6"    },
  { name: "Archmage",         ac: 12, hp: 99,  initMod:  2, cr: "12"   },
  { name: "Spy",              ac: 12, hp: 27,  initMod:  2, cr: "1"    },
  { name: "Assassin",         ac: 15, hp: 78,  initMod:  4, cr: "8"    },
  { name: "Thug",             ac: 11, hp: 32,  initMod:  0, cr: "1/2"  },
  { name: "Berserker",        ac: 13, hp: 67,  initMod:  1, cr: "2"    },
  { name: "Scout",            ac: 13, hp: 16,  initMod:  2, cr: "1/2"  },
  // ── Goblinoids ──
  { name: "Goblin",           ac: 15, hp: 7,   initMod:  2, cr: "1/4"  },
  { name: "Hobgoblin",        ac: 18, hp: 11,  initMod:  1, cr: "1/2"  },
  { name: "Bugbear",          ac: 16, hp: 27,  initMod:  2, cr: "1"    },
  { name: "Bugbear Chief",    ac: 17, hp: 65,  initMod:  2, cr: "3"    },
  { name: "Goblin Boss",      ac: 17, hp: 21,  initMod:  3, cr: "1"    },
  // ── Orcs / Giants ──
  { name: "Orc",              ac: 13, hp: 15,  initMod:  1, cr: "1/2"  },
  { name: "Orc War Chief",    ac: 16, hp: 93,  initMod:  2, cr: "4"    },
  { name: "Half-Orc",         ac: 13, hp: 30,  initMod:  1, cr: "1"    },
  { name: "Ogre",             ac: 11, hp: 59,  initMod: -1, cr: "2"    },
  { name: "Troll",            ac: 15, hp: 84,  initMod:  1, cr: "5"    },
  { name: "Hill Giant",       ac: 13, hp: 105, initMod: -1, cr: "5"    },
  { name: "Stone Giant",      ac: 17, hp: 126, initMod:  2, cr: "7"    },
  { name: "Frost Giant",      ac: 15, hp: 138, initMod: -1, cr: "8"    },
  { name: "Fire Giant",       ac: 18, hp: 162, initMod: -1, cr: "9"    },
  // ── Undead ──
  { name: "Skeleton",         ac: 13, hp: 13,  initMod:  2, cr: "1/4"  },
  { name: "Zombie",           ac: 8,  hp: 22,  initMod: -2, cr: "1/4"  },
  { name: "Ghoul",            ac: 12, hp: 22,  initMod:  2, cr: "1"    },
  { name: "Ghast",            ac: 13, hp: 36,  initMod:  3, cr: "2"    },
  { name: "Shadow",           ac: 12, hp: 16,  initMod:  2, cr: "1/2"  },
  { name: "Wight",            ac: 14, hp: 45,  initMod:  2, cr: "3"    },
  { name: "Wraith",           ac: 13, hp: 67,  initMod:  3, cr: "5"    },
  { name: "Specter",          ac: 12, hp: 22,  initMod:  2, cr: "1"    },
  { name: "Vampire",          ac: 16, hp: 144, initMod:  4, cr: "13"   },
  { name: "Vampire Spawn",    ac: 15, hp: 82,  initMod:  4, cr: "5"    },
  { name: "Lich",             ac: 17, hp: 135, initMod:  3, cr: "21"   },
  // ── Beasts ──
  { name: "Wolf",             ac: 13, hp: 11,  initMod:  2, cr: "1/4"  },
  { name: "Dire Wolf",        ac: 14, hp: 37,  initMod:  2, cr: "1"    },
  { name: "Brown Bear",       ac: 11, hp: 34,  initMod:  0, cr: "1"    },
  { name: "Lion",             ac: 12, hp: 26,  initMod:  2, cr: "1"    },
  { name: "Tiger",            ac: 12, hp: 37,  initMod:  2, cr: "1"    },
  { name: "Giant Spider",     ac: 14, hp: 26,  initMod:  3, cr: "1"    },
  { name: "Crocodile",        ac: 12, hp: 19,  initMod:  0, cr: "1/2"  },
  { name: "Giant Crocodile",  ac: 14, hp: 114, initMod: -1, cr: "5"    },
  // ── Monsters ──
  { name: "Kobold",           ac: 12, hp: 5,   initMod:  2, cr: "1/8"  },
  { name: "Gnoll",            ac: 15, hp: 22,  initMod:  1, cr: "1/2"  },
  { name: "Lizardfolk",       ac: 15, hp: 22,  initMod:  0, cr: "1/2"  },
  { name: "Harpy",            ac: 11, hp: 38,  initMod:  1, cr: "1"    },
  { name: "Minotaur",         ac: 14, hp: 76,  initMod:  0, cr: "3"    },
  { name: "Basilisk",         ac: 15, hp: 52,  initMod: -1, cr: "3"    },
  { name: "Manticore",        ac: 14, hp: 68,  initMod:  1, cr: "3"    },
  { name: "Werewolf",         ac: 11, hp: 58,  initMod:  1, cr: "3"    },
  { name: "Medusa",           ac: 15, hp: 127, initMod:  2, cr: "6"    },
  { name: "Wyvern",           ac: 13, hp: 110, initMod:  0, cr: "6"    },
  { name: "Doppelganger",     ac: 14, hp: 52,  initMod:  4, cr: "3"    },
  { name: "Gargoyle",         ac: 15, hp: 52,  initMod:  0, cr: "2"    },
  { name: "Rust Monster",     ac: 14, hp: 27,  initMod:  4, cr: "1/2"  },
  { name: "Gelatinous Cube",  ac: 6,  hp: 84,  initMod: -2, cr: "2"    },
  { name: "Owlbear",          ac: 13, hp: 59,  initMod:  1, cr: "3"    },
  { name: "Displacer Beast",  ac: 13, hp: 85,  initMod:  2, cr: "3"    },
  { name: "Beholder",         ac: 18, hp: 180, initMod:  2, cr: "13"   },
  { name: "Mind Flayer",      ac: 15, hp: 71,  initMod:  4, cr: "7"    },
  // ── Drow ──
  { name: "Drow",             ac: 15, hp: 13,  initMod:  2, cr: "1/4"  },
  { name: "Drow Elite Warrior", ac: 18, hp: 71, initMod: 2, cr: "5"   },
  { name: "Drow Mage",        ac: 12, hp: 45,  initMod:  2, cr: "7"    },
  // ── Fiends ──
  { name: "Imp",              ac: 13, hp: 10,  initMod:  3, cr: "1"    },
  { name: "Quasit",           ac: 13, hp: 7,   initMod:  3, cr: "1"    },
  { name: "Dretch",           ac: 11, hp: 18,  initMod:  0, cr: "1/4"  },
  { name: "Hell Hound",       ac: 15, hp: 45,  initMod:  1, cr: "3"    },
  { name: "Bearded Devil",    ac: 13, hp: 52,  initMod:  2, cr: "3"    },
  { name: "Barbed Devil",     ac: 15, hp: 110, initMod:  3, cr: "5"    },
  { name: "Vrock",            ac: 15, hp: 104, initMod:  1, cr: "6"    },
  { name: "Hezrou",           ac: 16, hp: 136, initMod:  1, cr: "8"    },
  { name: "Balor",            ac: 19, hp: 262, initMod:  2, cr: "19"   },
  // ── Dragons ──
  { name: "Dragon Wyrmling (Black)",  ac: 17, hp: 33,  initMod: 2, cr: "2"  },
  { name: "Dragon Wyrmling (Blue)",   ac: 17, hp: 38,  initMod: 0, cr: "2"  },
  { name: "Dragon Wyrmling (Green)",  ac: 17, hp: 38,  initMod: 1, cr: "2"  },
  { name: "Dragon Wyrmling (Red)",    ac: 17, hp: 75,  initMod: 0, cr: "4"  },
  { name: "Dragon Wyrmling (White)",  ac: 16, hp: 32,  initMod: 0, cr: "2"  },
  { name: "Young Black Dragon",  ac: 18, hp: 127, initMod: 2, cr: "7"  },
  { name: "Young Blue Dragon",   ac: 18, hp: 152, initMod: 0, cr: "9"  },
  { name: "Young Green Dragon",  ac: 18, hp: 136, initMod: 1, cr: "8"  },
  { name: "Young Red Dragon",    ac: 18, hp: 178, initMod: 0, cr: "10" },
  { name: "Young White Dragon",  ac: 17, hp: 133, initMod: 0, cr: "6"  },
  { name: "Adult Black Dragon",  ac: 19, hp: 195, initMod: 2, cr: "14" },
  { name: "Adult Blue Dragon",   ac: 19, hp: 225, initMod: 0, cr: "16" },
  { name: "Adult Green Dragon",  ac: 19, hp: 207, initMod: 1, cr: "15" },
  { name: "Adult Red Dragon",    ac: 19, hp: 256, initMod: 0, cr: "17" },
  { name: "Adult White Dragon",  ac: 18, hp: 200, initMod: 0, cr: "13" },
];

// ── Type colours ──────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  player: { border: "#ffcc66", bg: "rgba(255,204,102,0.05)", badge: "#c9a030", badgeBg: "rgba(255,204,102,0.14)" },
  enemy:  { border: "#e57373", bg: "rgba(229,115,115,0.05)", badge: "#ef5350", badgeBg: "rgba(229,115,115,0.14)" },
  ally:   { border: "#81c784", bg: "rgba(129,199,132,0.05)", badge: "#66bb6a", badgeBg: "rgba(129,199,132,0.14)" },
  npc:    { border: "#64b5f6", bg: "rgba(100,181,246,0.05)", badge: "#42a5f5", badgeBg: "rgba(100,181,246,0.14)" },
};

// ── Attack state (card-based) ─────────────────────────────────────────────────
let attackState = { attackerId: null, targetId: null };

// ── State ─────────────────────────────────────────────────────────────────────
const SAVE_KEY = "dnd_combat_state";
let state = { round: 1, currentTurn: -1, combatants: [] };

try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    state = JSON.parse(saved);
    // Migrate: old conditions were plain strings, now they're { id, rounds }
    state.combatants.forEach(c => {
      if (Array.isArray(c.conditions)) {
        c.conditions = c.conditions.map(x =>
          typeof x === "string" ? { id: x, rounds: null } : x
        );
      } else {
        c.conditions = [];
      }
    });
  }
} catch (e) { /* ignore corrupt state */ }

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function roll(sides) { return Math.floor(Math.random() * sides) + 1; }

// ── Log ───────────────────────────────────────────────────────────────────────
const logEl = document.getElementById("combat-log");

function addLog(text, type) {
  const empty = logEl.querySelector(".log-empty");
  if (empty) empty.remove();
  const entry = document.createElement("div");
  entry.className = "log-entry" + (type ? " log-" + type : "");
  entry.textContent = text;
  logEl.insertBefore(entry, logEl.firstChild);
}

document.getElementById("btn-clear-log").addEventListener("click", () => {
  logEl.innerHTML = '<p class="log-empty">Combat log will appear here.</p>';
});

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  renderHero();
  renderCombatants();
  if (typeof renderField === "function") renderField();
  save();
}

// ── Hero ──────────────────────────────────────────────────────────────────────
const roundNumEl = document.getElementById("round-num");
const turnBanner = document.getElementById("turn-banner");
const btnStart   = document.getElementById("btn-start");
const btnEnd     = document.getElementById("btn-end");
const btnPrev    = document.getElementById("btn-prev");
const btnNext    = document.getElementById("btn-next");

function renderHero() {
  roundNumEl.textContent = state.round;
  const started = state.currentTurn >= 0;
  btnStart.style.display = started ? "none" : "";
  btnEnd.style.display   = started ? ""     : "none";
  btnPrev.disabled = !started || state.combatants.length === 0;
  btnNext.disabled = !started || state.combatants.length === 0;

  if (!started || state.combatants.length === 0) {
    turnBanner.innerHTML = `<span class="turn-label">&#8212; Not in combat &#8212;</span>`;
    return;
  }
  const c   = state.combatants[state.currentTurn];
  if (!c) return;
  const col = TYPE_COLORS[c.type] || TYPE_COLORS.npc;
  turnBanner.innerHTML =
    `<span class="turn-label">It's&nbsp;</span>` +
    `<span class="turn-name" style="color:${col.border}">${escHtml(c.name)}</span>` +
    `<span class="turn-label">'s turn</span>`;
}

// ── Combatant List ────────────────────────────────────────────────────────────
const listEl = document.getElementById("combatant-list");

function renderCombatants() {
  listEl.innerHTML = "";
  if (state.combatants.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#9876;</div>
        <p>No combatants yet.</p>
        <p class="empty-hint">Click <strong>+ Add Combatant</strong> to begin.</p>
      </div>`;
    return;
  }
  state.combatants.forEach((c, idx) => listEl.appendChild(buildCard(c, idx)));
}

function buildCard(c, idx) {
  const col      = TYPE_COLORS[c.type] || TYPE_COLORS.npc;
  const isPlayer = c.type === "player";
  const isActive = state.currentTurn === idx && state.currentTurn >= 0;
  const isDead   = !isPlayer && c.maxHp > 0 && c.hp <= 0;
  const hpPct    = (c.maxHp > 0) ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
  const hpColor  = hpPct > 60 ? "#4caf50" : hpPct > 30 ? "#ff9800" : "#e53935";
  const hasConds = (c.conditions || []).length > 0;

  const condHtml = (c.conditions || []).map(cond => {
    const cd = CONDITIONS.find(x => x.id === cond.id);
    if (!cd) return "";
    const roundsLabel = cond.rounds != null ? ` (${cond.rounds})` : "";
    return `<span class="condition-pill" style="border-color:${cd.color};color:${cd.color}">${cd.icon} ${cd.label}${roundsLabel}</span>`;
  }).join("");

  const isAttacker = attackState.attackerId === c.id;
  const isTarget   = attackState.targetId   === c.id;
  const div = document.createElement("div");
  div.className = `combatant-card${isActive ? " active" : ""}${isDead ? " dead" : ""}${isAttacker ? " is-attacker" : ""}${isTarget ? " is-target" : ""}`;
  div.style.setProperty("--type-color", col.border);
  div.style.setProperty("--type-bg",    col.bg);

  div.innerHTML = `
    <div class="card-left">
      <div class="card-initiative" title="Initiative">${c.initiative ?? "?"}</div>
    </div>
    <div class="card-body">
      <div class="card-top-row">
        <span class="card-name">${escHtml(c.name)}</span>
        <span class="card-type-badge" style="color:${col.badge};background:${col.badgeBg}">${c.type.toUpperCase()}</span>
        ${isActive ? `<span class="card-active-badge">&#9654; Turn</span>` : ""}
      </div>
      ${c.notes ? `<div class="card-notes">${escHtml(c.notes)}</div>` : ""}
      ${!isPlayer && c.maxHp > 0 ? `
        <div class="card-hp-row">
          <div class="hp-bar-wrap">
            <div class="hp-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
          </div>
          <span class="card-hp-text">
            ${isDead
              ? `<span class="dead-label">&#9760; Dead</span>`
              : `${c.hp}<span class="hp-sep">/</span>${c.maxHp}`}
          </span>
          <span class="card-ac">&#128737; ${c.ac ?? "?"}</span>
        </div>
      ` : ""}
      ${condHtml ? `<div class="card-conditions">${condHtml}</div>` : ""}
    </div>
    <div class="card-actions">
      ${!isPlayer ? `<button class="card-btn hp-btn"   title="Adjust HP">HP ±</button>` : ""}
      <button class="card-btn cond-btn" title="Conditions">&#9889;</button>
      ${hasConds   ? `<button class="card-btn clear-fx-btn" title="Clear all conditions">&#10005; FX</button>` : ""}
      <button class="card-btn edit-btn" title="Edit">&#9998;</button>
      <button class="card-btn del-btn"  title="Remove">&#10005;</button>
    </div>`;

  if (!isPlayer) {
    div.querySelector(".hp-btn").addEventListener("click",  e => { e.stopPropagation(); openHpAdjust(idx, e.currentTarget); });
  }
  div.querySelector(".cond-btn").addEventListener("click",  e => { e.stopPropagation(); openCondPicker(idx, e.currentTarget); });
  if (hasConds) {
    div.querySelector(".clear-fx-btn").addEventListener("click", e => { e.stopPropagation(); clearAllConditions(idx); });
  }
  div.querySelector(".edit-btn").addEventListener("click",  e => { e.stopPropagation(); openModal(idx); });
  div.querySelector(".del-btn").addEventListener("click",   e => { e.stopPropagation(); removeCombatant(idx); });

  // Card click (outside action buttons) → attack mode
  div.addEventListener("click", e => {
    if (e.target.closest(".card-actions")) return;
    onCardClick(c.id);
  });

  return div;
}

// ── Combat flow ───────────────────────────────────────────────────────────────
btnStart.addEventListener("click", () => {
  if (state.combatants.length === 0) return;
  sortCombatants();
  state.currentTurn = 0;
  addLog(`⚔  Combat started — Round ${state.round}`, "round");
  addLog(`▶  ${state.combatants[0].name}'s turn`, "turn");
  render();
});

btnEnd.addEventListener("click", () => {
  if (!confirm("End combat and reset all conditions?")) return;
  state.currentTurn = -1;
  state.round = 1;
  state.combatants.forEach(c => { c.conditions = []; });
  addLog("✓  Combat ended.", "info");
  render();
});

btnNext.addEventListener("click", advanceTurn);
btnPrev.addEventListener("click", retreatTurn);

function advanceTurn() {
  if (state.currentTurn < 0 || state.combatants.length === 0) return;
  // Tick conditions on the combatant whose turn is ENDING
  tickConditions(state.currentTurn);
  state.currentTurn = (state.currentTurn + 1) % state.combatants.length;
  if (state.currentTurn === 0) {
    state.round++;
    addLog(`━━━  Round ${state.round}  ━━━`, "round");
  }
  addLog(`▶  ${state.combatants[state.currentTurn].name}'s turn`, "turn");
  render();
}

function retreatTurn() {
  if (state.currentTurn < 0 || state.combatants.length === 0) return;
  if (state.currentTurn === 0 && state.round > 1) {
    state.round--;
    addLog(`↩  Back to Round ${state.round}`, "round");
  }
  state.currentTurn = (state.currentTurn - 1 + state.combatants.length) % state.combatants.length;
  addLog(`◀  Back to ${state.combatants[state.currentTurn].name}'s turn`, "turn");
  render();
}

// Decrement round-based conditions at the end of a combatant's turn
function tickConditions(idx) {
  const c = state.combatants[idx];
  if (!c || !Array.isArray(c.conditions)) return;
  const remaining = [];
  for (const cond of c.conditions) {
    if (cond.rounds == null) { remaining.push(cond); continue; } // permanent
    const newRounds = cond.rounds - 1;
    if (newRounds <= 0) {
      const cd = CONDITIONS.find(x => x.id === cond.id);
      addLog(`⏱  ${c.name}: ${cd ? cd.label : cond.id} expired`, "cond");
    } else {
      remaining.push({ ...cond, rounds: newRounds });
    }
  }
  c.conditions = remaining;
}

// ── Sort ──────────────────────────────────────────────────────────────────────
document.getElementById("btn-sort").addEventListener("click", () => { sortCombatants(); render(); });

function sortCombatants() {
  const activeId = state.currentTurn >= 0 ? (state.combatants[state.currentTurn] || {}).id : null;
  state.combatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  if (activeId) {
    const newIdx = state.combatants.findIndex(c => c.id === activeId);
    if (newIdx >= 0) state.currentTurn = newIdx;
  }
}

// ── Clear all ─────────────────────────────────────────────────────────────────
document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Remove all combatants and reset the tracker?")) return;
  state = { round: 1, currentTurn: -1, combatants: [] };
  addLog("✕  Tracker cleared.", "info");
  render();
});

// ── Remove one combatant ──────────────────────────────────────────────────────
function removeCombatant(idx) {
  const c = state.combatants[idx];
  if (!c) return;
  state.combatants.splice(idx, 1);
  if (state.combatants.length === 0) state.currentTurn = -1;
  else if (state.currentTurn >= state.combatants.length) state.currentTurn = 0;
  addLog(`✕  ${c.name} removed.`, "info");
  render();
}

// ── Clear all conditions on one combatant ─────────────────────────────────────
function clearAllConditions(idx) {
  const c = state.combatants[idx];
  if (!c) return;
  c.conditions = [];
  addLog(`✓  All conditions cleared from ${c.name}.`, "cond");
  render();
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
const combatantModal  = document.getElementById("combatant-modal");
const cmTitle         = document.getElementById("cm-title");
const cmName          = document.getElementById("cm-name");
const cmAc            = document.getElementById("cm-ac");
const cmHp            = document.getElementById("cm-hp");
const cmMaxHp         = document.getElementById("cm-maxhp");
const cmInit          = document.getElementById("cm-initiative");
const cmInitLabel     = document.getElementById("cm-init-label");
const cmCountInput    = document.getElementById("cm-count");
const cmNotes         = document.getElementById("cm-notes");
const cmError         = document.getElementById("cm-error");
const cmSave          = document.getElementById("cm-save");
const cmCancel        = document.getElementById("cm-cancel");
const cmTypeBtns      = document.querySelectorAll(".type-btn");
const cmRollBtn       = document.getElementById("cm-roll-init");
const cmNonPlayerRows = document.getElementById("cm-non-player-rows");
const cmPresetSearch  = document.getElementById("cm-preset-search");
const cmPresetList    = document.getElementById("cm-preset-list");
const cmPresetBadge   = document.getElementById("cm-preset-selected");

let editingIdx    = null;
let selectedType  = "player";
let selectedPreset = null;  // { name, ac, hp, initMod, cr }

// ── Type buttons ──────────────────────────────────────────────────────────────
cmTypeBtns.forEach(btn =>
  btn.addEventListener("click", () => {
    selectedType = btn.dataset.type;
    syncTypeBtns();
    updatePlayerFields();
  })
);

function syncTypeBtns() {
  cmTypeBtns.forEach(b => b.classList.toggle("active", b.dataset.type === selectedType));
}

function updatePlayerFields() {
  const isPlayer = selectedType === "player";
  cmNonPlayerRows.style.display = isPlayer ? "none" : "";
  cmInitLabel.firstChild.textContent = isPlayer ? "Initiative rolled" : "Initiative";
}

// ── d20 roll button ───────────────────────────────────────────────────────────
cmRollBtn.addEventListener("click", () => {
  const initMod = selectedPreset ? selectedPreset.initMod : 0;
  const rolled  = roll(20) + initMod;
  cmInit.value  = rolled;
  cmInit.focus();
});

// ── Monster preset search ─────────────────────────────────────────────────────
cmPresetSearch.addEventListener("input", () => {
  const q = cmPresetSearch.value.trim().toLowerCase();
  if (!q) { cmPresetList.innerHTML = ""; cmPresetList.style.display = "none"; return; }
  const matches = MONSTER_PRESETS.filter(m => m.name.toLowerCase().includes(q)).slice(0, 12);
  if (matches.length === 0) { cmPresetList.innerHTML = ""; cmPresetList.style.display = "none"; return; }

  cmPresetList.innerHTML = "";
  matches.forEach(m => {
    const item = document.createElement("div");
    item.className = "preset-item";
    item.innerHTML = `<span class="preset-name">${escHtml(m.name)}</span>
      <span class="preset-meta">CR ${m.cr} &nbsp;·&nbsp; HP ${m.hp} &nbsp;·&nbsp; AC ${m.ac}</span>`;
    item.addEventListener("click", () => applyPreset(m));
    cmPresetList.appendChild(item);
  });
  cmPresetList.style.display = "block";
});

cmPresetSearch.addEventListener("blur", () => {
  setTimeout(() => { cmPresetList.style.display = "none"; }, 150);
});

function applyPreset(preset) {
  selectedPreset = preset;
  cmPresetSearch.value = preset.name;
  cmPresetList.style.display = "none";

  // Auto-fill stats
  if (!cmName.value.trim()) cmName.value = preset.name;
  cmMaxHp.value = preset.hp;
  cmHp.value    = preset.hp;
  cmAc.value    = preset.ac;

  // Roll initiative with the preset's DEX mod
  cmInit.value  = roll(20) + preset.initMod;

  // Show badge
  cmPresetBadge.textContent = `${preset.name} · CR ${preset.cr} · Init mod ${preset.initMod >= 0 ? "+" : ""}${preset.initMod}`;
  cmPresetBadge.style.display = "block";
}

// ── Open modal ────────────────────────────────────────────────────────────────
document.getElementById("btn-add").addEventListener("click", () => openModal(null));

function openModal(idx) {
  editingIdx     = idx;
  selectedPreset = null;
  cmError.textContent = "";
  cmPresetBadge.style.display = "none";
  cmPresetSearch.value = "";
  cmPresetList.style.display = "none";

  if (idx !== null && idx !== undefined) {
    const c = state.combatants[idx];
    cmTitle.textContent  = "Edit Combatant";
    cmName.value  = c.name;
    cmAc.value    = c.ac ?? "";
    cmHp.value    = c.hp ?? "";
    cmMaxHp.value = c.maxHp ?? "";
    cmInit.value  = c.initiative ?? "";
    cmNotes.value = c.notes || "";
    cmCountInput.value = 1;
    selectedType  = c.type;
    cmSave.textContent = "Save";
  } else {
    cmTitle.textContent = "Add Combatant";
    cmName.value = cmAc.value = cmHp.value = cmMaxHp.value = cmInit.value = cmNotes.value = "";
    cmCountInput.value = 1;
    selectedType = "player";
    cmSave.textContent = "Add";
  }

  syncTypeBtns();
  updatePlayerFields();
  combatantModal.classList.add("open");
  setTimeout(() => cmName.focus(), 60);
}

function closeModal() { combatantModal.classList.remove("open"); editingIdx = null; }
cmCancel.addEventListener("click", closeModal);
combatantModal.addEventListener("click", e => { if (e.target === combatantModal) closeModal(); });
cmName.addEventListener("keydown", e => { if (e.key === "Enter") cmSave.click(); });

// ── Save modal ────────────────────────────────────────────────────────────────
cmSave.addEventListener("click", () => {
  const name  = cmName.value.trim();
  const isPlayer = selectedType === "player";
  cmError.textContent = "";

  if (!name) { cmError.textContent = "Name is required."; return; }

  // Players only need initiative, no HP required
  if (!isPlayer) {
    const maxHpVal = parseInt(cmMaxHp.value, 10);
    if (isNaN(maxHpVal) || maxHpVal < 1) { cmError.textContent = "Max HP must be at least 1."; return; }
  }

  const initVal  = parseInt(cmInit.value,  10);
  const maxHpVal = parseInt(cmMaxHp.value, 10);
  const hpVal    = parseInt(cmHp.value,    10);
  const acVal    = parseInt(cmAc.value,    10);
  const count    = Math.max(1, Math.min(26, parseInt(cmCountInput.value, 10) || 1));

  if (editingIdx !== null) {
    const c = state.combatants[editingIdx];
    c.name       = name;
    c.type       = selectedType;
    c.initiative = isNaN(initVal) ? c.initiative : initVal;
    if (!isPlayer) {
      c.hp    = isNaN(hpVal)    ? c.hp    : Math.max(0, hpVal);
      c.maxHp = isNaN(maxHpVal) ? c.maxHp : maxHpVal;
      c.ac    = isNaN(acVal)    ? c.ac    : acVal;
      c.notes = cmNotes.value.trim() || null;
    }
    addLog(`✎  ${name} updated.`, "info");
  } else {
    for (let i = 0; i < count; i++) {
      const suffix  = count > 1 ? " " + (i + 1) : "";
      // Per-instance initiative roll when using a preset and field is left at the auto-rolled value
      const initForThis = isNaN(initVal)
        ? (selectedPreset ? roll(20) + selectedPreset.initMod : 0)
        : (count > 1 && selectedPreset ? roll(20) + selectedPreset.initMod : initVal);

      state.combatants.push({
        id:         genId(),
        name:       name + suffix,
        type:       selectedType,
        initiative: initForThis,
        hp:         isPlayer ? 0 : (isNaN(hpVal) ? (isNaN(maxHpVal) ? 0 : maxHpVal) : Math.max(0, hpVal)),
        maxHp:      isPlayer ? 0 : (isNaN(maxHpVal) ? 0 : maxHpVal),
        ac:         isPlayer ? 0 : (isNaN(acVal) ? 10 : acVal),
        conditions: [],
        notes:      isPlayer ? null : (cmNotes.value.trim() || null),
      });
    }
    const label = count > 1 ? `${name} ×${count}` : name;
    addLog(`+  ${label} added.`, "info");
  }

  closeModal();
  render();
});

// ── HP Adjust ─────────────────────────────────────────────────────────────────
const hpOverlay   = document.getElementById("hp-adjust-overlay");
const hpInput     = document.getElementById("hp-adjust-input");
const hpDamageBtn = document.getElementById("hp-damage-btn");
const hpHealBtn   = document.getElementById("hp-heal-btn");
const hpCloseBtn  = document.getElementById("hp-close-btn");
let hpIdx = null;

function openHpAdjust(idx, anchor) {
  hpIdx = idx;
  hpInput.value = "";
  hpOverlay.style.display = "flex";
  positionNear(hpOverlay, anchor);
  setTimeout(() => hpInput.focus(), 30);
}

function applyHp(isDamage) {
  const amt = parseInt(hpInput.value, 10);
  if (isNaN(amt) || amt <= 0) return;
  const c = state.combatants[hpIdx];
  if (!c) return;

  if (isDamage) {
    c.hp = Math.max(0, c.hp - amt);
    addLog(`⚔  ${c.name} took ${amt} damage → ${c.hp}/${c.maxHp}`, "damage");
    if (c.hp === 0) addLog(`☠  ${c.name} has fallen!`, "death");
  } else {
    c.hp = Math.min(c.maxHp, c.hp + amt);
    addLog(`✦  ${c.name} healed ${amt} HP → ${c.hp}/${c.maxHp}`, "heal");
  }
  hpOverlay.style.display = "none";
  hpIdx = null;
  render();
}

hpDamageBtn.addEventListener("click", () => applyHp(true));
hpHealBtn.addEventListener("click",   () => applyHp(false));
hpCloseBtn.addEventListener("click",  () => { hpOverlay.style.display = "none"; hpIdx = null; });
hpInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  applyHp(true);
  if (e.key === "Escape") { hpOverlay.style.display = "none"; hpIdx = null; }
});

// ── Condition Picker ──────────────────────────────────────────────────────────
const condPicker      = document.getElementById("condition-picker");
const condGrid        = document.getElementById("condition-grid");
const condRoundsInput = document.getElementById("cond-rounds-input");
let condIdx = null;

function openCondPicker(idx, anchor) {
  condIdx = idx;
  const c = state.combatants[idx];
  condGrid.innerHTML = "";

  CONDITIONS.forEach(cd => {
    const existing = (c.conditions || []).find(x => x.id === cd.id);
    const btn = document.createElement("button");
    btn.className = "cond-picker-btn" + (existing ? " active" : "");
    btn.style.color = cd.color;
    if (existing) btn.style.borderColor = cd.color;
    const roundsLabel = existing && existing.rounds != null ? ` (${existing.rounds})` : "";
    btn.textContent = `${cd.icon} ${cd.label}${roundsLabel}`;

    btn.addEventListener("click", e => {
      e.stopPropagation();
      const conds = c.conditions || [];
      if (conds.find(x => x.id === cd.id)) {
        // Remove
        c.conditions = conds.filter(x => x.id !== cd.id);
        addLog(`✓  ${c.name}: ${cd.label} removed`, "cond");
      } else {
        // Add with optional round duration
        const rounds = parseInt(condRoundsInput.value, 10);
        c.conditions = [...conds, { id: cd.id, rounds: isNaN(rounds) || rounds < 1 ? null : rounds }];
        const durLabel = (!isNaN(rounds) && rounds > 0) ? ` (${rounds} rounds)` : " (permanent)";
        addLog(`⚠  ${c.name}: ${cd.label} applied${durLabel}`, "cond");
      }
      condPicker.style.display = "none";
      condIdx = null;
      render();
    });
    condGrid.appendChild(btn);
  });

  condPicker.style.display = "block";
  positionNear(condPicker, anchor);
}

// ── Position helper ───────────────────────────────────────────────────────────
function positionNear(el, anchor) {
  const r = anchor.getBoundingClientRect();
  el.style.left = Math.max(8, r.left) + "px";
  el.style.top  = (r.bottom + 6) + "px";
  requestAnimationFrame(() => {
    const er = el.getBoundingClientRect();
    if (er.bottom > window.innerHeight - 12) el.style.top  = Math.max(8, r.top - er.height - 6) + "px";
    if (er.right  > window.innerWidth  - 12) el.style.left = Math.max(8, window.innerWidth - er.width - 12) + "px";
  });
}

// ── Close overlays on outside click ──────────────────────────────────────────
document.addEventListener("click", e => {
  if (hpOverlay.style.display !== "none" && !hpOverlay.contains(e.target))
    { hpOverlay.style.display = "none"; hpIdx = null; }
  if (condPicker.style.display !== "none"
      && !condPicker.contains(e.target)
      && !e.target.closest(".cond-btn"))
    { condPicker.style.display = "none"; condIdx = null; }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (e.key === "Escape") {
    hpOverlay.style.display = "none";
    condPicker.style.display = "none";
    hpIdx = condIdx = null;
    if (attackState.attackerId) cancelAttack();
  }
  if ((e.key === " " || e.key === "ArrowRight") && state.currentTurn >= 0) { e.preventDefault(); advanceTurn(); }
  if (e.key === "ArrowLeft" && state.currentTurn >= 0)                      { e.preventDefault(); retreatTurn(); }
});

// ── Card Attack Flow ──────────────────────────────────────────────────────────
const fieldAttackBar     = document.getElementById("field-attack-bar");
const attackAttackerName = document.getElementById("attack-attacker-name");
const attackTargetName   = document.getElementById("attack-target-name");
const attackDmgGroup     = document.getElementById("attack-dmg-group");
const attackDmgInput     = document.getElementById("attack-dmg-input");

function onCardClick(id) {
  const c = state.combatants.find(x => x.id === id);
  if (!c) return;

  if (!attackState.attackerId) {
    attackState = { attackerId: id, targetId: null };
    showAttackBar(c, null);
  } else if (attackState.attackerId === id) {
    cancelAttack();
    return;
  } else {
    attackState.targetId = id;
    const attacker = state.combatants.find(x => x.id === attackState.attackerId);
    showAttackBar(attacker, c);
  }
  render();
}

function showAttackBar(attacker, target) {
  fieldAttackBar.style.display = "flex";
  attackAttackerName.textContent = attacker ? attacker.name : "—";

  if (!target) {
    attackTargetName.textContent = "Select a target from the list";
    attackTargetName.style.fontStyle = "italic";
    attackTargetName.style.color = "#888";
    attackDmgGroup.style.display = "none";
  } else {
    const hpText = (target.type !== "player" && target.maxHp > 0)
      ? `  (${target.hp}/${target.maxHp} HP)` : "";
    attackTargetName.textContent = target.name + hpText;
    attackTargetName.style.fontStyle = "normal";
    attackTargetName.style.color = "#e57373";
    attackDmgGroup.style.display = "flex";
    attackDmgInput.value = "";
    setTimeout(() => attackDmgInput.focus(), 50);
  }
}

function cancelAttack() {
  attackState = { attackerId: null, targetId: null };
  fieldAttackBar.style.display = "none";
  render();
}

function resolveAttack(isDamage) {
  const amt = parseInt(attackDmgInput.value, 10);
  if (isNaN(amt) || amt < 0) return;
  const attacker = state.combatants.find(c => c.id === attackState.attackerId);
  const target   = state.combatants.find(c => c.id === attackState.targetId);
  if (!target) return;

  if (isDamage) {
    if (target.type !== "player" && target.maxHp > 0) {
      target.hp = Math.max(0, target.hp - amt);
      addLog(`⚔  ${attacker ? attacker.name : "?"} dealt ${amt} damage to ${target.name} → ${target.hp}/${target.maxHp}`, "damage");
      if (target.hp === 0) addLog(`☠  ${target.name} has fallen!`, "death");
    } else {
      addLog(`⚔  ${attacker ? attacker.name : "?"} dealt ${amt} damage to ${target.name}`, "damage");
    }
  } else {
    if (target.type !== "player" && target.maxHp > 0) {
      target.hp = Math.min(target.maxHp, target.hp + amt);
      addLog(`✦  ${attacker ? attacker.name : "?"} healed ${target.name} for ${amt} → ${target.hp}/${target.maxHp}`, "heal");
    } else {
      addLog(`✦  ${attacker ? attacker.name : "?"} healed ${target.name} for ${amt}`, "heal");
    }
  }

  attackState.targetId = null;
  showAttackBar(attacker, null);
  render();
}

document.getElementById("attack-deal-btn").addEventListener("click",  () => resolveAttack(true));
document.getElementById("attack-heal-btn").addEventListener("click",  () => resolveAttack(false));
document.getElementById("attack-cancel-btn").addEventListener("click", cancelAttack);
attackDmgInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  resolveAttack(true);
  if (e.key === "Escape") cancelAttack();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
render();

// (battlefield removed — attack flow now uses initiative list cards)

