'use strict';
import { db }                              from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { formatGold }                      from "./item-utils.js";

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
let quests          = [];
let markerNames     = [];
let activeFilter    = "all";
let editingId         = null;
let currentBlocks     = [];
let currentCellColors = {};   // "row,col" -> "#hexcolor"
let firebaseTemplates = [];   // enemy templates from Firebase
let allItems          = [];   // items from Firebase items tab
let allLoreItems      = [];   // lore items from Firebase lore tab
let allCharacters     = [];   // characters from Firebase characters tab

// ── Cell color selection state ────────────────────────────────────────────────
let isPaintMode     = false;
let isColorSelecting = false;
let selAnchor       = null;   // {row, col}
let selCursor       = null;   // {row, col}

// ── Undo / redo / autosave state ──────────────────────────────────────────────
const UNDO_LIMIT     = 80;
let undoStack        = [];
let redoStack        = [];
let isApplyingSnap   = false;      // suppress pushUndo during restore
let autosaveTimer    = null;
let autosaveStatusTimer = null;
let draftKey         = null;       // set on openModal
let hasUnsavedChanges = false;
let isPlayerPreview  = false;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getSelRect() {
  if (!selAnchor || !selCursor) return null;
  return {
    r1: Math.min(selAnchor.row, selCursor.row), r2: Math.max(selAnchor.row, selCursor.row),
    c1: Math.min(selAnchor.col, selCursor.col), c2: Math.max(selAnchor.col, selCursor.col),
  };
}

function getSelectedKeys() {
  const rect = getSelRect();
  if (!rect) return new Set();
  const s = new Set();
  for (let r = rect.r1; r <= rect.r2; r++)
    for (let c = rect.c1; c <= rect.c2; c++) s.add(`${r},${c}`);
  return s;
}

function updateColorSelection() {
  const sel = getSelectedKeys();
  qmBlockCanvas.querySelectorAll("[data-row][data-col]").forEach(el => {
    el.classList.toggle("cell-sel", sel.has(`${el.dataset.row},${el.dataset.col}`));
  });
  const count = document.getElementById("qm-color-sel-count");
  if (count) count.textContent = sel.size ? `${sel.size} cell${sel.size > 1 ? "s" : ""} selected` : "";
}

function applyColorToSelection(color) {
  const sel = getSelectedKeys();
  if (!sel.size) return;
  sel.forEach(key => { if (color) currentCellColors[key] = color; else delete currentCellColors[key]; });
  selAnchor = selCursor = null;
  onEditTick();
  buildBlocksEditor();
}

function cellColorForBlock(block) {
  return currentCellColors[`${block.row},${block.col}`] || null;
}

onValue(ref(db, "enemyTemplates"), snap => {
  const data = snap.val();
  firebaseTemplates = data ? Object.values(data) : [];
});

onValue(ref(db, "items"), snap => {
  const data = snap.val();
  allItems = data ? Object.values(data) : [];
});

onValue(ref(db, "lore"), snap => {
  const data = snap.val();
  allLoreItems = data ? Object.values(data) : [];
});

onValue(ref(db, "characters"), snap => {
  const data = snap.val();
  allCharacters = data ? Object.values(data) : [];
});

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
const qmTypeSelector   = document.getElementById("qm-type-selector");
const qmPaintBtn       = document.getElementById("qm-paint-btn");
const qmColorToolbar   = document.getElementById("qm-color-toolbar");
const qmColorSelCount  = document.getElementById("qm-color-sel-count");
const qmUndoBtn        = document.getElementById("qm-undo-btn");
const qmRedoBtn        = document.getElementById("qm-redo-btn");
const qmAutosaveStatus = document.getElementById("qm-autosave-status");
const qmPreviewToggle  = document.getElementById("qm-preview-toggle");
const qmCanvasWrap     = document.querySelector(".qm-canvas-wrap");
const qmDraftBanner    = document.getElementById("qm-draft-banner");
const qmDraftTime      = document.getElementById("qm-draft-time");
const qmDraftRestore   = document.getElementById("qm-draft-restore");
const qmDraftDiscard   = document.getElementById("qm-draft-discard");

// Preview panel is appended into the canvas wrap dynamically
let qmPreviewPanel = null;
function ensurePreviewPanel() {
  if (qmPreviewPanel) return qmPreviewPanel;
  qmPreviewPanel = document.createElement("div");
  qmPreviewPanel.className = "qm-preview-panel";
  qmBlockCanvas.parentNode.appendChild(qmPreviewPanel);
  return qmPreviewPanel;
}

let selectedType = "main";

// ── Paint mode toggle ─────────────────────────────────────────────────────────
qmPaintBtn.addEventListener("click", () => {
  isPaintMode = !isPaintMode;
  qmPaintBtn.classList.toggle("active", isPaintMode);
  qmColorToolbar.style.display = isPaintMode ? "flex" : "none";
  if (!isPaintMode) { selAnchor = selCursor = null; updateColorSelection(); }
});

// ── Canvas drag-select for cell coloring ──────────────────────────────────────
qmBlockCanvas.addEventListener("mousedown", e => {
  if (!isPaintMode) return;
  const el = e.target.closest("[data-row][data-col]");
  if (!el) return;
  if (e.target.closest("input,textarea,button,select,[contenteditable],.blk-drag-handle")) return;
  if (e.button !== 0) return;
  isColorSelecting = true;
  selAnchor = { row: +el.dataset.row, col: +el.dataset.col };
  selCursor = { ...selAnchor };
  updateColorSelection();
  e.preventDefault();
});

qmBlockCanvas.addEventListener("mouseover", e => {
  if (!isColorSelecting) return;
  const el = e.target.closest("[data-row][data-col]");
  if (!el) return;
  selCursor = { row: +el.dataset.row, col: +el.dataset.col };
  updateColorSelection();
});

document.addEventListener("mouseup", () => {
  if (!isColorSelecting) return;
  isColorSelecting = false;
});

// ── Color swatches ────────────────────────────────────────────────────────────
qmColorToolbar.querySelectorAll(".qm-color-swatch").forEach(btn => {
  btn.addEventListener("click", () => applyColorToSelection(btn.dataset.color || ""));
});

const qmColorPick = document.getElementById("qm-color-pick");
qmColorPick.addEventListener("input", () => applyColorToSelection(qmColorPick.value));

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

// Builds a grid HTML string that exactly mirrors the editor layout (explicit row/col, ghost cells, dynamic row heights)
function buildCardGrid(blocks, cellColors) {
  if (!blocks.length) return "";
  cellColors = cellColors || {};
  autoPlaceBlocks(blocks);
  const maxRow = blocks.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0);
  if (!maxRow) return "";

  // Dynamic row heights: divider-only rows are compact
  const rowTypes = {};
  blocks.forEach(b => {
    for (let r = b.row; r < b.row + (b.rowSpan || 1); r++) {
      if (!rowTypes[r]) rowTypes[r] = [];
      rowTypes[r].push(b.type);
    }
  });
  const rowHeights = Array.from({ length: maxRow }, (_, i) => {
    const types = rowTypes[i + 1] || [];
    return (types.length > 0 && types.every(t => t === "divider")) ? "40px" : "minmax(120px, auto)";
  }).join(" ");

  // Occupied cells
  const occupied = new Set();
  blocks.forEach(b => {
    const span = Math.min(b.span || 1, 4);
    for (let r = b.row; r < b.row + (b.rowSpan || 1); r++)
      for (let c = b.col; c < b.col + span; c++)
        occupied.add(`${r},${c}`);
  });

  // Ghost cells for every unoccupied position
  let ghostHtml = "";
  for (let r = 1; r <= maxRow; r++)
    for (let c = 1; c <= 4; c++) {
      if (!occupied.has(`${r},${c}`)) {
        const cc = cellColors[`${r},${c}`];
        const bgStyle = cc ? `background:${hexToRgba(cc, 0.35)};border-color:${hexToRgba(cc, 0.8)};` : "";
        ghostHtml += `<div class="qc-ghost-cell" style="grid-row:${r};grid-column:${c};${bgStyle}"></div>`;
      }
    }

  // Block cells (autoPlaceBlocks already set row/col)
  const blockHtml = blocks.map(b => renderBlockInCard(b, cellColors)).filter(Boolean).join("");

  return `<div class="qc-grid" style="grid-template-rows:${rowHeights}">${ghostHtml}${blockHtml}</div>`;
}

function buildCardChapters(blocks, cellColors) {
  if (!blocks.length) return "";
  cellColors = cellColors || {};
  autoPlaceBlocks(blocks);
  const sorted = [...blocks].sort((a, b) => (a.row - b.row) || (a.col - b.col));

  const chapters = [];
  let current = { divider: null, blocks: [] };
  for (const b of sorted) {
    if (b.type === "divider") {
      chapters.push(current);
      current = { divider: b, blocks: [] };
    } else {
      current.blocks.push(b);
    }
  }
  chapters.push(current);

  return chapters.map(ch => {
    const gridHtml = buildChapterGrid(ch.blocks, cellColors);
    if (!ch.divider && !gridHtml) return "";
    const header = ch.divider ? `
      <div class="qc-chapter-header" data-open="true">
        <span class="qc-chapter-arrow">▼</span>
        <span class="qc-chapter-line"></span>
        ${ch.divider.title ? `<span class="qc-chapter-title">${esc(ch.divider.title)}</span>` : ""}
        <span class="qc-chapter-line"></span>
      </div>` : "";
    return `<div class="qc-chapter">${header}<div class="qc-chapter-body">${gridHtml}</div></div>`;
  }).join("");
}

function buildChapterGrid(blocks, cellColors) {
  if (!blocks.length) return "";
  const minRow = blocks.reduce((m, b) => Math.min(m, b.row || 1), Infinity);
  const offset = minRow - 1;
  const normalizedColors = {};
  Object.entries(cellColors || {}).forEach(([key, val]) => {
    const [r, c] = key.split(",").map(Number);
    const nr = r - offset;
    if (nr >= 1) normalizedColors[`${nr},${c}`] = val;
  });
  const nb = blocks.map(b => ({ ...b, row: (b.row || 1) - offset }));
  const maxRow = nb.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0);
  const rowTypes = {};
  nb.forEach(b => { for (let r = b.row; r < b.row + (b.rowSpan || 1); r++) { if (!rowTypes[r]) rowTypes[r] = []; rowTypes[r].push(b.type); } });
  const rowHeights = Array.from({ length: maxRow }, (_, i) => {
    const types = rowTypes[i + 1] || [];
    return (types.length > 0 && types.every(t => t === "divider")) ? "40px" : "minmax(120px, auto)";
  }).join(" ");
  const occupied = new Set();
  nb.forEach(b => { const s = Math.min(b.span || 1, 4); for (let r = b.row; r < b.row + (b.rowSpan || 1); r++) for (let c = b.col; c < b.col + s; c++) occupied.add(`${r},${c}`); });
  let ghostHtml = "";
  for (let r = 1; r <= maxRow; r++) for (let c = 1; c <= 4; c++) {
    if (!occupied.has(`${r},${c}`)) {
      const cc = normalizedColors[`${r},${c}`];
      const bgStyle = cc ? `background:${hexToRgba(cc, 0.35)};border-color:${hexToRgba(cc, 0.8)};` : "";
      ghostHtml += `<div class="qc-ghost-cell" style="grid-row:${r};grid-column:${c};${bgStyle}"></div>`;
    }
  }
  const blockHtml = nb.map(b => renderBlockInCard(b, normalizedColors)).filter(Boolean).join("");
  return `<div class="qc-grid" style="grid-template-rows:${rowHeights}">${ghostHtml}${blockHtml}</div>`;
}

// Build at-a-glance content summary chips (phase/enemy/loot counts) for a quest card
function buildSummaryChips(blocks) {
  if (!blocks || !blocks.length) return "";
  let phases = 0, enemies = 0, loot = 0, puzzles = 0, chars = 0, lore = 0;
  for (const b of blocks) {
    if (b.type === "phase")     phases++;
    else if (b.type === "boss") enemies += (b.enemies?.length || (b.name ? 1 : 0));
    else if (b.type === "loot") loot    += (b.items?.length   || (b.name ? 1 : 0));
    else if (b.type === "puzzle")    puzzles++;
    else if (b.type === "character") chars += (b.characters?.length || 0);
    else if (b.type === "loreref")   lore  += (b.items?.length || 0);
  }
  const chips = [];
  if (phases)  chips.push(`<span class="qc-chip qc-chip-phase"><span class="qc-chip-icon">&#9654;</span><span class="qc-chip-count">${phases}</span> ${phases === 1 ? "phase" : "phases"}</span>`);
  if (enemies) chips.push(`<span class="qc-chip qc-chip-boss"><span class="qc-chip-icon">&#9760;</span><span class="qc-chip-count">${enemies}</span> ${enemies === 1 ? "enemy" : "enemies"}</span>`);
  if (loot)    chips.push(`<span class="qc-chip qc-chip-loot"><span class="qc-chip-icon">&#127873;</span><span class="qc-chip-count">${loot}</span> loot</span>`);
  if (puzzles) chips.push(`<span class="qc-chip qc-chip-puzzle"><span class="qc-chip-icon">&#129513;</span><span class="qc-chip-count">${puzzles}</span> ${puzzles === 1 ? "puzzle" : "puzzles"}</span>`);
  if (chars)   chips.push(`<span class="qc-chip qc-chip-char"><span class="qc-chip-icon">&#128100;</span><span class="qc-chip-count">${chars}</span> NPC${chars === 1 ? "" : "s"}</span>`);
  if (lore)    chips.push(`<span class="qc-chip qc-chip-lore"><span class="qc-chip-icon">&#128218;</span><span class="qc-chip-count">${lore}</span> lore</span>`);
  if (!chips.length) return "";
  return `<div class="qc-summary">${chips.join("")}</div>`;
}

