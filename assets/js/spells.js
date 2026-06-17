import { db } from "./firebase.js";
import { ref, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const _session = (() => {
  try { return JSON.parse(localStorage.getItem('playerSession')); }
  catch { return null; }
})();
const isAdmin = _session?.role === 'admin';
const _userId = _session?.id || null;
const cid = _session?.campaignId;
if (!cid) { window.location.href = '/campaigns'; throw new Error('No campaign selected'); }

// ── Condition data (from Conditions.txt) ──────────────────────────────────────
const CONDITIONS = {
  blinded: {
    name: "Blinded",
    desc: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage."
  },
  charmed: {
    name: "Charmed",
    desc: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature."
  },
  deafened: {
    name: "Deafened",
    desc: "A deafened creature can't hear and automatically fails any ability check that requires hearing."
  },
  exhaustion: {
    name: "Exhaustion",
    desc: "Exhaustion is measured in six levels. 1: Disadvantage on ability checks. 2: Speed halved. 3: Disadvantage on attack rolls and saving throws. 4: Hit point maximum halved. 5: Speed reduced to 0. 6: Death. A long rest reduces exhaustion level by 1."
  },
  frightened: {
    name: "Frightened",
    desc: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear."
  },
  grappled: {
    name: "Grappled",
    desc: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated, or if an effect removes the grappled creature from reach of the grappler."
  },
  incapacitated: {
    name: "Incapacitated",
    desc: "An incapacitated creature can't take actions or reactions."
  },
  invisible: {
    name: "Invisible",
    desc: "An invisible creature is impossible to see without the aid of magic or a special sense. Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage."
  },
  paralyzed: {
    name: "Paralyzed",
    desc: "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage. Any attack that hits is a critical hit if the attacker is within 5 feet."
  },
  petrified: {
    name: "Petrified",
    desc: "A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can't move or speak, and is unaware of its surroundings. It automatically fails Strength and Dexterity saving throws, has resistance to all damage, and is immune to poison and disease."
  },
  poisoned: {
    name: "Poisoned",
    desc: "A poisoned creature has disadvantage on attack rolls and ability checks."
  },
  prone: {
    name: "Prone",
    desc: "A prone creature's only movement option is to crawl, unless it stands up. It has disadvantage on attack rolls. An attack roll against it has advantage if the attacker is within 5 feet, otherwise the roll has disadvantage."
  },
  restrained: {
    name: "Restrained",
    desc: "A restrained creature's speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on Dexterity saving throws."
  },
  stunned: {
    name: "Stunned",
    desc: "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage."
  },
  unconscious: {
    name: "Unconscious",
    desc: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. It drops whatever it's holding and falls prone. It automatically fails Strength and Dexterity saving throws. Attack rolls against it have advantage. Any attack that hits is a critical hit if the attacker is within 5 feet."
  }
};

// Pre-build regex once — matches any condition keyword at word boundaries, case-insensitive
const CONDITION_REGEX = new RegExp(
  `\\b(${Object.keys(CONDITIONS).join('|')})\\b`,
  'gi'
);

// ── School colors ──────────────────────────────────────────────────────────────
const SCHOOL_COLORS = {
  "abjuration":    "#5ba4cf",
  "conjuration":   "#61bd4f",
  "divination":    "#00c2e0",
  "enchantment":   "#c377e0",
  "evocation":     "#eb5a46",
  "illusion":      "#9f8fef",
  "necromancy":    "#8fab8e",
  "transmutation": "#d4b44a"
};

function getSchoolColor(school) {
  return SCHOOL_COLORS[(school || "").toLowerCase()] || "#7a9abb";
}

// ── Level label helpers ────────────────────────────────────────────────────────
function levelLabel(level) {
  if (level === 0) return "Cantrip";
  const sfx = ["th","st","nd","rd","th","th","th","th","th","th"];
  return `${level}${sfx[level] || "th"} Level`;
}

function levelShort(level) {
  if (level === 0) return "Cantrip";
  const sfx = ["th","st","nd","rd","th","th","th","th","th","th"];
  return `${level}${sfx[level] || "th"}`;
}

// ── Spellbook (saved spells) ───────────────────────────────────────────────────
const spellbookRef = _userId ? ref(db, `campaigns/${cid}/spellbook/${_userId}`) : null;
let savedSpellIds  = new Set();

if (spellbookRef) {
  onValue(spellbookRef, snap => {
    savedSpellIds = new Set(snap.val() ? Object.keys(snap.val()) : []);
    document.querySelectorAll('.spell-save-btn').forEach(btn => {
      const saved = savedSpellIds.has(btn.dataset.spellId);
      btn.classList.toggle('saved', saved);
      btn.innerHTML = saved
        ? '<iconify-icon icon="lucide:star"></iconify-icon>'
        : '<iconify-icon icon="lucide:star" style="opacity:0.45"></iconify-icon>';
      btn.title = saved ? 'Remove from spellbook' : 'Save to My Spells';
    });
  });
}

async function toggleSaveSpell(spellId) {
  if (!_userId) return;
  try {
    if (savedSpellIds.has(spellId)) {
      await remove(ref(db, `campaigns/${cid}/spellbook/${_userId}/${spellId}`));
    } else {
      await set(ref(db, `campaigns/${cid}/spellbook/${_userId}/${spellId}`), { savedAt: Date.now() });
    }
  } catch (e) {
    console.error("Spellbook save failed:", e);
  }
}

// ── State ──────────────────────────────────────────────────────────────────────
let spells       = [];
let activeLevel  = null;
let activeSchool = "";
let activeClass  = "";
let searchQuery  = "";
let activeSaved  = false;
let sortField    = null;   // 'name' | 'level' | 'school' | null
let sortDir      = 'asc';  // 'asc' | 'desc'

// ── Sort controls ─────────────────────────────────────────────────────────────
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
    renderSpells();
  });
});

