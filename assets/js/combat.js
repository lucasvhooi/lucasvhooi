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
  player: { border: "#ffcc66", bg: "rgba(255,204,102,0.05)", activeBg: "rgba(80,55,0,0.45)",   badge: "#c9a030", badgeBg: "rgba(255,204,102,0.14)" },
  enemy:  { border: "#e57373", bg: "rgba(229,115,115,0.05)", activeBg: "rgba(60,8,8,0.6)",      badge: "#ef5350", badgeBg: "rgba(229,115,115,0.14)" },
  ally:   { border: "#81c784", bg: "rgba(129,199,132,0.05)", activeBg: "rgba(0,40,10,0.45)",    badge: "#66bb6a", badgeBg: "rgba(129,199,132,0.14)" },
  npc:    { border: "#64b5f6", bg: "rgba(100,181,246,0.05)", activeBg: "rgba(0,25,60,0.45)",    badge: "#42a5f5", badgeBg: "rgba(100,181,246,0.14)" },
};

// ── Attack state (card-based) ─────────────────────────────────────────────────
let attackState = { attackerId: null, targetId: null };
let attackMode  = false;  // true = waiting to pick a target (entered via double-click)

// ── State ─────────────────────────────────────────────────────────────────────
const SAVE_KEY = "dnd_combat_state";
let state = { round: 1, currentTurn: -1, combatants: [], logEntries: [], lootLog: [] };

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
    // Migrate: add missing log/loot arrays for old saves
    if (!state.logEntries) state.logEntries = [];
    if (!state.lootLog)    state.lootLog    = [];
  }
} catch (e) { /* ignore corrupt state */ }

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escHtmlNl(s) {
  return escHtml(s ?? "").replace(/\n/g, "<br>");
}
function roll(sides) { return Math.floor(Math.random() * sides) + 1; }

// ── Log ───────────────────────────────────────────────────────────────────────
const logEl = document.getElementById("combat-log");

function _renderLogEntry(entry) {
  const empty = logEl.querySelector(".log-empty");
  if (empty) empty.remove();
  const div = document.createElement("div");
  div.className = "log-entry" + (entry.type ? " log-" + entry.type : "");
  div.textContent = entry.text;
  logEl.insertBefore(div, logEl.firstChild);
}

function addLog(text, type) {
  const entry = { text, type: type || null };
  state.logEntries.push(entry);
  _renderLogEntry(entry);
  save();
}

document.getElementById("btn-clear-log").addEventListener("click", () => {
  state.logEntries = [];
  save();
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

  const isAttacker    = attackState.attackerId === c.id;
  const isTarget      = attackState.targetId   === c.id;
  const isAttackReady = isAttacker && attackMode;
  const div = document.createElement("div");
  div.className = `combatant-card${isActive ? " active" : ""}${isDead ? " dead" : ""}${isAttacker ? " is-attacker" : ""}${isTarget ? " is-target" : ""}${isAttackReady ? " is-attack-mode" : ""}`;
  div.dataset.id = c.id;
  div.style.setProperty("--type-color",     col.border);
  div.style.setProperty("--type-bg",        col.bg);
  div.style.setProperty("--type-active-bg", col.activeBg || "rgba(255,255,255,0.08)");

  // Extra template fields (only shown if present)
  const s = c.stats;
  const statMod = v => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? "+" : "") + m; };
  const statsHtml = s ? `
    <div class="card-stats-row">
      ${["str","dex","con","int","wis","cha"].map(k => s[k] != null ? `<span class="card-stat"><span class="card-stat-name">${k.toUpperCase()}</span><span class="card-stat-val">${s[k]}</span><span class="card-stat-mod">${statMod(s[k])}</span></span>` : "").join("")}
    </div>` : "";
  const attacksHtml = (c.attacks && c.attacks.length) ? `
    <div class="card-attacks">
      ${c.attacks.map(a => `
        <div class="card-attack-row">
          <div class="card-atk-header">
            <span class="card-atk-name">${escHtml(a.name)}</span>
            ${a.hit ? `<span class="card-atk-hit">${escHtml(a.hit)}</span>` : ""}
          </div>
          ${a.damage ? `<span class="card-atk-dmg">${escHtmlNl(a.damage)}</span>` : ""}
        </div>`).join("")}
    </div>` : "";
  const extraHtml = [
    c.speed       ? `<div class="card-extra-row"><span class="card-extra-label">Speed</span>${escHtmlNl(c.speed)}</div>` : "",
    c.saves       ? `<div class="card-extra-row"><span class="card-extra-label">Saves</span>${escHtmlNl(c.saves)}</div>` : "",
    c.condImm     ? `<div class="card-extra-row"><span class="card-extra-label">Immune</span>${escHtmlNl(c.condImm)}</div>` : "",
    c.languages   ? `<div class="card-extra-row"><span class="card-extra-label">Lang</span>${escHtmlNl(c.languages)}</div>` : "",
  ].join("");

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
      ${c.notes ? `<div class="card-notes">${escHtmlNl(c.notes)}</div>` : ""}
      ${!isPlayer && c.maxHp > 0 ? `
        <div class="card-hp-row">
          <div class="hp-bar-wrap">
            <div class="hp-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
          </div>
          <span class="card-hp-text">
            ${isDead ? `<span class="dead-label">&#9760; Dead</span>` : `${c.hp}<span class="hp-sep">/</span>${c.maxHp}`}
          </span>
          <span class="card-ac">&#128737; ${c.ac ?? "?"}</span>
        </div>
      ` : ""}
      ${statsHtml}
      ${attacksHtml}
      ${extraHtml}
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

  // Single click: select / switch selection (or pick target when in attack mode)
  div.addEventListener("click", e => {
    if (e.target.closest(".card-actions")) return;
    onCardClick(c.id);
  });

  // Double click: enter attack mode with this combatant as the attacker
  div.addEventListener("dblclick", e => {
    if (e.target.closest(".card-actions")) return;
    onCardDblClick(c.id);
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
  state.combatants.forEach(c => { c.conditions = []; c.lootDropped = false; });
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
  const active = state.combatants[state.currentTurn];
  addLog(`▶  ${active.name}'s turn`, "turn");
  // Auto-select the new active combatant (no attack mode)
  attackMode  = false;
  attackState = { attackerId: active.id, targetId: null };
  render();
  showAttackBar(active, null);
}

