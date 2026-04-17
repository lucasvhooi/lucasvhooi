import { db }                          from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { openGivePanel }              from "./give-to-player.js";

const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; } })();

// ── Firebase ──────────────────────────────────────────────────────────────────
const loreRef = ref(db, "lore");

// ── State ─────────────────────────────────────────────────────────────────────
let loreItems    = [];
let activeFilter = "all";
let editingId    = null;
let selectedType = "book";
let selectedColor = "#8b4513";
let currentPages = [];  // [{title, content}]

// ── Book cover colour options ──────────────────────────────────────────────────
const COVER_COLORS = [
  "#8b4513", "#5c3317", "#1a3a5c", "#2d5a27",
  "#5c1a2a", "#4a3b6b", "#1a4a4a", "#6b5a1a",
  "#3d3d3d", "#7a3b00"
];

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const loreGrid    = document.getElementById("lore-grid");
const loreEmpty   = document.getElementById("lore-empty");
const loreToolbar = document.getElementById("lore-toolbar");
const loreAddBtn  = document.getElementById("lore-add-btn");

// Filter tabs
document.querySelectorAll(".lore-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".lore-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter;
    renderGrid();
  });
});

// Edit modal elements
const loreModal    = document.getElementById("lore-modal");
const lmTitle      = document.getElementById("lm-title");
const lmName       = document.getElementById("lm-name");
const lmWriter     = document.getElementById("lm-writer");
const lmError      = document.getElementById("lm-error");
const lmSave       = document.getElementById("lm-save");
const lmCancel     = document.getElementById("lm-cancel");
const lmTypeSelector = document.getElementById("lm-type-selector");
const lmColorRow   = document.getElementById("lm-color-row");
const lmColorSwatches = document.getElementById("lm-color-swatches");
const lmPagesSection = document.getElementById("lm-pages-section");
const lmPagesList  = document.getElementById("lm-pages-list");
const lmAddPageBtn = document.getElementById("lm-add-page-btn");
const lmScrollSection = document.getElementById("lm-scroll-section");
const lmScrollContent = document.getElementById("lm-scroll-content");
const lmAvailableInLibrary = document.getElementById("lm-available-in-library");

// Reader modal elements
const loreReader    = document.getElementById("lore-reader");
const readerClose   = document.getElementById("reader-close");
const readerBook    = document.getElementById("reader-book");
const readerScroll  = document.getElementById("reader-scroll");
const readerCover   = document.getElementById("reader-cover");
const readerSpine   = document.getElementById("reader-spine");
const readerCoverTitle  = document.getElementById("reader-cover-title");
const readerCoverWriter = document.getElementById("reader-cover-writer");
const readerPage        = document.getElementById("reader-page");
const readerPageTitle   = document.getElementById("reader-page-title");
const readerPageContent = document.getElementById("reader-page-content");
const readerPageNum     = document.getElementById("reader-page-num");
const readerPrev        = document.getElementById("reader-prev");
const readerNext        = document.getElementById("reader-next");
const readerScrollTitle   = document.getElementById("reader-scroll-title");
const readerScrollWriter  = document.getElementById("reader-scroll-writer");
const readerScrollContent = document.getElementById("reader-scroll-content");

let readerPageIndex = 0;
let readerPages     = [];

// ── Firebase listener ─────────────────────────────────────────────────────────
onValue(loreRef, snapshot => {
  const data = snapshot.val();
  loreItems = data ? Object.values(data) : [];
  renderGrid();
  updateSeedBtn();
});

// ── Render grid ───────────────────────────────────────────────────────────────
function renderGrid() {
  loreGrid.innerHTML = "";

  const visible = loreItems.filter(item => {
    if (!isAdmin && !item.discovered) return false;
    if (activeFilter !== "all" && item.type !== activeFilter) return false;
    return true;
  });

  loreEmpty.style.display = visible.length === 0 ? "block" : "none";

  visible.forEach(item => {
    const card = buildCard(item);
    loreGrid.appendChild(card);
  });
}

function buildCard(item) {
  const wrap = document.createElement("div");
  wrap.className = `lore-card lore-card-${item.type}${!item.discovered ? " hidden-item" : ""}`;

  if (item.type === "book") {
    wrap.innerHTML = buildBookCardHTML(item);
  } else {
    wrap.innerHTML = buildScrollCardHTML(item);
  }

  // Click opens reader
  const cover = wrap.querySelector(".book-cover, .scroll-cover");
  if (cover) {
    cover.addEventListener("click", () => openReader(item));
  }

  if (isAdmin) {
    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "dm-btn dm-btn-sm lore-card-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", e => { e.stopPropagation(); openEditModal(item); });
    wrap.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "marker-delete-btn dm-btn dm-btn-sm lore-card-delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`Delete "${item.title}"?`)) remove(ref(db, `lore/${item.id}`));
    });
    wrap.appendChild(delBtn);

    // Give to player button
    const giveBtn = document.createElement("button");
    giveBtn.className = "lore-card-give-btn";
    giveBtn.innerHTML = "+";
    giveBtn.addEventListener("click", e => {
      e.stopPropagation();
      openGivePanel(e.currentTarget, {
        name:        item.title,
        type:        item.type,
        description: item.writer ? `Written by ${item.writer}` : null,
        quantity:    1,
        value:       null,
        // Books: pass full pages array so inventory reader can turn pages
        pages:       item.type === "book" ? (item.pages || []) : undefined,
        // Scrolls: plain text content
        content:     item.type === "scroll" ? (item.content || null) : null,
        writer:      item.writer || null,
        coverColor:  item.coverColor || null,
      });
    });
    wrap.appendChild(giveBtn);

    // Library badge
    if (item.availableInLibrary) {
      const libBadge = document.createElement("div");
      libBadge.className = "lore-library-badge";
      libBadge.textContent = "📚";
      libBadge.title = "Available in library";
      wrap.appendChild(libBadge);
    }

    // Visibility toggle
    const dmBar = document.createElement("div");
    dmBar.className = "lore-card-dm-bar";
    const visBtn = document.createElement("button");
    visBtn.className = "lore-visibility-btn";
    visBtn.textContent = item.discovered ? "Hide" : "Show";
    visBtn.addEventListener("click", e => {
      e.stopPropagation();
      set(ref(db, `lore/${item.id}/discovered`), !item.discovered);
    });
    dmBar.appendChild(visBtn);
    wrap.appendChild(dmBar);
  }

  return wrap;
}

function buildBookCardHTML(item) {
  const color = item.coverColor || "#8b4513";
  const title = esc(item.title || "");
  const writer = esc(item.writer || "");
  return `
    <div class="book-cover" style="--cover-color:${color}" onclick="">
      <div class="book-spine">
        <span class="book-spine-text">${title}</span>
      </div>
      <div class="book-front">
        <div class="book-front-title">${title}</div>
        ${writer ? `<div class="book-front-divider"></div><div class="book-front-writer">${writer}</div>` : ""}
      </div>
    </div>
    <div class="book-label">${title}</div>
  `;
}

function buildScrollCardHTML(item) {
  const title = esc(item.title || "");
  const writer = esc(item.writer || "");
  return `
    <div class="scroll-cover" onclick="">
      <div class="scroll-roll top"></div>
      <div class="scroll-body">
        <div class="scroll-body-title">${title}</div>
        ${writer ? `<div class="scroll-body-writer">${writer}</div>` : ""}
      </div>
      <div class="scroll-roll bottom"></div>
    </div>
    <div class="scroll-label">${title}</div>
  `;
}

