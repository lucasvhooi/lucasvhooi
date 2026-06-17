'use strict';
import { db }                                     from "./firebase.js";
import { ref, set, remove, onValue, push }        from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getSession }                             from "./auth.js";
import { parseTags, formatGold, getDisplayTags }  from "./item-utils.js";

// ── Auth guard ────────────────────────────────────────────────────────────────
const session = getSession();
if (!session) { window.location.href = "login.html"; }

const isAdmin = session.role === "admin";
const cid     = session.campaignId;
if (!cid) { window.location.href = "campaigns"; throw new Error('No campaign selected'); }

const usersRef     = ref(db, "users");
const inventoryRef = ref(db, `campaigns/${cid}/inventory`);

let allItemsDb = [];
onValue(ref(db, `campaigns/${cid}/items`), snap => { allItemsDb = snap.val() ? Object.values(snap.val()) : []; renderCarryBar(); });

let selectedItemDb = null;

// ── State ─────────────────────────────────────────────────────────────────────
let allUsers       = {};
let allInventory   = {};
let allAttunements = {};
let allSpells      = {};
let allSpellbooks  = {};
let viewingId      = session.id;
let activeFilter   = "all";
let activeRarity   = "all";
let sendItemId     = null;
let sendItemOwner  = null;
let selectedSendTarget = null;
let allMembers     = {};
let allDisplayNames = {};
let searchQuery    = "";
let sortField      = null;
let sortDir        = 'asc';
let _activeInvRow  = null;

// ── Campaign feature settings ───────────────────────────────────────────────────
let campaignSettings = { useAttunement: true, useWeight: false };
let allCarryCaps     = {};
const DEFAULT_CAPACITY = 150;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const playerSelector  = document.getElementById("player-selector");
const playerSelect    = document.getElementById("player-select");
const invList         = document.getElementById("inv-list");
const invSearch       = document.getElementById("inv-search");
const invCount        = document.getElementById("inv-count");
const invViewerName   = document.getElementById("inv-viewer-name");
const addBtn          = document.getElementById("add-btn");
const manageBtn       = document.getElementById("manage-btn");
const invDetailPanel  = document.getElementById("inv-detail-panel");
const invContent      = document.querySelector(".inv-content");
const invReader       = document.getElementById("inv-reader");

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_ICON  = { weapon: "game-icons:crossed-swords", armor: "game-icons:shield", potion: "game-icons:potion", book: "game-icons:open-book", scroll: "game-icons:scroll-unfurled", misc: "lucide:gem" };
const TYPE_LABEL = { weapon: "Weapon", armor: "Armor", potion: "Potion", book: "Book", scroll: "Scroll", misc: "Misc" };
const TYPE_COLORS = { weapon: "#c04040", armor: "#4060b0", potion: "#40a060", book: "#8040c0", scroll: "#b08020", misc: "#6a6060" };
const RARITY_COLORS = { "common": "#9e9e9e", "uncommon": "#4caf50", "rare": "#2196f3", "very rare": "#9c27b0", "legendary": "#ff9800" };
const RARITY_ORDER  = { legendary: 0, "very rare": 1, rare: 2, uncommon: 3, common: 4 };

// ── Firebase listeners ────────────────────────────────────────────────────────
onValue(usersRef, snap => { allUsers = snap.val() || {}; renderPlayerSelector(); renderList(); });
onValue(inventoryRef, snap => { allInventory = snap.val() || {}; renderList(); });
onValue(ref(db, `campaigns/${cid}/attunements`), snap => { allAttunements = snap.val() || {}; renderList(); });
onValue(ref(db, "spells"), snap => { allSpells = snap.val() || {}; if (activeFilter === "spells") renderList(); });
onValue(ref(db, `campaigns/${cid}/spellbook`), snap => { allSpellbooks = snap.val() || {}; if (activeFilter === "spells") renderList(); });
onValue(ref(db, `campaigns/${cid}/members`), snap => { allMembers = snap.val() || {}; renderPlayerSelector(); });
onValue(ref(db, `campaigns/${cid}/displayNames`), snap => { allDisplayNames = snap.val() || {}; renderPlayerSelector(); renderList(); });
onValue(ref(db, `campaigns/${cid}/settings`), snap => {
  const s = snap.val() || {};
  campaignSettings = { useAttunement: s.useAttunement !== false, useWeight: s.useWeight === true };
  applyFeatureToggles();
  renderList();
});
onValue(ref(db, `campaigns/${cid}/carryCapacity`), snap => { allCarryCaps = snap.val() || {}; renderCarryBar(); });

// Show/hide the attunement section based on the campaign setting
function applyFeatureToggles() {
  const attSection = document.getElementById("inv-attune-section");
  if (attSection) attSection.style.display = campaignSettings.useAttunement ? "" : "none";
  renderCarryBar();
}

// Weight of an inventory entry: its own stored weight, else the live weight from
// the master item catalog (so editing weight on the Items page updates the bar)
function itemWeight(it) {
  if (it.weight != null && it.weight !== "") return parseFloat(it.weight) || 0;
  let master = null;
  if (it.sourceItemId) master = allItemsDb.find(m => m.id === it.sourceItemId);
  if (!master && it.name) {
    const n = String(it.name).toLowerCase();
    master = allItemsDb.find(m => String(m.name || "").toLowerCase() === n);
  }
  return master && master.weight != null ? (parseFloat(master.weight) || 0) : 0;
}

// ── Carry capacity bar (encumbrance) ────────────────────────────────────────────
function renderCarryBar() {
  const el = document.getElementById("inv-carry");
  if (!el) return;
  if (!campaignSettings.useWeight) { el.style.display = "none"; return; }
  el.style.display = "block";

  const inv = allInventory[viewingId] ? Object.values(allInventory[viewingId]) : [];
  let total = 0;
  inv.forEach(it => {
    const w = itemWeight(it);
    const q = parseInt(it.quantity, 10) || 1;
    total += w * q;
  });
  total = Math.round(total * 10) / 10;

  const cap = Number(allCarryCaps[viewingId]) > 0 ? Number(allCarryCaps[viewingId]) : DEFAULT_CAPACITY;
  const pct = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;

  const curEl = document.getElementById("inv-carry-current");
  const capEl = document.getElementById("inv-carry-cap");
  const fill  = document.getElementById("inv-carry-fill");
  if (curEl) curEl.textContent = total;
  if (capEl && capEl.tagName !== "INPUT") {
    capEl.textContent = cap;
    capEl.classList.toggle("editable", isAdmin);
    capEl.title = isAdmin ? "Click to set carry capacity" : "";
  }
  if (fill) fill.style.width = pct + "%";
  el.classList.toggle("over", total > cap);
}