function retreatTurn() {
  if (state.currentTurn < 0 || state.combatants.length === 0) return;
  if (state.currentTurn === 0 && state.round > 1) {
    state.round--;
    addLog(`↩  Back to Round ${state.round}`, "round");
  }
  state.currentTurn = (state.currentTurn - 1 + state.combatants.length) % state.combatants.length;
  const active = state.combatants[state.currentTurn];
  addLog(`◀  Back to ${active.name}'s turn`, "turn");
  attackMode  = false;
  attackState = { attackerId: active.id, targetId: null };
  render();
  showAttackBar(active, null);
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
const cmNonPlayerRows   = document.getElementById("cm-non-player-rows");
const cmPresetSearch    = document.getElementById("cm-preset-search");
const cmPresetList      = document.getElementById("cm-preset-list");
const cmPresetBadge     = document.getElementById("cm-preset-selected");
const cmNameRow         = document.getElementById("cm-name-row");
const cmEnemyTmplRow    = document.getElementById("cm-enemy-tmpl-row");
const cmEnemyCountRow   = document.getElementById("cm-enemy-count-row");
const cmEnemyTmplSearch = document.getElementById("cm-enemy-tmpl-search");
const cmEnemyTmplList   = document.getElementById("cm-enemy-tmpl-list");
const cmEnemyTmplBadge  = document.getElementById("cm-enemy-tmpl-badge");
const cmEnemyCountInput = document.getElementById("cm-enemy-count");

let editingIdx        = null;
let selectedType      = "player";
let selectedPreset    = null;  // { name, ac, hp, initMod, cr }
let selectedEnemyTmpl = null;  // picked from enemyTemplates

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

const cmLootRows = document.getElementById("cm-loot-rows");
const cmLootGpMin    = document.getElementById("cm-loot-gp-min");
const cmLootGpMax    = document.getElementById("cm-loot-gp-max");
const cmLootItemsMin = document.getElementById("cm-loot-items-min");
const cmLootItemsMax = document.getElementById("cm-loot-items-max");
const cmLootTagGrid  = document.getElementById("cm-loot-tags");

// Toggle active state on loot tag buttons
cmLootTagGrid.querySelectorAll(".loot-tag-btn").forEach(btn => {
  btn.addEventListener("click", () => btn.classList.toggle("active"));
});

function getActiveLootTags() {
  return [...cmLootTagGrid.querySelectorAll(".loot-tag-btn.active")].map(b => b.dataset.tag);
}

function setActiveLootTags(tags) {
  const tagSet = new Set(tags || []);
  cmLootTagGrid.querySelectorAll(".loot-tag-btn").forEach(btn => {
    btn.classList.toggle("active", tagSet.has(btn.dataset.tag));
  });
}

function updatePlayerFields() {
  const isPlayer    = selectedType === "player";
  const isEnemy     = selectedType === "enemy";
  const isAddEnemy  = isEnemy && editingIdx === null;

  // Simplified add-enemy mode: template search + initiative + count only
  cmNameRow.style.display        = isAddEnemy ? "none" : "";
  cmEnemyTmplRow.style.display   = isAddEnemy ? ""     : "none";
  cmEnemyCountRow.style.display  = isAddEnemy ? ""     : "none";
  cmNonPlayerRows.style.display  = isAddEnemy || isPlayer ? "none" : "";
  document.getElementById("cm-preset-row").style.display = isAddEnemy ? "none" : (isPlayer ? "none" : "");
  cmLootRows.style.display       = isEnemy && !isAddEnemy ? "" : "none";
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

// ── Enemy template search (simplified add-enemy mode) ─────────────────────────
cmEnemyTmplSearch.addEventListener("input", () => {
  const q = cmEnemyTmplSearch.value.trim().toLowerCase();
  const matches = q
    ? enemyTemplates.filter(t => t.name.toLowerCase().includes(q)).slice(0, 12)
    : enemyTemplates.slice(0, 12);
  if (!matches.length) { cmEnemyTmplList.innerHTML = `<div class="preset-item" style="color:#666;font-style:italic">No templates found</div>`; cmEnemyTmplList.style.display = "block"; return; }
  cmEnemyTmplList.innerHTML = "";
  matches.forEach(t => {
    const item = document.createElement("div");
    item.className = "preset-item";
    item.innerHTML = `<span class="preset-name">${escHtml(t.name)}</span>
      <span class="preset-meta">${t.cr ? "CR " + t.cr + " · " : ""}HP ${t.hp ?? "?"} · AC ${t.ac ?? "?"}</span>`;
    item.addEventListener("mousedown", e => { e.preventDefault(); applyEnemyTemplate(t); });
    cmEnemyTmplList.appendChild(item);
  });
  cmEnemyTmplList.style.display = "block";
});
cmEnemyTmplSearch.addEventListener("focus",  () => cmEnemyTmplSearch.dispatchEvent(new Event("input")));
cmEnemyTmplSearch.addEventListener("blur",   () => setTimeout(() => { cmEnemyTmplList.style.display = "none"; }, 150));

function applyEnemyTemplate(tmpl) {
  selectedEnemyTmpl = tmpl;
  cmEnemyTmplSearch.value = tmpl.name;
  cmEnemyTmplList.style.display = "none";
  const initMod = tmpl.initMod ?? 0;
  cmInit.value = roll(20) + initMod;
  cmEnemyTmplBadge.textContent = `${tmpl.name}${tmpl.cr ? " · CR " + tmpl.cr : ""} · HP ${tmpl.hp ?? "?"} · AC ${tmpl.ac ?? "?"}`;
  cmEnemyTmplBadge.style.display = "block";
  cmInit.focus();
}

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
  editingIdx        = idx;
  selectedPreset    = null;
  selectedEnemyTmpl = null;
  cmError.textContent = "";
  cmPresetBadge.style.display = "none";
  cmPresetSearch.value = "";
  cmPresetList.style.display = "none";
  cmEnemyTmplSearch.value = "";
  cmEnemyTmplList.style.display = "none";
  cmEnemyTmplBadge.style.display = "none";
  cmEnemyCountInput.value = 1;

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
    // Populate loot fields
    cmLootGpMin.value    = c.loot?.gpMin    ?? 0;
    cmLootGpMax.value    = c.loot?.gpMax    ?? 0;
    cmLootItemsMin.value = c.loot?.itemsMin ?? 0;
    cmLootItemsMax.value = c.loot?.itemsMax ?? 0;
    setActiveLootTags(c.loot?.tags ?? []);
  } else {
    cmTitle.textContent = "Add Combatant";
    cmName.value = cmAc.value = cmHp.value = cmMaxHp.value = cmInit.value = cmNotes.value = "";
    cmCountInput.value = 1;
    selectedType = "enemy";   // default to enemy since that's the common case
    cmSave.textContent = "Add";
    // Reset loot fields
    cmLootGpMin.value = cmLootGpMax.value = cmLootItemsMin.value = cmLootItemsMax.value = "0";
    setActiveLootTags([]);
  }

  syncTypeBtns();
  updatePlayerFields();
  combatantModal.classList.add("open");
  setTimeout(() => (editingIdx === null && selectedType === "enemy" ? cmEnemyTmplSearch : cmName).focus(), 60);
}

function closeModal() { combatantModal.classList.remove("open"); editingIdx = null; }
cmCancel.addEventListener("click", closeModal);
combatantModal.addEventListener("click", e => { if (e.target === combatantModal) closeModal(); });
cmName.addEventListener("keydown", e => { if (e.key === "Enter") cmSave.click(); });