// ── Reader ────────────────────────────────────────────────────────────────────
function openReader(item) {
  readerBook.style.display   = "none";
  readerScroll.style.display = "none";

  if (item.type === "book") {
    const color = item.coverColor || "#8b4513";
    readerCover.style.setProperty("--cover-color", color);
    readerSpine.style.setProperty("--cover-color", color);
    readerCoverTitle.textContent  = item.title || "";
    readerCoverWriter.textContent = item.writer ? `by ${item.writer}` : "";

    readerPages = item.pages || [];
    if (readerPages.length === 0) readerPages = [{ title: "", content: "" }];
    readerPageIndex = 0;
    renderReaderPage();
    readerBook.style.display = "flex";
  } else {
    readerScrollTitle.textContent   = item.title || "";
    readerScrollWriter.textContent  = item.writer ? `by ${item.writer}` : "";
    readerScrollContent.textContent = item.content || "";
    readerScroll.style.display = "flex";
  }

  loreReader.classList.add("open");
}

function renderReaderPage() {
  const page = readerPages[readerPageIndex] || {};
  readerPageTitle.textContent   = page.title || "";
  readerPageContent.textContent = page.content || "";
  readerPageNum.textContent     = `Page ${readerPageIndex + 1} of ${readerPages.length}`;
  readerPrev.disabled = readerPageIndex === 0;
  readerNext.disabled = readerPageIndex === readerPages.length - 1;
}

readerPrev.addEventListener("click", () => {
  if (readerPageIndex > 0) { readerPageIndex--; renderReaderPage(); }
});

readerNext.addEventListener("click", () => {
  if (readerPageIndex < readerPages.length - 1) { readerPageIndex++; renderReaderPage(); }
});

readerClose.addEventListener("click", () => loreReader.classList.remove("open"));
loreReader.addEventListener("click", e => { if (e.target === loreReader) loreReader.classList.remove("open"); });

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEditModal(item = null) {
  editingId     = item ? item.id : null;
  selectedType  = item ? item.type : "book";
  selectedColor = (item && item.coverColor) ? item.coverColor : COVER_COLORS[0];
  currentPages  = item && item.pages ? item.pages.map(p => ({ ...p })) : [{ title: "", content: "" }];

  lmTitle.textContent          = item ? "Edit Lore" : "Add Lore";
  lmName.value                 = item ? (item.title || "") : "";
  lmWriter.value               = item ? (item.writer || "") : "";
  lmScrollContent.value        = item ? (item.content || "") : "";
  lmAvailableInLibrary.checked = item ? (item.availableInLibrary ?? false) : false;
  lmError.textContent          = "";

  setModalType(selectedType);
  buildColorSwatches();
  buildPagesEditor();
  loreModal.classList.add("open");
  lmName.focus();
}

function setModalType(type) {
  selectedType = type;
  lmTypeSelector.querySelectorAll(".lore-type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  const isBook = type === "book";
  lmColorRow.style.display      = isBook ? "" : "none";
  lmPagesSection.style.display  = isBook ? "" : "none";
  lmScrollSection.style.display = isBook ? "none" : "";
}

lmTypeSelector.querySelectorAll(".lore-type-btn").forEach(btn => {
  btn.addEventListener("click", () => setModalType(btn.dataset.type));
});

function buildColorSwatches() {
  lmColorSwatches.innerHTML = "";
  COVER_COLORS.forEach(color => {
    const sw = document.createElement("div");
    sw.className = `color-swatch${color === selectedColor ? " selected" : ""}`;
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      selectedColor = color;
      lmColorSwatches.querySelectorAll(".color-swatch").forEach(s => {
        s.classList.toggle("selected", s.style.background === color || s.title === color);
      });
    });
    lmColorSwatches.appendChild(sw);
  });
}

function buildPagesEditor() {
  lmPagesList.innerHTML = "";
  currentPages.forEach((page, i) => addPageEditor(page, i));
}

function addPageEditor(page = { title: "", content: "" }, index = null) {
  if (index === null) index = currentPages.length - 1;
  const div = document.createElement("div");
  div.className = "page-editor";
  div.dataset.index = index;
  div.innerHTML = `
    <div class="page-editor-header">
      <span class="page-editor-num">Page ${index + 1}</span>
      <button class="page-delete-btn" type="button">Remove</button>
    </div>
    <input type="text" placeholder="Page title (optional)" value="${esc(page.title || "")}" data-field="title" />
    <textarea placeholder="Page content…" data-field="content">${esc(page.content || "")}</textarea>
  `;
  div.querySelector(".page-delete-btn").addEventListener("click", () => {
    currentPages.splice(parseInt(div.dataset.index), 1);
    buildPagesEditor();
  });
  div.querySelector("input[data-field='title']").addEventListener("input", e => {
    currentPages[parseInt(div.dataset.index)].title = e.target.value;
  });
  div.querySelector("textarea[data-field='content']").addEventListener("input", e => {
    currentPages[parseInt(div.dataset.index)].content = e.target.value;
  });
  lmPagesList.appendChild(div);
}

lmAddPageBtn.addEventListener("click", () => {
  currentPages.push({ title: "", content: "" });
  buildPagesEditor();
  // Scroll to new page
  lmPagesList.lastElementChild?.scrollIntoView({ behavior: "smooth" });
});

lmSave.addEventListener("click", async () => {
  const title = lmName.value.trim();
  if (!title) { lmError.textContent = "Title is required."; return; }
  lmError.textContent = "";

  const payload = {
    id:                 editingId || push(loreRef).key,
    type:               selectedType,
    title,
    writer:             lmWriter.value.trim() || null,
    discovered:         editingId ? (loreItems.find(i => i.id === editingId)?.discovered ?? false) : false,
    coverColor:         selectedType === "book" ? selectedColor : null,
    pages:              selectedType === "book" ? currentPages : null,
    content:            selectedType === "scroll" ? lmScrollContent.value.trim() || null : null,
    availableInLibrary: lmAvailableInLibrary.checked,
  };

  await set(ref(db, `lore/${payload.id}`), payload);
  closeLoreModal();
});

lmCancel.addEventListener("click", closeLoreModal);
loreModal.addEventListener("click", e => { if (e.target === loreModal) closeLoreModal(); });

