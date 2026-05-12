'use strict';
import { db }                                        from "./firebase.js";
import { ref, set, remove, onValue, push }           from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getSession, clearSession, hashPassword }    from "./auth.js";
import { parseTags, formatGold, getDisplayTags } from "./item-utils.js";

// ── Auth guard ────────────────────────────────────────────────────────────────
const session = getSession();
if (!session) { window.location.href = "login.html"; }

const isAdmin     = session.role === "admin";
const usersRef    = ref(db, "users");
const inventoryRef = ref(db, "inventory");

let allItemsDb = [];
onValue(ref(db, "items"), snap => { allItemsDb = snap.val() ? Object.values(snap.val()) : []; });

let selectedItemDb = null;

// ── State ─────────────────────────────────────────────────────────────────────
let allUsers     = {};   // { id: { id, username, color, role } }
let allInventory = {};   // { userId: { itemId: item } }
let allAttunements = {};
let allSpells    = {};
let allSpellbooks = {};
let viewingId    = session.id;  // which player's inventory to show
let activeFilter = "all";
let sendItemId   = null;
let sendItemOwner = null;
let selectedSendTarget = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const heroTitle      = document.getElementById("inv-hero-title");
const heroSub        = document.getElementById("inv-hero-sub");
const playerSelector = document.getElementById("player-selector");
const playerSelect   = document.getElementById("player-select");
const invGrid        = document.getElementById("inv-grid");
const addBtn         = document.getElementById("add-btn");
const manageBtn      = document.getElementById("manage-btn");


// ── Firebase listeners ────────────────────────────────────────────────────────
onValue(usersRef, snap => {
  allUsers = snap.val() || {};
  renderPlayerSelector();
  renderGrid();
});

onValue(inventoryRef, snap => {
  allInventory = snap.val() || {};
  renderGrid();
});

onValue(ref(db, "attunements"), snap => {
  allAttunements = snap.val() || {};
  renderGrid();
});

onValue(ref(db, "spells"), snap => {
  allSpells = snap.val() || {};
  if (activeFilter === "spells") renderGrid();
});

onValue(ref(db, "spellbook"), snap => {
  allSpellbooks = snap.val() || {};
  if (activeFilter === "spells") renderGrid();
});

// ── Player selector ───────────────────────────────────────────────────────────
function renderPlayerSelector() {
  if (!isAdmin) return;
  playerSelector.style.display = "inline-flex";
  playerSelect.innerHTML = Object.values(allUsers)
    .sort((a, b) => (a.username || "").localeCompare(b.username || ""))
    .map(u => `<option value="${esc(u.id)}" ${u.id === viewingId ? "selected" : ""}>${esc(u.username)}${u.role === "admin" ? " (DM)" : ""}</option>`)
    .join("");
  // Populate add-item target select
  const aiTarget = document.getElementById("ai-target");
  aiTarget.innerHTML = Object.values(allUsers)
    .filter(u => u.id !== session.id || isAdmin)
    .sort((a, b) => (a.username || "").localeCompare(b.username || ""))
    .map(u => `<option value="${esc(u.id)}">${esc(u.username)}</option>`)
    .join("");
  // Default add-item target to currently viewed player
  aiTarget.value = viewingId;
}

playerSelect.addEventListener("change", () => {
  viewingId = playerSelect.value;
  renderGrid();
});

