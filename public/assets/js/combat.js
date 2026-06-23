'use strict';

// ── Conditions ────────────────────────────────────────────────────────────────
const CONDITIONS = [
  { id: "blinded",       label: "Blinded",      icon: "lucide:circle",              color: "#9e9e9e" },
  { id: "charmed",       label: "Charmed",       icon: "game-icons:hearts",          color: "#e91e8c" },
  { id: "concentrating", label: "Conc.",         icon: "lucide:focus",               color: "#7c4dff" },
  { id: "deafened",      label: "Deafened",      icon: "lucide:diamond",             color: "#78909c" },
  { id: "exhausted",     label: "Exhausted",     icon: "lucide:battery-low",         color: "#795548" },
  { id: "frightened",    label: "Frightened",    icon: "lucide:alert-circle",        color: "#ff7043" },
  { id: "grappled",      label: "Grappled",      icon: "game-icons:chain",           color: "#ff9800" },
  { id: "incapacitated", label: "Incap.",        icon: "lucide:x",                   color: "#9e9e9e" },
  { id: "invisible",     label: "Invisible",     icon: "lucide:eye-off",             color: "#e0e0e0" },
  { id: "paralyzed",     label: "Paralyzed",     icon: "lucide:zap",                 color: "#ffeb3b" },
  { id: "petrified",     label: "Petrified",     icon: "lucide:gem",                 color: "#a0a0a0" },
  { id: "poisoned",      label: "Poisoned",      icon: "game-icons:skull",           color: "#66bb6a" },
  { id: "prone",         label: "Prone",         icon: "lucide:arrow-down",          color: "#ff9800" },
  { id: "restrained",    label: "Restrained",    icon: "lucide:lock",                color: "#8d6e63" },
  { id: "stunned",       label: "Stunned",       icon: "lucide:zap-off",             color: "#ce93d8" },
  { id: "unconscious",   label: "Unconscious",   icon: "lucide:cloud",               color: "#546e7a" },
  { id: "raging",        label: "Raging",        icon: "lucide:flame",               color: "#ef5350" },
  { id: "hidden",        label: "Hidden",        icon: "lucide:ghost",               color: "#607d8b" },
];

// ── Damage types (5e) ───────────────────────────────────────────────────────────
const DAMAGE_TYPES = [
  { id: "acid",        label: "Acid",        icon: "lucide:flask-conical",  color: "#9ccc65" },
  { id: "bludgeoning", label: "Bludgeoning", icon: "lucide:hammer",         color: "#bcaaa4" },
  { id: "cold",        label: "Cold",        icon: "lucide:snowflake",      color: "#4fc3f7" },
  { id: "fire",        label: "Fire",        icon: "lucide:flame",          color: "#ff7043" },
  { id: "force",       label: "Force",       icon: "lucide:sparkles",       color: "#b388ff" },
  { id: "lightning",   label: "Lightning",   icon: "lucide:zap",            color: "#ffd54f" },
  { id: "necrotic",    label: "Necrotic",    icon: "lucide:skull",          color: "#8d6e63" },
  { id: "piercing",    label: "Piercing",    icon: "game-icons:arrowhead",  color: "#90a4ae" },
  { id: "poison",      label: "Poison",      icon: "game-icons:poison-bottle", color: "#66bb6a" },
  { id: "psychic",     label: "Psychic",     icon: "lucide:brain",          color: "#f06292" },
  { id: "radiant",     label: "Radiant",     icon: "lucide:sun",            color: "#fff176" },
  { id: "slashing",    label: "Slashing",    icon: "lucide:swords",         color: "#a1887f" },
  { id: "thunder",     label: "Thunder",     icon: "lucide:cloud-lightning", color: "#7986cb" },
];

// ── Type colours ──────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  player: { border: "#ffcc66", bg: "rgba(255,204,102,0.11)", activeBg: "rgba(80,55,0,0.45)",   badge: "#c9a030", badgeBg: "rgba(255,204,102,0.14)" },
  enemy:  { border: "#e57373", bg: "rgba(229,115,115,0.11)", activeBg: "rgba(60,8,8,0.6)",      badge: "#ef5350", badgeBg: "rgba(229,115,115,0.14)" },
  ally:   { border: "#81c784", bg: "rgba(129,199,132,0.11)", activeBg: "rgba(0,40,10,0.45)",    badge: "#66bb6a", badgeBg: "rgba(129,199,132,0.14)" },
  npc:    { border: "#64b5f6", bg: "rgba(100,181,246,0.11)", activeBg: "rgba(0,25,60,0.45)",    badge: "#42a5f5", badgeBg: "rgba(100,181,246,0.14)" },
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
// Firebase serialises JS arrays as {0:{…},1:{…}} objects — normalise back to arrays.
function toArr(v) {
  if (!v) return null;
  const a = Array.isArray(v) ? v : Object.values(v);
  return a.length ? a : null;
}

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

// ── Panel toggles (Log / Loot) ────────────────────────────────────────────────
const overlayRightEl = document.querySelector('.overlay-right');
const overlayLootEl  = document.querySelector('.overlay-loot');
const btnToggleLog   = document.getElementById('btn-toggle-log');
const btnToggleLoot  = document.getElementById('btn-toggle-loot');
const isMobileCombat = () => window.matchMedia('(max-width: 520px)').matches;

function setSidePanel(panel, btn, show) {
  panel.style.display = show ? 'flex' : 'none';
  btn.classList.toggle('active', show);
  // Mirror the active state onto the matching mobile toolbar button
  const act = panel === overlayLootEl ? 'loot' : 'log';
  combatToolbar.querySelector(`[data-act="${act}"]`)?.classList.toggle('active', show);
}

function closeSidePanels() {
  setSidePanel(overlayRightEl, btnToggleLog,  false);
  setSidePanel(overlayLootEl,  btnToggleLoot, false);
}

function toggleSidePanel(panel, btn) {
  const show = panel.style.display === 'none';
  // On phones each menu takes over the initiative window — only one at a time
  if (show && isMobileCombat()) { closeSidePanels(); hideCombatantInfo(); hideActionToolbar(); }
  setSidePanel(panel, btn, show);
}

btnToggleLog.addEventListener('click',  () => toggleSidePanel(overlayRightEl, btnToggleLog));
btnToggleLoot.addEventListener('click', () => toggleSidePanel(overlayLootEl,  btnToggleLoot));

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  renderHero();
  renderCombatants();
  if (typeof renderAttackDropdowns === "function") renderAttackDropdowns();
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

  const c = started ? state.combatants[state.currentTurn] : null;
  if (!started || state.combatants.length === 0 || !c) {
    turnBanner.innerHTML = `<span class="turn-label">&#8212; Not in combat &#8212;</span>`;
  } else {
    const col = TYPE_COLORS[c.type] || TYPE_COLORS.npc;
    turnBanner.innerHTML =
      `<span class="turn-label">It's&nbsp;</span>` +
      `<span class="turn-name" style="color:${col.border}">${escHtml(c.name)}</span>` +
      `<span class="turn-label">'s turn</span>`;
  }
  syncCombatToolbar(started);
}