function buildCard(q) {
  const state = loadPageState();
  const openQuests = new Set(state.openQuests || []);
  const startOpen = openQuests.has(q.id);

  const card = document.createElement("div");
  card.className = `quest-card quest-${q.type || "main"}${q.status === "completed" ? " quest-completed" : ""}${startOpen ? "" : " qc-folded"}`;
  card.dataset.questId = q.id;
  const blocks = q.blocks ? q.blocks.map(b => ({ ...b })) : [];
  const cardGridHtml = buildCardChapters(blocks, q.cellColors || {});

  // Session filter bar — list each unique session present, in first-seen order
  const sessionList = [];
  for (const b of blocks) {
    if (b.sessionMarker && !sessionList.includes(b.sessionMarker)) sessionList.push(b.sessionMarker);
  }
  const sessionFilterHtml = sessionList.length ? `
    <div class="qc-session-filter">
      <button class="qc-session-filter-btn active" data-session="all" title="Show everything">All</button>
      ${sessionList.map(s =>
        `<button class="qc-session-filter-btn ${sessionColorClass(s)}" data-session="${esc(s)}" title="Show only ${esc(s)}">${esc(s)}</button>`
      ).join("")}
    </div>` : "";

  card.innerHTML = `
    <div class="qc-accent-bar"></div>
    <div class="qc-body">
      <div class="qc-header-row">
        ${isAdmin ? `<div class="qc-drag-handle" title="Drag to reorder quests">&#8942;&#8942;</div>` : ""}
        <button class="qc-fold-btn" title="Collapse/Expand">${startOpen ? "&#9660;" : "&#9654;"}</button>
        <div class="qc-title-row">
          <h3 class="qc-title">${esc(q.title || "")}</h3>
          ${q.location ? `<div class="qc-location">&#128205; ${esc(q.location)}</div>` : ""}
        </div>
        <div class="qc-top-row">
          <span class="qc-type-badge">${q.type === "main" ? "Main Quest" : "Side Quest"}</span>
          <span class="qc-status ${STATUS_CLASS[q.status] || ""}">${STATUS_LABEL[q.status] || "Unknown"}</span>
          ${isAdmin && !q.discovered ? `<span class="qc-hidden-badge">&#128065; DM Only</span>` : ""}
        </div>
        ${buildSummaryChips(blocks)}
        ${sessionFilterHtml}
      </div>
      <div class="qc-content">
        ${cardGridHtml}
      </div>
    </div>
    ${isAdmin ? `
      <div class="qc-actions">
        <button class="qc-btn qc-edit-btn" title="Edit">&#9998;</button>
        <button class="qc-btn qc-del-btn"  title="Delete">&#10005;</button>
      </div>` : ""}
  `;

  // Session filter tab clicks
  card.querySelectorAll(".qc-session-filter-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      card.querySelectorAll(".qc-session-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.session;
      card.querySelectorAll(".qcb-cell, .qcb-divider-cell").forEach(cell => {
        if (target === "all") { cell.classList.remove("session-hidden"); return; }
        const pill = cell.querySelector(".qcb-session-pill");
        const marker = pill?.textContent.trim();
        cell.classList.toggle("session-hidden", marker !== target);
      });
    });
  });

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

  // Chapter collapse/expand
  card.querySelectorAll(".qc-chapter-header").forEach(header => {
    header.addEventListener("click", () => {
      const open = header.dataset.open === "true";
      header.dataset.open = String(!open);
      header.querySelector(".qc-chapter-arrow").textContent = open ? "▶" : "▼";
      header.nextElementSibling.style.display = open ? "none" : "";
    });
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

function renderBlockInCard(b, cellColors) {
  cellColors = cellColors || {};
  const span    = b.span    || 1;
  const rowSpan = b.rowSpan || 1;
  const colStyle = b.col ? `grid-column:${b.col}/span ${span};` : `grid-column:span ${span};`;
  const rowStyle = b.row ? `grid-row:${b.row}/span ${rowSpan};` : "";
  const cc = cellColors[`${b.row},${b.col}`];
  const ccStyle = cc
    ? `background:${hexToRgba(cc, 0.28)};border-left-color:${cc};`
    : "";
  const spanStyle = colStyle + rowStyle + ccStyle;
  const titleStyle = b.titleColor ? `color:${esc(b.titleColor)}` : "";
  const titleHtml = b.blockTitle
    ? `<div class="qcb-block-title" style="${titleStyle}">${esc(b.blockTitle)}</div>`
    : "";

  const cellTxtStyle = [
    b.textAlign  ? `text-align:${b.textAlign}`   : "",
    b.fontWeight && b.fontWeight !== "normal"  ? `font-weight:${b.fontWeight}` : "",
    b.fontStyle  && b.fontStyle  !== "normal"  ? `font-style:${b.fontStyle}`   : "",
  ].filter(Boolean).join(";");

  const sessionPill = b.sessionMarker
    ? `<span class="qcb-session-pill ${sessionColorClass(b.sessionMarker)}">${esc(b.sessionMarker)}</span>`
    : "";

  switch (b.type) {
    case "text":
      if (!b.content) return "";
      return `<div class="qcb-cell qcb-cell-text" style="${spanStyle}">${sessionPill}${titleHtml}<div class="qcb-text" style="${cellTxtStyle}">${contentToHtml(b.content)}</div></div>`;

    case "phase":
      return `<div class="qcb-cell qcb-cell-phase" style="${spanStyle}">${sessionPill}${titleHtml}
        <button class="qc-phase-toggle" data-open="false">
          <span class="toggle-arrow">▶</span>
          <span class="phase-label">${esc(b.title || "Phase")}</span>
        </button>
        <div class="qc-phase-body" style="display:none">
          ${b.description ? `<div class="qcb-phase-desc" style="${cellTxtStyle}">${contentToHtml(b.description)}</div>` : ""}
        </div>
      </div>`;

    case "loot": {
      const lootItems = b.items?.length ? b.items
        : (b.name ? [{ name: b.name, value: b.value || "", description: b.description || "" }] : []);
      if (!lootItems.length) return "";
      return `<div class="qcb-cell qcb-cell-loot" style="${spanStyle}">${sessionPill}${titleHtml}
        ${lootItems.map(it => `
          <div class="qcb-loot" style="${cellTxtStyle}">
            <span class="qcb-loot-icon">&#127873;</span>
            <span class="qcb-loot-name">${esc(it.name)}</span>
            ${it.value ? `<span class="qcb-loot-value">${esc(it.value)}</span>` : ""}
            ${it.description ? `<span class="qcb-loot-desc">${escBr(it.description)}</span>` : ""}
          </div>`).join("")}
      </div>`;
    }

    case "boss": {
      const enemies = b.enemies?.length ? b.enemies
        : (b.name ? [{ name: b.name, ac: b.ac || "", hp: b.hp || "", cr: b.cr || "", notes: b.notes || "" }] : []);
      if (!enemies.length) return "";
      return `<div class="qcb-cell qcb-cell-boss" style="${spanStyle}">${sessionPill}${titleHtml}
        ${enemies.map(en => `
          <div class="qcb-boss">
            <div class="qcb-boss-header">
              <span class="qcb-boss-icon">&#9760;</span>
              <span class="qcb-boss-name">${esc(en.name)}</span>
              ${en.cr ? `<span class="qcb-boss-stat">CR ${esc(en.cr)}</span>` : ""}
              ${en.ac ? `<span class="qcb-boss-stat">AC ${esc(en.ac)}</span>` : ""}
              ${en.hp ? `<span class="qcb-boss-stat">HP ${esc(en.hp)}</span>` : ""}
            </div>
            ${en.notes ? `<p class="qcb-boss-notes" style="${cellTxtStyle}">${escBr(en.notes)}</p>` : ""}
          </div>`).join("")}
      </div>`;
    }

    case "note":
      if (!isAdmin || !b.content) return "";
      return `<div class="qcb-cell qcb-cell-note" style="${spanStyle}">${sessionPill}${titleHtml}<div class="qcb-note" style="${cellTxtStyle}">&#128196; ${escBr(b.content)}</div></div>`;

    case "puzzle":
      if (!b.description && !b.title) return "";
      return `<div class="qcb-cell qcb-cell-puzzle" style="${spanStyle}">${sessionPill}${titleHtml}
        <div class="qcb-puzzle-header"><span class="qcb-puzzle-icon">&#129513;</span><span class="qcb-puzzle-name">${esc(b.title || "Puzzle")}</span></div>
        ${b.description ? `<p class="qcb-puzzle-desc" style="${cellTxtStyle}">${escBr(b.description)}</p>` : ""}
        ${b.hint ? `<div class="qcb-puzzle-hint">&#128161; ${esc(b.hint)}</div>` : ""}
        ${isAdmin && b.solution ? `<div class="qcb-puzzle-solution">&#128273; ${esc(b.solution)}</div>` : ""}
      </div>`;

    case "divider":
      return `<div class="qcb-divider-cell" style="${spanStyle}">${
        b.title
          ? `<div class="qcb-divider qcb-divider--titled"><span class="qcb-divider-title">${esc(b.title)}</span></div>`
          : `<div class="qcb-divider"></div>`
      }</div>`;

    case "character": {
      const chars = b.characters || [];
      if (!chars.length) return "";
      return `<div class="qcb-cell qcb-cell-character" style="${spanStyle}">${sessionPill}${titleHtml}
        ${chars.map(ch => `
          <div class="qcb-character">
            ${ch.picture
              ? `<img class="qcb-char-pic" src="${esc(ch.picture)}" alt="${esc(ch.name)}" />`
              : `<div class="qcb-char-pic qcb-char-pic-ph">&#128100;</div>`}
            <div class="qcb-char-info">
              <div class="qcb-char-name">${esc(ch.name)}</div>
              ${ch.profession ? `<div class="qcb-char-meta">${esc(ch.profession)}</div>` : ""}
              ${(ch.race || ch.age) ? `<div class="qcb-char-sub">${[ch.race, ch.age ? `Age ${esc(ch.age)}` : ""].filter(Boolean).join(" · ")}</div>` : ""}
            </div>
          </div>`).join("")}
      </div>`;
    }

    case "loreref": {
      const loreItems = b.items || [];
      if (!loreItems.length) return "";
      return `<div class="qcb-cell qcb-cell-loreref" style="${spanStyle}">${sessionPill}${titleHtml}
        ${loreItems.map(it => `
          <div class="qcb-loreref">
            <span class="qcb-loreref-icon">${it.type === "scroll" ? "📜" : "📖"}</span>
            <div class="qcb-loreref-info">
              <span class="qcb-loreref-title">${esc(it.title || "")}</span>
              ${it.writer ? `<span class="qcb-loreref-writer">by ${esc(it.writer)}</span>` : ""}
            </div>
          </div>`).join("")}
      </div>`;
    }

    default:
      return "";
  }
}

