'use strict';
import { db }                              from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { formatGold }                      from "./item-utils.js";

const _session = (() => { try { return JSON.parse(localStorage.getItem('playerSession')); } catch { return null; } })();
const isAdmin = _session?.role === 'admin';
const cid = _session?.campaignId;
if (!cid) { window.location.href = '/campaigns'; throw new Error('No campaign selected'); }
const questsRef  = ref(db, `campaigns/${cid}/quests`);
const markersRef = ref(db, `campaigns/${cid}/markers`);

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
let searchQuery     = "";
let editingId         = null;
let currentBlocks     = [];
let currentCellColors = {};   // legacy — retained only for old-draft compatibility
let currentGiver         = null;            // { id, name, picture, profession }
let currentRewards       = { xp: "", gold: "", items: [] };
let currentObjectives    = [];              // [{ id, text, done }]
let currentPrerequisites = [];              // [questId]
let currentRecommendedLevel = "";
let firebaseTemplates = [];   // enemy templates from Firebase
let allItems          = [];   // items from Firebase items tab
let allLoreItems      = [];   // lore items from Firebase lore tab
let allCharacters     = [];   // characters from Firebase characters tab


// ── Infinite canvas state ─────────────────────────────────────────────────────
const BLOCK_DEFAULT_W = 300;
const BLOCK_DEFAULT_H = 220;
const SNAP_THRESHOLD  = 10;
let canvasZoom      = 1;
let canvasPanX      = 20;
let canvasPanY      = 20;
let canvasWorld     = null;   // the world div inside qmBlockCanvas
let blockDragState   = null;  // {index, startClientX, startClientY, startWorldX, startWorldY, wrap}
let blockResizeState = null;  // {index, dir, startClientX, startClientY, startW, startH, wrap}
let canvasPanState   = null;  // {startX, startY, startPanX, startPanY}

let currentConnections = [];  // [{id, from, fromSide, to, toSide, label}]
let connDragState = null;    // {fromId, fromSide, curX, curY, snapToId, snapToSide}
let canvasSvg     = null;  // the SVG overlay element
let selectedBlockSet = new Set(); // indices of selected blocks
let blockClipboard   = null;      // deep copy of a block for paste
let marqueeState     = null;      // {startCX, startCY} – screen-space coords rel. to canvas rect
let currentGroups    = [];        // [{id, title, color, indices}]

function migrateBlock(b) {
  if (b.worldX === undefined && b.worldY === undefined) {
    b.worldX = ((b.col  || 1) - 1) * 320;
    b.worldY = ((b.row  || 1) - 1) * 240;
    b.width  = (b.span    || 1) * BLOCK_DEFAULT_W + Math.max(0, (b.span    || 1) - 1) * 20;
    b.height = (b.rowSpan || 1) * BLOCK_DEFAULT_H + Math.max(0, (b.rowSpan || 1) - 1) * 20;
  }
  return b;
}

// ── Stable IDs ────────────────────────────────────────────────────────────────
// Blocks carry a permanent `id`; connections and groups reference blocks by that
// id (never array index) so deletes/pastes/reorders can never desync them.
function newId() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function blockById(id)   { return currentBlocks.find(b => b.id === id); }
function blockIndexById(id) { return currentBlocks.findIndex(b => b.id === id); }
function blockElById(id)  { return canvasWorld?.querySelector(`[data-block-id="${id}"]`); }

// Normalise a quest's blocks/connections/groups onto stable ids. Accepts legacy
// index-based connections ({from:Number}) and groups ({indices:[Number]}) and
// rewrites them in place. Safe to run on already-migrated (id-based) data.
function migrateRefsToIds(blocks, connections, groups) {
  blocks.forEach(b => { if (!b.id) b.id = newId(); });
  const idAt = i => (typeof i === "number" ? blocks[i]?.id : i);
  const conns = (connections || []).map(c => ({
    ...c, from: idAt(c.from), to: idAt(c.to),
  })).filter(c => c.from && c.to && blocks.some(b => b.id === c.from) && blocks.some(b => b.id === c.to));
  const grps = (groups || []).map(g => {
    const blockIds = (g.blockIds || (g.indices || []).map(idAt)).filter(id => id && blocks.some(b => b.id === id));
    return { id: g.id || newId(), title: g.title || "", color: g.color || "#ffcc66", blockIds };
  }).filter(g => g.blockIds.length > 0);
  return { conns, grps };
}

function applyCanvasTransform() {
  if (!canvasWorld) return;
  canvasWorld.style.transform = `translate(${canvasPanX}px,${canvasPanY}px) scale(${canvasZoom})`;
}

// rAF-throttled version for high-frequency paths (wheel, pointermove, touchmove)
let _canvasRafPending = false;
function scheduleCanvasTransform() {
  if (_canvasRafPending) return;
  _canvasRafPending = true;
  requestAnimationFrame(() => { applyCanvasTransform(); _canvasRafPending = false; });
}

// Cached rect — invalidated on resize to avoid layout reads inside touch handlers
let _canvasRectCache = null;
function _getCanvasRect() { return (_canvasRectCache ??= qmBlockCanvas.getBoundingClientRect()); }
window.addEventListener('resize', () => { _canvasRectCache = null; }, { passive: true });

function resetCanvasView() {
  canvasZoom = 1; canvasPanX = 20; canvasPanY = 20;
  applyCanvasTransform();
}

// World coordinates currently at the centre of the visible canvas viewport.
function canvasCenterWorld() {
  const rect = _getCanvasRect() || qmBlockCanvas.getBoundingClientRect();
  return {
    x: (rect.width  / 2 - canvasPanX) / canvasZoom,
    y: (rect.height / 2 - canvasPanY) / canvasZoom,
  };
}
// Top-left for a new block so its centre lands on the viewport centre, with a
// small cascade offset so repeated adds don't stack exactly on top of each other.
function centeredBlockOrigin(w = BLOCK_DEFAULT_W, h = BLOCK_DEFAULT_H) {
  const c = canvasCenterWorld();
  const stagger = (currentBlocks.length % 6) * 26;
  return { x: Math.round(c.x - w / 2 + stagger), y: Math.round(c.y - h / 2 + stagger) };
}

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

function applyBlockBgColor(wrap, color) {
  wrap.style.background = "";
  if (color) {
    wrap.style.setProperty("--blk-cc", color);
    wrap.classList.add("blk-colored");
  } else {
    wrap.style.removeProperty("--blk-cc");
    wrap.classList.remove("blk-colored");
  }
}

const CONN_SIDES = ['top', 'right', 'bottom', 'left'];

function blockPortPos(block, side, el) {
  const w = block.width || BLOCK_DEFAULT_W;
  const h = el ? el.offsetHeight : (block.height || BLOCK_DEFAULT_H);
  switch (side) {
    case 'top':    return { x: block.worldX + w / 2, y: block.worldY };
    case 'right':  return { x: block.worldX + w,     y: block.worldY + h / 2 };
    case 'bottom': return { x: block.worldX + w / 2, y: block.worldY + h };
    case 'left':   return { x: block.worldX,          y: block.worldY + h / 2 };
  }
}

function sideControlVec(side, d) {
  switch (side) {
    case 'right':  return { dx: d, dy: 0 };
    case 'left':   return { dx: -d, dy: 0 };
    case 'bottom': return { dx: 0, dy: d };
    case 'top':    return { dx: 0, dy: -d };
    default:       return { dx: d, dy: 0 };
  }
}

// ── Group helpers ─────────────────────────────────────────────────────────────
const GROUP_PAD = 20, GROUP_TOP = 38;

function getGroupBounds(group) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (group.blockIds || []).forEach(id => {
    const b = blockById(id);
    if (!b) return;
    const el = blockElById(id);
    const w = b.width || BLOCK_DEFAULT_W;
    const h = el?.offsetHeight || b.height || BLOCK_DEFAULT_H;
    minX = Math.min(minX, b.worldX || 0); minY = Math.min(minY, b.worldY || 0);
    maxX = Math.max(maxX, (b.worldX || 0) + w);
    maxY = Math.max(maxY, (b.worldY || 0) + h);
  });
  if (!isFinite(minX)) return null;
  return { x: minX - GROUP_PAD, y: minY - GROUP_TOP, w: maxX - minX + GROUP_PAD * 2, h: maxY - minY + GROUP_TOP + GROUP_PAD };
}

function buildGroupsInEditor() {
  canvasWorld?.querySelectorAll(".blk-group").forEach(el => el.remove());
  currentGroups.forEach((group, gi) => {
    const bounds = getGroupBounds(group);
    if (!bounds) return;

    const el = document.createElement("div");
    el.className = "blk-group";
    el.dataset.groupIndex = String(gi);
    el.style.left = bounds.x + "px"; el.style.top = bounds.y + "px";
    el.style.width = bounds.w + "px"; el.style.height = bounds.h + "px";
    const col = group.color || "#ffcc66";
    el.style.background   = hexToRgba(col, 0.1);
    el.style.borderColor  = hexToRgba(col, 0.45);
    el.style.setProperty("--grp-col", col);

    el.innerHTML = `
      <div class="blk-group-header">
        <input class="blk-group-title" type="text" value="${esc(group.title || "")}" placeholder="Group name…" />
        <label class="blk-group-color-label" title="Group color">
          <span class="blk-group-swatch" style="background:${col}"></span>
          <input type="color" class="blk-group-color-pick" value="${col}" />
        </label>
        <button type="button" class="blk-group-del" title="Ungroup (keeps blocks)"><iconify-icon icon="lucide:x"></iconify-icon></button>
      </div>`;

    const titleInp = el.querySelector(".blk-group-title");
    titleInp.addEventListener("input", e2 => { currentGroups[gi].title = e2.target.value; onEditTick(); renderOutline(); });
    titleInp.addEventListener("pointerdown", e2 => e2.stopPropagation());

    const colorPick = el.querySelector(".blk-group-color-pick");
    const swatch = el.querySelector(".blk-group-swatch");
    colorPick.addEventListener("input", e2 => {
      currentGroups[gi].color = e2.target.value;
      el.style.background  = hexToRgba(e2.target.value, 0.1);
      el.style.borderColor = hexToRgba(e2.target.value, 0.45);
      el.style.setProperty("--grp-col", e2.target.value);
      swatch.style.background = e2.target.value;
      onEditTick();
    });
    colorPick.addEventListener("pointerdown", e2 => e2.stopPropagation());

    el.querySelector(".blk-group-del").addEventListener("click", () => {
      currentGroups.splice(gi, 1);
      onEditTick();
      buildGroupsInEditor();
    });

    // Drag group header → move all member blocks
    const hdr = el.querySelector(".blk-group-header");
    hdr.addEventListener("pointerdown", e2 => {
      if (e2.button !== 0) return;
      if (e2.target.closest("button, input, label")) return;
      e2.stopPropagation();
      hdr.setPointerCapture(e2.pointerId);
      const members = (group.blockIds || []).map(id => blockById(id)).filter(Boolean).map(b => ({
        id: b.id,
        startX: b.worldX || 0,
        startY: b.worldY || 0,
        el: blockElById(b.id),
      }));
      const startCX = e2.clientX, startCY = e2.clientY;
      const startBX = bounds.x, startBY = bounds.y;

      const onMove = e3 => {
        const dx = (e3.clientX - startCX) / canvasZoom;
        const dy = (e3.clientY - startCY) / canvasZoom;
        members.forEach(m => {
          const b = blockById(m.id);
          if (!b) return;
          b.worldX = m.startX + dx; b.worldY = m.startY + dy;
          if (m.el) { m.el.style.left = b.worldX + "px"; m.el.style.top = b.worldY + "px"; }
        });
        el.style.left = (startBX + dx) + "px"; el.style.top = (startBY + dy) + "px";
        renderConnections();
      };
      const onUp = () => {
        hdr.removeEventListener("pointermove", onMove);
        hdr.removeEventListener("pointerup", onUp);
        onEditTick();
        requestAnimationFrame(buildGroupsInEditor);
      };
      hdr.addEventListener("pointermove", onMove);
      hdr.addEventListener("pointerup", onUp);
    });

    canvasWorld.appendChild(el);
  });
}

// Drop a set of block ids from blocks, connections and groups (no index math).
function deleteBlocksByIds(ids) {
  const drop = new Set(ids);
  currentBlocks = currentBlocks.filter(b => !drop.has(b.id));
  currentConnections = currentConnections.filter(c => !drop.has(c.from) && !drop.has(c.to));
  currentGroups = currentGroups
    .map(g => ({ ...g, blockIds: g.blockIds.filter(id => !drop.has(id)) }))
    .filter(g => g.blockIds.length > 0);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


onValue(ref(db, `campaigns/${cid}/enemyTemplates`), snap => {
  const data = snap.val();
  firebaseTemplates = data ? Object.values(data) : [];
});

onValue(ref(db, `campaigns/${cid}/items`), snap => {
  const data = snap.val();
  allItems = data ? Object.values(data) : [];
});

onValue(ref(db, `campaigns/${cid}/lore`), snap => {
  const data = snap.val();
  allLoreItems = data ? Object.values(data) : [];
});

onValue(ref(db, `campaigns/${cid}/characters`), snap => {
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

document.getElementById("qm-zoom-reset-btn")?.addEventListener("click", resetCanvasView);

// ── Infinite canvas: wheel zoom ───────────────────────────────────────────────
qmBlockCanvas.addEventListener("wheel", e => {
  if (e.target.closest(".blk-body")) return;
  e.preventDefault();
  const rect = _getCanvasRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.max(0.15, Math.min(3, canvasZoom * factor));
  const wx = (mouseX - canvasPanX) / canvasZoom;
  const wy = (mouseY - canvasPanY) / canvasZoom;
  canvasPanX = mouseX - wx * newZoom;
  canvasPanY = mouseY - wy * newZoom;
  canvasZoom = newZoom;
  scheduleCanvasTransform();
}, { passive: false });

// ── Marquee helper ────────────────────────────────────────────────────────────
const marqueeEl = document.createElement("div");
marqueeEl.className = "canvas-marquee";
marqueeEl.style.display = "none";
qmBlockCanvas.appendChild(marqueeEl);

function refreshSelectionClasses() {
  canvasWorld?.querySelectorAll(".qm-block").forEach(el => {
    el.classList.toggle("blk-selected", selectedBlockSet.has(el.dataset.blockId));
  });
  document.getElementById("qm-outline")?.querySelectorAll(".qm-ol-item").forEach(el => {
    el.classList.toggle("sel", selectedBlockSet.has(el.dataset.id));
  });
}

// ── Infinite canvas: middle-mouse pans, left-mouse marquee-selects ────────────
qmBlockCanvas.addEventListener("mousedown", e => { if (e.button === 1) e.preventDefault(); });
qmBlockCanvas.addEventListener("pointerdown", e => {
  if (e.pointerType === 'touch') return; // touch handled separately below
  if (blockDragState) return;

  if (e.button === 1) {
    // Middle mouse → pan (from anywhere on the canvas)
    canvasPanState = { startX: e.clientX, startY: e.clientY, startPanX: canvasPanX, startPanY: canvasPanY };
    qmBlockCanvas.setPointerCapture(e.pointerId);
    qmBlockCanvas.style.cursor = "grabbing";
    e.preventDefault();
    return;
  }

  if (e.button === 0) {
    // Left mouse → marquee select. Start it over empty canvas, the world, or a
    // group's background — but not on a block, a group header, a connection, or
    // any interactive control (those have their own handlers).
    if (e.target.closest(".qm-block, .blk-group-header, svg, button, input, select, label, a, textarea, [contenteditable]")) return;
    if (!e.shiftKey) { selectedBlockSet.clear(); refreshSelectionClasses(); }
    const rect = _getCanvasRect();
    marqueeState = { startCX: e.clientX - rect.left, startCY: e.clientY - rect.top };
    qmBlockCanvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
});
qmBlockCanvas.addEventListener("pointermove", e => {
  if (e.pointerType === 'touch') return;
  if (canvasPanState) {
    canvasPanX = canvasPanState.startPanX + (e.clientX - canvasPanState.startX);
    canvasPanY = canvasPanState.startPanY + (e.clientY - canvasPanState.startY);
    scheduleCanvasTransform();
    return;
  }
  if (marqueeState) {
    const rect = _getCanvasRect();
    const curCX = e.clientX - rect.left, curCY = e.clientY - rect.top;
    const x = Math.min(marqueeState.startCX, curCX);
    const y = Math.min(marqueeState.startCY, curCY);
    const w = Math.abs(curCX - marqueeState.startCX);
    const h = Math.abs(curCY - marqueeState.startCY);
    if (w > 4 || h > 4) {
      marqueeEl.style.display = "block";
      marqueeEl.style.left = x + "px"; marqueeEl.style.top  = y + "px";
      marqueeEl.style.width = w + "px"; marqueeEl.style.height = h + "px";
    }
  }
});
qmBlockCanvas.addEventListener("pointerup", e => {
  if (canvasPanState) { canvasPanState = null; qmBlockCanvas.style.cursor = ""; return; }
  if (marqueeState) {
    const rect = _getCanvasRect();
    const curCX = e.clientX - rect.left, curCY = e.clientY - rect.top;
    const sx1 = Math.min(marqueeState.startCX, curCX), sx2 = Math.max(marqueeState.startCX, curCX);
    const sy1 = Math.min(marqueeState.startCY, curCY), sy2 = Math.max(marqueeState.startCY, curCY);
    if (sx2 - sx1 > 4 || sy2 - sy1 > 4) {
      // Convert screen marquee to world space
      const wx1 = (sx1 - canvasPanX) / canvasZoom, wy1 = (sy1 - canvasPanY) / canvasZoom;
      const wx2 = (sx2 - canvasPanX) / canvasZoom, wy2 = (sy2 - canvasPanY) / canvasZoom;
      currentBlocks.forEach(b => {
        const bel = blockElById(b.id);
        const bx1 = b.worldX || 0, by1 = b.worldY || 0;
        const bx2 = bx1 + (b.width || BLOCK_DEFAULT_W);
        const by2 = by1 + (bel?.offsetHeight || b.height || BLOCK_DEFAULT_H);
        if (bx2 > wx1 && bx1 < wx2 && by2 > wy1 && by1 < wy2) selectedBlockSet.add(b.id);
      });
      refreshSelectionClasses();
    }
    marqueeEl.style.display = "none";
    marqueeState = null;
  }
});

// ── Touch: single-finger pan + two-finger pinch-to-zoom ───────────────────────
const _ct = { pinch: false, dist0: 0, zoom0: 1, panX0: 0, panY0: 0, midX0: 0, midY0: 0,
              pan: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };

qmBlockCanvas.addEventListener('touchstart', e => {
  // Let touches on blocks propagate — blocks handle their own drag via pointer events
  if (e.touches.length === 1 && e.target.closest('.qm-block')) return;
  e.preventDefault();
  _canvasRectCache = qmBlockCanvas.getBoundingClientRect();
  // Promote to GPU layer only for the duration of the gesture
  if (canvasWorld) canvasWorld.style.willChange = 'transform';

  if (e.touches.length >= 2) {
    _ct.pan = false; _ct.pinch = true;
    const [t0, t1] = [e.touches[0], e.touches[1]];
    _ct.dist0 = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    _ct.zoom0 = canvasZoom; _ct.panX0 = canvasPanX; _ct.panY0 = canvasPanY;
    _ct.midX0 = (t0.clientX + t1.clientX) / 2 - _canvasRectCache.left;
    _ct.midY0 = (t0.clientY + t1.clientY) / 2 - _canvasRectCache.top;
  } else if (e.touches.length === 1) {
    _ct.pinch = false; _ct.pan = true;
    _ct.startX = e.touches[0].clientX; _ct.startY = e.touches[0].clientY;
    _ct.startPanX = canvasPanX; _ct.startPanY = canvasPanY;
  }
}, { passive: false });

qmBlockCanvas.addEventListener('touchmove', e => {
  if (e.target.closest('.qm-block') && !_ct.pinch) return;
  e.preventDefault();
  const rect = _canvasRectCache || qmBlockCanvas.getBoundingClientRect();

  if (_ct.pinch && e.touches.length >= 2) {
    const [t0, t1] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
    const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
    const newZoom = Math.max(0.15, Math.min(3, _ct.zoom0 * (dist / _ct.dist0)));
    // World point that was under the initial pinch midpoint stays under the current midpoint
    const wx = (_ct.midX0 - _ct.panX0) / _ct.zoom0;
    const wy = (_ct.midY0 - _ct.panY0) / _ct.zoom0;
    canvasZoom = newZoom;
    canvasPanX = midX - wx * newZoom;
    canvasPanY = midY - wy * newZoom;
    scheduleCanvasTransform();
  } else if (_ct.pan && e.touches.length === 1) {
    canvasPanX = _ct.startPanX + (e.touches[0].clientX - _ct.startX);
    canvasPanY = _ct.startPanY + (e.touches[0].clientY - _ct.startY);
    scheduleCanvasTransform();
  }
}, { passive: false });

qmBlockCanvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) _ct.pinch = false;
  if (e.touches.length === 0) {
    _ct.pan = false;
    // Release GPU layer after the last frame settles (2 rAF to avoid flicker on release)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (canvasWorld) canvasWorld.style.willChange = '';
    }));
    return;
  }
  // One finger remains after lifting pinch — restart pan from current position
  if (!_ct.pinch && e.touches.length === 1) {
    _ct.pan = true;
    _ct.startX = e.touches[0].clientX; _ct.startY = e.touches[0].clientY;
    _ct.startPanX = canvasPanX; _ct.startPanY = canvasPanY;
  }
}, { passive: true });