// ── Save modal ────────────────────────────────────────────────────────────────
cmSave.addEventListener("click", () => {
  const isPlayer   = selectedType === "player";
  const isAddEnemy = selectedType === "enemy" && editingIdx === null;
  cmError.textContent = "";

  // Simplified add-enemy path
  if (isAddEnemy) {
    if (!selectedEnemyTmpl) { cmError.textContent = "Select an enemy template."; return; }
    const initVal = parseInt(cmInit.value, 10);
    if (isNaN(initVal)) { cmError.textContent = "Enter an initiative value."; return; }
    const count = Math.max(1, Math.min(26, parseInt(cmEnemyCountInput.value, 10) || 1));
    const t = selectedEnemyTmpl;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? " " + letters[i] : "";
      const initForThis = count > 1 ? roll(20) + (t.initMod ?? 0) : initVal;
      state.combatants.push({
        id:         genId(),
        name:       t.name + suffix,
        type:       "enemy",
        initiative: initForThis,
        hp:         t.hp ?? 0,
        maxHp:      t.hp ?? 0,
        ac:         t.ac ?? 10,
        conditions: [],
        notes:      t.notes   || null,
        templateId: t.id,
        loot:       t.loot    ?? null,
        stats:      t.stats   || null,
        attacks:    Array.isArray(t.attacks) ? t.attacks : (t.attacks ? Object.values(t.attacks) : null),
        speed:      t.speed   || null,
        saves:      t.saves   || null,
        condImm:    t.condImm || null,
        languages:  t.languages || null,
      });
    }
    const label = count > 1 ? `${t.name} ×${count}` : t.name;
    addLog(`+  ${label} added.`, "info");
    closeModal();
    render();
    return;
  }

  const name  = cmName.value.trim();
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
    if (selectedType === "enemy") {
      c.loot = {
        gpMin:    parseInt(cmLootGpMin.value,    10) || 0,
        gpMax:    parseInt(cmLootGpMax.value,    10) || 0,
        itemsMin: parseInt(cmLootItemsMin.value, 10) || 0,
        itemsMax: parseInt(cmLootItemsMax.value, 10) || 0,
        tags:     getActiveLootTags(),
      };
    }
    addLog(`✎  ${name} updated.`, "info");
  } else {
    for (let i = 0; i < count; i++) {
      const suffix  = count > 1 ? " " + (i + 1) : "";
      // Per-instance initiative roll when using a preset and field is left at the auto-rolled value
      const initForThis = isNaN(initVal)
        ? (selectedPreset ? roll(20) + selectedPreset.initMod : 0)
        : (count > 1 && selectedPreset ? roll(20) + selectedPreset.initMod : initVal);

      const lootCfg = selectedType === "enemy" ? {
        gpMin:    parseInt(cmLootGpMin.value,    10) || 0,
        gpMax:    parseInt(cmLootGpMax.value,    10) || 0,
        itemsMin: parseInt(cmLootItemsMin.value, 10) || 0,
        itemsMax: parseInt(cmLootItemsMax.value, 10) || 0,
        tags:     getActiveLootTags(),
      } : null;

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
        loot:       lootCfg,
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
    const wasDead = c.hp <= 0;
    c.hp = Math.max(0, c.hp - amt);
    addLog(`⚔  ${c.name} took ${amt} damage → ${c.hp}/${c.maxHp}`, "damage");
    if (c.hp === 0 && !wasDead) {
      addLog(`☠  ${c.name} has fallen!`, "death");
      if (c.type === "enemy" && !c.lootDropped) { c.lootDropped = true; addLootDrop(c); }
    }
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

  if (attackMode) {
    // In attack mode: clicking a card picks the target — full render needed
    if (attackState.attackerId === id) {
      attackMode = false;
      attackState.targetId = null;
      showAttackBar(c, null);
    } else {
      attackState.targetId = id;
      const attacker = state.combatants.find(x => x.id === attackState.attackerId);
      showAttackBar(attacker, c);
    }
    render();
  } else {
    // Not in attack mode: just update selection highlighting, no DOM rebuild
    attackState = { attackerId: id, targetId: null };
    showAttackBar(c, null);
    patchCardClasses();
  }
}

// Lightweight class-only update — avoids full DOM rebuild on simple selection change
function patchCardClasses() {
  state.combatants.forEach(c => {
    const card = listEl.querySelector(`.combatant-card[data-id="${c.id}"]`);
    if (!card) return;
    const isAttacker    = attackState.attackerId === c.id;
    const isTarget      = attackState.targetId   === c.id;
    const isAttackReady = isAttacker && attackMode;
    card.classList.toggle("is-attacker",    isAttacker);
    card.classList.toggle("is-target",      isTarget);
    card.classList.toggle("is-attack-mode", isAttackReady);
  });
}

function onCardDblClick(id) {
  const c = state.combatants.find(x => x.id === id);
  if (!c) return;
  // Enter attack mode with this combatant as the attacker
  attackMode  = true;
  attackState = { attackerId: id, targetId: null };
  showAttackBar(c, null);
  render();
}

function showAttackBar(attacker, target) {
  fieldAttackBar.style.display = "flex";
  attackAttackerName.textContent = attacker ? attacker.name : "—";

  if (!target) {
    if (attackMode) {
      attackTargetName.textContent  = "Select a target…";
      attackTargetName.style.fontStyle = "italic";
      attackTargetName.style.color     = "#e57373";
    } else {
      attackTargetName.textContent  = "Double-click to attack";
      attackTargetName.style.fontStyle = "italic";
      attackTargetName.style.color     = "#888";
    }
    attackDmgGroup.style.display = "none";
  } else {
    const hpText = (target.type !== "player" && target.maxHp > 0)
      ? `  (${target.hp}/${target.maxHp} HP)` : "";
    attackTargetName.textContent     = target.name + hpText;
    attackTargetName.style.fontStyle = "normal";
    attackTargetName.style.color     = "#e57373";
    attackDmgGroup.style.display = "flex";
    attackDmgInput.value = "";
    setTimeout(() => attackDmgInput.focus(), 50);
  }
}

function cancelAttack() {
  attackMode  = false;
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
      const wasDead = target.hp <= 0;
      target.hp = Math.max(0, target.hp - amt);
      addLog(`⚔  ${attacker ? attacker.name : "?"} dealt ${amt} damage to ${target.name} → ${target.hp}/${target.maxHp}`, "damage");
      if (target.hp === 0 && !wasDead) {
        addLog(`☠  ${target.name} has fallen!`, "death");
        if (target.type === "enemy" && !target.lootDropped) { target.lootDropped = true; addLootDrop(target); }
      }
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

  attackMode = false;
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

// ── Enemy Templates ───────────────────────────────────────────────────────────
let enemyTemplates     = [];
let selectedTemplateId = null;
let _hasSeededPresets  = false;
// In-progress loot items for the currently open template
let etLootItems = [];  // [{ id, name, price, rarity, chance, qty }]

// ── Seed Items ────────────────────────────────────────────────────────────────
// Stable-ID items written to Firebase on first run (idempotent by ID).
const SEED_ITEMS = [
  // Weapons
  { id:"seed_dagger",            name:"Dagger",                    price:2,     rarity:"common",    tags:"weapon,piercing,finesse" },
  { id:"seed_shortsword",        name:"Shortsword",                price:10,    rarity:"common",    tags:"weapon,slashing,finesse" },
  { id:"seed_longsword",         name:"Longsword",                 price:15,    rarity:"common",    tags:"weapon,slashing" },
  { id:"seed_handaxe",           name:"Handaxe",                   price:5,     rarity:"common",    tags:"weapon,slashing,thrown" },
  { id:"seed_spear",             name:"Spear",                     price:1,     rarity:"common",    tags:"weapon,piercing,thrown" },
  { id:"seed_javelin",           name:"Javelin",                   price:1,     rarity:"common",    tags:"weapon,piercing,thrown" },
  { id:"seed_mace",              name:"Mace",                      price:5,     rarity:"common",    tags:"weapon,bludgeoning" },
  { id:"seed_greataxe",          name:"Greataxe",                  price:30,    rarity:"common",    tags:"weapon,slashing,heavy" },
  { id:"seed_greatsword",        name:"Greatsword",                price:50,    rarity:"common",    tags:"weapon,slashing,heavy" },
  { id:"seed_hand_crossbow",     name:"Hand Crossbow",             price:75,    rarity:"uncommon",  tags:"weapon,piercing,ranged" },
  { id:"seed_crude_weapon",      name:"Crude Weapon",              price:1,     rarity:"common",    tags:"weapon,slashing,crude" },
  { id:"seed_giant_club",        name:"Giant Club",                price:5,     rarity:"common",    tags:"weapon,bludgeoning,heavy,giant" },
  { id:"seed_adamantine_dagger", name:"Adamantine Dagger",         price:500,   rarity:"uncommon",  tags:"weapon,piercing,finesse,drow,magic" },
  // Armor
  { id:"seed_leather_armor",     name:"Leather Armor",             price:10,    rarity:"common",    tags:"armor,light" },
  { id:"seed_chain_shirt",       name:"Chain Shirt",               price:50,    rarity:"common",    tags:"armor,medium" },
  { id:"seed_shield",            name:"Shield",                    price:10,    rarity:"common",    tags:"armor,shield" },
  // Potions & Medicine
  { id:"seed_potion_healing",    name:"Potion of Healing",         price:50,    rarity:"common",    tags:"potion,healing,consumable" },
  { id:"seed_potion_greater",    name:"Potion of Greater Healing", price:150,   rarity:"uncommon",  tags:"potion,healing,consumable" },
  { id:"seed_antitoxin",         name:"Antitoxin",                 price:50,    rarity:"common",    tags:"potion,medicine,consumable" },
  // Poisons
  { id:"seed_basic_poison",      name:"Basic Poison",              price:100,   rarity:"uncommon",  tags:"poison,consumable,weapon" },
  { id:"seed_drow_poison",       name:"Drow Poison",               price:200,   rarity:"uncommon",  tags:"poison,consumable,drow" },
  // Magic items
  { id:"seed_ring_protection",   name:"Ring of Protection",        price:3500,  rarity:"rare",      tags:"magic,ring,protection" },
  { id:"seed_cloak_elvenkind",   name:"Cloak of Elvenkind",        price:5000,  rarity:"uncommon",  tags:"magic,cloak,stealth" },
  { id:"seed_wand_magic_missiles",name:"Wand of Magic Missiles",   price:1500,  rarity:"uncommon",  tags:"magic,wand,arcane" },
  { id:"seed_staff_power",       name:"Staff of Power",            price:95500, rarity:"very rare", tags:"magic,staff,arcane" },
  { id:"seed_amulet_health",     name:"Amulet of Health",          price:8000,  rarity:"rare",      tags:"magic,amulet,constitution" },
  { id:"seed_boots_speed",       name:"Boots of Speed",            price:4000,  rarity:"uncommon",  tags:"magic,boots,movement" },
  { id:"seed_bag_of_holding",    name:"Bag of Holding",            price:4000,  rarity:"uncommon",  tags:"magic,utility,container" },
  // Scrolls
  { id:"seed_scroll_fireball",   name:"Scroll of Fireball",        price:500,   rarity:"uncommon",  tags:"scroll,spell,fire,arcane" },
  { id:"seed_scroll_cure",       name:"Scroll of Cure Wounds",     price:50,    rarity:"common",    tags:"scroll,spell,healing" },
  // Tools / misc
  { id:"seed_thieves_tools",     name:"Thieves' Tools",            price:25,    rarity:"common",    tags:"tool,utility,stealth" },
  { id:"seed_healer_kit",        name:"Healer's Kit",              price:5,     rarity:"common",    tags:"tool,healing,medicine" },
  { id:"seed_spell_components",  name:"Spell Component Pouch",     price:25,    rarity:"common",    tags:"tool,arcane,magic" },
  { id:"seed_rope_silk",         name:"Silk Rope (50ft)",          price:10,    rarity:"common",    tags:"tool,utility" },
  // Valuables
  { id:"seed_gemstone_small",    name:"Small Gemstone",            price:25,    rarity:"common",    tags:"valuable,gem" },
  { id:"seed_gemstone_large",    name:"Large Gemstone",            price:250,   rarity:"uncommon",  tags:"valuable,gem" },
  { id:"seed_ruby",              name:"Ruby",                      price:500,   rarity:"rare",      tags:"valuable,gem,ruby" },
  { id:"seed_diamond",           name:"Diamond",                   price:5000,  rarity:"very rare", tags:"valuable,gem,diamond" },
  { id:"seed_gold_ring",         name:"Gold Ring",                 price:25,    rarity:"common",    tags:"valuable,jewelry" },
  { id:"seed_silver_necklace",   name:"Silver Necklace",           price:15,    rarity:"common",    tags:"valuable,jewelry,silver" },
  { id:"seed_art_object",        name:"Art Object",                price:100,   rarity:"uncommon",  tags:"valuable,art" },
  // Monster parts
  { id:"seed_wolf_pelt",         name:"Wolf Pelt",                 price:5,     rarity:"common",    tags:"material,beast,hide,crafting" },
  { id:"seed_bear_pelt",         name:"Bear Pelt",                 price:15,    rarity:"common",    tags:"material,beast,hide,crafting" },
  { id:"seed_spider_silk",       name:"Giant Spider Silk",         price:25,    rarity:"uncommon",  tags:"material,beast,spider,crafting" },
  { id:"seed_goblin_ear",        name:"Goblin Ear",                price:1,     rarity:"common",    tags:"material,goblinoid,trophy" },
  { id:"seed_orc_tusk",          name:"Orc Tusk",                  price:2,     rarity:"common",    tags:"material,orc,trophy" },
  { id:"seed_dragon_scale",      name:"Dragon Scale",              price:200,   rarity:"rare",      tags:"material,dragon,scale,crafting" },
  { id:"seed_wyvern_stinger",    name:"Wyvern Stinger",            price:100,   rarity:"uncommon",  tags:"material,dragon,poison,crafting" },
  { id:"seed_troll_hide",        name:"Troll Hide",                price:50,    rarity:"uncommon",  tags:"material,giant,hide,crafting" },
  { id:"seed_brittle_bones",     name:"Brittle Bones",             price:1,     rarity:"common",    tags:"material,undead,crafting" },
  { id:"seed_ghoul_claw",        name:"Ghoul Claw",                price:10,    rarity:"uncommon",  tags:"material,undead,poison,crafting" },
  { id:"seed_vampire_fang",      name:"Vampire Fang",              price:500,   rarity:"rare",      tags:"material,undead,vampire,crafting" },
  { id:"seed_demon_ichor",       name:"Demon Ichor",               price:150,   rarity:"rare",      tags:"material,fiend,demon,alchemy" },
  { id:"seed_devil_horn",        name:"Devil Horn",                price:200,   rarity:"rare",      tags:"material,fiend,devil,crafting" },
  { id:"seed_basilisk_eye",      name:"Basilisk Eye",              price:75,    rarity:"uncommon",  tags:"material,monster,crafting,alchemy" },
  { id:"seed_owlbear_feather",   name:"Owlbear Feather",           price:20,    rarity:"common",    tags:"material,beast,crafting" },
  { id:"seed_manticore_spike",   name:"Manticore Spike",           price:30,    rarity:"uncommon",  tags:"material,monster,thrown,crafting" },
  { id:"seed_medusa_eye",        name:"Medusa Eye",                price:300,   rarity:"rare",      tags:"material,monster,crafting,alchemy" },
  { id:"seed_brimstone",         name:"Brimstone",                 price:20,    rarity:"common",    tags:"material,fiend,alchemy,crafting" },
  { id:"seed_infernal_iron",     name:"Infernal Iron",             price:500,   rarity:"rare",      tags:"material,fiend,crafting,magic" },
  { id:"seed_necrotic_dust",     name:"Necrotic Dust",             price:50,    rarity:"uncommon",  tags:"material,undead,dark,alchemy" },
  { id:"seed_soul_gem",          name:"Soul Gem",                  price:750,   rarity:"rare",      tags:"material,undead,dark,magic" },
  { id:"seed_displacer_hide",    name:"Displacer Beast Hide",      price:60,    rarity:"uncommon",  tags:"material,beast,hide,crafting" },
];

// ── Seed Loot Tables ─────────────────────────────────────────────────────────
// Format per entry: { gpMin, gpMax, items: [[id, chance, qty], ...] }
// chance = % roll per item (0-100). itemsMin/Max both 0 = each item rolls independently.
const SEED_LOOT = {
  // ── Humanoids ──
  "Bandit":         { gp:[0,5],    items:[["seed_dagger",70,"1"],["seed_crude_weapon",50,"1"],["seed_leather_armor",20,"1"]] },
  "Bandit Captain": { gp:[5,25],   items:[["seed_shortsword",60,"1"],["seed_leather_armor",45,"1"],["seed_thieves_tools",30,"1"],["seed_potion_healing",20,"1"],["seed_gemstone_small",15,"1"]] },
  "Cultist":        { gp:[0,3],    items:[["seed_dagger",65,"1"],["seed_scroll_cure",20,"1"]] },
  "Cult Fanatic":   { gp:[2,15],   items:[["seed_dagger",70,"1"],["seed_scroll_fireball",15,"1"],["seed_spell_components",35,"1"],["seed_antitoxin",20,"1"]] },
  "Guard":          { gp:[0,5],    items:[["seed_spear",50,"1"],["seed_shield",30,"1"],["seed_leather_armor",40,"1"]] },
  "Knight":         { gp:[10,50],  items:[["seed_longsword",55,"1"],["seed_chain_shirt",40,"1"],["seed_shield",35,"1"],["seed_potion_healing",25,"1"]] },
  "Gladiator":      { gp:[20,100], items:[["seed_longsword",60,"1"],["seed_javelin",45,"2"],["seed_shield",40,"1"],["seed_potion_greater",25,"1"],["seed_gold_ring",15,"1"]] },
  "Veteran":        { gp:[10,50],  items:[["seed_longsword",60,"1"],["seed_chain_shirt",45,"1"],["seed_potion_healing",20,"1"]] },
  "Mage":           { gp:[5,50],   items:[["seed_spell_components",75,"1"],["seed_scroll_fireball",30,"1"],["seed_wand_magic_missiles",15,"1"],["seed_dagger",30,"1"]] },
  "Archmage":       { gp:[50,500], items:[["seed_spell_components",90,"1"],["seed_wand_magic_missiles",40,"1"],["seed_scroll_fireball",60,"1"],["seed_staff_power",5,"1"],["seed_diamond",10,"1"],["seed_amulet_health",8,"1"]] },
  "Spy":            { gp:[3,15],   items:[["seed_dagger",65,"1"],["seed_thieves_tools",50,"1"],["seed_hand_crossbow",20,"1"],["seed_basic_poison",25,"1"]] },
  "Assassin":       { gp:[20,100], items:[["seed_dagger",80,"2"],["seed_hand_crossbow",35,"1"],["seed_thieves_tools",55,"1"],["seed_basic_poison",50,"2"],["seed_cloak_elvenkind",12,"1"]] },
  "Thug":           { gp:[1,8],    items:[["seed_crude_weapon",65,"1"],["seed_handaxe",30,"1"]] },
  "Berserker":      { gp:[3,15],   items:[["seed_greataxe",55,"1"],["seed_potion_healing",15,"1"]] },
  "Scout":          { gp:[1,5],    items:[["seed_shortsword",50,"1"],["seed_rope_silk",25,"1"],["seed_healer_kit",20,"1"]] },
  // ── Goblinoids ──
  "Goblin":         { gp:[0,2],    items:[["seed_crude_weapon",55,"1"],["seed_goblin_ear",90,"1"],["seed_dagger",20,"1"]] },
  "Hobgoblin":      { gp:[1,5],    items:[["seed_longsword",45,"1"],["seed_chain_shirt",30,"1"],["seed_shield",25,"1"]] },
  "Bugbear":        { gp:[2,10],   items:[["seed_greataxe",45,"1"],["seed_wolf_pelt",35,"1"],["seed_javelin",40,"2"]] },
  "Bugbear Chief":  { gp:[5,40],   items:[["seed_greataxe",55,"1"],["seed_chain_shirt",40,"1"],["seed_bear_pelt",30,"1"],["seed_potion_healing",20,"1"]] },
  "Goblin Boss":    { gp:[2,10],   items:[["seed_shortsword",55,"1"],["seed_goblin_ear",80,"2"],["seed_shield",30,"1"]] },
  // ── Orcs / Giants ──
  "Orc":            { gp:[1,5],    items:[["seed_greataxe",45,"1"],["seed_orc_tusk",75,"1"],["seed_javelin",40,"2"]] },
  "Orc War Chief":  { gp:[10,60],  items:[["seed_greataxe",65,"1"],["seed_chain_shirt",50,"1"],["seed_orc_tusk",80,"2"],["seed_potion_healing",25,"1"]] },
  "Half-Orc":       { gp:[2,8],    items:[["seed_greataxe",45,"1"],["seed_orc_tusk",55,"1"],["seed_leather_armor",35,"1"]] },
  "Ogre":           { gp:[2,15],   items:[["seed_giant_club",55,"1"],["seed_crude_weapon",40,"1"]] },
  "Troll":          { gp:[5,30],   items:[["seed_troll_hide",65,"1"],["seed_crude_weapon",30,"1"]] },
  "Hill Giant":     { gp:[5,50],   items:[["seed_giant_club",55,"1"],["seed_gemstone_small",40,"1"],["seed_art_object",15,"1"]] },
  "Stone Giant":    { gp:[10,100], items:[["seed_gemstone_large",45,"1"],["seed_gemstone_small",60,"2"],["seed_art_object",25,"1"]] },
  "Frost Giant":    { gp:[20,200], items:[["seed_giant_club",45,"1"],["seed_gemstone_large",35,"1"],["seed_silver_necklace",40,"1"],["seed_art_object",30,"1"]] },
  "Fire Giant":     { gp:[30,300], items:[["seed_greatsword",50,"1"],["seed_ruby",25,"1"],["seed_infernal_iron",35,"1"],["seed_gemstone_large",40,"1"]] },
  // ── Undead ──
  "Skeleton":       { gp:[0,1],    items:[["seed_brittle_bones",85,"2"],["seed_crude_weapon",35,"1"],["seed_shield",15,"1"]] },
  "Zombie":         { gp:[0,0],    items:[["seed_brittle_bones",65,"1"]] },
  "Ghoul":          { gp:[0,3],    items:[["seed_ghoul_claw",65,"1"],["seed_brittle_bones",50,"1"]] },
  "Ghast":          { gp:[1,10],   items:[["seed_ghoul_claw",75,"2"],["seed_necrotic_dust",55,"1"],["seed_brittle_bones",40,"1"]] },
  "Shadow":         { gp:[0,2],    items:[["seed_necrotic_dust",65,"1"]] },
  "Wight":          { gp:[3,20],   items:[["seed_mace",45,"1"],["seed_necrotic_dust",55,"1"],["seed_soul_gem",10,"1"],["seed_chain_shirt",25,"1"]] },
  "Wraith":         { gp:[5,30],   items:[["seed_necrotic_dust",75,"1"],["seed_soul_gem",20,"1"]] },
  "Specter":        { gp:[0,5],    items:[["seed_necrotic_dust",55,"1"],["seed_soul_gem",8,"1"]] },
  "Vampire":        { gp:[100,1000],items:[["seed_vampire_fang",75,"1"],["seed_ruby",35,"1"],["seed_ring_protection",15,"1"],["seed_soul_gem",45,"1"],["seed_art_object",50,"1"],["seed_diamond",8,"1"]] },
  "Vampire Spawn":  { gp:[10,100], items:[["seed_vampire_fang",80,"1"],["seed_silver_necklace",45,"1"],["seed_necrotic_dust",50,"1"],["seed_gemstone_small",30,"1"]] },
  "Lich":           { gp:[500,5000],items:[["seed_soul_gem",90,"2"],["seed_diamond",50,"1"],["seed_staff_power",20,"1"],["seed_scroll_fireball",80,"2"],["seed_spell_components",70,"1"],["seed_ring_protection",25,"1"]] },
  // ── Beasts ──
  "Wolf":           { gp:[0,0],    items:[["seed_wolf_pelt",65,"1"]] },
  "Dire Wolf":      { gp:[0,0],    items:[["seed_wolf_pelt",80,"1"]] },
  "Brown Bear":     { gp:[0,0],    items:[["seed_bear_pelt",75,"1"]] },
  "Lion":           { gp:[0,0],    items:[["seed_bear_pelt",55,"1"]] },
  "Tiger":          { gp:[0,0],    items:[["seed_bear_pelt",60,"1"]] },
  "Giant Spider":   { gp:[0,0],    items:[["seed_spider_silk",80,"1"],["seed_gemstone_small",10,"1"]] },
  "Crocodile":      { gp:[0,0],    items:[["seed_wolf_pelt",40,"1"]] },
  "Giant Crocodile":{ gp:[0,10],   items:[["seed_bear_pelt",55,"1"],["seed_gemstone_small",20,"1"]] },
  // ── Monsters ──
  "Kobold":         { gp:[0,1],    items:[["seed_crude_weapon",45,"1"],["seed_goblin_ear",70,"1"],["seed_dagger",15,"1"]] },
  "Gnoll":          { gp:[1,5],    items:[["seed_crude_weapon",50,"1"],["seed_javelin",35,"2"],["seed_wolf_pelt",30,"1"]] },
  "Lizardfolk":     { gp:[1,5],    items:[["seed_spear",45,"1"],["seed_javelin",35,"2"],["seed_shield",25,"1"]] },
  "Harpy":          { gp:[2,8],    items:[["seed_gold_ring",25,"1"],["seed_silver_necklace",20,"1"],["seed_gemstone_small",15,"1"]] },
  "Minotaur":       { gp:[5,30],   items:[["seed_greataxe",45,"1"],["seed_bear_pelt",35,"1"],["seed_gemstone_small",20,"1"]] },
  "Basilisk":       { gp:[5,30],   items:[["seed_basilisk_eye",65,"1"],["seed_bear_pelt",25,"1"]] },
  "Manticore":      { gp:[5,30],   items:[["seed_manticore_spike",80,"3"],["seed_bear_pelt",30,"1"]] },
  "Werewolf":       { gp:[3,20],   items:[["seed_wolf_pelt",75,"1"],["seed_silver_necklace",25,"1"],["seed_crude_weapon",40,"1"]] },
  "Medusa":         { gp:[10,80],  items:[["seed_medusa_eye",65,"1"],["seed_gold_ring",45,"1"],["seed_ruby",18,"1"],["seed_silver_necklace",35,"1"]] },
  "Wyvern":         { gp:[10,100], items:[["seed_wyvern_stinger",75,"1"],["seed_dragon_scale",45,"2"],["seed_gemstone_small",30,"1"]] },
  "Doppelganger":   { gp:[5,30],   items:[["seed_thieves_tools",45,"1"],["seed_dagger",55,"2"],["seed_cloak_elvenkind",12,"1"]] },
  "Gargoyle":       { gp:[2,15],   items:[["seed_gemstone_large",20,"1"],["seed_gemstone_small",35,"1"]] },
  "Rust Monster":   { gp:[0,0],    items:[["seed_orc_tusk",45,"1"]] },
  "Gelatinous Cube":{ gp:[2,20],   items:[["seed_gemstone_small",35,"1"],["seed_dagger",20,"1"],["seed_gold_ring",15,"1"],["seed_thieves_tools",10,"1"],["seed_potion_healing",10,"1"]] },
  "Owlbear":        { gp:[0,0],    items:[["seed_owlbear_feather",75,"2"],["seed_bear_pelt",45,"1"]] },
  "Displacer Beast":{ gp:[0,0],    items:[["seed_displacer_hide",65,"1"],["seed_gemstone_small",15,"1"]] },
  "Beholder":       { gp:[50,500], items:[["seed_soul_gem",45,"1"],["seed_diamond",22,"1"],["seed_gemstone_large",65,"2"],["seed_ring_protection",20,"1"],["seed_art_object",55,"1"]] },
  "Mind Flayer":    { gp:[10,100], items:[["seed_soul_gem",55,"1"],["seed_spell_components",45,"1"],["seed_amulet_health",15,"1"],["seed_gemstone_small",40,"1"]] },
  // ── Drow ──
  "Drow":           { gp:[0,3],    items:[["seed_drow_poison",45,"1"],["seed_adamantine_dagger",20,"1"],["seed_hand_crossbow",25,"1"]] },
  "Drow Elite Warrior":{ gp:[5,50],items:[["seed_adamantine_dagger",65,"1"],["seed_drow_poison",65,"2"],["seed_chain_shirt",35,"1"],["seed_hand_crossbow",40,"1"]] },
  "Drow Mage":      { gp:[5,60],   items:[["seed_drow_poison",55,"1"],["seed_spell_components",65,"1"],["seed_scroll_fireball",30,"1"],["seed_adamantine_dagger",35,"1"],["seed_wand_magic_missiles",15,"1"]] },
  // ── Fiends ──
  "Imp":            { gp:[2,10],   items:[["seed_brimstone",65,"1"],["seed_basic_poison",20,"1"]] },
  "Quasit":         { gp:[2,8],    items:[["seed_brimstone",55,"1"],["seed_basic_poison",20,"1"]] },
  "Dretch":         { gp:[0,2],    items:[["seed_brimstone",45,"1"]] },
  "Hell Hound":     { gp:[3,20],   items:[["seed_brimstone",65,"1"],["seed_wolf_pelt",30,"1"],["seed_infernal_iron",15,"1"]] },
  "Bearded Devil":  { gp:[5,30],   items:[["seed_brimstone",65,"1"],["seed_infernal_iron",35,"1"],["seed_devil_horn",40,"1"]] },
  "Barbed Devil":   { gp:[10,80],  items:[["seed_infernal_iron",55,"1"],["seed_brimstone",70,"1"],["seed_devil_horn",55,"1"],["seed_ruby",15,"1"]] },
  "Vrock":          { gp:[10,80],  items:[["seed_demon_ichor",65,"1"],["seed_infernal_iron",35,"1"],["seed_brimstone",50,"1"]] },
  "Hezrou":         { gp:[20,150], items:[["seed_demon_ichor",80,"2"],["seed_infernal_iron",45,"1"],["seed_ruby",20,"1"],["seed_soul_gem",20,"1"]] },
  "Balor":          { gp:[200,2000],items:[["seed_demon_ichor",90,"2"],["seed_infernal_iron",75,"1"],["seed_ruby",45,"1"],["seed_diamond",15,"1"],["seed_soul_gem",50,"1"],["seed_greatsword",40,"1"]] },
  // ── Dragons ──
  "Dragon Wyrmling (Black)":  { gp:[5,50],    items:[["seed_dragon_scale",45,"2"]] },
  "Dragon Wyrmling (Blue)":   { gp:[5,50],    items:[["seed_dragon_scale",45,"2"]] },
  "Dragon Wyrmling (Green)":  { gp:[5,50],    items:[["seed_dragon_scale",45,"2"]] },
  "Dragon Wyrmling (Red)":    { gp:[10,100],  items:[["seed_dragon_scale",55,"2"],["seed_ruby",12,"1"]] },
  "Dragon Wyrmling (White)":  { gp:[5,50],    items:[["seed_dragon_scale",45,"2"]] },
  "Young Black Dragon":       { gp:[50,500],  items:[["seed_dragon_scale",65,"3"],["seed_gemstone_large",35,"1"],["seed_art_object",30,"1"]] },
  "Young Blue Dragon":        { gp:[100,800], items:[["seed_dragon_scale",65,"3"],["seed_gemstone_large",45,"1"],["seed_art_object",40,"1"],["seed_gemstone_small",50,"2"]] },
  "Young Green Dragon":       { gp:[80,600],  items:[["seed_dragon_scale",65,"3"],["seed_gemstone_large",35,"1"],["seed_art_object",35,"1"]] },
  "Young Red Dragon":         { gp:[100,1000],items:[["seed_dragon_scale",70,"3"],["seed_ruby",45,"1"],["seed_gemstone_large",40,"1"],["seed_art_object",50,"1"]] },
  "Young White Dragon":       { gp:[50,400],  items:[["seed_dragon_scale",60,"3"],["seed_gemstone_large",30,"1"],["seed_silver_necklace",35,"1"]] },
  "Adult Black Dragon":       { gp:[200,2000],items:[["seed_dragon_scale",80,"4"],["seed_gemstone_large",55,"2"],["seed_diamond",12,"1"],["seed_art_object",50,"1"],["seed_ring_protection",10,"1"]] },
  "Adult Blue Dragon":        { gp:[300,3000],items:[["seed_dragon_scale",80,"4"],["seed_gemstone_large",60,"2"],["seed_diamond",15,"1"],["seed_art_object",55,"1"],["seed_boots_speed",10,"1"]] },
  "Adult Green Dragon":       { gp:[250,2500],items:[["seed_dragon_scale",80,"4"],["seed_gemstone_large",55,"2"],["seed_diamond",12,"1"],["seed_cloak_elvenkind",15,"1"]] },
  "Adult Red Dragon":         { gp:[500,5000],items:[["seed_dragon_scale",90,"4"],["seed_ruby",65,"2"],["seed_diamond",28,"1"],["seed_ring_protection",18,"1"],["seed_staff_power",8,"1"],["seed_art_object",60,"2"]] },
  "Adult White Dragon":       { gp:[200,2000],items:[["seed_dragon_scale",80,"4"],["seed_gemstone_large",45,"2"],["seed_silver_necklace",40,"1"],["seed_amulet_health",12,"1"]] },
};

// Build snapshot lootItems array from SEED_LOOT entry
function _buildSeedLootItems(entries) {
  const itemMap = {};
  SEED_ITEMS.forEach(i => { itemMap[i.id] = i; });
  return entries.map(([id, chance, qty]) => {
    const item = itemMap[id];
    if (!item) return null;
    return { id: item.id, name: item.name, price: item.price, rarity: item.rarity, chance, qty: String(qty) };
  }).filter(Boolean);
}

// Seed missing items + update all builtin templates with loot tables
function _seedLootTables() {
  // 1. Seed missing items (idempotent: only write items not yet in Firebase)
  if (window._saveItem) {
    const existingIds = new Set((window._combatItems || []).map(i => i.id));
    SEED_ITEMS.forEach(item => {
      if (!existingIds.has(item.id)) window._saveItem(item);
    });
  }
  // 2. Update all builtin templates with loot data
  if (window._saveEnemyTemplate) {
    MONSTER_PRESETS.forEach(p => {
      const id = "preset_" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const sl = SEED_LOOT[p.name];
      const lootItems = sl ? _buildSeedLootItems(sl.items || []) : [];
      const gpMin = sl ? sl.gp[0] : 0;
      const gpMax = sl ? sl.gp[1] : 0;
      window._saveEnemyTemplate({
        id,
        name:    p.name,
        hp:      p.hp,
        ac:      p.ac,
        initMod: p.initMod,
        cr:      p.cr,
        notes:   null,
        builtin: true,
        loot:    { gpMin, gpMax, itemsMin: 0, itemsMax: 0 },
        lootItems,
      });
    });
  }
}

// Readiness check — called when either templates or system flags finish loading
function _checkAndSeedLoot() {
  const LOOT_VERSION = 1;
  if (!window._enemyTemplatesLoaded)   return; // templates not ready
  if (window._systemFlags === undefined) return; // system flags not ready
  if ((window._systemFlags.lootVersion || 0) < LOOT_VERSION) {
    _seedLootTables();
    window._setSystemFlag?.("lootVersion", LOOT_VERSION);
  }
}

window._onSystemFlagsLoaded = _checkAndSeedLoot;

// Called every time Firebase pushes an update
window._onEnemyTemplatesUpdate = () => {
  enemyTemplates = (window._enemyTemplates || [])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // First load: if the DB is empty, seed it with every MONSTER_PRESET
  if (!_hasSeededPresets && window._enemyTemplatesLoaded && enemyTemplates.length === 0) {
    _hasSeededPresets = true;
    _seedPresetsToFirebase();
    return; // onValue will fire again once writes land
  }

  _checkAndSeedLoot(); // also check if loot version needs updating
  renderTemplateList();
  // If the currently selected template was just updated from Firebase, refresh the loot rows
  if (selectedTemplateId) {
    const updated = enemyTemplates.find(t => t.id === selectedTemplateId);
    if (updated) etLootItems = updated.lootItems ? updated.lootItems.map(x => ({ ...x })) : [];
  }
};

function _seedPresetsToFirebase() {
  MONSTER_PRESETS.forEach(p => {
    const id = "preset_" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    window._saveEnemyTemplate({
      id,
      name:     p.name,
      hp:       p.hp,
      ac:       p.ac,
      initMod:  p.initMod,
      cr:       p.cr,
      notes:    null,
      builtin:  true,
      loot:     { gpMin: 0, gpMax: 0, itemsMin: 0, itemsMax: 0 },
      lootItems: [],
    });
  });
}

function saveTemplate(payload) {
  if (window._saveEnemyTemplate) {
    window._saveEnemyTemplate(payload);
  }
}

function deleteTemplate(id) {
  if (window._deleteEnemyTemplate) {
    window._deleteEnemyTemplate(id);
  }
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const enemyTemplatesModal  = document.getElementById("enemy-templates-modal");
const btnEnemyList         = document.getElementById("btn-enemy-list");
const enemyModalClose      = document.getElementById("enemy-modal-close");
const enemySearchInput     = document.getElementById("enemy-search");
const enemyTemplateListEl  = document.getElementById("enemy-template-list");
const btnNewEnemy          = document.getElementById("btn-new-enemy");
const enemyEditorEmpty     = document.getElementById("enemy-editor-empty");
const enemyEditorForm      = document.getElementById("enemy-editor-form");

const etName      = document.getElementById("et-name");
const etHp        = document.getElementById("et-hp");
const etAc        = document.getElementById("et-ac");
const etInitMod   = document.getElementById("et-init-mod");
const etCr        = document.getElementById("et-cr");
const etSpeed     = document.getElementById("et-speed");
const etNotes     = document.getElementById("et-notes");
const etStr       = document.getElementById("et-str");
const etDex       = document.getElementById("et-dex");
const etCon       = document.getElementById("et-con");
const etInt       = document.getElementById("et-int");
const etWis       = document.getElementById("et-wis");
const etCha       = document.getElementById("et-cha");
const etSaves     = document.getElementById("et-saves");
const etCondImm   = document.getElementById("et-cond-imm");
const etLanguages = document.getElementById("et-languages");
const etAttacksList = document.getElementById("et-attacks-list");
const etAddAttackBtn = document.getElementById("et-add-attack-btn");

// ── Stat modifier display ─────────────────────────────────────────────────────
const STAT_FIELDS = [
  { inp: etStr, mod: document.getElementById("et-str-mod") },
  { inp: etDex, mod: document.getElementById("et-dex-mod") },
  { inp: etCon, mod: document.getElementById("et-con-mod") },
  { inp: etInt, mod: document.getElementById("et-int-mod") },
  { inp: etWis, mod: document.getElementById("et-wis-mod") },
  { inp: etCha, mod: document.getElementById("et-cha-mod") },
];
STAT_FIELDS.forEach(({ inp, mod }) => {
  inp.addEventListener("input", () => {
    const v = parseInt(inp.value, 10);
    if (isNaN(v)) { mod.textContent = "—"; return; }
    const m = Math.floor((v - 10) / 2);
    mod.textContent = (m >= 0 ? "+" : "") + m;
    mod.className = "et-stat-mod" + (m >= 0 ? " positive" : " negative");
  });
});

// ── Attacks list ──────────────────────────────────────────────────────────────
let etAttacks = [];   // [{name, hit, damage}]

etAddAttackBtn.addEventListener("click", () => {
  etAttacks.push({ name: "", hit: "", damage: "" });
  renderAttackRows();
});

function renderAttackRows() {
  etAttacksList.innerHTML = "";
  if (etAttacks.length === 0) {
    etAttacksList.innerHTML = `<p class="et-attacks-empty">No attacks defined.</p>`;
    return;
  }
  etAttacks.forEach((atk, i) => {
    const row = document.createElement("div");
    row.className = "et-attack-row";
    row.innerHTML = `
      <div class="et-atk-top-row">
        <input class="et-atk-name"   type="text" placeholder="Attack name…" value="${escHtml(atk.name)}" />
        <input class="et-atk-hit"    type="text" placeholder="+5"           value="${escHtml(atk.hit)}"  />
        <button type="button" class="et-atk-del-btn" title="Remove">&#10005;</button>
      </div>
      <textarea class="et-atk-damage" placeholder="1d8+3 piercing&#10;On hit: …" rows="2">${escHtml(atk.damage)}</textarea>`;
    row.querySelector(".et-atk-name").addEventListener("input",   e => { etAttacks[i].name   = e.target.value; });
    row.querySelector(".et-atk-hit").addEventListener("input",    e => { etAttacks[i].hit    = e.target.value; });
    row.querySelector(".et-atk-damage").addEventListener("input", e => { etAttacks[i].damage = e.target.value; });
    row.querySelector(".et-atk-del-btn").addEventListener("click", () => { etAttacks.splice(i, 1); renderAttackRows(); });
    etAttacksList.appendChild(row);
  });
}
const etGpMin     = document.getElementById("et-gp-min");
const etGpMax     = document.getElementById("et-gp-max");
const etItemsMin  = document.getElementById("et-items-min");
const etItemsMax  = document.getElementById("et-items-max");
const etItemSearch   = document.getElementById("et-item-search");
const etItemResults  = document.getElementById("et-item-results");
const etLootItemsEl  = document.getElementById("et-loot-items");
const etLootEmpty    = document.getElementById("et-loot-empty");
const etSaveBtn      = document.getElementById("et-save-btn");
const etDeleteBtn    = document.getElementById("et-delete-btn");
const etSpawnBtn     = document.getElementById("et-spawn-btn");
const etSpawnCount   = document.getElementById("et-spawn-count");
const etError        = document.getElementById("et-error");

// ── Open / close ──────────────────────────────────────────────────────────────
btnEnemyList.addEventListener("click", () => {
  enemyTemplatesModal.classList.add("open");
  renderTemplateList();
});

function closeEnemyModal() {
  enemyTemplatesModal.classList.remove("open");
  selectedTemplateId = null;
}

enemyModalClose.addEventListener("click", closeEnemyModal);
enemyTemplatesModal.addEventListener("click", e => {
  if (e.target === enemyTemplatesModal) closeEnemyModal();
});

// ── Template list ─────────────────────────────────────────────────────────────
enemySearchInput.addEventListener("input", renderTemplateList);

function renderTemplateList() {
  const q = enemySearchInput.value.trim().toLowerCase();
  const filtered = q
    ? enemyTemplates.filter(t => t.name.toLowerCase().includes(q))
    : enemyTemplates;

  enemyTemplateListEl.innerHTML = "";

  if (!window._enemyTemplatesLoaded) {
    enemyTemplateListEl.innerHTML = `<p class="enemy-list-empty">Loading…</p>`;
    return;
  }

  if (filtered.length === 0) {
    enemyTemplateListEl.innerHTML = `<p class="enemy-list-empty">${q ? "No matches." : "No templates yet. Click + New."}</p>`;
    return;
  }

  filtered.forEach(tmpl => {
    const item = document.createElement("div");
    item.className = "enemy-template-item" + (tmpl.id === selectedTemplateId ? " selected" : "");
    const builtinBadge = tmpl.builtin
      ? `<span style="font-size:9px;color:#666;letter-spacing:0.06em;text-transform:uppercase;margin-left:4px">preset</span>`
      : `<span style="font-size:9px;color:#5a8a5a;letter-spacing:0.06em;text-transform:uppercase;margin-left:4px">custom</span>`;
    item.innerHTML = `
      <div class="enemy-template-name">${escHtml(tmpl.name)}${builtinBadge}</div>
      <div class="enemy-template-meta">HP ${tmpl.hp ?? "?"} · AC ${tmpl.ac ?? "?"} · CR ${tmpl.cr || "—"}</div>`;
    item.addEventListener("click", () => openTemplateEditor(tmpl.id));
    enemyTemplateListEl.appendChild(item);
  });
}

// ── Editor ────────────────────────────────────────────────────────────────────
btnNewEnemy.addEventListener("click", () => {
  selectedTemplateId = null;
  etLootItems = [];
  clearEditorFields();
  showEditorForm();
  etName.focus();
  renderTemplateList();
});

function openTemplateEditor(id) {
  const tmpl = enemyTemplates.find(t => t.id === id);
  if (!tmpl) return;
  selectedTemplateId = id;
  etLootItems = tmpl.lootItems ? tmpl.lootItems.map(x => ({ ...x })) : [];

  etName.value     = tmpl.name    || "";
  etHp.value       = tmpl.hp      ?? "";
  etAc.value       = tmpl.ac      ?? "";
  etInitMod.value  = tmpl.initMod ?? "";
  etCr.value       = tmpl.cr      || "";
  etSpeed.value    = tmpl.speed   || "";
  etNotes.value    = tmpl.notes   || "";
  // Stats
  const st = tmpl.stats || {};
  etStr.value = st.str ?? ""; etDex.value = st.dex ?? ""; etCon.value = st.con ?? "";
  etInt.value = st.int ?? ""; etWis.value = st.wis ?? ""; etCha.value = st.cha ?? "";
  STAT_FIELDS.forEach(({ inp, mod }) => inp.dispatchEvent(new Event("input")));
  // Attacks
  etAttacks = tmpl.attacks ? tmpl.attacks.map(a => ({ ...a })) : [];
  renderAttackRows();
  // Extra info
  etSaves.value     = tmpl.saves     || "";
  etCondImm.value   = tmpl.condImm   || "";
  etLanguages.value = tmpl.languages || "";
  etGpMin.value    = tmpl.loot?.gpMin    ?? 0;
  etGpMax.value    = tmpl.loot?.gpMax    ?? 0;
  etItemsMin.value = tmpl.loot?.itemsMin ?? 0;
  etItemsMax.value = tmpl.loot?.itemsMax ?? 0;
  etError.textContent = "";

  renderLootItemRows();
  showEditorForm();
  renderTemplateList();
}

function clearEditorFields() {
  etName.value = etHp.value = etAc.value = etInitMod.value = etCr.value = etSpeed.value = etNotes.value = "";
  etStr.value = etDex.value = etCon.value = etInt.value = etWis.value = etCha.value = "";
  STAT_FIELDS.forEach(({ mod }) => { mod.textContent = "—"; mod.className = "et-stat-mod"; });
  etAttacks = []; renderAttackRows();
  etSaves.value = etCondImm.value = etLanguages.value = "";
  etGpMin.value = etGpMax.value = etItemsMin.value = etItemsMax.value = "0";
  etError.textContent = "";
  renderLootItemRows();
}

function showEditorForm() {
  enemyEditorEmpty.style.display = "none";
  enemyEditorForm.style.display  = "flex";
  etDeleteBtn.style.display = selectedTemplateId ? "" : "none";
}

// ── Loot item rows ────────────────────────────────────────────────────────────
function renderLootItemRows() {
  etLootItemsEl.innerHTML = "";
  if (etLootItems.length === 0) {
    etLootItemsEl.appendChild(etLootEmpty);
    etLootEmpty.style.display = "";
    return;
  }
  etLootEmpty.style.display = "none";

  const RARITY_COLS = {
    "common": "#9e9e9e", "uncommon": "#4caf50", "rare": "#2196f3",
    "very rare": "#9c27b0", "legendary": "#ff9800"
  };

  etLootItems.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "et-loot-row";
    const rc = RARITY_COLS[item.rarity || "common"] || "#9e9e9e";
    row.innerHTML = `
      <span class="et-loot-item-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
      <span class="et-loot-item-rarity" style="color:${rc};border-color:${rc}33">${item.rarity || "common"}</span>
      <div class="et-loot-chance-group">
        <input class="et-loot-chance-input" type="number" value="${item.chance ?? 100}" min="1" max="100" title="Drop chance %" />
        <span>%</span>
        <span style="margin-left:4px;color:#666">×</span>
        <input class="et-loot-qty-input" type="number" value="${item.qty ?? 1}" min="1" max="99" title="Quantity" />
      </div>
      <button class="et-loot-remove-btn" title="Remove">&times;</button>`;

    row.querySelector(".et-loot-chance-input").addEventListener("change", e => {
      etLootItems[idx].chance = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 100));
    });
    row.querySelector(".et-loot-qty-input").addEventListener("change", e => {
      etLootItems[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
    });
    row.querySelector(".et-loot-remove-btn").addEventListener("click", () => {
      etLootItems.splice(idx, 1);
      renderLootItemRows();
    });

    etLootItemsEl.appendChild(row);
  });
}

