---
name: The Legends of Essolis
description: A campaign companion for adventurers and their DM — every session, at the table.
colors:
  amber-wax-seal: "#ffcc66"
  tarnished-bronze: "#c8a45c"
  old-ivory: "#f4e6d7"
  deep-crypt: "#1a1a1a"
  smoked-walnut: "#2c1a0a"
  smoked-walnut-alt: "#3e2b1b"
  crypt-surface: "#181008"
  leather-border: "#3a2510"
  muted-smoke: "#888888"
  deep-smoke: "#555555"
  hazard-red: "#e05050"
  health-green: "#66bb6a"
  rarity-common: "#9e9e9e"
  rarity-uncommon: "#4caf50"
  rarity-rare: "#2196f3"
  rarity-very-rare: "#9c27b0"
  rarity-legendary: "#ff9800"
typography:
  display:
    fontFamily: "'IM Fell English', 'Garamond', serif"
    fontSize: "clamp(1.8rem, 4vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "'IM Fell English', 'Garamond', serif"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "'IM Fell English', 'Garamond', serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "'Garamond', serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  "2xl": "64px"
  "3xl": "96px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, #3a2008 0%, #5a3410 100%)"
    textColor: "{colors.amber-wax-seal}"
    rounded: "{rounded.md}"
    padding: "9px 22px"
  button-primary-hover:
    backgroundColor: "linear-gradient(135deg, #4a2c0e 0%, #6a4018 100%)"
    textColor: "{colors.amber-wax-seal}"
    rounded: "{rounded.md}"
    padding: "9px 22px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-smoke}"
    rounded: "{rounded.md}"
    padding: "9px 22px"
  button-ghost-hover:
    backgroundColor: "transparent"
    textColor: "{colors.old-ivory}"
    rounded: "{rounded.md}"
    padding: "9px 22px"
  button-dm:
    backgroundColor: "rgba(255,204,102,0.12)"
    textColor: "{colors.amber-wax-seal}"
    rounded: "{rounded.sm}"
    padding: "8px 18px"
  button-danger:
    backgroundColor: "rgba(200,50,50,0.12)"
    textColor: "{colors.hazard-red}"
    rounded: "{rounded.md}"
    padding: "9px 22px"
  input-default:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.old-ivory}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  filter-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted-smoke}"
    rounded: "{rounded.pill}"
    padding: "5px 16px"
  filter-tab-active:
    backgroundColor: "rgba(255,204,102,0.1)"
    textColor: "{colors.amber-wax-seal}"
    rounded: "{rounded.pill}"
    padding: "5px 16px"
  item-card:
    backgroundColor: "{colors.crypt-surface}"
    textColor: "{colors.old-ivory}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
---

# Design System: The Legends of Essolis

## 1. Overview

**Creative North Star: "The Archivist's Table"**

This is a D&D campaign companion used during live sessions at the table. Everything on the surface has a reason to be there. The palette is deep brown and amber because those are the colors of leather bindings, ink on vellum, and a single candle over old paper — not as a genre gesture, but as the literal physical context of use. The fonts are serious without being theatrical. IM Fell English carries the weight of a world with 400 years of accumulated history; Garamond moves text without calling attention to itself. The system doesn't gesture at a fantasy world — it exists inside one.

The UI recedes where it should and surfaces what matters. Spacing and typographic contrast do the structural work; color accents signal action and status, never structure. A crowded surface is not more atmospheric — it is harder to read at 11pm when someone asks "wait, do I have that scroll?" The design principle from PRODUCT.md is non-negotiable: legibility over decoration, every ornamental choice must survive mid-session use.

This system explicitly rejects: generic SaaS dashboards (white card grids, blue primary actions, Inter/system fonts, productivity-app density), children's fantasy aesthetics (bright primary colors, rounded bubble fonts, playful cartoonish ornaments), and anything that reads like a spreadsheet wearing a costume.

**Key Characteristics:**
- Single amber accent (Amber Wax Seal) against a range of brown-black neutrals from vault to near-void
- Serif display type (IM Fell English) for headings; Garamond for body; sans-serif strictly for metadata labels and badges
- Ambient shadow present at rest on cards; elevated shadow on hover; heavy structural shadow for modals
- Rarity as a semantic color system (common through legendary) — five distinct hues, never repurposed
- Touch-first on mobile: 44px minimum targets, 16px minimum font sizes on all inputs

## 2. Colors: The Candlelit Palette