// ── Palette drag → canvas: drop to place at cursor position ───────────────────
qmBlockCanvas.addEventListener("dragover", e => {
  if (dragPaletteType === null && dragPaletteTemplate === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
qmBlockCanvas.addEventListener("drop", e => {
  if (dragPaletteType === null && dragPaletteTemplate === null) return;
  e.preventDefault();
  const rect = qmBlockCanvas.getBoundingClientRect();
  const worldX = (e.clientX - rect.left - canvasPanX) / canvasZoom - BLOCK_DEFAULT_W / 2;
  const worldY = (e.clientY - rect.top  - canvasPanY) / canvasZoom - BLOCK_DEFAULT_H / 2;
  if (dragPaletteType !== null) {
    currentBlocks.push({ ...BLOCK_DEFAULTS[dragPaletteType], id: newId(), worldX, worldY, width: BLOCK_DEFAULT_W, height: BLOCK_DEFAULT_H });
    dragPaletteType = null;
  } else if (dragPaletteTemplate !== null) {
    // Centre the template's bounding box on the drop point (cursor in world space)
    applyTemplateAtPosition(dragPaletteTemplate,
      (e.clientX - rect.left - canvasPanX) / canvasZoom,
      (e.clientY - rect.top  - canvasPanY) / canvasZoom);
    dragPaletteTemplate = null;
  }
  qmBlockCanvas.classList.remove("qm-drag-active");
  onEditTick();
  buildBlocksEditor();
});

// ── Firebase: quests ──────────────────────────────────────────────────────────
let _questRestoredOnLoad = false;
onValue(questsRef, snapshot => {
  const data = snapshot.val();
  quests = data ? Object.values(data) : [];
  renderGrid();
  if (!_questRestoredOnLoad) {
    _questRestoredOnLoad = true;
    const savedId = loadPageState().openQuestId;
    if (savedId) {
      const q = quests.find(x => x.id === savedId);
      if (q) openQuestView(q);
    }
  }
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
  if (questModal.classList.contains("open")) onEditTick();
});
qmLocationDrop.addEventListener("keydown", e => {
  if (e.key === "Enter") { qmLocationInp.value = document.activeElement.dataset.name || ""; hideDrop(qmLocationDrop); }
  if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
  if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || qmLocationInp).focus(); }
  if (e.key === "Escape") hideDrop(qmLocationDrop);
});
qmLocationInp.addEventListener("blur", () => setTimeout(() => hideDrop(qmLocationDrop), 150));

function hideDrop(el) { if (el) el.style.display = "none"; }

// ── Filter tabs (desktop) + dropdown (mobile) ─────────────────────────────────
const questFilterSelect = document.getElementById("quest-filter-select");
function setQuestFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".quest-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === filter));
  if (questFilterSelect) questFilterSelect.value = filter;
  renderGrid();
}
document.querySelectorAll(".quest-tab").forEach(tab => {
  tab.addEventListener("click", () => setQuestFilter(tab.dataset.filter));
});
questFilterSelect?.addEventListener("change", () => setQuestFilter(questFilterSelect.value));