// DM can click the capacity number to edit it (per-player)
function startCapEdit(spanEl) {
  const input = document.createElement("input");
  input.type = "number"; input.min = "1"; input.max = "9999";
  input.value = String(Number(allCarryCaps[viewingId]) > 0 ? Number(allCarryCaps[viewingId]) : DEFAULT_CAPACITY);
  input.className = "inv-carry-cap-input";
  input.id = "inv-carry-cap";
  spanEl.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    if (save) {
      const v = Math.max(1, Math.round(Number(input.value) || DEFAULT_CAPACITY));
      try { await set(ref(db, `campaigns/${cid}/carryCapacity/${viewingId}`), v); } catch (_) {}
    }
    const span = document.createElement("span");
    span.id = "inv-carry-cap"; span.className = "inv-carry-cap";
    input.replaceWith(span);
    renderCarryBar();
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") finish(false);
  });
}
document.getElementById("inv-carry")?.addEventListener("click", e => {
  if (!isAdmin) return;
  const el = e.target.closest(".inv-carry-cap");
  if (el && el.tagName !== "INPUT") startCapEdit(el);
});

function getDisplayName(uid) {
  return allDisplayNames[uid] || allUsers[uid]?.username || null;
}

// ── Player selector ───────────────────────────────────────────────────────────
function renderPlayerSelector() {
  if (!isAdmin) return;
  playerSelector.style.display = "inline-flex";

  const hasMembers = Object.keys(allMembers).length > 0;
  const userList = Object.entries(allUsers)
    .filter(([uid]) => !hasMembers || uid in allMembers)
    .map(([uid, u]) => ({ uid, ...u }))
    .sort((a, b) => (getDisplayName(a.uid) || "").localeCompare(getDisplayName(b.uid) || ""));

  playerSelect.innerHTML = userList
    .map(u => `<option value="${esc(u.uid)}" ${u.uid === viewingId ? "selected" : ""}>${esc(getDisplayName(u.uid))}${u.role === "admin" ? " (DM)" : ""}</option>`)
    .join("");

  const aiTarget = document.getElementById("ai-target");
  if (aiTarget) {
    aiTarget.innerHTML = userList.map(u => `<option value="${esc(u.uid)}">${esc(getDisplayName(u.uid))}</option>`).join("");
    aiTarget.value = viewingId;
  }

  if (!playerSelector.querySelector(".btn-rename-player")) {
    const renameBtn = document.createElement("button");
    renameBtn.className = "btn-rename-player";
    renameBtn.title = "Set character name";
    renameBtn.innerHTML = '<iconify-icon icon="lucide:pencil"></iconify-icon>';
    renameBtn.style.cssText = "background:none;border:1px solid rgba(200,164,92,0.2);border-radius:6px;color:#888;padding:5px 9px;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;flex-shrink:0;transition:color 0.2s,border-color 0.2s";
    renameBtn.addEventListener("mouseover", () => { renameBtn.style.color = "var(--accent)"; renameBtn.style.borderColor = "var(--accent)"; });
    renameBtn.addEventListener("mouseout",  () => { renameBtn.style.color = "#888"; renameBtn.style.borderColor = "rgba(200,164,92,0.2)"; });
    renameBtn.addEventListener("click", openRenameModal);
    playerSelector.appendChild(renameBtn);
  }
}