// ── Modal open/close ──────────────────────────────────────────────────────────
function openModal(q) {
  editingId    = q ? q.id : null;
  selectedType = q ? (q.type || "main") : "main";
  currentCellColors = q?.cellColors ? { ...q.cellColors } : {};
  if (q && q.blocks) {
    currentBlocks = q.blocks.map(b => {
      if (b.type === "loot" && !b.items) {
        const { name, value, description, ...rest } = b;
        return { ...rest, items: name ? [{ name: name || "", value: value || "", description: description || "" }] : [] };
      }
      if (b.type === "boss" && !b.enemies) {
        const { name, ac, hp, cr, notes, ...rest } = b;
        return { ...rest, enemies: name ? [{ name: name || "", ac: String(ac || ""), hp: String(hp || ""), cr: String(cr || ""), notes: notes || "" }] : [] };
      }
      return { ...b };
    });
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

  // Reset undo/redo, disable preview mode, wire draft key
  undoStack = []; redoStack = [];
  hasUnsavedChanges = false;
  setPreviewMode(false);
  draftKey = `questDraft:${editingId || "new"}`;
  syncUndoButtons();
  setAutosaveStatus("saved", "All changes saved");

  syncTypeBtns();
  buildBlocksEditor();
  questModal.classList.add("open");
  qmName.focus();

  // Check for an existing local draft
  maybeShowDraftBanner();

  // Seed the first undo snapshot so initial edits go on the stack correctly
  undoStack.push(captureState());
}

function closeModal() {
  questModal.classList.remove("open");
  editingId = null; currentBlocks = []; currentCellColors = {};
  selAnchor = selCursor = null; isColorSelecting = false;
  hideDrop(qmLocationDrop);
  hideSlashMenu();
  setPreviewMode(false);
  undoStack = []; redoStack = [];
  syncUndoButtons();
  clearTimeout(autosaveTimer);
}

qmCancel.addEventListener("click", closeModal);
document.getElementById("qm-cancel-footer")?.addEventListener("click", closeModal);
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
    cellColors: Object.keys(currentCellColors).length ? { ...currentCellColors } : null,
    discovered: qmDiscovered.checked,
  };
  await set(ref(db, `quests/${payload.id}`), payload);
  // Clear local draft on successful save
  if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
  hasUnsavedChanges = false;
  closeModal();
});

