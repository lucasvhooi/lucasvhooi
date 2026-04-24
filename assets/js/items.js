import { db }                          from "./firebase.js";
import { ref, set, remove, onValue, get }  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { parseTags, formatGold } from "./item-utils.js";
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
const imRaritySelector = document.getElementById("im-rarity-selector");
const imError          = document.getElementById("im-error");
const imSave           = document.getElementById("im-save");
const imCancel         = document.getElementById("im-cancel");

let selectedTags = new Set();

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

// ── Tag picker ────────────────────────────────────────────────────────────────
function renderTagPicker() {
  const dbTags  = getTagList();
  const pending = [...selectedTags].filter(t => !dbTags.includes(t));
  const allTags = [...dbTags, ...pending];
  const chips = document.getElementById("im-tag-chips");
  if (!chips) return;
  chips.innerHTML = allTags.length
    ? allTags.map(t => `<button type="button" class="im-tag-chip${selectedTags.has(t) ? " active" : ""}" data-tag="${t.replace(/"/g,'&quot;')}">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</button>`).join("")
    : '<span class="im-tag-empty">No tags yet</span>';
  chips.querySelectorAll(".im-tag-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.tag;
      if (selectedTags.has(t)) selectedTags.delete(t); else selectedTags.add(t);
      chip.classList.toggle("active", selectedTags.has(t));
    });
  });
}

const imTagAddBtn   = document.getElementById("im-tag-add-btn");
const imTagNewInput = document.getElementById("im-tag-new-input");
if (imTagAddBtn) {
  imTagAddBtn.addEventListener("click", () => {
    const show = imTagNewInput.style.display === "none";
    imTagNewInput.style.display = show ? "inline-block" : "none";
    if (show) imTagNewInput.focus();
  });
}
if (imTagNewInput) {
  imTagNewInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const t = imTagNewInput.value.trim().toLowerCase();
      if (t && !RARITY_KEYWORDS.has(t)) selectedTags.add(t);
      imTagNewInput.value = "";
      imTagNewInput.style.display = "none";
      renderTagPicker();
    }
    if (e.key === "Escape") { imTagNewInput.style.display = "none"; }
  });
}

// ── Firebase ──────────────────────────────────────────────────────────────────
onValue(itemsRef, snapshot => {
  const data = snapshot.val();
  items = data ? Object.values(data) : [];
  renderTagFilter();
  renderItems();
});

function getTagList() {
  const s = new Set();
  items.forEach(item => {
    parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t)).forEach(t => s.add(t));
  });
  return [...s].sort();
}

// ── Tag Filter ────────────────────────────────────────────────────────────────
function renderTagFilter() {
  const tags = getTagList();
  tagFilter.innerHTML = "";
  if (tags.length === 0) return;

  const allBtn = document.createElement("button");
  allBtn.className   = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => { activeTag = null; renderTagFilter(); renderItems(); });
  tagFilter.appendChild(allBtn);

  tags.forEach(tag => {
    const wrap = document.createElement("span");
    wrap.className = "tag-btn-wrap";

    const btn = document.createElement("button");
    btn.className   = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => { activeTag = tag; renderTagFilter(); renderItems(); });
    wrap.appendChild(btn);

    if (isAdmin) {
      const del = document.createElement("button");
      del.className   = "tag-delete-btn";
      del.textContent = "×";
      del.title       = `Remove tag "${tag}" from all items`;
      del.addEventListener("click", e => {
        e.stopPropagation();
        deleteTag(tag);
      });
      wrap.appendChild(del);
    }

    tagFilter.appendChild(wrap);
  });
}

// ── Render Items ──────────────────────────────────────────────────────────────
function renderItems() {
  itemsGrid.innerHTML = "";

  let filtered = [...items];

  if (!isAdmin) {
    filtered = filtered.filter(i => i.shopAvailable !== false);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description || "").toLowerCase().includes(q) ||
      parseTags(i.tags).some(t => t.includes(q))
    );
  }

  if (activeTag) {
    filtered = filtered.filter(i => parseTags(i.tags).includes(activeTag));
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
    const tags = parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t));

    card.style.setProperty("--rc", rarityColor);

    card.innerHTML = `
      ${isAdmin ? `<button class="lore-card-give-btn item-give-btn">+</button>` : ""}
      <div class="item-header">
        <div class="item-name">${item.name}</div>
        <div class="item-price-badge">${formatGold(item.price)}</div>
      </div>
      ${tags.length ? `<div class="item-tags">${tags.map(t => `<span class="item-tag">${t}</span>`).join("")}</div>` : ""}
      ${item.description ? `<p class="item-desc">${item.description}</p>` : ""}
      ${isAdmin ? `
        <div class="item-actions">
          <button class="dm-btn dm-btn-sm item-edit-btn">Edit</button>
          <button class="marker-delete-btn dm-btn dm-btn-sm item-del-btn">Delete</button>
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
          id:                  item.id,
          name:                item.name,
          type:                inferTypeFromTags(item.tags),
          description:         item.description || null,
          quantity:            1,
          value:               item.price ? formatGold(item.price) : null,
          content:             null,
          rarity:              getItemRarity(item),
          tags:                item.tags || null,
          abilities:           item.abilities || null,
          requiresAttunement:  item.requiresAttunement || false,
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
    selectedRarity = getItemRarity(item);
    selectedTags = new Set(parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t)));
    document.getElementById("im-shop-available").checked = item.shopAvailable !== false;
    document.getElementById("im-requires-attunement").checked = item.requiresAttunement === true;
    selectedAbilities = Array.isArray(item.abilities) ? item.abilities.map(a => ({ ...a }))
      : item.abilities ? Object.values(item.abilities).map(a => ({ ...a })) : [];
  } else {
    imTitle.textContent = "Add Item";
    imName.value = imDesc.value = "";
    imPrice.value = "";
    selectedRarity = "common";
    selectedTags = new Set();
    document.getElementById("im-shop-available").checked = true;
    document.getElementById("im-requires-attunement").checked = false;
    selectedAbilities = [];
  }

  syncRarityButtons();
  renderTagPicker();
  renderAbilities();
  itemModal.classList.add("open");
  imName.focus();
}