// ── DOM refs ───────────────────────────────────────────────────────────────────
const spellsGrid      = document.getElementById("spells-grid");
const spellsContent   = document.querySelector(".spells-content");
const searchInput     = document.getElementById("spells-search");
const levelFilter     = document.getElementById("level-filter");
const schoolFilter    = document.getElementById("school-filter");
const classFilter     = document.getElementById("class-filter");
const spellCount      = document.getElementById("spell-count");
const seedStatus      = document.getElementById("seed-status");
const condTooltip     = document.getElementById("condition-tooltip");
const detailPanel     = document.getElementById("spell-detail-panel");
const detailInner     = detailPanel?.querySelector(".spell-detail-inner");
const sdpTitle        = document.getElementById("sdp-title");
const sdpMeta         = document.getElementById("sdp-meta");
const sdpStats        = document.getElementById("sdp-stats");
const sdpComponents   = document.getElementById("sdp-components");
const sdpDescription  = document.getElementById("sdp-description");
let   _activeRow      = null;

// ── CSV parser ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const results = [];
  let pos = 0;
  if (text.charCodeAt(0) === 0xFEFF) pos++; // skip BOM

  while (pos < text.length) {
    const row = [];
    while (pos <= text.length) {
      let field = '';
      if (pos < text.length && text[pos] === '"') {
        pos++;
        while (pos < text.length) {
          if (text[pos] === '"') {
            if (text[pos + 1] === '"') { field += '"'; pos += 2; }
            else { pos++; break; }
          } else {
            field += text[pos++];
          }
        }
      } else {
        while (pos < text.length && text[pos] !== ',' && text[pos] !== '\r' && text[pos] !== '\n') {
          field += text[pos++];
        }
      }
      row.push(field);
      if (pos < text.length && text[pos] === ',') { pos++; }
      else { break; }
    }
    if (pos < text.length && text[pos] === '\r') pos++;
    if (pos < text.length && text[pos] === '\n') pos++;
    if (row.some(f => f.trim())) results.push(row);
  }
  return results;
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Firebase ref ───────────────────────────────────────────────────────────────
const spellsRef = ref(db, "spells");

