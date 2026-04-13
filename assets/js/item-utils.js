// Shared helpers used by both items.js and location.js

export function parseTags(tagStr) {
  if (!tagStr) return [];
  return tagStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
}

export function formatGold(gp) {
  gp = parseFloat(gp) || 0;
  if (gp >= 1) {
    const r = Math.round(gp * 10) / 10;
    return `${r % 1 === 0 ? r : r.toFixed(1)} gp`;
  }
  const sp = gp * 10;
  if (sp >= 1) return `${Math.round(sp)} sp`;
  return `${Math.round(gp * 100)} cp`;
}
