'use strict';
import { db }                              from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();
const questsRef  = ref(db, "quests");
const markersRef = ref(db, "markers");

// ── Monster preset list (mirrored from combat.js) ─────────────────────────────
const MONSTER_PRESETS = [
  { name: "Bandit",           ac: 12, hp: 11,  cr: "1/8"  },
  { name: "Bandit Captain",   ac: 15, hp: 65,  cr: "2"    },
  { name: "Cultist",          ac: 12, hp: 9,   cr: "1/8"  },
  { name: "Cult Fanatic",     ac: 13, hp: 33,  cr: "2"    },
  { name: "Guard",            ac: 16, hp: 11,  cr: "1/8"  },
  { name: "Knight",           ac: 18, hp: 52,  cr: "3"    },
  { name: "Gladiator",        ac: 16, hp: 112, cr: "5"    },
  { name: "Veteran",          ac: 17, hp: 58,  cr: "3"    },
  { name: "Mage",             ac: 12, hp: 40,  cr: "6"    },
  { name: "Archmage",         ac: 12, hp: 99,  cr: "12"   },
  { name: "Spy",              ac: 12, hp: 27,  cr: "1"    },
  { name: "Assassin",         ac: 15, hp: 78,  cr: "8"    },
  { name: "Thug",             ac: 11, hp: 32,  cr: "1/2"  },
  { name: "Berserker",        ac: 13, hp: 67,  cr: "2"    },
  { name: "Scout",            ac: 13, hp: 16,  cr: "1/2"  },
  { name: "Goblin",           ac: 15, hp: 7,   cr: "1/4"  },
  { name: "Hobgoblin",        ac: 18, hp: 11,  cr: "1/2"  },
  { name: "Bugbear",          ac: 16, hp: 27,  cr: "1"    },
  { name: "Bugbear Chief",    ac: 17, hp: 65,  cr: "3"    },
  { name: "Goblin Boss",      ac: 17, hp: 21,  cr: "1"    },
  { name: "Orc",              ac: 13, hp: 15,  cr: "1/2"  },
  { name: "Orc War Chief",    ac: 16, hp: 93,  cr: "4"    },
  { name: "Half-Orc",         ac: 13, hp: 30,  cr: "1"    },
  { name: "Ogre",             ac: 11, hp: 59,  cr: "2"    },
  { name: "Troll",            ac: 15, hp: 84,  cr: "5"    },
  { name: "Hill Giant",       ac: 13, hp: 105, cr: "5"    },
  { name: "Stone Giant",      ac: 17, hp: 126, cr: "7"    },
  { name: "Frost Giant",      ac: 15, hp: 138, cr: "8"    },
  { name: "Fire Giant",       ac: 18, hp: 162, cr: "9"    },
  { name: "Skeleton",         ac: 13, hp: 13,  cr: "1/4"  },
  { name: "Zombie",           ac: 8,  hp: 22,  cr: "1/4"  },
  { name: "Ghoul",            ac: 12, hp: 22,  cr: "1"    },
  { name: "Ghast",            ac: 13, hp: 36,  cr: "2"    },
  { name: "Shadow",           ac: 12, hp: 16,  cr: "1/2"  },
  { name: "Wight",            ac: 14, hp: 45,  cr: "3"    },
  { name: "Wraith",           ac: 13, hp: 67,  cr: "5"    },
  { name: "Specter",          ac: 12, hp: 22,  cr: "1"    },
  { name: "Vampire",          ac: 16, hp: 144, cr: "13"   },
  { name: "Vampire Spawn",    ac: 15, hp: 82,  cr: "5"    },
  { name: "Lich",             ac: 17, hp: 135, cr: "21"   },
  { name: "Wolf",             ac: 13, hp: 11,  cr: "1/4"  },
  { name: "Dire Wolf",        ac: 14, hp: 37,  cr: "1"    },
  { name: "Brown Bear",       ac: 11, hp: 34,  cr: "1"    },
  { name: "Lion",             ac: 12, hp: 26,  cr: "1"    },
  { name: "Tiger",            ac: 12, hp: 37,  cr: "1"    },
  { name: "Giant Spider",     ac: 14, hp: 26,  cr: "1"    },
  { name: "Crocodile",        ac: 12, hp: 19,  cr: "1/2"  },
  { name: "Giant Crocodile",  ac: 14, hp: 114, cr: "5"    },
  { name: "Kobold",           ac: 12, hp: 5,   cr: "1/8"  },
  { name: "Gnoll",            ac: 15, hp: 22,  cr: "1/2"  },
  { name: "Lizardfolk",       ac: 15, hp: 22,  cr: "1/2"  },
  { name: "Harpy",            ac: 11, hp: 38,  cr: "1"    },
  { name: "Minotaur",         ac: 14, hp: 76,  cr: "3"    },
  { name: "Basilisk",         ac: 15, hp: 52,  cr: "3"    },
  { name: "Manticore",        ac: 14, hp: 68,  cr: "3"    },
  { name: "Werewolf",         ac: 11, hp: 58,  cr: "3"    },
  { name: "Medusa",           ac: 15, hp: 127, cr: "6"    },
  { name: "Wyvern",           ac: 13, hp: 110, cr: "6"    },
  { name: "Doppelganger",     ac: 14, hp: 52,  cr: "3"    },
  { name: "Gargoyle",         ac: 15, hp: 52,  cr: "2"    },
  { name: "Owlbear",          ac: 13, hp: 59,  cr: "3"    },
  { name: "Displacer Beast",  ac: 13, hp: 85,  cr: "3"    },
  { name: "Beholder",         ac: 18, hp: 180, cr: "13"   },
  { name: "Mind Flayer",      ac: 15, hp: 71,  cr: "7"    },
  { name: "Drow",             ac: 15, hp: 13,  cr: "1/4"  },
  { name: "Drow Elite Warrior",ac: 18, hp: 71, cr: "5"    },
  { name: "Drow Mage",        ac: 12, hp: 45,  cr: "7"    },
  { name: "Imp",              ac: 13, hp: 10,  cr: "1"    },
  { name: "Hell Hound",       ac: 15, hp: 45,  cr: "3"    },
  { name: "Bearded Devil",    ac: 13, hp: 52,  cr: "3"    },
  { name: "Balor",            ac: 19, hp: 262, cr: "19"   },
  { name: "Dragon Wyrmling (Black)", ac: 17, hp: 33,  cr: "2"  },
  { name: "Dragon Wyrmling (Red)",   ac: 17, hp: 75,  cr: "4"  },
  { name: "Young Black Dragon",  ac: 18, hp: 127, cr: "7"  },
  { name: "Young Blue Dragon",   ac: 18, hp: 152, cr: "9"  },
  { name: "Young Red Dragon",    ac: 18, hp: 178, cr: "10" },
  { name: "Adult Black Dragon",  ac: 19, hp: 195, cr: "14" },
  { name: "Adult Blue Dragon",   ac: 19, hp: 225, cr: "16" },
  { name: "Adult Red Dragon",    ac: 19, hp: 256, cr: "17" },
];