// ── Search (matches quest title + deep content: NPCs, items, places, lore…) ───
const questSearch      = document.getElementById("quest-search");
const questSearchClear = document.getElementById("quest-search-clear");
function _updateQuestSearchClear() {
  if (questSearchClear && questSearch) questSearchClear.classList.toggle("visible", questSearch.value.length > 0);
}
questSearch?.addEventListener("input", e => { searchQuery = e.target.value; _updateQuestSearchClear(); renderGrid(); });
questSearchClear?.addEventListener("click", () => {
  questSearch.value = ""; searchQuery = ""; _updateQuestSearchClear(); renderGrid(); questSearch.focus();
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
const qsCompleted = document.getElementById("qs-completed");
const qsMain      = document.getElementById("qs-main");
const qsSide      = document.getElementById("qs-side");

function updateQuestStats() {
  const all = isAdmin ? quests : quests.filter(q => q.discovered);
  if (qsCompleted) qsCompleted.textContent = all.filter(q => q.status === "completed").length;
  if (qsMain)      qsMain.textContent      = all.filter(q => q.type   === "main").length;
  if (qsSide)      qsSide.textContent      = all.filter(q => q.type   === "side").length;
}

function renderGrid() {
  questGrid.innerHTML = "";
  updateQuestStats();
  let visible = quests.filter(q => {
    if (!isAdmin && !q.discovered) return false;
    if (activeFilter === "all")       return true;
    if (activeFilter === "main")      return q.type === "main";
    if (activeFilter === "side")      return q.type === "side";
    if (activeFilter === "active")    return q.status === "active";
    if (activeFilter === "completed") return q.status === "completed";
    return true;
  });

  // Search: keep quests whose title matches or that contain the query somewhere
  // in their content; stash the matches on the quest for the card to display.
  const ql = searchQuery.trim().toLowerCase();
  visible.forEach(q => { q._searchMatches = null; });
  if (ql) {
    visible = visible.filter(q => {
      const titleHit = (q.title || "").toLowerCase().includes(ql);
      const ms = questSearchMatches(q, ql);
      q._searchMatches = ms;
      return titleHit || ms.length > 0;
    });
  }
  const statusOrder = { active: 0, not_started: 1, completed: 2 };
  // Sort by explicit order first; fall back to status then title for unordered quests
  visible.sort((a, b) => {
    const ao = a.order ?? 9999, bo = b.order ?? 9999;
    if (ao !== bo) return ao - bo;
    const so = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    return so !== 0 ? so : (a.title || "").localeCompare(b.title || "");
  });

  questEmpty.style.display = visible.length === 0 ? "block" : "none";
  visible.forEach(q => {
    const card = buildCard(q);
    // Wrap every card so it can be swiped to delete on mobile (admin only).
    // On desktop the wrapper is display:contents, so layout is unchanged.
    const swipe = document.createElement("div");
    swipe.className = "quest-swipe";
    if (isAdmin) {
      const del = document.createElement("div");
      del.className = "quest-swipe-delete";
      del.innerHTML = '<iconify-icon icon="lucide:trash-2"></iconify-icon>';
      swipe.appendChild(del);
      attachQuestSwipeToDelete(swipe, card, q);
    }
    swipe.appendChild(card);
    questGrid.appendChild(swipe);
  });

  // Restore scroll position after DOM settles
  const state = loadPageState();
  if (state.scrollY) requestAnimationFrame(() => window.scrollTo({ top: state.scrollY, behavior: "instant" }));
}

// ── Quest card ────────────────────────────────────────────────────────────────
const STATUS_LABEL = { active: "Active", not_started: "Not Started", completed: "Completed" };
const STATUS_CLASS = { active: "status-active", not_started: "status-pending", completed: "status-done" };

const BLOCK_TYPE_ICON  = { text:'<iconify-icon icon="lucide:type"></iconify-icon>', phase:'<iconify-icon icon="lucide:chevron-right"></iconify-icon>', loot:'<iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon>', boss:'<iconify-icon icon="game-icons:death-skull"></iconify-icon>', encounter:'<iconify-icon icon="game-icons:crossed-swords"></iconify-icon>', puzzle:'<iconify-icon icon="game-icons:puzzle"></iconify-icon>', character:'<iconify-icon icon="lucide:user"></iconify-icon>', loreref:'<iconify-icon icon="game-icons:bookshelf"></iconify-icon>', note:'<iconify-icon icon="lucide:file-text"></iconify-icon>', divider:'<iconify-icon icon="lucide:minus"></iconify-icon>' };
const BLOCK_TYPE_LABEL = { text:"Text", phase:"Phase", loot:"Loot", boss:"Enemy", encounter:"Encounter", puzzle:"Puzzle", character:"Character", loreref:"Lore", note:"DM Note", divider:"Divider" };

function buildBlockROContent(b) {
  const titleHtml = b.blockTitle && b.type !== "divider"
    ? `<div class="qcro-block-title"${b.titleColor ? ` style="color:${esc(b.titleColor)}"` : ""}>${esc(b.blockTitle)}</div>`
    : "";
  switch (b.type) {
    case "text":
      return titleHtml + `<div class="qcro-text">${contentToHtml(b.content || "")}</div>`;
    case "phase":
      return titleHtml +
        `<div class="qcro-phase-title"><iconify-icon icon="lucide:chevron-right"></iconify-icon> ${esc(b.title || "Phase")}</div>` +
        (b.description ? `<div class="qcro-text">${contentToHtml(b.description)}</div>` : "");
    case "loot": {
      const items = b.items?.length ? b.items : (b.name ? [{name:b.name,value:b.value||""}] : []);
      if (!items.length) return titleHtml;
      return titleHtml + items.map(it => `<div class="qcro-loot-row"><iconify-icon icon="game-icons:open-treasure-chest" class="qcb-loot-icon"></iconify-icon><span>${esc(it.name)}</span>${it.value ? `<span class="qcb-loot-value">${esc(it.value)}</span>` : ""}</div>`).join("");
    }
    case "boss": {
      const enemies = b.enemies?.length ? b.enemies : (b.name ? [{name:b.name,cr:b.cr||"",ac:b.ac||"",hp:b.hp||"",notes:b.notes||""}] : []);
      if (!enemies.length) return titleHtml;
      return titleHtml + enemies.map(en => `<div class="qcro-boss-row"><iconify-icon icon="game-icons:death-skull" class="qcb-boss-icon"></iconify-icon><span class="qcb-boss-name">${esc(en.name)}</span>${en.cr?`<span class="qcb-boss-stat">CR ${esc(en.cr)}</span>`:""}${en.ac?`<span class="qcb-boss-stat">AC ${esc(en.ac)}</span>`:""}${en.hp?`<span class="qcb-boss-stat">HP ${esc(en.hp)}</span>`:""}</div>${en.notes?`<p class="qcro-text">${escBr(en.notes)}</p>`:""}`).join("");
    }
    case "encounter": {
      const enemies = b.enemies?.length ? b.enemies : [];
      if (!enemies.length) return titleHtml;
      return titleHtml + enemies.map(en => `<div class="qcro-boss-row"><iconify-icon icon="game-icons:crossed-swords" class="qcb-encounter-icon"></iconify-icon><span class="qcb-boss-name">${esc(en.name)}${en.count > 1 ? ` ×${en.count}` : ""}</span>${en.cr?`<span class="qcb-boss-stat">CR ${esc(en.cr)}</span>`:""}${en.ac?`<span class="qcb-boss-stat">AC ${esc(en.ac)}</span>`:""}${en.hp?`<span class="qcb-boss-stat">HP ${esc(en.hp)}</span>`:""}</div>`).join("");
    }
    case "puzzle":
      return titleHtml +
        `<div class="qcro-phase-title"><iconify-icon icon="game-icons:puzzle"></iconify-icon> ${esc(b.title || "Puzzle")}</div>` +
        (b.description ? `<div class="qcro-text">${escBr(b.description)}</div>` : "") +
        (b.hint ? `<div class="qcro-hint"><iconify-icon icon="lucide:lightbulb"></iconify-icon> ${esc(b.hint)}</div>` : "") +
        (isAdmin && b.solution ? `<div class="qcro-solution"><iconify-icon icon="lucide:key"></iconify-icon> ${esc(b.solution)}</div>` : "");
    case "character": {
      const chars = b.characters || [];
      if (!chars.length) return titleHtml;
      return titleHtml + chars.map(ch => `<div class="qcro-char-row">${ch.picture?`<img class="char-item-pic" src="${esc(ch.picture)}" alt="">`:`<div class="char-item-pic char-item-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}<div><div class="char-item-name">${esc(ch.name)}</div>${ch.profession?`<div class="char-item-meta">${esc(ch.profession)}</div>`:""}</div></div>`).join("");
    }
    case "note":
      if (!isAdmin || !b.content) return "";
      return titleHtml + `<div class="qcro-note"><iconify-icon icon="lucide:file-text"></iconify-icon> ${escBr(b.content)}</div>`;
    case "loreref": {
      const items = b.items || [];
      if (!items.length) return titleHtml;
      return titleHtml + items.map(it => `<div class="qcro-lore-row"><iconify-icon icon="${it.type==="scroll"?"game-icons:scroll-unfurled":"game-icons:open-book"}"></iconify-icon><span>${esc(it.title||"")}</span></div>`).join("");
    }
    case "divider":
      return b.title ? `<div class="qcro-divider-line"><span>${esc(b.title)}</span></div>` : `<div class="qcro-divider-line"></div>`;
    default:
      return "";
  }
}

// Quest editing + the free-flow canvas need room and a precise pointer, so
// they're reserved for tablet/desktop. Phones get the read-only vertical flow.
const QUEST_WIDE_MIN = 768;
const isWideViewport = () => window.matchMedia(`(min-width:${QUEST_WIDE_MIN}px)`).matches;

// Short, human label for a block — used for branch links in the mobile flow.
function blockHeadline(b) {
  return b.blockTitle || b.title || b.name
    || b.characters?.[0]?.name || b.enemies?.[0]?.name || b.items?.[0]?.name
    || BLOCK_TYPE_LABEL[b.type] || b.type;
}

// Flatten spatially-placed blocks into a single reading order: top-to-bottom,
// grouping blocks whose top edges sit on roughly the same row, then left-to-right.
function orderBlocksForReading(blocks) {
  const ROW_GAP = 70;
  const items = blocks
    .map(b => ({ b, x: b.worldX || 0, y: b.worldY || 0 }))
    .sort((p, q) => p.y - q.y || p.x - q.x);
  const ordered = [];
  let row = [], rowTop = null;
  const flush = () => { row.sort((p, q) => p.x - q.x); ordered.push(...row.map(i => i.b)); row = []; };
  items.forEach(it => {
    if (rowTop === null) rowTop = it.y;
    else if (it.y - rowTop > ROW_GAP) { flush(); rowTop = it.y; }
    row.push(it);
  });
  flush();
  return ordered;
}

// Persist which flow sections/cards the DM expanded, per quest, in localStorage
// so leaving for another tab and coming back restores the same open/closed view.
const QFLOW_EXPAND_KEY = "qflowExpandState2";
function _loadFlowExpand() {
  try { return JSON.parse(localStorage.getItem(QFLOW_EXPAND_KEY) || "{}"); } catch (_) { return {}; }
}
function flowExpandGet(questId, key, dflt) {
  const q = _loadFlowExpand()[questId];
  return q && key in q ? q[key] : dflt;
}
function flowExpandSet(questId, key, open) {
  const s = _loadFlowExpand();
  (s[questId] = s[questId] || {})[key] = open;
  try { localStorage.setItem(QFLOW_EXPAND_KEY, JSON.stringify(s)); } catch (_) {}
}

// Mobile read-only view: a single-column vertical flow. Phase blocks and groups
// become collapsible sections; each item card is collapsible too. Explicit
// non-sequential connections surface as "leads to" branch links.
function buildQuestFlowDOM(q) {
  const blocks = q.blocks ? q.blocks.map(b => migrateBlock({ ...b })) : [];
  const { conns: connections, grps: groups } = migrateRefsToIds(blocks, q.connections, q.groups);

  const container = document.createElement("div");
  container.className = "qc-ro-flow";
  const qid = q.id || "_";

  const visible = blocks.filter(b => !(b.type === "note" && !isAdmin));
  if (!visible.length) {
    container.innerHTML = `<div class="qc-ro-empty">No blocks yet.</div>`;
    return container;
  }

  const ordered = orderBlocksForReading(visible);
  const byId = id => blocks.find(b => b.id === id);

  const groupById = {};
  groups.forEach(g => (g.blockIds || []).forEach(id => { if (!(id in groupById)) groupById[id] = g; }));

  const outConns = {};
  connections.forEach(c => { (outConns[c.from] = outConns[c.from] || []).push(c.to); });

  // One read-only card for a single block. Cards are individually collapsible
  // (state persisted) so the DM can reveal exactly what they want on screen.
  const makeCard = (b) => {
    const sessionPill = b.sessionMarker
      ? `<span class="qcro-session-pill ${sessionColorClass(b.sessionMarker)}">${esc(b.sessionMarker)}</span>` : "";
    const branchTos = (outConns[b.id] || []).filter(to => {
      const t = byId(to); return t && !(t.type === "note" && !isAdmin);
    });
    const branchHtml = branchTos.length
      ? `<div class="qflow-branch">${branchTos.map(to =>
          `<span class="qflow-branch-link"><iconify-icon icon="lucide:corner-down-right"></iconify-icon> ${esc(blockHeadline(byId(to)))}</span>`).join("")}</div>` : "";

    // Dividers are pure separators — render plain, not collapsible.
    if (b.type === "divider") {
      const div = document.createElement("div");
      div.className = "qflow-block qflow-divider qc-block-ro";
      div.dataset.session = b.sessionMarker || "";
      div.dataset.blockId = b.id;
      div.innerHTML = `<div class="blk-body">${buildBlockROContent(b)}</div>`;
      return div;
    }

    const det = document.createElement("details");
    det.className = "qflow-block qc-block-ro qflow-" + b.type;
    det.dataset.session = b.sessionMarker || "";
    det.dataset.blockId = b.id;
    if (b.bgColor) { det.style.setProperty("--blk-cc", b.bgColor); det.classList.add("blk-colored"); }

    const key = "card:" + b.id;
    det.open = flowExpandGet(qid, key, false);
    det.addEventListener("toggle", () => flowExpandSet(qid, key, det.open));

    const headline = blockHeadline(b);
    const showHeadline = headline && headline !== (BLOCK_TYPE_LABEL[b.type] || b.type);

    det.innerHTML = `
      <summary class="qflow-card-head">
        <span class="blk-type-icon">${BLOCK_TYPE_ICON[b.type] || ""}</span>
        <span class="blk-type-label">${BLOCK_TYPE_LABEL[b.type] || b.type}</span>
        ${showHeadline ? `<span class="qflow-card-headline">${esc(headline)}</span>` : ""}
        ${sessionPill}
        <iconify-icon icon="lucide:chevron-right" class="qflow-card-chevron"></iconify-icon>
      </summary>
      <div class="blk-body">${buildBlockROContent(b)}</div>
      ${branchHtml}`;
    return det;
  };

  // A collapsible <details> container for a phase or a group, holding its cards.
  const makeSection = (kind, key, info, children) => {
    const det = document.createElement("details");
    det.className = `qflow-section qflow-section-${kind}`;
    if (kind === "group" && info.color) det.style.setProperty("--gc", info.color);
    det.open = flowExpandGet(qid, key, false);
    det.addEventListener("toggle", () => flowExpandSet(qid, key, det.open));
    const n = children.length;
    det.innerHTML = `
      <summary class="qflow-section-head">
        <span class="qflow-section-icon">${info.icon}</span>
        <span class="qflow-section-title">${esc(info.title)}</span>
        <span class="qflow-section-count">${n} ${n === 1 ? "item" : "items"}</span>
        <iconify-icon icon="lucide:chevron-right" class="qflow-section-chevron"></iconify-icon>
      </summary>`;
    const body = document.createElement("div");
    body.className = "qflow-section-body";
    if (info.desc) {
      const d = document.createElement("div");
      d.className = "qflow-section-desc qcro-text";
      d.innerHTML = contentToHtml(info.desc);
      body.appendChild(d);
    }
    children.forEach(c => body.appendChild(makeCard(c)));
    det.appendChild(body);
    return det;
  };

  // Partition the reading order into render items. Explicit groups win; phase
  // blocks otherwise open a sequential container for the cards that follow.
  const items = [];
  const groupEntry = {};
  let currentPhase = null;
  ordered.forEach(b => {
    const g = groupById[b.id];
    if (g) {
      let e = groupEntry[g.id];
      if (!e) { e = { kind: "group", group: g, children: [] }; groupEntry[g.id] = e; items.push(e); }
      e.children.push(b);
      return;
    }
    if (b.type === "phase") {
      currentPhase = { kind: "phase", header: b, children: [] };
      items.push(currentPhase);
      return;
    }
    if (currentPhase) currentPhase.children.push(b);
    else items.push({ kind: "card", block: b });
  });

  items.forEach(item => {
    if (item.kind === "card") {
      container.appendChild(makeCard(item.block));
    } else if (item.kind === "phase") {
      const h = item.header;
      container.appendChild(makeSection("phase", "phase:" + h.id, {
        icon: '<iconify-icon icon="lucide:chevron-right"></iconify-icon>',
        title: h.title || h.blockTitle || "Phase",
        desc: h.description || "",
      }, item.children));
    } else {
      container.appendChild(makeSection("group", "group:" + item.group.id, {
        icon: '<iconify-icon icon="lucide:layers"></iconify-icon>',
        title: item.group.title || "Group",
        color: item.group.color || "#ffcc66",
      }, item.children));
    }
  });

  return container;
}

function buildQuestCanvasDOM(q) {
  const blocks = q.blocks ? q.blocks.map(b => migrateBlock({...b})) : [];
  const { conns: connections, grps: groups } = migrateRefsToIds(blocks, q.connections, q.groups);
  const localById = id => blocks.find(b => b.id === id);

  const container = document.createElement("div");
  container.className = "qc-ro-canvas";

  if (!blocks.length) {
    container.innerHTML = `<div class="qc-ro-empty">No blocks yet.</div>`;
    return container;
  }

  const world = document.createElement("div");
  world.className = "qc-ro-world";

  const arrowId = `qcro-arrow-${q.id || Math.random().toString(36).slice(2)}`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "qm-canvas-svg");
  svg.innerHTML = `<defs><marker id="${arrowId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(255,204,102,0.7)"/></marker></defs>`;
  world.appendChild(svg);

  // Render groups behind blocks (uses same bounds logic as editor, but with local blocks array)
  groups.forEach(group => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (group.blockIds || []).forEach(id => {
      const b = localById(id);
      if (!b) return;
      const w = b.width || BLOCK_DEFAULT_W, h = b.height || BLOCK_DEFAULT_H;
      minX = Math.min(minX, b.worldX || 0); minY = Math.min(minY, b.worldY || 0);
      maxX = Math.max(maxX, (b.worldX || 0) + w);
      maxY = Math.max(maxY, (b.worldY || 0) + h);
    });
    if (!isFinite(minX)) return;
    const bx = minX - GROUP_PAD, by = minY - GROUP_TOP;
    const bw = maxX - minX + GROUP_PAD * 2, bh = maxY - minY + GROUP_TOP + GROUP_PAD;
    const col = group.color || "#ffcc66";
    const gel = document.createElement("div");
    gel.className = "blk-group qc-group-ro";
    gel.style.left = bx + "px"; gel.style.top = by + "px";
    gel.style.width = bw + "px"; gel.style.height = bh + "px";
    gel.style.background  = hexToRgba(col, 0.1);
    gel.style.borderColor = hexToRgba(col, 0.45);
    if (group.title) {
      gel.innerHTML = `<div class="blk-group-header qc-group-ro-header" style="pointer-events:none">
        <span class="blk-group-title" style="background:transparent;border:none;color:rgba(255,220,150,0.85);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">${esc(group.title)}</span>
        <span class="blk-group-swatch" style="background:${col};width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,0.15)"></span>
      </div>`;
    }
    world.appendChild(gel);
  });

  blocks.forEach((b, idx) => {
    if (!isAdmin && b.type === "note") return;
    const wrap = document.createElement("div");
    wrap.className = "qm-block qc-block-ro";
    wrap.dataset.index = String(idx);
    wrap.dataset.blockId = b.id;
    wrap.dataset.session = b.sessionMarker || "";
    wrap.style.left  = `${b.worldX || 0}px`;
    wrap.style.top   = `${b.worldY || 0}px`;
    wrap.style.width = `${b.width  || BLOCK_DEFAULT_W}px`;
    if (b.height) wrap.style.minHeight = `${b.height}px`;
    if (b.bgColor) { wrap.style.setProperty("--blk-cc", b.bgColor); wrap.classList.add("blk-colored"); }

    const sessionPill = b.sessionMarker
      ? `<span class="qcro-session-pill ${sessionColorClass(b.sessionMarker)}">${esc(b.sessionMarker)}</span>`
      : "";
    wrap.innerHTML = `
      <div class="blk-header qcro-header">
        <span class="blk-type-icon">${BLOCK_TYPE_ICON[b.type] || ""}</span>
        <span class="blk-type-label">${BLOCK_TYPE_LABEL[b.type] || b.type}</span>
        ${sessionPill}
      </div>
      <div class="blk-body">${buildBlockROContent(b)}</div>`;
    world.appendChild(wrap);
  });

  container.appendChild(world);

  let roZoom = 1, roPanX = 0, roPanY = 0, roPanState = null;

  const applyROTransform = () => {
    world.style.transform = `translate(${roPanX}px,${roPanY}px) scale(${roZoom})`;
  };

  const autoFit = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    blocks.forEach(b => {
      const x = b.worldX||0, y = b.worldY||0;
      const w = b.width||BLOCK_DEFAULT_W, h = b.height||BLOCK_DEFAULT_H;
      minX = Math.min(minX,x); minY = Math.min(minY,y);
      maxX = Math.max(maxX,x+w); maxY = Math.max(maxY,y+h);
    });
    const pad = 24;
    const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
    const cw = container.offsetWidth || 400, ch = container.offsetHeight || 400;
    roZoom = Math.min(1, cw/bw, ch/bh);
    roPanX = (cw - bw*roZoom)/2 - (minX - pad)*roZoom;
    roPanY = (ch - bh*roZoom)/2 - (minY - pad)*roZoom;
    applyROTransform();
    renderROConns();
  };

  const renderROConns = () => {
    svg.querySelectorAll(".conn-path").forEach(el => el.remove());
    connections.forEach(conn => {
      const fb = localById(conn.from), tb = localById(conn.to);
      if (!fb || !tb) return;
      const fromEl = world.querySelector(`[data-block-id="${conn.from}"]`);
      const toEl   = world.querySelector(`[data-block-id="${conn.to}"]`);
      const fromSide = conn.fromSide || "right", toSide = conn.toSide || "left";
      const p1 = blockPortPos(fb, fromSide, fromEl);
      const p2 = blockPortPos(tb, toSide,   toEl);
      const off = Math.max(50, Math.abs(p2.x-p1.x)*0.45, Math.abs(p2.y-p1.y)*0.45);
      const cv1 = sideControlVec(fromSide, off), cv2 = sideControlVec(toSide, off);
      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d", `M${p1.x},${p1.y} C${p1.x+cv1.dx},${p1.y+cv1.dy} ${p2.x+cv2.dx},${p2.y+cv2.dy} ${p2.x},${p2.y}`);
      path.setAttribute("class","conn-path");
      path.setAttribute("marker-end",`url(#${arrowId})`);
      svg.appendChild(path);
    });
  };

  // Auto-fit once when the canvas first becomes visible
  let hasFit = false;
  const fitObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !hasFit) { hasFit = true; autoFit(); fitObserver.disconnect(); }
  }, { threshold: 0.01 });
  fitObserver.observe(container);

  container.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(3, roZoom * factor));
    const wx = (mx - roPanX)/roZoom, wy = (my - roPanY)/roZoom;
    roPanX = mx - wx*newZoom; roPanY = my - wy*newZoom;
    roZoom = newZoom;
    applyROTransform();
  }, { passive: false });

  container.addEventListener("mousedown", e => { if (e.button === 1) e.preventDefault(); });
  container.addEventListener("pointerdown", e => {
    if (e.button !== 1) return;   // middle-mouse pans; left is free for text selection
    e.preventDefault();
    container.setPointerCapture(e.pointerId);
    roPanState = { startX: e.clientX, startY: e.clientY, startPanX: roPanX, startPanY: roPanY };
    container.style.cursor = "grabbing";
  });
  container.addEventListener("pointermove", e => {
    if (!roPanState) return;
    roPanX = roPanState.startPanX + (e.clientX - roPanState.startX);
    roPanY = roPanState.startPanY + (e.clientY - roPanState.startY);
    applyROTransform();
  });
  container.addEventListener("pointerup", () => { roPanState = null; container.style.cursor = ""; });

  // Expose data + focus controls so the viewer's navigation sidebar can drive it.
  container.questBlocks = blocks;
  container.questGroups = groups;
  container.focusBlock = (id) => {
    const b = localById(id); if (!b) return;
    const el = world.querySelector(`[data-block-id="${id}"]`);
    const w = b.width || BLOCK_DEFAULT_W, h = el?.offsetHeight || b.height || BLOCK_DEFAULT_H;
    const cw = container.offsetWidth || 400, ch = container.offsetHeight || 400;
    if (roZoom < 0.6 || roZoom > 1.4) roZoom = 1;
    roPanX = cw / 2 - ((b.worldX || 0) + w / 2) * roZoom;
    roPanY = ch / 2 - ((b.worldY || 0) + h / 2) * roZoom;
    applyROTransform(); renderROConns();
    if (el) { el.classList.add("blk-focus-flash"); setTimeout(() => el.classList.remove("blk-focus-flash"), 1000); }
  };
  container.focusGroup = (group) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (group.blockIds || []).forEach(id => {
      const b = localById(id); if (!b) return;
      const w = b.width || BLOCK_DEFAULT_W, h = b.height || BLOCK_DEFAULT_H;
      minX = Math.min(minX, b.worldX || 0); minY = Math.min(minY, b.worldY || 0);
      maxX = Math.max(maxX, (b.worldX || 0) + w); maxY = Math.max(maxY, (b.worldY || 0) + h);
    });
    if (!isFinite(minX)) return;
    const pad = 48, cw = container.offsetWidth || 400, ch = container.offsetHeight || 400;
    const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    roZoom = Math.min(1.1, Math.max(0.2, Math.min(cw / bw, ch / bh)));
    roPanX = cw / 2 - (minX + (maxX - minX) / 2) * roZoom;
    roPanY = ch / 2 - (minY + (maxY - minY) / 2) * roZoom;
    applyROTransform(); renderROConns();
  };

  return container;
}

// Build at-a-glance content summary chips (phase/enemy/loot counts) for a quest card
// Deep content search: find where a query appears inside a quest (NPC names,
// items, places, lore, phases, text…). Returns [{icon, text, where}] so the
// card can show not just which quests match but where the match lives.
function _plainText(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
}
function questSearchMatches(q, ql) {
  const matches = [];
  const seen = new Set();
  const push = (icon, text, where) => {
    const t = (text || "").trim(); if (!t) return;
    const k = icon + "|" + t.toLowerCase() + "|" + where;
    if (seen.has(k)) return; seen.add(k);
    matches.push({ icon, text: t, where });
  };
  const hit = s => s != null && String(s).toLowerCase().includes(ql);

  if (hit(q.location))        push("lucide:map-pin", q.location, "Location");
  if (q.giver && hit(q.giver.name)) push("lucide:user-round", q.giver.name, "Quest giver");
  (q.objectives || []).forEach(o => { if (hit(o.text)) push("lucide:check-square", o.text, "Objective"); });

  const blocks = (q.blocks || []).map(b => migrateBlock({ ...b })).filter(b => !(b.type === "note" && !isAdmin));

  // Work out which phase each block sits under, for "where it appears" context.
  const phaseOf = {};
  let cur = "";
  orderBlocksForReading(blocks).forEach(b => {
    if (b.type === "phase") cur = b.title || b.blockTitle || "Phase";
    else phaseOf[b.id] = cur;
  });
  const ctx = (b, fallback) => phaseOf[b.id] ? `in ${phaseOf[b.id]}` : fallback;

  blocks.forEach(b => {
    switch (b.type) {
      case "character":
        (b.characters || []).forEach(c => {
          if (hit(c.name) || hit(c.profession)) push("lucide:user", c.name || c.profession, ctx(b, "Character"));
        }); break;
      case "loot":
        (b.items || []).forEach(it => { if (hit(it.name)) push("game-icons:open-treasure-chest", it.name, ctx(b, "Loot")); }); break;
      case "boss":
      case "encounter":
        (b.enemies || []).forEach(en => { if (hit(en.name)) push("game-icons:death-skull", en.name, ctx(b, "Enemy")); }); break;
      case "loreref":
        (b.items || []).forEach(it => { if (hit(it.title)) push("game-icons:bookshelf", it.title, ctx(b, "Lore")); }); break;
      case "phase":
        if (hit(b.title) || hit(b.blockTitle)) push("lucide:chevron-right", b.title || b.blockTitle, "Phase"); break;
      case "puzzle":
        if (hit(b.title) || hit(b.description) || hit(b.hint) || (isAdmin && hit(b.solution)))
          push("game-icons:puzzle", b.title || "Puzzle", ctx(b, "Puzzle")); break;
      case "text":
        if (hit(b.blockTitle) || hit(_plainText(b.content))) push("lucide:type", b.blockTitle || "Text", ctx(b, "Text")); break;
      case "note":
        if (isAdmin && hit(_plainText(b.content))) push("lucide:file-text", "DM note", ctx(b, "Note")); break;
    }
  });
  return matches;
}