function openRenameModal() {
  const uid     = viewingId;
  const current = allDisplayNames[uid] || "";
  const realName = allUsers[uid]?.username || uid;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
  overlay.innerHTML = `
    <div style="background:linear-gradient(160deg,#1e1108 0%,#150d05 100%);border:1px solid #3a2510;border-radius:14px;padding:28px;width:100%;max-width:360px;box-shadow:0 8px 48px rgba(0,0,0,0.9)">
      <div style="font-family:'IM Fell English',serif;font-size:1.25rem;color:var(--accent);margin-bottom:4px">Character Name</div>
      <div style="font-size:12px;color:#666;margin-bottom:18px">Sets the in-campaign display name for <strong style="color:#aaa">${esc(realName)}</strong></div>
      <input id="rn-input" type="text" value="${esc(current)}" placeholder="${esc(realName)}"
        style="width:100%;background:rgba(255,255,255,0.04);border:1px solid #3a2510;border-radius:8px;padding:11px 14px;color:var(--text);font-size:15px;font-family:var(--font);outline:none;box-sizing:border-box;margin-bottom:14px;transition:border-color 0.2s">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button id="rn-cancel" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid #2e1c0a;border-radius:8px;color:#888;font-size:14px;font-family:var(--font);padding:10px;cursor:pointer">Cancel</button>
        <button id="rn-save" style="flex:1;background:linear-gradient(135deg,#4a2c0a,#6b3e10);border:1px solid var(--accent);border-radius:8px;color:var(--accent);font-size:14px;font-family:var(--font);padding:10px;cursor:pointer">Save</button>
      </div>
      ${current ? `<button id="rn-reset" style="width:100%;background:none;border:1px solid #3a1a1a;border-radius:8px;color:#7a3030;font-size:12px;font-family:var(--font);padding:8px;cursor:pointer">Reset to username</button>` : ""}
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#rn-input");
  input.focus(); input.select();
  input.addEventListener("focus", () => { input.style.borderColor = "var(--accent)"; });
  input.addEventListener("blur",  () => { input.style.borderColor = "#3a2510"; });

  async function doSave() {
    const name = input.value.trim();
    if (name) await set(ref(db, `campaigns/${cid}/displayNames/${uid}`), name);
    else      await remove(ref(db, `campaigns/${cid}/displayNames/${uid}`));
    overlay.remove();
  }

  overlay.querySelector("#rn-save").addEventListener("click", doSave);
  overlay.querySelector("#rn-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#rn-reset")?.addEventListener("click", async () => {
    await remove(ref(db, `campaigns/${cid}/displayNames/${uid}`));
    overlay.remove();
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener("keydown", e => { if (e.key === "Enter") doSave(); if (e.key === "Escape") overlay.remove(); });
}

playerSelect.addEventListener("change", () => {
  viewingId = playerSelect.value;
  closeItemPanel();
  renderList();
});

// ── Admin buttons ─────────────────────────────────────────────────────────────
if (isAdmin) {
  addBtn.style.display = "inline-flex";
  manageBtn.style.display = "inline-flex";
}

// ── Search ────────────────────────────────────────────────────────────────────
if (invSearch) {
  invSearch.addEventListener("input", () => {
    searchQuery = invSearch.value.trim();
    renderList();
  });
}

// ── Sort ──────────────────────────────────────────────────────────────────────
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
    _updateSortUI();
    renderList();
  });
});

function _updateSortUI() {
  document.querySelectorAll(".sort-btn").forEach(btn => {
    const field = btn.dataset.sort;
    const icon  = btn.querySelector("iconify-icon");
    btn.classList.toggle("active", sortField === field);
    if (icon) {
      icon.setAttribute("icon", sortField === field
        ? (sortDir === 'asc' ? "lucide:chevron-up" : "lucide:chevron-down")
        : "lucide:chevrons-up-down");
    }
  });
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
function _setTypeFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".inv-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === filter));
  if (typeFilterSelect) typeFilterSelect.value = filter;
  closeItemPanel();
  renderList();
}

document.querySelectorAll(".inv-tab").forEach(tab => {
  tab.addEventListener("click", () => _setTypeFilter(tab.dataset.filter));
});

// ── Mobile filter dropdowns ─────────────────────────────────────────────────────
const typeFilterSelect   = document.getElementById("inv-type-filter");
const rarityFilterSelect = document.getElementById("inv-rarity-filter");
if (typeFilterSelect) {
  typeFilterSelect.addEventListener("change", () => _setTypeFilter(typeFilterSelect.value));
}
if (rarityFilterSelect) {
  rarityFilterSelect.addEventListener("change", () => {
    activeRarity = rarityFilterSelect.value;
    renderList();
  });
}

// ── Render list ───────────────────────────────────────────────────────────────
function renderList() {
  // Update viewer name + attunement bar
  const owner     = allUsers[viewingId];
  const ownerName = getDisplayName(viewingId) || (viewingId === session.id ? session.username : "Unknown");
  const ownerColor = owner?.color || session.color;

  if (invViewerName) {
    invViewerName.innerHTML = `<span style="color:${ownerColor || 'var(--accent)'}">${esc(ownerName)}</span>'s Inventory`;
  }

  const userAttunes  = allAttunements[viewingId] || {};
  const attunedCount = Object.keys(userAttunes).length;
  const attBar   = document.getElementById("inv-attunement-bar");
  const attSlots = document.getElementById("inv-attunement-slots");
  if (attBar && campaignSettings.useAttunement) {
    attBar.style.display = "inline-flex";
    attSlots.textContent = `${attunedCount} / 3`;
    attSlots.style.color = attunedCount === 3 ? "#e57373" : attunedCount >= 2 ? "#ff9800" : "var(--accent)";
  } else if (attBar) {
    attBar.style.display = "none";
  }

  if (campaignSettings.useAttunement) renderAttunementSlots();
  renderCarryBar();

  invList.innerHTML = "";

  if (activeFilter === "spells") {
    renderSpellsList();
    return;
  }

  const items = (allInventory[viewingId]
    ? Object.values(allInventory[viewingId])
    : []).map(it => ({
      ...it,
      _etype: (() => {
        const raw = it.type || "misc";
        if (raw === "book" || raw === "scroll") {
          return (it.pages != null || it.writer != null || it.content != null) ? raw : "misc";
        }
        if (raw === "misc" && it.tags) return inferTypeFromTags(it.tags);
        return raw;
      })(),
    }));

  let filtered = activeFilter === "all"
    ? items.filter(it => it._etype !== "book" && it._etype !== "scroll")
    : activeFilter === "books-scrolls"
      ? items.filter(it => it._etype === "book" || it._etype === "scroll")
      : activeFilter === "attuned"
        ? items.filter(it => {
            const k = (it.name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
            return k in userAttunes;
          })
        : items.filter(it => it._etype === activeFilter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(it =>
      [it.name, it.description, it.type, it.rarity].join(" ").toLowerCase().includes(q)
    );
  }

  if (activeRarity !== "all") {
    filtered = filtered.filter(it => (it.rarity || "").toLowerCase() === activeRarity);
  }

  // Stack identical items
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

  const attKey = name => (name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  let visible = Object.values(stackMap);

  if (sortField === 'name') {
    visible.sort((a, b) => { const c = a.name.localeCompare(b.name); return sortDir === 'asc' ? c : -c; });
  } else if (sortField === 'rarity') {
    visible.sort((a, b) => { const d = (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5); return sortDir === 'asc' ? d : -d; });
  } else if (sortField === 'type') {
    visible.sort((a, b) => { const c = (a._etype || "misc").localeCompare(b._etype || "misc"); return sortDir === 'asc' ? c : -c; });
  } else {
    visible.sort((a, b) => {
      const aA = attKey(a.name) in userAttunes ? 0 : 1;
      const bA = attKey(b.name) in userAttunes ? 0 : 1;
      if (aA !== bA) return aA - bA;
      return (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5);
    });
  }

  if (invCount) invCount.textContent = `${visible.length} item${visible.length !== 1 ? 's' : ''}`;

  if (visible.length === 0) {
    const baseItems = items.filter(it => it._etype !== "book" && it._etype !== "scroll");
    let msg = "No items in this category.";
    if (activeFilter === "all" && baseItems.length === 0)                msg = "No items yet. Ask your DM for loot!";
    if (activeFilter === "books-scrolls" && filtered.length === 0)      msg = "No books or scrolls yet.";
    if (activeFilter === "attuned")                                      msg = "No attuned items.";
    if (searchQuery)                                                     msg = "No items match your search.";
    invList.innerHTML = `<p class="inv-empty">${msg}</p>`;
    return;
  }

  visible.forEach(item => invList.appendChild(buildItemRow(item)));
}

// ── Item row ──────────────────────────────────────────────────────────────────
function buildItemRow(item) {
  const row = document.createElement("div");
  const effectiveType = item._etype || "misc";
  const rarity        = item.rarity || null;
  const rarityColor   = rarity ? (RARITY_COLORS[rarity] || "#9e9e9e") : null;
  const typeColor     = TYPE_COLORS[effectiveType] || "#6a6060";
  const cc            = rarityColor || typeColor;

  const userAttunes = allAttunements[viewingId] || {};
  const attk        = (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  const isAttuned   = attk in userAttunes;
  const qty         = item._stackQty || item.quantity || 1;
  const isLore      = effectiveType === "book" || effectiveType === "scroll";
  const canAttune   = campaignSettings.useAttunement && (item.requiresAttunement === true || isAttuned) && (isAdmin || viewingId === session.id);

  row.className = (campaignSettings.useAttunement && isAttuned) ? "inv-row inv-row-is-attuned" : "inv-row";
  row.style.setProperty("--cc", cc);

  row.innerHTML = `
    <div class="inv-row-main">
      <div class="inv-row-name-wrap">
        <iconify-icon icon="${TYPE_ICON[effectiveType] || 'lucide:gem'}" class="inv-row-type-icon"></iconify-icon>
        <div>
          <div class="inv-row-name">${esc(item.name || "Unknown")}${qty > 1 ? `<span class="inv-row-qty">×${qty}</span>` : ""}</div>
          ${campaignSettings.useAttunement && isAttuned ? `<span class="inv-row-attuned"><iconify-icon icon="lucide:sparkles" style="font-size:9px;vertical-align:-1px"></iconify-icon> Attuned</span>` : ""}
        </div>
      </div>
    </div>
    <div class="inv-row-type">
      <span class="inv-type-badge inv-badge-${effectiveType}">${TYPE_LABEL[effectiveType] || "Misc"}</span>
    </div>
    <div class="inv-row-rarity">${rarity
      ? `<span style="color:${rarityColor};text-transform:capitalize;font-size:12px">${esc(rarity)}</span>`
      : '<span class="inv-row-empty">—</span>'}</div>
    <div class="inv-row-actions">
      ${isLore ? `<button class="row-action-btn inv-row-read-btn" title="Read"><iconify-icon icon="lucide:book-open"></iconify-icon></button>` : ""}
      ${canAttune ? `<button class="row-action-btn inv-row-attune-btn${isAttuned ? ' attuned' : ''}" title="${isAttuned ? 'Remove Attunement' : 'Attune'}"><iconify-icon icon="lucide:sparkles"></iconify-icon></button>` : ""}
      <button class="row-action-btn inv-row-send-btn" title="Send"><iconify-icon icon="lucide:send"></iconify-icon></button>
      ${(isAdmin || viewingId === session.id) ? `<button class="row-action-btn danger inv-row-del-btn" title="Remove"><iconify-icon icon="lucide:trash-2"></iconify-icon></button>` : ""}
    </div>
  `;

  row.addEventListener("click", e => {
    if (e.target.closest(".inv-row-actions")) return;
    openItemPanel(item, row);
  });

  row.querySelector(".inv-row-read-btn")?.addEventListener("click", e => { e.stopPropagation(); openReadModal(item); });
  row.querySelector(".inv-row-send-btn").addEventListener("click", e => { e.stopPropagation(); openSendModal(item, viewingId); });
  row.querySelector(".inv-row-del-btn")?.addEventListener("click", e => { e.stopPropagation(); openRemoveModal(item, viewingId); });

  row.querySelector(".inv-row-attune-btn")?.addEventListener("click", async e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (isAttuned) {
      await remove(ref(db, `campaigns/${cid}/attunements/${viewingId}/${attk}`));
    } else {
      const count = Object.keys(allAttunements[viewingId] || {}).length;
      if (count >= 3) {
        btn.style.color = "#e57373";
        setTimeout(() => { btn.style.color = ""; }, 1500);
        return;
      }
      await set(ref(db, `campaigns/${cid}/attunements/${viewingId}/${attk}`), { name: item.name, type: item.type, rarity: item.rarity || null, timestamp: Date.now() });
    }
  });

  return row;
}

// ── Item detail panel ─────────────────────────────────────────────────────────
function openItemPanel(item, rowEl) {
  if (_activeInvRow) _activeInvRow.classList.remove("active");
  _activeInvRow = rowEl;
  rowEl.classList.add("active");

  const effectiveType  = item._etype || "misc";
  const rarity         = item.rarity || null;
  const rarityColor    = rarity ? (RARITY_COLORS[rarity] || "#9e9e9e") : null;
  const userAttunes    = allAttunements[viewingId] || {};
  const attk           = (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
  const isAttuned      = attk in userAttunes;
  const needsAtt       = item.requiresAttunement === true;
  const abilities      = Array.isArray(item.abilities) ? item.abilities : (item.abilities ? Object.values(item.abilities) : []);
  const giverName      = item.givenBy && allUsers[item.givenBy] ? getDisplayName(item.givenBy) : (item.givenBy === "admin" ? "DM" : null);
  const canAttune      = campaignSettings.useAttunement && needsAtt && (isAdmin || viewingId === session.id);
  const canRemove      = isAdmin || viewingId === session.id;
  const isLore         = effectiveType === "book" || effectiveType === "scroll";
  const iconColor      = rarityColor || TYPE_COLORS[effectiveType] || "#888";

  document.getElementById("idp-title").textContent = item.name || "";

  document.getElementById("idp-icon").innerHTML = `
    <iconify-icon icon="${TYPE_ICON[effectiveType] || 'lucide:gem'}" class="idp-type-icon" style="color:${iconColor}"></iconify-icon>
  `;

  document.getElementById("idp-meta").innerHTML = [
    `<span class="inv-type-badge inv-badge-${effectiveType}">${TYPE_LABEL[effectiveType] || "Misc"}</span>`,
    rarity ? `<span class="idp-rarity-badge" style="color:${rarityColor};text-transform:capitalize">${esc(rarity)}</span>` : '',
    campaignSettings.useAttunement && isAttuned ? `<span class="inv-attuned-badge"><iconify-icon icon="lucide:sparkles" style="font-size:10px;vertical-align:-1px;margin-right:3px"></iconify-icon>Attuned</span>` : '',
    campaignSettings.useAttunement && needsAtt && !isAttuned ? `<span class="inv-attunement-required-badge"><iconify-icon icon="lucide:link" style="font-size:9px;margin-right:3px"></iconify-icon>Req. Attunement</span>` : '',
    giverName ? `<span class="idp-giver">from ${esc(giverName)}</span>` : '',
  ].join('');

  document.getElementById("idp-description").innerHTML = item.description
    ? `<p class="idp-section-label">Description</p><div class="idp-desc-text">${escBr(item.description)}</div>`
    : '';

  document.getElementById("idp-abilities").innerHTML = abilities.length
    ? `<p class="idp-section-label" style="margin-top:14px">Abilities</p>` +
      abilities.map(a => `<div class="idp-ability"><span class="idp-ability-name">${esc(a.name)}</span>${a.description ? `<span class="idp-ability-desc">${esc(a.description)}</span>` : ''}</div>`).join('')
    : '';

  const actEl = document.getElementById("idp-actions");
  actEl.innerHTML = `<div class="idp-action-row">
    ${isLore ? `<button class="dm-btn dm-btn-sm idp-read-btn"><iconify-icon icon="lucide:book-open" style="font-size:12px;margin-right:4px;vertical-align:-1px"></iconify-icon>Read</button>` : ''}
    ${canAttune && !isAttuned ? `<button class="dm-btn dm-btn-sm idp-attune-btn">Attune</button>` : ''}
    ${canAttune && isAttuned  ? `<button class="dm-btn dm-btn-sm idp-unattuned-btn"><iconify-icon icon="lucide:star" style="font-size:12px;margin-right:4px;vertical-align:-1px"></iconify-icon>Attuned</button>` : ''}
    <button class="dm-btn dm-btn-sm idp-send-btn"><iconify-icon icon="lucide:send" style="font-size:12px;margin-right:4px;vertical-align:-1px"></iconify-icon>Send</button>
    ${canRemove ? `<button class="dm-btn dm-btn-sm dm-btn-danger idp-remove-btn">Remove</button>` : ''}
    ${isAdmin ? `<button class="dm-btn dm-btn-sm idp-edit-btn"><iconify-icon icon="lucide:pencil" style="font-size:12px;margin-right:4px;vertical-align:-1px"></iconify-icon>Edit</button>` : ''}
  </div>`;

  actEl.querySelector(".idp-read-btn")?.addEventListener("click", () => openReadModal(item));
  actEl.querySelector(".idp-send-btn").addEventListener("click", () => openSendModal(item, viewingId));
  actEl.querySelector(".idp-remove-btn")?.addEventListener("click", () => openRemoveModal(item, viewingId));
  actEl.querySelector(".idp-edit-btn")?.addEventListener("click", () => openQuickEdit(item, viewingId));

  const attuneBtn   = actEl.querySelector(".idp-attune-btn");
  const unattuneBtn = actEl.querySelector(".idp-unattuned-btn");
  if (attuneBtn) {
    attuneBtn.addEventListener("click", async () => {
      const count = Object.keys(allAttunements[viewingId] || {}).length;
      if (count >= 3) {
        attuneBtn.textContent = "Slots full!";
        attuneBtn.style.color = "#e57373";
        setTimeout(() => { attuneBtn.textContent = "Attune"; attuneBtn.style.color = ""; }, 2000);
        return;
      }
      await set(ref(db, `campaigns/${cid}/attunements/${viewingId}/${attk}`), { name: item.name, type: item.type, rarity: item.rarity || null, timestamp: Date.now() });
    });
  }
  if (unattuneBtn) {
    unattuneBtn.addEventListener("click", async () => {
      await remove(ref(db, `campaigns/${cid}/attunements/${viewingId}/${attk}`));
    });
  }

  invDetailPanel.classList.add("open");
  invContent?.classList.add("panel-open");

  const body = invDetailPanel.querySelector(".idp-body");
  if (body) body.scrollTop = 0;
}

function closeItemPanel() {
  if (_activeInvRow) { _activeInvRow.classList.remove("active"); _activeInvRow = null; }
  invDetailPanel.classList.remove("open");
  invContent?.classList.remove("panel-open");
}

document.getElementById("idp-close").addEventListener("click", closeItemPanel);

// ── Attunement slots display ──────────────────────────────────────────────────
function renderAttunementSlots() {
  const el = document.getElementById("att-slots-row");
  if (!el) return;

  const userAttunes = allAttunements[viewingId] || {};
  const filled = Object.entries(userAttunes)
    .map(([key, att]) => ({ key, ...att }))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(0, 3);

  el.innerHTML = "";

  const canUnattuned = isAdmin || viewingId === session.id;

  for (let i = 0; i < 3; i++) {
    const att = filled[i];
    const div = document.createElement("div");

    if (att) {
      const rarity     = att.rarity || null;
      const rarityColor = rarity ? (RARITY_COLORS[rarity] || "#9e9e9e") : null;
      const typeColor  = TYPE_COLORS[att.type || "misc"] || "#6a6060";
      const cc         = rarityColor || typeColor;
      const icon       = TYPE_ICON[att.type || "misc"] || "lucide:gem";

      div.className = "inv-att-slot inv-att-slot-filled";
      div.style.setProperty("--cc", cc);
      div.innerHTML = `
        <iconify-icon icon="${icon}" class="att-slot-icon"></iconify-icon>
        <div class="att-slot-info">
          <span class="att-slot-name">${esc(att.name || "Unknown")}</span>
          ${rarity ? `<span class="att-slot-rarity" style="color:${rarityColor}">${esc(rarity)}</span>` : ""}
        </div>
        ${canUnattuned ? `<button class="att-slot-remove" title="Remove attunement">×</button>` : ""}
      `;

      div.querySelector(".att-slot-remove")?.addEventListener("click", async e => {
        e.stopPropagation();
        await remove(ref(db, `campaigns/${cid}/attunements/${viewingId}/${att.key}`));
      });
    } else {
      div.className = "inv-att-slot inv-att-slot-empty";
      div.innerHTML = `
        <iconify-icon icon="lucide:link" class="att-slot-empty-icon"></iconify-icon>
        <span class="att-slot-empty-text">Empty Slot</span>
      `;
    }

    el.appendChild(div);
  }
}

// ── Saved Spells tab ──────────────────────────────────────────────────────────
const _SPELL_CONDITIONS = {
  blinded: { name: "Blinded", desc: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage." },
  charmed: { name: "Charmed", desc: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature." },
  deafened: { name: "Deafened", desc: "A deafened creature can't hear and automatically fails any ability check that requires hearing." },
  exhaustion: { name: "Exhaustion", desc: "Exhaustion is measured in six levels. 1: Disadvantage on ability checks. 2: Speed halved. 3: Disadvantage on attack rolls and saving throws. 4: Hit point maximum halved. 5: Speed reduced to 0. 6: Death." },
  frightened: { name: "Frightened", desc: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear." },
  grappled: { name: "Grappled", desc: "A grappled creature's speed becomes 0. The condition ends if the grappler is incapacitated, or if an effect removes the grappled creature from reach." },
  incapacitated: { name: "Incapacitated", desc: "An incapacitated creature can't take actions or reactions." },
  invisible: { name: "Invisible", desc: "An invisible creature is impossible to see without magic or a special sense. Attack rolls against it have disadvantage, and its attack rolls have advantage." },
  paralyzed: { name: "Paralyzed", desc: "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Str and Dex saves. Any attack that hits is a critical hit if the attacker is within 5 feet." },
  petrified: { name: "Petrified", desc: "A petrified creature is transformed into solid inanimate substance. It is incapacitated, can't move or speak, and is unaware of its surroundings." },
  poisoned: { name: "Poisoned", desc: "A poisoned creature has disadvantage on attack rolls and ability checks." },
  prone: { name: "Prone", desc: "A prone creature's only movement option is to crawl, unless it stands up. It has disadvantage on attack rolls. Attacks against it have advantage if the attacker is within 5 feet." },
  restrained: { name: "Restrained", desc: "A restrained creature's speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on Dexterity saving throws." },
  stunned: { name: "Stunned", desc: "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Str and Dex saves. Attack rolls against it have advantage." },
  unconscious: { name: "Unconscious", desc: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. It drops whatever it's holding and falls prone." },
};
const _SPELL_COND_REGEX = new RegExp(`\\b(${Object.keys(_SPELL_CONDITIONS).join('|')})\\b`, 'gi');
const _SPELL_SCHOOL_COLORS = {
  "abjuration": "#5ba4cf", "conjuration": "#61bd4f", "divination": "#00c2e0",
  "enchantment": "#c377e0", "evocation": "#eb5a46", "illusion": "#9f8fef",
  "necromancy": "#8fab8e", "transmutation": "#d4b44a",
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

function renderSpellsList() {
  const myBook   = allSpellbooks[viewingId] || {};
  const savedIds = Object.keys(myBook);
  const canUnsave = isAdmin || viewingId === session.id;

  if (savedIds.length === 0) {
    invList.innerHTML = `<p class="inv-empty">No saved spells. Star spells on the Spells page to save them here.</p>`;
    return;
  }

  let list = savedIds.map(id => allSpells[id]).filter(Boolean);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(s => [s.name, s.school, s.description].join(" ").toLowerCase().includes(q));
  }

  if (sortField === 'name') {
    list.sort((a, b) => { const c = a.name.localeCompare(b.name); return sortDir === 'asc' ? c : -c; });
  } else if (sortField === 'type') {
    list.sort((a, b) => { const c = (a.school || '').localeCompare(b.school || ''); return sortDir === 'asc' ? c : -c; });
  } else if (sortField === 'rarity') {
    list.sort((a, b) => sortDir === 'asc' ? a.level - b.level : b.level - a.level);
  } else {
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  if (invCount) invCount.textContent = `${list.length} spell${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    invList.innerHTML = `<p class="inv-empty">No spells match your search.</p>`;
    return;
  }

  list.forEach(spell => invList.appendChild(buildSpellRow(spell, canUnsave)));
}

function buildSpellRow(spell, canUnsave) {
  const row    = document.createElement("div");
  const sc     = _spellSchoolColor(spell.school);
  const isConc = (spell.duration || '').includes('Concentration');

  row.className = "inv-row";
  row.style.setProperty("--cc", sc);

  row.innerHTML = `
    <div class="inv-row-main">
      <div class="inv-row-name-wrap">
        <iconify-icon icon="lucide:sparkles" class="inv-row-type-icon" style="color:${sc}"></iconify-icon>
        <div>
          <div class="inv-row-name">${esc(spell.name)}</div>
          ${isConc ? `<span class="inv-row-conc">Concentration</span>` : ''}
        </div>
      </div>
    </div>
    <div class="inv-row-type">
      <span class="inv-type-badge inv-badge-spell" style="background:color-mix(in srgb,${sc} 15%,transparent);border-color:color-mix(in srgb,${sc} 55%,transparent);color:${sc}">${esc(spell.school || 'Spell')}</span>
    </div>
    <div class="inv-row-rarity">
      <span style="font-size:11px;color:#bbb">${_spellLevelShort(spell.level)}</span>
    </div>
    <div class="inv-row-actions">
      ${canUnsave ? `<button class="row-action-btn inv-row-unsave-btn" title="Remove from spellbook"><iconify-icon icon="lucide:star"></iconify-icon></button>` : ''}
    </div>
  `;

  row.addEventListener("click", e => {
    if (e.target.closest(".inv-row-actions")) return;
    openSpellPanel(spell, row, canUnsave);
  });
  row.querySelector(".inv-row-unsave-btn")?.addEventListener("click", e => {
    e.stopPropagation();
    remove(ref(db, `campaigns/${cid}/spellbook/${viewingId}/${spell.id}`));
    if (_activeInvRow === row) closeItemPanel();
  });

  return row;
}

function openSpellPanel(spell, rowEl, canUnsave) {
  if (_activeInvRow) _activeInvRow.classList.remove("active");
  _activeInvRow = rowEl;
  rowEl.classList.add("active");

  const sc     = _spellSchoolColor(spell.school);
  const isConc = (spell.duration || '').includes('Concentration');
  const durText = isConc ? spell.duration.replace(/^Concentration,\s*/i, '') : spell.duration;
  const compParts = [];
  if (spell.verbal)   compParts.push('V');
  if (spell.somatic)  compParts.push('S');
  if (spell.material) compParts.push('M');

  document.getElementById("idp-title").textContent = spell.name;
  document.getElementById("idp-icon").innerHTML = `<iconify-icon icon="lucide:sparkles" class="idp-type-icon" style="color:${sc}"></iconify-icon>`;
  document.getElementById("idp-meta").innerHTML = [
    `<span class="inv-type-badge inv-badge-spell" style="background:color-mix(in srgb,${sc} 15%,transparent);border-color:color-mix(in srgb,${sc} 55%,transparent);color:${sc}">${esc(spell.school || 'Spell')}</span>`,
    `<span class="idp-rarity-badge" style="color:#bbb">${_spellLevelLabel(spell.level)}</span>`,
    isConc ? `<span class="inv-conc-badge">C</span>` : '',
  ].join('');

  document.getElementById("idp-description").innerHTML = `
    <div class="idp-spell-stats">
      ${spell.castTime ? `<div class="idp-spell-stat"><span class="idp-spell-stat-label">Casting Time</span>${esc(spell.castTime)}</div>` : ''}
      ${spell.range    ? `<div class="idp-spell-stat"><span class="idp-spell-stat-label">Range</span>${esc(spell.range)}</div>` : ''}
      ${spell.duration ? `<div class="idp-spell-stat"><span class="idp-spell-stat-label">Duration</span>${esc(durText)}</div>` : ''}
      ${compParts.length ? `<div class="idp-spell-stat"><span class="idp-spell-stat-label">Components</span>${esc(compParts.join(', '))}${spell.materialCost ? ` (${esc(spell.materialCost)})` : ''}</div>` : ''}
      ${(spell.classes || []).length ? `<div class="idp-spell-stat"><span class="idp-spell-stat-label">Classes</span>${esc(spell.classes.join(', '))}</div>` : ''}
    </div>
    ${spell.description ? `<p class="idp-section-label" style="margin-top:14px">Description</p><div class="idp-desc-text">${_renderSpellDesc(spell.description)}</div>` : ''}
  `;
  document.getElementById("idp-abilities").innerHTML = '';

  const actEl = document.getElementById("idp-actions");
  actEl.innerHTML = `<div class="idp-action-row">
    ${canUnsave ? `<button class="dm-btn dm-btn-sm idp-unsave-btn"><iconify-icon icon="lucide:star" style="font-size:12px;margin-right:4px;vertical-align:-1px"></iconify-icon>Saved</button>` : ''}
    <button class="dm-btn dm-btn-sm idp-spell-detail-btn">Full Details</button>
  </div>`;

  actEl.querySelector(".idp-unsave-btn")?.addEventListener("click", () => {
    remove(ref(db, `campaigns/${cid}/spellbook/${viewingId}/${spell.id}`));
    closeItemPanel();
  });
  actEl.querySelector(".idp-spell-detail-btn").addEventListener("click", () => openInvSpellModal(spell));

  invDetailPanel.classList.add("open");
  invContent?.classList.add("panel-open");
  const body = invDetailPanel.querySelector(".idp-body");
  if (body) body.scrollTop = 0;
}

// ── Reader modal (book / scroll) ──────────────────────────────────────────────
const invReaderBook        = document.getElementById("inv-reader-book");
const invReaderScroll      = document.getElementById("inv-reader-scroll");
const invReaderCover       = document.getElementById("inv-reader-cover");
const invReaderSpine       = document.getElementById("inv-reader-spine");
const invReaderCoverTitle  = document.getElementById("inv-reader-cover-title");
const invReaderCoverWriter = document.getElementById("inv-reader-cover-writer");
const invReaderPageTitle   = document.getElementById("inv-reader-page-title");
const invReaderPageContent = document.getElementById("inv-reader-page-content");
const invReaderPageNum     = document.getElementById("inv-reader-page-num");
const invReaderPrev        = document.getElementById("inv-reader-prev");
const invReaderNext        = document.getElementById("inv-reader-next");
const invReaderScrollTitle   = document.getElementById("inv-reader-scroll-title");
const invReaderScrollWriter  = document.getElementById("inv-reader-scroll-writer");
const invReaderScrollContent = document.getElementById("inv-reader-scroll-content");

let invReaderPageIndex = 0;
let invReaderPages     = [];

const BOOK_COVER_COLORS = ["#8b4513","#1a3a5c","#2d5a27","#5c1a2a","#4a3b6b","#6b5a1a","#5c3317","#3d3d3d"];
function bookColor(item) {
  if (item.coverColor) return item.coverColor;
  let n = 0; for (let i = 0; i < (item.id || "").length; i++) n += item.id.charCodeAt(i);
  return BOOK_COVER_COLORS[n % BOOK_COVER_COLORS.length];
}
function getAuthor(item) {
  if (item.writer) return item.writer;
  if (item.description?.startsWith("Written by ")) return item.description.slice(11);
  return null;
}

function openReadModal(item) {
  invReaderBook.style.display   = "none";
  invReaderScroll.style.display = "none";

  if (item.type === "book" || item._etype === "book") {
    const color = bookColor(item);
    invReaderCover.style.setProperty("--cover-color", color);
    invReaderSpine.style.setProperty("--cover-color", color);
    invReaderCoverTitle.textContent  = item.name || "";
    invReaderCoverWriter.textContent = getAuthor(item) ? `by ${getAuthor(item)}` : "";

    let rawPages = item.pages;
    if (rawPages && !Array.isArray(rawPages)) {
      rawPages = Object.keys(rawPages).sort((a, b) => Number(a) - Number(b)).map(k => rawPages[k]);
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

invReaderPrev.addEventListener("click", () => { if (invReaderPageIndex > 0) { invReaderPageIndex--; renderInvReaderPage(); } });
invReaderNext.addEventListener("click", () => { if (invReaderPageIndex < invReaderPages.length - 1) { invReaderPageIndex++; renderInvReaderPage(); } });
document.getElementById("inv-reader-close").addEventListener("click", () => invReader.classList.remove("open"));
invReader.addEventListener("click", e => { if (e.target === invReader) invReader.classList.remove("open"); });

// ── Send modal ────────────────────────────────────────────────────────────────
let sendStackIds = [];

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
  const others = Object.entries(allUsers)
    .map(([uid, u]) => ({ uid, ...u }))
    .filter(u => u.uid !== ownerId);

  if (others.length === 0) {
    list.innerHTML = `<p style="color:#666;font-style:italic;font-size:13px">No other players to send to.</p>`;
  } else {
    list.innerHTML = others.map(u => `
      <div class="inv-player-opt" data-id="${esc(u.uid)}">
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
  if (!selectedSendTarget) { errEl.textContent = "Please select a recipient."; errEl.classList.add("show"); return; }
  errEl.classList.remove("show");

  const ownerItems = allInventory[sendItemOwner] || {};
  const ids = sendStackIds.length > 0 ? sendStackIds : [sendItemId];
  for (const id of ids) {
    const item = ownerItems[id];
    if (!item) continue;
    const newRef = push(ref(db, `campaigns/${cid}/inventory/${selectedSendTarget}`));
    await set(newRef, { ...item, id: newRef.key, givenBy: sendItemOwner, timestamp: Date.now() });
    await remove(ref(db, `campaigns/${cid}/inventory/${sendItemOwner}/${id}`));
  }
  closeModal("send-modal");
});

// ── Remove modal ──────────────────────────────────────────────────────────────
let removeItem  = null;
let removeOwner = null;

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

  let remaining = toRemove;
  const ownerItems = allInventory[removeOwner] || {};
  const ids = removeItem._stackIds || [removeItem.id];
  for (const id of ids) {
    if (remaining <= 0) break;
    const it = ownerItems[id];
    if (!it) continue;
    const qty = it.quantity || 1;
    if (qty <= remaining) { await remove(ref(db, `campaigns/${cid}/inventory/${removeOwner}/${id}`)); remaining -= qty; }
    else { await set(ref(db, `campaigns/${cid}/inventory/${removeOwner}/${id}/quantity`), qty - remaining); remaining = 0; }
  }
  closeModal("remove-modal");
});

// ── Add Item modal ────────────────────────────────────────────────────────────
if (isAdmin) {
  addBtn.addEventListener("click", () => {
    selectedItemDb = null;
    const srch = document.getElementById("ai-search");
    if (srch) srch.value = "";
    document.getElementById("ai-drop").style.display = "none";
    document.getElementById("ai-selected-preview").style.display = "none";
    document.getElementById("ai-type").value = "misc";
    document.getElementById("ai-qty").value = "1";
    document.getElementById("ai-error").classList.remove("show");
    const aiTarget = document.getElementById("ai-target");
    if (aiTarget?.querySelector(`option[value="${viewingId}"]`)) aiTarget.value = viewingId;
    openModal("add-modal");
    setTimeout(() => srch?.focus(), 50);
  });
}

const aiSearchInput = document.getElementById("ai-search");
const aiDrop = document.getElementById("ai-drop");
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
  if (!hits.length) { _showDrop(`<div class="ai-drop-empty">No items found</div>`); return; }
  _showDrop(hits.map(it => `
    <div class="ai-drop-item" data-id="${esc(it.id)}">
      <span class="ai-drop-name">${esc(it.name)}</span>
      ${it.rarity ? `<span class="ai-drop-rarity" style="color:${RARITY_COLORS[it.rarity] || '#9e9e9e'}">${esc(it.rarity)}</span>` : ""}
    </div>`).join(""));
});

aiSearchInput.addEventListener("blur",  () => setTimeout(() => { aiDrop.style.display = "none"; }, 150));
aiSearchInput.addEventListener("focus", () => { if (aiSearchInput.value.trim()) aiSearchInput.dispatchEvent(new Event("input")); });
window.addEventListener("scroll", () => { if (aiDrop.style.display !== "none") _positionDrop(); }, { passive: true });
window.addEventListener("resize", () => { if (aiDrop.style.display !== "none") _positionDrop(); }, { passive: true });

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
  if (!target)         { errEl.textContent = "Select a player."; errEl.classList.add("show"); return; }
  errEl.classList.remove("show");

  const itemRef = push(ref(db, `campaigns/${cid}/inventory/${target}`));
  await set(itemRef, {
    id: itemRef.key, name: selectedItemDb.name, type, quantity: qty,
    value: selectedItemDb.price ? String(selectedItemDb.price) + " gp" : null,
    description: selectedItemDb.description || null, content: null,
    rarity: selectedItemDb.rarity || null, tags: selectedItemDb.tags || null,
    abilities: selectedItemDb.abilities || null,
    requiresAttunement: selectedItemDb.requiresAttunement === true,
    sourceItemId: selectedItemDb.id, givenBy: session.id, timestamp: Date.now(),
  });
  closeModal("add-modal");
  if (isAdmin && target !== viewingId) {
    viewingId = target;
    if (playerSelect.querySelector(`option[value="${target}"]`)) playerSelect.value = target;
    renderList();
  }
});