// ── Mobile combat toolbar — mirrors the (hidden) desktop control bar ──────────
const combatToolbar = document.getElementById("combat-toolbar");
const ctbToggle     = combatToolbar.querySelector('[data-act="toggle"]');

function syncCombatToolbar(started) {
  document.getElementById("ctb-round-num").textContent = state.round;
  document.getElementById("ctb-turn").textContent      = turnBanner.textContent;
  combatToolbar.querySelector('[data-act="prev"]').disabled = btnPrev.disabled;
  combatToolbar.querySelector('[data-act="next"]').disabled = btnNext.disabled;
  ctbToggle.classList.toggle("is-end", started);
  ctbToggle.title = started ? "End Combat" : "Start Combat";
  ctbToggle.querySelector("iconify-icon")
    .setAttribute("icon", started ? "lucide:x" : "game-icons:crossed-swords");
}

// Delegate on the whole bottom UI so the standalone Add/Order side buttons are
// handled alongside the dock buttons.
document.getElementById("combat-bottom").addEventListener("click", e => {
  const btn = e.target.closest(".ctb-btn, .ctb-side-btn");
  if (!btn || btn.disabled) return;
  const started = state.currentTurn >= 0;
  ({
    initiative: () => { closeSidePanels(); hideCombatantInfo(); hideActionToolbar(); },
    enemies: () => document.getElementById("btn-enemy-list").click(),
    add:    () => document.getElementById("btn-add").click(),
    sort:   () => document.getElementById("btn-sort").click(),
    prev:   () => btnPrev.click(),
    next:   () => btnNext.click(),
    log:    () => document.getElementById("btn-toggle-log").click(),
    loot:   () => document.getElementById("btn-toggle-loot").click(),
    toggle: () => (started ? btnEnd : btnStart).click(),
  })[btn.dataset.act]?.();
});

// ── Contextual action toolbar (phones) — heal / damage / condition for the
//    tapped combatant; sits just above the main combat toolbar ────────────────
const actionToolbar = document.getElementById("combat-action-toolbar");
const catAmt  = document.getElementById("cat-amt");
let actionId = null;   // track by id — index shifts when the list re-sorts

function showActionToolbar(id) {
  const c = state.combatants.find(x => x.id === id);
  if (!c) { hideActionToolbar(); return; }
  actionId = id;
  const hasHp = c.type !== "player" && c.maxHp > 0;
  actionToolbar.classList.toggle("no-hp", !hasHp);
  catAmt.value = "";
  actionToolbar.style.display = "flex";   // sits in the action row, between the side buttons
}

function hideActionToolbar() {
  actionToolbar.style.display = "none";
  actionId = null;
}

function actionHp(isDamage) {
  if (actionId == null) return;
  const idx = state.combatants.findIndex(x => x.id === actionId);
  if (idx !== -1 && applyHpAmount(idx, parseInt(catAmt.value, 10), isDamage)) {
    showActionToolbar(actionId);   // re-render shuffled the DOM; refresh + reposition
  }
}

document.getElementById("cat-dmg").addEventListener("click",  () => actionHp(true));
document.getElementById("cat-heal").addEventListener("click", () => actionHp(false));
document.getElementById("cat-cond").addEventListener("click", e => {
  e.stopPropagation();   // don't let the outside-click handler close it immediately
  const idx = actionId == null ? -1 : state.combatants.findIndex(x => x.id === actionId);
  if (idx !== -1) openCondPicker(idx, e.currentTarget);
});
document.getElementById("cat-dmgtype").addEventListener("click", e => {
  e.stopPropagation();
  openDmgTypePicker(e.currentTarget);
});
catAmt.addEventListener("keydown", e => { if (e.key === "Enter") actionHp(true); });

// ── Combatant List ────────────────────────────────────────────────────────────
const listEl = document.getElementById("combatant-list");