function closeItemModal() {
  itemModal.classList.remove("open");
  editingItemId = null;
}

// ── Abilities ─────────────────────────────────────────────────────────────────
let selectedAbilities = []; // [{name, description}]

function renderAbilities() {
  const list = document.getElementById("im-abilities-list");
  if (!list) return;
  list.innerHTML = selectedAbilities.map((ab, i) => `
    <div class="im-ability-entry" data-idx="${i}">
      <input class="im-ability-name-input" type="text" placeholder="Ability name…" value="${ab.name.replace(/"/g, '&quot;')}" data-field="name" data-idx="${i}" />
      <textarea class="im-ability-desc-input" placeholder="Description…" rows="2" data-field="description" data-idx="${i}">${ab.description || ""}</textarea>
      <button type="button" class="im-ability-del-btn" data-idx="${i}">✕</button>
    </div>`).join("");
  list.querySelectorAll("[data-field]").forEach(el => {
    el.addEventListener("input", () => {
      selectedAbilities[el.dataset.idx][el.dataset.field] = el.value;
    });
  });
  list.querySelectorAll(".im-ability-del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedAbilities.splice(Number(btn.dataset.idx), 1);
      renderAbilities();
    });
  });
}

document.getElementById("im-ability-add-btn")?.addEventListener("click", () => {
  selectedAbilities.push({ name: "", description: "" });
  renderAbilities();
  const inputs = document.querySelectorAll(".im-ability-name-input");
  inputs[inputs.length - 1]?.focus();
});

imSave.addEventListener("click", async () => {
  const name  = imName.value.trim();
  const price = parseFloat(imPrice.value);
  if (!name)              { imError.textContent = "Name is required."; return; }
  if (isNaN(price) || price <= 0) { imError.textContent = "Enter a valid price greater than 0 (e.g. 0.01 for 1 cp)."; return; }

  const existing = editingItemId ? items.find(i => i.id === editingItemId) : null;
  const id = editingItemId || generateId();

  const cleanTags = Array.from(selectedTags).filter(t => !RARITY_KEYWORDS.has(t)).join(", ") || null;

  const cleanAbilities = selectedAbilities.filter(a => a.name.trim());

  const description        = imDesc.value.trim() || null;
  const shopAvailable      = document.getElementById("im-shop-available").checked;
  const requiresAttunement = document.getElementById("im-requires-attunement").checked || false;
  const abilities          = cleanAbilities.length ? cleanAbilities : null;

  await set(ref(db, `items/${id}`), {
    id, name, description, price,
    rarity: selectedRarity,
    tags:   cleanTags,
    shopAvailable,
    requiresAttunement,
    abilities,
    createdAt: existing?.createdAt || Date.now()
  });

  // Sync changes into any inventory copies that came from this item
  const invSnap = await get(ref(db, "inventory"));
  if (invSnap.exists()) {
    const allInv = invSnap.val();
    for (const [uid, userInv] of Object.entries(allInv)) {
      for (const [key, invItem] of Object.entries(userInv || {})) {
        const matchById   = invItem.sourceItemId === id;
        const matchByName = !invItem.sourceItemId && existing && invItem.name === existing.name;
        if (matchById || matchByName) {
          await set(ref(db, `inventory/${uid}/${key}`), {
            ...invItem,
            name,
            description,
            rarity:              selectedRarity,
            tags:                cleanTags,
            abilities,
            requiresAttunement,
            value:               price ? formatGold(price) : null,
            sourceItemId:        id,
          });
        }
      }
    }
  }

  closeItemModal();
});

imCancel.addEventListener("click", closeItemModal);
document.getElementById("im-close-btn").addEventListener("click", closeItemModal);
itemModal.addEventListener("click", e => { if (e.target === itemModal) closeItemModal(); });
addItemBtn.addEventListener("click", () => openItemModal(null));
imName.addEventListener("keydown", e => { if (e.key === "Enter") imSave.click(); });

// ── Delete Tag ────────────────────────────────────────────────────────────────
async function deleteTag(tag) {
  if (!confirm(`Remove tag "${tag}" from all items? This cannot be undone.`)) return;

  const affected = items.filter(item => parseTags(item.tags).includes(tag));

  for (const item of affected) {
    const newTags = parseTags(item.tags)
      .filter(t => t !== tag && !RARITY_KEYWORDS.has(t))
      .join(", ") || null;
    await set(ref(db, `items/${item.id}/tags`), newTags);
  }

  if (activeTag === tag) {
    activeTag = null;
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
itemsSearch.addEventListener("input", e => { searchQuery = e.target.value; renderItems(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function inferTypeFromTags(tags) {
  if (!tags) return "misc";
  const list = tags.toLowerCase().split(",").map(t => t.trim());
  if (list.includes("weapon"))           return "weapon";
  if (list.includes("armor"))            return "armor";
  if (list.includes("potion"))           return "potion";
  if (list.includes("book"))             return "book";
  if (list.includes("scroll"))           return "scroll";
  return "misc";
}