// ── Item picker (search & add) ────────────────────────────────────────────────
etItemSearch.addEventListener("input", () => {
  const q = etItemSearch.value.trim().toLowerCase();
  if (!q) { etItemResults.style.display = "none"; return; }

  const items = window._combatItems || [];
  const matches = items.filter(item => item.name.toLowerCase().includes(q)).slice(0, 15);

  if (!matches.length) { etItemResults.style.display = "none"; return; }

  const RARITY_COLS = {
    "common": "#9e9e9e", "uncommon": "#4caf50", "rare": "#2196f3",
    "very rare": "#9c27b0", "legendary": "#ff9800"
  };

  etItemResults.innerHTML = "";
  matches.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-picker-row";
    const rc = RARITY_COLS[item.rarity || "common"] || "#9e9e9e";
    row.innerHTML = `
      <span class="item-picker-name">${escHtml(item.name)}</span>
      <span class="item-picker-rarity" style="color:${rc};border-color:${rc}33">${item.rarity || "common"}</span>`;
    row.addEventListener("click", () => {
      // Prevent duplicates
      if (!etLootItems.find(x => x.id === item.id)) {
        etLootItems.push({
          id:     item.id,
          name:   item.name,
          price:  item.price ?? null,
          rarity: item.rarity || "common",
          chance: 100,
          qty:    1,
        });
        renderLootItemRows();
      }
      etItemSearch.value = "";
      etItemResults.style.display = "none";
    });
    etItemResults.appendChild(row);
  });
  etItemResults.style.display = "block";
});