// ── Meta field edits also push to undo + autosave ─────────────────────────────
[qmName, qmLocationInp, qmStatus, qmDiscovered].forEach(el => {
  if (!el) return;
  const evt = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
  el.addEventListener(evt, () => onEditTick());
});
qmTypeSelector?.addEventListener("click", () => onEditTick());

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
  text:    { type: "text",    content: "",     blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left" },
  phase:   { type: "phase",   title: "",   description: "", blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  loot:    { type: "loot",    items: [],   blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  boss:    { type: "boss",    enemies: [], blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  note:    { type: "note",    content: "", blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  puzzle:  { type: "puzzle",  title: "",   description: "", hint: "", solution: "", blockTitle: "", titleColor: "", span: 1, rowSpan: 1, textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  divider:   { type: "divider",   title: "", span: 4, rowSpan: 1 },
  character: { type: "character", characters: [], blockTitle: "", titleColor: "", span: 1, rowSpan: 1 },
  loreref:   { type: "loreref",   items: [],      blockTitle: "", titleColor: "", span: 1, rowSpan: 1 },
};

// ── Block palette ─────────────────────────────────────────────────────────────
document.querySelectorAll(".qm-add-block-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentBlocks.push({ ...BLOCK_DEFAULTS[btn.dataset.blockType] });
    onEditTick();
    buildBlocksEditor();
    setTimeout(() => qmBlockCanvas.querySelector(".qm-block:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  });
  btn.draggable = true;
  btn.addEventListener("dragstart", e => {
    dragPaletteType = btn.dataset.blockType;
    dragSrcIndex = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", btn.dataset.blockType);
    qmBlockCanvas.classList.add("qm-drag-active");
  });
  btn.addEventListener("dragend", () => { dragPaletteType = null; qmBlockCanvas.classList.remove("qm-drag-active"); });
});

// ── Block drag state ──────────────────────────────────────────────────────────
let dragSrcIndex = null;
let dragPaletteType = null;
let dragPaletteTemplate = null;   // template key being dragged

// ── Template drag preview tooltip ─────────────────────────────────────────────
let _tplPreview = null;
function getTplPreview() {
  if (!_tplPreview) {
    _tplPreview = document.createElement("div");
    _tplPreview.className = "tpl-drag-preview";
    _tplPreview.style.display = "none";
    document.body.appendChild(_tplPreview);
  }
  return _tplPreview;
}
function showTplPreview(templateKey, x, y) {
  const tpl = BLOCK_TEMPLATES[templateKey];
  if (!tpl) return;
  const preview = getTplPreview();
  const BLOCK_ICONS = { phase:"▶", boss:"☠", loot:"🎁", puzzle:"🧩", character:"👤", loreref:"📚", note:"📄", text:"¶", divider:"—" };
  const BLOCK_COLORS = { phase:"#2a5c8a", boss:"#8a2a2a", loot:"#4a7a2a", puzzle:"#7a4a8a", character:"#5a4a2a", loreref:"#2a5a4a", note:"#5a5a2a", text:"#3a3a5a", divider:"#4a4a4a" };
  const rows = [];
  let col = 1, row = 1, curRow = [];
  tpl.forEach(t => {
    const span = t.span || 1;
    if (col + span - 1 > 4) { if (curRow.length) rows.push(curRow); curRow = []; col = 1; row++; }
    curRow.push(t);
    col += span;
    if (col > 4) { rows.push(curRow); curRow = []; col = 1; row++; }
  });
  if (curRow.length) rows.push(curRow);
  preview.innerHTML = `<div class="tpl-preview-title">${templateKey.replace(/-/g, " ")}</div>` +
    rows.map(row => `<div class="tpl-preview-row">${row.map(t => {
      const label = t.blockTitle || t.type;
      const color = BLOCK_COLORS[t.type] || "#3a3a3a";
      const icon = BLOCK_ICONS[t.type] || "▪";
      const flex = t.span || 1;
      return `<div class="tpl-preview-block" style="flex:${flex};border-color:${color}"><span class="tpl-preview-icon">${icon}</span><span class="tpl-preview-label">${label}</span></div>`;
    }).join("")}</div>`).join("");
  preview.style.display = "block";
  positionTplPreview(x, y);
}
function positionTplPreview(x, y) {
  const p = getTplPreview();
  if (p.style.display === "none") return;
  const pw = p.offsetWidth || 220, ph = p.offsetHeight || 60;
  const left = Math.min(x + 16, window.innerWidth - pw - 8);
  const top  = y + 16 + ph > window.innerHeight ? y - ph - 8 : y + 16;
  p.style.left = left + "px";
  p.style.top  = top  + "px";
}
function hideTplPreview() {
  if (_tplPreview) _tplPreview.style.display = "none";
}

function clearDragHighlights() {
  qmBlockCanvas.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
  hideTplPreview();
}

// Ghost cell drop target for flex-column layout
function makeGhostCell(colNum, position) {
  const ghost = document.createElement("div");
  ghost.className = "qm-ghost-cell";

  ghost.addEventListener("dragover", e => {
    if (dragSrcIndex === null && dragPaletteType === null && dragPaletteTemplate === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = (dragPaletteType || dragPaletteTemplate) ? "copy" : "move";
    clearDragHighlights();
    ghost.classList.add("drag-over");
    if (dragPaletteTemplate) showTplPreview(dragPaletteTemplate, e.clientX, e.clientY);
  });
  ghost.addEventListener("mousemove", e => {
    if (dragPaletteTemplate && ghost.classList.contains("drag-over")) positionTplPreview(e.clientX, e.clientY);
  });
  ghost.addEventListener("dragleave", e => {
    if (!ghost.contains(e.relatedTarget)) { ghost.classList.remove("drag-over"); hideTplPreview(); }
  });
  ghost.addEventListener("drop", e => {
    e.preventDefault();
    clearDragHighlights();

    if (dragSrcIndex !== null) {
      const block = currentBlocks[dragSrcIndex];
      const colBlocks = currentBlocks
        .filter((b, i) => i !== dragSrcIndex && (b.col || 1) === colNum)
        .sort((a, b) => (a.row || 1) - (b.row || 1));
      block.col = colNum;
      if (block.col + (block.span || 1) - 1 > 4) block.span = 5 - colNum;
      colBlocks.splice(position, 0, block);
      colBlocks.forEach((b, idx) => { b.row = idx + 1; });
      dragSrcIndex = null;
      onEditTick();
      buildBlocksEditor();
    } else if (dragPaletteType !== null) {
      const newBlock = { ...BLOCK_DEFAULTS[dragPaletteType], col: colNum };
      if (newBlock.col + (newBlock.span || 1) - 1 > 4) newBlock.span = 5 - colNum;
      const colBlocks = currentBlocks
        .filter(b => (b.col || 1) === colNum)
        .sort((a, b) => (a.row || 1) - (b.row || 1));
      colBlocks.splice(position, 0, newBlock);
      colBlocks.forEach((b, idx) => { b.row = idx + 1; });
      currentBlocks.push(newBlock);
      dragPaletteType = null;
      onEditTick();
      buildBlocksEditor();
    } else if (dragPaletteTemplate !== null) {
      applyTemplateAtPosition(dragPaletteTemplate, null, colNum);
      dragPaletteTemplate = null;
      onEditTick();
      buildBlocksEditor();
    }
  });

  return ghost;
}

// ── Resolve overlapping blocks after a rowSpan change ────────────────────────
function resolveOverlaps() {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < currentBlocks.length; i++) {
      for (let j = 0; j < currentBlocks.length; j++) {
        if (i === j) continue;
        const a = currentBlocks[i];
        const b = currentBlocks[j];
        const aC1 = a.col || 1, aC2 = aC1 + (a.span || 1) - 1;
        const bC1 = b.col || 1, bC2 = bC1 + (b.span || 1) - 1;
        if (aC2 < bC1 || bC2 < aC1) continue;           // no column overlap
        const aR1 = a.row || 1, aR2 = aR1 + (a.rowSpan || 1) - 1;
        const bR1 = b.row || 1, bR2 = bR1 + (b.rowSpan || 1) - 1;
        if (aR2 < bR1 || bR2 < aR1) continue;           // no row overlap
        // a and b overlap — push whichever starts later below the other
        if (aR1 <= bR1) { b.row = aR2 + 1; changed = true; }
        else            { a.row = bR2 + 1; changed = true; }
      }
    }
  }
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

// ── @mention system ──────────────────────────────────────────────────────────
const mentionState = { active: false, el: null, query: "", hits: [], focusedIdx: 0 };
let _mentionDrop = null;

function getMentionDrop() {
  if (!_mentionDrop) {
    _mentionDrop = document.createElement("div");
    _mentionDrop.className = "mention-drop";
    _mentionDrop.style.display = "none";
    document.body.appendChild(_mentionDrop);
  }
  return _mentionDrop;
}

function hideMentionDrop() {
  getMentionDrop().style.display = "none";
  mentionState.active = false;
}

function renderMentionDrop(richEl) {
  const drop = getMentionDrop();
  const q = mentionState.query.toLowerCase();
  mentionState.hits = allCharacters
    .filter(c => c.name && (!q || c.name.toLowerCase().includes(q)))
    .slice(0, 8);

  if (!mentionState.hits.length) { hideMentionDrop(); return; }
  mentionState.focusedIdx = 0;

  drop.innerHTML = mentionState.hits.map((c, i) => `
    <div class="mention-drop-item${i === 0 ? " focused" : ""}">
      ${c.picture
        ? `<img class="mention-drop-pic" src="${esc(c.picture)}" />`
        : `<div class="mention-drop-pic mention-drop-ph">&#128100;</div>`}
      <div class="mention-drop-info">
        <span class="mention-drop-name">${esc(c.name)}</span>
        ${c.profession ? `<span class="mention-drop-meta">${esc(c.profession)}</span>` : ""}
      </div>
    </div>`).join("");

  drop.querySelectorAll(".mention-drop-item").forEach((item, i) => {
    item.addEventListener("mousedown", e => { e.preventDefault(); doInsertMention(richEl, mentionState.hits[i]); });
  });

  // Position near cursor
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - 270));
    const below = window.innerHeight - rect.bottom > 260;
    const top = below ? rect.bottom + 4 : rect.top - Math.min(mentionState.hits.length * 48 + 8, rect.top - 4);
    drop.style.cssText = `display:block;position:fixed;left:${left}px;top:${top}px;z-index:9999;`;
  }
}

function updateMentionFocus() {
  getMentionDrop().querySelectorAll(".mention-drop-item")
    .forEach((item, i) => item.classList.toggle("focused", i === mentionState.focusedIdx));
}

function doInsertMention(richEl, char) {
  if (!richEl) { hideMentionDrop(); return; }
  richEl.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) { hideMentionDrop(); return; }

  // Select back over @+query then delete it
  const backLen = mentionState.query.length + 1;
  for (let i = 0; i < backLen; i++) sel.modify("extend", "backward", "character");
  const range = sel.getRangeAt(0);
  range.deleteContents();

  // Insert mention span
  const span = document.createElement("span");
  span.className = "char-mention";
  span.contentEditable = "false";
  span.dataset.charId   = char.id   || "";
  span.dataset.charName = char.name || "";
  span.textContent = `@${char.name}`;
  range.insertNode(span);

  // Place cursor after a non-breaking space following the span
  const space = document.createTextNode("\u00A0");
  span.after(space);
  const after = document.createRange();
  after.setStartAfter(space);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);

  richEl.dispatchEvent(new Event("input", { bubbles: true }));
  hideMentionDrop();
}

// Close dropdown on outside click
document.addEventListener("mousedown", e => {
  if (_mentionDrop && !_mentionDrop.contains(e.target)) hideMentionDrop();
});

// ── Character detail popup (for @mention chips) ───────────────────────────────
let _charPopup = null;

function getCharPopup() {
  if (!_charPopup) {
    _charPopup = document.createElement("div");
    _charPopup.className = "char-popup-overlay";
    _charPopup.innerHTML = `<div class="char-popup-box"><button class="char-popup-close">&#10005;</button><div class="char-popup-inner"></div></div>`;
    _charPopup.querySelector(".char-popup-close").addEventListener("click", hideCharPopup);
    _charPopup.addEventListener("click", e => { if (e.target === _charPopup) hideCharPopup(); });
    document.body.appendChild(_charPopup);
  }
  return _charPopup;
}

function hideCharPopup() {
  if (_charPopup) _charPopup.style.display = "none";
}

function showCharacterPopup(charId) {
  const c = allCharacters.find(ch => ch.id === charId);
  if (!c) return;
  const popup = getCharPopup();
  const inner = popup.querySelector(".char-popup-inner");
  inner.innerHTML = `
    <div class="char-popup-pic-wrap">
      ${c.picture
        ? `<img class="char-popup-pic" src="${esc(c.picture)}" alt="${esc(c.name)}" />`
        : `<div class="char-popup-pic char-popup-pic-ph">&#128100;</div>`}
    </div>
    <div class="char-popup-details">
      <h2 class="char-popup-name">${esc(c.name || "")}</h2>
      <div class="char-popup-tags">
        ${c.profession ? `<span class="char-popup-tag">${esc(c.profession)}</span>` : ""}
        ${c.race ? `<span class="char-popup-tag">${esc(c.race)}</span>` : ""}
        ${c.age ? `<span class="char-popup-tag">Age ${esc(String(c.age))}</span>` : ""}
      </div>
      ${c.description ? `<p class="char-popup-desc">${escBr(c.description)}</p>` : ""}
      ${isAdmin && c.notes ? `
        <div class="char-popup-notes">
          <div class="char-popup-notes-label">&#128065; DM Notes</div>
          <p class="char-popup-notes-body">${escBr(c.notes)}</p>
        </div>` : ""}
    </div>
  `;
  popup.style.display = "flex";
}

// Click delegation for @mention chips in card view and editor
questGrid.addEventListener("click", e => {
  const m = e.target.closest(".char-mention");
  if (m) showCharacterPopup(m.dataset.charId);
});
qmBlockCanvas.addEventListener("click", e => {
  const m = e.target.closest(".char-mention");
  if (m) { e.stopPropagation(); showCharacterPopup(m.dataset.charId); }
});

// ── Drop target for grid ghost cells ─────────────────────────────────────────
function attachDropTarget(ghost, row, col) {
  ghost.addEventListener("dragover", e => {
    if (dragSrcIndex === null && dragPaletteType === null && dragPaletteTemplate === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = (dragPaletteType || dragPaletteTemplate) ? "copy" : "move";
    clearDragHighlights();
    ghost.classList.add("drag-over");
    if (dragPaletteTemplate) showTplPreview(dragPaletteTemplate, e.clientX, e.clientY);
  });
  ghost.addEventListener("mousemove", e => {
    if (dragPaletteTemplate && ghost.classList.contains("drag-over")) positionTplPreview(e.clientX, e.clientY);
  });
  ghost.addEventListener("dragleave", e => {
    if (!ghost.contains(e.relatedTarget)) { ghost.classList.remove("drag-over"); hideTplPreview(); }
  });
  ghost.addEventListener("drop", e => {
    e.preventDefault();
    clearDragHighlights();
    if (dragSrcIndex !== null) {
      const block = currentBlocks[dragSrcIndex];
      block.row = row;
      block.col = col;
      if (col + (block.span || 1) - 1 > 4) block.span = 5 - col;
      dragSrcIndex = null;
      onEditTick();
      buildBlocksEditor();
    } else if (dragPaletteType !== null) {
      const newBlock = { ...BLOCK_DEFAULTS[dragPaletteType], row, col };
      if (col + (newBlock.span || 1) - 1 > 4) newBlock.span = 5 - col;
      currentBlocks.push(newBlock);
      dragPaletteType = null;
      onEditTick();
      buildBlocksEditor();
    } else if (dragPaletteTemplate !== null) {
      applyTemplateAtPosition(dragPaletteTemplate, row, col);
      dragPaletteTemplate = null;
      onEditTick();
      buildBlocksEditor();
    }
  });
}

// ── Build block editor ────────────────────────────────────────────────────────
function buildBlocksEditor() {
  qmBlockCanvas.innerHTML = "";

  autoPlaceBlocks(currentBlocks);
  resolveOverlaps();

  const maxRow = currentBlocks.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0);
  const numRows = Math.max(6, maxRow + 2);

  // Give divider-only rows a compact height; all others get 220px
  const editorRowTypes = {};
  currentBlocks.forEach(b => {
    for (let r = b.row || 1; r < (b.row || 1) + (b.rowSpan || 1); r++) {
      if (!editorRowTypes[r]) editorRowTypes[r] = [];
      editorRowTypes[r].push(b.type);
    }
  });
  const editorRowHeights = Array.from({ length: numRows }, (_, i) => {
    const types = editorRowTypes[i + 1] || [];
    return (types.length > 0 && types.every(t => t === "divider")) ? "90px" : "220px";
  }).join(" ");
  qmBlockCanvas.style.gridTemplateRows = editorRowHeights;

  if (currentBlocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "qm-canvas-empty";
    empty.style.cssText = "grid-row:1; grid-column:1/span 4;";
    empty.textContent = "Use the buttons above to add content blocks — then drag ⠿⠿ to any empty cell.";
    qmBlockCanvas.appendChild(empty);
  }

  // Build occupancy map — exclude the block being dragged so its cells show as drop targets
  const occupied = new Set();
  currentBlocks.forEach((b, idx) => {
    if (idx === dragSrcIndex) return;
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
      ghost.dataset.row = r;
      ghost.dataset.col = c;
      const cc = currentCellColors[`${r},${c}`];
      if (cc) { ghost.style.background = hexToRgba(cc, 0.32); ghost.style.borderColor = hexToRgba(cc, 0.8); }
      attachDropTarget(ghost, r, c);
      qmBlockCanvas.appendChild(ghost);
    }
  }

  // Row-insert zones — span full width, sit at the top of each row, only active during drag
  for (let r = 1; r <= numRows; r++) {
    const zone = document.createElement("div");
    zone.className = "qm-row-insert-zone";
    zone.style.cssText = `grid-row:${r};grid-column:1/span 4;align-self:start;z-index:8;`;
    zone.dataset.insertBefore = r;
    zone.addEventListener("dragover", e => {
      if (dragSrcIndex === null && dragPaletteType === null && dragPaletteTemplate === null) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = (dragPaletteType || dragPaletteTemplate) ? "copy" : "move";
      clearDragHighlights();
      zone.classList.add("drag-over");
      if (dragPaletteTemplate) showTplPreview(dragPaletteTemplate, e.clientX, e.clientY);
    });
    zone.addEventListener("mousemove", e => {
      if (dragPaletteTemplate && zone.classList.contains("drag-over")) positionTplPreview(e.clientX, e.clientY);
    });
    zone.addEventListener("dragleave", e => {
      if (!zone.contains(e.relatedTarget)) { zone.classList.remove("drag-over"); hideTplPreview(); }
    });
    zone.addEventListener("drop", e => {
      e.preventDefault(); e.stopPropagation();
      clearDragHighlights();
      const targetRow = Number(zone.dataset.insertBefore);
      // Shift every other block at row >= targetRow down by 1
      currentBlocks.forEach((b, j) => {
        if (j === dragSrcIndex) return;
        if ((b.row || 1) >= targetRow) b.row = (b.row || 1) + 1;
      });
      if (dragSrcIndex !== null) {
        const blk = currentBlocks[dragSrcIndex];
        blk.row = targetRow;
        dragSrcIndex = null;
      } else if (dragPaletteType !== null) {
        currentBlocks.push({ ...BLOCK_DEFAULTS[dragPaletteType], row: targetRow, col: 1 });
        dragPaletteType = null;
      } else if (dragPaletteTemplate !== null) {
        applyTemplateAtPosition(dragPaletteTemplate, targetRow, 1);
        dragPaletteTemplate = null;
      }
      qmBlockCanvas.classList.remove("qm-drag-active");
      onEditTick();
      buildBlocksEditor();
    });
    qmBlockCanvas.appendChild(zone);
  }

  // Row-delete buttons — one per occupied row, in column 5
  for (let r = 1; r <= maxRow; r++) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "qm-row-del-btn";
    delBtn.style.cssText = `grid-row:${r};grid-column:5;align-self:center;justify-self:center;`;
    delBtn.title = "Delete row";
    delBtn.innerHTML = "&#10005;";
    delBtn.addEventListener("click", () => {
      for (let j = currentBlocks.length - 1; j >= 0; j--) {
        const b = currentBlocks[j];
        const bRow = b.row || 1;
        const bEnd = bRow + (b.rowSpan || 1) - 1;
        if (bRow === r) {
          currentBlocks.splice(j, 1);                         // starts here — remove
        } else if (bRow < r && bEnd >= r) {
          b.rowSpan = Math.max(1, (b.rowSpan || 1) - 1);     // spans through — shrink
        } else if (bRow > r) {
          b.row = bRow - 1;                                   // below — shift up
        }
      }
      onEditTick();
      buildBlocksEditor();
    });
    qmBlockCanvas.appendChild(delBtn);
  }

  // Render blocks at their explicit grid positions
  currentBlocks.forEach((block, i) => {
    const wrap = document.createElement("div");
    wrap.className = `qm-block qm-block-${block.type}`;
    wrap.dataset.index = i;
    wrap.dataset.row = block.row;
    wrap.dataset.col = block.col;
    wrap.style.gridRow = `${block.row} / span ${block.rowSpan || 1}`;
    wrap.style.gridColumn = `${block.col} / span ${block.span || 1}`;
    const cc = currentCellColors[`${block.row},${block.col}`];
    if (cc) { wrap.style.background = hexToRgba(cc, 0.25); wrap.style.borderLeftColor = cc; }
    wrap.innerHTML = buildBlockEditorHtml(block, i);

    // Handle-only drag source
    const handle = wrap.querySelector(".blk-drag-handle");
    if (handle) {
      handle.draggable = true;
      handle.addEventListener("dragstart", e => {
        dragSrcIndex = i;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
        requestAnimationFrame(() => { wrap.classList.add("dragging"); qmBlockCanvas.classList.add("qm-drag-active"); });
      });
      handle.addEventListener("dragend", () => {
        wrap.classList.remove("dragging");
        qmBlockCanvas.classList.remove("qm-drag-active");
        clearDragHighlights();
        dragSrcIndex = null;
      });
    }

    // Controls
    wrap.querySelector(".blk-del")?.addEventListener("click", () => { currentBlocks.splice(i, 1); onEditTick(); buildBlocksEditor(); });
    wrap.querySelectorAll(".blk-span-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newSpan = Number(btn.dataset.span);
        currentBlocks[i].span = newSpan;
        if (currentBlocks[i].col + newSpan - 1 > 4) currentBlocks[i].col = Math.max(1, 5 - newSpan);
        onEditTick();
        buildBlocksEditor();
      });
    });
    wrap.querySelectorAll(".blk-rowspan-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const oldRowSpan = currentBlocks[i].rowSpan || 1;
        const newRowSpan = Number(btn.dataset.rowspan);
        const delta = newRowSpan - oldRowSpan;
        currentBlocks[i].rowSpan = newRowSpan;
        onEditTick();

        if (delta !== 0) {
          const oldEnd = (currentBlocks[i].row || 1) + oldRowSpan - 1;
          if (delta > 0) {
            // Block grew — shift ALL blocks below the old end down by delta (insert-row behaviour)
            currentBlocks.forEach((other, j) => {
              if (j === i) return;
              if ((other.row || 1) > oldEnd) other.row = (other.row || 1) + delta;
            });
          } else {
            // Block shrank — pull blocks below it up by |delta| rows (same columns only)
            const blk = currentBlocks[i];
            const bC1 = blk.col || 1, bC2 = bC1 + (blk.span || 1) - 1;
            currentBlocks.forEach((other, j) => {
              if (j === i) return;
              const oC1 = other.col || 1, oC2 = oC1 + (other.span || 1) - 1;
              if (oC2 < bC1 || bC2 < oC1) return;
              if ((other.row || 1) > oldEnd) other.row = Math.max(1, (other.row || 1) + delta);
            });
          }
        }

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

    // Rich text / rich phase blocks (contenteditable) — inline formatting + @ / # / $ / ^ / slash
    const richEl = wrap.querySelector(".blk-rich-text") || wrap.querySelector(".blk-rich-phase");
    const isPhase = richEl && richEl.classList.contains("blk-rich-phase");
    if (richEl) {
      richEl.addEventListener("input", () => {
        if (isPhase) block.description = richEl.innerHTML;
        else         block.content     = richEl.innerHTML;
        onEditTick();
      });

      // Combined trigger detection: `/` slash menu + @ # $ ^ link chips
      richEl.addEventListener("input", () => {
        const sel = window.getSelection();
        if (!sel.rangeCount || !richEl.contains(sel.anchorNode)) return;
        const range = sel.getRangeAt(0);
        const pre = document.createRange();
        pre.selectNodeContents(richEl);
        pre.setEnd(range.startContainer, range.startOffset);
        const preText = pre.toString();

        // Slash command: `/query` at start of line or after whitespace
        const slashMatch = preText.match(/(^|\s)\/([^\s/]{0,20})$/);
        if (slashMatch) {
          slashState.active = true;
          slashState.srcEl = richEl;
          slashState.blockIndex = i;
          slashState.query = slashMatch[2];
          slashState.focusedIdx = 0;
          hideLinkDrop();
          renderSlashMenu();
          return;
        }
        hideSlashMenu();

        // Link triggers (most recent non-whitespace trigger char)
        const linkMatch = preText.match(/([@#$^])([^\s@#$^]*)$/);
        if (linkMatch) {
          linkState.active = true;
          linkState.trigger = linkMatch[1];
          linkState.el = richEl;
          linkState.query = linkMatch[2];
          renderLinkDrop(richEl);
        } else {
          hideLinkDrop();
        }
      });

      richEl.addEventListener("keydown", e => {
        // Slash menu navigation
        if (slashState.active && slashState.srcEl === richEl) {
          const hits = slashState.hits || [];
          if (e.key === "ArrowDown")  { e.preventDefault(); slashState.focusedIdx = (slashState.focusedIdx + 1) % hits.length; renderSlashMenu(); return; }
          if (e.key === "ArrowUp")    { e.preventDefault(); slashState.focusedIdx = (slashState.focusedIdx - 1 + hits.length) % hits.length; renderSlashMenu(); return; }
          if (e.key === "Enter" || e.key === "Tab") {
            if (hits.length) { e.preventDefault(); e.stopPropagation(); insertSlashBlock(hits[slashState.focusedIdx].type); return; }
          }
          if (e.key === "Escape") { e.preventDefault(); hideSlashMenu(); return; }
        }
        // Link drop navigation
        if (linkState.active && linkState.el === richEl) {
          if (e.key === "ArrowDown")  { e.preventDefault(); linkState.focusedIdx = (linkState.focusedIdx + 1) % linkState.hits.length; updateLinkFocus(); return; }
          if (e.key === "ArrowUp")    { e.preventDefault(); linkState.focusedIdx = (linkState.focusedIdx - 1 + linkState.hits.length) % linkState.hits.length; updateLinkFocus(); return; }
          if (e.key === "Enter" || e.key === "Tab") {
            if (linkState.hits.length) { e.preventDefault(); e.stopPropagation(); doInsertLink(richEl, linkState.hits[linkState.focusedIdx]); return; }
          }
          if (e.key === "Escape") { e.preventDefault(); hideLinkDrop(); return; }
        }
      });

      richEl.addEventListener("blur", () => {
        setTimeout(() => { if (linkState.el === richEl) hideLinkDrop(); if (slashState.srcEl === richEl) hideSlashMenu(); }, 150);
      });

      // Bold / Italic via execCommand (mousedown to keep selection alive)
      wrap.querySelector(".blk-fmt-bold")?.addEventListener("mousedown", e => {
        e.preventDefault(); document.execCommand("bold"); richEl.focus();
        if (isPhase) block.description = richEl.innerHTML; else block.content = richEl.innerHTML;
        onEditTick();
      });
      wrap.querySelector(".blk-fmt-italic")?.addEventListener("mousedown", e => {
        e.preventDefault(); document.execCommand("italic"); richEl.focus();
        if (isPhase) block.description = richEl.innerHTML; else block.content = richEl.innerHTML;
        onEditTick();
      });

      // Inline text color — save selection before picker opens, restore on change
      let savedRange = null;
      const colorWrap = wrap.querySelector(".blk-fmt-colorwrap");
      const colorPick = wrap.querySelector(".blk-fmt-colorpick");
      if (colorWrap && colorPick) {
        colorWrap.addEventListener("mousedown", () => {
          const sel = window.getSelection();
          savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        });
        colorPick.addEventListener("input", () => {
          const sel = window.getSelection();
          sel.removeAllRanges();
          if (savedRange) sel.addRange(savedRange);
          document.execCommand("foreColor", false, colorPick.value);
          if (isPhase) block.description = richEl.innerHTML; else block.content = richEl.innerHTML;
          savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
          onEditTick();
        });
      }
    } else {
      // Non-rich blocks — block-level bold/italic toggle
      wrap.querySelector(".blk-fmt-bold")?.addEventListener("click", () => {
        block.fontWeight = block.fontWeight === "bold" ? "normal" : "bold";
        wrap.querySelector(".blk-fmt-bold").classList.toggle("active", block.fontWeight === "bold");
        wrap.querySelectorAll(".blk-textarea").forEach(ta => { ta.style.fontWeight = block.fontWeight; });
        onEditTick();
      });
      wrap.querySelector(".blk-fmt-italic")?.addEventListener("click", () => {
        block.fontStyle = block.fontStyle === "italic" ? "normal" : "italic";
        wrap.querySelector(".blk-fmt-italic").classList.toggle("active", block.fontStyle === "italic");
        wrap.querySelectorAll(".blk-textarea").forEach(ta => { ta.style.fontStyle = block.fontStyle; });
        onEditTick();
      });
    }

    // Alignment (all block types with a fmt bar)
    wrap.querySelectorAll(".blk-align-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        block.textAlign = btn.dataset.align;
        if (richEl) richEl.style.textAlign = btn.dataset.align;
        wrap.querySelectorAll(".blk-textarea").forEach(ta => { ta.style.textAlign = btn.dataset.align; });
        wrap.querySelectorAll(".blk-align-btn").forEach(b => b.classList.toggle("active", b.dataset.align === btn.dataset.align));
        onEditTick();
      });
    });

    // Session marker pill
    wrap.querySelector(".blk-session-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      openSessionPopup(e.currentTarget, i);
    });

    // Loot item search
    if (block.type === "loot") {
      if (!block.items) block.items = [];
      const srch = wrap.querySelector(".loot-search-input");
      const drop = wrap.querySelector(".loot-search-drop");
      const list = wrap.querySelector(".loot-items-list");

      const refreshList = () => {
        list.innerHTML = (block.items || []).map((it, idx) => `
          <div class="loot-item-row" data-idx="${idx}">
            <span class="loot-item-name">${esc(it.name)}</span>
            ${it.value ? `<span class="loot-item-value">${esc(it.value)}</span>` : ""}
            <button type="button" class="loot-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
          </div>`).join("");
        list.querySelectorAll(".loot-item-del").forEach(btn => {
          btn.addEventListener("click", () => {
            block.items.splice(Number(btn.dataset.idx), 1);
            refreshList();
          });
        });
      };
      refreshList();

      if (srch && drop) {
        srch.addEventListener("input", () => {
          const q = srch.value.trim().toLowerCase();
          if (!q) { hideDrop(drop); return; }
          const hits = allItems.filter(m => m.name && m.name.toLowerCase().includes(q)).slice(0, 10);
          if (!hits.length) { hideDrop(drop); return; }
          drop.innerHTML = hits.map(m =>
            `<div class="loc-drop-item" tabindex="0"
              data-name="${esc(m.name)}" data-value="${esc(m.price != null ? formatGold(m.price) : '')}" data-desc="${esc(m.description || '')}">
              <span>${esc(m.name)}</span>
              ${m.price != null ? `<span class="boss-drop-meta">${formatGold(m.price)}</span>` : ""}
            </div>`
          ).join("");
          drop.style.display = "block";
        });
        srch.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        const addItem = dataset => {
          block.items.push({ name: dataset.name || "", value: dataset.value || "", description: dataset.desc || "" });
          srch.value = ""; hideDrop(drop); refreshList();
        };
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault();
          addItem(item.dataset);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { addItem(document.activeElement.dataset); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }
    }

    // Enemy creature search
    if (block.type === "boss") {
      if (!block.enemies) block.enemies = [];
      const srch = wrap.querySelector(".boss-search-input");
      const drop = wrap.querySelector(".boss-search-drop");
      const list = wrap.querySelector(".enemy-items-list");

      const refreshEnemyList = () => {
        list.innerHTML = (block.enemies || []).map((en, idx) => `
          <div class="enemy-item-row" data-idx="${idx}">
            <span class="enemy-item-name">${esc(en.name)}</span>
            ${en.cr ? `<span class="enemy-item-stat">CR ${esc(en.cr)}</span>` : ""}
            ${en.ac ? `<span class="enemy-item-stat">AC ${esc(en.ac)}</span>` : ""}
            ${en.hp ? `<span class="enemy-item-stat">HP ${esc(en.hp)}</span>` : ""}
            <button type="button" class="enemy-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
          </div>`).join("");
        list.querySelectorAll(".enemy-item-del").forEach(btn => {
          btn.addEventListener("click", () => { block.enemies.splice(Number(btn.dataset.idx), 1); refreshEnemyList(); });
        });
      };
      refreshEnemyList();

      if (srch && drop) {
        srch.addEventListener("input", () => {
          const q = srch.value.trim().toLowerCase();
          if (!q) { hideDrop(drop); return; }
          const seen = new Set();
          const pool = [...firebaseTemplates, ...MONSTER_PRESETS].filter(m => {
            if (!m.name) return false;
            const key = m.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const hits = pool.filter(m => m.name.toLowerCase().includes(q)).slice(0, 10);
          if (!hits.length) { hideDrop(drop); return; }
          drop.innerHTML = hits.map(m =>
            `<div class="loc-drop-item" tabindex="0"
              data-name="${esc(m.name)}" data-ac="${m.ac || ''}" data-hp="${m.hp || ''}" data-cr="${m.cr || ''}">
              <span>${esc(m.name)}</span>
              <span class="boss-drop-meta">${[m.cr ? 'CR '+m.cr : '', m.hp ? 'HP '+m.hp : '', m.ac ? 'AC '+m.ac : ''].filter(Boolean).join(' · ')}</span>
            </div>`
          ).join("");
          drop.style.display = "block";
        });
        srch.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        const addEnemy = dataset => {
          block.enemies.push({ name: dataset.name || "", ac: String(dataset.ac || ""), hp: String(dataset.hp || ""), cr: String(dataset.cr || ""), notes: "" });
          srch.value = ""; hideDrop(drop); refreshEnemyList();
        };
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault();
          addEnemy(item.dataset);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { addEnemy(document.activeElement.dataset); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }
    }

    // Character search
    if (block.type === "character") {
      if (!block.characters) block.characters = [];
      const srch = wrap.querySelector(".char-search-input");
      const drop = wrap.querySelector(".char-search-drop");
      const list = wrap.querySelector(".char-items-list");

      const refreshCharList = () => {
        list.innerHTML = (block.characters || []).map((ch, idx) => `
          <div class="char-item-row" data-idx="${idx}">
            ${ch.picture ? `<img class="char-item-pic" src="${esc(ch.picture)}" alt="" />` : `<div class="char-item-pic char-item-pic-ph">&#128100;</div>`}
            <span class="char-item-name">${esc(ch.name)}</span>
            ${ch.profession ? `<span class="char-item-meta">${esc(ch.profession)}</span>` : ""}
            <button type="button" class="char-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
          </div>`).join("");
        list.querySelectorAll(".char-item-del").forEach(btn => {
          btn.addEventListener("click", () => { block.characters.splice(Number(btn.dataset.idx), 1); refreshCharList(); });
        });
      };
      refreshCharList();

      if (srch && drop) {
        srch.addEventListener("input", () => {
          const q = srch.value.trim().toLowerCase();
          if (!q) { hideDrop(drop); return; }
          const hits = allCharacters.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 10);
          if (!hits.length) { hideDrop(drop); return; }
          drop.innerHTML = hits.map(c =>
            `<div class="loc-drop-item" tabindex="0"
              data-id="${esc(c.id||"")}" data-name="${esc(c.name||"")}"
              data-profession="${esc(c.profession||"")}" data-race="${esc(c.race||"")}"
              data-age="${esc(String(c.age||""))}" data-picture="${esc(c.picture||"")}">
              <span>${esc(c.name)}</span>
              ${c.profession ? `<span class="boss-drop-meta">${esc(c.profession)}</span>` : ""}
            </div>`
          ).join("");
          drop.style.display = "block";
        });
        srch.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
          if (e.key === "Escape") hideDrop(drop);
        });
        const addChar = dataset => {
          block.characters.push({ id: dataset.id||"", name: dataset.name||"", profession: dataset.profession||"", race: dataset.race||"", age: dataset.age||"", picture: dataset.picture||"" });
          srch.value = ""; hideDrop(drop); refreshCharList();
        };
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault(); addChar(item.dataset);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { addChar(document.activeElement.dataset); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape") hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }
    }

    // Lore item search
    if (block.type === "loreref") {
      if (!block.items) block.items = [];
      const srch = wrap.querySelector(".loreref-search-input");
      const drop = wrap.querySelector(".loreref-search-drop");
      const list = wrap.querySelector(".loreref-items-list");

      const refreshLoreList = () => {
        list.innerHTML = (block.items || []).map((it, idx) => `
          <div class="loreref-item-row" data-idx="${idx}">
            <span class="loreref-item-icon">${it.type === "scroll" ? "📜" : "📖"}</span>
            <span class="loreref-item-name">${esc(it.title||"")}</span>
            <button type="button" class="loreref-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
          </div>`).join("");
        list.querySelectorAll(".loreref-item-del").forEach(btn => {
          btn.addEventListener("click", () => { block.items.splice(Number(btn.dataset.idx), 1); refreshLoreList(); });
        });
      };
      refreshLoreList();

      if (srch && drop) {
        srch.addEventListener("input", () => {
          const q = srch.value.trim().toLowerCase();
          if (!q) { hideDrop(drop); return; }
          const hits = allLoreItems.filter(it => it.title && it.title.toLowerCase().includes(q)).slice(0, 10);
          if (!hits.length) { hideDrop(drop); return; }
          drop.innerHTML = hits.map(it =>
            `<div class="loc-drop-item" tabindex="0"
              data-id="${esc(it.id||"")}" data-title="${esc(it.title||"")}"
              data-type="${esc(it.type||"book")}" data-writer="${esc(it.writer||"")}">
              <span>${it.type === "scroll" ? "📜" : "📖"} ${esc(it.title)}</span>
              ${it.writer ? `<span class="boss-drop-meta">${esc(it.writer)}</span>` : ""}
            </div>`
          ).join("");
          drop.style.display = "block";
        });
        srch.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
          if (e.key === "Escape") hideDrop(drop);
        });
        const addLore = dataset => {
          block.items.push({ id: dataset.id||"", title: dataset.title||"", type: dataset.type||"book", writer: dataset.writer||"" });
          srch.value = ""; hideDrop(drop); refreshLoreList();
        };
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault(); addLore(item.dataset);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { addLore(document.activeElement.dataset); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape") hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }
    }

    qmBlockCanvas.appendChild(wrap);
  });

  // Auto-resize all textareas to fit content (no manual drag handle)
  requestAnimationFrame(() => {
    qmBlockCanvas.querySelectorAll(".blk-textarea").forEach(ta => {
      const resize = () => { ta.style.height = "0"; ta.style.height = ta.scrollHeight + "px"; };
      resize();
      ta.addEventListener("input", resize);
    });
  });
}


function wireInput(wrap, block, field, selector) {
  const el = wrap.querySelector(selector);
  if (el) el.addEventListener("input", () => { block[field] = el.value; onEditTick(); });
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

// Generates the formatting toolbar HTML for a block
function fmtBar(b, richText = false) {
  const align  = b.textAlign  || "left";
  const bold   = b.fontWeight === "bold";
  const italic = b.fontStyle  === "italic";
  const colorBtn = richText ? `
    <label class="blk-fmt-colorwrap" title="Text color">
      <span class="blk-fmt-colorlabel">A</span>
      <input type="color" class="blk-fmt-colorpick" value="#ffffff" />
    </label>
    <div class="blk-fmt-sep"></div>` : "";
  return `<div class="blk-fmt-bar">
    <button type="button" class="blk-fmt-btn blk-fmt-bold${bold  ? " active" : ""}" title="Bold">B</button>
    <button type="button" class="blk-fmt-btn blk-fmt-italic${italic ? " active" : ""}" title="Italic">I</button>
    ${colorBtn}
    <div class="blk-fmt-sep"></div>
    <button type="button" class="blk-fmt-btn blk-align-btn${align === "left"   ? " active" : ""}" data-align="left"   title="Left">⇤</button>
    <button type="button" class="blk-fmt-btn blk-align-btn${align === "center" ? " active" : ""}" data-align="center" title="Center">⇔</button>
    <button type="button" class="blk-fmt-btn blk-align-btn${align === "right"  ? " active" : ""}" data-align="right"  title="Right">⇥</button>
  </div>`;
}

function buildBlockEditorHtml(b, i) {
  const span    = b.span    || 1;
  const rowSpan = b.rowSpan || 1;
  const sessionPillHtml = b.sessionMarker
    ? `<button type="button" class="blk-session-btn has-session ${sessionColorClass(b.sessionMarker)}" title="Click to edit session marker">${esc(b.sessionMarker)}</button>`
    : `<button type="button" class="blk-session-btn" title="Tag this block with a session">+ Session</button>`;
  const controls = `
    <div class="blk-controls">
      ${sessionPillHtml}
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

  const taStyle = `font-weight:${b.fontWeight||"normal"};font-style:${b.fontStyle||"normal"};text-align:${b.textAlign||"left"}`;

  switch (b.type) {
    case "text":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#182;</span><span class="blk-type-label">Text</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b, true)}
        <div class="blk-rich-text" contenteditable="true" data-placeholder="Write something…" style="text-align:${b.textAlign||"left"}">${b.content || ""}</div>`;

    case "phase":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#9654;</span><span class="blk-type-label">Phase</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b, true)}
        <input class="blk-input" type="text" data-f="title" placeholder="Phase title…" value="${esc(b.title || "")}" />
        <div class="blk-rich-phase" contenteditable="true" data-placeholder="What happens in this phase… (try @ # $ ^ / for links & blocks)" style="text-align:${b.textAlign||"left"}">${b.description || ""}</div>`;

    case "loot":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#127873;</span><span class="blk-type-label">Loot</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <div class="loot-search-wrap">
          <input class="blk-input loot-search-input" type="text" placeholder="&#128269; Search items to add…" autocomplete="off" />
          <div class="loot-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="loot-items-list">
          ${(b.items || []).map((it, idx) => `
            <div class="loot-item-row" data-idx="${idx}">
              <span class="loot-item-name">${esc(it.name)}</span>
              ${it.value ? `<span class="loot-item-value">${esc(it.value)}</span>` : ""}
              <button type="button" class="loot-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
            </div>`).join("")}
        </div>`;

    case "boss":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#9760;</span><span class="blk-type-label">Enemy</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <div class="boss-search-wrap">
          <input class="blk-input boss-search-input" type="text" placeholder="&#128269; Search creatures to add…" autocomplete="off" />
          <div class="boss-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="enemy-items-list">
          ${(b.enemies || []).map((en, idx) => `
            <div class="enemy-item-row" data-idx="${idx}">
              <span class="enemy-item-name">${esc(en.name)}</span>
              ${en.cr ? `<span class="enemy-item-stat">CR ${esc(en.cr)}</span>` : ""}
              ${en.ac ? `<span class="enemy-item-stat">AC ${esc(en.ac)}</span>` : ""}
              ${en.hp ? `<span class="enemy-item-stat">HP ${esc(en.hp)}</span>` : ""}
              <button type="button" class="enemy-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
            </div>`).join("")}
        </div>`;

    case "note":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#128196;</span><span class="blk-type-label">DM Note</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <textarea class="blk-textarea blk-textarea-note" data-f="content" style="${taStyle}" placeholder="Private DM notes…" rows="3">${esc(b.content || "")}</textarea>`;

    case "puzzle":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#129513;</span><span class="blk-type-label">Puzzle</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <input class="blk-input" type="text" data-f="title" placeholder="Puzzle name…" value="${esc(b.title || "")}" />
        <textarea class="blk-textarea" data-f="description" style="${taStyle}" placeholder="Describe the puzzle…" rows="3">${esc(b.description || "")}</textarea>
        <input class="blk-input" type="text" data-f="hint" placeholder="Hint (visible to players)…" value="${esc(b.hint || "")}" />
        <input class="blk-input blk-textarea-note" type="text" data-f="solution" placeholder="Solution (DM only)…" value="${esc(b.solution || "")}" />`;

    case "divider":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#8213;</span><span class="blk-type-label">Divider</span>${controls}</div>
        <input class="blk-input" type="text" data-f="title" placeholder="Divider title (optional)…" value="${esc(b.title || "")}" />
        <div class="blk-divider-preview"></div>`;

    case "character":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#128100;</span><span class="blk-type-label">Character</span>${controls}</div>
        ${titleRow}
        <div class="char-search-wrap">
          <input class="blk-input char-search-input" type="text" placeholder="&#128269; Search characters to add…" autocomplete="off" />
          <div class="char-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="char-items-list">
          ${(b.characters || []).map((ch, idx) => `
            <div class="char-item-row" data-idx="${idx}">
              ${ch.picture ? `<img class="char-item-pic" src="${esc(ch.picture)}" alt="" />` : `<div class="char-item-pic char-item-pic-ph">&#128100;</div>`}
              <span class="char-item-name">${esc(ch.name)}</span>
              ${ch.profession ? `<span class="char-item-meta">${esc(ch.profession)}</span>` : ""}
              <button type="button" class="char-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
            </div>`).join("")}
        </div>`;

    case "loreref":
      return `
        <div class="blk-header"><span class="blk-type-icon">&#128218;</span><span class="blk-type-label">Lore</span>${controls}</div>
        ${titleRow}
        <div class="loreref-search-wrap">
          <input class="blk-input loreref-search-input" type="text" placeholder="&#128269; Search lore items to add…" autocomplete="off" />
          <div class="loreref-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="loreref-items-list">
          ${(b.items || []).map((it, idx) => `
            <div class="loreref-item-row" data-idx="${idx}">
              <span class="loreref-item-icon">${it.type === "scroll" ? "📜" : "📖"}</span>
              <span class="loreref-item-name">${esc(it.title || "")}</span>
              <button type="button" class="loreref-item-del blk-ctrl" data-idx="${idx}" title="Remove">&#10005;</button>
            </div>`).join("")}
        </div>`;

    default:
      return "";
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); hideCharPopup(); } });

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escBr(str) { return esc(str).replace(/\n/g, "<br>"); }

// Render text block content: HTML if it came from the rich editor, plain text otherwise
function contentToHtml(str) {
  if (!str) return "";
  if (/<[a-z]/i.test(str)) return str;          // already rich HTML
  return esc(str).replace(/\n/g, "<br>");       // legacy plain text
}

// ═══════════════════════════════════════════════════════════════════════════
// UNDO / REDO + AUTOSAVE
// ═══════════════════════════════════════════════════════════════════════════

function captureState() {
  return {
    title:       qmName?.value || "",
    location:    qmLocationInp?.value || "",
    type:        selectedType,
    status:      qmStatus?.value || "not_started",
    discovered:  !!qmDiscovered?.checked,
    blocks:      JSON.parse(JSON.stringify(currentBlocks || [])),
    cellColors:  { ...currentCellColors },
  };
}

function applyState(snap) {
  if (!snap) return;
  isApplyingSnap = true;
  qmName.value        = snap.title || "";
  qmLocationInp.value = snap.location || "";
  selectedType        = snap.type || "main";
  qmStatus.value      = snap.status || "not_started";
  qmDiscovered.checked = !!snap.discovered;
  currentBlocks       = JSON.parse(JSON.stringify(snap.blocks || []));
  currentCellColors   = { ...(snap.cellColors || {}) };
  syncTypeBtns();
  buildBlocksEditor();
  isApplyingSnap = false;
}

function pushUndo() {
  if (isApplyingSnap) return;
  const snap = captureState();
  const last = undoStack[undoStack.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) return; // dedupe
  undoStack.push(snap);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function undo() {
  if (undoStack.length <= 1) return;
  const current = undoStack.pop();
  redoStack.push(current);
  const prev = undoStack[undoStack.length - 1];
  applyState(prev);
  syncUndoButtons();
  scheduleAutosave();
}

function redo() {
  if (!redoStack.length) return;
  const snap = redoStack.pop();
  undoStack.push(snap);
  applyState(snap);
  syncUndoButtons();
  scheduleAutosave();
}

function syncUndoButtons() {
  if (qmUndoBtn) qmUndoBtn.disabled = undoStack.length <= 1;
  if (qmRedoBtn) qmRedoBtn.disabled = redoStack.length === 0;
}

// Central "something changed" hook: push undo + schedule autosave + mark dirty
function onEditTick() {
  if (isApplyingSnap) return;
  pushUndo();
  hasUnsavedChanges = true;
  setAutosaveStatus("dirty", "Unsaved changes…");
  scheduleAutosave();
}

function scheduleAutosave() {
  if (isApplyingSnap) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, 600);
}

function doAutosave() {
  if (!draftKey || !questModal.classList.contains("open")) return;
  setAutosaveStatus("saving", "Saving draft…");
  try {
    const payload = { ...captureState(), savedAt: Date.now() };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    hasUnsavedChanges = false;
    clearTimeout(autosaveStatusTimer);
    autosaveStatusTimer = setTimeout(() => setAutosaveStatus("saved", "Draft saved just now"), 180);
  } catch (err) {
    setAutosaveStatus("dirty", "Autosave failed");
  }
}

function setAutosaveStatus(kind, text) {
  if (!qmAutosaveStatus) return;
  qmAutosaveStatus.classList.remove("saving", "dirty");
  if (kind !== "saved") qmAutosaveStatus.classList.add(kind);
  const label = qmAutosaveStatus.querySelector(".qm-autosave-text");
  if (label) label.textContent = text;
}

function formatRelativeTime(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.round(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)  return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function maybeShowDraftBanner() {
  if (!qmDraftBanner || !draftKey) return;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch {}
  if (!draft || !draft.savedAt) { qmDraftBanner.style.display = "none"; return; }
  // If the draft is essentially identical to the quest we just opened, skip the prompt
  const current = captureState();
  const { savedAt, ...rest } = draft;
  if (JSON.stringify(rest) === JSON.stringify(current)) { qmDraftBanner.style.display = "none"; return; }
  qmDraftTime.textContent = formatRelativeTime(savedAt);
  qmDraftBanner.style.display = "flex";
}

qmDraftRestore?.addEventListener("click", () => {
  if (!draftKey) return;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch {}
  if (!draft) { qmDraftBanner.style.display = "none"; return; }
  const { savedAt, ...rest } = draft;
  applyState(rest);
  undoStack = [captureState()]; redoStack = [];
  syncUndoButtons();
  qmDraftBanner.style.display = "none";
  setAutosaveStatus("saved", "Draft restored");
});
qmDraftDiscard?.addEventListener("click", () => {
  if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
  qmDraftBanner.style.display = "none";
});

// Undo/redo buttons + keyboard
qmUndoBtn?.addEventListener("click", undo);
qmRedoBtn?.addEventListener("click", redo);

document.addEventListener("keydown", e => {
  if (!questModal.classList.contains("open")) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((key === "y") || (key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
  else if (key === "s") { e.preventDefault(); qmSave.click(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER PREVIEW MODE
// ═══════════════════════════════════════════════════════════════════════════
qmPreviewToggle?.addEventListener("click", () => setPreviewMode(!isPlayerPreview));

function setPreviewMode(on) {
  isPlayerPreview = !!on;
  if (!qmCanvasWrap) return;
  qmCanvasWrap.classList.toggle("preview-mode", isPlayerPreview);
  qmPreviewToggle?.classList.toggle("active", isPlayerPreview);
  if (isPlayerPreview) {
    buildPreviewPanel();
  } else if (qmPreviewPanel) {
    qmPreviewPanel.innerHTML = "";
  }
}

function buildPreviewPanel() {
  const panel = ensurePreviewPanel();
  // Filter out DM-only blocks the way the card view would see them as a player
  const visibleBlocks = (currentBlocks || [])
    .filter(b => b.type !== "note")                      // DM notes never shown
    .map(b => {
      if (b.type === "puzzle") {
        const { solution, ...rest } = b;                 // strip solution field
        return rest;
      }
      return b;
    });
  const title = qmName.value.trim() || "Untitled quest";
  const location = qmLocationInp.value.trim();
  const gridHtml = buildCardChapters(
    visibleBlocks.map(b => ({ ...b })),
    currentCellColors
  );
  panel.innerHTML = `
    <div class="qm-preview-watermark">
      <span class="qm-preview-watermark-icon">&#128065;</span>
      <span>This is how players see this quest — DM notes and puzzle solutions are hidden.</span>
    </div>
    <div class="quest-card quest-${selectedType} preview-card">
      <div class="qc-accent-bar"></div>
      <div class="qc-body">
        <div class="qc-header-row">
          <div class="qc-title-row">
            <h3 class="qc-title">${esc(title)}</h3>
            ${location ? `<div class="qc-location">&#128205; ${esc(location)}</div>` : ""}
          </div>
          <div class="qc-top-row">
            <span class="qc-type-badge">${selectedType === "main" ? "Main Quest" : "Side Quest"}</span>
          </div>
          ${buildSummaryChips(visibleBlocks)}
        </div>
        <div class="qc-content">${gridHtml || '<p style="color:#6a5a42;font-style:italic;padding:20px">(No player-visible content yet.)</p>'}</div>
      </div>
    </div>
  `;
  // Wire chapter folds and phase toggles inside the preview
  panel.querySelectorAll(".qc-chapter-header").forEach(header => {
    header.addEventListener("click", () => {
      const open = header.dataset.open === "true";
      header.dataset.open = String(!open);
      header.querySelector(".qc-chapter-arrow").textContent = open ? "▶" : "▼";
      header.nextElementSibling.style.display = open ? "none" : "";
    });
  });
  panel.querySelectorAll(".qc-phase-toggle").forEach(btn => {
    const body = btn.nextElementSibling;
    btn.addEventListener("click", () => {
      const open = btn.dataset.open === "true";
      btn.dataset.open = String(!open);
      body.style.display = open ? "none" : "block";
      btn.querySelector(".toggle-arrow").textContent = open ? "▶" : "▼";
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

function applyTemplateAtPosition(templateKey, startRow, startCol) {
  const tpl = BLOCK_TEMPLATES[templateKey];
  if (!tpl) return;
  const baseRow = startRow ?? (currentBlocks.reduce((m, b) => Math.max(m, (b.row || 1) + (b.rowSpan || 1) - 1), 0) + 1);
  let insertRow = baseRow, col = startCol ?? 1;
  // Shift existing blocks down to make room
  const tplRows = (() => {
    let r = 0, c = startCol ?? 1;
    tpl.forEach(t => { const span = t.span || 1; if (c + span - 1 > 4) { r++; c = 1; } c += span; if (c > 4) { r++; c = 1; } });
    return r + 1;
  })();
  currentBlocks.forEach(b => { if ((b.row || 1) >= baseRow) b.row = (b.row || 1) + tplRows; });
  tpl.forEach(t => {
    const block = { ...BLOCK_DEFAULTS[t.type], ...t, row: insertRow, col };
    if (col + (block.span || 1) - 1 > 4) { insertRow++; col = 1; block.row = insertRow; block.col = 1; }
    currentBlocks.push(block);
    col += (block.span || 1);
    if (col > 4) { insertRow++; col = 1; }
  });
}

const BLOCK_TEMPLATES = {
  "boss-fight": [
    { type: "phase",   title: "Combat setup", description: "", span: 2, rowSpan: 1, blockTitle: "The encounter" },
    { type: "boss",    enemies: [], span: 2, rowSpan: 2, blockTitle: "Enemies" },
    { type: "loot",    items: [], span: 2, rowSpan: 1, blockTitle: "Reward" },
  ],
  "investigation": [
    { type: "character", characters: [], span: 2, rowSpan: 1, blockTitle: "Contact" },
    { type: "puzzle",    title: "The mystery", description: "", hint: "", solution: "", span: 2, rowSpan: 1, blockTitle: "Puzzle" },
    { type: "loreref",   items: [], span: 4, rowSpan: 1, blockTitle: "Relevant lore" },
  ],
  "dungeon-room": [
    { type: "phase", title: "Room description", description: "", span: 4, rowSpan: 1, blockTitle: "Room" },
    { type: "boss",  enemies: [], span: 2, rowSpan: 1, blockTitle: "Enemies" },
    { type: "loot",  items: [], span: 2, rowSpan: 1, blockTitle: "Loot" },
  ],
  "social-scene": [
    { type: "character", characters: [], span: 2, rowSpan: 2, blockTitle: "NPC" },
    { type: "text", content: "", span: 2, rowSpan: 1, blockTitle: "Read-aloud", textAlign: "left" },
    { type: "note", content: "", span: 2, rowSpan: 1, blockTitle: "DM guidance" },
  ],
  "travel-encounter": [
    { type: "phase", title: "Setting the scene", description: "", span: 4, rowSpan: 1 },
    { type: "boss",  enemies: [], span: 2, rowSpan: 1, blockTitle: "Encounter" },
    { type: "loot",  items: [], span: 2, rowSpan: 1, blockTitle: "Discoveries" },
  ],
};

document.querySelectorAll(".qm-template-btn").forEach(btn => {
  btn.draggable = true;
  btn.addEventListener("dragstart", e => {
    dragPaletteTemplate = btn.dataset.template;
    dragSrcIndex = null;
    dragPaletteType = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", btn.dataset.template);
    qmBlockCanvas.classList.add("qm-drag-active");
    // Build a drag image from a compact preview element
    const img = document.createElement("div");
    img.className = "tpl-drag-image";
    img.textContent = btn.querySelector(".qm-ab-text")?.textContent || btn.dataset.template;
    img.style.cssText = "position:fixed;top:-200px;left:-200px;padding:6px 12px;background:#2a1a0a;color:#f5deb3;border-radius:6px;font-size:13px;white-space:nowrap;border:1px solid #8a6a3a;";
    document.body.appendChild(img);
    e.dataTransfer.setDragImage(img, img.offsetWidth / 2, img.offsetHeight / 2);
    setTimeout(() => img.remove(), 0);
  });
  btn.addEventListener("dragend", () => {
    dragPaletteTemplate = null;
    qmBlockCanvas.classList.remove("qm-drag-active");
    hideTplPreview();
  });
  btn.addEventListener("click", () => {
    if (!BLOCK_TEMPLATES[btn.dataset.template]) return;
    applyTemplateAtPosition(btn.dataset.template, null, 1);
    onEditTick();
    buildBlocksEditor();
    setTimeout(() => qmBlockCanvas.querySelector(".qm-block:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND MENU
// ═══════════════════════════════════════════════════════════════════════════
const SLASH_ITEMS = [
  { type: "phase",     icon: "&#9654;",    name: "Phase",      hint: "A quest step" },
  { type: "boss",      icon: "&#9760;",    name: "Enemy",      hint: "Creature stat block" },
  { type: "loot",      icon: "&#127873;",  name: "Loot",       hint: "Items or rewards" },
  { type: "puzzle",    icon: "&#129513;",  name: "Puzzle",     hint: "Riddle or skill check" },
  { type: "character", icon: "&#128100;",  name: "Character",  hint: "NPC reference" },
  { type: "loreref",   icon: "&#128218;",  name: "Lore",       hint: "Book or scroll reference" },
  { type: "note",      icon: "&#128196;",  name: "DM Note",    hint: "Private to you" },
  { type: "divider",   icon: "&#8213;",    name: "Divider",    hint: "Chapter break" },
  { type: "text",      icon: "&#182;",     name: "Text",       hint: "Paragraph" },
];

const slashState = { active: false, srcEl: null, query: "", focusedIdx: 0, blockIndex: -1 };
let _slashMenu = null;

function getSlashMenu() {
  if (!_slashMenu) {
    _slashMenu = document.createElement("div");
    _slashMenu.className = "slash-menu";
    _slashMenu.style.display = "none";
    document.body.appendChild(_slashMenu);
  }
  return _slashMenu;
}

function hideSlashMenu() {
  if (_slashMenu) _slashMenu.style.display = "none";
  slashState.active = false;
  slashState.srcEl = null;
}

function renderSlashMenu() {
  const menu = getSlashMenu();
  const q = slashState.query.toLowerCase();
  const hits = SLASH_ITEMS.filter(it =>
    !q || it.name.toLowerCase().includes(q) || it.type.includes(q)
  );
  if (!hits.length) { hideSlashMenu(); return; }
  if (slashState.focusedIdx >= hits.length) slashState.focusedIdx = 0;

  menu.innerHTML = `
    <div class="slash-menu-header">Insert block</div>
    ${hits.map((it, i) => `
      <button type="button" class="slash-menu-item${i === slashState.focusedIdx ? " focused" : ""}" data-type="${it.type}">
        <span class="slash-menu-icon">${it.icon}</span>
        <span class="slash-menu-info">
          <span class="slash-menu-name">${it.name}</span>
          <span class="slash-menu-hint">${it.hint}</span>
        </span>
      </button>`).join("")}
  `;
  slashState.hits = hits;

  menu.querySelectorAll(".slash-menu-item").forEach((item, i) => {
    item.addEventListener("mousedown", e => {
      e.preventDefault();
      insertSlashBlock(hits[i].type);
    });
    item.addEventListener("mouseenter", () => {
      slashState.focusedIdx = i;
      menu.querySelectorAll(".slash-menu-item").forEach((it, j) => it.classList.toggle("focused", j === i));
    });
  });

  // Position near caret
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 240));
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 280 ? rect.bottom + 4 : Math.max(8, rect.top - 280);
    menu.style.cssText = `display:block;left:${left}px;top:${top}px;`;
  }
}

function insertSlashBlock(type) {
  const srcEl = slashState.srcEl;
  const blockIndex = slashState.blockIndex;
  // Delete the `/query` from the source element
  if (srcEl) {
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const backLen = slashState.query.length + 1;
      for (let i = 0; i < backLen; i++) sel.modify("extend", "backward", "character");
      sel.getRangeAt(0).deleteContents();
      // Sync the source block's content
      const srcBlock = currentBlocks[blockIndex];
      if (srcBlock) {
        if (srcEl.classList.contains("blk-rich-text")) srcBlock.content = srcEl.innerHTML;
        if (srcEl.classList.contains("blk-rich-phase")) srcBlock.description = srcEl.innerHTML;
      }
    }
  }
  hideSlashMenu();
  // Insert the new block directly after the source in the list
  const newBlock = { ...BLOCK_DEFAULTS[type] };
  const insertAt = blockIndex >= 0 ? blockIndex + 1 : currentBlocks.length;
  // Place it on the row directly after the source block (or at end)
  if (blockIndex >= 0) {
    const src = currentBlocks[blockIndex];
    const targetRow = (src.row || 1) + (src.rowSpan || 1);
    // Shift every block at or past targetRow down
    currentBlocks.forEach((b, i) => {
      if (i === blockIndex) return;
      if ((b.row || 1) >= targetRow) b.row = (b.row || 1) + 1;
    });
    newBlock.row = targetRow;
    newBlock.col = 1;
  }
  currentBlocks.splice(insertAt, 0, newBlock);
  onEditTick();
  buildBlocksEditor();
  setTimeout(() => {
    const newWrap = qmBlockCanvas.querySelectorAll(".qm-block")[insertAt];
    newWrap?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    newWrap?.querySelector("input,textarea,[contenteditable]")?.focus();
  }, 60);
}

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-LINK (@ # $ ^) TRIGGER DETECTION for rich-text editors
// ═══════════════════════════════════════════════════════════════════════════
// `@` → character, `#` → quest, `$` → lore, `^` → location
const linkState = { active: false, trigger: null, el: null, query: "", hits: [], focusedIdx: 0 };
let _linkDrop = null;

function getLinkDrop() {
  if (!_linkDrop) {
    _linkDrop = document.createElement("div");
    _linkDrop.className = "mention-drop";
    _linkDrop.style.display = "none";
    document.body.appendChild(_linkDrop);
  }
  return _linkDrop;
}
function hideLinkDrop() {
  if (_linkDrop) _linkDrop.style.display = "none";
  linkState.active = false;
}

function searchLinkHits(trigger, q) {
  const query = q.toLowerCase();
  if (trigger === "@") {
    return allCharacters.filter(c => c.name && (!query || c.name.toLowerCase().includes(query))).slice(0, 8)
      .map(c => ({ kind: "char", id: c.id, label: c.name, sub: c.profession, pic: c.picture }));
  }
  if (trigger === "#") {
    return quests.filter(q2 => q2.title && (!query || q2.title.toLowerCase().includes(query)) && q2.id !== editingId).slice(0, 8)
      .map(q2 => ({ kind: "quest", id: q2.id, label: q2.title, sub: q2.location || "" }));
  }
  if (trigger === "$") {
    return allLoreItems.filter(l => l.title && (!query || l.title.toLowerCase().includes(query))).slice(0, 8)
      .map(l => ({ kind: "lore", id: l.id, label: l.title, sub: l.writer || "" }));
  }
  if (trigger === "^") {
    return markerNames.filter(m => m.name && (!query || m.name.toLowerCase().includes(query))).slice(0, 8)
      .map(m => ({ kind: "loc", id: m.id || m.name, label: m.name, sub: "" }));
  }
  return [];
}

function renderLinkDrop(richEl) {
  const drop = getLinkDrop();
  linkState.hits = searchLinkHits(linkState.trigger, linkState.query);
  if (!linkState.hits.length) { hideLinkDrop(); return; }
  linkState.focusedIdx = 0;
  const iconMap = { "@": "&#128100;", "#": "&#9876;", "$": "&#128218;", "^": "&#128205;" };

  drop.innerHTML = linkState.hits.map((h, i) => `
    <div class="mention-drop-item${i === 0 ? " focused" : ""}">
      ${h.pic
        ? `<img class="mention-drop-pic" src="${esc(h.pic)}" />`
        : `<div class="mention-drop-pic mention-drop-ph">${iconMap[linkState.trigger] || ""}</div>`}
      <div class="mention-drop-info">
        <span class="mention-drop-name">${esc(h.label)}</span>
        ${h.sub ? `<span class="mention-drop-meta">${esc(h.sub)}</span>` : ""}
      </div>
    </div>`).join("");

  drop.querySelectorAll(".mention-drop-item").forEach((item, i) => {
    item.addEventListener("mousedown", e => { e.preventDefault(); doInsertLink(richEl, linkState.hits[i]); });
  });

  const sel = window.getSelection();
  if (sel.rangeCount) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - 270));
    const below = window.innerHeight - rect.bottom > 260;
    const top = below ? rect.bottom + 4 : rect.top - Math.min(linkState.hits.length * 48 + 8, rect.top - 4);
    drop.style.cssText = `display:block;position:fixed;left:${left}px;top:${top}px;z-index:9999;`;
  }
}

function updateLinkFocus() {
  getLinkDrop().querySelectorAll(".mention-drop-item")
    .forEach((item, i) => item.classList.toggle("focused", i === linkState.focusedIdx));
}

function doInsertLink(richEl, hit) {
  if (!richEl || !hit) { hideLinkDrop(); return; }
  richEl.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) { hideLinkDrop(); return; }

  // Select back over trigger + query then delete
  const backLen = linkState.query.length + 1;
  for (let i = 0; i < backLen; i++) sel.modify("extend", "backward", "character");
  const range = sel.getRangeAt(0);
  range.deleteContents();

  const span = document.createElement("span");
  if (hit.kind === "char")   span.className = "char-mention";
  if (hit.kind === "quest")  span.className = "quest-link";
  if (hit.kind === "lore")   span.className = "lore-link";
  if (hit.kind === "loc")    span.className = "loc-link";
  span.contentEditable = "false";
  span.dataset.linkKind = hit.kind;
  span.dataset.linkId   = hit.id || "";
  span.dataset.linkName = hit.label || "";
  // Legacy field for the old charId handler
  if (hit.kind === "char") { span.dataset.charId = hit.id || ""; span.dataset.charName = hit.label || ""; }
  span.textContent = hit.label;
  range.insertNode(span);

  const space = document.createTextNode("\u00A0");
  span.after(space);
  const after = document.createRange();
  after.setStartAfter(space);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);

  richEl.dispatchEvent(new Event("input", { bubbles: true }));
  hideLinkDrop();
}

// Close dropdown + slash menu on outside click
document.addEventListener("mousedown", e => {
  if (_linkDrop && !_linkDrop.contains(e.target)) hideLinkDrop();
  if (_slashMenu && !_slashMenu.contains(e.target)) hideSlashMenu();
});

// ── Quest link / lore link / location link popups ────────────────────────────
function showQuestLinkPopup(questId) {
  const q = quests.find(x => x.id === questId);
  if (!q) return;
  const popup = getCharPopup();
  const inner = popup.querySelector(".char-popup-inner");
  inner.innerHTML = `
    <div class="char-popup-details">
      <h2 class="char-popup-name">${esc(q.title || "")}</h2>
      <div class="char-popup-tags">
        <span class="char-popup-tag">${q.type === "main" ? "Main Quest" : "Side Quest"}</span>
        ${q.location ? `<span class="char-popup-tag">&#128205; ${esc(q.location)}</span>` : ""}
        <span class="char-popup-tag">${STATUS_LABEL[q.status] || "Unknown"}</span>
      </div>
    </div>
  `;
  popup.style.display = "flex";
}
function showLoreLinkPopup(loreId) {
  const l = allLoreItems.find(x => x.id === loreId);
  if (!l) return;
  const popup = getCharPopup();
  const inner = popup.querySelector(".char-popup-inner");
  inner.innerHTML = `
    <div class="char-popup-details">
      <h2 class="char-popup-name">${l.type === "scroll" ? "📜" : "📖"} ${esc(l.title || "")}</h2>
      <div class="char-popup-tags">
        ${l.writer ? `<span class="char-popup-tag">by ${esc(l.writer)}</span>` : ""}
      </div>
      ${l.content ? `<p class="char-popup-desc">${escBr(l.content)}</p>` : ""}
    </div>
  `;
  popup.style.display = "flex";
}
function showLocLinkPopup(locName) {
  const popup = getCharPopup();
  const inner = popup.querySelector(".char-popup-inner");
  inner.innerHTML = `
    <div class="char-popup-details">
      <h2 class="char-popup-name">&#128205; ${esc(locName)}</h2>
      <p class="char-popup-desc">See this location on the map.</p>
    </div>
  `;
  popup.style.display = "flex";
}

// Global click delegation for all link chip types (card view + editor + preview)
function handleLinkChipClick(e) {
  const chip = e.target.closest(".char-mention, .quest-link, .lore-link, .loc-link");
  if (!chip) return;
  e.stopPropagation();
  const kind = chip.dataset.linkKind || (chip.classList.contains("char-mention") ? "char" : "");
  const id   = chip.dataset.linkId   || chip.dataset.charId || "";
  const name = chip.dataset.linkName || chip.dataset.charName || "";
  if (kind === "char" || chip.classList.contains("char-mention")) showCharacterPopup(id);
  else if (kind === "quest") showQuestLinkPopup(id);
  else if (kind === "lore")  showLoreLinkPopup(id);
  else if (kind === "loc")   showLocLinkPopup(name);
}
document.addEventListener("click", handleLinkChipClick);

// ═══════════════════════════════════════════════════════════════════════════
// SESSION MARKER POPUP
// ═══════════════════════════════════════════════════════════════════════════
let _sessionPop = null;
function getSessionPop() {
  if (!_sessionPop) {
    _sessionPop = document.createElement("div");
    _sessionPop.className = "session-input-pop";
    _sessionPop.style.display = "none";
    document.body.appendChild(_sessionPop);
    document.addEventListener("mousedown", e => {
      if (!_sessionPop.contains(e.target) && !e.target.closest(".blk-session-btn")) {
        _sessionPop.style.display = "none";
      }
    });
  }
  return _sessionPop;
}

function openSessionPopup(anchorBtn, blockIndex) {
  const pop = getSessionPop();
  const block = currentBlocks[blockIndex];
  if (!block) return;
  pop.innerHTML = `
    <div class="session-input-pop-label">Session marker</div>
    <input type="text" placeholder="e.g. Session 4" value="${esc(block.sessionMarker || "")}" />
    <div class="session-input-pop-actions">
      <button type="button" class="session-input-pop-btn" data-act="save">Save</button>
      <button type="button" class="session-input-pop-btn danger" data-act="clear">Clear</button>
    </div>
  `;
  const input = pop.querySelector("input");
  pop.querySelector('[data-act="save"]').addEventListener("click", () => {
    const val = input.value.trim();
    block.sessionMarker = val || null;
    pop.style.display = "none";
    onEditTick();
    buildBlocksEditor();
  });
  pop.querySelector('[data-act="clear"]').addEventListener("click", () => {
    block.sessionMarker = null;
    pop.style.display = "none";
    onEditTick();
    buildBlocksEditor();
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); pop.querySelector('[data-act="save"]').click(); }
    if (e.key === "Escape") pop.style.display = "none";
  });
  const rect = anchorBtn.getBoundingClientRect();
  pop.style.display = "flex";
  pop.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
  pop.style.top  = `${rect.bottom + 6}px`;
  input.focus();
  input.select();
}

// Color a session label deterministically from its string
function sessionColorClass(marker) {
  if (!marker) return "";
  let hash = 0;
  for (let i = 0; i < marker.length; i++) hash = (hash * 31 + marker.charCodeAt(i)) >>> 0;
  return `session-color-${(hash % 8) + 1}`;
}
