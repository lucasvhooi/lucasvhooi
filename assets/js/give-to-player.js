'use strict';
import { db }                          from "./firebase.js";
import { ref, set, push, onValue }     from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// ── Live users list ───────────────────────────────────────────────────────────
let allUsers = {};
onValue(ref(db, "users"), snap => { allUsers = snap.val() || {}; });

// ── Floating give panel (singleton) ──────────────────────────────────────────
let panelEl = null;

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement("div");
  panelEl.className = "give-panel";
  panelEl.innerHTML = `
    <div class="give-panel-header">
      <span class="give-panel-title">Give to player</span>
      <button class="give-panel-close">&#10005;</button>
    </div>
    <div class="give-panel-list"></div>
    <div class="give-panel-feedback"></div>`;
  document.body.appendChild(panelEl);

  panelEl.querySelector(".give-panel-close").addEventListener("click", hidePanel);
  document.addEventListener("click", e => {
    if (panelEl.classList.contains("open") && !panelEl.contains(e.target) && !e.target.closest(".give-btn") && !e.target.closest(".lore-card-give-btn")) {
      hidePanel();
    }
  });
  return panelEl;
}

function hidePanel() { panelEl?.classList.remove("open"); }

/**
 * Open the give panel anchored to a button element.
 * itemData: { name, type, description, quantity, value, content }
 */
export function openGivePanel(anchor, itemData) {
  const panel = ensurePanel();
  const feedback = panel.querySelector(".give-panel-feedback");
  feedback.textContent = "";
  feedback.className = "give-panel-feedback";

  const list = panel.querySelector(".give-panel-list");
  const players = Object.values(allUsers).sort((a, b) => (a.username || "").localeCompare(b.username || ""));

  if (!players.length) {
    list.innerHTML = `<p class="give-panel-empty">No player accounts found.</p>`;
  } else {
    list.innerHTML = players.map(u => `
      <button class="give-panel-player" data-id="${escAttr(u.id)}" style="--pc:${escAttr(u.color || '#888')}">
        <span class="give-panel-dot"></span>
        <span class="give-panel-name">${escHtml(u.username)}</span>
        <span class="give-panel-role">${u.role === "admin" ? "DM" : "Player"}</span>
      </button>`).join("");

    list.querySelectorAll(".give-panel-player").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid  = btn.dataset.id;
        const user = allUsers[uid];
        if (!user) return;

        btn.disabled = true;
        try {
          await giveToInventory(uid, itemData);
          feedback.textContent = `✓ Sent to ${user.username}`;
          feedback.className = "give-panel-feedback success";
          setTimeout(hidePanel, 1200);
        } catch(e) {
          feedback.textContent = "Error — please try again.";
          feedback.className = "give-panel-feedback error";
          btn.disabled = false;
        }
      });
    });
  }

  // Position panel near the anchor button
  const rect = anchor.getBoundingClientRect();
  const panelW = 200;
  let left = rect.left;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  panel.style.top  = (rect.bottom + window.scrollY + 6) + "px";
  panel.style.left = Math.max(8, left) + "px";
  panel.classList.add("open");
}

async function giveToInventory(playerId, itemData) {
  const session = JSON.parse(localStorage.getItem("playerSession") || "{}");
  const newRef  = push(ref(db, `inventory/${playerId}`));
  const payload = {
    id:          newRef.key,
    name:        itemData.name        || "Item",
    type:        itemData.type        || "misc",
    description: itemData.description || null,
    quantity:    itemData.quantity    || 1,
    value:       itemData.value       || null,
    content:     itemData.content     || null,
    rarity:      itemData.rarity      || null,
    tags:        itemData.tags        || null,
    givenBy:     session.id           || "admin",
    timestamp:   Date.now(),
  };
  // Preserve book fields so the inventory reader matches lore
  if (itemData.pages   != null) payload.pages      = itemData.pages;
  if (itemData.writer  != null) payload.writer      = itemData.writer;
  // coverColor: always copy even if null so bookColor() doesn't generate a random one
  payload.coverColor = itemData.coverColor || null;
  await set(newRef, payload);
}

function escHtml(s)  { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escAttr(s)  { return String(s ?? "").replace(/"/g,"&quot;"); }