function buildSummaryChips(blocks) {
  if (!blocks || !blocks.length) return "";
  let phases = 0, enemies = 0, loot = 0, puzzles = 0, chars = 0, lore = 0;
  for (const b of blocks) {
    if (b.type === "phase")     phases++;
    else if (b.type === "boss")      enemies += (b.enemies?.length || (b.name ? 1 : 0));
    else if (b.type === "encounter") enemies += (b.enemies?.reduce((s, e) => s + (e.count || 1), 0) || 0);
    else if (b.type === "loot") loot    += (b.items?.length   || (b.name ? 1 : 0));
    else if (b.type === "puzzle")    puzzles++;
    else if (b.type === "character") chars += (b.characters?.length || 0);
    else if (b.type === "loreref")   lore  += (b.items?.length || 0);
  }
  const chips = [];
  if (phases)  chips.push(`<span class="qc-chip qc-chip-phase"><iconify-icon icon="lucide:chevron-right" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${phases}</span> ${phases === 1 ? "phase" : "phases"}</span>`);
  if (enemies) chips.push(`<span class="qc-chip qc-chip-boss"><iconify-icon icon="game-icons:death-skull" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${enemies}</span> ${enemies === 1 ? "enemy" : "enemies"}</span>`);
  if (loot)    chips.push(`<span class="qc-chip qc-chip-loot"><iconify-icon icon="game-icons:open-treasure-chest" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${loot}</span> loot</span>`);
  if (puzzles) chips.push(`<span class="qc-chip qc-chip-puzzle"><iconify-icon icon="game-icons:puzzle" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${puzzles}</span> ${puzzles === 1 ? "puzzle" : "puzzles"}</span>`);
  if (chars)   chips.push(`<span class="qc-chip qc-chip-char"><iconify-icon icon="lucide:user" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${chars}</span> NPC${chars === 1 ? "" : "s"}</span>`);
  if (lore)    chips.push(`<span class="qc-chip qc-chip-lore"><iconify-icon icon="game-icons:bookshelf" class="qc-chip-icon"></iconify-icon><span class="qc-chip-count">${lore}</span> lore</span>`);
  if (!chips.length) return "";
  return `<div class="qc-summary">${chips.join("")}</div>`;
}

// ── Quest-meta helpers (rewards / objectives / chain / gating) ─────────────────
function questRewardsSummary(q) {
  const r = q.rewards; if (!r) return "";
  const parts = [];
  if (r.xp   && parseInt(r.xp))   parts.push(`<span class="qc-reward"><iconify-icon icon="game-icons:sparkles"></iconify-icon> ${esc(String(r.xp))} XP</span>`);
  if (r.gold && parseInt(r.gold)) parts.push(`<span class="qc-reward"><iconify-icon icon="game-icons:two-coins"></iconify-icon> ${esc(String(r.gold))} gp</span>`);
  if (r.items && r.items.length)  parts.push(`<span class="qc-reward"><iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon> ${r.items.length} item${r.items.length > 1 ? "s" : ""}</span>`);
  return parts.length ? `<div class="qc-rewards-row">${parts.join("")}</div>` : "";
}
function questObjProgress(q) {
  const o = q.objectives; if (!o || !o.length) return null;
  return { done: o.filter(x => x.done).length, total: o.length };
}
function prereqsMet(q) {
  if (!Array.isArray(q.prerequisites) || !q.prerequisites.length) return true;
  return q.prerequisites.every(qid => { const p = quests.find(x => x.id === qid); return p && p.status === "completed"; });
}
function questPrereqList(q) {
  return (q.prerequisites || []).map(qid => quests.find(x => x.id === qid)).filter(Boolean);
}

// Swipe-to-delete for quest cards (mobile, Spotify-style): drag the card right
// to reveal a red delete card; release past the threshold to delete. Touch-only,
// so desktop pointer interaction (click to open, drag handle to reorder) is unaffected.
function attachQuestSwipeToDelete(swipe, card, q) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
  const thresholdFor = () => Math.min(140, card.offsetWidth * 0.4);

  card.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; dragging = true; decided = false; horizontal = false;
    card.style.transition = "none";
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    if (!dragging) return;
    const ddx = e.touches[0].clientX - startX;
    const ddy = e.touches[0].clientY - startY;
    if (!decided && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      decided = true;
      horizontal = Math.abs(ddx) > Math.abs(ddy);
    }
    if (!horizontal) return;        // vertical gesture → let the page scroll
    e.preventDefault();             // we own the horizontal gesture
    dx = Math.min(card.offsetWidth, Math.max(0, ddx));   // slide right only
    card.style.transform = `translateX(${dx}px)`;
    swipe.classList.toggle("swipe-ready", dx > thresholdFor());
  }, { passive: false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "";
    if (dx > thresholdFor()) {
      card.style.transform = "translateX(100%)";
      card.style.opacity = "0";
      card._swiped = true;
      setTimeout(() => remove(ref(db, `campaigns/${cid}/quests/${q.id}`)), 180);
    } else {
      card.style.transform = "";
      swipe.classList.remove("swipe-ready");
      if (Math.abs(dx) > 8) { card._swiped = true; setTimeout(() => { card._swiped = false; }, 60); }
    }
  };
  card.addEventListener("touchend", finish);
  card.addEventListener("touchcancel", finish);
}

function buildCard(q) {
  const card = document.createElement("div");
  const locked = !isAdmin && !prereqsMet(q);
  card.className = `quest-card quest-${q.type || "main"}${q.status === "completed" ? " quest-completed" : ""}${q.status === "active" ? " quest-active" : ""}${locked ? " quest-locked" : ""}`;
  card.dataset.questId = q.id;
  const blocks = q.blocks ? q.blocks.map(b => ({ ...b })) : [];
  const prog = questObjProgress(q);
  const objPill = prog ? `<span class="qc-obj-pill${prog.done === prog.total ? " complete" : ""}"><iconify-icon icon="lucide:check-square"></iconify-icon> ${prog.done}/${prog.total} objectives</span>` : "";
  const giverHtml = q.giver && q.giver.name ? `<div class="qc-giver"><iconify-icon icon="lucide:user-round"></iconify-icon> ${esc(q.giver.name)}</div>` : "";
  const prereqNames = questPrereqList(q);
  const requiresHtml = prereqNames.length ? `<div class="qc-requires"><iconify-icon icon="lucide:lock"></iconify-icon> Requires: ${prereqNames.map(p => esc(p.title || "?")).join(", ")}</div>` : "";

  const matchHtml = (searchQuery && q._searchMatches && q._searchMatches.length)
    ? `<div class="qc-search-matches">${q._searchMatches.slice(0, 8).map(m =>
        `<span class="qc-match"><iconify-icon icon="${m.icon}" class="qc-match-icon"></iconify-icon><span class="qc-match-text">${esc(m.text)}</span>${m.where ? `<span class="qc-match-where">${esc(m.where)}</span>` : ""}</span>`).join("")}${q._searchMatches.length > 8 ? `<span class="qc-match qc-match-more">+${q._searchMatches.length - 8} more</span>` : ""}</div>`
    : "";

  const emblemIcon = q.status === "completed" ? "lucide:check"
    : q.type === "side" ? "lucide:sparkles"
    : "game-icons:crossed-swords";

  card.innerHTML = `
    <div class="qc-accent-bar"></div>
    <div class="qc-body">
      <div class="qc-emblem"><iconify-icon icon="${emblemIcon}"></iconify-icon></div>
      <div class="qc-title-row">
        ${isAdmin ? `<iconify-icon icon="lucide:grip-vertical" class="qc-drag-handle" title="Drag to reorder quests"></iconify-icon>` : ""}
        <h3 class="qc-title">${esc(q.title || "")}</h3>
        ${q.location ? `<div class="qc-location"><iconify-icon icon="lucide:map-pin"></iconify-icon> ${esc(q.location)}</div>` : ""}
        ${giverHtml}
      </div>
      <div class="qc-top-row">
        <span class="qc-type-badge">${q.type === "main" ? "Main Quest" : "Side Quest"}</span>
        <span class="qc-status ${STATUS_CLASS[q.status] || ""}">${STATUS_LABEL[q.status] || "Unknown"}</span>
        ${q.recommendedLevel ? `<span class="qc-level-badge"><iconify-icon icon="lucide:shield"></iconify-icon> Lv ${esc(q.recommendedLevel)}</span>` : ""}
        ${isAdmin && !q.discovered ? `<span class="qc-hidden-badge"><iconify-icon icon="lucide:eye"></iconify-icon> DM Only</span>` : ""}
      </div>
      <div class="qc-meta">
        ${buildSummaryChips(blocks)}
        ${objPill ? `<div class="qc-obj-row">${objPill}</div>` : ""}
        ${questRewardsSummary(q)}
        ${requiresHtml}
        ${matchHtml}
      </div>
    </div>
    ${locked ? `<div class="qc-lock-overlay"><iconify-icon icon="lucide:lock"></iconify-icon></div>` : ""}
    ${isAdmin ? `
      <div class="qc-actions">
        <button class="qc-btn qc-edit-btn" title="Edit"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
        <button class="qc-btn qc-del-btn"  title="Delete"><iconify-icon icon="lucide:x"></iconify-icon></button>
      </div>` : ""}
  `;

  // Click card body → open full-screen quest view (or explain the lock for players)
  card.querySelector(".qc-body").addEventListener("click", () => {
    if (card._swiped) return;   // ignore the click that follows a swipe-to-delete
    if (locked) { alert(`Complete first: ${prereqNames.map(p => p.title || "?").join(", ")}`); return; }
    openQuestView(q);
  });

  if (isAdmin) {
    card.querySelector(".qc-edit-btn").addEventListener("click", e => { e.stopPropagation(); openModal(q); });
    card.querySelector(".qc-del-btn").addEventListener("click",  e => {
      e.stopPropagation();
      if (confirm(`Delete "${q.title}"?`)) remove(ref(db, `campaigns/${cid}/quests/${q.id}`));
    });
    initQuestCardDrag(card, q.id);
  }
  return card;
}

// Renders the rewards / objectives / chain brief strip inside the quest view.
function renderQuestBrief(brief, q) {
  const r = q.rewards;
  const rewardItems = (r && r.items) || [];
  const rewardHtml = (r && (parseInt(r.xp) || parseInt(r.gold) || rewardItems.length)) ? `
    <div class="qview-brief-block">
      <div class="qview-brief-label">Rewards</div>
      <div class="qview-rewards">
        ${parseInt(r.xp)   ? `<span class="qc-reward"><iconify-icon icon="game-icons:sparkles"></iconify-icon> ${esc(String(r.xp))} XP</span>` : ""}
        ${parseInt(r.gold) ? `<span class="qc-reward"><iconify-icon icon="game-icons:two-coins"></iconify-icon> ${esc(String(r.gold))} gp</span>` : ""}
        ${rewardItems.map(it => `<span class="qc-reward qc-reward-item"><iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon> ${esc(it.name)}${it.value ? ` <span class="loot-item-value">${esc(it.value)}</span>` : ""}</span>`).join("")}
      </div>
    </div>` : "";

  const objs = q.objectives || [];
  const objHtml = objs.length ? `
    <div class="qview-brief-block">
      <div class="qview-brief-label">Objectives <span class="qview-obj-count">${objs.filter(o => o.done).length}/${objs.length}</span></div>
      <div class="qview-obj-list">
        ${objs.map((o, i) => `<button type="button" class="qview-obj${o.done ? " done" : ""}" data-idx="${i}"${isAdmin ? "" : " disabled"}>
          <iconify-icon icon="${o.done ? "lucide:check-square" : "lucide:square"}"></iconify-icon>
          <span>${esc(o.text || "")}</span>
        </button>`).join("")}
      </div>
    </div>` : "";

  const prereqs = questPrereqList(q);
  const leads = quests.filter(x => Array.isArray(x.prerequisites) && x.prerequisites.includes(q.id) && (isAdmin || x.discovered));
  const chainHtml = (prereqs.length || leads.length) ? `
    <div class="qview-brief-block">
      <div class="qview-brief-label">Quest chain</div>
      <div class="qview-chain">
        ${prereqs.map(p => `<button type="button" class="qview-chain-link" data-qid="${esc(p.id)}"><iconify-icon icon="lucide:arrow-left"></iconify-icon> ${esc(p.title || "?")} <span class="qc-status ${STATUS_CLASS[p.status] || ""}">${STATUS_LABEL[p.status] || ""}</span></button>`).join("")}
        ${leads.map(p => `<button type="button" class="qview-chain-link" data-qid="${esc(p.id)}">${esc(p.title || "?")} <iconify-icon icon="lucide:arrow-right"></iconify-icon></button>`).join("")}
      </div>
    </div>` : "";

  if (!rewardHtml && !objHtml && !chainHtml) { brief.style.display = "none"; brief.innerHTML = ""; return; }
  brief.style.display = "flex";
  brief.innerHTML = rewardHtml + objHtml + chainHtml;

  if (isAdmin) {
    brief.querySelectorAll(".qview-obj").forEach(btn => btn.addEventListener("click", async () => {
      const i = Number(btn.dataset.idx);
      const next = (q.objectives || []).map(o => ({ ...o }));
      if (!next[i]) return;
      next[i].done = !next[i].done;
      q.objectives = next;
      try { await set(ref(db, `campaigns/${cid}/quests/${q.id}/objectives`), next); } catch {}
      renderQuestBrief(brief, q);
    }));
  }
  brief.querySelectorAll(".qview-chain-link").forEach(btn => btn.addEventListener("click", () => {
    const target = quests.find(x => x.id === btn.dataset.qid);
    if (target) openQuestView(target);
  }));
}

// Builds the read-only navigation sidebar for the quest viewer. Reuses the
// editor's outline item markup; clicking an item focuses it on the RO canvas.
function renderViewOutline(nav, canvasDom) {
  const allBlocks = (canvasDom.questBlocks || []).filter(b => isAdmin || b.type !== "note");
  const groups = canvasDom.questGroups || [];
  if (!allBlocks.length) { nav.style.display = "none"; nav.innerHTML = ""; return; }
  nav.style.display = "flex";

  const visible = new Set(allBlocks.map(b => b.id));
  const grouped = new Set();
  groups.forEach(g => (g.blockIds || []).forEach(id => grouped.add(id)));

  let html = `<div class="qview-nav-label"><iconify-icon icon="lucide:list-tree"></iconify-icon> Navigate</div><div class="qm-outline">`;
  groups.forEach(g => {
    const members = (g.blockIds || []).filter(id => visible.has(id));
    if (!members.length) return;
    const col = g.color || "#ffcc66";
    html += `<div class="qm-ol-group">
      <div class="qm-ol-group-hdr">
        <button type="button" class="qm-ol-group-focus" data-gid="${esc(g.id)}">
          <span class="qm-ol-dot" style="background:${esc(col)}"></span>
          <span class="qm-ol-group-name">${esc(g.title || "Untitled group")}</span>
          <span class="qm-ol-count">${members.length}</span>
        </button>
      </div>
      <div class="qm-ol-group-body">${members.map(id => { const b = allBlocks.find(x => x.id === id); return b ? outlineItemHtml(b, null) : ""; }).join("")}</div>
    </div>`;
  });
  const ungrouped = allBlocks.filter(b => !grouped.has(b.id));
  if (ungrouped.length) {
    html += `<div class="qm-ol-group qm-ol-ungrouped">
      ${groups.length ? `<div class="qm-ol-group-hdr"><span class="qm-ol-group-name qm-ol-ungrouped-name">Other</span><span class="qm-ol-count">${ungrouped.length}</span></div>` : ""}
      <div class="qm-ol-group-body">${ungrouped.map(b => outlineItemHtml(b, null)).join("")}</div>
    </div>`;
  }
  html += `</div>`;
  nav.innerHTML = html;

  nav.querySelectorAll(".qm-ol-focus").forEach(btn => btn.addEventListener("click", () => canvasDom.focusBlock(btn.dataset.id)));
  nav.querySelectorAll(".qm-ol-group-focus").forEach(btn => btn.addEventListener("click", () => {
    const g = groups.find(x => x.id === btn.dataset.gid); if (g) canvasDom.focusGroup(g);
  }));
}

// ── Quest View Overlay ────────────────────────────────────────────────────────
function openQuestView(q) {
  const overlay   = document.getElementById("quest-view");
  const titleArea = document.getElementById("qview-title-area");
  const adminBtns = document.getElementById("qview-admin-btns");
  const sessionBar = document.getElementById("qview-session-bar");
  const canvasWrap = document.getElementById("qview-canvas-wrap");

  // Position overlay flush below the sticky nav
  const nav = document.querySelector("nav");
  overlay.style.top = (nav ? Math.round(nav.getBoundingClientRect().bottom) : 0) + "px";

  // Header: title + meta badges
  titleArea.innerHTML = `
    <div class="qview-title">${esc(q.title || "")}</div>
    <div class="qview-meta-row">
      <span class="qc-type-badge">${q.type === "main" ? "Main Quest" : "Side Quest"}</span>
      <span class="qc-status ${STATUS_CLASS[q.status] || ""}">${STATUS_LABEL[q.status] || ""}</span>
      ${q.location ? `<span class="qc-location"><iconify-icon icon="lucide:map-pin"></iconify-icon> ${esc(q.location)}</span>` : ""}
      ${q.recommendedLevel ? `<span class="qc-level-badge"><iconify-icon icon="lucide:shield"></iconify-icon> Lv ${esc(q.recommendedLevel)}</span>` : ""}
      ${q.giver && q.giver.name ? `<span class="qc-giver"><iconify-icon icon="lucide:user-round"></iconify-icon> ${esc(q.giver.name)}</span>` : ""}
    </div>
  `;

  // Brief strip: rewards · objectives checklist · quest chain (inserted once, above canvas)
  let brief = document.getElementById("qview-brief");
  if (!brief) {
    brief = document.createElement("div");
    brief.id = "qview-brief";
    brief.className = "qview-brief";
    sessionBar.parentNode.insertBefore(brief, sessionBar);
  }
  renderQuestBrief(brief, q);

  // Admin: edit button
  if (isAdmin) {
    adminBtns.innerHTML = `<button class="qview-edit-btn"><iconify-icon icon="lucide:pencil"></iconify-icon> Edit</button>`;
    adminBtns.querySelector(".qview-edit-btn").addEventListener("click", () => {
      closeQuestView();
      openModal(q);
    });
  } else {
    adminBtns.innerHTML = "";
  }

  // Session filter (if quest has session markers)
  const blocks = q.blocks ? q.blocks.map(b => ({...b})) : [];
  const sessionList = [];
  for (const b of blocks) {
    if (b.sessionMarker && !sessionList.includes(b.sessionMarker)) sessionList.push(b.sessionMarker);
  }
  if (sessionList.length) {
    sessionBar.innerHTML = `
      <div class="qc-session-filter">
        <button class="qc-session-filter-btn active" data-session="all">All</button>
        ${sessionList.map(s => `<button class="qc-session-filter-btn ${sessionColorClass(s)}" data-session="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>`;
    sessionBar.style.display = "block";
    sessionBar.querySelectorAll(".qc-session-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        sessionBar.querySelectorAll(".qc-session-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.session;
        canvasWrap.querySelectorAll(".qc-block-ro").forEach(blk => {
          blk.style.display = (target === "all" || blk.dataset.session === target) ? "" : "none";
        });
      });
    });
  } else {
    sessionBar.style.display = "none";
    sessionBar.innerHTML = "";
  }

  // Tablet/desktop: the pan/zoom canvas + outline nav. Phones: vertical flow.
  canvasWrap.innerHTML = "";
  if (isWideViewport()) {
    canvasWrap.classList.remove("qview-flow-mode");
    const canvasDom = buildQuestCanvasDOM(q);
    const navAside = document.createElement("aside");
    navAside.className = "qview-nav";
    renderViewOutline(navAside, canvasDom);
    canvasWrap.appendChild(navAside);
    canvasWrap.appendChild(canvasDom);
  } else {
    canvasWrap.classList.add("qview-flow-mode");
    canvasWrap.appendChild(buildQuestFlowDOM(q));
  }

  // Encounter "Start Encounter" buttons
  canvasWrap.addEventListener("click", e => {
    const btn = e.target.closest(".qcb-start-encounter-btn");
    if (!btn) return;
    try {
      const enemies = JSON.parse(btn.dataset.enemies || "[]");
      _launchEncounter(enemies);
    } catch (_) {}
  });

  savePageState({ openQuestId: q.id });
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeQuestView() {
  savePageState({ openQuestId: null });
  document.getElementById("quest-view").classList.remove("open");
  document.getElementById("qview-canvas-wrap").innerHTML = "";
  document.body.style.overflow = "";
}

