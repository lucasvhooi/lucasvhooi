// ── Climate schema + defaults ───────────────────────────────────────────────
// Climates have a FIXED set of fields (below). DMs edit the values, never the
// labels — so the keys are stable and code can read them later (e.g. a travel
// planner reading `climate.temp` / `climate.precipitation` / `climate.terrain`).
//
// Climate object shape:
//   { id, name, color, temp, precipitation, terrain }
//
// The base set is seeded into every campaign: new campaigns get it at creation
// (campaigns page); existing campaigns are backfilled on first map visit
// (map.js) if they have none yet. Keep this the single source of truth.

// Precipitation scale — driest → wettest. The travel planner can treat the
// index as an ordinal. Edit/extend freely; values are stored verbatim.
export const PRECIPITATION_OPTIONS = [
  'Arid / None',
  'Very low',
  'Low',
  'Low (snow)',
  'Moderate',
  'Seasonal',
  'Variable',
  'High',
  'Very high',
];

// Terrain building blocks — DMs combine several of these to describe any
// region. Stored as a comma-separated list (e.g. "Forest, Hills"). DMs can also
// add custom terrains, so the list is a starting palette, not a hard limit.
export const TERRAIN_OPTIONS = [
  'Forest', 'Dense forest', 'Jungle', 'Hills', 'Mountains', 'Alpine peaks',
  'Cliffs', 'Plateau', 'Plains', 'Grassland', 'Prairie', 'Savanna',
  'Scrubland', 'Desert', 'Sand dunes', 'Rocky', 'Badlands', 'Canyon',
  'Caverns', 'Underground', 'Volcanic', 'Ashlands', 'Swamp', 'Marsh',
  'Bog', 'Wetland', 'Tundra', 'Frozen plains', 'Ice', 'Glacier',
  'Snowfields', 'Coast', 'Beach', 'Cliffside shore', 'Ocean', 'Lake',
  'River', 'Islands', 'Farmland', 'Forest clearings', 'Urban', 'Ruins',
];

// The three fixed fields. `key` is the property on the climate object and must
// stay stable; `label` is display-only and can be reworded freely. `type`
// drives the editor control (see map.js renderClimateList):
//   range       → two numeric inputs (min/max) stored as "min–max{unit}"
//   select      → single pick from `options`
//   multiselect → any number of `options` (+ custom), stored comma-separated
export const CLIMATE_FIELDS = [
  { key: 'temp',          label: 'Avg Temperature', type: 'range',       unit: '°C' },
  { key: 'precipitation', label: 'Precipitation',   type: 'select',      placeholder: 'Select…',      options: PRECIPITATION_OPTIONS },
  { key: 'terrain',       label: 'Terrain',         type: 'multiselect', placeholder: 'Add terrain…', options: TERRAIN_OPTIONS },
];

const _DEFS = [
  { id: 'clm_temperate', name: 'Temperate',           color: '#2ecc71', temp: '10–20°C',  precipitation: 'Moderate',   terrain: 'Forest, Hills' },
  { id: 'clm_tropical',  name: 'Tropical Rainforest', color: '#1abc9c', temp: '25–35°C',  precipitation: 'Very high',  terrain: 'Jungle, Dense forest' },
  { id: 'clm_desert',    name: 'Desert',              color: '#f1c40f', temp: '0–45°C',   precipitation: 'Very low',   terrain: 'Sand dunes, Rocky' },
  { id: 'clm_polar',     name: 'Arctic / Polar',      color: '#00bcd4', temp: '-40–0°C',  precipitation: 'Low (snow)', terrain: 'Ice, Glacier' },
  { id: 'clm_tundra',    name: 'Tundra',              color: '#78909c', temp: '-15–10°C', precipitation: 'Low',        terrain: 'Frozen plains, Tundra' },
  { id: 'clm_grassland', name: 'Grassland / Plains',  color: '#8bc34a', temp: '5–30°C',   precipitation: 'Moderate',   terrain: 'Plains, Grassland' },
  { id: 'clm_alpine',    name: 'Mountain / Alpine',   color: '#9b59b6', temp: '-10–15°C', precipitation: 'Variable',   terrain: 'Mountains, Alpine peaks' },
  { id: 'clm_swamp',     name: 'Swamp / Wetland',     color: '#8d6e63', temp: '15–30°C',  precipitation: 'High',       terrain: 'Swamp, Marsh' },
  { id: 'clm_coastal',   name: 'Coastal',             color: '#3498db', temp: '10–25°C',  precipitation: 'Moderate',   terrain: 'Coast, Cliffs' },
  { id: 'clm_savanna',   name: 'Savanna',             color: '#e67e22', temp: '20–35°C',  precipitation: 'Seasonal',   terrain: 'Savanna, Scrubland' },
];

// Returns a fresh object keyed by id — callers may write it directly to Firebase.
export function buildDefaultClimates() {
  const out = {};
  _DEFS.forEach(d => {
    out[d.id] = { id: d.id, name: d.name, color: d.color };
    CLIMATE_FIELDS.forEach(f => { out[d.id][f.key] = d[f.key] || ''; });
  });
  return out;
}