// ── State ─────────────────────────────────────────────────────────────────────
let quests        = [];
let markerNames   = [];
let activeFilter  = "all";
let editingId     = null;
let currentBlocks = [];

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const questGrid      = document.getElementById("quest-grid");
const questEmpty     = document.getElementById("quest-empty");
const questModal     = document.getElementById("quest-modal");
const qmTitle        = document.getElementById("qm-title");
const qmName         = document.getElementById("qm-name");
const qmLocationInp  = document.getElementById("qm-location");
const qmLocationDrop = document.getElementById("qm-location-drop");
const qmStatus       = document.getElementById("qm-status");
const qmDiscovered   = document.getElementById("qm-discovered");
const qmError        = document.getElementById("qm-error");
const qmSave         = document.getElementById("qm-save");
const qmCancel       = document.getElementById("qm-cancel");
const qmBlockCanvas  = document.getElementById("qm-block-canvas");
const qmTypeSelector = document.getElementById("qm-type-selector");

let selectedType = "main";

// ── Firebase: quests ──────────────────────────────────────────────────────────
onValue(questsRef, snapshot => {
  const data = snapshot.val();
  quests = data ? Object.values(data) : [];
  renderGrid();
});

// ── Firebase: markers ─────────────────────────────────────────────────────────
onValue(markersRef, snapshot => {
  const data = snapshot.val();
  markerNames = data
    ? Object.values(data).map(m => ({ id: m.id, name: m.name || "" })).filter(m => m.name)
    : [];
});

// ── Location autocomplete ─────────────────────────────────────────────────────
qmLocationInp.addEventListener("input", () => {
  const q = qmLocationInp.value.trim().toLowerCase();
  if (!q) { hideDrop(qmLocationDrop); return; }
  const matches = markerNames.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { hideDrop(qmLocationDrop); return; }
  qmLocationDrop.innerHTML = matches
    .map(m => `<div class="loc-drop-item" tabindex="0" data-name="${esc(m.name)}">${esc(m.name)}</div>`)
    .join("");
  qmLocationDrop.style.display = "block";
});
qmLocationInp.addEventListener("keydown", e => {
  if (e.key === "Escape") hideDrop(qmLocationDrop);
  if (e.key === "ArrowDown") { e.preventDefault(); qmLocationDrop.querySelector(".loc-drop-item")?.focus(); }
});
qmLocationDrop.addEventListener("mousedown", e => {
  const item = e.target.closest(".loc-drop-item");
  if (!item) return; e.preventDefault();
  qmLocationInp.value = item.dataset.name; hideDrop(qmLocationDrop);
});
qmLocationDrop.addEventListener("keydown", e => {
  if (e.key === "Enter") { qmLocationInp.value = document.activeElement.dataset.name || ""; hideDrop(qmLocationDrop); }
  if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
  if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || qmLocationInp).focus(); }
  if (e.key === "Escape") hideDrop(qmLocationDrop);
});
qmLocationInp.addEventListener("blur", () => setTimeout(() => hideDrop(qmLocationDrop), 150));