function renderCombatants() {
  listEl.innerHTML = "";
  if (state.combatants.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <iconify-icon icon="game-icons:crossed-swords" class="empty-icon"></iconify-icon>
        <p>No combatants yet.</p>
        <p class="empty-hint">Click <strong>+ Add Combatant</strong> to begin.</p>
      </div>`;
    return;
  }
  state.combatants.forEach((c, idx) => listEl.appendChild(wrapCombatantSwipe(buildCard(c, idx), c)));
}

// Wrap a card so it can be swiped left to delete on phones (mirrors the quest tab).
// On desktop the wrapper is `display:contents`, so layout is unchanged.
function wrapCombatantSwipe(card, c) {
  const swipe = document.createElement("div");
  swipe.className = "combatant-swipe";
  const del = document.createElement("div");
  del.className = "combatant-swipe-delete";
  del.innerHTML = `<iconify-icon icon="lucide:trash-2"></iconify-icon>`;
  swipe.appendChild(del);
  swipe.appendChild(card);
  attachCombatSwipeToDelete(swipe, card, c);
  return swipe;
}

function attachCombatSwipeToDelete(swipe, card, c) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
  const thresholdFor = () => Math.min(140, card.offsetWidth * 0.4);

  card.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    if (!isMobileCombat()) return;     // desktop uses the on-card buttons instead
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dragging = true; decided = false; horizontal = false;
    card.style.transition = "none";
    // Free `transform` from the card's entry/breath animations so the drag sticks
    card.getAnimations().forEach(a => a.cancel());
    card.style.opacity = "";
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    if (!dragging) return;
    const ddx = e.touches[0].clientX - startX;
    const ddy = e.touches[0].clientY - startY;
    if (!decided && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      decided = true;
      horizontal = Math.abs(ddx) > Math.abs(ddy);
    }
    if (!horizontal) return;        // vertical gesture → let the list scroll
    e.preventDefault();             // we own the horizontal gesture
    dx = Math.min(card.offsetWidth, Math.max(0, ddx));   // slide right only
    card.style.setProperty("transform", `translateX(${dx}px)`, "important");
    swipe.classList.toggle("swipe-ready", dx > thresholdFor());
  }, { passive: false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "";
    if (dx > thresholdFor()) {
      card.style.setProperty("transform", "translateX(100%)", "important");
      card.style.opacity = "0";
      card._swiped = true;
      setTimeout(() => {
        const i = state.combatants.findIndex(x => x.id === c.id);
        if (i !== -1) removeCombatant(i);
      }, 180);
    } else {
      card.style.transform = "";
      swipe.classList.remove("swipe-ready");
      if (Math.abs(dx) > 8) { card._swiped = true; setTimeout(() => { card._swiped = false; }, 60); }
    }
  };
  card.addEventListener("touchend", finish);
  card.addEventListener("touchcancel", finish);
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
    return `<span class="condition-pill" style="border-color:${cd.color};color:${cd.color}"><iconify-icon icon="${cd.icon}"></iconify-icon> ${cd.label}${roundsLabel}</span>`;
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
  const _atks = toArr(c.attacks);
  const attacksHtml = _atks ? `
    <div class="card-attacks">
      ${_atks.map(a => `
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
        ${isActive ? `<span class="card-active-badge"><iconify-icon icon="lucide:chevron-right"></iconify-icon> Turn</span>` : ""}
      </div>
      ${c.notes ? `<div class="card-notes">${escHtmlNl(c.notes)}</div>` : ""}
      ${!isPlayer && c.maxHp > 0 ? `
        <div class="card-hp-row">
          <div class="hp-bar-wrap">
            <div class="hp-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
          </div>
          <span class="card-hp-text">
            ${isDead ? `<span class="dead-label"><iconify-icon icon="game-icons:skull"></iconify-icon> Dead</span>` : `${c.hp}<span class="hp-sep">/</span>${c.maxHp}`}
          </span>
          <span class="card-ac"><iconify-icon icon="game-icons:shield"></iconify-icon> ${c.ac ?? "?"}</span>
        </div>
      ` : ""}
      ${statsHtml}
      ${attacksHtml}
      ${extraHtml}
      ${condHtml ? `<div class="card-conditions">${condHtml}</div>` : ""}
    </div>
    <div class="card-actions">
      <button class="card-btn view-btn" title="View stats"><iconify-icon icon="lucide:eye"></iconify-icon></button>
      ${!isPlayer ? `<button class="card-btn hp-btn"   title="Adjust HP"><iconify-icon icon="lucide:heart-pulse"></iconify-icon></button>` : ""}
      <button class="card-btn cond-btn" title="Conditions"><iconify-icon icon="lucide:zap"></iconify-icon></button>
      ${hasConds   ? `<button class="card-btn clear-fx-btn" title="Clear all conditions"><iconify-icon icon="lucide:zap-off"></iconify-icon></button>` : ""}
      <button class="card-btn edit-btn" title="Edit"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
      <button class="card-btn del-btn"  title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
    </div>`;

  if (!isPlayer) {
    div.querySelector(".hp-btn").addEventListener("click",  e => { e.stopPropagation(); openHpAdjust(idx, e.currentTarget); });
  }
  div.querySelector(".view-btn").addEventListener("click",  e => { e.stopPropagation(); showCombatantInfo(c.id); });
  div.querySelector(".cond-btn").addEventListener("click",  e => { e.stopPropagation(); openCondPicker(idx, e.currentTarget); });
  if (hasConds) {
    div.querySelector(".clear-fx-btn").addEventListener("click", e => { e.stopPropagation(); clearAllConditions(idx); });
  }
  div.querySelector(".edit-btn").addEventListener("click",  e => { e.stopPropagation(); openModal(idx); });
  div.querySelector(".del-btn").addEventListener("click",   e => { e.stopPropagation(); removeCombatant(idx); });

  // Single click: select / switch selection (or pick target when in attack mode)
  div.addEventListener("click", e => {
    if (div._swiped) return;   // ignore the click that follows a swipe-to-delete
    if (e.target.closest(".card-actions")) return;
    onCardClick(c.id);
  });

  // Double click: enter attack mode with this combatant as the attacker.
  // Desktop only — phones use the action toolbar instead.
  div.addEventListener("dblclick", e => {
    if (isMobileCombat()) return;
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
  addLog(`Combat started — Round ${state.round}`, "round");
  addLog(`${state.combatants[0].name}'s turn`, "turn");
  render();
});

btnEnd.addEventListener("click", () => {
  if (!confirm("End combat and reset all conditions?")) return;
  state.currentTurn = -1;
  state.round = 1;
  state.combatants.forEach(c => { c.conditions = []; c.lootDropped = false; });
  addLog("Combat ended.", "info");
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
  addLog(`${active.name}'s turn`, "turn");
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
  addLog(`Back to ${active.name}'s turn`, "turn");
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
  state = { round: 1, currentTurn: -1, combatants: [], logEntries: [], lootLog: [] };
  addLog("Tracker cleared.", "info");
  render();
});

// ── Remove one combatant ──────────────────────────────────────────────────────
function removeCombatant(idx) {
  const c = state.combatants[idx];
  if (!c) return;
  state.combatants.splice(idx, 1);
  if (state.combatants.length === 0) state.currentTurn = -1;
  else if (state.currentTurn >= state.combatants.length) state.currentTurn = 0;
  addLog(`${c.name} removed.`, "info");
  render();
}

// ── Clear all conditions on one combatant ─────────────────────────────────────
function clearAllConditions(idx) {
  const c = state.combatants[idx];
  if (!c) return;
  c.conditions = [];
  addLog(`All conditions cleared from ${c.name}.`, "cond");
  render();
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
const combatantModal    = document.getElementById("combatant-modal");
const cmTitle           = document.getElementById("cm-title");
const cmName            = document.getElementById("cm-name");
const cmPlayerPickRow   = document.getElementById("cm-player-pick-row");
const cmPlayerList      = document.getElementById("cm-player-list");
let   _selectedPlayerUid = null;
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
  const isAddPlayer = isPlayer && editingIdx === null;

  cmNameRow.style.display        = (isAddEnemy || isAddPlayer) ? "none" : "";
  cmPlayerPickRow.style.display  = isAddPlayer ? "" : "none";
  cmEnemyTmplRow.style.display   = isAddEnemy ? ""     : "none";
  cmEnemyCountRow.style.display  = isAddEnemy ? ""     : "none";
  cmNonPlayerRows.style.display  = isAddEnemy || isPlayer ? "none" : "";
  document.getElementById("cm-preset-row").style.display = isAddEnemy || isPlayer ? "none" : "";
  cmLootRows.style.display       = isEnemy && !isAddEnemy ? "" : "none";
  cmInitLabel.firstChild.textContent = isPlayer ? "Initiative rolled" : "Initiative";

  if (isAddPlayer) _renderPlayerPicker();
}

function _renderPlayerPicker() {
  // Re-render when any Firebase data arrives late (module script is deferred)
  window._onCampaignPlayersLoaded = _renderPlayerPicker;
  window._onUsersLoaded           = _renderPlayerPicker;

  cmPlayerList.innerHTML = "";
  _selectedPlayerUid = null;
  const users        = window._allUsers || {};
  const members      = window._campaignMembers || {};
  const displayNames = window._campaignDisplayNames || {};

  const uids = Object.keys(members).length
    ? Object.keys(members)
    : Object.keys(users);

  const entries = uids
    .map(uid => [uid, users[uid]])
    .filter(([, u]) => u && u.username);

  if (!entries.length) {
    cmPlayerList.innerHTML = `<div class="cm-player-empty">No players found in this campaign.</div>`;
    return;
  }
  entries.forEach(([uid, u]) => {
    const displayName = displayNames[uid] || u.username;
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = "cm-player-btn";
    btn.dataset.uid = uid;
    btn.innerHTML = `<span class="cm-player-dot" style="background:${escHtml(u.color || "#888")}"></span><span>${escHtml(displayName)}</span>`;
    btn.addEventListener("click", () => {
      cmPlayerList.querySelectorAll(".cm-player-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      _selectedPlayerUid = uid;
      cmName.value = displayName;
    });
    cmPlayerList.appendChild(btn);
  });
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
  const matches = spawnableTemplates().filter(m => m.name.toLowerCase().includes(q)).slice(0, 12);
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
  const all = spawnableTemplates();
  const matches = q
    ? all.filter(t => t.name.toLowerCase().includes(q)).slice(0, 12)
    : all.slice(0, 12);
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
    _selectedPlayerUid = null;
    // Reset loot fields
    cmLootGpMin.value = cmLootGpMax.value = cmLootItemsMin.value = cmLootItemsMax.value = "0";
    setActiveLootTags([]);
  }

  syncTypeBtns();
  updatePlayerFields();
  combatantModal.classList.add("open");
  setTimeout(() => (editingIdx === null && selectedType === "enemy" ? cmEnemyTmplSearch : cmName).focus(), 60);
}

function closeModal() { combatantModal.classList.remove("open"); editingIdx = null; window._onCampaignPlayersLoaded = null; window._onUsersLoaded = null; }
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
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? " " + (i + 1) : "";
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
        loot:       t.loot ? { ...t.loot, lootItems: t.lootItems || [] } : null,
        stats:      t.stats   || null,
        attacks:    Array.isArray(t.attacks) ? t.attacks : (t.attacks ? Object.values(t.attacks) : null),
        speed:      t.speed   || null,
        saves:      t.saves   || null,
        condImm:    t.condImm || null,
        languages:  t.languages || null,
        resistances:     t.resistances    || [],
        vulnerabilities: t.vulnerabilities || [],
      });
    }
    const label = count > 1 ? `${t.name} ×${count}` : t.name;
    addLog(`+  ${label} added.`, "info");
    closeModal();
    render();
    return;
  }

  // Simplified add-player path
  if (isPlayer && editingIdx === null) {
    if (!_selectedPlayerUid) { cmError.textContent = "Select a player from the list."; return; }
    const u           = (window._allUsers || {})[_selectedPlayerUid];
    const displayNames = window._campaignDisplayNames || {};
    const playerName  = displayNames[_selectedPlayerUid] || (u ? u.username : "Player");
    const initVal    = parseInt(cmInit.value, 10);
    state.combatants.push({
      id:         genId(),
      name:       playerName,
      type:       "player",
      initiative: isNaN(initVal) ? 0 : initVal,
      hp:         0,
      maxHp:      0,
      ac:         0,
      conditions: [],
      notes:      null,
      loot:       null,
      color:      u?.color || null,
      uid:        _selectedPlayerUid,
    });
    addLog(`+  ${playerName} added.`, "info");
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
    addLog(`${name} updated.`, "info");
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

// Apply the currently-selected damage type to a raw amount against a target,
// factoring in its resistances (½, rounded down) and vulnerabilities (×2).
function adjustDamage(target, amt) {
  const dt = currentDamageType;
  const label = dt ? " " + (DAMAGE_TYPES.find(x => x.id === dt)?.label.toLowerCase() || dt) : "";
  if (dt && (target.vulnerabilities || []).includes(dt))
    return { dmg: amt * 2,            note: " (vulnerable)", typeLabel: label };
  if (dt && (target.resistances || []).includes(dt))
    return { dmg: Math.floor(amt / 2), note: " (resisted)",   typeLabel: label };
  return { dmg: amt, note: "", typeLabel: label };
}

function applyHpAmount(idx, amt, isDamage) {
  if (isNaN(amt) || amt <= 0) return false;
  const c = state.combatants[idx];
  if (!c) return false;

  if (isDamage) {
    const { dmg, note, typeLabel } = adjustDamage(c, amt);
    const wasDead = c.hp <= 0;
    c.hp = Math.max(0, c.hp - dmg);
    addLog(`${c.name} took ${dmg}${typeLabel} damage${note} → ${c.hp}/${c.maxHp}`, "damage");
    if (c.hp === 0 && !wasDead) {
      addLog(`${c.name} has fallen!`, "death");
      if (c.type === "enemy" && !c.lootDropped) { c.lootDropped = true; addLootDrop(c); }
    }
  } else {
    c.hp = Math.min(c.maxHp, c.hp + amt);
    addLog(`${c.name} healed ${amt} HP → ${c.hp}/${c.maxHp}`, "heal");
  }
  render();
  return true;
}

// ── Damage-type selector (shared by the mobile action toolbar + desktop attack bar)
let currentDamageType = null;   // null = untyped
const dmgTypePicker = document.getElementById("dmg-type-picker");
const dmgTypeGrid   = document.getElementById("dmg-type-grid");

function updateDmgTypeButtons() {
  const dt = currentDamageType ? DAMAGE_TYPES.find(x => x.id === currentDamageType) : null;
  document.querySelectorAll(".dmgtype-btn").forEach(btn => {
    const ic = btn.querySelector("iconify-icon");
    ic.setAttribute("icon", dt ? dt.icon : "game-icons:drop");
    btn.style.color = dt ? dt.color : "";
    btn.title = dt ? `Damage type: ${dt.label}` : "Damage type: untyped";
    btn.classList.toggle("typed", !!dt);
  });
}

function openDmgTypePicker(anchor) {
  dmgTypeGrid.innerHTML = "";
  const mk = (id, label, icon, color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cond-picker-btn" + (currentDamageType === id ? " active" : "");
    if (color) btn.style.color = color;
    if (currentDamageType === id && color) btn.style.borderColor = color;
    btn.innerHTML = `<iconify-icon icon="${icon}"></iconify-icon> ${label}`;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      currentDamageType = id;
      updateDmgTypeButtons();
      dmgTypePicker.style.display = "none";
    });
    dmgTypeGrid.appendChild(btn);
  };
  mk(null, "Untyped", "game-icons:drop", "#9e9e9e");
  DAMAGE_TYPES.forEach(dt => mk(dt.id, dt.label, dt.icon, dt.color));
  dmgTypePicker.style.display = "block";
  positionNear(dmgTypePicker, anchor);
}

