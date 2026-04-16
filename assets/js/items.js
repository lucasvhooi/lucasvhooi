import { db }                          from "./firebase.js";
import { ref, set, remove, onValue }  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { parseTags, formatGold, getDisplayTags } from "./item-utils.js";
import { openGivePanel }              from "./give-to-player.js";

const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();

const RARITY_KEYWORDS = new Set(["common", "uncommon", "rare", "very rare", "legendary"]);

const RARITY_COLORS = {
  "common":    "#9e9e9e",
  "uncommon":  "#4caf50",
  "rare":      "#2196f3",
  "very rare": "#9c27b0",
  "legendary": "#ff9800"
};

// Returns item's rarity — uses stored field first, falls back to tags for old data
function getItemRarity(item) {
  if (item.rarity) return item.rarity;
  const tags = parseTags(item.tags);
  for (const r of ["legendary", "very rare", "rare", "uncommon", "common"]) {
    if (tags.includes(r)) return r;
  }
  return "common";
}

const itemsRef = ref(db, "items");

let items       = [];
let activeTag   = null;
let searchQuery = "";
let selectedRarity = "common"; // current selection in the modal

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const itemsGrid   = document.getElementById("items-grid");
const itemsSearch = document.getElementById("items-search");
const tagFilter   = document.getElementById("tag-filter");
const addItemBtn  = document.getElementById("add-item-btn");

const itemModal        = document.getElementById("item-modal");
const imTitle          = document.getElementById("im-title");
const imName           = document.getElementById("im-name");
const imDesc           = document.getElementById("im-desc");
const imPrice          = document.getElementById("im-price");
const imTags           = document.getElementById("im-tags");
const imRaritySelector = document.getElementById("im-rarity-selector");
const imError          = document.getElementById("im-error");
const imSave           = document.getElementById("im-save");
const imCancel         = document.getElementById("im-cancel");

let editingItemId = null;

if (isAdmin) {
  addItemBtn.style.display = "inline-block";
}

// ── Rarity selector ───────────────────────────────────────────────────────────
imRaritySelector.querySelectorAll(".rarity-sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedRarity = btn.dataset.rarity;
    syncRarityButtons();
  });
});

function syncRarityButtons() {
  imRaritySelector.querySelectorAll(".rarity-sel-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.rarity === selectedRarity);
  });
}

// ── Firebase ──────────────────────────────────────────────────────────────────
onValue(itemsRef, snapshot => {
  const data = snapshot.val();
  items = data ? Object.values(data) : [];
  renderTagFilter();
  renderItems();
});

function getAllTags() {
  const set = new Set();
  items.forEach(item => getDisplayTags(item.tags).forEach(t => set.add(t)));
  return [...set].sort();
}

// ── Tag Filter ────────────────────────────────────────────────────────────────
function renderTagFilter() {
  const tags = getAllTags();
  tagFilter.innerHTML = "";
  if (tags.length === 0) return;

  const allBtn = document.createElement("button");
  allBtn.className   = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => { activeTag = null; renderTagFilter(); renderItems(); });
  tagFilter.appendChild(allBtn);

  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className   = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => { activeTag = tag; renderTagFilter(); renderItems(); });
    tagFilter.appendChild(btn);
  });
}

