import { db }                          from "./firebase.js";
import { ref, set, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const isAdmin = localStorage.getItem("isAdmin") === "true";

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
    editBtn.className = "lore-card-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", e => { e.stopPropagation(); openEditModal(item); });
    wrap.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "lore-card-delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`Delete "${item.title}"?`)) remove(ref(db, `lore/${item.id}`));
    });
    wrap.appendChild(delBtn);

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

  lmTitle.textContent    = item ? "Edit Lore" : "Add Lore";
  lmName.value           = item ? (item.title || "") : "";
  lmWriter.value         = item ? (item.writer || "") : "";
  lmScrollContent.value  = item ? (item.content || "") : "";
  lmError.textContent    = "";

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
    id:          editingId || push(loreRef).key,
    type:        selectedType,
    title,
    writer:      lmWriter.value.trim() || null,
    discovered:  editingId ? (loreItems.find(i => i.id === editingId)?.discovered ?? false) : false,
    coverColor:  selectedType === "book" ? selectedColor : null,
    pages:       selectedType === "book" ? currentPages : null,
    content:     selectedType === "scroll" ? lmScrollContent.value.trim() || null : null,
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
