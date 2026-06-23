/* ─────────────────────────────────────────────────────────────────────────────
   Shared combat stat-block editor behaviour.

   Drives the markup rendered by src/components/StatBlockEditor.astro, used by both
   the Combat enemy-template editor and the Characters codex (creature/villain
   stat blocks). Exposes a small global API so it works from both the classic
   combat.js script and the exploration.js module:

     window.StatBlockEditor.mount()        → wire listeners (call once, after DOM)
     window.StatBlockEditor.read()         → { hp, ac, initMod, … } (no name/id)
     window.StatBlockEditor.load(data)     → populate fields from a stat block
     window.StatBlockEditor.clear()        → reset every field

   The loot picker reads the campaign item list from window._combatItems, which
   both pages expose via their Firebase bridge.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const DAMAGE_TYPES = [
    { id: "acid",        label: "Acid",        icon: "lucide:flask-conical",  color: "#9ccc65" },
    { id: "bludgeoning", label: "Bludgeoning", icon: "lucide:hammer",         color: "#bcaaa4" },
    { id: "cold",        label: "Cold",        icon: "lucide:snowflake",      color: "#4fc3f7" },
    { id: "fire",        label: "Fire",        icon: "lucide:flame",          color: "#ff7043" },
    { id: "force",       label: "Force",       icon: "lucide:sparkles",       color: "#b388ff" },
    { id: "lightning",   label: "Lightning",   icon: "lucide:zap",            color: "#ffd54f" },
    { id: "necrotic",    label: "Necrotic",    icon: "lucide:skull",          color: "#8d6e63" },
    { id: "piercing",    label: "Piercing",    icon: "game-icons:arrowhead",  color: "#90a4ae" },
    { id: "poison",      label: "Poison",      icon: "game-icons:poison-bottle", color: "#66bb6a" },
    { id: "psychic",     label: "Psychic",     icon: "lucide:brain",          color: "#f06292" },
    { id: "radiant",     label: "Radiant",     icon: "lucide:sun",            color: "#fff176" },
    { id: "slashing",    label: "Slashing",    icon: "lucide:swords",         color: "#a1887f" },
    { id: "thunder",     label: "Thunder",     icon: "lucide:cloud-lightning", color: "#7986cb" },
  ];

  const RARITY_COLS = {
    "common": "#9e9e9e", "uncommon": "#4caf50", "rare": "#2196f3",
    "very rare": "#9c27b0", "legendary": "#ff9800",
  };

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // Firebase serialises arrays as {0:…,1:…}; normalise back to a real array.
  function toArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return Object.values(v);
  }

  const $ = id => document.getElementById(id);

  let els = null;            // element cache (filled on mount)
  let attacks = [];          // [{name, hit, damage}]
  let resistances = [];      // [damageTypeId]
  let vulnerabilities = [];  // [damageTypeId]
  let lootItems = [];        // [{id, name, price, rarity, chance, qty}]

  function cacheEls() {
    els = {
      hp: $("et-hp"), ac: $("et-ac"), initMod: $("et-init-mod"), cr: $("et-cr"),
      speed: $("et-speed"), notes: $("et-notes"),
      str: $("et-str"), dex: $("et-dex"), con: $("et-con"), int: $("et-int"), wis: $("et-wis"), cha: $("et-cha"),
      strMod: $("et-str-mod"), dexMod: $("et-dex-mod"), conMod: $("et-con-mod"),
      intMod: $("et-int-mod"), wisMod: $("et-wis-mod"), chaMod: $("et-cha-mod"),
      saves: $("et-saves"), condImm: $("et-cond-imm"), languages: $("et-languages"),
      attacksList: $("et-attacks-list"), addAttackBtn: $("et-add-attack-btn"),
      resistChips: $("et-resist-chips"), vulnChips: $("et-vuln-chips"),
      gpMin: $("et-gp-min"), gpMax: $("et-gp-max"), itemsMin: $("et-items-min"), itemsMax: $("et-items-max"),
      itemSearch: $("et-item-search"), itemResults: $("et-item-results"),
      lootItemsEl: $("et-loot-items"), lootEmpty: $("et-loot-empty"),
    };
  }

  const statPairs = () => [
    [els.str, els.strMod], [els.dex, els.dexMod], [els.con, els.conMod],
    [els.int, els.intMod], [els.wis, els.wisMod], [els.cha, els.chaMod],
  ];

  function updateStatMod(inp, mod) {
    const v = parseInt(inp.value, 10);
    if (isNaN(v)) { mod.textContent = "—"; mod.className = "et-stat-mod"; return; }
    const m = Math.floor((v - 10) / 2);
    mod.textContent = (m >= 0 ? "+" : "") + m;
    mod.className = "et-stat-mod" + (m >= 0 ? " positive" : " negative");
  }

  // ── Attacks ─────────────────────────────────────────────────────────────────
  function renderAttackRows() {
    els.attacksList.innerHTML = "";
    if (attacks.length === 0) {
      els.attacksList.innerHTML = `<p class="et-attacks-empty">No attacks defined.</p>`;
      return;
    }
    attacks.forEach((atk, i) => {
      const row = document.createElement("div");
      row.className = "et-attack-row";
      row.innerHTML = `
        <div class="et-atk-top-row">
          <input class="et-atk-name"   type="text" placeholder="Attack name…" value="${escHtml(atk.name)}" />
          <input class="et-atk-hit"    type="text" placeholder="+5"           value="${escHtml(atk.hit)}"  />
          <button type="button" class="et-atk-del-btn" title="Remove"><iconify-icon icon="lucide:x"></iconify-icon></button>
        </div>
        <textarea class="et-atk-damage" placeholder="1d8+3 piercing&#10;On hit: …" rows="2">${escHtml(atk.damage)}</textarea>`;
      row.querySelector(".et-atk-name").addEventListener("input",   e => { attacks[i].name   = e.target.value; });
      row.querySelector(".et-atk-hit").addEventListener("input",    e => { attacks[i].hit    = e.target.value; });
      row.querySelector(".et-atk-damage").addEventListener("input", e => { attacks[i].damage = e.target.value; });
      row.querySelector(".et-atk-del-btn").addEventListener("click", () => { attacks.splice(i, 1); renderAttackRows(); });
      els.attacksList.appendChild(row);
    });
  }

  // ── Damage resistances / vulnerabilities (toggle chips) ──────────────────────
  function renderDmgChips() {
    [[els.resistChips, resistances, vulnerabilities],
     [els.vulnChips,   vulnerabilities, resistances]].forEach(([el, list, other]) => {
      if (!el) return;
      el.innerHTML = "";
      DAMAGE_TYPES.forEach(dt => {
        const on = list.includes(dt.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dmg-type-chip" + (on ? " active" : "");
        if (on) { btn.style.color = dt.color; btn.style.borderColor = dt.color; }
        btn.innerHTML = `<iconify-icon icon="${dt.icon}"></iconify-icon> ${dt.label}`;
        btn.addEventListener("click", () => {
          const i = list.indexOf(dt.id);
          if (i === -1) {
            list.push(dt.id);
            const j = other.indexOf(dt.id);   // a type is resist XOR vulnerable, never both
            if (j !== -1) other.splice(j, 1);
          } else {
            list.splice(i, 1);
          }
          renderDmgChips();
        });
        el.appendChild(btn);
      });
    });
  }

  // ── Loot item rows ───────────────────────────────────────────────────────────
  function renderLootItemRows() {
    els.lootItemsEl.innerHTML = "";
    if (lootItems.length === 0) {
      els.lootItemsEl.appendChild(els.lootEmpty);
      els.lootEmpty.style.display = "";
      return;
    }
    els.lootEmpty.style.display = "none";

    lootItems.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "et-loot-row";
      const rc = RARITY_COLS[item.rarity || "common"] || "#9e9e9e";
      row.innerHTML = `
        <span class="et-loot-item-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
        <span class="et-loot-item-rarity" style="color:${rc};border-color:${rc}33">${item.rarity || "common"}</span>
        <div class="et-loot-chance-group">
          <input class="et-loot-chance-input" type="number" value="${item.chance ?? 100}" min="1" max="100" title="Drop chance %" />
          <span>%</span>
          <span style="margin-left:4px;color:#666">×</span>
          <input class="et-loot-qty-input" type="number" value="${item.qty ?? 1}" min="1" max="99" title="Quantity" />
        </div>
        <button class="et-loot-remove-btn" title="Remove">&times;</button>`;

      row.querySelector(".et-loot-chance-input").addEventListener("change", e => {
        lootItems[idx].chance = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 100));
      });
      row.querySelector(".et-loot-qty-input").addEventListener("change", e => {
        lootItems[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      });
      row.querySelector(".et-loot-remove-btn").addEventListener("click", () => {
        lootItems.splice(idx, 1);
        renderLootItemRows();
      });

      els.lootItemsEl.appendChild(row);
    });
  }

  // ── Item picker (search & add) ───────────────────────────────────────────────
  function onItemSearch() {
    const q = els.itemSearch.value.trim().toLowerCase();
    if (!q) { els.itemResults.style.display = "none"; return; }

    const items = window._combatItems || [];
    const matches = items.filter(item => item.name.toLowerCase().includes(q)).slice(0, 15);
    if (!matches.length) { els.itemResults.style.display = "none"; return; }

    els.itemResults.innerHTML = "";
    matches.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-picker-row";
      const rc = RARITY_COLS[item.rarity || "common"] || "#9e9e9e";
      row.innerHTML = `
        <span class="item-picker-name">${escHtml(item.name)}</span>
        <span class="item-picker-rarity" style="color:${rc};border-color:${rc}33">${item.rarity || "common"}</span>`;
      row.addEventListener("click", () => {
        if (!lootItems.find(x => x.id === item.id)) {   // prevent duplicates
          lootItems.push({
            id:     item.id,
            name:   item.name,
            price:  item.price ?? null,
            rarity: item.rarity || "common",
            chance: 100,
            qty:    1,
          });
          renderLootItemRows();
        }
        els.itemSearch.value = "";
        els.itemResults.style.display = "none";
      });
      els.itemResults.appendChild(row);
    });
    els.itemResults.style.display = "block";
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function read() {
    const stats = (() => {
      const pairs = [["str", els.str], ["dex", els.dex], ["con", els.con], ["int", els.int], ["wis", els.wis], ["cha", els.cha]];
      const obj = {};
      pairs.forEach(([k, el]) => { const v = parseInt(el.value, 10); if (!isNaN(v)) obj[k] = v; });
      return Object.keys(obj).length ? obj : null;
    })();

    return {
      hp:        parseInt(els.hp.value, 10)      || 10,
      ac:        parseInt(els.ac.value, 10)      || 10,
      initMod:   parseInt(els.initMod.value, 10) || 0,
      cr:        els.cr.value.trim()             || "—",
      speed:     els.speed.value.trim()          || null,
      notes:     els.notes.value.trim()          || null,
      stats,
      attacks:   attacks.filter(a => a.name.trim()).map(a => ({ ...a })),
      resistances:     [...resistances],
      vulnerabilities: [...vulnerabilities],
      saves:     els.saves.value.trim()          || null,
      condImm:   els.condImm.value.trim()        || null,
      languages: els.languages.value.trim()      || null,
      loot: {
        gpMin:    parseInt(els.gpMin.value,    10) || 0,
        gpMax:    parseInt(els.gpMax.value,    10) || 0,
        itemsMin: parseInt(els.itemsMin.value, 10) || 0,
        itemsMax: parseInt(els.itemsMax.value, 10) || 0,
      },
      lootItems: lootItems.map(x => ({ ...x })),
    };
  }

  function load(data) {
    data = data || {};
    lootItems = data.lootItems ? toArr(data.lootItems).map(x => ({ ...x })) : [];

    els.hp.value      = data.hp      ?? "";
    els.ac.value      = data.ac      ?? "";
    els.initMod.value = data.initMod ?? "";
    els.cr.value      = data.cr      || "";
    els.speed.value   = data.speed   || "";
    els.notes.value   = data.notes   || "";

    const st = data.stats || {};
    els.str.value = st.str ?? ""; els.dex.value = st.dex ?? ""; els.con.value = st.con ?? "";
    els.int.value = st.int ?? ""; els.wis.value = st.wis ?? ""; els.cha.value = st.cha ?? "";
    statPairs().forEach(([inp, mod]) => updateStatMod(inp, mod));

    attacks = data.attacks ? toArr(data.attacks).map(a => ({ ...a })) : [];
    renderAttackRows();

    resistances     = Array.isArray(data.resistances)     ? [...data.resistances]     : [];
    vulnerabilities = Array.isArray(data.vulnerabilities) ? [...data.vulnerabilities] : [];
    renderDmgChips();

    els.saves.value     = data.saves     || "";
    els.condImm.value   = data.condImm   || "";
    els.languages.value = data.languages || "";
    els.gpMin.value    = data.loot?.gpMin    ?? 0;
    els.gpMax.value    = data.loot?.gpMax    ?? 0;
    els.itemsMin.value = data.loot?.itemsMin ?? 0;
    els.itemsMax.value = data.loot?.itemsMax ?? 0;

    renderLootItemRows();
  }

  function clear() {
    els.hp.value = els.ac.value = els.initMod.value = els.cr.value = els.speed.value = els.notes.value = "";
    els.str.value = els.dex.value = els.con.value = els.int.value = els.wis.value = els.cha.value = "";
    statPairs().forEach(([, mod]) => { mod.textContent = "—"; mod.className = "et-stat-mod"; });
    attacks = []; renderAttackRows();
    resistances = []; vulnerabilities = []; renderDmgChips();
    els.saves.value = els.condImm.value = els.languages.value = "";
    els.gpMin.value = els.gpMax.value = els.itemsMin.value = els.itemsMax.value = "0";
    lootItems = []; renderLootItemRows();
  }

  // Wire listeners + render initial empty states. Returns false if the editor
  // markup isn't on this page (so callers can no-op safely).
  function mount() {
    if (!$("et-hp")) return false;
    cacheEls();
    statPairs().forEach(([inp, mod]) => inp.addEventListener("input", () => updateStatMod(inp, mod)));
    els.addAttackBtn.addEventListener("click", () => { attacks.push({ name: "", hit: "", damage: "" }); renderAttackRows(); });
    els.itemSearch.addEventListener("input", onItemSearch);
    els.itemSearch.addEventListener("blur", () => setTimeout(() => { els.itemResults.style.display = "none"; }, 180));
    renderAttackRows();
    renderDmgChips();
    renderLootItemRows();
    return true;
  }

  window.StatBlockEditor = { mount, read, load, clear };
})();