// ── Seed spells from CSV if DB is empty ───────────────────────────────────────
async function maybeSeed() {
  if (!isAdmin) return;
  const snap = await get(spellsRef);
  if (snap.exists()) return;

  showSeedStatus("Importing spells from CSV…");

  try {
    const res = await fetch("../dnd-spells.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("CSV is empty or unreadable");

    const [, ...dataRows] = rows; // skip header row
    const allSpells = {};

    for (const row of dataRows) {
      const name = (row[0] || "").trim();
      if (!name || name === 'name') continue;
      const id = slugify(name);
      if (!id) continue;

      const rawClasses = (row[1] || "").trim();
      const classArr = rawClasses
        ? rawClasses.split(",").map(c => c.trim()).filter(Boolean)
        : [];

      allSpells[id] = {
        id,
        name,
        classes:      classArr,
        level:        parseInt(row[2]) || 0,
        school:       (row[3] || "").trim(),
        castTime:     (row[4] || "").trim(),
        range:        (row[5] || "").trim(),
        duration:     (row[6] || "").trim(),
        verbal:       row[7] === "1",
        somatic:      row[8] === "1",
        material:     row[9] === "1",
        materialCost: (row[10] || "").trim() || null,
        description:  (row[11] || "").trim()
      };
    }

    await set(spellsRef, allSpells);
    hideSeedStatus();
  } catch (err) {
    showSeedStatus("Import failed: " + err.message, true);
  }
}

function showSeedStatus(msg, isError = false) {
  seedStatus.textContent = msg;
  seedStatus.style.display = "block";
  seedStatus.style.color = isError ? "#e05050" : "#7eb8ff";
}
function hideSeedStatus() {
  seedStatus.style.display = "none";
}

// ── Build filters (called once on load and on spells change) ──────────────────
function buildLevelFilter() {
  const levels = [...new Set(spells.map(s => s.level))].sort((a, b) => a - b);
  levelFilter.innerHTML = "";

  if (_userId) {
    const savedBtn = makeBtn('<iconify-icon icon="lucide:star"></iconify-icon> My Spells', "level-btn" + (activeSaved ? " active" : ""), () => {
      activeSaved = true; activeLevel = null; buildLevelFilter(); renderSpells();
    });
    levelFilter.appendChild(savedBtn);
  }

  const allBtn = makeBtn("All", "level-btn" + (!activeSaved && activeLevel === null ? " active" : ""), () => {
    activeSaved = false; activeLevel = null; buildLevelFilter(); renderSpells();
  });
  levelFilter.appendChild(allBtn);

  levels.forEach(lvl => {
    const btn = makeBtn(levelShort(lvl), "level-btn" + (!activeSaved && activeLevel === lvl ? " active" : ""), () => {
      activeSaved = false; activeLevel = lvl; buildLevelFilter(); renderSpells();
    });
    levelFilter.appendChild(btn);
  });
}

function buildSchoolFilter() {
  const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort();
  schoolFilter.innerHTML = '<option value="">All Schools</option>';
  schools.forEach(school => {
    const opt = document.createElement("option");
    opt.value = school;
    opt.textContent = school;
    if (school === activeSchool) opt.selected = true;
    schoolFilter.appendChild(opt);
  });
}

function buildClassFilter() {
  const classes = [...new Set(spells.flatMap(s => Array.isArray(s.classes) ? s.classes : []))].sort();
  classFilter.innerHTML = '<option value="">All Classes</option>';
  classes.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = cls;
    if (cls === activeClass) opt.selected = true;
    classFilter.appendChild(opt);
  });
}

function makeBtn(text, className, onClick) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.innerHTML = text;
  btn.addEventListener("click", onClick);
  return btn;
}

