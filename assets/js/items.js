import { db }                          from "./firebase.js";
import { ref, set, remove, onValue, get }  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { parseTags, formatGold } from "./item-utils.js";
import { openGivePanel }              from "./give-to-player.js";

const _session = (() => { try { return JSON.parse(localStorage.getItem('playerSession')); } catch { return null; } })();
const isAdmin = _session?.role === 'admin';
const cid = _session?.campaignId;
if (!cid) { window.location.href = '/campaigns'; throw new Error('No campaign selected'); }

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

const itemsRef = ref(db, `campaigns/${cid}/items`);

let items       = [];
let activeTag   = null;
let searchQuery = "";
let sortField   = null;   // 'name' | 'rarity' | 'price' | null
let sortDir     = 'asc';  // 'asc' | 'desc'
let filterRarity = null;  // rarity string or null for all
let tagFilterExpanded = false;
let currentPage = 1;
const MAX_VISIBLE_TAGS = 8;
const ITEMS_PER_PAGE = 30;
const RARITY_ORDER = { "common": 1, "uncommon": 2, "rare": 3, "very rare": 4, "legendary": 5 };
let selectedRarity = "common"; // current selection in the modal

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const itemsGrid       = document.getElementById("items-grid");
const itemsSearch     = document.getElementById("items-search");
const tagFilter       = document.getElementById("tag-filter");
const addItemBtn      = document.getElementById("add-item-btn");
const itemsContent    = document.querySelector(".items-content");
const itemDetailPanel = document.getElementById("item-detail-panel");
const itemDetailInner = itemDetailPanel?.querySelector(".item-detail-inner");
const idpTitle        = document.getElementById("idp-title");
const idpMeta         = document.getElementById("idp-meta");
const idpStats        = document.getElementById("idp-stats");
const idpDescription  = document.getElementById("idp-description");
const idpAbilities    = document.getElementById("idp-abilities");
let   _activeItemRow  = null;

const itemModal        = document.getElementById("item-modal");
const imTitle          = document.getElementById("im-title");
const imName           = document.getElementById("im-name");
const imDesc           = document.getElementById("im-desc");
const imPrice          = document.getElementById("im-price");
const imWeight         = document.getElementById("im-weight");
const imRaritySelector = document.getElementById("im-rarity-selector");
const imError          = document.getElementById("im-error");
const imSave           = document.getElementById("im-save");
const imCancel         = document.getElementById("im-cancel");

let selectedTags = new Set();

let editingItemId = null;

if (isAdmin) {
  addItemBtn.style.display = "inline-flex";
}

// ── Sort & Rarity-filter controls ────────────────────────────────────────────
document.querySelectorAll(".sort-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    if (sortField === field) {
      if (sortDir === 'asc') { sortDir = 'desc'; }
      else { sortField = null; sortDir = 'asc'; }
    } else {
      sortField = field;
      sortDir   = 'asc';
    }
    currentPage = 1;
    _updateSortUI();
    renderItems();
  });
});

document.querySelectorAll(".rarity-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const r = btn.dataset.rarity;
    filterRarity = (filterRarity === r || r === '') ? null : r;
    currentPage = 1;
    _updateRarityFilterUI();
    renderItems();
  });
});

function _updateSortUI() {
  document.querySelectorAll(".sort-btn").forEach(btn => {
    const field = btn.dataset.sort;
    const icon  = btn.querySelector("iconify-icon");
    btn.classList.toggle("active", sortField === field);
    if (icon) {
      if (sortField === field) {
        icon.setAttribute("icon", sortDir === 'asc' ? "lucide:chevron-up" : "lucide:chevron-down");
      } else {
        icon.setAttribute("icon", "lucide:chevrons-up-down");
      }
    }
  });
}

function _updateRarityFilterUI() {
  document.querySelectorAll(".rarity-filter-btn").forEach(btn => {
    const r = btn.dataset.rarity;
    btn.classList.toggle("active",
      (r === '' && filterRarity === null) || (r !== '' && r === filterRarity)
    );
  });
}