function applyHp(isDamage) {
  if (applyHpAmount(hpIdx, parseInt(hpInput.value, 10), isDamage)) {
    hpOverlay.style.display = "none";
    hpIdx = null;
  }
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
    btn.innerHTML = `<iconify-icon icon="${cd.icon}"></iconify-icon> ${cd.label}${roundsLabel}`;

    btn.addEventListener("click", e => {
      e.stopPropagation();
      const conds = c.conditions || [];
      if (conds.find(x => x.id === cd.id)) {
        // Remove
        c.conditions = conds.filter(x => x.id !== cd.id);
        addLog(`${c.name}: ${cd.label} removed`, "cond");
      } else {
        // Add with optional round duration
        const rounds = parseInt(condRoundsInput.value, 10);
        c.conditions = [...conds, { id: cd.id, rounds: isNaN(rounds) || rounds < 1 ? null : rounds }];
        const durLabel = (!isNaN(rounds) && rounds > 0) ? ` (${rounds} rounds)` : " (permanent)";
        addLog(`${c.name}: ${cd.label} applied${durLabel}`, "cond");
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
  if (dmgTypePicker.style.display !== "none"
      && !dmgTypePicker.contains(e.target)
      && !e.target.closest(".dmgtype-btn"))
    { dmgTypePicker.style.display = "none"; }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (e.key === "Escape") {
    hpOverlay.style.display = "none";
    condPicker.style.display = "none";
    dmgTypePicker.style.display = "none";
    hpIdx = condIdx = null;
    if (attackState.attackerId) cancelAttack();
  }
  if ((e.key === " " || e.key === "ArrowRight") && state.currentTurn >= 0) { e.preventDefault(); advanceTurn(); }
  if (e.key === "ArrowLeft" && state.currentTurn >= 0)                      { e.preventDefault(); retreatTurn(); }
});

// ── Card Attack Flow ──────────────────────────────────────────────────────────
const attackerSelect = document.getElementById("attack-attacker-sel");
const targetSelect   = document.getElementById("attack-target-sel");
const attackDmgInput = document.getElementById("attack-dmg-input");
const cipPanel       = document.getElementById("combatant-info-panel");
const cipName        = document.getElementById("cip-name");
const cipBody        = document.getElementById("cip-body");

function syncAttackDmgGroup() {
  // DMG group is always visible; nothing to sync
}

function renderAttackDropdowns() {
  const prevA = attackState.attackerId || "";
  const prevT = attackState.targetId   || "";
  attackerSelect.innerHTML = '<option value="">— Attacker —</option>';
  targetSelect.innerHTML   = '<option value="">— Target —</option>';
  state.combatants.forEach(c => {
    const isDead = c.type !== "player" && c.maxHp > 0 && c.hp <= 0;
    const label  = c.name + (isDead ? " ☠" : "");
    attackerSelect.appendChild(new Option(label, c.id, false, c.id === prevA));
    targetSelect.appendChild(  new Option(label, c.id, false, c.id === prevT));
  });
  syncAttackDmgGroup();
}

function showCombatantInfo(id) {
  const c = state.combatants.find(x => x.id === id);
  if (!c) { hideCombatantInfo(); return; }
  // On phones the inspector is its own full-screen menu — clear the others first
  if (isMobileCombat()) { closeSidePanels(); hideActionToolbar(); }
  const col      = TYPE_COLORS[c.type] || TYPE_COLORS.npc;
  const isPlayer = c.type === "player";
  const isDead   = !isPlayer && c.maxHp > 0 && c.hp <= 0;
  const hpPct    = c.maxHp > 0 ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
  const hpColor  = hpPct > 60 ? "#4caf50" : hpPct > 30 ? "#ff9800" : "#e53935";
  const statMod  = v => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? "+" : "") + m; };

  // Fall back to template data for old combatants that predate full stat saving
  const tmpl = (window._enemyTemplates || []).find(
    t => t.id === c.templateId || t.name.toLowerCase() === c.name.replace(/ \d+$/, "").toLowerCase()
  );
  const src = {
    stats:     c.stats     ?? tmpl?.stats     ?? null,
    attacks:   c.attacks   ?? tmpl?.attacks   ?? null,
    speed:     c.speed     ?? tmpl?.speed     ?? null,
    saves:     c.saves     ?? tmpl?.saves     ?? null,
    condImm:   c.condImm   ?? tmpl?.condImm   ?? null,
    languages: c.languages ?? tmpl?.languages ?? null,
    notes:     c.notes     ?? tmpl?.notes     ?? null,
    cr:        c.cr        ?? tmpl?.cr        ?? null,
    resistances:     c.resistances     ?? tmpl?.resistances     ?? [],
    vulnerabilities: c.vulnerabilities ?? tmpl?.vulnerabilities ?? [],
  };

  cipName.textContent = c.name;
  cipName.style.color = col.border;

  let html = "";

  // HP / AC / Initiative / CR chips
  if (!isPlayer && c.maxHp > 0) {
    html += `<div class="cip-hp-row">
      <div class="hp-bar-wrap" style="flex:1;min-width:60px">
        <div class="hp-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
      </div>
      <span class="cip-stat-chip">${isDead ? "☠ Dead" : `${c.hp} / ${c.maxHp} HP`}</span>
      ${c.ac         != null ? `<span class="cip-stat-chip"><iconify-icon icon="game-icons:shield"></iconify-icon> AC ${c.ac}</span>` : ""}
      ${c.initiative != null ? `<span class="cip-stat-chip">Init ${c.initiative}</span>` : ""}
      ${src.cr       ? `<span class="cip-stat-chip">CR ${src.cr}</span>` : ""}
    </div>`;
  }

  // Ability scores
  if (src.stats) {
    html += `<div class="cip-stats-row">
      ${["str","dex","con","int","wis","cha"].map(k => src.stats[k] != null ? `
        <div class="cip-stat-block">
          <span class="cip-stat-name">${k.toUpperCase()}</span>
          <span class="cip-stat-val">${src.stats[k]}</span>
          <span class="cip-stat-mod">${statMod(src.stats[k])}</span>
        </div>` : "").join("")}
    </div>`;
  }

  // Attacks
  const atks = toArr(src.attacks);
  if (atks) {
    html += `<div class="cip-section">
      <div class="cip-section-title">Attacks</div>
      ${atks.map(a => `
        <div class="cip-attack-row">
          <span class="cip-atk-name">${escHtml(a.name)}</span>
          ${a.hit    ? `<span class="cip-atk-chip">${escHtml(a.hit)}</span>` : ""}
          ${a.damage ? `<span class="cip-atk-dmg">${escHtmlNl(a.damage)}</span>` : ""}
        </div>`).join("")}
    </div>`;
  }

  // Extra fields
  const extras = [
    src.speed     ? ["Speed",  src.speed]     : null,
    src.saves     ? ["Saves",  src.saves]     : null,
    src.condImm   ? ["Immune", src.condImm]   : null,
    src.languages ? ["Lang",   src.languages] : null,
    src.notes     ? ["Notes",  src.notes]     : null,
  ].filter(Boolean);
  if (extras.length) {
    html += `<div class="cip-section">
      ${extras.map(([lbl, val]) => `
        <div class="cip-extra-row">
          <span class="cip-extra-label">${lbl}</span>
          <span>${escHtmlNl(val)}</span>
        </div>`).join("")}
    </div>`;
  }

  // Damage resistances / vulnerabilities
  const dmgChip = id => {
    const dt = DAMAGE_TYPES.find(x => x.id === id);
    return dt ? `<span class="dmg-type-chip active" style="color:${dt.color};border-color:${dt.color}"><iconify-icon icon="${dt.icon}"></iconify-icon> ${dt.label}</span>` : "";
  };
  if (src.resistances.length || src.vulnerabilities.length) {
    html += `<div class="cip-section">
      ${src.resistances.length ? `<div class="cip-extra-row"><span class="cip-extra-label">Resist</span><span class="dmg-type-chips">${src.resistances.map(dmgChip).join("")}</span></div>` : ""}
      ${src.vulnerabilities.length ? `<div class="cip-extra-row"><span class="cip-extra-label">Vuln</span><span class="dmg-type-chips">${src.vulnerabilities.map(dmgChip).join("")}</span></div>` : ""}
    </div>`;
  }

  // Conditions
  if (c.conditions && c.conditions.length) {
    const condHtml = c.conditions.map(cond => {
      const cd = CONDITIONS.find(x => x.id === cond.id);
      if (!cd) return "";
      const rounds = cond.rounds != null ? ` (${cond.rounds})` : "";
      return `<span class="condition-pill" style="border-color:${cd.color};color:${cd.color}"><iconify-icon icon="${cd.icon}"></iconify-icon> ${cd.label}${rounds}</span>`;
    }).join("");
    if (condHtml) html += `<div class="card-conditions">${condHtml}</div>`;
  }

  // No data at all — guide user to re-import
  if (!src.stats && !atks && !extras.length && !c.conditions?.length
      && !src.resistances.length && !src.vulnerabilities.length) {
    html += `<p style="font-size:12px;color:#555;font-style:italic;margin:4px 0">No stat data. Re-import D&amp;D 5e templates or edit this template to add a stat block.</p>`;
  }

  // Set the accent colour on the inner element to match combatant type
  const inner = cipPanel.querySelector(".cip-inner");
  if (inner) inner.style.setProperty("--cip-accent", col.border);

  cipBody.innerHTML = html;
  cipPanel.classList.add("open");
}