etItemSearch.addEventListener("blur", () => {
  setTimeout(() => { etItemResults.style.display = "none"; }, 180);
});

// ── Save template ─────────────────────────────────────────────────────────────
etSaveBtn.addEventListener("click", () => {
  const name = etName.value.trim();
  if (!name) { etError.textContent = "Name is required."; return; }
  etError.textContent = "";

  const statsPayload = (() => {
    const pairs = [["str",etStr],["dex",etDex],["con",etCon],["int",etInt],["wis",etWis],["cha",etCha]];
    const obj = {};
    pairs.forEach(([k, el]) => { const v = parseInt(el.value, 10); if (!isNaN(v)) obj[k] = v; });
    return Object.keys(obj).length ? obj : null;
  })();

  const payload = {
    id:        selectedTemplateId || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    name,
    hp:        parseInt(etHp.value, 10)      || 10,
    ac:        parseInt(etAc.value, 10)      || 10,
    initMod:   parseInt(etInitMod.value, 10) || 0,
    cr:        etCr.value.trim()             || "—",
    speed:     etSpeed.value.trim()          || null,
    notes:     etNotes.value.trim()          || null,
    stats:     statsPayload,
    attacks:   etAttacks.filter(a => a.name.trim()).map(a => ({ ...a })),
    saves:     etSaves.value.trim()          || null,
    condImm:   etCondImm.value.trim()        || null,
    languages: etLanguages.value.trim()      || null,
    loot: {
      gpMin:    parseInt(etGpMin.value,    10) || 0,
      gpMax:    parseInt(etGpMax.value,    10) || 0,
      itemsMin: parseInt(etItemsMin.value, 10) || 0,
      itemsMax: parseInt(etItemsMax.value, 10) || 0,
    },
    lootItems: etLootItems.map(x => ({ ...x })),
  };

  if (!selectedTemplateId) selectedTemplateId = payload.id;

  saveTemplate(payload);
  etDeleteBtn.style.display = "";
  etError.textContent = "✓ Saved.";
  setTimeout(() => { if (etError.textContent === "✓ Saved.") etError.textContent = ""; }, 1500);
});