// ── Render inventory grid ─────────────────────────────────────────────────────
function renderGrid() {
  const owner = allUsers[viewingId];
  const ownerName = owner ? owner.username : (viewingId === session.id ? session.username : "Unknown");
  const ownerColor = owner ? owner.color : session.color;

  if (viewingId === session.id) {
    heroTitle.textContent = `${ownerName}'s Inventory`;
    heroSub.textContent   = "Your adventurer's belongings";
  } else {
    heroTitle.textContent = `${ownerName}'s Inventory`;
    heroSub.textContent   = isAdmin ? "Viewing as DM" : "";
  }
  heroTitle.style.color = ownerColor || "var(--accent)";

  const userAttunes = allAttunements[viewingId] || {};
  const attunedCount = Object.keys(userAttunes).length;
  const attBar = document.getElementById("inv-attunement-bar");
  const attSlots = document.getElementById("inv-attunement-slots");
  attBar.style.display = "block";
  attSlots.textContent = `${attunedCount} / 3 Attunement Slots`;
  attSlots.style.color = attunedCount === 3 ? "#e57373" : attunedCount >= 2 ? "#ff9800" : "var(--accent)";

  if (activeFilter === "spells") {
    renderSpellsGrid();
    return;
  }

  const items = (allInventory[viewingId]
    ? Object.values(allInventory[viewingId])
    : []).map(it => ({
      ...it,
      _etype: (() => {
        const raw = it.type || "misc";
        // "book" / "scroll" type only routes to the lore tab when the item
        // carries actual lore content (pages, writer, or content fields).
        // Shop items typed as scroll/book have none of these — treat as misc.
        if (raw === "book" || raw === "scroll") {
          return (it.pages != null || it.writer != null || it.content != null)
            ? raw : "misc";
        }
        if (raw === "misc" && it.tags) return inferTypeFromTags(it.tags);
        return raw;
      })(),
    }));

  const filtered = activeFilter === "all"
    ? items.filter(it => it._etype !== "book" && it._etype !== "scroll")
    : activeFilter === "books-scrolls"
      ? items.filter(it => it._etype === "book" || it._etype === "scroll")
      : items.filter(it => it._etype === activeFilter);

  // Stack identical items (same name + effective type)
  const stackMap = {};
  filtered.forEach(it => {
    const key = (it._etype || "misc") + "::" + (it.name || "");
    if (!stackMap[key]) {
      stackMap[key] = { ...it, _stackQty: it.quantity || 1, _stackIds: [it.id] };
    } else {
      stackMap[key]._stackQty += (it.quantity || 1);
      stackMap[key]._stackIds.push(it.id);
    }
  });
  const RARITY_ORDER = { legendary: 0, "very rare": 1, rare: 2, uncommon: 3, common: 4 };
  const attKey = name => (name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  const visible = Object.values(stackMap)
    .sort((a, b) => {
      const aAttuned = attKey(a.name) in userAttunes ? 0 : 1;
      const bAttuned = attKey(b.name) in userAttunes ? 0 : 1;
      if (aAttuned !== bAttuned) return aAttuned - bAttuned;
      return (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5);
    });

  if (visible.length === 0) {
    const baseItems = items.filter(it => it._etype !== "book" && it._etype !== "scroll");
    const loreItems = items.filter(it => it._etype === "book" || it._etype === "scroll");
    let msg = "No items in this category.";
    if (activeFilter === "all" && baseItems.length === 0)       msg = "No items yet. Ask your DM for loot!";
    if (activeFilter === "books-scrolls" && loreItems.length === 0) msg = "No books or scrolls yet.";
    invGrid.innerHTML = `<p class="inv-empty">${msg}</p>`;
    return;
  }

  invGrid.innerHTML = "";
  visible.forEach(item => {
    const card = buildItemCard(item, viewingId);
    invGrid.appendChild(card);
    const nameEl = card.querySelector(".inv-item-name");
    if (nameEl) fitText(nameEl);
  });
}

// ── Item card ─────────────────────────────────────────────────────────────────
const TYPE_ICON  = { weapon: "game-icons:crossed-swords", armor: "game-icons:shield", potion: "game-icons:potion", book: "game-icons:open-book", scroll: "game-icons:scroll-unfurled", misc: "lucide:gem" };
const TYPE_LABEL = { weapon: "Weapon", armor: "Armor", potion: "Potion", book: "Book", scroll: "Scroll", misc: "Misc" };

// Cover colours cycling for books without an explicit colour
const BOOK_COVER_COLORS = ["#8b4513","#1a3a5c","#2d5a27","#5c1a2a","#4a3b6b","#6b5a1a","#5c3317","#3d3d3d"];
function bookColor(item) {
  if (item.coverColor) return item.coverColor;
  // Derive a stable colour from the item id
  let n = 0; for (let i = 0; i < (item.id || "").length; i++) n += item.id.charCodeAt(i);
  return BOOK_COVER_COLORS[n % BOOK_COVER_COLORS.length];
}

// Extract author from "Written by X" description or use writer field
function getAuthor(item) {
  if (item.writer) return item.writer;
  if (item.description?.startsWith("Written by ")) return item.description.slice(11);
  return null;
}

function buildItemCard(item, ownerId) {
  if (item._etype === "book")   return buildBookCard(item, ownerId);
  if (item._etype === "scroll") return buildScrollCard(item, ownerId);
  return buildGenericCard(item, ownerId);
}

function stackQtyBadge(item) {
  const qty = item._stackQty || item.quantity || 1;
  return qty > 1 ? `<span class="inv-qty-badge">×${qty}</span>` : "";
}

function wireCardActions(wrap, item, ownerId) {
  wrap.querySelector(".btn-read")?.addEventListener("click", e => { e.stopPropagation(); openReadModal(item); });
  wrap.querySelector(".btn-send")?.addEventListener("click", e => { e.stopPropagation(); openSendModal(item, ownerId); });
  wrap.querySelector(".btn-delete")?.addEventListener("click", e => { e.stopPropagation(); openRemoveModal(item, ownerId); });
}

function invCardActions(item, ownerId) {
  const canRemove = isAdmin || ownerId === session.id;
  return `<div class="inv-lore-actions">
    <button class="inv-action-btn btn-read">Read</button>
    <button class="inv-action-btn btn-send">Send</button>
    ${canRemove ? `<button class="inv-action-btn btn-delete">Remove</button>` : ""}
  </div>`;
}

// Book card — same 3-D cover as lore page
function buildBookCard(item, ownerId) {
  const wrap  = document.createElement("div");
  wrap.className = "inv-lore-card inv-book-card";
  const color  = bookColor(item);
  const title  = esc(item.name || "");
  const author = getAuthor(item);
  const giverName = item.givenBy && allUsers[item.givenBy] ? allUsers[item.givenBy].username : (item.givenBy === "admin" ? "DM" : null);

  wrap.innerHTML = `
    <div class="book-cover inv-book-cover" style="--cover-color:${color}">
      <div class="book-spine"><span class="book-spine-text">${title}</span></div>
      <div class="book-front">
        <div class="book-front-title">${title}</div>
        ${author ? `<div class="book-front-divider"></div><div class="book-front-writer">${esc(author)}</div>` : ""}
      </div>
    </div>
    <div class="inv-lore-label">
      <span class="inv-lore-name">${title}</span>
      ${stackQtyBadge(item)}
      ${giverName ? `<span class="inv-lore-giver">from ${esc(giverName)}</span>` : ""}
    </div>
    ${invCardActions(item, ownerId)}`;

  wireCardActions(wrap, item, ownerId);
  return wrap;
}

// Scroll card — same rolled-parchment style as lore page
function buildScrollCard(item, ownerId) {
  const wrap  = document.createElement("div");
  wrap.className = "inv-lore-card inv-scroll-card";
  const title  = esc(item.name || "");
  const author = getAuthor(item);
  const giverName = item.givenBy && allUsers[item.givenBy] ? allUsers[item.givenBy].username : (item.givenBy === "admin" ? "DM" : null);

  wrap.innerHTML = `
    <div class="scroll-cover inv-scroll-cover">
      <div class="scroll-roll top"></div>
      <div class="scroll-body">
        <div class="scroll-body-title">${title}</div>
        ${author ? `<div class="scroll-body-writer">${esc(author)}</div>` : ""}
      </div>
      <div class="scroll-roll bottom"></div>
    </div>
    <div class="inv-lore-label">
      <span class="inv-lore-name">${title}</span>
      ${stackQtyBadge(item)}
      ${giverName ? `<span class="inv-lore-giver">from ${esc(giverName)}</span>` : ""}
    </div>
    ${invCardActions(item, ownerId)}`;

  wireCardActions(wrap, item, ownerId);
  return wrap;
}

// Rarity colours (matches items.js)
const RARITY_COLORS = {
  "common":    "#9e9e9e",
  "uncommon":  "#4caf50",
  "rare":      "#2196f3",
  "very rare": "#9c27b0",
  "legendary": "#ff9800",
};

// Standard item card for weapons / armor / potions / misc
function buildGenericCard(item, ownerId) {
  const card = document.createElement("div");
  card.className = "inv-card";
  card.dataset.type = item.type || "misc";

  const giverName = item.givenBy && allUsers[item.givenBy] ? allUsers[item.givenBy].username : (item.givenBy === "admin" ? "DM" : null);
  const rarity      = item.rarity || null;
  const rarityColor = rarity ? (RARITY_COLORS[rarity] || "#9e9e9e") : null;

  if (rarityColor) card.style.setProperty("--rc", rarityColor);

  const effectiveType = item._etype || "misc";

  const attKey = (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  const userAttunes = allAttunements[ownerId] || {};
  const isAttuned = attKey in userAttunes;
  if (isAttuned) card.classList.add("inv-card-attuned");
  const attunedCount = Object.keys(userAttunes).length;
  const needsAttunement = item.requiresAttunement === true;
  const canAttune = needsAttunement && (isAdmin || ownerId === session.id);

  const abilities = Array.isArray(item.abilities) ? item.abilities : (item.abilities ? Object.values(item.abilities) : []);

  card.innerHTML = `
    ${isAdmin ? `<button class="inv-quick-edit-btn" title="Edit item"><iconify-icon icon="lucide:pencil"></iconify-icon></button>` : ""}
    <div class="inv-card-body">
      <div class="inv-card-top">
        <iconify-icon icon="${TYPE_ICON[effectiveType] || 'lucide:gem'}" class="inv-type-icon"></iconify-icon>
        <div class="inv-name-wrap">
          <h3 class="inv-item-name">${esc(item.name || "Unknown Item")}${isAttuned ? `<span class="inv-attuned-badge"><iconify-icon icon="lucide:sparkles"></iconify-icon> Attuned</span>` : ""}</h3>
          <div class="inv-badges">
            <span class="inv-type-badge inv-badge-${effectiveType}">${TYPE_LABEL[effectiveType] || "Misc"}</span>
            ${stackQtyBadge(item)}
            ${rarity ? `<span class="inv-rarity-label" style="color:${rarityColor}">${esc(rarity)}</span>` : ""}
            ${needsAttunement && !isAttuned ? `<span class="inv-attunement-required-badge"><iconify-icon icon="lucide:link"></iconify-icon> Requires Attunement</span>` : ""}
          </div>
        </div>
      </div>
      <div class="inv-card-details">
        ${item.description ? `<p class="inv-desc">${esc(item.description)}</p>` : ""}
        ${item.tags ? `<div class="inv-tags">${item.tags.split(",").map(t => `<span class="inv-tag">${esc(t.trim())}</span>`).join("")}</div>` : ""}
        ${abilities.length ? `
          <div class="inv-abilities-toggle"><iconify-icon icon="lucide:chevron-down"></iconify-icon> ${abilities.length === 1 ? "1 Ability" : abilities.length + " Abilities"}</div>
          <div class="inv-abilities">${abilities.map(a => `
            <div class="inv-ability">
              <span class="inv-ability-name">${esc(a.name)}</span>
              ${a.description ? `<span class="inv-ability-desc">${esc(a.description)}</span>` : ""}
            </div>`).join("")}</div>` : ""}
        ${giverName ? `<p style="font-size:11px;color:#555;margin:6px 0 0;font-style:italic">Given by ${esc(giverName)}</p>` : ""}
        <div class="inv-card-actions">
          <button class="inv-action-btn btn-send">Send</button>
          ${canAttune && !isAttuned ? `<button class="inv-action-btn btn-attune">Attune</button>` : ""}
          ${canAttune && isAttuned ? `<button class="inv-action-btn btn-unattuned"><iconify-icon icon="lucide:star"></iconify-icon> Attuned</button>` : ""}
          ${(isAdmin || ownerId === session.id) ? `<button class="inv-action-btn btn-delete">Remove</button>` : ""}
        </div>
      </div>
    </div>`;

  card.querySelector(".btn-send").addEventListener("click", () => openSendModal(item, ownerId));
  card.querySelector(".btn-delete")?.addEventListener("click", () => openRemoveModal(item, ownerId));
  card.querySelector(".inv-quick-edit-btn")?.addEventListener("click", e => { e.stopPropagation(); openQuickEdit(item, ownerId); });

  if (canAttune) {
    const attBtn = card.querySelector(".btn-attune");
    const unattBtn = card.querySelector(".btn-unattuned");
    if (attBtn) {
      attBtn.addEventListener("click", async () => {
        const count = Object.keys(allAttunements[ownerId] || {}).length;
        if (count >= 3) {
          attBtn.textContent = "Slots full!";
          attBtn.style.color = "#e57373";
          setTimeout(() => { attBtn.textContent = "Attune"; attBtn.style.color = ""; }, 2000);
          return;
        }
        await set(ref(db, `attunements/${ownerId}/${attKey}`), { name: item.name, type: item.type, rarity: item.rarity || null, timestamp: Date.now() });
      });
    }
    if (unattBtn) {
      unattBtn.addEventListener("click", async () => {
        await remove(ref(db, `attunements/${ownerId}/${attKey}`));
      });
    }
  }

  return card;
}

// ── Compact view toggle (mobile) ─────────────────────────────────────────────
let compactView = localStorage.getItem("inv-compact") === "1";
const viewToggleBtn = document.getElementById("inv-view-toggle");

function applyCompactView() {
  invGrid.classList.toggle("compact", compactView);
  viewToggleBtn.classList.toggle("active", compactView);
  viewToggleBtn.title = compactView ? "Switch to detailed view" : "Switch to compact view";
}
applyCompactView();

viewToggleBtn.addEventListener("click", () => {
  compactView = !compactView;
  localStorage.setItem("inv-compact", compactView ? "1" : "0");
  applyCompactView();
});

// Click-to-expand cards (compact: collapses others; desktop: abilities toggle)
invGrid.addEventListener("click", e => {
  const card = e.target.closest(".inv-card");
  if (!card) return;
  if (e.target.closest("button, a, input")) return;
  if (compactView) {
    invGrid.querySelectorAll(".inv-card.expanded").forEach(c => {
      if (c !== card) c.classList.remove("expanded");
    });
  }
  card.classList.toggle("expanded");
});

// ── Filter tabs ───────────────────────────────────────────────────────────────
document.querySelectorAll(".inv-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".inv-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderGrid();
  });
});

