import { readFileSync, writeFileSync } from 'fs';

const csv = readFileSync('dndbeyond_equips.csv', 'utf8');
const lines = csv.trim().split('\n').slice(1); // skip header

function slugId(name) {
  return 'dnd_' + name.toLowerCase()
    .replace(/['"()]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function parsePrice(str) {
  if (!str || !str.trim()) return null;
  const n = parseFloat(str.trim());
  return isNaN(n) ? null : n;
}

function parseWeight(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim();
  // Skip date-formatted values like "01/04/21" (data quality issues in CSV)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) return null;
  // Handle fractions like "1 1/2" or "1/4"
  const frac = s.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  if (frac) {
    const whole = parseInt(frac[1] || '0');
    return whole + parseInt(frac[2]) / parseInt(frac[3]);
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const TYPE1_TO_TAGS = {
  'Simple Melee Weapon':    'weapon,simple,melee',
  'Martial Melee Weapon':   'weapon,martial,melee',
  'Simple Ranged Weapon':   'weapon,simple,ranged',
  'Martial Ranged Weapon':  'weapon,martial,ranged',
  'Firearms Ranged Weapon': 'weapon,firearm,ranged',
  'Light Armor':            'armor,light',
  'Medium Armor':           'armor,medium',
  'Heavy Armor':            'armor,heavy',
  'Shield':                 'armor,shield',
  'Adventuring Gear':       'gear',
  'Tool':                   'tool',
  'Equipment Pack':         'gear,pack',
  'Mount':                  'mount',
  'Vehicle (Land)':         'vehicle,land',
  'Vehicle (Water)':        'vehicle,water',
  'Ammunition':             'ammunition',
  'Arcane Focus':           'focus,arcane',
  'Druidic Focus':          'focus,druidic',
  'Holy Symbol':            'focus,holy',
  'Potion':                 'potion,consumable',
  'Poison':                 'poison,consumable',
  'Gemstone':               'gemstone,valuable',
};

// PHB / sourcebook prices (gp) for items the CSV left blank
// Copper = 0.01 gp, Silver = 0.1 gp
const PRICE_OVERRIDES = {
  // ── Adventuring Gear (PHB p.148-153) ──
  "Alms Box":                    1,
  "Barding":                     40,    // varies; ~40 gp for leather barding
  "Basket":                      0.04,
  "Blanket":                     0.5,
  "Block of Incense":            1,
  "Boots":                       1,
  "Bucket":                      0.05,
  "Candle":                      0.01,
  "Censer":                      5,
  "Chalk (1 piece)":             0.01,
  "Clothes, Common":             0.5,
  "Feed (per day)":              0.05,
  "Flask or Tankard":            0.02,
  "Helm":                        5,
  "Ink Pen":                     0.02,
  "Insect Repellent-Incense":    1,
  "Insect Repellent-Salve":      1,
  "Jug or Pitcher":              0.02,
  "Ladder (10 foot)":            0.1,
  "Lamp":                        0.5,
  "Little Bag of Sand":          0.01,
  "Mess Kit":                    0.2,
  "Oil (flask)":                 0.1,
  "Paper (one sheet)":           0.2,
  "Parchment (one sheet)":       0.1,
  "Piton":                       0.05,
  "Pole (10-foot)":              0.05,
  "Pouch":                       0.5,
  "Rations (1 day)":             0.5,
  "Sack":                        0.01,
  "Sealing Wax":                 0.5,
  "Signal Whistle":              0.05,
  "Small Knife":                 0.1,
  "Soap":                        0.02,
  "Stake (Wooden)":              0.01,
  "String":                      0.01,
  "Tej":                         1,
  "Tinderbox":                   0.5,
  "Torch":                       0.01,
  "Vestments":                   5,
  "Waterskin":                   0.2,
  "Whetstone":                   0.01,
  // ── Weapons ──
  "Boomerang":                   0.03,
  "Club":                        0.1,
  "Dart":                        0.05,
  "Greatclub":                   0.2,
  "Javelin":                     0.5,
  "Quarterstaff":                0.2,
  "Sling":                       0.1,
  // ── Ammunition ──
  "Sling Bullets":               0.04,
  // ── Tools ──
  "Dice Set":                    0.1,
  "Playing Card Set":            0.5,
  "Whistle-Stick":               0.1,
  // ── Focuses ──
  "Arcane Focus":                10,
  "Druidic Focus":               5,
  "Holy Symbol":                 5,
  // ── Exotic / sci-fi (no official price — reasonable estimates) ──
  "Antimatter Rifle":            2000,
  "Bad News (Exandria)":         300,
  "Blasting Powder":             75,
  "Bullets, Modern":             1,
  "Dynamite (Stick)":            50,
  "Eberron Dragonshard":         100,
  "Energy Cell":                 100,
  "Explosive Seed":              50,
  "Grenade Launcher":            500,
  "Grenade, Fragmentation":      100,
  "Grenade, Smoke":              75,
  "Hand Mortar (Exandria)":      300,
  "Khyber Dragonshard":          100,
  "Laser Pistol":                1000,
  "Laser Rifle":                 2000,
  "Pistol, Automatic":           500,
  "Revolver":                    400,
  "Rifle, Automatic":            1500,
  "Rifle, Hunting":              1200,
  "Shotgun":                     800,
  "Siberys Dragonshard":         500,
  "Tangler Grenade":             50,
  // ── Poisons (no official price) ──
  "Blood of the Lycanthrope (Injury)": 150,
  "Dragon's Blood":              200,
  "Dust of the Mummy (Inhaled)": 250,
  "Thessaltoxin (Ingested or Injury)": 300,
};

function getRarity(type1, price) {
  if (type1 === 'Gemstone') {
    if (!price) return 'common';
    if (price >= 5000) return 'very rare';
    if (price >= 1000) return 'rare';
    if (price >= 100)  return 'uncommon';
    return 'common';
  }
  if (type1 === 'Poison') return 'uncommon';
  return 'common';
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

const seen = new Set();
const items = [];

for (const line of lines) {
  if (!line.trim()) continue;
  const [name, type1, , weightStr, priceStr] = parseCsvLine(line);
  if (!name) continue;

  let id = slugId(name);
  let suffix = 2;
  while (seen.has(id)) id = slugId(name) + '_' + suffix++;
  seen.add(id);

  const price  = parsePrice(priceStr) ?? PRICE_OVERRIDES[name] ?? null;
  const weight = parseWeight(weightStr);
  const rarity = getRarity(type1, price);
  const tags   = TYPE1_TO_TAGS[type1] || 'gear';

  const item = { id, name, rarity, tags, shopAvailable: true };
  if (price  !== null) item.price  = price;
  if (weight !== null) item.weight = weight;

  items.push(item);
}

const out = `// Auto-generated from dndbeyond_equips.csv — do not edit by hand
export const EQUIP_SEED = ${JSON.stringify(items, null, 2)};
`;
writeFileSync('public/assets/js/equip-seed.js', out);
console.log(`Wrote ${items.length} items to public/assets/js/equip-seed.js`);