function hideDrop(el) { if (el) el.style.display = "none"; }

// ── Filter tabs ───────────────────────────────────────────────────────────────
document.querySelectorAll(".quest-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".quest-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderGrid();
  });
});

// ── Add Quest button ──────────────────────────────────────────────────────────
const questAddBtn = document.getElementById("quest-add-btn");
if (isAdmin) {
  questAddBtn.style.display = "inline-flex";
  questAddBtn.addEventListener("click", () => openModal(null));
}

// ── Page state memory (scroll + open quests) ─────────────────────────────────
const PAGE_STATE_KEY = "questPageState";

function loadPageState() {
  try { return JSON.parse(sessionStorage.getItem(PAGE_STATE_KEY)) || {}; } catch { return {}; }
}
function savePageState(patch) {
  const s = loadPageState();
  sessionStorage.setItem(PAGE_STATE_KEY, JSON.stringify({ ...s, ...patch }));
}

// Debounced scroll save
let _scrollTimer = null;
window.addEventListener("scroll", () => {
  clearTimeout(_scrollTimer);
  _scrollTimer = setTimeout(() => savePageState({ scrollY: window.scrollY }), 150);
}, { passive: true });

// ── Render grid ───────────────────────────────────────────────────────────────
function renderGrid() {
  questGrid.innerHTML = "";
  const visible = quests.filter(q => {
    if (!isAdmin && !q.discovered) return false;
    if (activeFilter === "all")       return true;
    if (activeFilter === "main")      return q.type === "main";
    if (activeFilter === "side")      return q.type === "side";
    if (activeFilter === "active")    return q.status === "active";
    if (activeFilter === "completed") return q.status === "completed";
    return true;
  });
  const statusOrder = { active: 0, not_started: 1, completed: 2 };
  // Sort by explicit order first; fall back to status then title for unordered quests
  visible.sort((a, b) => {
    const ao = a.order ?? 9999, bo = b.order ?? 9999;
    if (ao !== bo) return ao - bo;
    const so = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    return so !== 0 ? so : (a.title || "").localeCompare(b.title || "");
  });

  questEmpty.style.display = visible.length === 0 ? "block" : "none";
  visible.forEach(q => questGrid.appendChild(buildCard(q)));

  // Restore scroll position after DOM settles
  const state = loadPageState();
  if (state.scrollY) requestAnimationFrame(() => window.scrollTo({ top: state.scrollY, behavior: "instant" }));
}

// ── Quest card ────────────────────────────────────────────────────────────────
const STATUS_LABEL = { active: "Active", not_started: "Not Started", completed: "Completed" };
const STATUS_CLASS = { active: "status-active", not_started: "status-pending", completed: "status-done" };