One primary accent against a cascade of warm-dark neutrals. Five semantic rarity hues for items and spells. Amber never shares its role.

### Primary
- **Amber Wax Seal** (#ffcc66): The sole interactive signal. Active tabs, focus rings, button borders, headings, and accent text. When it appears, it means something: action, selection, or status. Its scarcity is the mechanism — when everything glows, nothing does.
- **Tarnished Bronze** (#c8a45c): The attunement color. Slightly darker and less saturated than Amber Wax Seal. Used exclusively for attuned item borders, attuned glow shadows, and warm hover states that want weight without full amber saturation. Not interchangeable with Amber Wax Seal.

### Neutral
- **Old Ivory** (#f4e6d7): Primary text. Warm, not pure white — reads like parchment under candlelight.
- **Deep Crypt** (#1a1a1a): Page background. Not pure black — slightly warm, a tinted void.
- **Smoked Walnut** (#2c1a0a): Primary panel and card background. The main surface above the crypt.
- **Smoked Walnut Alt** (#3e2b1b): Secondary panel variant. Section headers, alt-panel backgrounds.
- **Crypt Surface** (#181008): Deepest surface. Modal headers, nav gradient bottom, inner sections within modals.
- **Leather Border** (#3a2510): Default border on inputs, cards, and dividers. The color of old leather stitching.
- **Muted Smoke** (#888): Secondary text, form labels, tab defaults, placeholder descriptions.
- **Deep Smoke** (#555): Tertiary text, disabled states, footer metadata, very muted annotations.

### Secondary
- **Health Green** (#66bb6a): Encounter status, success states, DM notes (notes field uses a green tint background). Belongs to the DM's domain.
- **Hazard Red** (#e05050): Danger actions — delete buttons, error states, critical status.

### Tertiary (Rarity System)
A purpose-built semantic palette for item and spell rarity. These five colors are normative signal, not aesthetic choice.
- Common: #9e9e9e (neutral grey)
- Uncommon: #4caf50 (forest green)
- Rare: #2196f3 (medium blue)
- Very Rare: #9c27b0 (deep violet)
- Legendary: #ff9800 (bright orange)

### Named Rules
**The One Voice Rule.** Amber Wax Seal is used on 10% or less of any screen at rest. Reach for Old Ivory or Muted Smoke first; amber marks action and current state, nothing else.

**The Rarity Covenant.** The five rarity colors exist solely for item and spell rarity. Never borrow a rarity color for another status, category, or decorative role. The moment legendary orange appears on a non-legendary context, the system breaks.

## 3. Typography

**Display Font:** IM Fell English (with Garamond, serif as fallback)
**Body Font:** Garamond (with serif as fallback)
**Label Font:** System sans-serif — for metadata badges, uppercase form labels, and stat chips only

**Character:** IM Fell English carries the texture of 17th-century scholarship — slight irregularity, a little gravity, nothing slick. Garamond is the archivist's workhorse: warm, legible, unhurried. The two serif voices are calibrated so headings announce themselves and body text moves without friction. Sans-serif is the third register, reserved for information that must be read fast and small: rarity tags, item type badges, form field headers at 10–11px.

### Hierarchy
- **Display** (regular, clamp(1.8rem, 4vw, 2.6rem), line-height 1.1, tracking 0.04em): Page hero titles. IM Fell English. Amber Wax Seal color. Used in `.page-hero__title`.
- **Headline** (regular, 1.7rem, line-height 1.2): Major screen headings — login title "Enter the Realm," section heroes. IM Fell English.
- **Title** (regular, 1.2–1.5rem, line-height 1.3): Modal headers, character names in detail view, item names in expanded state. IM Fell English. Amber or Old Ivory.
- **Body** (regular, 13–15px, line-height 1.6): Card descriptions, lore entries, form content, running prose. Garamond. Cap at 65ch where prose appears.
- **Label** (regular, 10–11px, letter-spacing 0.07–0.1em, ALL CAPS): Item type badges, form field headers, attunement labels, rarity chips. Sans-serif only. Never IM Fell English in all-caps.

### Named Rules
**The Serif Hierarchy Rule.** IM Fell English marks importance (headings, titles, named things). Garamond carries content (body, buttons, nav links). Sans-serif signals metadata (badges, caps labels, stat rows). Mix them only within these assignments.

**The Label Case Rule.** Uppercase + letter-spacing is reserved for metadata chips, form field headers, and structural labels. Running prose is never uppercased. A heading in all-caps with 0.1em tracking is a label, not a title.

## 4. Elevation

Cards sit on Smoked Walnut surfaces with a soft ambient shadow present at rest — not heavy, but enough to register the layering. Hover deepens the shadow and shifts the border. Modals cast a heavy structural shadow that grounds them above everything else. The nav bar casts a downward bleed that anchors it to the top of the viewport.

### Shadow Vocabulary
- **Panel ambient** (`box-shadow: 0 4px 10px rgba(0,0,0,0.4)`): DM section cards, panel containers at rest.
- **Hero diffuse** (`box-shadow: 0 6px 14px rgba(0,0,0,0.45)`): Hero containers and the login card — present at rest.
- **Card hover** (`box-shadow: 0 4px 20px rgba(0,0,0,0.4)` — `0 6px 22px rgba(0,0,0,0.5)`): Item cards and character cards on `:hover`. The border also deepens simultaneously.
- **Modal drop** (`box-shadow: 0 8px 40px rgba(0,0,0,0.7)` — `0 12px 48px rgba(0,0,0,0.8)`): Modals and floating panels. Structural, not decorative.
- **Nav bleed** (`box-shadow: 0 2px 16px rgba(0,0,0,0.6)`): Sticky nav bar. Downward only; anchors the bar to the top.
- **Amber glow** (`box-shadow: 0 0 12–24px rgba(200,164,92,0.2–0.5)`): Active/attuned/loading states only. Amber-tinted, never on neutral surfaces.

### Named Rules
**The Glow Restriction.** The amber glow is reserved for semantically active surfaces: attuned items, loading animations, confirmed selections. It is not a hover affordance for general cards or buttons — standard shadow deepening handles hover.

**The Flat-By-Default Rule for Inputs.** Form inputs carry no shadow at rest. Focus is communicated by the border shifting to Amber Wax Seal alone — no focus ring glow, no shadow transition. The border change is the signal.

## 5. Components

Understated craft: components recede and let content lead. They respond to interaction without demanding attention.

### Buttons
- **Shape:** Gently curved (7px radius, near `--rounded-md`). Slightly less than cards, more than chips.
- **Primary** (`btn-primary`): Gradient dark-brown background (linear-gradient from #3a2008 to #5a3410), 1px Tarnished Bronze border (#c8a45c), Amber Wax Seal text. Garamond 14px. Padding 9px 22px. Hover: gradient lightens one step, amber glow shadow at 0.2 opacity.
- **Ghost** (`btn-ghost`): Transparent background, Leather Border (#3a2510), Muted Smoke text. Hover: border lightens to #6a4a2a, text shifts to Old Ivory. The default "cancel" affordance.
- **Danger** (`btn-danger`): Hazard Red tint background (rgba 0.12), Hazard Red border (rgba 0.4), Hazard Red text. Hover: tint deepens to 0.22, border to full #e05050.
- **DM action** (`dm-btn`): Amber Wax Seal ghost — rgba(255,204,102,0.12) background, rgba accent border, amber text. 6px radius. DM-only administrative actions. Min-height 44px on mobile.
- **Login** (`login-btn`): Wider gradient (starts #4a2c0a), full amber border, IM Fell English 16px, 13px padding. Loading state: amber glow pulse animation at 1.4s ease-in-out.
- **Active scale:** All buttons scale to `scale(0.96)` on `:active`. Eased with `--ease-out-quart`.

### Filter Chips
Pill shape (border-radius: 20px). Garamond 13px. Min-height 44px on mobile.
- **Default:** Transparent, Leather Border, Muted Smoke text.
- **Hover:** Border and text shift to Amber Wax Seal.
- **Active:** rgba(255,204,102,0.1) amber-tint background, full amber border and text.
- Separated variant tabs (spells, lore) use a 1px divider rule before them (`::before` pseudo-element) rather than a gap.

### Cards
Cards are the inventory's primary affordance — justified because items are genuinely the content, not a navigation pattern.
- **Item card** (`inv-card`): 12px radius. Background: `color-mix(in srgb, var(--rc) 22%, #1a1008)` — rarity-tinted so every item reads its tier at a glance. Border similarly rarity-tinted. Ambient shadow at rest; border deepens and shadow expands on hover. **Attuned variant:** 2px amber border (#c8a45c), outer amber glow ring `0 0 0 2px rgba(200,164,92,0.3)`, gradient background tint.
- **Character card** (`char-card`): 180px portrait image (object-fit: cover, top-anchored) above a left-aligned text body. Hover lifts 2px and deepens shadow. Non-encountered characters rendered at 55% opacity.
- **Nested cards are prohibited.** A card inside a card is always wrong.

### Inputs / Fields
- **Style:** rgba(255,255,255,0.04) background (near-invisible), Leather Border (#3a2510), 7–8px radius.
- **Focus:** Border shifts to Amber Wax Seal. No shadow, no glow — the border change alone is the signal.
- **Placeholder:** Deep Smoke (#555) — present but receding.
- **Font:** Garamond, minimum 16px on all inputs (iOS auto-zoom prevention is a hard requirement).
- **Labels:** Sans-serif, 11px, ALL CAPS, 0.08em tracking, Muted Smoke.

### Navigation
Sticky top bar with dark gradient background (Crypt Surface → near-crypt). Garamond links, 15px, #c9a87a default. Animated underline (`::after`, scaleX from 0 to 1, `--ease-out-quart`). Color shifts to Amber Wax Seal on hover and active. Logo filtered to amber using CSS filter.

On mobile: collapses to a right-side drawer at max-width 768px. Fixed hamburger button (top-right, 200 z-index) with 3-bar to X animation. Drawer slides in via `translateX(100%) → translateX(0)`. Semi-transparent overlay backdrop closes on tap.

### Rarity Chips (Signature Component)
Small pill badges (10–11px sans-serif, 10px border-radius, letter-spacing 0.04em) rendered inline on item cards, filter buttons, and add-item modals. Each of the five rarities has a distinct border, text, and background-tint color (all from the Rarity Covenant palette). Chips are rendered by CSS classes (`rarity-tag-common` through `rarity-tag-legendary`) applied based on data. The system is strictly semantic — do not use rarity chip colors for other UI patterns.

## 6. Do's and Don'ts

### Do:
- **Do** use Amber Wax Seal (#ffcc66) exclusively for interactive signals: active states, focus borders, action CTAs. Let Old Ivory (#f4e6d7) carry text.
- **Do** keep the dark-to-darker gradient pattern for hero sections, the nav, and modal headers (from ~#2a1505 toward #1c0e03 or #181008).
- **Do** use IM Fell English for headings and Garamond for body text. Reserve sans-serif for metadata labels, badges, and stat chips at 10–11px.
- **Do** enforce `min-height: 44px` on every interactive element rendered on mobile.
- **Do** enforce `font-size: 16px` minimum on all `<input>`, `<select>`, and `<textarea>` elements to prevent iOS auto-zoom.
- **Do** use the rarity color system (common through legendary) for item and spell rarity only. Five colors, one purpose.
- **Do** use `var(--ease-out-quart)` or `var(--ease-out-expo)` for all UI transitions. No bounce, no elastic, no linear.
- **Do** use `prefers-reduced-motion` to disable all animations for users who need it — already wired globally in base.css.
- **Do** express depth through shadow vocabulary and color-step layering (Crypt → Walnut → Surface). Don't flatten with overlit or high-chroma surfaces.
- **Do** Use game-icons for fantasy elements and lucide for UI/system elements, always rendered as Iconify class names (e.g. i-game-icons-sword, i-lucide-settings).

### Don't:
- **Don't** use white cards, blue primary actions, Inter/system fonts, or generic SaaS UI patterns. This is not a productivity app; the interface is part of the world.
- **Don't** use children's fantasy aesthetics: bright primary colors, rounded bubble fonts, decorative illustrations that consume functional space.
- **Don't** build anything that feels like a spreadsheet wearing a costume. If the only selling point is tabular density, reconsider the layout.
- **Don't** apply the amber glow shadow (`0 0 Xpx rgba(200,164,92,Y)`) to neutral cards or buttons at rest. The glow signals attuned items, loading states, and confirmed selections only.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts. Use full borders, background tints, or leading icons instead.
- **Don't** apply `background-clip: text` with a gradient to create gradient text. Use Amber Wax Seal in solid form; reach for scale or weight for emphasis.
- **Don't** add decoration to surfaces that are performing their function. The atmosphere comes from typography, color layering, and proportion — cramming every surface with ornaments destroys legibility.
- **Don't** reorder the six sections in this file or rename their headers. Tooling that parses DESIGN.md depends on exact header strings.
- **Don't** nest cards. A card inside a card is always a layout failure. Use inline expansion, modals, or progressive disclosure instead.
- **Don't** use emojis anywhere in the UI, text content, or code. Emojis are strictly forbidden and must always be replaced with Iconify icons via the installed plugin system. 