// ── Delete template ───────────────────────────────────────────────────────────
etDeleteBtn.addEventListener("click", () => {
  if (!selectedTemplateId) return;
  const tmpl = enemyTemplates.find(t => t.id === selectedTemplateId);
  if (!confirm(`Delete template "${tmpl?.name}"?`)) return;
  deleteTemplate(selectedTemplateId);
  selectedTemplateId = null;
  etLootItems = [];
  enemyEditorEmpty.style.display = "";
  enemyEditorForm.style.display  = "none";
  renderTemplateList();
});

// ── Add to Combat ─────────────────────────────────────────────────────────────
etSpawnBtn.addEventListener("click", () => {
  if (!selectedTemplateId) return;
  const tmpl = enemyTemplates.find(t => t.id === selectedTemplateId);
  if (!tmpl) return;

  const count = Math.max(1, Math.min(20, parseInt(etSpawnCount.value, 10) || 1));

  for (let i = 0; i < count; i++) {
    const suffix  = count > 1 ? " " + (i + 1) : "";
    const initRoll = roll(20) + (tmpl.initMod || 0);
    // Build loot config from the template's lootItems for the generate function
    const lootCfg = {
      gpMin:      tmpl.loot?.gpMin    ?? 0,
      gpMax:      tmpl.loot?.gpMax    ?? 0,
      itemsMin:   tmpl.loot?.itemsMin ?? 0,
      itemsMax:   tmpl.loot?.itemsMax ?? 0,
      lootItems:  tmpl.lootItems || [],
    };
    state.combatants.push({
      id:          genId(),
      name:        tmpl.name + suffix,
      type:        "enemy",
      initiative:  initRoll,
      hp:          tmpl.hp  || 10,
      maxHp:       tmpl.hp  || 10,
      ac:          tmpl.ac  || 10,
      conditions:  [],
      notes:       tmpl.notes     || null,
      speed:       tmpl.speed     || null,
      stats:       tmpl.stats     || null,
      attacks:     tmpl.attacks?.length ? tmpl.attacks : null,
      saves:       tmpl.saves     || null,
      condImm:     tmpl.condImm   || null,
      languages:   tmpl.languages || null,
      loot:        lootCfg,
      lootDropped: false,
    });
  }

  addLog(`+  ${tmpl.name}${count > 1 ? " ×" + count : ""} added from template.`, "info");
  render();
  closeEnemyModal();
});