// ── Manage Players modal ──────────────────────────────────────────────────────
manageBtn.addEventListener("click", () => { renderPlayerList(); openModal("manage-modal"); });

function renderPlayerList() {
  const el = document.getElementById("player-list-el");
  const players = Object.entries(allUsers)
    .map(([uid, u]) => ({ uid, ...u }))
    .sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  if (players.length === 0) {
    el.innerHTML = `<p style="color:#666;font-style:italic;font-size:13px">No players yet.</p>`;
    return;
  }
  el.innerHTML = players.map(u => `
    <div class="player-entry">
      <div class="player-entry-info">
        <span class="player-entry-dot" style="background:${esc(u.color || '#888')}"></span>
        <span class="player-entry-name">${esc(u.username)}</span>
        <span class="player-entry-role">${u.role === "admin" ? "DM" : "Player"}</span>
      </div>
      ${u.uid !== session.id ? `<button class="player-entry-del" data-id="${esc(u.uid)}">Remove</button>` : '<span style="font-size:11px;color:#555">(you)</span>'}
    </div>`).join("");
  el.querySelectorAll(".player-entry-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid  = btn.dataset.id;
      const name = allUsers[uid]?.username || "this player";
      if (!confirm(`Remove "${name}" from the campaign? This also deletes their inventory.`)) return;
      btn.disabled = true; btn.textContent = "Removing…";
      await Promise.all([
        remove(ref(db, `users/${uid}`)),
        remove(ref(db, `campaigns/${cid}/inventory/${uid}`)),
        remove(ref(db, `campaigns/${cid}/attunements/${uid}`)),
      ]);
      delete allUsers[uid];
      renderPlayerList();
    });
  });
}