function hideCombatantInfo() {
  cipPanel.classList.remove("open");
}

// Sync selects + dmg group to current attackState; open info panel for target
function showAttackBar(attacker, target) {
  if (attacker) attackerSelect.value = attacker.id;
  if (target) {
    attackState.targetId = target.id;
    targetSelect.value   = target.id;
    showCombatantInfo(target.id);
    attackDmgInput.value = "";
    setTimeout(() => attackDmgInput.focus(), 50);
  } else {
    attackState.targetId = null;
    targetSelect.value   = "";
    hideCombatantInfo();
  }
  syncAttackDmgGroup();
}

function cancelAttack() {
  attackMode = false;
  attackState = { attackerId: null, targetId: null };
  attackerSelect.value = "";
  targetSelect.value   = "";
  syncAttackDmgGroup();
  hideCombatantInfo();
  patchCardClasses();
}

function resolveAttack(isDamage) {
  const amt = parseInt(attackDmgInput.value, 10);
  if (isNaN(amt) || amt < 0) return;
  const attacker = state.combatants.find(c => c.id === attackState.attackerId);
  const target   = state.combatants.find(c => c.id === attackState.targetId);
  if (!target) return;

  if (isDamage) {
    const { dmg, note, typeLabel } = adjustDamage(target, amt);
    if (target.type !== "player" && target.maxHp > 0) {
      const wasDead = target.hp <= 0;
      target.hp = Math.max(0, target.hp - dmg);
      addLog(`${attacker ? attacker.name : "?"} dealt ${dmg}${typeLabel} damage to ${target.name}${note} → ${target.hp}/${target.maxHp}`, "damage");
      if (target.hp === 0 && !wasDead) {
        addLog(`${target.name} has fallen!`, "death");
        if (target.type === "enemy" && !target.lootDropped) { target.lootDropped = true; addLootDrop(target); }
      }
    } else {
      addLog(`${attacker ? attacker.name : "?"} dealt ${dmg}${typeLabel} damage to ${target.name}${note}`, "damage");
    }
  } else {
    if (target.type !== "player" && target.maxHp > 0) {
      target.hp = Math.min(target.maxHp, target.hp + amt);
      addLog(`${attacker ? attacker.name : "?"} healed ${target.name} for ${amt} → ${target.hp}/${target.maxHp}`, "heal");
    } else {
      addLog(`${attacker ? attacker.name : "?"} healed ${target.name} for ${amt}`, "heal");
    }
  }

  attackMode = false;
  attackState.targetId = null;
  showAttackBar(attacker, null);
  render();
}