// ── Render spells list ────────────────────────────────────────────────────────
function renderSpells() {
  spellsGrid.innerHTML = "";

  let filtered = [...spells];

  if (activeSaved) {
    filtered = filtered.filter(s => savedSpellIds.has(s.id));
  } else {
    if (activeLevel !== null) filtered = filtered.filter(s => s.level === activeLevel);
    if (activeSchool)         filtered = filtered.filter(s => s.school === activeSchool);
    if (activeClass)          filtered = filtered.filter(s => (s.classes || []).includes(activeClass));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.school || "").toLowerCase().includes(q) ||
        (s.classes || []).some(c => c.toLowerCase().includes(q))
      );
    }
  }

  // Apply sort
  if (sortField === 'name') {
    filtered.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  } else if (sortField === 'level') {
    filtered.sort((a, b) => sortDir === 'asc'
      ? a.level - b.level || a.name.localeCompare(b.name)
      : b.level - a.level || a.name.localeCompare(b.name));
  } else if (sortField === 'school') {
    filtered.sort((a, b) => sortDir === 'asc'
      ? (a.school || '').localeCompare(b.school || '')
      : (b.school || '').localeCompare(a.school || ''));
  } else {
    filtered.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  const total = filtered.length;
  spellCount.textContent = activeSaved
    ? `${total} saved spell${total !== 1 ? 's' : ''}`
    : (total === spells.length ? `${total} spells` : `${total} of ${spells.length} spells`);

  if (total === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'spells-empty';
    if (activeSaved) {
      emptyEl.innerHTML = `
        <div class="spells-empty-inner">
          <iconify-icon icon="lucide:star" class="spells-empty-star" style="opacity:0.4"></iconify-icon>
          <p class="spells-empty-title">No saved spells</p>
          <p class="spells-empty-hint">Click the star on any spell to save it here.</p>
        </div>`;
    } else {
      emptyEl.textContent = spells.length === 0 ? "Loading spells…" : "No spells match.";
    }
    spellsGrid.appendChild(emptyEl);
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(spell => {
    const row = document.createElement("div");
    row.className = "spell-row";
    const sc = getSchoolColor(spell.school);
    row.style.setProperty("--sc", sc);

    const isConc = (spell.duration || "").includes("Concentration");
    const durText = isConc
      ? spell.duration.replace(/^Concentration,\s*/i, "")
      : spell.duration;

    row.innerHTML = `
      <div class="spell-row-main">
        <div class="spell-row-name">${escHtml(spell.name)}</div>
        <div class="spell-row-classes">${escHtml((spell.classes || []).join(", "))}</div>
      </div>
      <div class="spell-row-level">
        <span class="spell-level-badge">${levelShort(spell.level)}</span>
      </div>
      <div class="spell-row-school">
        <span class="spell-row-school-badge">${escHtml(spell.school)}</span>
      </div>
      <div class="spell-row-cast">${escHtml(spell.castTime || "—")}</div>
      <div class="spell-row-duration">
        ${isConc ? '<span class="conc-tag">C</span>' : ''}${escHtml(durText || "—")}
      </div>
      <div class="spell-row-actions"></div>
    `;

    row.addEventListener("click", e => {
      if (e.target.closest('.spell-save-btn')) return;
      openSpellPanel(spell, row);
    });

    if (_userId) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'spell-save-btn' + (savedSpellIds.has(spell.id) ? ' saved' : '');
      saveBtn.dataset.spellId = spell.id;
      saveBtn.innerHTML = savedSpellIds.has(spell.id)
        ? '<iconify-icon icon="lucide:star"></iconify-icon>'
        : '<iconify-icon icon="lucide:star" style="opacity:0.45"></iconify-icon>';
      saveBtn.title = savedSpellIds.has(spell.id) ? 'Remove from spellbook' : 'Save to My Spells';
      saveBtn.addEventListener('click', e => { e.stopPropagation(); toggleSaveSpell(spell.id); });
      row.querySelector('.spell-row-actions').appendChild(saveBtn);
    }

    fragment.appendChild(row);
  });

  spellsGrid.appendChild(fragment);
}

// ── Spell detail side panel ───────────────────────────────────────────────────
function openSpellPanel(spell, rowEl) {
  // Highlight active row
  if (_activeRow) _activeRow.classList.remove('active');
  _activeRow = rowEl;
  rowEl.classList.add('active');

  const sc = getSchoolColor(spell.school);
  const isConc = (spell.duration || "").includes("Concentration");

  // Tint the panel left border to match the spell's school color
  if (detailInner) detailInner.style.setProperty('--sdp-sc', sc);

  sdpTitle.textContent = spell.name;

  sdpMeta.innerHTML = `
    <span class="sm-badge sm-level-badge">${levelLabel(spell.level)}</span>
    <span class="sm-badge sm-school-badge" style="background:color-mix(in srgb,${sc} 18%,transparent);border-color:color-mix(in srgb,${sc} 55%,transparent);color:${sc}">${escHtml(spell.school)}</span>
    ${isConc ? '<span class="sm-badge sm-conc-badge">Concentration</span>' : ''}
    <div class="sm-classes">${escHtml((spell.classes || []).join(", "))}</div>
  `;

  sdpStats.innerHTML = `
    <div class="sm-stat-row">
      <div class="sm-stat-item">
        <span class="sm-stat-label">Casting Time</span>
        <div class="sm-stat-value">${escHtml(spell.castTime || "—")}</div>
      </div>
      <div class="sm-stat-item">
        <span class="sm-stat-label">Range</span>
        <div class="sm-stat-value">${escHtml(spell.range || "—")}</div>
      </div>
      <div class="sm-stat-item">
        <span class="sm-stat-label">Duration</span>
        <div class="sm-stat-value">${escHtml(spell.duration || "Instantaneous")}</div>
      </div>
    </div>
  `;

  const compParts = [];
  if (spell.verbal)   compParts.push('<span class="comp-badge comp-v" title="Verbal">V</span>');
  if (spell.somatic)  compParts.push('<span class="comp-badge comp-s" title="Somatic">S</span>');
  if (spell.material) compParts.push('<span class="comp-badge comp-m" title="Material">M</span>');

  const matLabel = spell.materialCost
    ? `<span class="comp-material">(${escHtml(spell.materialCost)})</span>`
    : '';

  sdpComponents.innerHTML = `
    <div class="sm-comp-row">
      <span class="sm-stat-label">Components</span>
      ${compParts.length ? compParts.join('') : '<span style="color:#445;font-size:12px">None</span>'}
      ${matLabel}
    </div>
  `;

  sdpDescription.innerHTML = renderDescription(spell.description || "");

  // Open panel + collapse extra list columns
  detailPanel.classList.add('open');
  spellsContent?.classList.add('panel-open');

  // Scroll body to top
  const body = detailPanel.querySelector('.sdp-body');
  if (body) body.scrollTop = 0;
}