document.getElementById("qview-back").addEventListener("click", closeQuestView);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("quest-view").classList.contains("open")) closeQuestView();
});

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
  ids.forEach((id, i) => set(ref(db, `campaigns/${cid}/quests/${id}/order`), i));
}

// ── Modal open/close ──────────────────────────────────────────────────────────
function openModal(q) {
  if (!isWideViewport()) {
    alert("Quest creation and editing is available on tablet and desktop screens.");
    return;
  }
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
  currentBlocks.forEach(migrateBlock);
  const _refs = migrateRefsToIds(
    currentBlocks,
    q?.connections ? JSON.parse(JSON.stringify(q.connections)) : [],
    q?.groups      ? JSON.parse(JSON.stringify(q.groups))      : []
  );
  currentConnections = _refs.conns;
  currentGroups      = _refs.grps;

  // Quest-level metadata (giver / rewards / objectives / prerequisites)
  currentGiver         = q?.giver ? { ...q.giver } : null;
  currentRewards       = q?.rewards ? { xp: q.rewards.xp || "", gold: q.rewards.gold || "", items: [...(q.rewards.items || [])] } : { xp: "", gold: "", items: [] };
  currentObjectives    = Array.isArray(q?.objectives) ? q.objectives.map(o => ({ ...o })) : [];
  currentPrerequisites = Array.isArray(q?.prerequisites) ? [...q.prerequisites] : [];
  currentRecommendedLevel = q?.recommendedLevel || "";

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
  resetCanvasView();
  buildBlocksEditor();
  syncDetailsPanel();
  resetSidebarTab();
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
  blockDragState = null; blockResizeState = null; canvasPanState = null; connDragState = null;
  currentConnections = []; canvasSvg = null; currentGroups = []; selectedBlockSet.clear(); marqueeState = null;
  currentGiver = null; currentRewards = { xp: "", gold: "", items: [] };
  currentObjectives = []; currentPrerequisites = []; currentRecommendedLevel = "";
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
  const rewardsClean = {
    xp:    String(currentRewards.xp || "").trim(),
    gold:  String(currentRewards.gold || "").trim(),
    items: currentRewards.items || [],
  };
  const hasRewards = rewardsClean.xp || rewardsClean.gold || rewardsClean.items.length;
  const objClean = currentObjectives.map(o => ({ id: o.id, text: (o.text || "").trim(), done: !!o.done })).filter(o => o.text);
  const payload = {
    id:          editingId || push(questsRef).key,
    title,
    type:        selectedType,
    location:    qmLocationInp.value.trim() || null,
    status:      qmStatus.value,
    blocks:      currentBlocks.length > 0 ? currentBlocks : null,
    discovered:  qmDiscovered.checked,
    connections: currentConnections.length > 0 ? currentConnections : null,
    groups:      currentGroups.length > 0 ? currentGroups : null,
    giver:           currentGiver || null,
    rewards:         hasRewards ? rewardsClean : null,
    objectives:      objClean.length ? objClean : null,
    prerequisites:   currentPrerequisites.length ? currentPrerequisites : null,
    recommendedLevel: String(currentRecommendedLevel || "").trim() || null,
  };
  await set(ref(db, `campaigns/${cid}/quests/${payload.id}`), payload);
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
  text:    { type: "text",    content: "",     blockTitle: "", titleColor: "", textAlign: "left" },
  phase:   { type: "phase",   title: "",   description: "", blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  loot:    { type: "loot",    items: [],   blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  boss:      { type: "boss",      enemies: [], blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  encounter: { type: "encounter", enemies: [], blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  note:    { type: "note",    content: "", blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  puzzle:  { type: "puzzle",  title: "",   description: "", hint: "", solution: "", blockTitle: "", titleColor: "", textAlign: "left", fontWeight: "normal", fontStyle: "normal" },
  divider:   { type: "divider",   title: "" },
  character: { type: "character", characters: [], blockTitle: "", titleColor: "" },
  loreref:   { type: "loreref",   items: [],      blockTitle: "", titleColor: "" },
};

// ── Block palette ─────────────────────────────────────────────────────────────
document.querySelectorAll(".qm-add-block-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const origin = centeredBlockOrigin();
    currentBlocks.push({ ...BLOCK_DEFAULTS[btn.dataset.blockType], id: newId(), worldX: origin.x, worldY: origin.y, width: BLOCK_DEFAULT_W, height: BLOCK_DEFAULT_H });
    onEditTick();
    buildBlocksEditor();
  });
  btn.draggable = true;
  btn.addEventListener("dragstart", e => {
    dragPaletteType = btn.dataset.blockType;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", btn.dataset.blockType);
    qmBlockCanvas.classList.add("qm-drag-active");
  });
  btn.addEventListener("dragend", () => { dragPaletteType = null; qmBlockCanvas.classList.remove("qm-drag-active"); });
});

// ── Palette drag state ────────────────────────────────────────────────────────
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
  const BLOCK_ICONS = { phase:"lucide:chevron-right", boss:"game-icons:death-skull", encounter:"game-icons:crossed-swords", loot:"game-icons:open-treasure-chest", puzzle:"game-icons:puzzle", character:"lucide:user", loreref:"game-icons:bookshelf", note:"lucide:file-text", text:"lucide:type", divider:"lucide:minus" };
  // Palette-sanctioned tints only: bronze neutral, red = danger, green = DM.
  const BLOCK_COLORS = { phase:"#c8a45c", boss:"#e05050", encounter:"#e05050", loot:"#c8a45c", puzzle:"#c8a45c", character:"#c8a45c", loreref:"#c8a45c", note:"#66bb6a", text:"#c8a45c", divider:"#3a2510" };
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
      return `<div class="tpl-preview-block" style="flex:${flex};border-color:${color}"><iconify-icon icon="${icon || 'lucide:square'}" class="tpl-preview-icon"></iconify-icon><span class="tpl-preview-label">${label}</span></div>`;
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
  hideTplPreview();
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
        : `<div class="mention-drop-pic mention-drop-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
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
    _charPopup.innerHTML = `<div class="char-popup-box"><button class="char-popup-close"><iconify-icon icon="lucide:x"></iconify-icon></button><div class="char-popup-inner"></div></div>`;
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
        : `<div class="char-popup-pic char-popup-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
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
          <div class="char-popup-notes-label"><iconify-icon icon="lucide:eye"></iconify-icon> DM Notes</div>
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


// ── Build block editor ────────────────────────────────────────────────────────
function buildBlocksEditor() {
  // Ensure the world div exists inside the canvas viewport
  if (!canvasWorld || !qmBlockCanvas.contains(canvasWorld)) {
    canvasWorld = document.createElement("div");
    canvasWorld.className = "qm-canvas-world";
    qmBlockCanvas.appendChild(canvasWorld);
    applyCanvasTransform();
  }
  canvasWorld.innerHTML = "";

  // Ensure the SVG overlay exists (inserted before blocks so blocks render on top)
  if (!canvasSvg || !canvasWorld.contains(canvasSvg)) {
    canvasSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    canvasSvg.setAttribute("class", "qm-canvas-svg");
    canvasSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    canvasSvg.innerHTML = `<defs><marker id="conn-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(255,204,102,0.7)"/></marker></defs>`;
    canvasWorld.appendChild(canvasSvg);
  }

  // Migrate any legacy row/col blocks to world-space coordinates
  currentBlocks.forEach(migrateBlock);

  if (currentBlocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "qm-canvas-empty";
    empty.textContent = "Click a block type in the sidebar to add content — drag the header to move blocks freely.";
    canvasWorld.appendChild(empty);
    return;
  }

  currentBlocks.forEach((block, i) => {
    const wrap = document.createElement("div");
    wrap.className = `qm-block qm-block-${block.type}${selectedBlockSet.has(block.id) ? " blk-selected" : ""}`;
    wrap.dataset.index = i;
    wrap.dataset.blockId = block.id;
    wrap.style.left  = (block.worldX || 0) + "px";
    wrap.style.top   = (block.worldY || 0) + "px";
    wrap.style.width = (block.width  || BLOCK_DEFAULT_W) + "px";
    if (block.type !== "divider") {
      wrap.style.minHeight = (block.height || BLOCK_DEFAULT_H) + "px";
    }
    wrap.innerHTML = buildBlockEditorHtml(block, i);

    // Click to select (for copy/paste/delete)
    wrap.addEventListener("pointerdown", e => {
      if (e.target.closest("button, input, label, select, a, [contenteditable]")) return;
      // Don't clear selection if this block is already in it (preserves multi-select for drag)
      if (!e.shiftKey && !selectedBlockSet.has(block.id)) {
        selectedBlockSet.clear();
        refreshSelectionClasses();
      }
      selectedBlockSet.add(block.id);
      wrap.classList.add("blk-selected");
    }, { capture: true });

    // Wrap all content after the header in a scrollable body div
    const blkHeader = wrap.querySelector(".blk-header");
    if (blkHeader) {
      const body = document.createElement("div");
      body.className = "blk-body";
      while (blkHeader.nextSibling) body.appendChild(blkHeader.nextSibling);
      wrap.appendChild(body);
    }

    // Apply existing block background color
    if (block.bgColor) {
      applyBlockBgColor(wrap, block.bgColor);
      const swatch = wrap.querySelector(".blk-bg-swatch");
      if (swatch) swatch.style.background = block.bgColor;
    }

    // Block background color picker
    wrap.querySelector(".blk-bg-pick")?.addEventListener("input", e => {
      block.bgColor = e.target.value;
      applyBlockBgColor(wrap, block.bgColor);
      const swatch = wrap.querySelector(".blk-bg-swatch");
      if (swatch) swatch.style.background = block.bgColor;
      wrap.querySelector(".blk-bg-clear")?.classList.add("visible");
      onEditTick();
    });
    wrap.querySelector(".blk-bg-clear")?.addEventListener("click", () => {
      block.bgColor = null;
      applyBlockBgColor(wrap, null);
      const swatch = wrap.querySelector(".blk-bg-swatch");
      if (swatch) swatch.style.background = "transparent";
      wrap.querySelector(".blk-bg-clear")?.classList.remove("visible");
      onEditTick();
    });

    // Drag by clicking the block header (skip clicks on interactive elements)
    const header = wrap.querySelector(".blk-header");
    if (header) {
      header.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;
        if (e.target.closest("button, input, label, select, a")) return;
        e.stopPropagation();
        header.setPointerCapture(e.pointerId);

        // If block isn't in selection, replace selection with just this block
        if (!selectedBlockSet.has(block.id)) {
          selectedBlockSet.clear();
          refreshSelectionClasses();
          selectedBlockSet.add(block.id);
          wrap.classList.add("blk-selected");
        }

        // Record start positions for all blocks in the drag group
        const group = [...selectedBlockSet].map(id => blockById(id)).filter(Boolean).map(b => ({
          id: b.id,
          startWorldX: b.worldX || 0,
          startWorldY: b.worldY || 0,
          el: blockElById(b.id),
        }));

        blockDragState = {
          id: block.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startWorldX: block.worldX || 0,
          startWorldY: block.worldY || 0,
          wrap,
          group,
        };
        group.forEach(g => { g.el?.classList.add("dragging"); if (g.el) g.el.style.zIndex = "10"; });
      });
      header.addEventListener("pointermove", e => {
        if (!blockDragState || blockDragState.id !== block.id) return;
        const dx = (e.clientX - blockDragState.startClientX) / canvasZoom;
        const dy = (e.clientY - blockDragState.startClientY) / canvasZoom;

        // Snap only the primary block, then apply same delta to the group
        let rawX = blockDragState.startWorldX + dx;
        let rawY = blockDragState.startWorldY + dy;
        const bW = block.width  || BLOCK_DEFAULT_W;
        const bH = block.height || BLOCK_DEFAULT_H;
        let snapX = rawX, snapY = rawY;
        for (let j = 0; j < currentBlocks.length; j++) {
          if (selectedBlockSet.has(currentBlocks[j].id)) continue; // skip blocks in the group
          const other = currentBlocks[j];
          const oW = other.width  || BLOCK_DEFAULT_W;
          const oH = other.height || BLOCK_DEFAULT_H;
          for (const ys of [other.worldY, other.worldY + oH]) {
            if (Math.abs(rawY - ys) < SNAP_THRESHOLD)       { snapY = ys; break; }
            if (Math.abs(rawY + bH - ys) < SNAP_THRESHOLD)  { snapY = ys - bH; break; }
          }
          for (const xs of [other.worldX, other.worldX + oW]) {
            if (Math.abs(rawX - xs) < SNAP_THRESHOLD)       { snapX = xs; break; }
            if (Math.abs(rawX + bW - xs) < SNAP_THRESHOLD)  { snapX = xs - bW; break; }
          }
        }
        const snappedDx = snapX - blockDragState.startWorldX;
        const snappedDy = snapY - blockDragState.startWorldY;

        blockDragState.group.forEach(g => {
          const b = blockById(g.id);
          if (!b) return;
          b.worldX = g.startWorldX + snappedDx;
          b.worldY = g.startWorldY + snappedDy;
          if (g.el) { g.el.style.left = b.worldX + "px"; g.el.style.top = b.worldY + "px"; }
        });
        // Highlight group being hovered
        const bCX = (block.worldX || 0) + (block.width || BLOCK_DEFAULT_W) / 2;
        const bCY = (block.worldY || 0) + (wrap.offsetHeight || block.height || BLOCK_DEFAULT_H) / 2;
        canvasWorld.querySelectorAll(".blk-group").forEach(gel => {
          const gi2 = parseInt(gel.dataset.groupIndex);
          const bounds2 = getGroupBounds(currentGroups[gi2]);
          const inside = bounds2 && bCX >= bounds2.x && bCX <= bounds2.x + bounds2.w && bCY >= bounds2.y && bCY <= bounds2.y + bounds2.h;
          gel.classList.toggle("grp-hover", !!inside);
        });
        renderConnections();
      });
      header.addEventListener("pointerup", () => {
        if (!blockDragState || blockDragState.id !== block.id) return;
        blockDragState.group.forEach(g => { g.el?.classList.remove("dragging"); if (g.el) g.el.style.zIndex = ""; });

        // Group membership: add dragged blocks into any group whose bounds they land in
        blockDragState.group.forEach(g => {
          const b = blockById(g.id);
          if (!b) return;
          const bel = blockElById(g.id);
          const bCX = (b.worldX || 0) + (b.width || BLOCK_DEFAULT_W) / 2;
          const bCY = (b.worldY || 0) + (bel?.offsetHeight || b.height || BLOCK_DEFAULT_H) / 2;
          currentGroups.forEach(grp => {
            const bounds = getGroupBounds(grp);
            const inside = bounds && bCX >= bounds.x && bCX <= bounds.x + bounds.w && bCY >= bounds.y && bCY <= bounds.y + bounds.h;
            if (inside && !grp.blockIds.includes(g.id)) grp.blockIds.push(g.id);
          });
        });
        // Clear group hover highlights
        canvasWorld.querySelectorAll(".blk-group.grp-hover").forEach(el => el.classList.remove("grp-hover"));

        blockDragState = null;
        onEditTick();
        requestAnimationFrame(buildGroupsInEditor);
      });
    }

    // Resize handles — all 8 directions
    [
      { dir: "e",  cls: "blk-rh blk-rh-e" },
      { dir: "s",  cls: "blk-rh blk-rh-s" },
      { dir: "se", cls: "blk-rh blk-rh-se" },
      { dir: "n",  cls: "blk-rh blk-rh-n" },
      { dir: "w",  cls: "blk-rh blk-rh-w" },
      { dir: "nw", cls: "blk-rh blk-rh-nw" },
      { dir: "ne", cls: "blk-rh blk-rh-ne" },
      { dir: "sw", cls: "blk-rh blk-rh-sw" },
    ].forEach(({ dir, cls }) => {
      const rh = document.createElement("div");
      rh.className = cls;
      rh.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        rh.setPointerCapture(e.pointerId);
        blockResizeState = {
          id: block.id, dir,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startW: block.width  || wrap.offsetWidth || BLOCK_DEFAULT_W,
          startH: block.height || wrap.offsetHeight || BLOCK_DEFAULT_H,
          startWorldX: block.worldX || 0,
          startWorldY: block.worldY || 0,
          wrap,
        };
        wrap.classList.add("resizing");
      });
      rh.addEventListener("pointermove", e => {
        if (!blockResizeState || blockResizeState.id !== block.id) return;
        const dx = (e.clientX - blockResizeState.startClientX) / canvasZoom;
        const dy = (e.clientY - blockResizeState.startClientY) / canvasZoom;
        // Right edge
        if (dir === "e" || dir === "se" || dir === "ne") {
          block.width = Math.max(160, blockResizeState.startW + dx);
          wrap.style.width = block.width + "px";
        }
        // Left edge — moves worldX as well
        if (dir === "w" || dir === "nw" || dir === "sw") {
          const newW = Math.max(160, blockResizeState.startW - dx);
          block.worldX = blockResizeState.startWorldX + (blockResizeState.startW - newW);
          block.width  = newW;
          wrap.style.width = newW + "px";
          wrap.style.left  = block.worldX + "px";
        }
        // Bottom edge
        if (dir === "s" || dir === "se" || dir === "sw") {
          block.height = Math.max(80, blockResizeState.startH + dy);
          wrap.style.height    = block.height + "px";
          wrap.style.minHeight = block.height + "px";
        }
        // Top edge — moves worldY as well
        if (dir === "n" || dir === "nw" || dir === "ne") {
          const newH = Math.max(80, blockResizeState.startH - dy);
          block.worldY  = blockResizeState.startWorldY + (blockResizeState.startH - newH);
          block.height  = newH;
          wrap.style.height    = newH + "px";
          wrap.style.minHeight = newH + "px";
          wrap.style.top       = block.worldY + "px";
        }
        renderConnections();
      });
      rh.addEventListener("pointerup", () => {
        if (!blockResizeState || blockResizeState.id !== block.id) return;
        blockResizeState.wrap.classList.remove("resizing");
        blockResizeState = null;
        onEditTick();
      });
      wrap.appendChild(rh);
    });

    // Delete — drops the block plus any connections/group memberships referencing it
    wrap.querySelector(".blk-del")?.addEventListener("click", () => {
      deleteBlocksByIds([block.id]);
      selectedBlockSet.delete(block.id);
      onEditTick();
      buildBlocksEditor();
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
    wireInput(wrap, block, "sessionMarker", "[data-f=sessionMarker]");

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
            <button type="button" class="loot-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
            <button type="button" class="enemy-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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

    // Encounter creature search + count + launch
    if (block.type === "encounter") {
      if (!block.enemies) block.enemies = [];
      const srch = wrap.querySelector(".encounter-search-input");
      const drop = wrap.querySelector(".encounter-search-drop");
      const list = wrap.querySelector(".encounter-items-list");

      const refreshEncounterList = () => {
        list.innerHTML = (block.enemies || []).map((en, idx) => `
          <div class="encounter-item-row" data-idx="${idx}">
            <input type="number" class="encounter-count-input blk-input" min="1" max="99" value="${en.count || 1}" data-idx="${idx}" title="Count" style="width:48px;padding:3px 6px;text-align:center" />
            <span class="enemy-item-name">${esc(en.name)}</span>
            ${en.cr ? `<span class="enemy-item-stat">CR ${esc(en.cr)}</span>` : ""}
            ${en.ac ? `<span class="enemy-item-stat">AC ${esc(en.ac)}</span>` : ""}
            ${en.hp ? `<span class="enemy-item-stat">HP ${esc(en.hp)}</span>` : ""}
            <button type="button" class="encounter-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
          </div>`).join("");
        list.querySelectorAll(".encounter-item-del").forEach(btn => {
          btn.addEventListener("click", () => { block.enemies.splice(Number(btn.dataset.idx), 1); refreshEncounterList(); onEditTick(); });
        });
        list.querySelectorAll(".encounter-count-input").forEach(inp => {
          inp.addEventListener("change", () => {
            const idx = Number(inp.dataset.idx);
            if (block.enemies[idx]) { block.enemies[idx].count = Math.max(1, parseInt(inp.value) || 1); onEditTick(); }
          });
        });
      };
      refreshEncounterList();

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
        const addEncEnemy = dataset => {
          block.enemies.push({ name: dataset.name || "", ac: String(dataset.ac || ""), hp: String(dataset.hp || ""), cr: String(dataset.cr || ""), count: 1 });
          srch.value = ""; hideDrop(drop); refreshEncounterList(); onEditTick();
        };
        drop.addEventListener("mousedown", e => {
          const item = e.target.closest(".loc-drop-item");
          if (!item) return; e.preventDefault();
          addEncEnemy(item.dataset);
        });
        drop.addEventListener("keydown", e => {
          if (e.key === "Enter") { addEncEnemy(document.activeElement.dataset); }
          if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
          if (e.key === "Escape")    hideDrop(drop);
        });
        srch.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
      }

      // Start Encounter button in the editor
      wrap.querySelector(".encounter-launch-btn")?.addEventListener("click", e => {
        e.stopPropagation();
        _launchEncounter(block.enemies || []);
      });
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
            ${ch.picture ? `<img class="char-item-pic" src="${esc(ch.picture)}" alt="" />` : `<div class="char-item-pic char-item-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
            <span class="char-item-name">${esc(ch.name)}</span>
            ${ch.profession ? `<span class="char-item-meta">${esc(ch.profession)}</span>` : ""}
            <button type="button" class="char-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
            <iconify-icon icon="${it.type === 'scroll' ? 'game-icons:scroll-unfurled' : 'game-icons:open-book'}" class="loreref-item-icon"></iconify-icon>
            <span class="loreref-item-name">${esc(it.title||"")}</span>
            <button type="button" class="loreref-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
              <span><iconify-icon icon="${it.type === 'scroll' ? 'game-icons:scroll-unfurled' : 'game-icons:open-book'}"></iconify-icon> ${esc(it.title)}</span>
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

    // Port handles — one on each side for drag-to-connect (not for dividers)
    if (block.type !== "divider") CONN_SIDES.forEach(side => {
      const port = document.createElement("div");
      port.className = `blk-port blk-port-${side}`;
      port.title = "Drag to connect";
      port.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;
        e.stopPropagation(); e.preventDefault();
        port.setPointerCapture(e.pointerId);
        const rect = qmBlockCanvas.getBoundingClientRect();
        const curX = (e.clientX - rect.left - canvasPanX) / canvasZoom;
        const curY = (e.clientY - rect.top  - canvasPanY) / canvasZoom;
        connDragState = { fromId: block.id, fromSide: side, curX, curY, snapToId: null, snapToSide: null };
        port.classList.add("drag-active");
        renderConnections();
      });
      port.addEventListener("pointermove", e => {
        if (!connDragState || connDragState.fromId !== block.id || connDragState.fromSide !== side) return;
        const rect = qmBlockCanvas.getBoundingClientRect();
        connDragState.curX = (e.clientX - rect.left - canvasPanX) / canvasZoom;
        connDragState.curY = (e.clientY - rect.top  - canvasPanY) / canvasZoom;
        // Snap detection — 40px in screen space
        const SNAP_R = 40 / canvasZoom;
        let bestDist = SNAP_R, bestId = null, bestSide = null;
        currentBlocks.forEach(b => {
          if (b.id === block.id) return;
          const el = blockElById(b.id);
          CONN_SIDES.forEach(s => {
            const p = blockPortPos(b, s, el);
            const d = Math.hypot(connDragState.curX - p.x, connDragState.curY - p.y);
            if (d < bestDist) { bestDist = d; bestId = b.id; bestSide = s; }
          });
        });
        connDragState.snapToId  = bestId;
        connDragState.snapToSide = bestSide;
        // Highlight snap target port
        canvasWorld.querySelectorAll(".blk-port.snap-target").forEach(el => el.classList.remove("snap-target"));
        if (bestId !== null) {
          const targetEl = canvasWorld.querySelector(`[data-block-id="${bestId}"] .blk-port-${bestSide}`);
          targetEl?.classList.add("snap-target");
        }
        renderConnections();
      });
      port.addEventListener("pointerup", () => {
        if (!connDragState || connDragState.fromId !== block.id || connDragState.fromSide !== side) return;
        port.classList.remove("drag-active");
        if (connDragState.snapToId !== null) {
          const target = connDragState.snapToId;
          const already = currentConnections.some(c =>
            (c.from === block.id && c.to === target) ||
            (c.from === target && c.to === block.id)
          );
          if (!already) {
            currentConnections.push({
              id: newId(),
              from: block.id, fromSide: side,
              to: target, toSide: connDragState.snapToSide,
              label: ""
            });
            onEditTick();
          }
        }
        canvasWorld.querySelectorAll(".blk-port.snap-target").forEach(el => el.classList.remove("snap-target"));
        connDragState = null;
        renderConnections();
      });
      wrap.appendChild(port);
    });

    canvasWorld.appendChild(wrap);
  });

  // Auto-resize all textareas to fit content
  requestAnimationFrame(() => {
    canvasWorld.querySelectorAll(".blk-textarea").forEach(ta => {
      const resize = () => { ta.style.height = "0"; ta.style.height = ta.scrollHeight + "px"; };
      resize();
      ta.addEventListener("input", resize);
    });
  });

  requestAnimationFrame(() => { renderConnections(); buildGroupsInEditor(); });
  renderOutline();
}


function renderConnections() {
  if (!canvasSvg) return;
  // Clear all paths/labels but keep defs
  canvasSvg.querySelectorAll(".conn-path, .conn-label-group, .conn-guide, .conn-hit").forEach(el => el.remove());

  // Draw snap guides if dragging
  if (blockDragState) {
    const block = blockById(blockDragState.id);
    if (block) {
    const bW = block.width || BLOCK_DEFAULT_W;
    const bH = block.height || BLOCK_DEFAULT_H;
    for (let j = 0; j < currentBlocks.length; j++) {
      if (currentBlocks[j].id === blockDragState.id) continue;
      const other = currentBlocks[j];
      const oH = other.height || BLOCK_DEFAULT_H;
      const oW = other.width  || BLOCK_DEFAULT_W;
      // Draw Y guide
      const ySnaps = [other.worldY, other.worldY + oH];
      for (const ys of ySnaps) {
        if (Math.abs(block.worldY - ys) < 2 || Math.abs(block.worldY + bH - ys) < 2) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", "0"); line.setAttribute("x2", "4000");
          line.setAttribute("y1", ys); line.setAttribute("y2", ys);
          line.setAttribute("class", "conn-guide");
          canvasSvg.appendChild(line);
        }
      }
      // Draw X guide
      const xSnaps = [other.worldX, other.worldX + oW];
      for (const xs of xSnaps) {
        if (Math.abs(block.worldX - xs) < 2 || Math.abs(block.worldX + bW - xs) < 2) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", xs); line.setAttribute("x2", xs);
          line.setAttribute("y1", "0"); line.setAttribute("y2", "4000");
          line.setAttribute("class", "conn-guide");
          canvasSvg.appendChild(line);
        }
      }
    }
    }
  }

  // Draw connection drag preview
  if (connDragState) {
    const fromBlock = blockById(connDragState.fromId);
    const fromEl = blockElById(connDragState.fromId);
    if (fromBlock) {
    const p1 = blockPortPos(fromBlock, connDragState.fromSide, fromEl);
    let x2 = connDragState.curX, y2 = connDragState.curY;
    let previewSide = null;
    if (connDragState.snapToId !== null) {
      const toBlock = blockById(connDragState.snapToId);
      const toEl = blockElById(connDragState.snapToId);
      const snap = blockPortPos(toBlock, connDragState.snapToSide, toEl);
      x2 = snap.x; y2 = snap.y; previewSide = connDragState.snapToSide;
    }
    const cv1 = sideControlVec(connDragState.fromSide, Math.max(50, Math.abs(x2 - p1.x) * 0.45, Math.abs(y2 - p1.y) * 0.45));
    const cv2 = previewSide
      ? sideControlVec(previewSide, Math.max(50, Math.abs(x2 - p1.x) * 0.45, Math.abs(y2 - p1.y) * 0.45))
      : { dx: -cv1.dx, dy: -cv1.dy };
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
    preview.setAttribute("d", `M${p1.x},${p1.y} C${p1.x+cv1.dx},${p1.y+cv1.dy} ${x2+cv2.dx},${y2+cv2.dy} ${x2},${y2}`);
    preview.setAttribute("class", "conn-path conn-preview");
    canvasSvg.appendChild(preview);
    }
  }

  // Draw each connection
  currentConnections.forEach((conn, ci) => {
    const fromBlock = blockById(conn.from);
    const toBlock   = blockById(conn.to);
    if (!fromBlock || !toBlock) return;

    const fromEl = blockElById(conn.from);
    const toEl   = blockElById(conn.to);

    // Use stored port sides if available, otherwise fall back to right→left center
    const fromSide = conn.fromSide || 'right';
    const toSide   = conn.toSide   || 'left';
    const p1 = blockPortPos(fromBlock, fromSide, fromEl);
    const p2 = blockPortPos(toBlock,   toSide,   toEl);
    const offset = Math.max(50, Math.abs(p2.x - p1.x) * 0.45, Math.abs(p2.y - p1.y) * 0.45);
    const cv1 = sideControlVec(fromSide, offset);
    const cv2 = sideControlVec(toSide,   offset);

    // Bezier path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = `M${p1.x},${p1.y} C${p1.x+cv1.dx},${p1.y+cv1.dy} ${p2.x+cv2.dx},${p2.y+cv2.dy} ${p2.x},${p2.y}`;
    path.setAttribute("d", d);
    path.setAttribute("class", "conn-path");
    path.dataset.connIndex = ci;
    canvasSvg.appendChild(path);

    // Hit area (wider invisible path for easier clicking)
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", d);
    hit.setAttribute("class", "conn-hit");
    hit.dataset.connIndex = ci;
    hit.addEventListener("click", e => {
      e.stopPropagation();
      openConnectionPopup(ci, e.clientX, e.clientY);
    });
    canvasSvg.appendChild(hit);

    // Label at true bezier midpoint (t=0.5), not linear midpoint
    if (conn.label) {
      const cp1x = p1.x + cv1.dx, cp1y = p1.y + cv1.dy;
      const cp2x = p2.x + cv2.dx, cp2y = p2.y + cv2.dy;
      const mx = 0.125*p1.x + 0.375*cp1x + 0.375*cp2x + 0.125*p2.x;
      const my = 0.125*p1.y + 0.375*cp1y + 0.375*cp2y + 0.125*p2.y - 10;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "conn-label-group");
      g.dataset.connIndex = ci;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", "conn-label-bg");
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("class", "conn-label-text");
      txt.setAttribute("x", mx);
      txt.setAttribute("y", my);
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = conn.label;
      g.appendChild(rect);
      g.appendChild(txt);
      canvasSvg.appendChild(g);

      // Position rect after text is in DOM
      requestAnimationFrame(() => {
        try {
          const bb = txt.getBBox();
          rect.setAttribute("x", bb.x - 5);
          rect.setAttribute("y", bb.y - 3);
          rect.setAttribute("width", bb.width + 10);
          rect.setAttribute("height", bb.height + 6);
          rect.setAttribute("rx", "3");
        } catch {}
      });

      g.addEventListener("click", e => {
        e.stopPropagation();
        openConnectionPopup(ci, e.clientX, e.clientY);
      });
    }
  });
}

// Popup to edit/delete a connection
let _connPopup = null;
function openConnectionPopup(connIndex, clientX, clientY) {
  if (!_connPopup) {
    _connPopup = document.createElement("div");
    _connPopup.className = "conn-popup";
    document.body.appendChild(_connPopup);
    document.addEventListener("mousedown", e => {
      if (_connPopup && !_connPopup.contains(e.target)) _connPopup.style.display = "none";
    });
  }
  const conn = currentConnections[connIndex];
  if (!conn) return;
  _connPopup.innerHTML = `
    <input class="conn-popup-input" type="text" placeholder="Connection label…" value="${(conn.label || "").replace(/"/g, '&quot;')}" />
    <button class="conn-popup-del" title="Delete connection"><iconify-icon icon="lucide:x"></iconify-icon> Remove</button>
  `;
  _connPopup.style.cssText = `display:block;position:fixed;left:${clientX}px;top:${clientY}px;z-index:9999;`;
  const inp = _connPopup.querySelector(".conn-popup-input");
  inp.focus(); inp.select();
  inp.addEventListener("input", () => {
    currentConnections[connIndex].label = inp.value;
    renderConnections();
    onEditTick();
  });
  inp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") _connPopup.style.display = "none"; });
  _connPopup.querySelector(".conn-popup-del").addEventListener("click", () => {
    currentConnections.splice(connIndex, 1);
    _connPopup.style.display = "none";
    renderConnections();
    onEditTick();
  });
}

function wireInput(wrap, block, field, selector) {
  const el = wrap.querySelector(selector);
  if (el) el.addEventListener("input", () => { block[field] = el.value; onEditTick(); });
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
  const bgColorHtml = `
    <label class="blk-bg-label" title="Block background color">
      <span class="blk-bg-swatch" style="background:${b.bgColor || 'transparent'}"></span>
      <input type="color" class="blk-bg-pick" value="${b.bgColor || '#c8903a'}" />
    </label>
    <button type="button" class="blk-ctrl blk-bg-clear${b.bgColor ? ' visible' : ''}" title="Clear block color"><iconify-icon icon="lucide:x"></iconify-icon></button>`;
  const sessionCtrl = b.type !== "divider" ? `
    <label class="blk-session-label" title="Session tag — shown as a filter pill in the player view">
      <iconify-icon icon="lucide:bookmark" class="blk-session-icon"></iconify-icon>
      <input type="text" class="blk-session-input" data-f="sessionMarker" maxlength="8" placeholder="S#" value="${esc(b.sessionMarker || "")}" />
    </label>` : "";
  const controls = `
    <div class="blk-controls">
      ${sessionCtrl}
      ${bgColorHtml}
      <button type="button" class="blk-ctrl blk-del" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
        <div class="blk-header"><iconify-icon icon="lucide:type" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Text</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b, true)}
        <div class="blk-rich-text" contenteditable="true" data-placeholder="Write something…" style="text-align:${b.textAlign||"left"}">${b.content || ""}</div>`;

    case "phase":
      return `
        <div class="blk-header"><iconify-icon icon="lucide:chevron-right" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Phase</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b, true)}
        <input class="blk-input" type="text" data-f="title" placeholder="Phase title…" value="${esc(b.title || "")}" />
        <div class="blk-rich-phase" contenteditable="true" data-placeholder="What happens in this phase… (try @ # $ ^ / for links & blocks)" style="text-align:${b.textAlign||"left"}">${b.description || ""}</div>`;

    case "loot":
      return `
        <div class="blk-header"><iconify-icon icon="game-icons:open-treasure-chest" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Loot</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <div class="loot-search-wrap">
          <input class="blk-input loot-search-input" type="text" placeholder="Search items to add…" autocomplete="off" />
          <div class="loot-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="loot-items-list">
          ${(b.items || []).map((it, idx) => `
            <div class="loot-item-row" data-idx="${idx}">
              <span class="loot-item-name">${esc(it.name)}</span>
              ${it.value ? `<span class="loot-item-value">${esc(it.value)}</span>` : ""}
              <button type="button" class="loot-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
            </div>`).join("")}
        </div>`;

    case "boss":
      return `
        <div class="blk-header"><iconify-icon icon="game-icons:death-skull" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Enemy</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <div class="boss-search-wrap">
          <input class="blk-input boss-search-input" type="text" placeholder="Search creatures to add…" autocomplete="off" />
          <div class="boss-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="enemy-items-list">
          ${(b.enemies || []).map((en, idx) => `
            <div class="enemy-item-row" data-idx="${idx}">
              <span class="enemy-item-name">${esc(en.name)}</span>
              ${en.cr ? `<span class="enemy-item-stat">CR ${esc(en.cr)}</span>` : ""}
              ${en.ac ? `<span class="enemy-item-stat">AC ${esc(en.ac)}</span>` : ""}
              ${en.hp ? `<span class="enemy-item-stat">HP ${esc(en.hp)}</span>` : ""}
              <button type="button" class="enemy-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
            </div>`).join("")}
        </div>`;

    case "encounter":
      return `
        <div class="blk-header"><iconify-icon icon="game-icons:crossed-swords" class="blk-type-icon blk-type-icon-encounter"></iconify-icon><span class="blk-type-label">Encounter</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <div class="boss-search-wrap encounter-search-wrap">
          <input class="blk-input boss-search-input encounter-search-input" type="text" placeholder="Search creatures to add…" autocomplete="off" />
          <div class="boss-search-drop encounter-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="encounter-items-list">
          ${(b.enemies || []).map((en, idx) => `
            <div class="encounter-item-row" data-idx="${idx}">
              <input type="number" class="encounter-count-input blk-input" min="1" max="99" value="${en.count || 1}" data-idx="${idx}" title="Count" style="width:48px;padding:3px 6px;text-align:center" />
              <span class="enemy-item-name">${esc(en.name)}</span>
              ${en.cr ? `<span class="enemy-item-stat">CR ${esc(en.cr)}</span>` : ""}
              ${en.ac ? `<span class="enemy-item-stat">AC ${esc(en.ac)}</span>` : ""}
              ${en.hp ? `<span class="enemy-item-stat">HP ${esc(en.hp)}</span>` : ""}
              <button type="button" class="enemy-item-del encounter-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
            </div>`).join("")}
        </div>
        <button type="button" class="encounter-launch-btn dm-btn" style="margin-top:8px;width:100%;justify-content:center">
          <iconify-icon icon="game-icons:crossed-swords" style="margin-right:6px"></iconify-icon>Start Encounter
        </button>`;

    case "note":
      return `
        <div class="blk-header"><iconify-icon icon="lucide:file-text" class="blk-type-icon"></iconify-icon><span class="blk-type-label">DM Note</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <textarea class="blk-textarea blk-textarea-note" data-f="content" style="${taStyle}" placeholder="Private DM notes…" rows="3">${esc(b.content || "")}</textarea>`;

    case "puzzle":
      return `
        <div class="blk-header"><iconify-icon icon="game-icons:puzzle" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Puzzle</span>${controls}</div>
        ${titleRow}
        ${fmtBar(b)}
        <input class="blk-input" type="text" data-f="title" placeholder="Puzzle name…" value="${esc(b.title || "")}" />
        <textarea class="blk-textarea" data-f="description" style="${taStyle}" placeholder="Describe the puzzle…" rows="3">${esc(b.description || "")}</textarea>
        <input class="blk-input" type="text" data-f="hint" placeholder="Hint (visible to players)…" value="${esc(b.hint || "")}" />
        <input class="blk-input blk-textarea-note" type="text" data-f="solution" placeholder="Solution (DM only)…" value="${esc(b.solution || "")}" />`;

    case "divider":
      return `
        <div class="blk-header"><iconify-icon icon="lucide:minus" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Divider</span>${controls}</div>
        <input class="blk-input" type="text" data-f="title" placeholder="Divider title (optional)…" value="${esc(b.title || "")}" />
        <div class="blk-divider-preview"></div>`;

    case "character":
      return `
        <div class="blk-header"><iconify-icon icon="lucide:user" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Character</span>${controls}</div>
        ${titleRow}
        <div class="char-search-wrap">
          <input class="blk-input char-search-input" type="text" placeholder="Search characters to add…" autocomplete="off" />
          <div class="char-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="char-items-list">
          ${(b.characters || []).map((ch, idx) => `
            <div class="char-item-row" data-idx="${idx}">
              ${ch.picture ? `<img class="char-item-pic" src="${esc(ch.picture)}" alt="" />` : `<div class="char-item-pic char-item-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
              <span class="char-item-name">${esc(ch.name)}</span>
              ${ch.profession ? `<span class="char-item-meta">${esc(ch.profession)}</span>` : ""}
              <button type="button" class="char-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
            </div>`).join("")}
        </div>`;

    case "loreref":
      return `
        <div class="blk-header"><iconify-icon icon="game-icons:bookshelf" class="blk-type-icon"></iconify-icon><span class="blk-type-label">Lore</span>${controls}</div>
        ${titleRow}
        <div class="loreref-search-wrap">
          <input class="blk-input loreref-search-input" type="text" placeholder="Search lore items to add…" autocomplete="off" />
          <div class="loreref-search-drop loc-dropdown" style="display:none"></div>
        </div>
        <div class="loreref-items-list">
          ${(b.items || []).map((it, idx) => `
            <div class="loreref-item-row" data-idx="${idx}">
              <iconify-icon icon="${it.type === 'scroll' ? 'game-icons:scroll-unfurled' : 'game-icons:open-book'}" class="loreref-item-icon"></iconify-icon>
              <span class="loreref-item-name">${esc(it.title || "")}</span>
              <button type="button" class="loreref-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
    connections: JSON.parse(JSON.stringify(currentConnections || [])),
    groups:      JSON.parse(JSON.stringify(currentGroups || [])),
    giver:           currentGiver ? { ...currentGiver } : null,
    rewards:         JSON.parse(JSON.stringify(currentRewards || { xp: "", gold: "", items: [] })),
    objectives:      JSON.parse(JSON.stringify(currentObjectives || [])),
    prerequisites:   [...(currentPrerequisites || [])],
    recommendedLevel: currentRecommendedLevel || "",
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
  currentBlocks.forEach(migrateBlock);
  { const r = migrateRefsToIds(currentBlocks, snap.connections || [], snap.groups || []); currentConnections = r.conns; currentGroups = r.grps; }
  currentGiver         = snap.giver ? { ...snap.giver } : null;
  currentRewards       = JSON.parse(JSON.stringify(snap.rewards || { xp: "", gold: "", items: [] }));
  currentObjectives    = JSON.parse(JSON.stringify(snap.objectives || []));
  currentPrerequisites = [...(snap.prerequisites || [])];
  currentRecommendedLevel = snap.recommendedLevel || "";
  syncTypeBtns();
  buildBlocksEditor();
  if (typeof syncDetailsPanel === "function") syncDetailsPanel();
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
  else if (key === "g") {
    // Always swallow Ctrl/Cmd+G while the editor is open so the browser's
    // Find-Next bar never opens. Group the current selection regardless of
    // which element has focus — starting a marquee calls preventDefault(), so
    // focus can still be sitting in a block's text field, and Ctrl+G is never a
    // text-editing shortcut anyway.
    e.preventDefault();
    if (selectedBlockSet.size > 0) {
      currentGroups.push({ id: newId(), title: "", color: "#ffcc66", blockIds: [...selectedBlockSet] });
      onEditTick();
      buildBlocksEditor();
    }
  }
  else if (key === "c" && selectedBlockSet.size > 0 && !e.target.closest("input, textarea, [contenteditable]")) {
    e.preventDefault();
    blockClipboard = [...selectedBlockSet].map(id => blockById(id)).filter(Boolean).map(b => JSON.parse(JSON.stringify(b)));
  }
  else if (key === "v" && blockClipboard && blockClipboard.length && !e.target.closest("input, textarea, [contenteditable]")) {
    e.preventDefault();
    selectedBlockSet.clear();
    blockClipboard.forEach(srcBlk => {
      const src = JSON.parse(JSON.stringify(srcBlk));
      src.id = newId();
      src.worldX = (src.worldX || 0) + 30;
      src.worldY = (src.worldY || 0) + 30;
      currentBlocks.push(src);
      selectedBlockSet.add(src.id);
    });
    onEditTick();
    buildBlocksEditor();
  }
});