// ── Card click handlers ───────────────────────────────────────────────────────
function onCardClick(id) {
  const c = state.combatants.find(x => x.id === id);
  if (!c) return;

  // Phones: tapping a card selects it and opens the contextual action toolbar
  // (heal / damage / condition). The info overlay is reached via the eye button.
  if (isMobileCombat()) {
    // Re-tapping the already-selected card closes the toolbar (deselect)
    if (actionId === id && actionToolbar.style.display !== "none") {
      hideActionToolbar();
      attackState = { attackerId: null, targetId: null };
      patchCardClasses();
      return;
    }
    attackState = { attackerId: id, targetId: null };
    attackerSelect.value = id;
    targetSelect.value   = "";
    syncAttackDmgGroup();
    patchCardClasses();
    showActionToolbar(id);
    return;
  }

  // Always show info panel for the clicked card
  showCombatantInfo(id);

  if (attackMode) {
    if (attackState.attackerId === id) {
      // Clicking the attacker again exits attack mode
      attackMode = false;
      attackState.targetId = null;
      targetSelect.value   = "";
      syncAttackDmgGroup();
    } else {
      // Pick this card as the target
      attackState.targetId = id;
      targetSelect.value   = id;
      const attacker = state.combatants.find(x => x.id === attackState.attackerId);
      showAttackBar(attacker, c);
    }
    render();
  } else {
    attackState = { attackerId: id, targetId: null };
    attackerSelect.value = id;
    targetSelect.value   = "";
    syncAttackDmgGroup();
    patchCardClasses();
  }
}

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
  attackMode  = true;
  attackState = { attackerId: id, targetId: null };
  attackerSelect.value = id;
  targetSelect.value   = "";
  syncAttackDmgGroup();
  render();
}

