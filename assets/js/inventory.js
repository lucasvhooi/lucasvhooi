'use strict';
import { db }                                        from "./firebase.js";
import { ref, set, remove, onValue, push }           from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getSession, clearSession, hashPassword }    from "./auth.js";

// ── Auth guard ────────────────────────────────────────────────────────────────
const session = getSession();
if (!session) { window.location.href = "login.html"; }

const isAdmin     = session.role === "admin";
const usersRef    = ref(db, "users");
const inventoryRef = ref(db, "inventory");

// ── State ─────────────────────────────────────────────────────────────────────
let allUsers     = {};   // { id: { id, username, color, role } }
let allInventory = {};   // { userId: { itemId: item } }
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

  const items = allInventory[viewingId]
    ? Object.values(allInventory[viewingId])
    : [];

  const filtered = activeFilter === "all"
    ? items.filter(it => it.type !== "book" && it.type !== "scroll")
    : activeFilter === "books-scrolls"
      ? items.filter(it => it.type === "book" || it.type === "scroll")
      : items.filter(it => it.type === activeFilter);

  // Stack identical items (same name + type)
  const stackMap = {};
  filtered.forEach(it => {
    const key = (it.type || "misc") + "::" + (it.name || "");
    if (!stackMap[key]) {
      stackMap[key] = { ...it, _stackQty: it.quantity || 1, _stackIds: [it.id] };
    } else {
      stackMap[key]._stackQty += (it.quantity || 1);
      stackMap[key]._stackIds.push(it.id);
    }
  });
  const visible = Object.values(stackMap);

  if (visible.length === 0) {
    const baseItems = items.filter(it => it.type !== "book" && it.type !== "scroll");
    const loreItems = items.filter(it => it.type === "book" || it.type === "scroll");
    let msg = "No items in this category.";
    if (activeFilter === "all" && baseItems.length === 0)       msg = "No items yet. Ask your DM for loot!";
    if (activeFilter === "books-scrolls" && loreItems.length === 0) msg = "No books or scrolls yet.";
    invGrid.innerHTML = `<p class="inv-empty">${msg}</p>`;
    return;
  }

  invGrid.innerHTML = "";
  visible.forEach(item => invGrid.appendChild(buildItemCard(item, viewingId)));
}

// ── Item card ─────────────────────────────────────────────────────────────────
const TYPE_ICON  = { weapon: "⚔", armor: "🛡", potion: "⚗", book: "📖", scroll: "📜", misc: "◈" };
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
  if (item.type === "book")   return buildBookCard(item, ownerId);
  if (item.type === "scroll") return buildScrollCard(item, ownerId);
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

  card.innerHTML = `
    <div class="inv-card-body">
      <div class="inv-card-top">
        <span class="inv-type-icon">${TYPE_ICON[item.type] || "◈"}</span>
        <div class="inv-name-wrap">
          <h3 class="inv-item-name">${esc(item.name || "Unknown Item")}</h3>
          <div class="inv-badges">
            <span class="inv-type-badge inv-badge-${item.type || "misc"}">${TYPE_LABEL[item.type] || "Misc"}</span>
            ${stackQtyBadge(item)}
            ${rarity ? `<span class="inv-rarity-label" style="color:${rarityColor}">${esc(rarity)}</span>` : ""}
          </div>
        </div>
      </div>
      ${item.description ? `<p class="inv-desc">${esc(item.description)}</p>` : ""}
      ${giverName ? `<p style="font-size:11px;color:#555;margin:6px 0 0;font-style:italic">Given by ${esc(giverName)}</p>` : ""}
    </div>
    <div class="inv-card-actions">
      <button class="inv-action-btn btn-send">Send</button>
      ${(isAdmin || ownerId === session.id) ? `<button class="inv-action-btn btn-delete">Remove</button>` : ""}
    </div>`;

  card.querySelector(".btn-send").addEventListener("click", () => openSendModal(item, ownerId));
  card.querySelector(".btn-delete")?.addEventListener("click", () => openRemoveModal(item, ownerId));

  return card;
}

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

// ── Rarity selector (add-item modal) ─────────────────────────────────────────
let selectedRarity = null;
document.querySelectorAll("#ai-rarity-selector .rarity-sel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (selectedRarity === btn.dataset.rarity) {
      selectedRarity = null;
    } else {
      selectedRarity = btn.dataset.rarity;
    }
    document.querySelectorAll("#ai-rarity-selector .rarity-sel-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.rarity === selectedRarity);
    });
  });
});

addBtn.addEventListener("click", () => {
  document.getElementById("ai-name").value   = "";
  document.getElementById("ai-type").value   = "misc";
  document.getElementById("ai-qty").value    = "1";
  document.getElementById("ai-value").value  = "";
  document.getElementById("ai-desc").value   = "";
  document.getElementById("ai-content").value= "";
  document.getElementById("ai-error").classList.remove("show");
  selectedRarity = null;
  document.querySelectorAll("#ai-rarity-selector .rarity-sel-btn").forEach(b => b.classList.remove("active"));
  toggleContentField();
  // Pre-select currently viewed player
  const aiTarget = document.getElementById("ai-target");
  if (aiTarget.querySelector(`option[value="${viewingId}"]`)) aiTarget.value = viewingId;
  openModal("add-modal");
});

document.getElementById("ai-type").addEventListener("change", toggleContentField);
function toggleContentField() {
  const t = document.getElementById("ai-type").value;
  const row = document.getElementById("ai-content-row");
  const lbl = document.getElementById("ai-content-label");
  row.style.display = (t === "book" || t === "scroll") ? "block" : "none";
  lbl.textContent = t === "scroll" ? "Scroll text (readable)" : "Book content (readable)";
}

document.getElementById("ai-save").addEventListener("click", async () => {
  const name   = document.getElementById("ai-name").value.trim();
  const type   = document.getElementById("ai-type").value;
  const qty    = Math.max(1, parseInt(document.getElementById("ai-qty").value, 10) || 1);
  const value  = document.getElementById("ai-value").value.trim();
  const desc   = document.getElementById("ai-desc").value.trim();
  const content= document.getElementById("ai-content").value.trim();
  const target = document.getElementById("ai-target").value;
  const errEl  = document.getElementById("ai-error");

  if (!name) { errEl.textContent = "Item name is required."; errEl.classList.add("show"); return; }
  if (!target) { errEl.textContent = "Select a player."; errEl.classList.add("show"); return; }
  errEl.classList.remove("show");

  const itemRef = push(ref(db, `inventory/${target}`));
  await set(itemRef, {
    id:          itemRef.key,
    name, type, quantity: qty,
    value:       value || null,
    description: desc || null,
    content:     content || null,
    rarity:      selectedRarity || null,
    givenBy:     session.id,
    timestamp:   Date.now(),
  });
  closeModal("add-modal");
  // Switch view to the recipient
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
  }
});

// ── Admin: show add-item target row only for admin ────────────────────────────
document.getElementById("ai-target-row").style.display = isAdmin ? "block" : "none";

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
