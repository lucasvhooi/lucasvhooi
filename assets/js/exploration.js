// Object to store loaded image data
let imageData = {};

// Prefix relative asset paths so they resolve correctly from the /pages directory
function resolveAssetPath(path) {
  if (!path) return path;

  // Skip URLs that are already absolute or already rooted
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("/")) {
    return path;
  }

  // If the path already includes an upward traversal, keep it
  if (path.startsWith("../")) {
    return path;
  }

  // Default: prefix with ../ so files in /pages can reach /Images
  return `../${path}`;
}

// Function to load data from the JSON file
function loadData() {
  fetch("../assets/data/data.json")
    .then(response => response.json())
    .then(data => {
      imageData = data;
      generateCategoryButtons();
    })
    .catch(error => console.error("Error loading data:", error));
}

// Generate category buttons dynamically
function generateCategoryButtons() {
  const categoryButtons = document.querySelector('.category-buttons');
  categoryButtons.innerHTML = ""; // Clear existing buttons

  Object.keys(imageData).forEach(category => {
    const button = document.createElement('button');
    button.classList.add('category-button');
    button.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    button.onclick = () => showCategory(category);
    categoryButtons.appendChild(button);
  });
}

// Function to display images for a selected category
function showCategory(category) {
  const galleryDiv = document.querySelector('.image-gallery');
  galleryDiv.innerHTML = ""; // Clear previous content

  const images = imageData[category] || [];

  images.forEach(item => {
    const isEncountered = item.Encountered && item.Encountered.toLowerCase() === "yes";

    const card = document.createElement("div");
    card.classList.add("card-pair");
    if (!isEncountered) {
      card.classList.add("unencountered");
    }

    const statusBadge = document.createElement("div");
    statusBadge.classList.add("status-badge");
    statusBadge.textContent = isEncountered ? "Encountered" : "Not encountered";
    card.appendChild(statusBadge);

    // Front image
    const frontImg = document.createElement("img");
    frontImg.src = resolveAssetPath(item.src);
    frontImg.alt = "Gallery Image";
    frontImg.classList.add("gallery-image");
    frontImg.loading = "lazy"; // Lazy loading for better performance
    frontImg.style.cursor = "pointer";

    // Click event to open the popup
    frontImg.onclick = () => openPopup(item.src, item.backImage, item.description);

    card.appendChild(frontImg);
    galleryDiv.appendChild(card);
  });
}

// Function to open the popup
function openPopup(frontSrc, backSrc, description) {
  if (!frontSrc) return; // Prevent accidental openings

  const popup = document.getElementById('popup');
  const popupContent = document.querySelector('.popup-content');

  // Ensure popup is initially hidden
  popup.style.display = "none";

  // Clear previous content
  popupContent.innerHTML = '<span class="close-button" id="closePopup">✖</span>';

  // Create a div for images
  const imageContainer = document.createElement("div");
  imageContainer.classList.add("popup-images");

  // Add front image
  const frontImg = document.createElement("img");
  frontImg.src = resolveAssetPath(frontSrc);
  frontImg.alt = "Front Image";
  frontImg.loading = "lazy";
  imageContainer.appendChild(frontImg);

  // Add back image if available
  if (backSrc && backSrc !== "null" && backSrc !== "") {
    const backImg = document.createElement("img");
    backImg.src = resolveAssetPath(backSrc);
    backImg.alt = "Back Image";
    backImg.loading = "lazy";
    imageContainer.appendChild(backImg);
  }

  popupContent.appendChild(imageContainer);

  // Add description
  if (description && description.trim() !== "") {
    const descParagraph = document.createElement("p");
    descParagraph.textContent = description;
    popupContent.appendChild(descParagraph);
  }

  // Only open the popup when an image is clicked
  setTimeout(() => {
    popup.style.display = "flex";
  }, 10);

  // Close event
  document.getElementById('closePopup').onclick = closePopup;
}

// Function to close popup properly
function closePopup() {
  const popup = document.getElementById('popup');
  popup.style.display = "none";
}

// Close popup when clicking outside the content
const popup = document.getElementById('popup');
popup.onclick = (event) => {
  if (event.target === popup) {
    closePopup();
  }
};

// Function to search images by tags
function searchAllImages() {
  const query = document.getElementById("searchBar").value.toLowerCase().trim();
  const galleryDiv = document.querySelector('.image-gallery');
  galleryDiv.innerHTML = ""; // Clear previous content

  if (query === "") return; // If search is empty, do nothing

  const queryTags = query.split(" "); // Allow multiple keywords
  let matchedImages = [];

  // Loop through all categories and search by tags
  Object.keys(imageData).forEach(category => {
    const images = imageData[category];

    images.forEach(item => {
      const isEncountered = item.Encountered && item.Encountered.toLowerCase() === "yes";

      const matchesAnyTag = queryTags.some(tag =>
        item.tags.some(itemTag => itemTag.toLowerCase().includes(tag))
      );

      if (matchesAnyTag) {
        matchedImages.push({ ...item, isEncountered });
      }
    });
  });

  // Display results
  matchedImages.forEach(item => {
    const card = document.createElement("div");
    card.classList.add("card-pair");
    if (!item.isEncountered) {
      card.classList.add("unencountered");
    }

    const statusBadge = document.createElement("div");
    statusBadge.classList.add("status-badge");
    statusBadge.textContent = item.isEncountered ? "Encountered" : "Not encountered";
    card.appendChild(statusBadge);

    // Front image
    const frontImg = document.createElement("img");
    frontImg.src = resolveAssetPath(item.src);
    frontImg.alt = "Gallery Image";
    frontImg.classList.add("gallery-image");
    frontImg.loading = "lazy";
    frontImg.style.cursor = "pointer";

    // Click event to open the popup
    frontImg.onclick = () => openPopup(item.src, item.backImage, item.description);

    card.appendChild(frontImg);
    galleryDiv.appendChild(card);
  });

  // Show a message if no matches are found
  if (matchedImages.length === 0) {
    galleryDiv.innerHTML = "<p>No matches found.</p>";
  }
}

// Load data on page load
document.addEventListener("DOMContentLoaded", loadData);
