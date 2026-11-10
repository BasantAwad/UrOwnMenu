# Design System, Color Palettes and Logo Handling

## 1. Design philosophy

Public menus must feel art-directed for each restaurant. Avoid generic SaaS aesthetics, identical cards, random gradients, arbitrary floating images, excessive rounded boxes, and weak typography. The restaurant's brand leads; templates provide composition and interaction.

## 2. Two identities

**UrOwnMenu platform identity:** until its brand mark is approved, use a restrained text wordmark “UrOwnMenu” and replaceable neutral placeholder. Do not invent a permanent logo from a random icon.

**Client restaurant identity:** each restaurant can upload primary logo, optional light/dark variants, icon/monogram, cover photo, gallery images, and brand color references. Never substitute platform logo for restaurant logo. If no client logo exists, use a typographic wordmark from the restaurant name, not a fabricated emblem.

## 3. Client logo upload requirements

Support upload, replace, remove, preview; transparent PNG/WebP and sanitized SVG; primary/light/dark/icon variants; light/dark preview; contain-fit, never stretch or crop by default; configurable display bounds; preserve transparent padding unless owner chooses trim; sanitize SVG and reject scripts/external references; validate aspect ratio/dimensions; show contrast warning when logo disappears on selected background; retain original and optimized derivatives; default alt text to restaurant name. Do not force raster logos into vector. Do not automatically recolor logo. Logo upload belongs in onboarding and brand settings.

## 4. Semantic theme tokens

Use CSS variables, not scattered hardcoded colors: brandPrimary, brandSecondary, brandAccent, pageBackground, surface, surfaceElevated, textPrimary, textSecondary, textMuted, border, overlay, focus. Editor-only status colors may include success/warning/error. Define foreground/background pairings and run contrast checks. Palette changes should preview against real menu imagery and typography.

## 5. Curated starter palettes

### Espresso & Cream — cafés/coffee
Espresso #2B211D; cocoa #594239; oat cream #F4EFE7; milk #FFFDF9; caramel #B77A45; taupe #A99A8D.

### Tomato & Parchment — pizza/Italian/casual
Deep tomato #B83A2E; brick #762B25; parchment #F5EBDD; olive #66704B; ink #25231F; pale cream #FFFAF1.

### Midnight & Champagne — fine dining
Midnight #171B24; slate #343B49; champagne #D5BD91; warm ivory #F3EFE7; soft white #FCFBF8; silver #A6A9AE.

### Pistachio & Vanilla — desserts/matcha/bakery
Pistachio #526348; sage #A9B59A; vanilla #F7F1E4; cocoa #4A382F; rose #C98F83; white #FFFCF6.

### Citrus Pop — juice/smoothie/playful
Tangerine #F07835; lemon #F4D65E; leaf #4F7554; coconut #FFF8EA; deep green #263B31; coral #E66D62.

### Ocean Glass — seafood/coastal/drinks
Deep teal #164A4A; sea glass #A9C8BE; sand #EDE2D0; ink #202A2A; shell #FFF9F1; copper #B97855.

### Black & Bone — minimalist/modern
Near black #171717; charcoal #353535; bone #F1EEE7; paper #FCFBF8; warm gray #A7A29A; brass #A88A58.

### Berry & Blush — dessert/patisserie
Berry #6E304B; plum #442536; blush #E7C6C5; powder #F7EDE8; cream #FFF9F3; cocoa #503D3A.

These are editable starting points, not compulsory themes. Palette generator may algorithmically extract logo colors and propose 2–3 accessible palettes. Dominant logo color may be an accent, not necessarily background. Owner chooses after contrast and real-template preview.

## 6. Typography and layout

Curated display/body pairings; optional editorial serif for premium templates; tabular numerals for prices; max two font families by default; Arabic/RTL support with proper fallbacks. Keep descriptions readable and price alignment clear. Define spacing tokens, content max-width, responsive image ratios, fluid typography, intentional negative space, and predictable hierarchy. Do not use shadows to compensate for poor layout. Corner radius is a brand choice, not universal.

## 7. Image art direction

Prefer client photography; preserve product identity/portion; use consistent crop/light treatment across one menu; background removal only if edges are credible; cutouts need coherent contact shadows and light direction; decorative ingredients must not obscure dish or labels; provide fallback for missing/low-quality photos.

## 8. QA

Check logo crispness, no stretching, palette consistency, contrast, price scanning, coherent photography, no clipped labels/overflow, whitespace rhythm, mobile-specific layout, Arabic/RTL, and restaurant-brand feel rather than generic template feel.