// ── Rarity selector (modal) ───────────────────────────────────────────────────
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
let _pricePatchDone = false;
onValue(itemsRef, snapshot => {
  const data = snapshot.val();
  items = data ? Object.values(data) : [];

  // One-time patch: apply individual lookup prices to dnd5e items
  if (isAdmin && !_pricePatchDone) {
    _pricePatchDone = true;
    const toFix = items.filter(i => i.source === "dnd5e-api");
    if (toFix.length > 0) {
      toFix.forEach(i => {
        const lookup = DND5E_ITEM_PRICES[i.name.toLowerCase()];
        if (lookup !== undefined && i.price !== lookup) {
          set(ref(db, `campaigns/${cid}/items/${i.id}/price`), lookup);
        } else if (!i.price || i.price <= 0) {
          set(ref(db, `campaigns/${cid}/items/${i.id}/price`), MAGIC_RARITY_PRICES[i.rarity] || 100);
        }
      });
    }
  }

  if (isAdmin) {
    const importBtn = document.getElementById("btn-import-dnd5e");
    if (importBtn) {
      const hasDnd5e = items.some(i => i.source === "dnd5e-api");
      importBtn.style.display = hasDnd5e ? "none" : "inline-flex";
    }
  }

  renderTagFilter();
  renderItems();
});

function getTagList() {
  const counts = {};
  items.forEach(item => {
    parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t)).forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

// ── Tag Filter ────────────────────────────────────────────────────────────────
function renderTagFilter() {
  const allTags = getTagList();
  if (activeTag && !allTags.includes(activeTag)) activeTag = null;
  tagFilter.innerHTML = "";
  if (allTags.length === 0) return;

  const visible     = tagFilterExpanded ? allTags : allTags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = allTags.length - MAX_VISIBLE_TAGS;

  const allBtn = document.createElement("button");
  allBtn.className   = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => { activeTag = null; currentPage = 1; renderTagFilter(); renderItems(); });
  tagFilter.appendChild(allBtn);

  visible.forEach(tag => {
    const wrap = document.createElement("span");
    wrap.className = "tag-btn-wrap";

    const btn = document.createElement("button");
    btn.className   = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => { activeTag = tag; currentPage = 1; renderTagFilter(); renderItems(); });
    wrap.appendChild(btn);

    tagFilter.appendChild(wrap);
  });

  if (allTags.length > MAX_VISIBLE_TAGS) {
    const expandBtn = document.createElement("button");
    expandBtn.className = "tag-expand-btn";
    if (tagFilterExpanded) {
      expandBtn.innerHTML = 'Show less <iconify-icon icon="lucide:chevron-left" style="font-size:12px;vertical-align:-2px"></iconify-icon>';
    } else {
      expandBtn.innerHTML = `+${hiddenCount} more <iconify-icon icon="lucide:chevron-right" style="font-size:12px;vertical-align:-2px"></iconify-icon>`;
    }
    expandBtn.addEventListener("click", () => { tagFilterExpanded = !tagFilterExpanded; renderTagFilter(); });
    tagFilter.appendChild(expandBtn);
  }
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

  if (filterRarity) {
    filtered = filtered.filter(i => getItemRarity(i) === filterRarity);
  }

  if (sortField === 'rarity') {
    filtered.sort((a, b) => {
      const diff = (RARITY_ORDER[getItemRarity(a)] || 1) - (RARITY_ORDER[getItemRarity(b)] || 1);
      return sortDir === 'asc' ? diff : -diff;
    });
  } else if (sortField === 'price') {
    filtered.sort((a, b) => sortDir === 'asc' ? (a.price - b.price) : (b.price - a.price));
  } else if (sortField === 'name') {
    filtered.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (filtered.length === 0) {
    itemsGrid.innerHTML = `<p class="items-empty">${items.length === 0 ? "No items added yet." : "No items match your search."}</p>`;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const pageItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  pageItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-row";

    const rarity      = getItemRarity(item);
    const rarityColor = RARITY_COLORS[rarity] || "#9e9e9e";
    const raritySlug  = rarity.replace(/\s+/g, '-');
    const rarityLabel = rarity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const tags        = parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t));
    const primaryType = tags[0] || null;

    card.style.setProperty("--rc", rarityColor);
    card.dataset.rarity = raritySlug;

    card.innerHTML = `
      <div class="item-row-main">
        <div class="item-row-name">${item.name}</div>
        <div class="item-row-tags">${tags.map(t => `<span class="item-tag">${t}</span>`).join("")}</div>
        <p class="item-row-snippet">${item.description || ""}</p>
        <div class="item-row-meta">
          ${item.weight ? `<span class="item-meta-badge"><iconify-icon icon="lucide:weight" style="font-size:11px;vertical-align:-1px"></iconify-icon> ${item.weight} lb</span>` : ""}
          ${item.requiresAttunement
            ? `<span class="item-meta-badge attune-badge"><iconify-icon icon="lucide:sparkles" style="font-size:11px;vertical-align:-1px"></iconify-icon> Attunement</span>`
            : `<span class="item-meta-badge no-attune-badge"><iconify-icon icon="lucide:sparkles-off" style="font-size:11px;vertical-align:-1px"></iconify-icon> No Attunement</span>`}
          <span class="item-meta-badge item-meta-price"><iconify-icon icon="lucide:coins" style="font-size:11px;vertical-align:-1px"></iconify-icon> ${formatGold(item.price)}</span>
        </div>
      </div>
      <div class="item-row-type">
        ${primaryType ? `<span class="item-tag">${primaryType}</span>` : `<span class="item-row-empty">—</span>`}
      </div>
      <div class="item-row-rarity">
        <span class="item-tag rarity-tag-${raritySlug}">${rarityLabel}</span>
      </div>
      <div class="item-row-price">${formatGold(item.price)}</div>
      <div class="item-row-actions item-actions">
        ${isAdmin ? `
          <button class="row-action-btn give-btn item-give-btn" title="Give to player"><iconify-icon icon="lucide:hand-coins"></iconify-icon></button>
          <button class="row-action-btn item-edit-btn" title="Edit item"><iconify-icon icon="lucide:pencil"></iconify-icon></button>
          <button class="row-action-btn danger item-del-btn" title="Delete item"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>
        ` : ""}
      </div>
    `;

    card.addEventListener("click", e => {
      if (e.target.closest(".item-actions")) return;
      openItemPanel(item, card);
    });

    if (isAdmin) {
      card.querySelector(".item-edit-btn").addEventListener("click", e => {
        e.stopPropagation();
        openItemModal(item.id);
      });
      card.querySelector(".item-del-btn").addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
        remove(ref(db, `campaigns/${cid}/items/${item.id}`));
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

  renderPagination(totalPages);
}