// ── Dropdown change handlers ──────────────────────────────────────────────────
attackerSelect.addEventListener("change", () => {
  attackState.attackerId = attackerSelect.value || null;
  syncAttackDmgGroup();
  patchCardClasses();
});

targetSelect.addEventListener("change", () => {
  attackState.targetId = targetSelect.value || null;
  syncAttackDmgGroup();
  patchCardClasses();
  if (attackState.targetId) {
    showCombatantInfo(attackState.targetId);
    attackDmgInput.value = "";
    setTimeout(() => attackDmgInput.focus(), 50);
  } else {
    hideCombatantInfo();
  }
});

document.getElementById("attack-deal-btn").addEventListener("click",  () => resolveAttack(true));
document.getElementById("attack-heal-btn").addEventListener("click",  () => resolveAttack(false));
document.getElementById("attack-dmgtype-btn").addEventListener("click", e => {
  e.stopPropagation();
  openDmgTypePicker(e.currentTarget);
});
document.getElementById("attack-cancel-btn").addEventListener("click", cancelAttack);
document.getElementById("cip-close").addEventListener("click", hideCombatantInfo);
attackDmgInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  resolveAttack(true);
  if (e.key === "Escape") cancelAttack();
});

// ── Enemy Templates ───────────────────────────────────────────────────────────
let enemyTemplates     = [];
let selectedTemplateId = null;

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

// Seed missing loot pool items (idempotent by ID)
function _seedLootTables() {
  if (window._saveItem) {
    const existingIds = new Set((window._combatItems || []).map(i => i.id));
    SEED_ITEMS.forEach(item => {
      if (!existingIds.has(item.id)) window._saveItem(item);
    });
  }
}

// Readiness check — called when either templates or system flags finish loading
function _checkAndSeedLoot() {
  const LOOT_VERSION = 2;
  if (!window._enemyTemplatesLoaded)   return; // templates not ready
  if (window._systemFlags === undefined) return; // system flags not ready
  if ((window._systemFlags.lootVersion || 0) < LOOT_VERSION) {
    _seedLootTables();
    window._setSystemFlag?.("lootVersion", LOOT_VERSION);
  }
}

window._onSystemFlagsLoaded = _checkAndSeedLoot;

// Called every time Firebase pushes an update
// Real templates plus codex characters that carry a stat block. This spawnable
// set is what the add-combatant pickers offer; the Enemy Templates management
// list stays templates-only (so editing there can't fork a codex creature).
function spawnableTemplates() {
  const codex = (window._codexCreatures || [])
    .filter(c => c && c.statBlock && c.name)
    .map(c => ({ ...c.statBlock, id: c.id, name: c.name, fromCodex: true }));
  return enemyTemplates.concat(codex).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

window._onEnemyTemplatesUpdate = () => {
  const firebaseList = window._enemyTemplates || [];

  enemyTemplates = firebaseList
    .filter(t => !!t.name)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Show/hide import button based on whether dnd5e creatures are already imported
  const _cmSession = (() => { try { return JSON.parse(localStorage.getItem('playerSession')); } catch { return null; } })();
  if (_cmSession?.role === 'admin' && btnImportCreatures) {
    const hasDnd5e = firebaseList.some(t => t.id?.startsWith("dnd5e_"));
    btnImportCreatures.style.display = hasDnd5e ? "none" : "inline-flex";
  }

  _checkAndSeedLoot(); // also check if loot version needs updating
  renderTemplateList();
  // If the currently selected template was just updated from Firebase, refresh the form
  if (selectedTemplateId) {
    const updated = enemyTemplates.find(t => t.id === selectedTemplateId);
    if (updated) window.StatBlockEditor.load(updated);
  }
};

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

// The stat-block form fields (HP/AC, ability scores, attacks, damage chips, loot
// picker) live in the shared StatBlockEditor module — wire them up once here.
window.StatBlockEditor.mount();

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
  clearEditorFields();
  showEditorForm();
  etName.focus();
  renderTemplateList();
});

function openTemplateEditor(id) {
  const tmpl = enemyTemplates.find(t => t.id === id);
  if (!tmpl) return;
  selectedTemplateId = id;
  etName.value = tmpl.name || "";
  window.StatBlockEditor.load(tmpl);
  etError.textContent = "";
  showEditorForm();
  renderTemplateList();
}

function clearEditorFields() {
  etName.value = "";
  window.StatBlockEditor.clear();
  etError.textContent = "";
}

function showEditorForm() {
  enemyEditorEmpty.style.display = "none";
  enemyEditorForm.style.display  = "flex";
  etDeleteBtn.style.display = selectedTemplateId ? "" : "none";
}

// ── Save template ─────────────────────────────────────────────────────────────
etSaveBtn.addEventListener("click", () => {
  const name = etName.value.trim();
  if (!name) { etError.textContent = "Name is required."; return; }
  etError.textContent = "";

  const payload = {
    id:   selectedTemplateId || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    name,
    ...window.StatBlockEditor.read(),
  };

  if (!selectedTemplateId) selectedTemplateId = payload.id;

  saveTemplate(payload);
  etDeleteBtn.style.display = "";
  etError.innerHTML = '<iconify-icon icon="lucide:check"></iconify-icon> Saved.';
  setTimeout(() => { if (etError.textContent.trim() === "Saved.") etError.textContent = ""; }, 1500);
});

