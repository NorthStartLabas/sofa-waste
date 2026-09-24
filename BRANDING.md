# SOFA Maastricht — brand and design reference

Everything the site is built from: the colours, the type, the spacing, and every
photograph, where it came from and where it is used.

Full-page screenshots of every page, desktop and mobile, are in
[`brand/screenshots/`](brand/screenshots).

---

## 1. The idea

The palette is taken from where the restaurant actually stands: warm stone from
Château Hoogenweerth, grey-green from the Maas, deep moss from the garden, clay
from the plane trees. Not generic fine-dining black and gold. This place.

---

## 2. Colour

Every colour lives once, as a CSS custom property in `src/app/globals.css`.
Components never write a hex value; they use the token name.

### Surfaces

| Token | Hex | Used for |
| --- | --- | --- |
| `paper` | `#F6F3EE` | the page background, warm off-white |
| `paper-raised` | `#FDFBF7` | cards sitting above the page |
| `paper-sunk` | `#EAE4DA` | inset panels, the menu taster band |

### Text

| Token | Hex | Used for |
| --- | --- | --- |
| `ink` | `#1D1D1B` | body and headlines. **This is SOFA's own logo black** |
| `ink-muted` | `#5A6968` | secondary text and captions, a Maas river grey-green |

### Lines

| Token | Hex | Used for |
| --- | --- | --- |
| `line` | `#D6CDBF` | hairlines between dishes, section rules |
| `line-strong` | `#B9AC97` | outlined buttons, the dotted leaders on the menu |

### Accent

| Token | Hex | Used for |
| --- | --- | --- |
| `accent` | `#3E5140` | buttons, links, the map pin. Deep moss |
| `accent-hover` | `#2B3529` | the same, pressed or hovered |
| `accent-contrast` | `#F6F3EE` | text sitting on an accent fill |
| `accent-soft` | `#E4E7DE` | the "fully booked" badge |
| `highlight` | `#96461F` | prices only. Clay, plane-tree bark |

### Dark sections

| Token | Hex | Used for |
| --- | --- | --- |
| `deep` | `#2B3529` | the footer |
| `on-deep` | `#EDE7DA` | text on the footer |
| `on-deep-muted` | `#B4B9A8` | secondary text on the footer |
| `scrim` | `rgb(25 30 22)` | the wash over photographs that carry text |

### The contrast rule

Every foreground and background pair above is machine-checked against WCAG 2.1
AA by `npm run check:contrast`. It also composites the photo scrim over **pure
white** and checks the text against that, because the worst case in a photograph
is a blown-out window or a white tablecloth. Nothing ships below 4.5:1.

There is **one palette**. A second "candlelit" dark theme was built, shown, and
deleted once the restaurant chose this one.

---

## 3. Type

Two typefaces, both open-licence and served from SOFA's own domain via
`next/font`. No Adobe subscription, no Google request at runtime, no licence to
renew. (The old site used Futura PT, which needs a paid Adobe Fonts plan.)

| Role | Typeface | Notes |
| --- | --- | --- |
| Display | **EB Garamond**, weight 500 | Headlines and dish names. An old-style book face, which is what a printed menu has always been set in. It carries weight 500 at display sizes; at 400 it goes thin above about 4rem. |
| Text | **Inter Tight** | Everything else. Legible at the small sizes menu descriptions and allergen notes need. |

### Scale

All sizes are fluid: they shrink on a phone and breathe on a desktop, with no
breakpoint jumps.

| Token | Size | Weight |
| --- | --- | --- |
| `text-display` | `clamp(3.25rem, 11.5vw, 10rem)` | 500 |
| `text-h1` | `clamp(2.5rem, 6.2vw, 4.75rem)` | 500 |
| `text-h2` | `clamp(1.875rem, 3.8vw, 2.875rem)` | 500 |
| `text-h3` | `clamp(1.25rem, 2vw, 1.5rem)` | 400 |
| `text-lead` | `clamp(1.0625rem, 1.6vw, 1.375rem)` | 400 |
| `eyebrow` | `0.75rem`, uppercase, `0.18em` tracking | 500 |

Body copy caps at roughly 68 characters a line.

---

## 4. Spacing and shape

| Token | Value | Used for |
| --- | --- | --- |
| `spacing-section` | `clamp(4.5rem, 10vw, 9rem)` | the gap between major sections |
| `spacing-gutter` | `clamp(1.25rem, 5vw, 4.5rem)` | the page's left and right margin |

**One corner radius: full.** Every interactive element is a pill. Images and
panels are square-cornered. There is no third shape.

**z-index, four layers and no more:** `10` content over decorative artwork,
`30` the menu's sticky category bar, `50` the site header, `100` the skip link.

---

## 5. Motion

Slow and subtle. Nothing auto-plays, nothing hijacks the scroll.

- Sections fade and rise about 20px as they are scrolled to, once.
- The olive branch in the hero drifts about 40px across the whole hero.
- Photo bands drift roughly 6% against the scroll.
- Buttons scale to 98% while pressed.

All of it switches off under `prefers-reduced-motion`. Reveals are pure CSS, so
they cannot get stuck invisible if JavaScript fails. There is no animation
library in the project.