function closeLoreModal() {
  loreModal.classList.remove("open");
  editingId = null;
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
if (isAdmin) {
  loreToolbar.style.display = "flex";
  loreAddBtn.addEventListener("click", () => openEditModal());

}

function updateSeedBtn() {} // no-op, kept for compatibility

// ── Default Lore Seed ─────────────────────────────────────────────────────────
const DEFAULT_LORE = [
  // ── BOOKS ──────────────────────────────────────────────────────────────────
  {
    type: "book", title: "A History of Enora", writer: "Aldric the Wandering Sage",
    coverColor: "#1a3a5c", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "Chapter I — The World Awakens",
        content: "Enora is a world of vast continents separated by treacherous seas. In the earliest age, the gods shaped the land and breathed life into its peoples. From the frozen shores of Gelonus to the sun-kissed plains of Arcadia, each region bears the mark of divine will.\n\nScholars of the Boundary Sanctuary have long debated the age of the world, with most settling on a figure somewhere beyond ten thousand years. What is agreed upon is this: Enora has seen the rise and fall of many great civilisations, each leaving fragments of their legacy in ruin and legend."
      },
      {
        title: "Chapter II — The Great Continents",
        content: "The known world comprises eight major continents: Gelonus in the north, famous for its severe winters and iron-willed people; Arcadia to the south, the largest and most populous, ruled by ancient elven bloodlines; Elysium Colony, an outpost of the old Elysium Empire; Thule, a land of storm and mystery; Hermesia, known for its merchant guilds; Elysium, the ancestral homeland of high culture; Noxus, a warlike nation; and Pythos, whose people revere serpent deities.\n\nBeyond these lie rumoured lands — Atlantis, said to rest beneath the waves, and the Dimensions, planes of existence beyond mortal reach."
      },
      {
        title: "Chapter III — The Age of Shadows",
        content: "Some two hundred years past, a great darkness spread from the Etherwhite Realm. Scholars call this the Age of Shadows. The God of Death, known as Hades, is said to have reached toward the mortal world during this era. His influence corrupted spirit-wells and drove nature spirits to madness.\n\nIt was during this age that the Spirit Realm became unstable, and tales of Hei Bai — the great panda spirit — first emerged. Priests and druids sealed many of the crossing-points, but the seals have been weakening in recent decades. Some believe the Age of Shadows has not truly ended."
      }
    ]
  },
  {
    type: "book", title: "The Continent of Gelonus", writer: "Mira Coldfen, Royal Cartographer",
    coverColor: "#3d3d3d", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "Geography & Climate",
        content: "Gelonus is the northernmost of Enora's major continents, characterised by rugged coastlines, dense pine forests, and long, biting winters. Its interior rises into the Iron Spine mountain range, beyond which lie the Azmos Roots — a forest of ancient, twisted trees said to straddle the boundary between the mortal world and the Spirit Realm.\n\nThe capital, Frostholm, sits at the heart of the continent. With a population of some 5,700 souls, it is the largest settlement in Gelonus and the seat of the ruling council."
      },
      {
        title: "Notable Settlements",
        content: "FROSTHOLM — Capital, pop. 5,700. High wealth. Home to the Frostholm Academy and the Truth Sanctum Outpost.\n\nMIRSTONE — Pop. 84, Rich. A prosperous mining and trading town.\n\nRUTHORHAM — Pop. 103, Medium wealth. A market town known for its blacksmiths.\n\nBECKINSDALE — Pop. 76, Medium wealth. A quiet farming village.\n\nYARN — Pop. 15, Poor. A small coastal village near Azmos Roots. Recently troubled by spirit activity.\n\nHOCUS LOOKOUT — A coastal watchtower and tavern. Famous for Gale's Cleaver, said to be wielded by its legendary cook."
      },
      {
        title: "The Truth Sanctum",
        content: "Between Mirstone and Frostholm stands the Truth Sanctum, an ancient fortress of black stone. Its official purpose is the preservation of historical records, though rumour holds that the Sanctum's deepest vaults contain documents the crown would rather the public never read — war strategies, lists of those marked for execution, and forbidden magical research.\n\nThe Sanctum is guarded by the Wardens of the King. The current warden, Kastor Redwood — known in darker circles as the Unyielding Fang — is feared for his ability to adapt to any attack and his iron will."
      }
    ]
  },
  {
    type: "book", title: "The Continent of Arcadia", writer: "Sylvara Dawnwhisper",
    coverColor: "#2d5a27", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "The Green Heart of Enora",
        content: "Arcadia is the largest continent in the known world, stretching from the warm southern seas to the edge of the Velowynn Forest in the east. It is a land of breathtaking variety — ancient elven cities, sprawling human kingdoms, forgotten ruins, and untamed wilderness.\n\nThe capital is Eldoria, seat of the Arcadian High Council. The second city, Silverwyn, lies to the coast and commands much of the continent's maritime trade."
      },
      {
        title: "Silverleaf — Town of Moonlight",
        content: "Nestled deep within the whispering trees of the Velowynn Forest, Silverleaf is a tranquil elven town bathed in perpetual moonlight. Graceful spires and gabled rooftops rise as though grown from the roots themselves, adorned with silver-leaf motifs that shimmer with ethereal light.\n\nA crystal-clear river meanders through the heart of town. At night, magical lanterns awaken and buildings hum with quiet enchantments. Home to elven artisans, rangers, weavers, and spellwrights, Silverleaf (pop. 330, Rich) is famed for its Moonshade Market and the Temple of Elenya.\n\nFew who visit Silverleaf ever wish to leave."
      },
      {
        title: "The Ruins & Wilds",
        content: "Beyond the known settlements lie many mysteries. The Elarion Ruins are said to be the remnants of a pre-Arcadian civilisation, their purpose long forgotten. Aelwyn's Depths is a subterranean network of caves where aquatic creatures of great age are rumoured to dwell.\n\nFaenwyn, a village near the forest edge, has been silent for some months. Travellers report seeing lights in the ruins at night. The Arcadian Guard has been slow to investigate, citing lack of resources."
      }
    ]
  },
  {
    type: "book", title: "Gods of Enora: The Pantheon", writer: "High Priest Valdor of Frostholm",
    coverColor: "#5c1a2a", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "Hades — Lord of the Underworld",
        content: "Among the most feared of Enora's gods, Hades rules the realm of the dead. He wields the Reaper's Scythe and is served by legions of the undead. His domain is the Etherwhite Realm — a shadowy mirror of the mortal world accessible only at certain liminal moments.\n\nHades does not seek worship. He seeks dominion. Priests who study his mythology warn that his reach has grown in recent years, as though something has weakened the seals that kept him bound. Those who die by his scythe are said to have their maximum life force permanently reduced."
      },
      {
        title: "Azmos — The God of Games",
        content: "Unlike the brooding lords of nature and death, Azmos is a god of pure intellect and play. He dwells in a magnificent temple at Azmos Roots, accessible through a fountain of black liquid that transforms to clear water under moonlight.\n\nAzmos challenges all who seek his audience to prove their worth through puzzle and game. His greatest test is a game of chess — none who have played him carelessly have prevailed. Those who do earn his respect receive knowledge of great value and the privilege of calling the god a reluctant ally.\n\nThe phrase 'Only leave as a group' is said to be his philosophy: no individual triumph matters if the group falls apart."
      },
      {
        title: "The Spirit Realm & Lesser Powers",
        content: "Below the great gods are countless spirits — nature entities bound to specific places or elements. Hei Bai, the great panda spirit, is among the most powerful of these. He is the guardian of Azmos Roots and the surrounding forest.\n\nWhen his forest is threatened, Hei Bai can become a force of terrible destruction. But at heart he is a protector, and those who earn his trust may summon him in times of great need through the use of a Celestial Crystal.\n\nOther notable spirits include the river-wraiths of the Gelonus coast and the wind-voices of the Iron Spine mountains."
      }
    ]
  },
  {
    type: "book", title: "Creatures of the Spirit Realm", writer: "Irving Alric, Master of Science",
    coverColor: "#4a3b6b", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "Classification of Spirit Entities",
        content: "Spirit entities exist in a continuum of power and intelligence. At the lowest tier are elemental wisps — barely sentient fragments of natural energy. Mid-tier spirits such as river-wraiths and forest-guardians possess personality and memory. At the apex stand ancient entities like Hei Bai, whose power rivals demigods.\n\nSpirits are weakened by the destruction of their anchor — the natural feature they are bound to. This is why the corrupting drill at Azmos Roots caused Hei Bai such distress. Destroying a spirit's anchor is the fastest way to drive it to rage."
      },
      {
        title: "The Celestial Crystal",
        content: "A Celestial Crystal is a crystallised fragment of Spirit Realm energy. Such crystals glow faintly near Spirit Realm portals and can be used to commune with — or even summon — specific bound spirits.\n\nNOTE: The crystal attuned to Hei Bai was retrieved from the Azmos Roots incident. Its use is one-time. Handle with extreme care. The crystal responds to intent; do not carry it in situations of hostile emotion or it may resonate unpredictably.\n\nFor scientific inquiry only. Distribution of this document is restricted."
      }
    ]
  },
  {
    type: "book", title: "A Pirate's Primer", writer: "Captain Morgan Dredge",
    coverColor: "#1a4a4a", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "Rule One: The Coin",
        content: "Every ship has a price of entry. On the Crestfallen, that price is the Pirate Coin — minted in limited numbers, traded rarely, worth more than its weight in gold because of what it represents: trust.\n\nIf you're holding this book, you've either earned your coin or stolen it. If the latter, I suggest you find a very deep ocean. The Crestfallen's crew has long memories and longer blades."
      },
      {
        title: "Rule Two: The Sea",
        content: "The sea gives and the sea takes. The Crestfallen has sailed every passage in the known world. We've outrun Arcadian warships, survived the Kraken's Teeth, and navigated the cursed fog off Pythos.\n\nThe ship was cursed once — don't let anyone tell you otherwise. Every crew member who remembers will confirm it. We broke that curse together, and we would do it again. That's what it means to sail under the black flag: you face the impossible as one.\n\nMorgan Dredge, Captain, the Crestfallen"
      }
    ]
  },
  {
    type: "book", title: "Arcane Theory for Beginners", writer: "Akron Sildor, Master of Magic",
    coverColor: "#6b5a1a", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "What is Magic?",
        content: "Magic is the manipulation of Weave energy — the invisible fabric that connects all living things and the world itself. Every spell, enchantment, and magical item draws from this Weave. Skilled mages learn to perceive it; the most gifted can bend it to their will.\n\nThe Weave is not infinite. Overuse in a single area leads to dead zones where spells fail unpredictably. The corrupting drill at Azmos Roots was a prime example of industrial abuse of Weave-dense land."
      },
      {
        title: "Magical Seals",
        content: "A magical seal is an inscription of condensed Weave energy that prevents tampering, reading, or opening of an object or document. Breaking a seal requires either the creator's counter-key, a sufficiently powerful dispel, or a specialist in Seal-Breaking — of which there are very few.\n\nFey Redwood of Frostholm is among the most gifted seal-breakers currently living. She does not take requests lightly."
      }
    ]
  },
  {
    type: "book", title: "The Legends of the Crestfallen", writer: "Mirin Salt-Eye, Ship's Navigator",
    coverColor: "#7a3b00", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "The Eye Above",
        content: "There is an island that does not appear on any chart. I have seen it three times in my years aboard this ship, always at dawn, always through the same cracked spyglass that belonged to the first mate before me.\n\nThe island exists between the planes — visible only to those who look through enchanted lenses or possess the sight. I have marked its rough position in my private charts, but I will not write it here. Some things are meant to be found, not given."
      },
      {
        title: "The Endless Duel",
        content: "Two of the oldest crew members — their names are now carved into the Circle of Steel table in the mess hall — fought a duel that technically never ended. Both struck killing blows simultaneously. The one who survived was not the stronger fighter, but the one who was willing to let go first.\n\nThat is the lesson of the Crestfallen: sometimes victory belongs to the one who yields."
      }
    ]
  },

  // ── SCROLLS ────────────────────────────────────────────────────────────────
  {
    type: "scroll", title: "The Riddles of Azmos Temple", writer: "Unknown",
    coverColor: null, discovered: false, availableInLibrary: true, pages: null,
    content: "These riddles were inscribed on the four pedestals of Azmos's Temple entrance. Each required an offering that embodied the answer.\n\n'I consume all that I touch, yet I am vital for life's clutch. My dance is both beauty and dread. From me, both life and death are fed.' — FIRE\n\n'I can be still or rush in a rapid flow. Essential for life, wherever I go. I shape the land with patience and might. In my absence, darkness would shroud the light.' — WATER\n\n'I'm a precious gift, cherished by all. In times of triumph, in times of a fall. I'm a mystery, yet a familiar embrace. With every heartbeat, I quicken the pace.' — LIFE\n\n'I am the end, where all roads conclude. A silent visitor, leaving many subdued. I am the eternal night, where dreams may cease. In my embrace, all tumult finds peace.' — DEATH\n\nAfter the offerings were placed, all burned to ash, and the door opened."
  },
  {
    type: "scroll", title: "Proclamation: Wanted — The Escapists", writer: "Office of the Crown, Gelonus",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "WANTED: DEAD OR ALIVE\nTHE ESCAPISTS — MURDERERS AND FUGITIVES OF THE CROWN\n\nBy order of the Crown of Gelonus, a reward of 500 Gold Pieces is offered for the capture or confirmed death of the individuals known collectively as the Escapists.\n\nThese individuals are wanted in connection with unlawful entry to royal property, assault upon agents of the Crown, and the suspected murder of at least one officer of the law.\n\nThey were last seen in the Mirstone harbour district, believed to be seeking passage by sea. All ship captains are hereby warned: those who knowingly provide passage to these fugitives face confiscation of vessel and imprisonment.\n\nPresent this notice at any Guard Post to claim the reward upon provision of evidence.\n\nSeal of the Crown — Gelonus"
  },
  {
    type: "scroll", title: "Field Notes: The Celestial Crystal", writer: "Irving Alric",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "Observation Log — Celestial Crystal (retrieved from Azmos Roots)\n\nDay 1: The crystal pulses with a faint golden light. It responds to proximity to Spirit Realm portals, brightening significantly within 30 feet. No magical signature detected beyond the resonance glow.\n\nDay 3: Attempted to replicate the glow artificially using a standard Weave conduit. Failed. The crystal appears to be drawing directly from a Spirit-layer rather than the conventional Weave.\n\nDay 7: Attuned to the Hei Bai entity specifically. When I described the panda to the crystal aloud, it warmed in my hand. This suggests a sympathetic resonance between crystal and spirit.\n\nConclusion: Single-use summoning capacity. Recommend the party retain possession. Do not expose to hostile magical environments or it may trigger prematurely.\n\n— I. Alric, Master of Science"
  },
  {
    type: "scroll", title: "The Shanty of the Crestfallen", writer: "Traditional, crew of the Crestfallen",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "These are the five verses of the original sea shanty, reconstructed from the crew's fragmented memories:\n\nVerse 1 (First Mate Corren): 'When the black flag rises high, and the storm clouds touch the sea — we sail on, we sail on, till the curse sets us all free.'\n\nVerse 2 (Old Tessel): 'The captain swore by star and wave, the ship would never sink — we row on, we row on, past the Kraken's deadly brink.'\n\nVerse 3 (Young Farwick): 'Mirin saw the island once, through glass of cracking years — we sail on, we sail on, through the fog and through the fears.'\n\nVerse 4 (Cook Halpen): 'Two old blades in the circle of steel, a debt that never paid — we march on, we march on, for the one who first obeyed.'\n\nVerse 5 (The Captain, Morgan Dredge): 'When the sea remembers words we lost, and the ghost ship calls our name — we sail home, we sail home, and we never sail the same.'"
  },
  {
    type: "scroll", title: "Operation Elster — Partial Transcript", writer: "Unknown (Recovered from the drill)",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "OPERATION ELSTER — CLASSIFIED DOCUMENT\n[This scroll bears the mark of a broken magical seal. It was originally found in the control room of the Arcane Bore MK-VI drilling apparatus at Azmos Roots, protected by a seal broken by Fey Redwood of Frostholm.]\n\nOBJECTIVE: Extraction of Weave-core deposits from the Azmos Roots Spirit Node. The node is estimated to contain sufficient energy to power experimental constructs for decades.\n\nAUTHORITY: Operation authorised under the joint seal of Irving Alric (Master of Science) and Akron Sildor (Master of Magic).\n\nWARNING: Disruption of the Spirit Node will agitate bound entities in the region. Security teams are advised to treat all nature spirits as hostile upon sight.\n\nNOTE: Hei Bai is classified as an Apex Threat. Do not engage directly. If encountered, initiate Protocol Black and evacuate all non-essential personnel immediately.\n\n[The remainder of the document has been destroyed or is missing.]"
  },
  {
    type: "scroll", title: "Hei Bai — Spirit of Azmos Roots", writer: "Temple Keeper Yuin",
    coverColor: null, discovered: false, availableInLibrary: true, pages: null,
    content: "Long before mortals settled the shores of Gelonus, there was Hei Bai — the great spirit of balance, whose form shifts between the black night and the white dawn. He is depicted as a panda of enormous size, eyes that see between worlds, and a voice like the creak of ancient trees.\n\nHei Bai is the guardian of Azmos Roots. He does not seek conflict, but when his forest is defiled — as it was when the great drill came — he becomes a force of pure destruction. Villages near the roots know this well. The people of Yarn built a small shrine to him generations ago: a stone fountain with a panda at its centre.\n\nTo enter his realm, one must approach the fountain at night, when the black liquid becomes clear. Mortals who enter become invisible to the world — they can observe, but not act. It is in this state that Hei Bai may choose to speak.\n\nThose who help restore balance to the forest earn a Celestial Crystal from the spirit's own paw — a token of trust and a promise that he will come when called."
  }
];

