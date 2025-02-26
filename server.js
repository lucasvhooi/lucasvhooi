const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public")); // your client files (HTML, JS, CSS, etc.) are in the "public" folder

// Path to our text file that stores markers as JSON
const markersFile = path.join(__dirname, "markers.txt");

// Load markers from the text file, or initialize as an empty array if not present
let markers = [];
if (fs.existsSync(markersFile)) {
  try {
    markers = JSON.parse(fs.readFileSync(markersFile, "utf8"));
  } catch (err) {
    console.error("Error parsing markers.txt, initializing empty markers array", err);
    markers = [];
  }
}

function saveMarkersToFile() {
  fs.writeFileSync(markersFile, JSON.stringify(markers, null, 2));
}

// GET: Return all markers
app.get("/api/markers", (req, res) => {
  res.json(markers);
});

// POST: Add a new marker
app.post("/api/markers", (req, res) => {
  const marker = req.body;
  markers.push(marker);
  saveMarkersToFile();
  res.json(marker);
});

// PUT: Update an existing marker
app.put("/api/markers/:id", (req, res) => {
  const markerId = req.params.id;
  const updatedMarker = req.body;
  const index = markers.findIndex(m => m.id === markerId);
  if (index !== -1) {
    markers[index] = updatedMarker;
    saveMarkersToFile();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Marker not found" });
  }
});

// DELETE: Remove a marker
app.delete("/api/markers/:id", (req, res) => {
  const markerId = req.params.id;
  markers = markers.filter(m => m.id !== markerId);
  saveMarkersToFile();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