// ── Render Items ──────────────────────────────────────────────────────────────
function renderItems() {
  itemsGrid.innerHTML = "";

  let filtered = [...items];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description || "").toLowerCase().includes(q) ||
      parseTags(i.tags).some(t => t.includes(q))
    );
  }

  if (activeTag) {
    filtered = filtered.filter(i => getDisplayTags(i.tags).includes(activeTag));
  }

  filtered.sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    itemsGrid.innerHTML = `<p class="items-empty">${items.length === 0 ? "No items added yet." : "No items match your search."}</p>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";

    const rarity      = getItemRarity(item);
    const rarityColor = RARITY_COLORS[rarity] || "#9e9e9e";
    const tags = getDisplayTags(item.tags);

    card.innerHTML = `
      <div class="item-header">
        <div class="item-rarity-dot" style="background:${rarityColor}" title="${rarity}"></div>
        <div class="item-name">${item.name}</div>
        <div class="item-price-badge">${formatGold(item.price)}</div>
      </div>
      ${tags.length ? `<div class="item-tags">${tags.map(t => `<span class="item-tag">${t}</span>`).join("")}</div>` : ""}
      ${item.description ? `<p class="item-desc">${item.description}</p>` : ""}
      ${isAdmin ? `
        <div class="item-actions">
          <button class="dm-btn dm-btn-sm item-edit-btn">Edit</button>
          <button class="marker-delete-btn dm-btn dm-btn-sm item-del-btn">Delete</button>
          <button class="give-btn item-give-btn">Give to Player</button>
        </div>
      ` : ""}
    `;

    card.addEventListener("click", e => {
      if (e.target.closest(".item-actions")) return;
      card.classList.toggle("expanded");
    });

    if (isAdmin) {
      card.querySelector(".item-edit-btn").addEventListener("click", e => {
        e.stopPropagation();
        openItemModal(item.id);
      });
      card.querySelector(".item-del-btn").addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
        remove(ref(db, `items/${item.id}`));
      });
      card.querySelector(".item-give-btn").addEventListener("click", e => {
        e.stopPropagation();
        openGivePanel(e.currentTarget, {
          name:        item.name,
          type:        "misc",
          description: item.description || null,
          quantity:    1,
          value:       item.price ? formatGold(item.price) : null,
          content:     null,
        });
      });
    }

    itemsGrid.appendChild(card);
  });
}

// ── Item Modal ────────────────────────────────────────────────────────────────
function openItemModal(id) {
  editingItemId = id || null;
  imError.textContent = "";

  if (id) {
    const item = items.find(i => i.id === id);
    imTitle.textContent = "Edit Item";
    imName.value  = item.name        || "";
    imDesc.value  = item.description || "";
    imPrice.value = item.price       ?? "";
    // Show tags without any rarity keywords (they're now stored separately)
    imTags.value  = parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t)).join(", ");
    selectedRarity = getItemRarity(item);
  } else {
    imTitle.textContent = "Add Item";
    imName.value = imDesc.value = imTags.value = "";
    imPrice.value = "";
    selectedRarity = "common";
  }

  syncRarityButtons();
  itemModal.classList.add("open");
  imName.focus();
}

function closeItemModal() {
  itemModal.classList.remove("open");
  editingItemId = null;
}

imSave.addEventListener("click", () => {
  const name  = imName.value.trim();
  const price = parseFloat(imPrice.value);
  if (!name)              { imError.textContent = "Name is required."; return; }
  if (isNaN(price) || price <= 0) { imError.textContent = "Enter a valid price greater than 0 (e.g. 0.01 for 1 cp)."; return; }

  const existing = editingItemId ? items.find(i => i.id === editingItemId) : null;
  const id = editingItemId || generateId();

  // Strip any leftover rarity keywords from the tags field
  const cleanTags = parseTags(imTags.value).filter(t => !RARITY_KEYWORDS.has(t)).join(", ") || null;

  set(ref(db, `items/${id}`), {
    id,
    name,
    description: imDesc.value.trim() || null,
    price,
    rarity:    selectedRarity,
    tags:      cleanTags,
    createdAt: existing?.createdAt || Date.now()
  });

  closeItemModal();
});

imCancel.addEventListener("click", closeItemModal);
itemModal.addEventListener("click", e => { if (e.target === itemModal) closeItemModal(); });
addItemBtn.addEventListener("click", () => openItemModal(null));
imName.addEventListener("keydown", e => { if (e.key === "Enter") imSave.click(); });

// ── Search ────────────────────────────────────────────────────────────────────
itemsSearch.addEventListener("input", e => { searchQuery = e.target.value; renderItems(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