// ── Add Item modal ────────────────────────────────────────────────────────────
if (isAdmin) {
  addBtn.style.display = "inline-flex";
  manageBtn.style.display = "inline-flex";
}

addBtn.addEventListener("click", () => {
  selectedItemDb = null;
  const srch = document.getElementById("ai-search");
  if (srch) srch.value = "";
  document.getElementById("ai-drop").style.display = "none";
  document.getElementById("ai-selected-preview").style.display = "none";
  document.getElementById("ai-type").value = "misc";  // reset; updated by selectItemFromDb
  document.getElementById("ai-qty").value = "1";
  document.getElementById("ai-error").classList.remove("show");
  const aiTarget = document.getElementById("ai-target");
  if (aiTarget.querySelector(`option[value="${viewingId}"]`)) aiTarget.value = viewingId;
  openModal("add-modal");
  setTimeout(() => srch?.focus(), 50);
});

// Item search in add modal
const aiSearchInput = document.getElementById("ai-search");
const aiDrop = document.getElementById("ai-drop");

// Move dropdown to body so it's never clipped by modal overflow
document.body.appendChild(aiDrop);

function _positionDrop() {
  const r = aiSearchInput.getBoundingClientRect();
  aiDrop.style.top   = (r.bottom + window.scrollY + 4) + "px";
  aiDrop.style.left  = r.left + "px";
  aiDrop.style.width = r.width + "px";
}

function _showDrop(html) {
  aiDrop.innerHTML = html;
  _positionDrop();
  aiDrop.style.display = "block";
  aiDrop.querySelectorAll(".ai-drop-item").forEach(row => {
    row.addEventListener("mousedown", e => {
      e.preventDefault();
      const item = allItemsDb.find(i => i.id === row.dataset.id);
      if (item) selectItemFromDb(item);
    });
  });
}

aiSearchInput.addEventListener("input", () => {
  const q = aiSearchInput.value.trim().toLowerCase();
  if (!q) { aiDrop.style.display = "none"; return; }
  const hits = allItemsDb
    .filter(it => (it.name || "").toLowerCase().includes(q) || (it.description || "").toLowerCase().includes(q))
    .slice(0, 10);
  if (!hits.length) {
    _showDrop(`<div class="ai-drop-empty">No items found</div>`);
    return;
  }
  _showDrop(hits.map(it => `
    <div class="ai-drop-item" data-id="${esc(it.id)}">
      <span class="ai-drop-name">${esc(it.name)}</span>
      ${it.rarity ? `<span class="ai-drop-rarity" style="color:${RARITY_COLORS[it.rarity] || '#9e9e9e'}">${esc(it.rarity)}</span>` : ""}
    </div>`).join(""));
});