// ── Delete template ───────────────────────────────────────────────────────────
etDeleteBtn.addEventListener("click", () => {
  if (!selectedTemplateId) return;
  const tmpl = enemyTemplates.find(t => t.id === selectedTemplateId);
  if (!confirm(`Delete template "${tmpl?.name}"?`)) return;
  deleteTemplate(selectedTemplateId);
  selectedTemplateId = null;
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
      attacks:     toArr(tmpl.attacks),
      saves:       tmpl.saves     || null,
      condImm:     tmpl.condImm   || null,
      languages:   tmpl.languages || null,
      resistances:     tmpl.resistances    || [],
      vulnerabilities: tmpl.vulnerabilities || [],
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
  let templateItems = cfg?.lootItems || [];
  // Fallback: combatants loaded from old localStorage state won't have lootItems populated —
  // look up by name in SEED_LOOT so preset monsters always drop the right items.
  if (templateItems.length === 0 && combatant.name) {
    const seedEntry = SEED_LOOT[combatant.name];
    if (seedEntry) templateItems = _buildSeedLootItems(seedEntry.items || []);
  }
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
        const fullItem = item.id ? ((window._combatItems || []).find(ci => ci.id === item.id) || {}) : {};
        for (let q = 0; q < (item.qty || 1); q++) {
          dropped.push({ name: item.name, rarity: item.rarity || "common", price: item.price ?? null, type: fullItem.type || item.type || null, description: fullItem.description || item.description || null });
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
        dropped.push({ name: picked.name, rarity: picked.rarity || "common", price: picked.price ?? null, type: picked.type || null, description: picked.description || null });
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
    header.innerHTML = `<iconify-icon icon="game-icons:skull" class="loot-skull"></iconify-icon> ${escHtml(entry.enemyName)}`;
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
        coinRow.innerHTML = `<iconify-icon icon="game-icons:coins"></iconify-icon> ${coinStr}`;
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
          const users = Object.entries(window._allUsers || {})
            .map(([uid, u]) => ({ uid, ...u }))
            .sort((a, b) => (a.username || "").localeCompare(b.username || ""));
          if (!users.length) {
            dropdown.innerHTML = `<span class="loot-give-empty">No players found</span>`;
          } else {
            dropdown.innerHTML = users.map(u =>
              `<button class="loot-give-player" data-id="${escHtml(u.uid)}" style="--pc:${u.color || '#888'}">
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
                    rarity:      item.rarity || null,
                  });
                  dropdown.innerHTML = `<span class="loot-give-ok"><iconify-icon icon="lucide:check"></iconify-icon> Sent to ${escHtml((window._allUsers || {})[btn.dataset.id]?.username || "player")}</span>`;
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

// ── D&D 5e Creature Import ────────────────────────────────────────────────────
function _fmtCR(cr) {
  if (cr === 0)     return "0";
  if (cr === 0.125) return "1/8";
  if (cr === 0.25)  return "1/4";
  if (cr === 0.5)   return "1/2";
  return String(cr);
}

const btnImportCreatures = document.getElementById("btn-import-dnd5e-creatures");
const creatureImportProgress = document.getElementById("creature-import-progress");
const creatureProgressFill   = document.getElementById("creature-progress-fill");
const creatureProgressLabel  = document.getElementById("creature-progress-label");

if (btnImportCreatures) {
  btnImportCreatures.addEventListener("click", async () => {
    if (!window._saveEnemyTemplate) {
      alert("No campaign selected — open a campaign first.");
      return;
    }
    if (!confirm(
      "Import all 334 D&D 5e monsters as enemy templates?\n" +
      "Custom templates you created will be preserved.\n\n" +
      "Takes ~30 seconds. Continue?"
    )) return;

    btnImportCreatures.disabled = true;
    creatureImportProgress.style.display = "block";
    creatureProgressFill.style.width = "0%";
    creatureProgressLabel.textContent = "Fetching monster list…";

    try {
      const listRes = await fetch("https://www.dnd5eapi.co/api/monsters").then(r => r.json());
      const list    = listRes.results || [];
      const total   = list.length;

      // Preserve custom templates (builtin: false or undefined)
      const customNames = new Set(
        (window._enemyTemplates || [])
          .filter(t => !t.builtin)
          .map(t => t.name.toLowerCase())
      );

      // Remove old preset_ builtin templates to avoid duplicates
      const oldBuiltins = (window._enemyTemplates || []).filter(t => t.builtin && t.id.startsWith("preset_"));
      await Promise.all(oldBuiltins.map(t => window._deleteEnemyTemplate?.(t.id)));

      const BATCH = 20;
      let done = 0;

      for (let i = 0; i < list.length; i += BATCH) {
        const chunk   = list.slice(i, i + BATCH);
        const monsters = await Promise.all(
          chunk.map(m => fetch(`https://www.dnd5eapi.co${m.url}`).then(r => r.json()))
        );

        await Promise.all(monsters.map(m => {
          if (customNames.has(m.name.toLowerCase())) return Promise.resolve();
          const ac      = Array.isArray(m.armor_class) ? (m.armor_class[0]?.value ?? 10) : (m.armor_class || 10);
          const initMod = Math.floor(((m.dexterity || 10) - 10) / 2);

          // Full stat block
          const stats = {
            str: m.strength    || 10,
            dex: m.dexterity   || 10,
            con: m.constitution|| 10,
            int: m.intelligence|| 10,
            wis: m.wisdom      || 10,
            cha: m.charisma    || 10,
          };

          // Attacks from actions that have an attack roll or damage
          const attacks = (m.actions || [])
            .filter(a => a.attack_bonus != null || (a.damage && a.damage.length))
            .slice(0, 8)
            .map(a => ({
              name:   a.name,
              hit:    a.attack_bonus != null ? `+${a.attack_bonus} to hit` : "",
              damage: (a.damage || [])
                .map(d => `${d.damage_dice || ""} ${d.damage_type?.name || ""}`.trim())
                .filter(Boolean).join(" + "),
            }));

          // Speed
          const speedParts = m.speed ? Object.entries(m.speed)
            .map(([k, v]) => k === "walk" ? v : `${k} ${v}`) : [];
          const speed = speedParts.join(", ") || null;

          // Condition immunities
          const condImm = (m.condition_immunities || []).map(c => c.name).join(", ") || null;

          return window._saveEnemyTemplate({
            id:        "dnd5e_" + m.index,
            name:      m.name,
            hp:        m.hit_points,
            ac,
            initMod,
            cr:        _fmtCR(m.challenge_rating),
            speed,
            notes:     m.type ? `${m.type}${m.subtype ? ` (${m.subtype})` : ""}` : null,
            stats,
            attacks,
            condImm,
            languages: m.languages || null,
            builtin:   true,
            loot:      { gpMin: 0, gpMax: 0, itemsMin: 0, itemsMax: 0 },
            lootItems: [],
          });
        }));

        done += chunk.length;
        const pct = Math.round(done / total * 100);
        creatureProgressFill.style.width = pct + "%";
        creatureProgressLabel.textContent = `Importing… ${done}/${total} (${pct}%)`;
      }

      creatureProgressLabel.textContent = `Done! Imported ${total} monsters.`;
      btnImportCreatures.style.display = "none";
      setTimeout(() => { creatureImportProgress.style.display = "none"; }, 3000);

    } catch (err) {
      creatureProgressLabel.textContent = "Error: " + err.message;
      creatureProgressFill.style.background = "#c62828";
      setTimeout(() => { creatureImportProgress.style.display = "none"; btnImportCreatures.disabled = false; }, 4000);
    }
  });
}