function buildCard(q) {
  const state = loadPageState();
  const openQuests = new Set(state.openQuests || []);
  const startOpen = openQuests.has(q.id);

  const card = document.createElement("div");
  card.className = `quest-card quest-${q.type || "main"}${q.status === "completed" ? " quest-completed" : ""}${startOpen ? "" : " qc-folded"}`;
  card.dataset.questId = q.id;
  const blocks = q.blocks || [];

  // Build the grid canvas for card view — explicit placement matches editor layout
  const gridCells = blocks.map(b => renderBlockInCard(b)).filter(Boolean).join("");

  // Card grid: use explicit row/col placement so the layout matches the editor
  autoPlaceBlocks(blocks);
  const maxBlockRow = blocks.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0);

  card.innerHTML = `
    <div class="qc-accent-bar"></div>
    <div class="qc-body">
      <div class="qc-header-row">
        ${isAdmin ? `<div class="qc-drag-handle" title="Drag to reorder quests">&#8942;&#8942;</div>` : ""}
        <button class="qc-fold-btn" title="Collapse/Expand">${startOpen ? "&#9660;" : "&#9654;"}</button>
        <div class="qc-top-row">
          <span class="qc-type-badge">${q.type === "main" ? "Main Quest" : "Side Quest"}</span>
          <span class="qc-status ${STATUS_CLASS[q.status] || ""}">${STATUS_LABEL[q.status] || "Unknown"}</span>
          ${isAdmin && !q.discovered ? `<span class="qc-hidden-badge">&#128065; DM Only</span>` : ""}
        </div>
        <h3 class="qc-title">${esc(q.title || "")}</h3>
        ${q.location ? `<div class="qc-location">&#128205; ${esc(q.location)}</div>` : ""}
      </div>
      <div class="qc-content">
        ${gridCells ? `<div class="qc-grid" style="grid-template-rows:repeat(${maxBlockRow},auto)">${gridCells}</div>` : ""}
      </div>
    </div>
    ${isAdmin ? `
      <div class="qc-actions">
        <button class="qc-btn qc-edit-btn" title="Edit">&#9998;</button>
        <button class="qc-btn qc-del-btn"  title="Delete">&#10005;</button>
      </div>` : ""}
  `;

  // Fold toggle — persists open/closed state across tab switches
  const foldBtn  = card.querySelector(".qc-fold-btn");
  const content  = card.querySelector(".qc-content");
  foldBtn.addEventListener("click", e => {
    e.stopPropagation();
    const folded = card.classList.toggle("qc-folded");
    foldBtn.innerHTML = folded ? "&#9654;" : "&#9660;";
    // Persist which quests are open
    const st = loadPageState();
    const openSet = new Set(st.openQuests || []);
    if (folded) openSet.delete(q.id); else openSet.add(q.id);
    savePageState({ openQuests: [...openSet] });
  });

  // Phase expand inside card
  card.querySelectorAll(".qc-phase-toggle").forEach(btn => {
    const body = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      const open = btn.dataset.open === "true";
      btn.dataset.open = String(!open);
      body.style.display = open ? "none" : "block";
      btn.querySelector(".toggle-arrow").textContent = open ? "▶" : "▼";
    });
  });

  if (isAdmin) {
    card.querySelector(".qc-edit-btn").addEventListener("click", e => { e.stopPropagation(); openModal(q); });
    card.querySelector(".qc-del-btn").addEventListener("click",  e => {
      e.stopPropagation();
      if (confirm(`Delete "${q.title}"?`)) remove(ref(db, `quests/${q.id}`));
    });
    initQuestCardDrag(card, q.id);
  }
  return card;
}

// ── Quest card drag-and-drop reordering ───────────────────────────────────────
let questDragSrcId   = null;
let questDragOverEl  = null;

function initQuestCardDrag(card, questId) {
  const handle = card.querySelector(".qc-drag-handle");
  if (!handle) return;
  handle.draggable = true;

  handle.addEventListener("dragstart", e => {
    questDragSrcId = questId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", questId);
    requestAnimationFrame(() => card.classList.add("qc-dragging"));
  });
  handle.addEventListener("dragend", () => {
    card.classList.remove("qc-dragging");
    if (questDragOverEl) { questDragOverEl.classList.remove("qc-drag-over"); questDragOverEl = null; }
    questDragSrcId = null;
  });

  card.addEventListener("dragover", e => {
    if (!questDragSrcId || questDragSrcId === questId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (questDragOverEl !== card) {
      if (questDragOverEl) questDragOverEl.classList.remove("qc-drag-over");
      card.classList.add("qc-drag-over");
      questDragOverEl = card;
    }
  });
  card.addEventListener("dragleave", e => {
    if (!card.contains(e.relatedTarget)) {
      card.classList.remove("qc-drag-over");
      if (questDragOverEl === card) questDragOverEl = null;
    }
  });
  card.addEventListener("drop", e => {
    e.preventDefault();
    card.classList.remove("qc-drag-over");
    questDragOverEl = null;
    if (questDragSrcId && questDragSrcId !== questId) {
      reorderQuests(questDragSrcId, questId);
    }
    questDragSrcId = null;
  });
}

function reorderQuests(srcId, targetId) {
  // Get the current visible ordered list from the DOM
  const cards = [...questGrid.querySelectorAll(".quest-card")];
  const ids = cards.map(c => c.dataset.questId).filter(Boolean);
  const srcIdx = ids.indexOf(srcId);
  const tgtIdx = ids.indexOf(targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  // Move srcId before targetId
  ids.splice(srcIdx, 1);
  ids.splice(tgtIdx, 0, srcId);
  // Write new order values to Firebase
  ids.forEach((id, i) => set(ref(db, `quests/${id}/order`), i));
}

function renderBlockInCard(b) {
  const span    = b.span    || 1;
  const rowSpan = b.rowSpan || 1;
  const colStyle = b.col ? `grid-column:${b.col}/span ${span};` : `grid-column:span ${span};`;
  const rowStyle = b.row ? `grid-row:${b.row}/span ${rowSpan};` : "";
  const spanStyle = colStyle + rowStyle;
  const titleStyle = b.titleColor ? `color:${esc(b.titleColor)}` : "";
  const titleHtml = b.blockTitle
    ? `<div class="qcb-block-title" style="${titleStyle}">${esc(b.blockTitle)}</div>`
    : "";

  switch (b.type) {
    case "text":
      if (!b.content) return "";
      return `<div class="qcb-cell qcb-cell-text" style="${spanStyle}">${titleHtml}<p class="qcb-text">${esc(b.content)}</p></div>`;

    case "phase":
      return `<div class="qcb-cell qcb-cell-phase" style="${spanStyle}">${titleHtml}
        <button class="qc-phase-toggle" data-open="false">
          <span class="toggle-arrow">▶</span>
          <span class="phase-label">${esc(b.title || "Phase")}</span>
        </button>
        <div class="qc-phase-body" style="display:none">
          ${b.description ? `<p class="qcb-phase-desc">${esc(b.description)}</p>` : ""}
        </div>
      </div>`;

    case "loot":
      if (!b.name) return "";
      return `<div class="qcb-cell qcb-cell-loot" style="${spanStyle}">${titleHtml}
        <div class="qcb-loot">
          <span class="qcb-loot-icon">&#127873;</span>
          <span class="qcb-loot-name">${esc(b.name)}</span>
          ${b.value ? `<span class="qcb-loot-value">${esc(b.value)}</span>` : ""}
          ${b.description ? `<span class="qcb-loot-desc">${esc(b.description)}</span>` : ""}
        </div>
      </div>`;

    case "boss":
      if (!b.name) return "";
      return `<div class="qcb-cell qcb-cell-boss" style="${spanStyle}">${titleHtml}
        <div class="qcb-boss-header">
          <span class="qcb-boss-icon">&#9760;</span>
          <span class="qcb-boss-name">${esc(b.name)}</span>
          ${b.cr ? `<span class="qcb-boss-stat">CR ${esc(b.cr)}</span>` : ""}
          ${b.ac ? `<span class="qcb-boss-stat">AC ${esc(b.ac)}</span>` : ""}
          ${b.hp ? `<span class="qcb-boss-stat">HP ${esc(b.hp)}</span>` : ""}
        </div>
        ${b.notes ? `<p class="qcb-boss-notes">${esc(b.notes)}</p>` : ""}
      </div>`;

    case "note":
      if (!isAdmin || !b.content) return "";
      return `<div class="qcb-cell qcb-cell-note" style="${spanStyle}">${titleHtml}<div class="qcb-note">&#128196; ${esc(b.content)}</div></div>`;

    case "puzzle":
      if (!b.description && !b.title) return "";
      return `<div class="qcb-cell qcb-cell-puzzle" style="${spanStyle}">${titleHtml}
        <div class="qcb-puzzle-header"><span class="qcb-puzzle-icon">&#129513;</span><span class="qcb-puzzle-name">${esc(b.title || "Puzzle")}</span></div>
        ${b.description ? `<p class="qcb-puzzle-desc">${esc(b.description)}</p>` : ""}
        ${b.hint ? `<div class="qcb-puzzle-hint">&#128161; ${esc(b.hint)}</div>` : ""}
        ${isAdmin && b.solution ? `<div class="qcb-puzzle-solution">&#128273; ${esc(b.solution)}</div>` : ""}
      </div>`;

    case "divider":
      return `<div class="qcb-cell" style="${spanStyle}"><div class="qcb-divider"></div></div>`;

    default:
      return "";
  }
}

// ── Modal open/close ──────────────────────────────────────────────────────────
function openModal(q) {
  editingId    = q ? q.id : null;
  selectedType = q ? (q.type || "main") : "main";
  if (q && q.blocks) {
    currentBlocks = q.blocks.map(b => ({ ...b }));
  } else if (q && q.phases) {
    currentBlocks = q.phases.map(p => ({ type: "phase", title: p.title || "", description: p.description || "", span: 1 }));
  } else {
    currentBlocks = [];
  }
  qmTitle.textContent  = q ? "Edit Quest" : "New Quest";
  qmName.value         = q ? (q.title    || "") : "";
  qmLocationInp.value  = q ? (q.location || "") : "";
  qmStatus.value       = q ? (q.status   || "not_started") : "not_started";
  qmDiscovered.checked = q ? (q.discovered === true) : false;
  qmError.textContent  = "";
  syncTypeBtns();
  buildBlocksEditor();
  questModal.classList.add("open");
  qmName.focus();
}

function closeModal() {
  questModal.classList.remove("open");
  editingId = null; currentBlocks = [];
  hideDrop(qmLocationDrop);
}

qmCancel.addEventListener("click", closeModal);
questModal.addEventListener("click", e => { if (e.target === questModal) closeModal(); });
qmSave.addEventListener("click", async () => {
  const title = qmName.value.trim();
  if (!title) { qmError.textContent = "Title is required."; return; }
  qmError.textContent = "";
  const payload = {
    id:         editingId || push(questsRef).key,
    title,
    type:       selectedType,
    location:   qmLocationInp.value.trim() || null,
    status:     qmStatus.value,
    blocks:     currentBlocks.length > 0 ? currentBlocks : null,
    discovered: qmDiscovered.checked,
  };
  await set(ref(db, `quests/${payload.id}`), payload);
  closeModal();
});

// ── Type buttons ──────────────────────────────────────────────────────────────
qmTypeSelector.querySelectorAll(".quest-type-btn").forEach(btn => {
  btn.addEventListener("click", () => { selectedType = btn.dataset.type; syncTypeBtns(); });
});
function syncTypeBtns() {
  qmTypeSelector.querySelectorAll(".quest-type-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.type === selectedType);
  });
}

// ── Block defaults (module scope for palette drag) ────────────────────────────
const BLOCK_DEFAULTS = {
  text:    { type: "text",    content: "",     blockTitle: "", titleColor: "", span: 2, rowSpan: 1 },
  phase:   { type: "phase",   title: "",   description: "", blockTitle: "", titleColor: "", span: 1, rowSpan: 1 },
  loot:    { type: "loot",    name: "",    description: "", value: "", blockTitle: "", titleColor: "", span: 1, rowSpan: 1 },
  boss:    { type: "boss",    name: "",    ac: "", hp: "", cr: "", notes: "", blockTitle: "", titleColor: "", span: 2, rowSpan: 1 },
  note:    { type: "note",    content: "", blockTitle: "", titleColor: "", span: 2, rowSpan: 1 },
  puzzle:  { type: "puzzle",  title: "",   description: "", hint: "", solution: "", blockTitle: "", titleColor: "", span: 2, rowSpan: 1 },
  divider: { type: "divider", span: 4, rowSpan: 1 },
};

// ── Block palette ─────────────────────────────────────────────────────────────
document.querySelectorAll(".qm-add-block-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentBlocks.push({ ...BLOCK_DEFAULTS[btn.dataset.blockType] });
    buildBlocksEditor();
    setTimeout(() => qmBlockCanvas.querySelector(".qm-block:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  });
  btn.draggable = true;
  btn.addEventListener("dragstart", e => {
    dragPaletteType = btn.dataset.blockType;
    dragSrcIndex = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", btn.dataset.blockType);
  });
  btn.addEventListener("dragend", () => { dragPaletteType = null; });
});

// ── Block drag state ──────────────────────────────────────────────────────────
let dragSrcIndex = null;
let dragPaletteType = null;

function clearDragHighlights() {
  qmBlockCanvas.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
}

// Drop target: moves an existing block or places a new palette block at (row, col)
function attachDropTarget(el, targetRow, targetCol) {
  el.addEventListener("dragover", e => {
    if (dragSrcIndex === null && dragPaletteType === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragPaletteType ? "copy" : "move";
    clearDragHighlights();
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove("drag-over");
  });
  el.addEventListener("drop", e => {
    e.preventDefault();
    clearDragHighlights();
    if (dragSrcIndex !== null) {
      const b = currentBlocks[dragSrcIndex];
      b.row = targetRow;
      b.col = targetCol;
      if (b.col + (b.span || 1) - 1 > 4) b.span = 5 - b.col;
      dragSrcIndex = null;
      buildBlocksEditor();
    } else if (dragPaletteType !== null) {
      const newBlock = { ...BLOCK_DEFAULTS[dragPaletteType], row: targetRow, col: targetCol };
      if (newBlock.col + (newBlock.span || 1) - 1 > 4) newBlock.span = 5 - newBlock.col;
      currentBlocks.push(newBlock);
      dragPaletteType = null;
      buildBlocksEditor();
    }
  });
}

// ── Auto-place blocks that have no explicit row/col ───────────────────────────
function autoPlaceBlocks(blocks) {
  const occupied = new Set();
  blocks.forEach(b => {
    if (!b.row || !b.col) return;
    const span    = Math.min(b.span    || 1, 4);
    const rowSpan = b.rowSpan || 1;
    for (let r = b.row; r < b.row + rowSpan; r++)
      for (let c = b.col; c < b.col + span; c++) occupied.add(`${r},${c}`);
  });

  let curRow = 1, curCol = 1;

  blocks.forEach(b => {
    if (b.row && b.col) return;
    const span = Math.min(b.span || 1, 4);
    while (true) {
      if (curCol + span - 1 > 4) { curRow++; curCol = 1; }
      let fits = true;
      for (let c = curCol; c < curCol + span; c++) {
        if (occupied.has(`${curRow},${c}`)) { fits = false; break; }
      }
      if (fits) break;
      curCol++;
    }
    b.row = curRow; b.col = curCol;
    const rowSpan = b.rowSpan || 1;
    for (let r = b.row; r < b.row + rowSpan; r++)
      for (let c = curCol; c < curCol + span; c++) occupied.add(`${r},${c}`);
    curCol += span;
    if (curCol > 4) { curRow++; curCol = 1; }
  });
}

// ── Build block editor ────────────────────────────────────────────────────────
function buildBlocksEditor() {
  qmBlockCanvas.innerHTML = "";

  autoPlaceBlocks(currentBlocks);

  // Determine grid size: at least 6 rows, 2 extra below the last block
  const maxRow = currentBlocks.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0);
  const numRows = Math.max(6, maxRow + 2);
  qmBlockCanvas.style.gridTemplateRows = `repeat(${numRows}, auto)`;

  if (currentBlocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "qm-canvas-empty";
    empty.style.cssText = "grid-row:1; grid-column:1/span 4;";
    empty.textContent = "Use the buttons above to add content blocks — then drag ⠿⠿ to any empty cell.";
    qmBlockCanvas.appendChild(empty);
  }

  // Build occupancy map for ghost rendering
  const occupied = new Set();
  currentBlocks.forEach(b => {
    const span    = Math.min(b.span    || 1, 4);
    const rowSpan = b.rowSpan || 1;
    for (let r = b.row; r < b.row + rowSpan; r++)
      for (let c = b.col; c < b.col + span; c++) occupied.add(`${r},${c}`);
  });

  // Render ghost (drop-target) cells for every unoccupied position
  for (let r = 1; r <= numRows; r++) {
    for (let c = 1; c <= 4; c++) {
      if (occupied.has(`${r},${c}`)) continue;
      const ghost = document.createElement("div");
      ghost.className = "qm-ghost-cell";
      ghost.style.gridRow = r;
      ghost.style.gridColumn = c;
      attachDropTarget(ghost, r, c);
      qmBlockCanvas.appendChild(ghost);
    }
  }

  // Render blocks at their explicit grid positions
  currentBlocks.forEach((block, i) => {
    const wrap = document.createElement("div");
    wrap.className = `qm-block qm-block-${block.type}`;
    wrap.dataset.index = i;
    wrap.style.gridRow = `${block.row} / span ${block.rowSpan || 1}`;
    wrap.style.gridColumn = `${block.col} / span ${block.span || 1}`;
    wrap.innerHTML = buildBlockEditorHtml(block, i);

    // Handle-only drag source
    const handle = wrap.querySelector(".blk-drag-handle");
    if (handle) {
      handle.draggable = true;
      handle.addEventListener("dragstart", e => {
        dragSrcIndex = i;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
        requestAnimationFrame(() => wrap.classList.add("dragging"));
      });
      handle.addEventListener("dragend", () => {
        wrap.classList.remove("dragging");
        clearDragHighlights();
        dragSrcIndex = null;
      });
    }

    // Controls
    wrap.querySelector(".blk-del")?.addEventListener("click", () => { currentBlocks.splice(i, 1); buildBlocksEditor(); });
    wrap.querySelectorAll(".blk-span-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newSpan = Number(btn.dataset.span);
        currentBlocks[i].span = newSpan;
        if (currentBlocks[i].col + newSpan - 1 > 4) currentBlocks[i].col = Math.max(1, 5 - newSpan);
        buildBlocksEditor();
      });
    });
    wrap.querySelectorAll(".blk-rowspan-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentBlocks[i].rowSpan = Number(btn.dataset.rowspan);
        buildBlocksEditor();
      });
    });

    // Inputs
    wireInput(wrap, block, "content",     "[data-f=content]");
    wireInput(wrap, block, "title",       "[data-f=title]");
    wireInput(wrap, block, "description", "[data-f=description]");
    wireInput(wrap, block, "name",        "[data-f=name]");
    wireInput(wrap, block, "value",       "[data-f=value]");
    wireInput(wrap, block, "ac",          "[data-f=ac]");
    wireInput(wrap, block, "hp",          "[data-f=hp]");
    wireInput(wrap, block, "cr",          "[data-f=cr]");
    wireInput(wrap, block, "notes",       "[data-f=notes]");
    wireInput(wrap, block, "hint",        "[data-f=hint]");
    wireInput(wrap, block, "solution",    "[data-f=solution]");
    wireInput(wrap, block, "blockTitle",  "[data-f=blockTitle]");
    wireInput(wrap, block, "titleColor",  "[data-f=titleColor]");

    // Boss creature search
    if (block.type === "boss") {
      const srch = wrap.querySelector(".boss-search-input");
      const drop = wrap.querySelector(".boss-search-drop");
      if (srch && drop) {
        srch.addEventListener("input", () => {
          const q = srch.value.trim().toLowerCase();
          if (!q) { hideDrop(drop); return; }
          const hits = MONSTER_PRESETS.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
          if (!hits.length) { hideDrop(drop); return; }
          drop.innerHTML = hits.map(m =>
            `<div class="loc-drop-item" tabindex="0"
              data-name="${esc(m.name)}" data-ac="${m.ac}" data-hp="${m.hp}" data-cr="${m.cr}">
              <span>${esc(m.name)}</span>
              <span class="boss-drop-meta">CR ${m.cr} · HP ${m.hp} · AC ${m.ac}</span>
            </div>`
          ).join("");
          drop.style.display = "block";
        });
        srch.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault();
          applyBossPreset(wrap, block, item.dataset);
          srch.value = ""; hideDrop(drop);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { applyBossPreset(wrap, block, document.activeElement.dataset); srch.value = ""; hideDrop(drop); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }
    }

    qmBlockCanvas.appendChild(wrap);
  });
}

function applyBossPreset(wrap, block, data) {
  block.name = data.name || ""; block.ac = String(data.ac || ""); block.hp = String(data.hp || ""); block.cr = String(data.cr || "");
  const nameInp = wrap.querySelector("[data-f=name]"); if (nameInp) nameInp.value = block.name;
  const acInp   = wrap.querySelector("[data-f=ac]");   if (acInp)   acInp.value   = block.ac;
  const hpInp   = wrap.querySelector("[data-f=hp]");   if (hpInp)   hpInp.value   = block.hp;
  const crInp   = wrap.querySelector("[data-f=cr]");   if (crInp)   crInp.value   = block.cr;
}

function wireInput(wrap, block, field, selector) {
  const el = wrap.querySelector(selector);
  if (el) el.addEventListener("input", () => { block[field] = el.value; });
}

function spanBtns(current) {
  return [1, 2, 4].map(s =>
    `<button type="button" class="blk-span-btn${current === s ? " active" : ""}" data-span="${s}" title="${s === 4 ? "Full width" : s + " col"}">${s === 4 ? "⇔" : s + "×"}</button>`
  ).join("");
}

function rowSpanBtns(current) {
  return [1, 2, 3].map(s =>
    `<button type="button" class="blk-rowspan-btn${current === s ? " active" : ""}" data-rowspan="${s}" title="${s} row${s > 1 ? "s" : ""}">${s}↕</button>`
  ).join("");
}

function buildBlockEditorHtml(b, i) {
  const span    = b.span    || 1;
  const rowSpan = b.rowSpan || 1;
  const controls = `
    <div class="blk-controls">
      <div class="blk-span-group">${spanBtns(span)}</div>
      <div class="blk-span-group">${rowSpanBtns(rowSpan)}</div>
      <div class="blk-drag-handle" title="Drag to reorder">⠿⠿</div>
      <button type="button" class="blk-ctrl blk-del" title="Remove">&#10005;</button>
    </div>`;

  // Title + color row shared by all block types
  const titleRow = b.type !== "divider" ? `
    <div class="blk-title-row">
      <input class="blk-input blk-title-input" type="text" data-f="blockTitle" placeholder="Block heading (optional)…" value="${esc(b.blockTitle || "")}" />
      <label class="blk-color-label" title="Heading color">
        <input class="blk-color-picker" type="color" data-f="titleColor" value="${b.titleColor || "#ffcc66"}" />
      </label>
    </div>` : "";

  switch (b.type) {
    case "text":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#182;</span><span class="blk-type-label">Text</span>${controls}</div>
        ${titleRow}
        <textarea class="blk-textarea" data-f="content" placeholder="Write something…" rows="4">${esc(b.content || "")}</textarea>`;

    case "phase":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#9654;</span><span class="blk-type-label">Phase</span>${controls}</div>
        ${titleRow}
        <input class="blk-input" type="text" data-f="title" placeholder="Phase title…" value="${esc(b.title || "")}" />
        <textarea class="blk-textarea" data-f="description" placeholder="What happens in this phase…" rows="3">${esc(b.description || "")}</textarea>`;

    case "loot":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#127873;</span><span class="blk-type-label">Loot</span>${controls}</div>
        ${titleRow}
        <div class="blk-row">
          <input class="blk-input" type="text" data-f="name"  placeholder="Item name…"   value="${esc(b.name  || "")}" />
          <input class="blk-input blk-input-sm" type="text" data-f="value" placeholder="GP…" value="${esc(b.value || "")}" />
        </div>
        <textarea class="blk-textarea" data-f="description" placeholder="Description (optional)…" rows="2">${esc(b.description || "")}</textarea>`;

    case "boss":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#9760;</span><span class="blk-type-label">Boss / Enemy</span>${controls}</div>
        ${titleRow}
        <div class="boss-search-wrap">
          <input class="blk-input boss-search-input" type="text" placeholder="&#128269; Search creatures from combat tab…" autocomplete="off" />
          <div class="boss-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <input class="blk-input" type="text" data-f="name" placeholder="Creature name…" value="${esc(b.name || "")}" />
        <div class="blk-row">
          <input class="blk-input blk-input-sm" type="text" data-f="cr" placeholder="CR"  value="${esc(b.cr  || "")}" />
          <input class="blk-input blk-input-sm" type="text" data-f="ac" placeholder="AC"  value="${esc(b.ac  || "")}" />
          <input class="blk-input blk-input-sm" type="text" data-f="hp" placeholder="HP"  value="${esc(b.hp  || "")}" />
        </div>
        <textarea class="blk-textarea" data-f="notes" placeholder="Abilities, tactics, lore…" rows="3">${esc(b.notes || "")}</textarea>`;

    case "note":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#128196;</span><span class="blk-type-label">DM Note</span>${controls}</div>
        ${titleRow}
        <textarea class="blk-textarea blk-textarea-note" data-f="content" placeholder="Private DM notes…" rows="3">${esc(b.content || "")}</textarea>`;

    case "puzzle":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#129513;</span><span class="blk-type-label">Puzzle</span>${controls}</div>
        ${titleRow}
        <input class="blk-input" type="text" data-f="title" placeholder="Puzzle name…" value="${esc(b.title || "")}" />
        <textarea class="blk-textarea" data-f="description" placeholder="Describe the puzzle…" rows="3">${esc(b.description || "")}</textarea>
        <input class="blk-input" type="text" data-f="hint" placeholder="Hint (visible to players)…" value="${esc(b.hint || "")}" />
        <input class="blk-input blk-textarea-note" type="text" data-f="solution" placeholder="Solution (DM only)…" value="${esc(b.solution || "")}" />`;

    case "divider":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#8213;</span><span class="blk-type-label">Divider</span>${controls}</div>
        <div class="blk-divider-preview"></div>`;

    default:
      return "";
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