aiSearchInput.addEventListener("blur",   () => setTimeout(() => { aiDrop.style.display = "none"; }, 150));
aiSearchInput.addEventListener("focus",  () => { if (aiSearchInput.value.trim()) aiSearchInput.dispatchEvent(new Event("input")); });
window.addEventListener("scroll",        () => { if (aiDrop.style.display !== "none") _positionDrop(); }, { passive: true });
window.addEventListener("resize",        () => { if (aiDrop.style.display !== "none") _positionDrop(); }, { passive: true });

function selectItemFromDb(item) {
  selectedItemDb = item;
  aiSearchInput.value = item.name;
  aiDrop.style.display = "none";
  document.getElementById("ai-type").value = inferTypeFromTags(item.tags);
  const preview = document.getElementById("ai-selected-preview");
  const rc = RARITY_COLORS[item.rarity] || null;
  preview.innerHTML = `
    <div class="ai-preview-card${rc ? " ai-preview-rarity-tinted" : ""}" ${rc ? `style="border-color:${rc}40"` : ""}>
      <div class="ai-preview-name">${esc(item.name)}</div>
      ${rc ? `<span class="ai-preview-rarity" style="color:${rc}">${esc(item.rarity)}</span>` : ""}
      ${item.description ? `<p class="ai-preview-desc">${esc(item.description)}</p>` : ""}
    </div>`;
  preview.style.display = "block";
}

document.getElementById("ai-save").addEventListener("click", async () => {
  const errEl  = document.getElementById("ai-error");
  const target = document.getElementById("ai-target").value;
  const qty    = Math.max(1, parseInt(document.getElementById("ai-qty").value, 10) || 1);
  const type   = document.getElementById("ai-type").value;

  if (!selectedItemDb) { errEl.textContent = "Please search and select an item."; errEl.classList.add("show"); return; }
  if (!target) { errEl.textContent = "Select a player."; errEl.classList.add("show"); return; }
  errEl.classList.remove("show");

  const itemRef = push(ref(db, `inventory/${target}`));
  await set(itemRef, {
    id:           itemRef.key,
    name:         selectedItemDb.name,
    type,
    quantity:     qty,
    value:        selectedItemDb.price ? String(selectedItemDb.price) + " gp" : null,
    description:  selectedItemDb.description || null,
    content:      null,
    rarity:       selectedItemDb.rarity || null,
    tags:         selectedItemDb.tags || null,
    abilities:    selectedItemDb.abilities || null,
    sourceItemId: selectedItemDb.id,
    givenBy:      session.id,
    timestamp:    Date.now(),
  });
  closeModal("add-modal");
  if (isAdmin && target !== viewingId) {
    viewingId = target;
    if (playerSelect.querySelector(`option[value="${target}"]`)) playerSelect.value = target;
    renderGrid();
  }
});

// ── Reader modal (book / scroll) ──────────────────────────────────────────────
const invReader           = document.getElementById("inv-reader");
const invReaderBook       = document.getElementById("inv-reader-book");
const invReaderScroll     = document.getElementById("inv-reader-scroll");
const invReaderCover      = document.getElementById("inv-reader-cover");
const invReaderSpine      = document.getElementById("inv-reader-spine");
const invReaderCoverTitle = document.getElementById("inv-reader-cover-title");
const invReaderCoverWriter= document.getElementById("inv-reader-cover-writer");
const invReaderPageTitle  = document.getElementById("inv-reader-page-title");
const invReaderPageContent= document.getElementById("inv-reader-page-content");
const invReaderPageNum    = document.getElementById("inv-reader-page-num");
const invReaderPrev       = document.getElementById("inv-reader-prev");
const invReaderNext       = document.getElementById("inv-reader-next");
const invReaderScrollTitle  = document.getElementById("inv-reader-scroll-title");
const invReaderScrollWriter = document.getElementById("inv-reader-scroll-writer");
const invReaderScrollContent= document.getElementById("inv-reader-scroll-content");

let invReaderPageIndex = 0;
let invReaderPages     = [];

function openReadModal(item) {
  invReaderBook.style.display   = "none";
  invReaderScroll.style.display = "none";

  if (item.type === "book") {
    const color = bookColor(item);
    invReaderCover.style.setProperty("--cover-color", color);
    invReaderSpine.style.setProperty("--cover-color", color);
    invReaderCoverTitle.textContent  = item.name || "";
    invReaderCoverWriter.textContent = getAuthor(item) ? `by ${getAuthor(item)}` : "";

    // Support pages array OR Firebase object (Firebase converts arrays to {0:{…},1:{…},…})
    let rawPages = item.pages;
    if (rawPages && !Array.isArray(rawPages)) {
      rawPages = Object.keys(rawPages)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => rawPages[k]);
    }
    if (rawPages && rawPages.length > 0) {
      invReaderPages = rawPages;
    } else if (item.content) {
      invReaderPages = [{ title: "", content: item.content }];
    } else {
      invReaderPages = [{ title: "", content: "(No text written in this book.)" }];
    }
    invReaderPageIndex = 0;
    renderInvReaderPage();
    invReaderBook.style.display = "flex";
  } else {
    // Scroll
    invReaderScrollTitle.textContent   = item.name || "";
    invReaderScrollWriter.textContent  = getAuthor(item) ? `by ${getAuthor(item)}` : "";
    invReaderScrollContent.textContent = item.content || "(This scroll is blank.)";
    invReaderScroll.style.display = "flex";
  }

  invReader.classList.add("open");
}

function renderInvReaderPage() {
  const page = invReaderPages[invReaderPageIndex] || {};
  invReaderPageTitle.textContent   = page.title || "";
  invReaderPageContent.textContent = page.content || "";
  invReaderPageNum.textContent     = `Page ${invReaderPageIndex + 1} of ${invReaderPages.length}`;
  invReaderPrev.disabled = invReaderPageIndex === 0;
  invReaderNext.disabled = invReaderPageIndex === invReaderPages.length - 1;
}

invReaderPrev.addEventListener("click", () => {
  if (invReaderPageIndex > 0) { invReaderPageIndex--; renderInvReaderPage(); }
});
invReaderNext.addEventListener("click", () => {
  if (invReaderPageIndex < invReaderPages.length - 1) { invReaderPageIndex++; renderInvReaderPage(); }
});
document.getElementById("inv-reader-close").addEventListener("click", () => invReader.classList.remove("open"));
invReader.addEventListener("click", e => { if (e.target === invReader) invReader.classList.remove("open"); });

// ── Send modal ────────────────────────────────────────────────────────────────
let sendStackIds  = [];   // all Firebase IDs in the stack being sent

