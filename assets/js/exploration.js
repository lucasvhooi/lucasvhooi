// Object to store loaded image data
let imageData = {};

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
  // Read admin flag: if true, show all items; if false, show only those with Encountered="yes"
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  images.forEach(item => {
    // If not admin, skip this item unless Encountered equals "yes" (case‑insensitive)
    if (!isAdmin && (!item.Encountered || item.Encountered.toLowerCase() !== "yes")) {
      return; // Skip this item in player mode
    }

    const card = document.createElement("div");
    card.classList.add("card-pair");

    // Front image
    const frontImg = document.createElement("img");
    frontImg.src = item.src;
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
  frontImg.src = frontSrc;
  frontImg.alt = "Front Image";
  frontImg.loading = "lazy";
  imageContainer.appendChild(frontImg);

  // Add back image if available
  if (backSrc && backSrc !== "null" && backSrc !== "") {
    const backImg = document.createElement("img");
    backImg.src = backSrc;
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

  // Read admin flag so that in player mode, only encountered items are searched
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const queryTags = query.split(" "); // Allow multiple keywords
  let matchedImages = [];

  // Loop through all categories and search by tags
  Object.keys(imageData).forEach(category => {
    const images = imageData[category];

    images.forEach(item => {
      // If not admin, skip if item is not encountered
      if (!isAdmin && (!item.Encountered || item.Encountered.toLowerCase() !== "yes")) return;

      const matchesAnyTag = queryTags.some(tag =>
        item.tags.some(itemTag => itemTag.toLowerCase().includes(tag))
      );

      if (matchesAnyTag) {
        matchedImages.push(item);
      }
    });
  });

  // Display results
  matchedImages.forEach(item => {
    const card = document.createElement("div");
    card.classList.add("card-pair");

    // Front image
    const frontImg = document.createElement("img");
    frontImg.src = item.src;
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