// ── Delete selected blocks ────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (!questModal.classList.contains("open")) return;
  if (e.key !== "Delete" && e.key !== "Backspace") return;
  if (e.target.closest("input, textarea, [contenteditable]")) return;
  if (selectedBlockSet.size === 0) return;
  e.preventDefault();
  deleteBlocksByIds([...selectedBlockSet]);
  selectedBlockSet.clear();
  onEditTick();
  buildBlocksEditor();
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
  // Render with the SAME renderer players actually see (buildQuestCanvasDOM), so
  // the preview matches the live view exactly. Player view already hides DM notes
  // and puzzle solutions, so no separate filtering is needed here.
  const previewQuest = {
    id: editingId || "preview",
    title: qmName.value.trim() || "Untitled quest",
    location: qmLocationInp.value.trim(),
    type: selectedType,
    status: qmStatus.value,
    blocks: currentBlocks.map(b => ({ ...b })),
    connections: JSON.parse(JSON.stringify(currentConnections || [])),
    groups: JSON.parse(JSON.stringify(currentGroups || [])),
  };
  panel.innerHTML = `
    <div class="qm-preview-watermark">
      <iconify-icon icon="lucide:eye" class="qm-preview-watermark-icon"></iconify-icon>
      <span>This is how players see this quest — DM notes and puzzle solutions are hidden.</span>
    </div>`;
  const stage = document.createElement("div");
  stage.className = "qm-preview-stage";
  // Force the read-only canvas to render as a player would (hide note blocks,
  // strip solutions) by temporarily masking admin flag is overkill; instead the
  // renderer already gates on isAdmin. For an accurate player preview, drop the
  // DM-only blocks up front.
  previewQuest.blocks = previewQuest.blocks
    .filter(b => b.type !== "note")
    .map(b => b.type === "puzzle" ? (() => { const { solution, ...rest } = b; return rest; })() : b);
  stage.appendChild(buildQuestCanvasDOM(previewQuest));
  panel.appendChild(stage);
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