function _getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const lo = Math.max(2, current - 2);
  const hi = Math.min(total - 1, current + 2);
  if (lo > 2) pages.push('…');
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function renderPagination(totalPages) {
  const el = document.getElementById('items-pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const range = _getPageRange(currentPage, totalPages);
  el.innerHTML = `
    <button class="page-nav-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
      <iconify-icon icon="lucide:chevron-left"></iconify-icon>
    </button>
    ${range.map(p => p === '…'
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-nav-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      <iconify-icon icon="lucide:chevron-right"></iconify-icon>
    </button>
  `;

  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p >= 1 && p <= totalPages) {
        currentPage = p;
        renderItems();
        const pageContent = document.querySelector('.page-content');
        if (pageContent) pageContent.scrollTop = 0;
      }
    });
  });
}

// ── Item Modal ────────────────────────────────────────────────────────────────
function openItemModal(id) {
  editingItemId = id || null;
  imError.textContent = "";

  if (id) {
    const item = items.find(i => i.id === id);
    imTitle.textContent = "Edit Item";
    imName.value   = item.name        || "";
    imDesc.value   = item.description || "";
    imPrice.value  = item.price       ?? "";
    imWeight.value = item.weight      ?? "";
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
    imWeight.value = "";
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
      <button type="button" class="im-ability-del-btn" data-idx="${i}"><iconify-icon icon="lucide:x"></iconify-icon></button>
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
  const weight             = parseFloat(imWeight.value) || null;

  await set(ref(db, `campaigns/${cid}/items/${id}`), {
    id, name, description, price, weight,
    rarity: selectedRarity,
    tags:   cleanTags,
    shopAvailable,
    requiresAttunement,
    abilities,
    createdAt: existing?.createdAt || Date.now()
  });

  // Sync changes into any inventory copies that came from this item
  const invSnap = await get(ref(db, `campaigns/${cid}/inventory`));
  if (invSnap.exists()) {
    const allInv = invSnap.val();
    for (const [uid, userInv] of Object.entries(allInv)) {
      for (const [key, invItem] of Object.entries(userInv || {})) {
        const matchById   = invItem.sourceItemId === id;
        const matchByName = !invItem.sourceItemId && existing && invItem.name === existing.name;
        if (matchById || matchByName) {
          await set(ref(db, `campaigns/${cid}/inventory/${uid}/${key}`), {
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

// ── Item Detail Panel ─────────────────────────────────────────────────────────
function openItemPanel(item, rowEl) {
  if (_activeItemRow) _activeItemRow.classList.remove('active');
  _activeItemRow = rowEl;
  rowEl.classList.add('active');

  const rarity = getItemRarity(item);
  const rc = RARITY_COLORS[rarity] || "#9e9e9e";
  const raritySlug  = rarity.replace(/\s+/g, '-');
  const rarityLabel = rarity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const tags = parseTags(item.tags).filter(t => !RARITY_KEYWORDS.has(t));

  if (itemDetailInner) itemDetailInner.style.setProperty('--rc', rc);

  idpTitle.textContent = item.name;

  idpMeta.innerHTML = `
    <span class="idp-rarity-badge rarity-tag-${raritySlug}">${rarityLabel}</span>
    ${item.requiresAttunement ? '<span class="idp-attune-badge">Requires Attunement</span>' : ''}
    ${tags.length ? `<div class="idp-tags">${tags.map(t => `<span class="item-tag">${escItemHtml(t)}</span>`).join('')}</div>` : ''}
  `;

  idpStats.innerHTML = `
    <div class="idp-stat-row">
      <div class="idp-stat-item">
        <span class="idp-stat-label">Price</span>
        <div class="idp-stat-value">${formatGold(item.price)}</div>
      </div>
      ${item.weight ? `<div class="idp-stat-item">
        <span class="idp-stat-label">Weight</span>
        <div class="idp-stat-value">${item.weight} lb</div>
      </div>` : ''}
    </div>
  `;

  idpDescription.innerHTML = item.description
    ? `<p class="idp-section-label">Description</p><div class="idp-desc-text">${
        escItemHtml(item.description).split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
      }</div>`
    : '';

  const abilities = Array.isArray(item.abilities) ? item.abilities
    : item.abilities ? Object.values(item.abilities) : [];
  const validAbilities = abilities.filter(a => a?.name?.trim());

  idpAbilities.innerHTML = validAbilities.length
    ? `<p class="idp-section-label" style="margin-top:14px">Abilities</p>` +
      validAbilities.map(ab => `
        <div class="idp-ability">
          <div class="idp-ability-name">${escItemHtml(ab.name)}</div>
          ${ab.description ? `<div class="idp-ability-desc">${escItemHtml(ab.description).replace(/\n/g, '<br>')}</div>` : ''}
        </div>`).join('')
    : '';

  itemDetailPanel.classList.add('open');
  itemsContent?.classList.add('panel-open');

  const body = itemDetailPanel.querySelector('.idp-body');
  if (body) body.scrollTop = 0;
}

function closeItemPanel() {
  if (_activeItemRow) { _activeItemRow.classList.remove('active'); _activeItemRow = null; }
  itemDetailPanel.classList.remove('open');
  itemsContent?.classList.remove('panel-open');
}

function escItemHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById("idp-close").addEventListener("click", closeItemPanel);
// On mobile the panel is a centered modal — clicking the backdrop closes it
itemDetailPanel.addEventListener("click", e => { if (e.target === itemDetailPanel) closeItemPanel(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && itemDetailPanel.classList.contains("open")) closeItemPanel();
});

// ── Search ────────────────────────────────────────────────────────────────────
itemsSearch.addEventListener("input", e => { searchQuery = e.target.value; currentPage = 1; renderItems(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getSnippet(desc) {
  if (!desc) return null;
  const m = desc.match(/^[^.!?]+[.!?]/);
  if (m) return m[0].trim();
  return desc.length > 90 ? desc.slice(0, 90).trim() + '…' : desc.trim();
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

// ── D&D 5e API Import ─────────────────────────────────────────────────────────
const DND5E_API = "https://www.dnd5eapi.co/api";

// Fallback prices by rarity (when item not in lookup)
const MAGIC_RARITY_PRICES = {
  "common":    100,
  "uncommon":  500,
  "rare":      5000,
  "very rare": 50000,
  "legendary": 200000,
};

// Per-item prices from the Sane Magical Item Prices community guide
const DND5E_ITEM_PRICES = {
  // ── Potions ──
  "potion of healing":              50,
  "potion of greater healing":      150,
  "potion of superior healing":     450,
  "potion of supreme healing":      1350,
  "potion of climbing":             180,
  "potion of fire breath":          150,
  "potion of flying":               500,
  "potion of gaseous form":         300,
  "potion of growth":               270,
  "potion of heroism":              180,
  "potion of invisibility":         180,
  "potion of mind reading":         180,
  "potion of poison":               100,
  "potion of resistance":           300,
  "potion of speed":                400,
  "potion of water breathing":      180,
  "potion of vitality":             960,
  "potion of clairvoyance":         960,
  "potion of diminution":           270,
  "potion of animal friendship":    200,
  "potion of longevity":            9000,
  "potion of invulnerability":      3840,
  "elixir of health":               120,
  "philter of love":                90,
  "oil of slipperiness":            480,
  "oil of etherealness":            1920,
  "oil of sharpness":               3200,
  // ── Scrolls ──
  "spell scroll (cantrip)":         10,
  "spell scroll (1st level)":       60,
  "spell scroll (2nd level)":       120,
  "spell scroll (3rd level)":       200,
  "spell scroll (4th level)":       320,
  "spell scroll (5th level)":       640,
  "spell scroll (6th level)":       1280,
  "spell scroll (7th level)":       2560,
  "spell scroll (8th level)":       5120,
  "spell scroll (9th level)":       10240,
  "scroll of protection":           180,
  // ── Ammunition ──
  "ammunition, +1":                 25,
  "ammunition, +2":                 100,
  "ammunition, +3":                 400,
  "arrow of slaying":               600,
  // ── Weapons ──
  "weapon, +1":                     1000,
  "weapon, +2":                     4000,
  "weapon, +3":                     16000,
  "vicious weapon":                 350,
  "dagger of venom":                2500,
  "dancing sword":                  2000,
  "flame tongue":                   5000,
  "frost brand":                    2200,
  "giant slayer":                   7000,
  "dragon slayer":                  8000,
  "dwarven thrower":                18000,
  "hammer of thunderbolts":         16000,
  "holy avenger":                   165000,
  "javelin of lightning":           1500,
  "mace of disruption":             8000,
  "mace of smiting":                7000,
  "mace of terror":                 8000,
  "nine lives stealer":             8000,
  "oathbow":                        3500,
  "scimitar of speed":              6000,
  "sun blade":                      12000,
  "sword of answering":             36000,
  "sword of life stealing":         1000,
  "sword of sharpness":             1700,
  "sword of wounding":              2000,
  "tentacle rod":                   5000,
  "trident of fish command":        800,
  "vorpal sword":                   24000,
  "weapon of warning":              60000,
  "defender":                       24000,
  "berserker axe":                  900,
  "luck blade":                     60000,
  // ── Armor ──
  "armor, +1":                      1500,
  "armor, +2":                      6000,
  "armor, +3":                      24000,
  "adamantine armor":               500,
  "mithral armor":                  800,
  "dragon scale mail":              4000,
  "elven chain":                    4000,
  "efreeti chain":                  20000,
  "dwarven plate":                  9000,
  "glamoured studded leather":      2000,
  "armor of resistance":            6000,
  "armor of invulnerability":       18000,
  "armor of vulnerability":         500,
  "mariner's armor":                1500,
  "plate armor of etherealness":    48000,
  // ── Shields ──
  "shield, +1":                     1500,
  "shield, +2":                     6000,
  "shield, +3":                     24000,
  "animated shield":                6000,
  "arrow-catching shield":          6000,
  "sentinel shield":                20000,
  "shield of missile attraction":   6000,
  "spellguard shield":              50000,
  // ── Rings ──
  "ring of animal influence":       4000,
  "ring of evasion":                5000,
  "ring of feather falling":        2000,
  "ring of fire elemental command": 17000,
  "ring of free action":            20000,
  "ring of invisibility":           10000,
  "ring of jumping":                2500,
  "ring of mind shielding":         16000,
  "ring of protection":             3500,
  "ring of regeneration":           12000,
  "ring of resistance":             6000,
  "ring of shooting stars":         14000,
  "ring of spell storing":          24000,
  "ring of spell turning":          30000,
  "ring of swimming":               3000,
  "ring of telekinesis":            80000,
  "ring of the ram":                5000,
  "ring of warmth":                 1000,
  "ring of water elemental command":25000,
  "ring of water walking":          1500,
  "ring of x-ray vision":           6000,
  "ring of earth elemental command":31000,
  "ring of air elemental command":  35000,
  "ring of djinni summoning":       90000,
  "scarab of protection":           36000,
  // ── Wondrous items — Amulets & Necklaces ──
  "amulet of health":               8000,
  "amulet of proof against detection and location": 20000,
  "amulet of the planes":           160000,
  "necklace of adaptation":         1500,
  "necklace of fireballs":          300,
  "periapt of health":              5000,
  "periapt of proof against poison":5000,
  "periapt of wound closure":       5000,
  "brooch of shielding":            7500,
  // ── Wondrous items — Belts & Boots ──
  "belt of dwarvenkind":            6000,
  "belt of giant strength (hill)":  8000,
  "belt of giant strength (stone/frost)": 12000,
  "belt of giant strength (fire)":  16000,
  "belt of giant strength (cloud)": 32000,
  "belt of giant strength (storm)": 48000,
  "boots of elvenkind":             2500,
  "boots of levitation":            4000,
  "boots of speed":                 4000,
  "boots of striding and springing":5000,
  "boots of the winterlands":       10000,
  "horseshoes of a zephyr":         1500,
  "horseshoes of speed":            5000,
  "slippers of spider climbing":    5000,
  "winged boots":                   8000,
  // ── Wondrous items — Cloaks ──
  "cloak of arachnida":             5000,
  "cloak of displacement":          60000,
  "cloak of elvenkind":             5000,
  "cloak of invisibility":          80000,
  "cloak of protection":            3500,
  "cloak of the bat":               6000,
  "cloak of the manta ray":         6000,
  "mantle of spell resistance":     30000,
  "cape of the mountebank":         8000,
  // ── Wondrous items — Eyes & Headwear ──
  "eyes of charming":               3000,
  "eyes of minute seeing":          2500,
  "eyes of the eagle":              2500,
  "goggles of night":               1500,
  "headband of intellect":          8000,
  "helm of comprehending languages":500,
  "helm of telepathy":              12000,
  "helm of teleportation":          64000,
  "hat of disguise":                5000,
  "circlet of blasting":            1500,
  // ── Wondrous items — Gloves & Gauntlets ──
  "gauntlets of ogre power":        8000,
  "gloves of missile snaring":      3000,
  "gloves of swimming and climbing":2000,
  "gloves of thievery":             5000,
  "bracers of archery":             1500,
  "bracers of defense":             6000,
  // ── Wondrous items — Bags & Containers ──
  "bag of beans":                   200,
  "bag of devouring":               500,
  "bag of holding":                 4000,
  "bag of tricks":                  300,
  "heward's handy haversack":       2000,
  "portable hole":                  8000,
  "quiver of ehlonna":              1000,
  "folding boat":                   10000,
  // ── Wondrous items — Ropes & Utility ──
  "rope of climbing":               2000,
  "rope of entanglement":           4000,
  "immovable rod":                  5000,
  "lantern of revealing":           5000,
  "chime of opening":               1500,
  "driftglobe":                     750,
  "eversmoking bottle":             1000,
  "gem of brightness":              5000,
  "gem of seeing":                  32000,
  "dimensional shackles":           3000,
  "medallion of thoughts":          3000,
  "sending stones":                 2000,
  "trident of fish command":        800,
  "wind fan":                       1500,
  "saddle of the cavalier":         2000,
  "cap of water breathing":         1000,
  "decanter of endless water":      135000,
  "alchemy jug":                    6000,
  "apparatus of the crab":          10000,
  "bead of force":                  960,
  "cube of force":                  16000,
  "cubic gate":                     40000,
  "crystal ball":                   50000,
  "daern's instant fortress":       75000,
  "deck of illusions":              6120,
  "dust of disappearance":          300,
  "dust of dryness":                120,
  "dust of sneezing and choking":   480,
  "elemental gem":                  960,
  "iron bands of bilarro":          4000,
  "keoghtom's ointment":            120,
  "luckstone":                      4200,
  "stone of good luck":             4200,
  "medallion of thoughts":          3000,
  "mirror of life trapping":        18000,
  "nolzur's marvelous pigments":    200,
  "oil of slipperiness":            480,
  "pearl of power":                 6000,
  "pipes of haunting":              6000,
  "pipes of the sewers":            2000,
  "robe of eyes":                   30000,
  "robe of scintillating colors":   6000,
  "robe of stars":                  60000,
  "robe of the archmagi":           34000,
  "sphere of annihilation":         15000,
  "talisman of the sphere":         20000,
  "talisman of pure good":          71680,
  "talisman of ultimate evil":      61440,
  "universal solvent":              300,
  "sovereign glue":                 400,
  "wings of flying":                5000,
  "broom of flying":                8000,
  "carpet of flying":               12000,
  "ebony fly":                      6000,
  "bronze griffon":                 8000,
  "marble elephant":                6000,
  "onyx dog":                       3000,
  "serpentine owl":                 8000,
  "silver raven":                   5000,
  "golden lions":                   600,
  // ── Wands ──
  "wand of binding":                10000,
  "wand of enemy detection":        4000,
  "wand of fear":                   10000,
  "wand of fireballs":              32000,
  "wand of lightning bolts":        32000,
  "wand of magic detection":        1500,
  "wand of magic missiles":         8000,
  "wand of paralysis":              16000,
  "wand of polymorph":              32000,
  "wand of secrets":                1500,
  "wand of the war mage, +1":       1200,
  "wand of the war mage, +2":       4800,
  "wand of the war mage, +3":       19200,
  "wand of web":                    8000,
  // ── Rods ──
  "rod of absorption":              50000,
  "rod of alertness":               25000,
  "rod of lordly might":            28000,
  "rod of rulership":               16000,
  "rod of security":                90000,
  "rod of the pact keeper, +1":     12000,
  "rod of the pact keeper, +2":     16000,
  "rod of the pact keeper, +3":     28000,
  // ── Staffs ──
  "staff of charming":              12000,
  "staff of fire":                  16000,
  "staff of frost":                 26000,
  "staff of healing":               13000,
  "staff of power":                 95500,
  "staff of striking":              21000,
  "staff of swarming insects":      16000,
  "staff of the adder":             1800,
  "staff of the python":            2000,
  "staff of the woodlands":         44000,
  "staff of thunder and lightning": 10000,
  "staff of withering":             3000,
  // ── Ioun Stones ──
  "ioun stone, absorption":         2400,
  "ioun stone, agility":            3000,
  "ioun stone, awareness":          12000,
  "ioun stone, fortitude":          3000,
  "ioun stone, greater absorption": 31000,
  "ioun stone, insight":            3000,
  "ioun stone, intellect":          3000,
  "ioun stone, leadership":         3000,
  "ioun stone, mastery":            15000,
  "ioun stone, protection":         1200,
  "ioun stone, regeneration":       4000,
  "ioun stone, reserve":            6000,
  "ioun stone, strength":           3000,
  "ioun stone, sustenance":         1000,
  // ── Summoning items ──
  "horn of valhalla (silver)":      5600,
  "horn of valhalla (brass)":       8400,
  "horn of valhalla (bronze)":      11200,
  "horn of valhalla (iron)":        14000,
  "bowl of commanding water elementals":  8000,
  "brazier of commanding fire elementals":8000,
  "censer of controlling air elementals": 8000,
  "stone of controlling earth elementals":8000,
  // ── Instruments of the Bards ──
  "instrument of the bards, fochulan bandlore":  26500,
  "instrument of the bards, mac-fuirmidh cittern":27000,
  "instrument of the bards, doss lute":           28500,
  "instrument of the bards, canaith mandolin":    30000,
  "instrument of the bards, cli lyre":            35000,
  "instrument of the bards, anstruth harp":       109000,
  "instrument of the bards, ollamh harp":         125000,
};

function _mapMagicItem(raw) {
  const rarity = (raw.rarity?.name || "common").toLowerCase();
  const cat    = raw.equipment_category?.name || "magic";
  return {
    id:                 "dnd5e_" + raw.index,
    name:               raw.name,
    description:        Array.isArray(raw.desc) ? raw.desc.join("\n\n") : null,
    price:              DND5E_ITEM_PRICES[raw.name.toLowerCase()] ?? MAGIC_RARITY_PRICES[rarity] ?? 100,
    weight:             raw.weight || null,
    tags:               cat.toLowerCase().replace(/\s+/g, "-"),
    rarity,
    shopAvailable:      false,
    requiresAttunement: !!(raw.requires_attunement),
    abilities:          null,
    source:             "dnd5e-api",
    createdAt:          Date.now(),
  };
}

function _mapEquipment(raw) {
  const cost = raw.cost;
  let price = 0;
  if (cost?.quantity && cost?.unit) {
    if      (cost.unit === "gp") price = cost.quantity;
    else if (cost.unit === "sp") price = Math.round(cost.quantity / 10 * 100) / 100;
    else if (cost.unit === "cp") price = Math.round(cost.quantity / 100 * 100) / 100;
  }
  const cat = raw.equipment_category?.name || "adventuring-gear";
  return {
    id:                 "dnd5e_" + raw.index,
    name:               raw.name,
    description:        Array.isArray(raw.desc) ? raw.desc.join("\n\n") : null,
    price,
    weight:             raw.weight || null,
    tags:               cat.toLowerCase().replace(/\s+/g, "-"),
    rarity:             "common",
    shopAvailable:      price > 0,
    requiresAttunement: false,
    abilities:          null,
    source:             "dnd5e-api",
    createdAt:          Date.now(),
  };
}

async function importDnd5eItems() {
  if (!isAdmin) return;
  if (!confirm(
    "This replaces all base equipment with the D&D 5e API item library (~600 items).\n" +
    "Custom items you created will be preserved.\n\n" +
    "This takes 1–2 minutes. Continue?"
  )) return;

  const overlay = document.getElementById("dnd5e-import-overlay");
  const bar     = document.getElementById("dnd5e-progress-bar");
  const text    = document.getElementById("dnd5e-progress-text");
  const status  = document.getElementById("dnd5e-progress-status");

  function setProgress(done, total, msg) {
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    bar.style.width = pct + "%";
    text.textContent = `${done} / ${total}`;
    if (msg) status.textContent = msg;
  }

  overlay.style.display = "flex";
  setProgress(0, 1, "Fetching item lists…");

  try {
    const [magicRes, equipRes] = await Promise.all([
      fetch(`${DND5E_API}/magic-items`).then(r => r.json()),
      fetch(`${DND5E_API}/equipment`).then(r => r.json()),
    ]);
    const magicList = magicRes.results || [];
    const equipList = equipRes.results || [];
    const total     = magicList.length + equipList.length;
    let done = 0;

    // Delete old equip-seed items (IDs prefixed "dnd_")
    const oldItems = items.filter(i => i.id.startsWith("dnd_"));
    setProgress(0, total, `Removing ${oldItems.length} old base items…`);
    await Promise.all(oldItems.map(i => remove(ref(db, `campaigns/${cid}/items/${i.id}`))));

    const BATCH = 15;
    // Import magic items
    for (let i = 0; i < magicList.length; i += BATCH) {
      const chunk = magicList.slice(i, i + BATCH);
      const raws  = await Promise.all(chunk.map(m => fetch(`https://www.dnd5eapi.co${m.url}`).then(r => r.json())));
      await Promise.all(raws.map(raw => { const item = _mapMagicItem(raw); return set(ref(db, `campaigns/${cid}/items/${item.id}`), item); }));
      done += chunk.length;
      setProgress(done, total, `Importing magic items… (${done}/${magicList.length})`);
    }

    // Import equipment
    for (let i = 0; i < equipList.length; i += BATCH) {
      const chunk = equipList.slice(i, i + BATCH);
      const raws  = await Promise.all(chunk.map(m => fetch(`https://www.dnd5eapi.co${m.url}`).then(r => r.json())));
      await Promise.all(raws.map(raw => { const item = _mapEquipment(raw); return set(ref(db, `campaigns/${cid}/items/${item.id}`), item); }));
      done += chunk.length;
      setProgress(done, total, `Importing equipment… (${done - magicList.length}/${equipList.length})`);
    }

    setProgress(total, total, `Done! Imported ${total} items.`);
    document.getElementById("btn-import-dnd5e").style.display = "none";
    setTimeout(() => { overlay.style.display = "none"; }, 2500);

  } catch (err) {
    status.textContent = "Error: " + err.message;
    bar.style.background = "#c62828";
    setTimeout(() => { overlay.style.display = "none"; }, 4000);
  }
}

if (isAdmin) {
  const importBtn = document.getElementById("btn-import-dnd5e");
  if (importBtn) {
    importBtn.addEventListener("click", importDnd5eItems);
  }
}