function openSendModal(item, ownerId) {
  sendItemId    = item.id;
  sendItemOwner = ownerId;
  sendStackIds  = item._stackIds || [item.id];
  selectedSendTarget = null;

  const qty = item._stackQty || item.quantity || 1;
  document.getElementById("send-item-name").textContent =
    (item.name || "Item") + (sendStackIds.length > 1 ? ` ×${sendStackIds.length}` : qty > 1 ? ` ×${qty}` : "");
  document.getElementById("send-error").classList.remove("show");

  const list = document.getElementById("send-player-list");
  const others = Object.values(allUsers).filter(u => u.id !== ownerId);

  if (others.length === 0) {
    list.innerHTML = `<p style="color:#666;font-style:italic;font-size:13px">No other players to send to.</p>`;
  } else {
    list.innerHTML = others.map(u => `
      <div class="inv-player-opt" data-id="${esc(u.id)}">
        <span class="inv-player-dot" style="background:${esc(u.color || '#888')}"></span>
        <span class="inv-player-opt-name">${esc(u.username)}</span>
      </div>`).join("");
    list.querySelectorAll(".inv-player-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        list.querySelectorAll(".inv-player-opt").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedSendTarget = opt.dataset.id;
      });
    });
  }
  openModal("send-modal");
}

document.getElementById("send-confirm").addEventListener("click", async () => {
  const errEl = document.getElementById("send-error");
  if (!selectedSendTarget) {
    errEl.textContent = "Please select a recipient.";
    errEl.classList.add("show");
    return;
  }
  errEl.classList.remove("show");

  // Send every item in the stack
  const ownerItems = allInventory[sendItemOwner] || {};
  const ids = sendStackIds.length > 0 ? sendStackIds : [sendItemId];
  for (const id of ids) {
    const item = ownerItems[id];
    if (!item) continue;
    const newRef = push(ref(db, `inventory/${selectedSendTarget}`));
    await set(newRef, { ...item, id: newRef.key, givenBy: sendItemOwner, timestamp: Date.now() });
    await remove(ref(db, `inventory/${sendItemOwner}/${id}`));
  }
  closeModal("send-modal");
});

// ── Remove modal ─────────────────────────────────────────────────────────────
let removeItem   = null;
let removeOwner  = null;

function openRemoveModal(item, ownerId) {
  removeItem  = item;
  removeOwner = ownerId;

  const totalQty = item._stackQty || item.quantity || 1;
  const label    = document.getElementById("remove-item-label");
  const qtyRow   = document.getElementById("remove-qty-row");
  const qtyInput = document.getElementById("remove-qty-input");

  label.innerHTML = `Drop <strong style="color:var(--text)">${esc(item.name)}</strong>` +
    (totalQty > 1 ? ` <span style="color:var(--accent)">×${totalQty}</span>` : "") +
    " from your inventory?";

  if (totalQty > 1) {
    qtyInput.max   = totalQty;
    qtyInput.value = 1;
    qtyRow.style.display = "block";
  } else {
    qtyRow.style.display = "none";
  }
  openModal("remove-modal");
}

document.getElementById("remove-qty-minus").addEventListener("click", () => {
  const el = document.getElementById("remove-qty-input");
  el.value = Math.max(1, parseInt(el.value) - 1);
});
document.getElementById("remove-qty-plus").addEventListener("click", () => {
  const el = document.getElementById("remove-qty-input");
  el.value = Math.min(parseInt(el.max), parseInt(el.value) + 1);
});
document.getElementById("remove-qty-all").addEventListener("click", () => {
  const el = document.getElementById("remove-qty-input");
  el.value = el.max;
});

document.getElementById("remove-confirm").addEventListener("click", async () => {
  if (!removeItem || !removeOwner) return;

  const totalQty = removeItem._stackQty || removeItem.quantity || 1;
  const qtyInput = document.getElementById("remove-qty-input");
  const toRemove = totalQty > 1 ? Math.min(totalQty, Math.max(1, parseInt(qtyInput.value) || 1)) : totalQty;

  // Walk through stack IDs and remove/decrement
  let remaining = toRemove;
  const ownerItems = allInventory[removeOwner] || {};
  const ids = removeItem._stackIds || [removeItem.id];
  for (const id of ids) {
    if (remaining <= 0) break;
    const it = ownerItems[id];
    if (!it) continue;
    const qty = it.quantity || 1;
    if (qty <= remaining) {
      await remove(ref(db, `inventory/${removeOwner}/${id}`));
      remaining -= qty;
    } else {
      await set(ref(db, `inventory/${removeOwner}/${id}/quantity`), qty - remaining);
      remaining = 0;
    }
  }
  closeModal("remove-modal");
});

// ── Manage Players modal (admin) ──────────────────────────────────────────────
manageBtn.addEventListener("click", () => {
  renderPlayerList();
  openModal("manage-modal");
});

function renderPlayerList() {
  const el = document.getElementById("player-list-el");
  const players = Object.values(allUsers).sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  if (players.length === 0) {
    el.innerHTML = `<p style="color:#666;font-style:italic;font-size:13px">No accounts yet.</p>`;
    return;
  }
  el.innerHTML = players.map(u => `
    <div class="player-entry">
      <div class="player-entry-info">
        <span class="player-entry-dot" style="background:${esc(u.color || '#888')}"></span>
        <span class="player-entry-name">${esc(u.username)}</span>
        <span class="player-entry-role">${u.role === "admin" ? "DM" : "Player"}</span>
      </div>
      ${u.id !== session.id ? `<button class="player-entry-del" data-id="${esc(u.id)}">Remove</button>` : '<span style="font-size:11px;color:#555">(you)</span>'}
    </div>`).join("");
  el.querySelectorAll(".player-entry-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.id;
      const name = allUsers[uid]?.username || "this player";
      if (confirm(`Remove account "${name}"? This also deletes their inventory.`)) {
        remove(ref(db, `users/${uid}`));
        remove(ref(db, `inventory/${uid}`));
        remove(ref(db, `attunements/${uid}`));
      }
    });
  });
}