// Escape closes enemy modal too
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && enemyTemplatesModal.classList.contains("open")) {
    closeEnemyModal();
  }
});

// ── Loot System ──────────────────────────────────────────────────────────────
const lootPanel    = document.getElementById("loot-panel");
const btnClearLoot = document.getElementById("btn-clear-loot");

let lootLog = state.lootLog; // persisted — backed by state

const RARITY_COLORS = {
  "common":    "#9e9e9e",
  "uncommon":  "#4caf50",
  "rare":      "#2196f3",
  "very rare": "#9c27b0",
  "legendary": "#ff9800"
};

// Higher weight = more likely to drop
const RARITY_DROP_WEIGHT = {
  "common": 60, "uncommon": 25, "rare": 10, "very rare": 4, "legendary": 1
};

function parseItemTags(tagStr) {
  return (tagStr || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
}

function weightedItemPick(pool) {
  if (!pool.length) return null;
  const total = pool.reduce((s, item) => s + (RARITY_DROP_WEIGHT[item.rarity || "common"] || 60), 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= RARITY_DROP_WEIGHT[item.rarity || "common"] || 60;
    if (r <= 0) return item;
  }
  return pool[pool.length - 1];
}

function generateLootFor(combatant) {
  const cfg = combatant.loot;
  const gpMin    = cfg?.gpMin    ?? 0;
  const gpMax    = cfg?.gpMax    ?? 0;
  const iMin     = cfg?.itemsMin ?? 0;
  const iMax     = cfg?.itemsMax ?? 0;

  // Coins — gold from config, silver & copper as pocket change
  const gp = gpMin + Math.floor(Math.random() * Math.max(1, gpMax - gpMin + 1));
  const sp = gpMax > 0 ? Math.floor(Math.random() * 10) : 0;
  const cp = Math.floor(Math.random() * 10);
  const coins = { gp, sp, cp };

  const dropped = [];

  // Template-based loot: each item has individual drop chance
  const templateItems = cfg?.lootItems || [];
  if (templateItems.length > 0) {
    // Determine how many items to drop (respects min/max if set)
    const maxToDrop = iMax > 0
      ? (iMin + Math.floor(Math.random() * Math.max(1, iMax - iMin + 1)))
      : templateItems.length; // no cap — each item rolls its own chance

    let dropped_count = 0;
    // Shuffle for variety
    const shuffled = [...templateItems].sort(() => Math.random() - 0.5);
    for (const item of shuffled) {
      if (iMax > 0 && dropped_count >= maxToDrop) break;
      const chance = item.chance ?? 100;
      if (Math.random() * 100 < chance) {
        for (let q = 0; q < (item.qty || 1); q++) {
          dropped.push({ name: item.name, rarity: item.rarity || "common", price: item.price ?? null });
        }
        dropped_count++;
      }
    }
  } else if ((cfg?.tags || []).length > 0) {
    // Fallback: tag-based (for combatants added via + Add, not templates)
    const allItems = window._combatItems || [];
    const pool = allItems.filter(item => {
      const itemTags = parseItemTags(item.tags);
      return (cfg.tags || []).some(t => itemTags.includes(t));
    });
    const count = iMin + Math.floor(Math.random() * Math.max(1, iMax - iMin + 1));
    const remaining = [...pool];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const picked = weightedItemPick(remaining);
      if (picked) {
        dropped.push({ name: picked.name, rarity: picked.rarity || "common", price: picked.price ?? null });
        remaining.splice(remaining.indexOf(picked), 1);
      }
    }
  }

  return { coins, items: dropped };
}