async function seedDefaultLore() {
  if (!confirm(`This will add ${DEFAULT_LORE.length} books and scrolls to the lore. Continue?`)) return;
  const btn = document.getElementById("lore-seed-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Seeding…"; }

  for (const item of DEFAULT_LORE) {
    const id = push(loreRef).key;
    await set(ref(db, `lore/${id}`), { ...item, id });
  }

  if (btn) { btn.disabled = false; btn.textContent = "Seed Default Lore"; }
}

// ── Item Lore Seed ────────────────────────────────────────────────────────────
const ITEM_LORE = [
  // ── BOOKS ──────────────────────────────────────────────────────────────────
  {
    type: "book", title: "Blades of Legend: The Swords of Enora", writer: "Guildmaster Corvin Ashveil",
    coverColor: "#5c1a2a", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "The Bloodthirster",
        content: "Of all the legendary blades said to walk the world of Enora, the Bloodthirster is perhaps the most feared. Forged in the belly of a dragon — not merely heated by its flame, but hammered against the living wall of its gullet while it yet breathed — the sword carries a permanent hunger. It does not merely cut. It drinks.\n\nSages debate which dragon gave its fire to the forging. The current theory favours a red elder of the Thule range, long since dead. What is agreed upon is that the blade grows warmer the more blood it has tasted in a given day, and that wielders who carry it too long report hearing something beneath the ringing of steel — a low, steady pulse, like a heartbeat that is not their own."
      },
      {
        title: "The Volcanic Edge",
        content: "The Volcanic Edge was not forged by any smith. It was found.\n\nA mining crew working the black-rock seams south of Ruthorham broke through into a pocket of ancient magma that had cooled around a blade-shaped void. When they pried the rock away, the sword was already there — perfectly formed, still warm to the touch, glowing faintly orange along its fuller.\n\nNo runes mark it. No wizard has claimed to have enchanted it. It simply is what it is: a blade born from the earth itself, carrying the memory of fire in its steel. It deals additional fire damage on each strike and leaves a burning trail in the air that lingers for a moment after each swing."
      },
      {
        title: "The Wardbreaker Blade",
        content: "This longsword was recovered from the chambers of the Truth Sanctum after the party's confrontation with Kastor Redwood, the Unyielding Fang. It is forged from black steel tempered through an arcane process that infuses the metal with disruptive resonance — each swing unsettles magical wards, barriers, and enchantments in its path.\n\nThe blade is said to carry a fragment of Kastor Redwood's resolve — his philosophy that no wall, whether of stone or spell, should stand before a determined soldier. In this, it is both a tribute to and a warning about its previous owner.\n\nIn mechanical terms: strikes from the Wardbreaker Blade deal an additional 1d6 force damage to constructs, magical barriers, and warded surfaces. It can also be used as a substitute for a dispel check at disadvantage."
      },
      {
        title: "The Mejij Katana",
        content: "The Mejij Katana originates from a tradition of bladesmithing found in a distant eastern culture that Enoran scholars have only fragmentary knowledge of. The word 'Mejij' translates roughly as 'still water' — which seems at odds with the blade's devastating cutting power, until one understands the philosophy behind it.\n\nThe Mejij school teaches that violence, like water, must be at rest internally even as it moves. A mind that is turbulent will produce turbulent strikes; a mind like still water will produce precise, inevitable ones. The sword is balanced to an almost uncomfortable degree — perfectly neutral in the hand, neither heavy toward point nor guard, requiring the wielder to impose their own will entirely upon it.\n\nThose who master it find it gives a +1 to attack rolls and deals an additional die of damage on critical hits."
      }
    ]
  },
  {
    type: "book", title: "The Alchemist's Field Guide", writer: "Senara Dusk, Master Brewer of Frostholm",
    coverColor: "#2d5a27", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "Frostbeard's Brew",
        content: "Encased in a frost-kissed flask carved from enchanted ice, Frostbeard's Brew is a relic of ancient Norse magic and forgotten frost giants. The flask itself is etched with archaic runes that mimic the swirling forms of winter storms, and its surface is perpetually encrusted with crystalline frost.\n\nInside, the ale glows with a spectral blue light. Wisps of ethereal mist escape from the opening, carrying the faint echo of distant wind. One sip grants temporary resistance to cold damage and a surge of melee might — but the lingering effect is a haunting chill in the veins, as though a fragment of frost-giant essence remains.\n\nDose: Single use. Duration: 1 hour. Side effect: Disadvantage on Dexterity checks for the final 10 minutes as the cold sets in the joints."
      },
      {
        title: "The Metallon Flower Leaf",
        content: "The Metallon Flower is found only in the deep mineral veins of Gelonus's Iron Spine mountains, growing in the rare pockets where magical runoff from old Weave disturbances has crystallised into nutrient-rich soil. Its petals are thin as paper and as hard as copper. Its leaves, when dried and powdered, are a prime alchemical catalyst.\n\nMetallon Flower Leaf powder mixed into any potion base increases the duration of the effect by 50%. Added to a healing potion, it causes the healing to regenerate over 3 rounds instead of instantly. Mixed with fire-based reagents, it creates a hardened ember compound used in the production of Flame Tongue coatings.\n\nRaw leaves are mildly toxic — do not consume unprocessed."
      },
      {
        title: "Flame Tongue, Shock Tongue & Leaf Tongue",
        content: "The Tongue series of coatings are alchemical treatments applied to blade weapons to add elemental properties. Each is a different formula, but all share the same application method: the blade is submerged in the prepared compound for 24 hours, then dried in the appropriate elemental conditions.\n\nFLAME TONGUE: Based on dragonfire residue and Metallon Flower compounds. The blade ignites on command, dealing an additional 2d6 fire damage. Counts as magical.\n\nSHOCK TONGUE: Derived from thunderstone dust and the glands of electric eels native to the Gelonus coast. Deals 2d6 lightning damage on hit and forces a Constitution save (DC 13) or the target cannot take reactions until their next turn.\n\nLEAF TONGUE: Rarest of the three. Requires sap from an awakened tree. Deals 1d8 poison damage and causes plants within 10 feet to briefly animate, potentially entangling nearby enemies."
      }
    ]
  },
  {
    type: "book", title: "Remarkable Relics of the Known World", writer: "Aldric the Wandering Sage",
    coverColor: "#1a3a5c", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "The Immovable Rod",
        content: "The Immovable Rod is one of the most reliably useful magical items ever created, and one of the most deceptively simple. It is a plain iron rod, roughly two feet in length, with a single button on one end. Press the button and the rod freezes in space — completely stationary, regardless of gravity, force, or circumstance. It will hold 8,000 pounds before its magic gives out. Press the button again, and it moves freely.\n\nNo one knows who first made one. The design appears in smithing manuals from at least six different civilisations, all predating written history. The working theory is that the original was a divine gift and everything since has been an increasingly imperfect copy. The current version in general circulation is thought to be around the fourth generation of copies.\n\nApplications: Climbing anchor. Door brace. Improvised table. Assassination tool. The possibilities are limited only by imagination and the 8,000-pound threshold."
      },
      {
        title: "Azmos's Chess Piece",
        content: "This is not a trophy. It was given.\n\nAzmos, the God of Games, does not give gifts to those who defeat him — he gives acknowledgements to those he deems worthy of having played. The chess piece he presents upon a visitor's departure from his temple is a black king, carved from a stone that does not exist in the natural world: it is neither marble nor obsidian, warm to the touch in a way stone should not be, and slightly heavier than it looks.\n\nThe piece holds no combat enchantment. Its power is subtler: when held and a decision is being made, the holder gains an almost imperceptible sense of clarity — not guidance, but stillness. Azmos does not tell you what to do. He reminds you that you are capable of deciding.\n\nThose who have studied it report that it is impossible to cheat at any game while holding it. This is widely regarded as either a feature or a curse depending on who you ask."
      },
      {
        title: "Ulsa's Spyglass",
        content: "This is no ordinary ship's instrument. The brass is tarnished and the leather grip is worn smooth, but the lens — ground from enchanted crystal by a craftsperson whose name has been lost — still functions with unnatural precision.\n\nUlsa's Spyglass belonged to Mirin Salt-Eye, navigator aboard the Crestfallen, who claimed it was the only instrument in the world that could locate the phantom island — a landmass that exists between the planes, visible only at certain angles and only through this specific lens.\n\nThe spyglass extends vision to extraordinary range (up to one mile in clear conditions) and, when used near Plane-adjacent locations, reveals objects and structures that are invisible to the naked eye. Traces of inter-planar energy leave a golden shimmer in the lens's view."
      },
      {
        title: "The Dice of Impossible Odds",
        content: "These dice — a matched set of three, carved from bone of uncertain origin and marked in silver ink — are called impossible because the rolls they produce should not be statistically achievable. Witnesses have documented sequences of results that would require millions of standard rolls to replicate by chance.\n\nThey are not loaded. No magical manipulation of probability has been detected. Several arcane investigators have concluded, reluctantly, that the dice simply do not obey the laws that govern normal probability. They appear to have opinions about outcomes.\n\nKnown effects: A roll of all-maximum results three times in a row causes a minor tremor in a ten-foot radius. Rolling all minimum results simultaneously causes the dice to temporarily vanish and reappear in a random pocket, pouch, or container owned by someone present. The dice cannot be permanently lost — they always return."
      }
    ]
  },
  {
    type: "book", title: "Tomes of Power: Enchanted Books of Enora", writer: "Prisko Colby, Master of Religion",
    coverColor: "#4a3b6b", discovered: false, availableInLibrary: true,
    pages: [
      {
        title: "The Book of Ever Expansion",
        content: "The Book of Ever Expansion does not teach spells. It expands the capacity to cast them. Reading it — a process that takes a full day and leaves the reader with a persistent headache for 48 hours afterwards — permanently increases the reader's available spell slots by one at a tier determined by the reader's current level at time of reading.\n\nThe book's pages are blank to any non-spellcaster. To a caster, they appear filled with an ever-shifting lattice of Weave notation that is different every time the book is opened. Scholars have concluded that the book is not pre-written — it writes itself in response to the reader's specific magical structure.\n\nOnly one person may ever read a given copy. After reading, the text fades and the book becomes inert."
      },
      {
        title: "The Book of Gambler's Knowledge",
        content: "This slim volume, bound in green leather and smelling faintly of pipe smoke and old ale, contains not spells but strategies. Every game of chance and skill known in Enora is documented in its pages: card games, dice systems, betting structures, tells to watch for, tells to manufacture.\n\nBeyond the practical content, the book grants something stranger: the reader gains a passive ability to instinctively read probability in social situations. After studying it for a week, the reader gains advantage on Insight checks when trying to determine if a person is bluffing, and can sense when the odds of a negotiation are shifting against them.\n\nThe author is listed only as 'A Friend of the House.' No one has ever determined which house."
      },
      {
        title: "The Book of Initiation",
        content: "The Book of Initiation is the single most sought-after pre-combat tome in existence among military strategists. It does not teach tactics in the conventional sense — it rewires the reader's instincts around the critical first moments of an engagement.\n\nAfter reading it (requires one full day of study), the reader permanently gains +2 to Initiative rolls and can never be surprised while conscious. The mechanism appears to involve a form of heightened sensory anticipation that the book trains through a series of increasingly subtle attention exercises buried within its text.\n\nNote: The book is banned in several Arcadian jurisdictions on the grounds that it constitutes an unfair advantage in judicial duels."
      },
      {
        title: "The Book of Hardened Hands",
        content: "Utilitarian in both appearance and purpose, the Book of Hardened Hands is a manual of physical conditioning written for unarmed combatants. Its exercises, when followed for thirty days without interruption, permanently alter the density of the reader's hand bones and the thickness of their knuckle skin.\n\nThe mechanical result: the reader's unarmed strikes deal an additional 1d4 bludgeoning damage and count as magical for the purpose of overcoming resistances. The exercises cannot be skipped or abbreviated — the book is magically aware and will reset the 30-day count if a single day is missed.\n\nSide effect: Rings no longer fit properly."
      }
    ]
  },
  {
    type: "book", title: "The Court of Gelonus: Portraits in Power", writer: "Gidion Solerga (private circulation)",
    coverColor: "#3d3d3d", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "Queen Aylin Brightenloof",
        content: "Aylin Brightenloof is the reigning monarch of Gelonus and, by any objective measure, the most consequential political figure of the current age. She inherited a kingdom in mild debt and moderate prestige and has, over twenty years, transformed it into a continental power.\n\nShe is not a warrior queen in the legendary sense — she does not ride into battle. Her weapon is governance itself: the right appointment at the right time, the carefully timed public gesture, the private conversation that redirects a crisis before it becomes one. Those who underestimate her warmth as softness do not make that mistake twice.\n\nPersonal note from the author: I have done business with the crown for fifteen years. I have never felt I had the full advantage in any negotiation. I mean this as the highest possible compliment."
      },
      {
        title: "Donat Ward — Hand of the King",
        content: "The title 'Hand of the King' in Gelonus is a bureaucratic formality in most administrations. Under Donat Ward, it has become something else entirely.\n\nWard is the operational mind of the Brightenloof court. He manages the wardens, the city watch, the intelligence network, and the royal household budget simultaneously and without apparent difficulty. He is known to sleep four hours per night and has done so since his twenties.\n\nHis loyalty to the crown is absolute. There are no known exceptions. This makes him both the kingdom's greatest asset and its most significant single point of failure."
      },
      {
        title: "Gidion Solerga — The Blue Mask",
        content: "I will write about myself briefly, since this document will circulate to those who need to understand the court's power structure.\n\nI am a financial backer. I provide capital to crown ventures in exchange for quiet influence. I wear a blue mask at all formal court functions — not for anonymity (anyone in the court knows who I am) but as a reminder that financial power and political power, while adjacent, are not the same thing. The mask is a boundary marker.\n\nWhat I will not write here: the specific nature of the ventures I have backed. Those who need to know already do."
      },
      {
        title: "Fey Redwood — Seal-Breaker of Frostholm",
        content: "Fey Redwood is a half-elf with striking red hair and a reputation that significantly exceeds her years. She is, quite simply, the finest seal-breaker in Gelonus and likely in the known world.\n\nShe does not advertise this. She operates out of a modest residence in the lower merchants' district of Frostholm and accepts perhaps one in ten requests. Her criteria for acceptance are opaque — she has declined both crown commissions and private offers of extraordinary wealth, while occasionally assisting complete strangers at no charge.\n\nHer connection to the Redwood name (shared with Kastor Redwood, the Unyielding Fang of the Truth Sanctum) has never been publicly addressed by either party."
      }
    ]
  },
  {
    type: "book", title: "The Ballads of Joe Rits — Collected Works", writer: "Joe Rits",
    coverColor: "#7a3b00", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "Introduction by the Author",
        content: "I've been asked, more times than I can count, why a bard carries a lute into places that would make a soldier hesitate. The answer is the same every time: someone has to remember what happened. Swords write history in blood; songs write it in something that lasts longer.\n\nThe Balladstring — my guitar, which I will not be parting with — is not a weapon. Except when it is. The instrument was custom-built by a luthier in Frostholm named Harken Oss, who made the neck from ironwood and wound the strings from silver-spun wire at my specific request. When played with intent, the resonance carries further than it should, and in certain chord progressions, it produces a vibration that is distinctly uncomfortable for anyone with hostile intentions.\n\nI have included here a selection of ballads composed during my travels. Some are true. Some are aspirationally true. The distinction is left as an exercise for the reader."
      },
      {
        title: "The Ballad of Hei Bai",
        content: "He walks between the black and white,\nThe panda of the forest's night,\nWhere roots go deep and stars go cold,\nHe guards the stories not yet told.\n\nThey brought their drill, they brought their noise,\nThey broke his peace with metal toys,\nAnd when he rose, the earth was shaking,\nA gentle spirit, slowly waking.\n\nBut rage is not what Hei Bai sought,\nThe forest's balance, dearly bought,\nWas all he asked — to let it be.\nWe listened. And he set us free.\n\n(Note: this version is the third draft. The first draft rhymed 'drill' with 'goodwill' and the second rhymed 'panda' with 'propaganda.' Neither worked.)"
      },
      {
        title: "The Truth Sanctum Blues",
        content: "There's a fortress between two towns,\nWhere the king keeps all his crowns,\nAnd the warden wears a name like a fang,\nAnd the walls remember every pang\nOf every secret locked inside.\n\nWe went in looking for the truth,\nLost a weapon, gained a bruise,\nFound the files they tried to hide,\nGot the passage that we prized,\nAnd sailed before the dawn could rise.\n\nNow I sing it in the taverns low,\nWhere the guards don't care to go,\nAnd the people lean in close to hear\nThe song of things you're not supposed to know.\n\n(This one gets me thrown out of establishments with royal charters. I consider that a quality indicator.)"
      }
    ]
  },
  {
    type: "book", title: "Weapons of Reach and Silence", writer: "Iwan Warrick, Head of the Gelonus City Watch",
    coverColor: "#1a4a4a", discovered: false, availableInLibrary: false,
    pages: [
      {
        title: "The Whispering Dart",
        content: "In the watch, we have a saying: the loudest weapon is not always the most dangerous one. The Whispering Dart was confiscated during an operation three years ago. We never identified who made it or who it was intended for.\n\nThe dart is roughly six inches long, carved from a material that absorbs light in a way that makes it difficult to see in motion. It produces no sound when thrown — not merely quiet, but genuinely silent in a way that should be physically impossible. Our arcanist believes the fletching is enchanted to displace air rather than cut through it.\n\nHitting a sleeping target with a Whispering Dart does not wake them. Period. This alone makes it among the most concerning items in our evidence vault."
      },
      {
        title: "The Shock Tongue Quarter Staff",
        content: "The standard-issue patrol staff is a reliable instrument of crowd control. The Shock Tongue variant is something else entirely.\n\nDeveloped by an artificer in Mirstone (name withheld pending ongoing proceedings), the Shock Tongue Quarter Staff incorporates a Shock Tongue alchemical coating applied to a core of thunderstone-laced hardwood. On a successful strike, it delivers a jolt that stuns briefly. On a critical hit, the target must succeed on a DC 14 Constitution save or be paralysed for one round.\n\nThis weapon is not issued to standard watch personnel. The liability implications alone are significant. I include it here because knowledge of its existence is the first step in defending against one."
      },
      {
        title: "The Staff of the Woodlands",
        content: "Not all weapons are made for war. The Staff of the Woodlands was recovered from the Velowynn Forest border and handed to the watch by a ranger who found it abandoned at a treeline.\n\nThe staff is alive. Technically. It is a branch of an awakened oak that was cut before the tree fully awakened — trapping a fragment of emerging consciousness in the wood. The 'spirit' in the staff is not sapient, but it is responsive: in the presence of natural settings it grows warm; in cities it is dormant and cool.\n\nIn combat, it can cause roots and vines within 15 feet to briefly animate, potentially restraining targets on a failed DC 13 Strength save. It refuses to be used against natural creatures — attempts to strike a beast with it cause the staff to go inert for that action."
      }
    ]
  },

  // ── SCROLLS ────────────────────────────────────────────────────────────────
  {
    type: "scroll", title: "Ulsa's Final Log Entry", writer: "Mirin Salt-Eye (née Ulsa), Navigator",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "Day 847 at sea. Third watch.\n\nI am writing this because I do not expect to be writing tomorrow.\n\nThe spyglass found it again — the island. Three degrees off the port bow, visible only through the cracked lens, golden against the fog. It has been there for six nights now, closer each time. I have not told the captain.\n\nI am beginning to wonder if the island is not between planes in the way I originally theorised — static, waiting to be found — but is instead moving toward us. As if it has decided we have been circled long enough and is now ready to be visited.\n\nThe lens is warm tonight. Warmer than it has ever been. If something happens to me, the person who finds this log should know: the island does not appear to those who are looking for it. It appears to those it has decided to find.\n\nMay the tides be kind.\n— M."
  },
  {
    type: "scroll", title: "The Legend of Gale's Cleaver", writer: "Innkeeper Torrus, Hocus Lookout",
    coverColor: null, discovered: false, availableInLibrary: true, pages: null,
    content: "Every place has its legend. Ours is the Cook.\n\nNobody remembers the Cook's real name. He arrived at Hocus Lookout forty years ago, asked for work, and has been here since. He is not young but he does not appear to age. He speaks rarely. He cooks magnificently.\n\nThe cleaver he uses — always the same one, a heavy, single-bevel blade that should by rights have worn to nothing by now — is called Gale's Cleaver. We call it that because on the nights when the sea storms are worst, the Cook stands at the kitchen window and swings the cleaver once, slowly, and the wind changes. Not dramatically. Just enough.\n\nI asked him about it once. He looked at me the way a very patient person looks at a slightly slow child and said: 'It's a good cleaver.' That was all.\n\nGuests have offered him extraordinary sums for it. He has declined all of them. One man tried to steal it in the night. He was found the next morning sitting in the kitchen, eating breakfast, with no memory of why he had come downstairs. The cleaver was in its place."
  },
  {
    type: "scroll", title: "Incident Report: The Shardbreaker", writer: "Iwan Warrick, City Watch Gelonus",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "INCIDENT REPORT — CLASSIFIED\nSubject: Weapon recovered at Azmos Roots — 'Shardbreaker'\n\nThe weapon designated Shardbreaker was recovered from the wreckage of the Arcane Bore MK-VI after the incident at Azmos Roots. It was the primary tool of the individual known as The Operator.\n\nDescription: A mining pickaxe of reinforced black iron, approximately 4 feet in length. Both pick and hammer ends are usable as weapons. The steel is alloyed with an unknown compound that gives it faint luminescence in darkness and makes it nearly indestructible — standard blacksmith tools will not scratch it.\n\nCapabilities observed in the field: Used to detonate rock seals at range by striking the ground. Creates localised tremors on heavy impacts. The operator used it in an AoE swing (designated 'Decimate') capable of affecting multiple targets simultaneously.\n\nCurrent status: Held in evidence. Several parties have expressed interest in acquiring it. Requests are pending approval."
  },
  {
    type: "scroll", title: "A Warning Regarding the Boomerang of Destiny", writer: "Unknown (found nailed to a door in Ruthorham)",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "TO WHOEVER CURRENTLY HOLDS THE BOOMERANG:\n\nFirst: congratulations. It is genuinely extraordinary. There is nothing quite like watching it arc through the air, strike its target with devastating precision, and return neatly to your hand. The first time you use it in combat you will feel, briefly, like a god.\n\nSecond: a warning.\n\nThe Boomerang of Destiny does not distinguish between what you aimed at and what you were aiming at. The first is the physical target. The second is the outcome you hoped for. These are not always the same.\n\nIn my experience, throwing it when angry produces results that are technically correct but deeply unexpected. Throwing it when calm and precise produces excellent results.\n\nDo not throw it indoors. I cannot stress this enough.\n\nDo not throw it at water.\n\nDo not, under any circumstances, throw it at another Boomerang of Destiny. I don't know what happens and I don't want to find out.\n\nGood luck.\n— A previous owner"
  },
  {
    type: "scroll", title: "On the Bloodbite Shield", writer: "Boris the Great",
    coverColor: null, discovered: false, availableInLibrary: false, pages: null,
    content: "I am not a writer. My aide tells me I need to document the shield's properties so the arcanists have something to work with. Fine.\n\nThe Bloodbite Shield is mine. I acquired it during the campaign at the eastern passes. I will not say how. The important things are these:\n\nOne. It bites back. When an enemy strikes the shield and deals damage, the shield stores a fraction of that force. On my command, it releases that stored force in a single retaliatory pulse. The arcanists call this 'reactive energy displacement.' I call it 'the shield hits them back.'\n\nTwo. The stored charge dissipates if not used within two rounds.\n\nThree. It has bitten me twice. Once when I grabbed it without thinking during a fire alarm (the stored charge from a troll hit earlier that night). Once when my nephew thought it would be funny to slap it. He was not hurt but he was very startled.\n\nFour. It is not cursed. I want that on record. The arcanists keep implying it might be. It is not.\n\n— B.G."
  },
  {
    type: "scroll", title: "Spellcard Notation: A Primer", writer: "Akron Sildor, Master of Magic",
    coverColor: null, discovered: false, availableInLibrary: true, pages: null,
    content: "Spellcards are a condensed magical notation system that allows a spell to be cast once by a non-spellcaster, or cast without expending a spell slot by a qualified caster.\n\nThe card is consumed on use. The spell activates at the minimum effective level unless the caster can channel additional Weave energy into it at the moment of activation.\n\nCURRENTLY AVAILABLE NOTATIONS:\n\nFIREBALL — 3rd level. 20-foot radius, 8d6 fire damage, Dex save DC 14 for half. Handle with distance from any enclosed space.\n\nELDRITCH BLAST — Variable. Force damage, reliable at any range.\n\nMAGIC MISSILE — 1st level. Three darts, 1d4+1 force each, auto-hit. Cannot be blocked by conventional means.\n\nMISTY STEP — 2nd level. Teleportation up to 30 feet to a visible point. Bonus action.\n\nSHIELD — 1st level. +5 AC until next turn, blocks Magic Missile.\n\nCURE WOUNDS — 1st level. 1d8+spellcasting modifier healing on touch.\n\nNote: Spellcards deteriorate if exposed to moisture. Keep in a warded pouch."
  }
];

async function seedItemLore() {
  if (!confirm(`This will add ${ITEM_LORE.length} item-related books and scrolls. Continue?`)) return;
  const btn = document.getElementById("lore-item-seed-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Seeding…"; }

  for (const item of ITEM_LORE) {
    const id = push(loreRef).key;
    await set(ref(db, `lore/${id}`), { ...item, id });
  }

  if (btn) { btn.disabled = false; btn.textContent = "Seed Item Lore"; }
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    loreModal.classList.remove("open");
    loreReader.classList.remove("open");
  }
});

// ── Utility ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
