'use strict';

let imageData = {};
let activeCategory = null;

const isAdmin = (() => {
  try { return JSON.parse(localStorage.getItem('playerSession'))?.role === 'admin'; } catch { return false; }
})();

function resolveAssetPath(path) {
  if (!path) return path;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('/') || path.startsWith('../')) return path;
  return `../${path}`;
}

function loadData() {
  fetch('../assets/data/data.json')
    .then(r => r.json())
    .then(data => { imageData = data; generateCategoryButtons(); })
    .catch(err => console.error('Error loading data:', err));
}

function generateCategoryButtons() {
  const container = document.getElementById('category-buttons');
  container.innerHTML = '';
  Object.keys(imageData).forEach(category => {
    const btn = document.createElement('button');
    btn.className = 'category-button';
    btn.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    btn.onclick = () => {
      activeCategory = category;
      container.querySelectorAll('.category-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showCategory(category);
    };
    container.appendChild(btn);
  });
}

function buildCard(item, isEncountered) {
  const card = document.createElement('div');
  card.className = 'card-pair ' + (isEncountered ? 'encountered' : 'unencountered');

  if (isAdmin) {
    const badge = document.createElement('div');
    badge.className = 'status-badge';
    badge.textContent = isEncountered ? 'Encountered' : 'Not encountered';
    card.appendChild(badge);
  }

  const img = document.createElement('img');
  img.src = resolveAssetPath(item.src);
  img.alt = item.name || 'Gallery Image';
  img.className = 'gallery-image';
  img.loading = 'lazy';
  img.onclick = () => openPopup(item.src, item.backImage, item.description);
  card.appendChild(img);
  return card;
}

function showCategory(category) {
  const gallery = document.getElementById('image-gallery');
  const empty   = document.getElementById('expl-empty');
  gallery.innerHTML = '';

  const items = imageData[category] || [];
  let shown = 0;

  items.forEach(item => {
    const isEncountered = item.Encountered?.toLowerCase() === 'yes';
    if (!isAdmin && !isEncountered) return;
    gallery.appendChild(buildCard(item, isEncountered));
    shown++;
  });

  empty.style.display = shown === 0 ? 'block' : 'none';
}

function searchAllImages() {
  const query   = document.getElementById('searchBar').value.toLowerCase().trim();
  const gallery = document.getElementById('image-gallery');
  const empty   = document.getElementById('expl-empty');

  // Clear active category highlight when searching
  document.querySelectorAll('.category-button').forEach(b => b.classList.remove('active'));

  if (!query) {
    gallery.innerHTML = '';
    empty.style.display = 'none';
    if (activeCategory) showCategory(activeCategory);
    return;
  }

  gallery.innerHTML = '';
  const tags = query.split(/\s+/);
  let shown = 0;

  Object.values(imageData).forEach(items => {
    items.forEach(item => {
      const isEncountered = item.Encountered?.toLowerCase() === 'yes';
      if (!isAdmin && !isEncountered) return;
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      const matches = tags.some(t => itemTags.some(tag => tag.toLowerCase().includes(t)));
      if (matches) {
        gallery.appendChild(buildCard(item, isEncountered));
        shown++;
      }
    });
  });

  empty.style.display = shown === 0 ? 'block' : 'none';
}

function openPopup(frontSrc, backSrc, description) {
  if (!frontSrc) return;
  const popup   = document.getElementById('popup');
  const content = popup.querySelector('.popup-content');

  // Reset (keep close button)
  content.innerHTML = '<button class="expl-popup-close" id="closePopup">&#10005;</button>';
  document.getElementById('closePopup').onclick = closePopup;

  const imgWrap = document.createElement('div');
  imgWrap.className = 'popup-images';

  const front = document.createElement('img');
  front.src = resolveAssetPath(frontSrc);
  front.alt = 'Front';
  front.loading = 'lazy';
  imgWrap.appendChild(front);

  if (backSrc && backSrc !== 'null' && backSrc !== '') {
    const back = document.createElement('img');
    back.src = resolveAssetPath(backSrc);
    back.alt = 'Back';
    back.loading = 'lazy';
    imgWrap.appendChild(back);
  }

  content.appendChild(imgWrap);

  if (description?.trim()) {
    const p = document.createElement('p');
    p.textContent = description;
    content.appendChild(p);
  }

  popup.style.display = 'flex';
  document.body.classList.add('popup-open');
}

function closePopup() {
  document.getElementById('popup').style.display = 'none';
  document.body.classList.remove('popup-open');
}

document.getElementById('popup').addEventListener('click', e => {
  if (e.target === document.getElementById('popup')) closePopup();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePopup();
});

document.addEventListener('DOMContentLoaded', loadData);