// Color picker sync
const npColor    = document.getElementById("np-color");
const npColorHex = document.getElementById("np-color-hex");
npColor.addEventListener("input", () => { npColorHex.value = npColor.value; });
npColorHex.addEventListener("input", () => {
  if (/^#[0-9a-f]{6}$/i.test(npColorHex.value)) npColor.value = npColorHex.value;
});

document.getElementById("np-save").addEventListener("click", async () => {
  const username = document.getElementById("np-user").value.trim();
  const password = document.getElementById("np-pass").value;
  const role     = document.getElementById("np-role").value;
  const color    = npColor.value;
  const errEl    = document.getElementById("np-error");

  if (!username || !password) {
    errEl.textContent = "Username and password are required.";
    errEl.classList.add("show"); return;
  }
  // Check duplicate
  const duplicate = Object.values(allUsers).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (duplicate) { errEl.textContent = "Username already exists."; errEl.classList.add("show"); return; }
  errEl.classList.remove("show");

  const userRef  = push(ref(db, "users"));
  const hash     = await hashPassword(password);
  await set(userRef, { id: userRef.key, username, passwordHash: hash, role, color });

  document.getElementById("np-user").value = "";
  document.getElementById("np-pass").value = "";
  renderPlayerList();
});

// ── Modal helpers ─────────────────────────────────────────────────────────────
// ── Quick-Edit Item (DM only) — exact port of items.js modal logic ───────────
const QE_RARITY_KEYWORDS = new Set(["common", "uncommon", "rare", "very rare", "legendary"]);

let _qeSourceId      = null;
let _qeInvItemId     = null;
let _qeOwnerId       = null;
let _qeRarity        = "common";
let _qeSelectedTags  = new Set();
let _qeAbilities     = [];

const qeModal        = document.getElementById("qe-modal");
const qeNameEl       = document.getElementById("qe-name");
const qeDescEl       = document.getElementById("qe-desc");
const qePriceEl      = document.getElementById("qe-price");
const qeErrEl        = document.getElementById("qe-error");
const qeRarityEl     = document.getElementById("qe-rarity-selector");
const qeAbilList     = document.getElementById("qe-abilities-list");
const qeTagAddBtn    = document.getElementById("qe-tag-add-btn");
const qeTagNewInput  = document.getElementById("qe-tag-new-input");

qeRarityEl.querySelectorAll(".rarity-sel-btn").forEach(btn => {
  btn.addEventListener("click", () => { _qeRarity = btn.dataset.rarity; _qeSyncRarity(); });
});
function _qeSyncRarity() {
  qeRarityEl.querySelectorAll(".rarity-sel-btn").forEach(b => b.classList.toggle("active", b.dataset.rarity === _qeRarity));
}

function _qeGetAllTags() {
  const s = new Set();
  allItemsDb.forEach(item => {
    getDisplayTags(item.tags).forEach(t => s.add(t));
    parseTags(item.tags)
      .filter(t => !QE_RARITY_KEYWORDS.has(t) && getDisplayTags(t).length === 0)
      .forEach(t => s.add(t));
  });
  return [...s].sort();
}

function _qeRenderTagPicker() {
  const dbTags  = _qeGetAllTags().filter(t => !QE_RARITY_KEYWORDS.has(t));
  const pending = [..._qeSelectedTags].filter(t => !dbTags.includes(t) && !QE_RARITY_KEYWORDS.has(t));
  const allTags = [...dbTags, ...pending];
  const chips = document.getElementById("qe-tag-chips");
  chips.innerHTML = allTags.length
    ? allTags.map(t => `<button type="button" class="im-tag-chip${_qeSelectedTags.has(t) ? " active" : ""}" data-tag="${t.replace(/"/g,'&quot;')}">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</button>`).join("")
    : '<span class="im-tag-empty">No tags yet</span>';
  chips.querySelectorAll(".im-tag-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.tag;
      if (_qeSelectedTags.has(t)) _qeSelectedTags.delete(t); else _qeSelectedTags.add(t);
      chip.classList.toggle("active", _qeSelectedTags.has(t));
    });
  });
}

qeTagAddBtn.addEventListener("click", () => {
  const show = qeTagNewInput.style.display === "none";
  qeTagNewInput.style.display = show ? "inline-block" : "none";
  if (show) qeTagNewInput.focus();
});
qeTagNewInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    const t = qeTagNewInput.value.trim().toLowerCase();
    if (t && !QE_RARITY_KEYWORDS.has(t)) _qeSelectedTags.add(t);
    qeTagNewInput.value = "";
    qeTagNewInput.style.display = "none";
    _qeRenderTagPicker();
  }
  if (e.key === "Escape") { qeTagNewInput.style.display = "none"; }
});

function _qeRenderAbilities() {
  qeAbilList.innerHTML = _qeAbilities.map((ab, i) => `
    <div class="im-ability-entry" data-idx="${i}">
      <input class="im-ability-name-input" type="text" placeholder="Ability name…" value="${ab.name.replace(/"/g,'&quot;')}" data-field="name" data-idx="${i}" />
      <textarea class="im-ability-desc-input" placeholder="Description…" rows="2" data-field="description" data-idx="${i}">${ab.description || ""}</textarea>
      <button type="button" class="im-ability-del-btn" data-idx="${i}"><iconify-icon icon="lucide:x"></iconify-icon></button>
    </div>`).join("");
  qeAbilList.querySelectorAll("[data-field]").forEach(el => {
    el.addEventListener("input", () => { _qeAbilities[el.dataset.idx][el.dataset.field] = el.value; });
  });
  qeAbilList.querySelectorAll(".im-ability-del-btn").forEach(btn => {
    btn.addEventListener("click", () => { _qeAbilities.splice(Number(btn.dataset.idx), 1); _qeRenderAbilities(); });
  });
}

document.getElementById("qe-ability-add-btn").addEventListener("click", () => {
  _qeAbilities.push({ name: "", description: "" });
  _qeRenderAbilities();
  qeAbilList.querySelectorAll(".im-ability-name-input").at(-1)?.focus();
});

function openQuickEdit(item, ownerId) {
  const master = item.sourceItemId ? allItemsDb.find(i => i.id === item.sourceItemId) : null;
  const src = master || item;

  _qeSourceId  = master ? master.id : null;
  _qeInvItemId = item.id;
  _qeOwnerId   = ownerId;
  _qeRarity    = src.rarity || "common";
  _qeSelectedTags = new Set(parseTags(src.tags).filter(t => !QE_RARITY_KEYWORDS.has(t)));
  _qeAbilities = Array.isArray(src.abilities) ? src.abilities.map(a => ({ ...a }))
    : src.abilities ? Object.values(src.abilities).map(a => ({ ...a })) : [];

  qeNameEl.value  = src.name        || "";
  qeDescEl.value  = src.description || "";
  qePriceEl.value = src.price       ?? "";
  document.getElementById("qe-shop-available").checked     = src.shopAvailable !== false;
  document.getElementById("qe-requires-attunement").checked = src.requiresAttunement === true;
  qeErrEl.textContent = "";
  qeTagNewInput.style.display = "none";
  _qeSyncRarity();
  _qeRenderTagPicker();
  _qeRenderAbilities();
  qeModal.classList.add("open");
  qeNameEl.focus();
}

function _qeClose() { qeModal.classList.remove("open"); }
document.getElementById("qe-cancel").addEventListener("click", _qeClose);
document.getElementById("qe-close-btn").addEventListener("click", _qeClose);
qeModal.addEventListener("click", e => { if (e.target === qeModal) _qeClose(); });