// ── Quick-Edit Item (DM only) ─────────────────────────────────────────────────
const QE_RARITY_KEYWORDS = new Set(["common", "uncommon", "rare", "very rare", "legendary"]);
let _qeSourceId     = null;
let _qeInvItemId    = null;
let _qeOwnerId      = null;
let _qeRarity       = "common";
let _qeSelectedTags = new Set();
let _qeAbilities    = [];

const qeModal       = document.getElementById("qe-modal");
const qeNameEl      = document.getElementById("qe-name");
const qeDescEl      = document.getElementById("qe-desc");
const qePriceEl     = document.getElementById("qe-price");
const qeErrEl       = document.getElementById("qe-error");
const qeRarityEl    = document.getElementById("qe-rarity-selector");
const qeAbilList    = document.getElementById("qe-abilities-list");
const qeTagAddBtn   = document.getElementById("qe-tag-add-btn");
const qeTagNewInput = document.getElementById("qe-tag-new-input");

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
    parseTags(item.tags).filter(t => !QE_RARITY_KEYWORDS.has(t) && getDisplayTags(t).length === 0).forEach(t => s.add(t));
  });
  return [...s].sort();
}

function _qeRenderTagPicker() {
  const dbTags  = _qeGetAllTags().filter(t => !QE_RARITY_KEYWORDS.has(t));
  const pending = [..._qeSelectedTags].filter(t => !dbTags.includes(t) && !QE_RARITY_KEYWORDS.has(t));
  const allTags = [...dbTags, ...pending];
  const chips   = document.getElementById("qe-tag-chips");
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

  _qeSourceId     = master ? master.id : null;
  _qeInvItemId    = item.id;
  _qeOwnerId      = ownerId;
  _qeRarity       = src.rarity || "common";
  _qeSelectedTags = new Set(parseTags(src.tags).filter(t => !QE_RARITY_KEYWORDS.has(t)));
  _qeAbilities    = Array.isArray(src.abilities) ? src.abilities.map(a => ({ ...a }))
    : src.abilities ? Object.values(src.abilities).map(a => ({ ...a })) : [];

  qeNameEl.value  = src.name        || "";
  qeDescEl.value  = src.description || "";
  qePriceEl.value = src.price       ?? "";
  document.getElementById("qe-shop-available").checked      = src.shopAvailable !== false;
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
  if (!name)                       { qeErrEl.textContent = "Name is required."; return; }
  if (isNaN(price) || price <= 0)  { qeErrEl.textContent = "Enter a valid price greater than 0."; return; }
  qeErrEl.textContent = "";

  const description        = qeDescEl.value.trim() || null;
  const shopAvailable      = document.getElementById("qe-shop-available").checked;
  const requiresAttunement = document.getElementById("qe-requires-attunement").checked || false;
  const cleanTags          = Array.from(_qeSelectedTags).filter(t => !QE_RARITY_KEYWORDS.has(t)).join(", ") || null;
  const abilities          = _qeAbilities.filter(a => a.name.trim()).length
    ? _qeAbilities.filter(a => a.name.trim()) : null;

  if (_qeSourceId) {
    const master = allItemsDb.find(i => i.id === _qeSourceId);
    await set(ref(db, `campaigns/${cid}/items/${_qeSourceId}`), {
      ...(master || {}), name, description, price, rarity: _qeRarity, tags: cleanTags,
      shopAvailable, requiresAttunement, abilities,
    });
    for (const [uid, userInv] of Object.entries(allInventory)) {
      for (const [key, invItem] of Object.entries(userInv || {})) {
        if (invItem.sourceItemId === _qeSourceId || (!invItem.sourceItemId && master && invItem.name === master.name)) {
          await set(ref(db, `campaigns/${cid}/inventory/${uid}/${key}`), {
            ...invItem, name, description, rarity: _qeRarity, tags: cleanTags,
            requiresAttunement, abilities, value: price ? formatGold(price) : null,
            sourceItemId: _qeSourceId,
          });
        }
      }
    }
  } else {
    const invItem = (allInventory[_qeOwnerId] || {})[_qeInvItemId];
    if (invItem) {
      await set(ref(db, `campaigns/${cid}/inventory/${_qeOwnerId}/${_qeInvItemId}`), {
        ...invItem, name, description, rarity: _qeRarity, tags: cleanTags,
        requiresAttunement, abilities, value: price ? formatGold(price) : null,
      });
    }
  }
  _qeClose();
});