// Places a template so its whole bounding box is centred on (centerX, centerY)
// — or on the current viewport centre when no point is given.
function applyTemplateAtPosition(templateKey, centerX = null, centerY = null) {
  const tpl = BLOCK_TEMPLATES[templateKey];
  if (!tpl) return;
  const gap = 20;
  const rowW = 4 * (BLOCK_DEFAULT_W + gap);

  // First pass: lay blocks out relative to (0,0) and measure the bounding box.
  let x = 0, y = 0, maxRight = 0, maxBottom = 0;
  const placed = tpl.map(t => {
    const w = Math.round((t.span || 1) * (BLOCK_DEFAULT_W + gap) - gap);
    if (x > 0 && x + w > rowW) { x = 0; y += BLOCK_DEFAULT_H + gap; }   // wrap row
    const p = { t, rx: x, ry: y, w };
    x += w + gap;
    maxRight  = Math.max(maxRight,  p.rx + w);
    maxBottom = Math.max(maxBottom, p.ry + BLOCK_DEFAULT_H);
    return p;
  });

  // Second pass: offset every block so the box is centred on the target point.
  const c = (centerX != null && centerY != null) ? { x: centerX, y: centerY } : canvasCenterWorld();
  const offX = Math.round(c.x - maxRight  / 2);
  const offY = Math.round(c.y - maxBottom / 2);
  placed.forEach(p => {
    const block = { ...BLOCK_DEFAULTS[p.t.type], ...p.t, id: newId(), worldX: offX + p.rx, worldY: offY + p.ry, width: p.w, height: BLOCK_DEFAULT_H };
    delete block.span; delete block.rowSpan; delete block.row; delete block.col;
    currentBlocks.push(block);
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
    applyTemplateAtPosition(btn.dataset.template);   // auto-centres on the view
    onEditTick();
    buildBlocksEditor();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND MENU
// ═══════════════════════════════════════════════════════════════════════════
const SLASH_ITEMS = [
  { type: "phase",     icon: '<iconify-icon icon="lucide:chevron-right"></iconify-icon>',         name: "Phase",      hint: "A quest step" },
  { type: "boss",      icon: '<iconify-icon icon="game-icons:death-skull"></iconify-icon>',             name: "Enemy",      hint: "Creature stat block" },
  { type: "loot",      icon: '<iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon>', name: "Loot",     hint: "Items or rewards" },
  { type: "puzzle",    icon: '<iconify-icon icon="game-icons:puzzle"></iconify-icon>',            name: "Puzzle",     hint: "Riddle or skill check" },
  { type: "character", icon: '<iconify-icon icon="lucide:user"></iconify-icon>',                  name: "Character",  hint: "NPC reference" },
  { type: "loreref",   icon: '<iconify-icon icon="game-icons:bookshelf"></iconify-icon>',         name: "Lore",       hint: "Book or scroll reference" },
  { type: "note",      icon: '<iconify-icon icon="lucide:file-text"></iconify-icon>',             name: "DM Note",    hint: "Private to you" },
  { type: "text",      icon: '<iconify-icon icon="lucide:type"></iconify-icon>',                  name: "Text",       hint: "Paragraph" },
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
  // Insert the new block positioned below the source block
  const newBlock = { ...BLOCK_DEFAULTS[type], id: newId(), width: BLOCK_DEFAULT_W, height: BLOCK_DEFAULT_H };
  const insertAt = blockIndex >= 0 ? blockIndex + 1 : currentBlocks.length;
  if (blockIndex >= 0) {
    const src = currentBlocks[blockIndex];
    newBlock.worldX = src.worldX || 0;
    newBlock.worldY = (src.worldY || 0) + (src.height || BLOCK_DEFAULT_H) + 20;
  } else {
    const maxY = currentBlocks.reduce((m, b) => Math.max(m, (b.worldY || 0) + (b.height || BLOCK_DEFAULT_H)), 0);
    newBlock.worldX = 20;
    newBlock.worldY = maxY + 20;
  }
  currentBlocks.splice(insertAt, 0, newBlock);
  onEditTick();
  buildBlocksEditor();
  setTimeout(() => {
    const blk = currentBlocks[insertAt];
    if (blk) {
      canvasPanX = 20 - (blk.worldX || 0);
      canvasPanY = 20 - (blk.worldY || 0);
      applyCanvasTransform();
    }
    const newWrap = canvasWorld?.querySelectorAll(".qm-block")[insertAt];
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
  const iconMap = { "@": '<iconify-icon icon="lucide:user"></iconify-icon>', "#": '<iconify-icon icon="game-icons:crossed-swords"></iconify-icon>', "$": '<iconify-icon icon="game-icons:bookshelf"></iconify-icon>', "^": '<iconify-icon icon="lucide:map-pin"></iconify-icon>' };

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
        ${q.location ? `<span class="char-popup-tag"><iconify-icon icon="lucide:map-pin"></iconify-icon> ${esc(q.location)}</span>` : ""}
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
      <h2 class="char-popup-name"><iconify-icon icon="${l.type === 'scroll' ? 'game-icons:scroll-unfurled' : 'game-icons:open-book'}"></iconify-icon> ${esc(l.title || "")}</h2>
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
      <h2 class="char-popup-name"><iconify-icon icon="lucide:map-pin"></iconify-icon> ${esc(locName)}</h2>
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

// ── Encounter launcher ────────────────────────────────────────────────────────
function _launchEncounter(enemies) {
  if (!enemies.length) return;
  let combatState;
  try { combatState = JSON.parse(localStorage.getItem("dnd_combat_state")); } catch { combatState = null; }
  if (!combatState || typeof combatState !== "object") {
    combatState = { round: 1, currentTurn: -1, combatants: [], logEntries: [], lootLog: [] };
  }
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  enemies.forEach(en => {
    const count = Math.max(1, parseInt(en.count) || 1);
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? " " + letters[i % 26] : "";
      combatState.combatants.push({
        id:          genId(),
        name:        en.name + suffix,
        type:        "enemy",
        initiative:  Math.floor(Math.random() * 20) + 1,
        hp:          parseInt(en.hp)  || 10,
        maxHp:       parseInt(en.hp)  || 10,
        ac:          parseInt(en.ac)  || 10,
        conditions:  [],
        lootDropped: false
      });
    }
  });
  try { localStorage.setItem("dnd_combat_state", JSON.stringify(combatState)); } catch { /* ignore */ }
  window.location.href = "/combat";
}

// Color a session label deterministically from its string
function sessionColorClass(marker) {
  if (!marker) return "";
  let hash = 0;
  for (let i = 0; i < marker.length; i++) hash = (hash * 31 + marker.charCodeAt(i)) >>> 0;
  return `session-color-${(hash % 8) + 1}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEST DETAILS PANEL — giver · rewards · recommended level · objectives · chain
// ═══════════════════════════════════════════════════════════════════════════
const qmGiverSearch      = document.getElementById("qm-giver-search");
const qmGiverDrop        = document.getElementById("qm-giver-drop");
const qmGiverSel         = document.getElementById("qm-giver-selected");
const qmRewardXp         = document.getElementById("qm-reward-xp");
const qmRewardGold       = document.getElementById("qm-reward-gold");
const qmRewardItemSearch = document.getElementById("qm-reward-item-search");
const qmRewardItemDrop   = document.getElementById("qm-reward-item-drop");
const qmRewardItems      = document.getElementById("qm-reward-items");
const qmRecLevel         = document.getElementById("qm-reclevel");
const qmObjList          = document.getElementById("qm-obj-list");
const qmObjInput         = document.getElementById("qm-obj-input");
const qmObjAdd           = document.getElementById("qm-obj-add");
const qmPrereqList       = document.getElementById("qm-prereq-list");
const qmPrereqSearch     = document.getElementById("qm-prereq-search");
const qmPrereqDrop       = document.getElementById("qm-prereq-drop");

// Sidebar Content / Details tab switching
function resetSidebarTab() {
  document.querySelectorAll(".qm-sidebar-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "content"));
  document.querySelectorAll(".qm-sidebar-pane").forEach(p => { p.hidden = p.dataset.pane !== "content"; });
}
document.querySelectorAll(".qm-sidebar-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".qm-sidebar-tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".qm-sidebar-pane").forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
  });
});

// Generic dropdown keyboard helper reused by the detail search inputs
function wireDropKeys(srch, drop, onPick) {
  srch?.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); drop.querySelector(".loc-drop-item")?.focus(); }
    if (e.key === "Escape")    hideDrop(drop);
  });
  drop?.addEventListener("mousedown", e => {
    const item = e.target.closest(".loc-drop-item"); if (!item) return; e.preventDefault(); onPick(item.dataset);
  });
  drop?.addEventListener("keydown", e => {
    if (e.key === "Enter") { onPick(document.activeElement.dataset); }
    if (e.key === "ArrowDown") { e.preventDefault(); document.activeElement.nextElementSibling?.focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); (document.activeElement.previousElementSibling || srch).focus(); }
    if (e.key === "Escape")    hideDrop(drop);
  });
  srch?.addEventListener("blur", () => setTimeout(() => hideDrop(drop), 150));
}

// ── Quest giver ───────────────────────────────────────────────────────────────
function renderGiver() {
  if (!qmGiverSel) return;
  if (!currentGiver) { qmGiverSel.style.display = "none"; qmGiverSel.innerHTML = ""; return; }
  qmGiverSel.style.display = "flex";
  qmGiverSel.innerHTML = `
    ${currentGiver.picture ? `<img class="char-item-pic" src="${esc(currentGiver.picture)}" alt="" />` : `<div class="char-item-pic char-item-pic-ph"><iconify-icon icon="lucide:user"></iconify-icon></div>`}
    <span class="char-item-name">${esc(currentGiver.name || "")}</span>
    ${currentGiver.profession ? `<span class="char-item-meta">${esc(currentGiver.profession)}</span>` : ""}
    <button type="button" class="blk-ctrl qm-giver-clear" title="Remove giver"><iconify-icon icon="lucide:x"></iconify-icon></button>`;
  qmGiverSel.querySelector(".qm-giver-clear").addEventListener("click", () => { currentGiver = null; renderGiver(); onEditTick(); });
}
qmGiverSearch?.addEventListener("input", () => {
  const q = qmGiverSearch.value.trim().toLowerCase();
  if (!q) { hideDrop(qmGiverDrop); return; }
  const hits = allCharacters.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) { hideDrop(qmGiverDrop); return; }
  qmGiverDrop.innerHTML = hits.map(c =>
    `<div class="loc-drop-item" tabindex="0" data-id="${esc(c.id || "")}" data-name="${esc(c.name || "")}" data-profession="${esc(c.profession || "")}" data-picture="${esc(c.picture || "")}">
      <span>${esc(c.name)}</span>${c.profession ? `<span class="boss-drop-meta">${esc(c.profession)}</span>` : ""}
    </div>`).join("");
  qmGiverDrop.style.display = "block";
});
wireDropKeys(qmGiverSearch, qmGiverDrop, d => {
  currentGiver = { id: d.id || "", name: d.name || "", profession: d.profession || "", picture: d.picture || "" };
  qmGiverSearch.value = ""; hideDrop(qmGiverDrop); renderGiver(); onEditTick();
});

// ── Rewards (xp / gold / items) ────────────────────────────────────────────────
function renderRewardItems() {
  if (!qmRewardItems) return;
  qmRewardItems.innerHTML = (currentRewards.items || []).map((it, idx) => `
    <div class="qm-reward-item-row" data-idx="${idx}">
      <iconify-icon icon="game-icons:open-treasure-chest" class="qm-reward-item-icon"></iconify-icon>
      <span class="loot-item-name">${esc(it.name)}</span>
      ${it.value ? `<span class="loot-item-value">${esc(it.value)}</span>` : ""}
      <button type="button" class="loot-item-del blk-ctrl" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
    </div>`).join("");
  qmRewardItems.querySelectorAll(".loot-item-del").forEach(btn => {
    btn.addEventListener("click", () => { currentRewards.items.splice(Number(btn.dataset.idx), 1); renderRewardItems(); onEditTick(); });
  });
}
qmRewardXp?.addEventListener("input",   () => { currentRewards.xp   = qmRewardXp.value;   onEditTick(); });
qmRewardGold?.addEventListener("input", () => { currentRewards.gold = qmRewardGold.value; onEditTick(); });
qmRewardItemSearch?.addEventListener("input", () => {
  const q = qmRewardItemSearch.value.trim().toLowerCase();
  if (!q) { hideDrop(qmRewardItemDrop); return; }
  const hits = allItems.filter(m => m.name && m.name.toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) { hideDrop(qmRewardItemDrop); return; }
  qmRewardItemDrop.innerHTML = hits.map(m =>
    `<div class="loc-drop-item" tabindex="0" data-name="${esc(m.name)}" data-value="${esc(m.price != null ? formatGold(m.price) : "")}">
      <span>${esc(m.name)}</span>${m.price != null ? `<span class="boss-drop-meta">${formatGold(m.price)}</span>` : ""}
    </div>`).join("");
  qmRewardItemDrop.style.display = "block";
});
wireDropKeys(qmRewardItemSearch, qmRewardItemDrop, d => {
  currentRewards.items.push({ name: d.name || "", value: d.value || "" });
  qmRewardItemSearch.value = ""; hideDrop(qmRewardItemDrop); renderRewardItems(); onEditTick();
});

// ── Recommended level ──────────────────────────────────────────────────────────
qmRecLevel?.addEventListener("input", () => { currentRecommendedLevel = qmRecLevel.value; onEditTick(); });

// ── Objectives ─────────────────────────────────────────────────────────────────
function renderObjectives() {
  if (!qmObjList) return;
  qmObjList.innerHTML = currentObjectives.map((o, idx) => `
    <div class="qm-obj-row" data-idx="${idx}">
      <button type="button" class="qm-obj-check${o.done ? " done" : ""}" data-idx="${idx}" title="Toggle complete">
        <iconify-icon icon="${o.done ? "lucide:check-square" : "lucide:square"}"></iconify-icon>
      </button>
      <input type="text" class="qm-obj-text qm-input${o.done ? " done" : ""}" data-idx="${idx}" value="${esc(o.text || "")}" placeholder="Objective…" />
      <button type="button" class="qm-obj-up blk-ctrl"   data-idx="${idx}" title="Move up"><iconify-icon icon="lucide:chevron-up"></iconify-icon></button>
      <button type="button" class="qm-obj-del blk-ctrl"  data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
    </div>`).join("");
  qmObjList.querySelectorAll(".qm-obj-check").forEach(btn => btn.addEventListener("click", () => {
    const o = currentObjectives[Number(btn.dataset.idx)]; if (o) { o.done = !o.done; renderObjectives(); onEditTick(); }
  }));
  qmObjList.querySelectorAll(".qm-obj-text").forEach(inp => inp.addEventListener("input", () => {
    const o = currentObjectives[Number(inp.dataset.idx)]; if (o) { o.text = inp.value; onEditTick(); }
  }));
  qmObjList.querySelectorAll(".qm-obj-up").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.idx);
    if (i > 0) { [currentObjectives[i - 1], currentObjectives[i]] = [currentObjectives[i], currentObjectives[i - 1]]; renderObjectives(); onEditTick(); }
  }));
  qmObjList.querySelectorAll(".qm-obj-del").forEach(btn => btn.addEventListener("click", () => {
    currentObjectives.splice(Number(btn.dataset.idx), 1); renderObjectives(); onEditTick();
  }));
}
function addObjective(text) {
  if (!text.trim()) return;
  currentObjectives.push({ id: newId(), text: text.trim(), done: false });
  renderObjectives(); onEditTick();
}
qmObjAdd?.addEventListener("click", () => { addObjective(qmObjInput.value); qmObjInput.value = ""; qmObjInput.focus(); });
qmObjInput?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addObjective(qmObjInput.value); qmObjInput.value = ""; } });

// ── Prerequisites (quest chain) ────────────────────────────────────────────────
function renderPrereqs() {
  if (!qmPrereqList) return;
  qmPrereqList.innerHTML = currentPrerequisites.map((qid, idx) => {
    const q = quests.find(x => x.id === qid);
    return `<div class="qm-prereq-chip" data-idx="${idx}">
      <iconify-icon icon="lucide:link"></iconify-icon>
      <span>${esc(q ? (q.title || "Untitled") : "Unknown quest")}</span>
      <button type="button" class="qm-prereq-del" data-idx="${idx}" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
    </div>`;
  }).join("");
  qmPrereqList.querySelectorAll(".qm-prereq-del").forEach(btn => btn.addEventListener("click", () => {
    currentPrerequisites.splice(Number(btn.dataset.idx), 1); renderPrereqs(); onEditTick();
  }));
}
qmPrereqSearch?.addEventListener("input", () => {
  const q = qmPrereqSearch.value.trim().toLowerCase();
  if (!q) { hideDrop(qmPrereqDrop); return; }
  const hits = quests.filter(x => x.title && x.id !== editingId && !currentPrerequisites.includes(x.id) && x.title.toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) { hideDrop(qmPrereqDrop); return; }
  qmPrereqDrop.innerHTML = hits.map(x =>
    `<div class="loc-drop-item" tabindex="0" data-id="${esc(x.id)}">
      <span>${esc(x.title)}</span>${x.location ? `<span class="boss-drop-meta">${esc(x.location)}</span>` : ""}
    </div>`).join("");
  qmPrereqDrop.style.display = "block";
});
wireDropKeys(qmPrereqSearch, qmPrereqDrop, d => {
  if (d.id && !currentPrerequisites.includes(d.id)) currentPrerequisites.push(d.id);
  qmPrereqSearch.value = ""; hideDrop(qmPrereqDrop); renderPrereqs(); onEditTick();
});

// Refresh the whole Details panel from current state (called on open / undo / restore)
function syncDetailsPanel() {
  if (qmRewardXp)   qmRewardXp.value   = currentRewards.xp   || "";
  if (qmRewardGold) qmRewardGold.value = currentRewards.gold || "";
  if (qmRecLevel)   qmRecLevel.value   = currentRecommendedLevel || "";
  renderGiver();
  renderRewardItems();
  renderObjectives();
  renderPrereqs();
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTLINE / TIMELINE — view, find, focus and reorder groups & blocks
// ═══════════════════════════════════════════════════════════════════════════
const qmOutline = document.getElementById("qm-outline");

// Best human label for a block in the outline list.
function blockOutlineLabel(b) {
  const t = (b.blockTitle || "").trim() || (b.title || "").trim();
  if (t) return t;
  if (b.type === "text" && b.content) {
    const tmp = document.createElement("div"); tmp.innerHTML = b.content;
    const s = (tmp.textContent || "").trim(); if (s) return s.slice(0, 42);
  }
  if (b.type === "loot"     && b.items?.length)      return b.items.map(i => i.name).filter(Boolean).slice(0, 2).join(", ");
  if ((b.type === "boss" || b.type === "encounter") && b.enemies?.length) return b.enemies.map(e => e.name).filter(Boolean).slice(0, 2).join(", ");
  if (b.type === "character" && b.characters?.length) return b.characters.map(c => c.name).filter(Boolean).slice(0, 2).join(", ");
  if (b.type === "loreref"  && b.items?.length)      return b.items.map(i => i.title).filter(Boolean).slice(0, 2).join(", ");
  return BLOCK_TYPE_LABEL[b.type] || b.type;
}

function outlineItemHtml(b, ctx) {
  const cls = (b.type === "boss" || b.type === "encounter") ? " qm-ol-danger" : b.type === "note" ? " qm-ol-dm" : "";
  const reorder = ctx ? `
    <button type="button" class="qm-ol-mv qm-ol-bup" data-gi="${ctx.gi}" data-bi="${ctx.bi}" title="Move up"><iconify-icon icon="lucide:chevron-up"></iconify-icon></button>
    <button type="button" class="qm-ol-mv qm-ol-bdn" data-gi="${ctx.gi}" data-bi="${ctx.bi}" title="Move down"><iconify-icon icon="lucide:chevron-down"></iconify-icon></button>` : "";
  return `<div class="qm-ol-item${cls}${selectedBlockSet.has(b.id) ? " sel" : ""}" data-id="${b.id}">
    <button type="button" class="qm-ol-focus" data-id="${b.id}">
      <span class="qm-ol-icon">${BLOCK_TYPE_ICON[b.type] || ""}</span>
      <span class="qm-ol-label">${esc(blockOutlineLabel(b))}</span>
      ${b.sessionMarker ? `<span class="qm-ol-session ${sessionColorClass(b.sessionMarker)}">${esc(b.sessionMarker)}</span>` : ""}
    </button>${reorder}
  </div>`;
}

function renderOutline() {
  if (!qmOutline) return;
  if (!currentBlocks.length) { qmOutline.innerHTML = `<p class="qm-outline-empty">No blocks yet. Add content to build your quest.</p>`; return; }

  const grouped = new Set();
  currentGroups.forEach(g => g.blockIds.forEach(id => grouped.add(id)));
  let html = "";

  currentGroups.forEach((g, gi) => {
    const col = g.color || "#ffcc66";
    html += `<div class="qm-ol-group" data-gi="${gi}">
      <div class="qm-ol-group-hdr">
        <button type="button" class="qm-ol-group-focus" data-gi="${gi}">
          <span class="qm-ol-dot" style="background:${esc(col)}"></span>
          <span class="qm-ol-group-name">${esc(g.title || "Untitled group")}</span>
          <span class="qm-ol-count">${g.blockIds.length}</span>
        </button>
        <button type="button" class="qm-ol-mv qm-ol-gup" data-gi="${gi}" title="Move group up"><iconify-icon icon="lucide:chevron-up"></iconify-icon></button>
        <button type="button" class="qm-ol-mv qm-ol-gdn" data-gi="${gi}" title="Move group down"><iconify-icon icon="lucide:chevron-down"></iconify-icon></button>
      </div>
      <div class="qm-ol-group-body">
        ${g.blockIds.map((id, bi) => { const b = blockById(id); return b ? outlineItemHtml(b, { gi, bi }) : ""; }).join("")}
      </div>
    </div>`;
  });

  const ungrouped = currentBlocks.filter(b => !grouped.has(b.id));
  if (ungrouped.length) {
    html += `<div class="qm-ol-group qm-ol-ungrouped">
      ${currentGroups.length ? `<div class="qm-ol-group-hdr"><span class="qm-ol-group-name qm-ol-ungrouped-name">Ungrouped</span><span class="qm-ol-count">${ungrouped.length}</span></div>` : ""}
      <div class="qm-ol-group-body">${ungrouped.map(b => outlineItemHtml(b, null)).join("")}</div>
    </div>`;
  }
  qmOutline.innerHTML = html;

  qmOutline.querySelectorAll(".qm-ol-focus").forEach(btn => btn.addEventListener("click", () => focusBlock(btn.dataset.id)));
  qmOutline.querySelectorAll(".qm-ol-group-focus").forEach(btn => btn.addEventListener("click", () => focusGroup(Number(btn.dataset.gi))));
  qmOutline.querySelectorAll(".qm-ol-gup").forEach(btn => btn.addEventListener("click", () => moveGroup(Number(btn.dataset.gi), -1)));
  qmOutline.querySelectorAll(".qm-ol-gdn").forEach(btn => btn.addEventListener("click", () => moveGroup(Number(btn.dataset.gi), 1)));
  qmOutline.querySelectorAll(".qm-ol-bup").forEach(btn => btn.addEventListener("click", () => moveBlockInGroup(Number(btn.dataset.gi), Number(btn.dataset.bi), -1)));
  qmOutline.querySelectorAll(".qm-ol-bdn").forEach(btn => btn.addEventListener("click", () => moveBlockInGroup(Number(btn.dataset.gi), Number(btn.dataset.bi), 1)));
}

function moveGroup(gi, dir) {
  const j = gi + dir;
  if (j < 0 || j >= currentGroups.length) return;
  [currentGroups[gi], currentGroups[j]] = [currentGroups[j], currentGroups[gi]];
  onEditTick(); renderOutline(); buildGroupsInEditor();
}
function moveBlockInGroup(gi, bi, dir) {
  const g = currentGroups[gi]; if (!g) return;
  const j = bi + dir;
  if (j < 0 || j >= g.blockIds.length) return;
  [g.blockIds[bi], g.blockIds[j]] = [g.blockIds[j], g.blockIds[bi]];
  onEditTick(); renderOutline();
}

// Pan/zoom the canvas so a block sits centred & readable, then select + flash it.
function focusBlock(id) {
  const b = blockById(id); if (!b) return;
  const rect = _getCanvasRect() || qmBlockCanvas.getBoundingClientRect();
  const el = blockElById(id);
  const w = b.width || BLOCK_DEFAULT_W, h = el?.offsetHeight || b.height || BLOCK_DEFAULT_H;
  if (canvasZoom < 0.6 || canvasZoom > 1.4) canvasZoom = 1;
  canvasPanX = rect.width  / 2 - ((b.worldX || 0) + w / 2) * canvasZoom;
  canvasPanY = rect.height / 2 - ((b.worldY || 0) + h / 2) * canvasZoom;
  applyCanvasTransform();
  selectedBlockSet.clear(); selectedBlockSet.add(id); refreshSelectionClasses();
  const e2 = blockElById(id);
  if (e2) { e2.classList.add("blk-focus-flash"); setTimeout(() => e2.classList.remove("blk-focus-flash"), 1000); }
}

// Fit the canvas to a group's bounds and select all its members.
function focusGroup(gi) {
  const g = currentGroups[gi]; if (!g) return;
  const bounds = getGroupBounds(g); if (!bounds) return;
  const rect = _getCanvasRect() || qmBlockCanvas.getBoundingClientRect();
  const pad = 48;
  canvasZoom = Math.min(1.1, Math.max(0.25, Math.min(rect.width / (bounds.w + pad * 2), rect.height / (bounds.h + pad * 2))));
  canvasPanX = rect.width  / 2 - (bounds.x + bounds.w / 2) * canvasZoom;
  canvasPanY = rect.height / 2 - (bounds.y + bounds.h / 2) * canvasZoom;
  applyCanvasTransform();
  selectedBlockSet.clear(); g.blockIds.forEach(id => selectedBlockSet.add(id)); refreshSelectionClasses();
}