document.getElementById("qe-save").addEventListener("click", async () => {
  const name  = qeNameEl.value.trim();
  const price = parseFloat(qePriceEl.value);
  if (!name)                    { qeErrEl.textContent = "Name is required."; return; }
  if (isNaN(price) || price <= 0) { qeErrEl.textContent = "Enter a valid price greater than 0."; return; }
  qeErrEl.textContent = "";

  const description        = qeDescEl.value.trim() || null;
  const shopAvailable      = document.getElementById("qe-shop-available").checked;
  const requiresAttunement = document.getElementById("qe-requires-attunement").checked || false;
  const cleanTags          = Array.from(_qeSelectedTags).filter(t => !QE_RARITY_KEYWORDS.has(t)).join(", ") || null;
  const abilities          = _qeAbilities.filter(a => a.name.trim()).length
    ? _qeAbilities.filter(a => a.name.trim()) : null;

  if (_qeSourceId) {
    const master = allItemsDb.find(i => i.id === _qeSourceId);
    await set(ref(db, `items/${_qeSourceId}`), {
      ...(master || {}),
      name, description, price, rarity: _qeRarity, tags: cleanTags,
      shopAvailable, requiresAttunement, abilities,
    });
    for (const [uid, userInv] of Object.entries(allInventory)) {
      for (const [key, invItem] of Object.entries(userInv || {})) {
        if (invItem.sourceItemId === _qeSourceId || (!invItem.sourceItemId && master && invItem.name === master.name)) {
          await set(ref(db, `inventory/${uid}/${key}`), {
            ...invItem,
            name, description, rarity: _qeRarity, tags: cleanTags,
            requiresAttunement, abilities,
            value: price ? formatGold(price) : null,
            sourceItemId: _qeSourceId,
          });
        }
      }
    }
  } else {
    const invItem = (allInventory[_qeOwnerId] || {})[_qeInvItemId];
    if (invItem) {
      await set(ref(db, `inventory/${_qeOwnerId}/${_qeInvItemId}`), {
        ...invItem,
        name, description, rarity: _qeRarity, tags: cleanTags,
        requiresAttunement, abilities,
        value: price ? formatGold(price) : null,
      });
    }
  }

  _qeClose();
});

function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".inv-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".inv-overlay.open").forEach(o => o.classList.remove("open"));
    invReader.classList.remove("open");
    closeInvSpellModal();
  }
});

document.getElementById("sm-close-btn").addEventListener("click", closeInvSpellModal);
document.getElementById("spell-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("spell-modal")) closeInvSpellModal();
});

// ── Admin: show add-item target row only for admin ────────────────────────────
if (document.getElementById("ai-target-row")) {
  document.getElementById("ai-target-row").style.display = isAdmin ? "block" : "none";
}

function fitText(el) {
  let size = parseFloat(getComputedStyle(el).fontSize) || 16;
  while (el.scrollWidth > el.clientWidth && size > 9) {
    size -= 0.5;
    el.style.fontSize = size + "px";
  }
}