function formatCoins(coins) {
  const parts = [];
  if (coins.gp > 0) parts.push(`${coins.gp}gp`);
  if (coins.sp > 0) parts.push(`${coins.sp}sp`);
  if (coins.cp > 0) parts.push(`${coins.cp}cp`);
  return parts.join("  ") || null;
}

function addLootDrop(combatant) {
  const result = generateLootFor(combatant);
  const coinStr = formatCoins(result.coins);
  const hasAnything = !!(coinStr || result.items.length > 0);
  lootLog.push({ enemyName: combatant.name, coins: result.coins, items: result.items, hasAnything });
  save();
  renderLootPanel();
}

function renderLootPanel() {
  lootPanel.innerHTML = "";
  if (lootLog.length === 0) {
    lootPanel.innerHTML = '<p class="loot-panel-empty">Loot drops when enemies fall.</p>';
    return;
  }
  // Show most recent drop first
  [...lootLog].reverse().forEach(entry => {
    const drop = document.createElement("div");
    drop.className = "loot-drop";

    const header = document.createElement("div");
    header.className = "loot-drop-header";
    header.innerHTML = `<span class="loot-skull">&#9760;</span> ${escHtml(entry.enemyName)}`;
    drop.appendChild(header);

    if (!entry.hasAnything) {
      const none = document.createElement("div");
      none.className = "loot-nothing";
      none.textContent = "Nothing of value.";
      drop.appendChild(none);
    } else {
      const coinStr = formatCoins(entry.coins);
      if (coinStr) {
        const coinRow = document.createElement("div");
        coinRow.className = "loot-coin-row";
        coinRow.innerHTML = `&#128176; ${coinStr}`;
        drop.appendChild(coinRow);
      }
      entry.items.forEach(item => {
        const row = document.createElement("div");
        row.className = "loot-item-row";
        const rarityColor = RARITY_COLORS[item.rarity] || "#9e9e9e";
        const priceStr = item.price != null ? `${item.price}gp` : "";
        row.innerHTML = `
          <span class="loot-item-name">${escHtml(item.name)}</span>
          <span class="loot-item-meta">
            ${priceStr ? `<span class="loot-item-price">${priceStr}</span>` : ""}
            <span class="loot-rarity-badge" style="color:${rarityColor};border-color:${rarityColor}20">${item.rarity}</span>
            <button class="loot-give-btn" title="Give to player">+</button>
          </span>
          <div class="loot-give-dropdown" style="display:none"></div>`;
        // Give button
        const giveBtn = row.querySelector(".loot-give-btn");
        const dropdown = row.querySelector(".loot-give-dropdown");
        giveBtn.addEventListener("click", e => {
          e.stopPropagation();
          const isOpen = dropdown.style.display !== "none";
          // Close all other dropdowns
          document.querySelectorAll(".loot-give-dropdown").forEach(d => d.style.display = "none");
          if (isOpen) return;
          const users = Object.values(window._allUsers || {})
            .sort((a, b) => (a.username || "").localeCompare(b.username || ""));
          if (!users.length) {
            dropdown.innerHTML = `<span class="loot-give-empty">No players found</span>`;
          } else {
            dropdown.innerHTML = users.map(u =>
              `<button class="loot-give-player" data-id="${escHtml(u.id)}" style="--pc:${u.color || '#888'}">
                <span class="loot-give-dot"></span>
                <span>${escHtml(u.username)}</span>
              </button>`).join("");
            dropdown.querySelectorAll(".loot-give-player").forEach(btn => {
              btn.addEventListener("click", async ev => {
                ev.stopPropagation();
                btn.disabled = true;
                try {
                  await window._giveItemToPlayer(btn.dataset.id, {
                    name:        item.name,
                    type:        item.type || "misc",
                    description: item.description || null,
                    quantity:    1,
                    value:       item.price != null ? item.price : null,
                  });
                  dropdown.innerHTML = `<span class="loot-give-ok">&#10003; Sent to ${escHtml((window._allUsers || {})[btn.dataset.id]?.username || "player")}</span>`;
                  setTimeout(() => { dropdown.style.display = "none"; }, 1400);
                } catch(err) {
                  btn.disabled = false;
                  dropdown.innerHTML += `<span class="loot-give-empty">Error — try again</span>`;
                }
              });
            });
          }
          dropdown.style.display = "block";
        });
        drop.appendChild(row);
      });
    }

    lootPanel.appendChild(drop);
  });
}

btnClearLoot.addEventListener("click", () => {
  lootLog = [];
  state.lootLog = lootLog;
  save();
  renderLootPanel();
});

document.addEventListener("click", () => {
  document.querySelectorAll(".loot-give-dropdown").forEach(d => d.style.display = "none");
});

// ── Hook loot drop into HP damage ─────────────────────────────────────────────
// Wraps applyHp to check for new deaths
const _origApplyHp = applyHp;

// ── Boot ──────────────────────────────────────────────────────────────────────
// Restore attack state: active-turn combatant is always the default attacker
if (state.currentTurn >= 0 && state.combatants[state.currentTurn]) {
  const active = state.combatants[state.currentTurn];
  attackState = { attackerId: active.id, targetId: null };
}
render();

// Restore combat log from saved entries (newest-first via insertBefore loop)
if (state.logEntries.length > 0) {
  state.logEntries.forEach(e => _renderLogEntry(e));
}

// Restore loot panel from saved loot log
renderLootPanel();

// (battlefield removed — attack flow now uses initiative list cards)