A grain film sits over the whole page at 3.5% opacity, fixed and
pointer-events-none, so the large flat colour fields do not read as flat vector.

---

## 6. The logo

`public/sofa-logo.svg` is SOFA's own wordmark, unmodified except that the brand
black is replaced by `currentColor`, so one file works on the paper background
and on the dark footer.

The favicon and app icon are SOFA's own too: the chrome pendant lamp from the
dining room, taken from their existing site.

---

## 7. Photography

### SOFA's own photographs

All of these are the restaurant's own, taken from www.sofamaastricht.nl on
2026-09-22. **No stock photography is used anywhere on the site.**

Every image is referenced through `content/images.ts`, so replacing them with
new photography later is one file, not a hunt through the code.

| File | Size | Where it appears |
| --- | --- | --- |
| `sofa/restaurant-sofa-maastricht.jpg` | 1310×610 | the story section on the home page |
| `sofa/Bar-SOFA-Maastricht.jpg` | 1310×610 | the closing section, and the contact page band |
| `sofa/diner-sofa-maastricht.jpg` | 1310×610 | news article headers |
| `sofa/restaurant-sofa-maastricht-menukaart.jpg` | 1310×610 | menu page, after the sandwiches |
| `sofa/restaurant-sofa-maastricht-wijnen.jpg` | 1310×610 | menu page, after the intermediate courses |
| `sofa/sofa-maastricht-koffie.jpg` | 1310×610 | menu page, after the desserts |
| `sofa/cadeaubon-sofa-maastricht.jpg` | 1310×610 | the gift card page |
| `sofa/sofa-gerechten001.jpg` … `009.jpg` | 1200×1200 each | the dish strip on the home page, and news article images |
| `team/*.jpg` | 600×850, 13 files | the team grid on the about page |

A note on naming: the file SOFA calls `Bar-SOFA-Maastricht.jpg` is actually a
laid table by the window looking onto the hedge, not a bar. The alt text
describes what is in the frame, and the key in `content/images.ts` is `garden`.

The social sharing image (`opengraph-image.jpg`) is the dining room photograph
cropped to 1200×630.

### The olive branch, made for this site

`public/images/botanical/olive-branch.webp`

The hero's right half was empty on a page whose first line is about the city and
nature meeting. So there is an olive branch standing there.

- **Source:** *Olea europaea longifolia*, plate 456 from Conrad Loddiges & Sons,
  *The Botanical Cabinet* (c. 1820). Drawn by W. Miller, engraved by G. Cooke.
- **Licence:** public domain. The author died more than a hundred years ago, so
  no attribution is required; it is recorded here as good practice.
- **Origin:** [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Loddiges_456_Olea_europaea_drawn_by_W_Miller.jpg)
- **What was done to it:** the original is a hand-coloured engraving on aged
  cream paper. `scripts/make-botanical.mjs` keys the paper out to full
  transparency, removes the scanner dust and the engraved plate number, and
  re-renders the drawing in a single colour from the palette. The pixel work
  runs in a headless Chromium canvas, because this project has neither Pillow
  nor ImageMagick installed.
- **To change it:** re-run the script rather than editing the file by hand.

  ```bash
  node scripts/make-botanical.mjs <source.jpg> public/images/botanical/olive-branch.webp \
    --width=1100 --gamma=1.8 --headroom=0.2 --tint='#3e5140'
  ```

Olive is not arbitrary: it is the evergreen of the Mediterranean table, and the
restaurant's tagline is about where the city and nature meet.

Full provenance is also recorded in `public/images/CREDITS.md`.

---

## 8. Screenshots

[`brand/screenshots/`](brand/screenshots) holds a full-page capture of every
page, at 1600px desktop and 390px mobile, in Dutch.

| Page | Desktop | Mobile |
| --- | --- | --- |
| Home | `desktop-home.jpg` | `mobile-home.jpg` |
| Menukaart | `desktop-menukaart.jpg` | `mobile-menukaart.jpg` |
| Over | `desktop-over.jpg` | `mobile-over.jpg` |
| Nieuws | `desktop-nieuws.jpg` | `mobile-nieuws.jpg` |
| A news article | `desktop-nieuws-artikel.jpg` | `mobile-nieuws-artikel.jpg` |
| Contact | `desktop-contact.jpg` | `mobile-contact.jpg` |
| Cadeaubon | `desktop-cadeaubon.jpg` | `mobile-cadeaubon.jpg` |

Regenerate them with `npm run dev` running, then:

```bash
node scripts/brand-shots.mjs
```

---

## 9. Where things live

```
src/app/globals.css     every colour, type size and spacing token
src/lib/fonts.ts        the two typefaces
content/images.ts       every photograph on the site, in one place
public/images/          the photographs themselves
public/images/CREDITS.md  provenance and licences
public/sofa-logo.svg    the wordmark
scripts/make-botanical.mjs  turns a botanical plate into a site asset
scripts/check-contrast.mjs  the WCAG check that guards the palette
scripts/brand-shots.mjs     regenerates the screenshots above
```