function inferTypeFromTags(tags) {
  if (!tags) return "misc";
  const list = tags.toLowerCase().split(",").map(t => t.trim());
  if (list.includes("weapon"))  return "weapon";
  if (list.includes("armor"))   return "armor";
  if (list.includes("potion"))  return "potion";
  // "book" and "scroll" tags are shop-only classification tags and must NOT
  // promote an item into the lore Books & Scrolls tab. Only items whose
  // Firebase type field is explicitly "book" or "scroll" (real lore items) belong there.
  return "misc";
}

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Saved Spells tab ──────────────────────────────────────────────────────────
const _SPELL_CONDITIONS = {
  blinded:       { name: "Blinded",       desc: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage." },
  charmed:       { name: "Charmed",       desc: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature." },
  deafened:      { name: "Deafened",      desc: "A deafened creature can't hear and automatically fails any ability check that requires hearing." },
  exhaustion:    { name: "Exhaustion",    desc: "Exhaustion is measured in six levels. 1: Disadvantage on ability checks. 2: Speed halved. 3: Disadvantage on attack rolls and saving throws. 4: Hit point maximum halved. 5: Speed reduced to 0. 6: Death. A long rest reduces exhaustion level by 1." },
  frightened:    { name: "Frightened",    desc: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear." },
  grappled:      { name: "Grappled",      desc: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated, or if an effect removes the grappled creature from reach of the grappler." },
  incapacitated: { name: "Incapacitated", desc: "An incapacitated creature can't take actions or reactions." },
  invisible:     { name: "Invisible",     desc: "An invisible creature is impossible to see without the aid of magic or a special sense. Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage." },
  paralyzed:     { name: "Paralyzed",     desc: "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage. Any attack that hits is a critical hit if the attacker is within 5 feet." },
  petrified:     { name: "Petrified",     desc: "A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can't move or speak, and is unaware of its surroundings. It automatically fails Strength and Dexterity saving throws, has resistance to all damage, and is immune to poison and disease." },
  poisoned:      { name: "Poisoned",      desc: "A poisoned creature has disadvantage on attack rolls and ability checks." },
  prone:         { name: "Prone",         desc: "A prone creature's only movement option is to crawl, unless it stands up. It has disadvantage on attack rolls. An attack roll against it has advantage if the attacker is within 5 feet, otherwise the roll has disadvantage." },
  restrained:    { name: "Restrained",    desc: "A restrained creature's speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on Dexterity saving throws." },
  stunned:       { name: "Stunned",       desc: "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage." },
  unconscious:   { name: "Unconscious",   desc: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. It drops whatever it's holding and falls prone. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage. Any attack that hits is a critical hit if the attacker is within 5 feet." }
};
const _SPELL_COND_REGEX = new RegExp(`\\b(${Object.keys(_SPELL_CONDITIONS).join('|')})\\b`, 'gi');
const _SPELL_SCHOOL_COLORS = {
  "abjuration": "#5ba4cf", "conjuration": "#61bd4f", "divination": "#00c2e0",
  "enchantment": "#c377e0", "evocation": "#eb5a46", "illusion": "#9f8fef",
  "necromancy": "#8fab8e", "transmutation": "#d4b44a"
};

function _spellSchoolColor(school) {
  return _SPELL_SCHOOL_COLORS[(school || '').toLowerCase()] || '#7a9abb';
}
function _spellLevelLabel(level) {
  if (level === 0) return 'Cantrip';
  const sfx = ['th','st','nd','rd','th','th','th','th','th','th'];
  return `${level}${sfx[level] || 'th'} Level`;
}
function _spellLevelShort(level) {
  if (level === 0) return 'Cantrip';
  const sfx = ['th','st','nd','rd','th','th','th','th','th','th'];
  return `${level}${sfx[level] || 'th'}`;
}
function _renderSpellDesc(text) {
  if (!text) return '<p style="color:#445;font-style:italic">No description.</p>';
  let html = esc(text);
  html = html.replace(_SPELL_COND_REGEX, m => `<span class="condition-tag" data-condition="${m.toLowerCase()}">${m}</span>`);
  html = '<p>' + html.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
  return html;
}

function renderSpellsGrid() {
  const myBook    = allSpellbooks[viewingId] || {};
  const savedIds  = Object.keys(myBook);
  const canUnsave = isAdmin || viewingId === session.id;

  if (savedIds.length === 0) {
    invGrid.innerHTML = `<p class="inv-empty">No saved spells. Tap the star on any spell in the Spells page to save it here.</p>`;
    return;
  }

  const list = savedIds.map(id => allSpells[id]).filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  if (list.length === 0) {
    invGrid.innerHTML = `<p class="inv-empty">Spell data loading…</p>`;
    return;
  }

  invGrid.innerHTML = '';
  list.forEach(spell => {
    const card = buildSavedSpellCard(spell, canUnsave);
    invGrid.appendChild(card);
    const nameEl = card.querySelector('.inv-item-name');
    if (nameEl) fitText(nameEl);
  });
}

function buildSavedSpellCard(spell, canUnsave) {
  const card = document.createElement('div');
  card.className = 'inv-card';
  card.dataset.type = 'spell';

  const sc = _spellSchoolColor(spell.school);
  card.style.setProperty('--rc', sc);

  const isConc = (spell.duration || '').includes('Concentration');
  const durText = isConc ? spell.duration.replace(/^Concentration,\s*/i, '') : spell.duration;

  const compParts = [];
  if (spell.verbal)   compParts.push('V');
  if (spell.somatic)  compParts.push('S');
  if (spell.material) compParts.push('M');
  const compStr = compParts.join(', ') + (spell.materialCost ? ` (${spell.materialCost})` : '');

  card.innerHTML = `
    <div class="inv-card-body">
      <div class="inv-card-top">
        <iconify-icon icon="lucide:sparkles" class="inv-type-icon"></iconify-icon>
        <div class="inv-name-wrap">
          <h3 class="inv-item-name">${esc(spell.name)}</h3>
          <div class="inv-badges">
            <span class="inv-type-badge inv-badge-spell">${esc(spell.school || 'Spell')}</span>
            <span class="inv-level-badge">${_spellLevelShort(spell.level)}</span>
            ${isConc ? `<span class="inv-conc-badge" title="Concentration">C</span>` : ''}
          </div>
        </div>
      </div>
      <div class="inv-card-details">
        ${spell.description ? `<p class="inv-desc">${esc(spell.description)}</p>` : ''}
        <div class="inv-spell-stats">
          ${spell.castTime ? `<div class="inv-spell-stat"><span class="inv-spell-stat-label">Cast</span>${esc(spell.castTime)}</div>` : ''}
          ${spell.range    ? `<div class="inv-spell-stat"><span class="inv-spell-stat-label">Range</span>${esc(spell.range)}</div>` : ''}
          ${spell.duration ? `<div class="inv-spell-stat"><span class="inv-spell-stat-label">Duration</span>${esc(durText)}</div>` : ''}
          ${compParts.length ? `<div class="inv-spell-stat"><span class="inv-spell-stat-label">Components</span>${esc(compStr)}</div>` : ''}
          ${(spell.classes || []).length ? `<div class="inv-spell-stat"><span class="inv-spell-stat-label">Classes</span>${esc(spell.classes.join(', '))}</div>` : ''}
        </div>
        <div class="inv-card-actions">
          ${canUnsave ? `<button class="inv-action-btn btn-unsave" title="Remove from spellbook"><iconify-icon icon="lucide:star"></iconify-icon> Saved</button>` : ''}
          <button class="inv-action-btn btn-spell-detail">Details</button>
        </div>
      </div>
    </div>`;

  if (canUnsave) {
    card.querySelector('.btn-unsave').addEventListener('click', e => {
      e.stopPropagation();
      remove(ref(db, `spellbook/${viewingId}/${spell.id}`));
    });
  }

  card.querySelector('.btn-spell-detail').addEventListener('click', e => {
    e.stopPropagation();
    openInvSpellModal(spell);
  });

  return card;
}

function openInvSpellModal(spell) {
  const modal = document.getElementById('spell-modal');
  document.getElementById('sm-title').textContent = spell.name;

  const sc = _spellSchoolColor(spell.school);
  const isConc = (spell.duration || '').includes('Concentration');

  document.getElementById('sm-meta').innerHTML = `
    <span class="sm-badge sm-level-badge">${_spellLevelLabel(spell.level)}</span>
    <span class="sm-badge sm-school-badge" style="background:color-mix(in srgb,${sc} 18%,transparent);border-color:color-mix(in srgb,${sc} 55%,transparent);color:${sc}">${esc(spell.school)}</span>
    ${isConc ? '<span class="sm-badge sm-conc-badge">Concentration</span>' : ''}
    <div class="sm-classes">${esc((spell.classes || []).join(', '))}</div>
  `;

  document.getElementById('sm-stats').innerHTML = `
    <div class="sm-stat-row">
      <div class="sm-stat-item"><span class="sm-stat-label">Casting Time</span><div class="sm-stat-value">${esc(spell.castTime || '—')}</div></div>
      <div class="sm-stat-item"><span class="sm-stat-label">Range</span><div class="sm-stat-value">${esc(spell.range || '—')}</div></div>
      <div class="sm-stat-item"><span class="sm-stat-label">Duration</span><div class="sm-stat-value">${esc(spell.duration || 'Instantaneous')}</div></div>
    </div>
  `;

  const compParts = [];
  if (spell.verbal)   compParts.push('<span class="comp-badge comp-v" title="Verbal">V</span>');
  if (spell.somatic)  compParts.push('<span class="comp-badge comp-s" title="Somatic">S</span>');
  if (spell.material) compParts.push('<span class="comp-badge comp-m" title="Material">M</span>');
  const matLabel = spell.materialCost ? `<span class="comp-material">(${esc(spell.materialCost)})</span>` : '';

  document.getElementById('sm-components').innerHTML = `
    <div class="sm-comp-row">
      <span class="sm-stat-label">Components</span>
      ${compParts.length ? compParts.join('') : '<span style="color:#445;font-size:12px">None</span>'}
      ${matLabel}
    </div>
  `;

  document.getElementById('sm-description').innerHTML = _renderSpellDesc(spell.description || '');
  modal.classList.add('open');
  modal.querySelector('.modal-body').scrollTop = 0;
}

function closeInvSpellModal() {
  document.getElementById('spell-modal').classList.remove('open');
  const tt = document.getElementById('condition-tooltip');
  if (tt) tt.style.display = 'none';
}

// Condition tooltip (works inside the spell detail modal)
const _condTT = document.getElementById('condition-tooltip');
let _condTarget = null;

if (_condTT) {
  document.addEventListener('mouseover', e => {
    const tag = e.target.closest('.condition-tag');
    if (!tag) return;
    const cond = _SPELL_CONDITIONS[tag.dataset.condition];
    if (!cond) return;
    _condTarget = tag;
    _condTT.innerHTML = `<div class="ctt-name">${cond.name}</div><div class="ctt-desc">${cond.desc}</div>`;
    _condTT.style.display = 'block';
    const r = tag.getBoundingClientRect();
    _posCondTT(r.left + r.width / 2, r.top);
  });
  document.addEventListener('mouseout', e => {
    if (!_condTarget || _condTarget.contains(e.relatedTarget)) return;
    _condTT.style.display = 'none';
    _condTarget = null;
  });
  document.addEventListener('mousemove', e => {
    if (_condTT.style.display === 'none') return;
    _posCondTT(e.clientX, e.clientY);
  });
}

function _posCondTT(cx, cy) {
  const W = 280, sx = window.scrollX || 0, sy = window.scrollY || 0, vw = window.innerWidth;
  let left = cx + sx + 12;
  let top  = cy + sy - (_condTT.offsetHeight || 90) - 10;
  if (left + W > vw + sx - 8) left = vw + sx - W - 8;
  if (left < sx + 8) left = sx + 8;
  if (top < sy + 8) top = cy + sy + 18;
  _condTT.style.left = left + 'px';
  _condTT.style.top  = top  + 'px';
}