function closeSpellPanel() {
  if (_activeRow) { _activeRow.classList.remove('active'); _activeRow = null; }
  detailPanel.classList.remove('open');
  spellsContent?.classList.remove('panel-open');
  condTooltip.style.display = 'none';
}

// ── Description rendering with condition tags ─────────────────────────────────
function renderDescription(text) {
  if (!text) return '<p style="color:#445;font-style:italic">No description.</p>';

  // Escape HTML, then tag conditions, then convert newlines to paragraphs
  let html = escHtml(text);

  html = html.replace(CONDITION_REGEX, match => {
    const key = match.toLowerCase();
    return `<span class="condition-tag" data-condition="${key}">${match}</span>`;
  });

  // Double newlines → paragraph breaks; single newlines → <br>
  html = '<p>' + html.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';

  return html;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Condition tooltip ─────────────────────────────────────────────────────────
let _tooltipTarget = null;

document.addEventListener('mouseover', e => {
  const tag = e.target.closest('.condition-tag');
  if (!tag) return;
  const cond = CONDITIONS[tag.dataset.condition];
  if (!cond) return;

  _tooltipTarget = tag;
  condTooltip.innerHTML = `<div class="ctt-name">${cond.name}</div><div class="ctt-desc">${cond.desc}</div>`;
  condTooltip.style.display = 'block';
  positionTooltipNear(tag);
});

document.addEventListener('mouseout', e => {
  if (!_tooltipTarget) return;
  if (_tooltipTarget.contains(e.relatedTarget)) return;
  condTooltip.style.display = 'none';
  _tooltipTarget = null;
});

document.addEventListener('mousemove', e => {
  if (condTooltip.style.display === 'none') return;
  positionTooltipAtCursor(e.clientX, e.clientY);
});

function positionTooltipNear(el) {
  const rect = el.getBoundingClientRect();
  positionTooltipAtCursor(rect.left + rect.width / 2, rect.top);
}

function positionTooltipAtCursor(cx, cy) {
  const W = 280;
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;
  const vw = window.innerWidth;

  // Try above the cursor
  let left = cx + scrollX + 12;
  let top  = cy + scrollY - (condTooltip.offsetHeight || 90) - 10;

  // Clamp horizontally
  if (left + W > vw + scrollX - 8) left = vw + scrollX - W - 8;
  if (left < scrollX + 8) left = scrollX + 8;

  // If too high, show below instead
  if (top < scrollY + 8) top = cy + scrollY + 18;

  condTooltip.style.left = left + 'px';
  condTooltip.style.top  = top  + 'px';
}

// ── Event listeners ────────────────────────────────────────────────────────────
const spellsSearchClear = document.getElementById("spells-search-clear");
function _updateSpellsSearchClear() {
  if (spellsSearchClear) spellsSearchClear.classList.toggle("visible", searchInput.value.length > 0);
}
searchInput.addEventListener("input",  e => { searchQuery  = e.target.value; _updateSpellsSearchClear(); renderSpells(); });
if (spellsSearchClear) {
  spellsSearchClear.addEventListener("click", () => {
    searchInput.value = ""; searchQuery = ""; _updateSpellsSearchClear(); renderSpells(); searchInput.focus();
  });
}
schoolFilter.addEventListener("change", e => { activeSchool = e.target.value; renderSpells(); });
classFilter.addEventListener("change",  e => { activeClass  = e.target.value; renderSpells(); });

document.getElementById("sdp-close").addEventListener("click", closeSpellPanel);

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && detailPanel.classList.contains("open")) closeSpellPanel();
});

// ── Init ───────────────────────────────────────────────────────────────────────
(async () => {
  await maybeSeed();

  onValue(spellsRef, snapshot => {
    const data = snapshot.val();
    spells = data ? Object.values(data) : [];
    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    buildLevelFilter();
    buildSchoolFilter();
    buildClassFilter();
    renderSpells();
  });
})();