// ── Spell detail modal ────────────────────────────────────────────────────────
function openInvSpellModal(spell) {
  const modal  = document.getElementById('spell-modal');
  const sc     = _spellSchoolColor(spell.school);
  const isConc = (spell.duration || '').includes('Concentration');

  document.getElementById('sm-title').textContent = spell.name;
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
  document.getElementById('sm-components').innerHTML = `
    <div class="sm-comp-row">
      <span class="sm-stat-label">Components</span>
      ${compParts.length ? compParts.join('') : '<span style="color:#445;font-size:12px">None</span>'}
      ${spell.materialCost ? `<span class="comp-material">(${esc(spell.materialCost)})</span>` : ''}
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

document.getElementById("sm-close-btn").addEventListener("click", closeInvSpellModal);
document.getElementById("spell-modal").addEventListener("click", e => { if (e.target === document.getElementById("spell-modal")) closeInvSpellModal(); });

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add("open"); }
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
    if (invReader) invReader.classList.remove("open");
    closeInvSpellModal();
    closeItemPanel();
  }
});

// Admin: show add-item target row only for admin
if (document.getElementById("ai-target-row")) {
  document.getElementById("ai-target-row").style.display = isAdmin ? "block" : "none";
}

// ── Condition tooltip ─────────────────────────────────────────────────────────
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

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escBr(str) { return esc(str).replace(/\n/g, "<br>"); }

function inferTypeFromTags(tags) {
  if (!tags) return "misc";
  const list = tags.toLowerCase().split(",").map(t => t.trim());
  if (list.includes("weapon")) return "weapon";
  if (list.includes("armor"))  return "armor";
  if (list.includes("potion")) return "potion";
  return "misc";
}
