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

// ── Tag normalisation ─────────────────────────────────────────────────────────
// ~15 canonical display categories. Raw tags in Firebase are untouched so loot
// generation and shop pool matching continue to work against the original values.

export const CANONICAL_TAGS = new Set([
  "weapon", "armor", "shield", "potion", "scroll",
  "wand", "ring", "magic", "tool",
  "jewellery", "ingredient", "poison", "currency",
  "clothing", "ammunition", "ranged", "animal", "plants", "book",
]);

const RARITY_KW = new Set(["common", "uncommon", "rare", "very rare", "legendary"]);

// Maps granular raw tags → a canonical category (null = drop from display)
const TAG_NORMALIZE = {
  // Armor sub-types
  "light": "armor", "medium": "armor", "heavy": "armor",
  // Weapon damage / property tags
  "slashing": "weapon", "piercing": "weapon", "bludgeoning": "weapon",
  "finesse": "weapon", "thrown": "weapon", "crude": "weapon",
  // Jewellery / valuables
  "valuable": "jewellery", "gem": "jewellery", "ruby": "jewellery",
  "diamond": "jewellery", "jewelry": "jewellery", "art": "jewellery",
  "necklace": "jewellery", "silver": "jewellery", "gold": "jewellery",
  // Crafting ingredients / monster parts
  "material": "ingredient", "crafting": "ingredient", "alchemy": "ingredient",
  "undead": "ingredient", "fiend": "ingredient",
  "dragon": "ingredient", "goblinoid": "ingredient", "orc": "ingredient",
  "monster": "ingredient", "giant": "ingredient", "drow": "ingredient",
  "demon": "ingredient", "devil": "ingredient", "vampire": "ingredient",
  "hide": "ingredient", "scale": "ingredient", "trophy": "ingredient",
  "dark": "ingredient",
  // Animal parts → animal
  "beast": "animal", "pelt": "animal", "fang": "animal", "claw": "animal",
  // Plants / herbs
  "herb": "plants", "flora": "plants", "plant": "plants",
  // Books / tomes
  "books": "book", "tome": "book", "manual": "book", "journal": "book",
  // Potion / healing
  "healing": "potion", "medicine": "potion",
  // Scroll sub-types
  "spell": "scroll", "fire": "scroll",
  // Wands & staves
  "staff": "wand",
  // Magic item sub-types (not wand/ring)
  "cloak": "magic", "boots": "magic", "amulet": "magic",
  "container": "magic", "protection": "magic",
  "constitution": "magic", "movement": "magic", "arcane": "magic",
  // Tool sub-types
  "utility": "tool", "stealth": "tool",
  // Drop noisy-but-meaningless tags
  "consumable": null, "melee": null, "magic": "magic",
};

// Returns deduplicated canonical tags for an item (used in filter & card display).
// Raw tags are preserved in Firebase; this is display-only.
export function getDisplayTags(tagStr) {
  const seen = new Set();
  const result = [];
  parseTags(tagStr)
    .filter(t => !RARITY_KW.has(t))
    .forEach(t => {
      const canonical = CANONICAL_TAGS.has(t) ? t : (TAG_NORMALIZE[t] ?? null);
      if (canonical && !seen.has(canonical)) {
        seen.add(canonical);
        result.push(canonical);
      }
    });
  return result;
}
