# Agent brief: realistic resin magnets (the Kitchen pack look)

Make the pack magnets look like real resin fridge magnets, the same as the Kitchen pack in the shop mockup. Start with the Kitchen pack. Then use the same method for every other pack. Read this whole file before you start.

## Scope

- In scope: the magnet art source, a shared gradient library, a new resin bake filter, changes to scripts/bake-pack.mjs, and porting the Kitchen pack.
- Out of scope: the shop screens, the database, prices, and the drag and drop of magnets on the door.
- There are no stickers any more. Every item is a magnet. Users decide where to put a magnet: on the door or on a note.

## Read first

- AGENTS.md: Expo rules, migration freeze, lint and typecheck.
- docs/agent-brief-magnet-3d.md: the current bake pipeline, the Magnet component and the shadow rules. This brief changes the art and the filter only. The pipeline and the component stay.
- scripts/bake-pack.mjs, art/magnets/catalog.mjs and art/stickers/catalog.mjs.
- The visual reference is design-mockups/pack-shop-collection.html. In it, look at these parts:
  - The hidden svg at the top of the body. It holds the filter with id resin and all the gradients (ids that start with k, r, t, g).
  - In the script: the constant KE (the soft edge stroke), the function khi (the white highlight), and the ART entries that start with k_ (Kitchen), r_ (other resin packs), t_ and w_ (travel).
  - The function svgOf. It shows that every item is drawn inside the resin filter.

## 0. Ground rules

- Do not run git commit or git push.
- Do not write to the hosted database or to Storage. Baked files for packs other than Starter go to dist/, which is gitignored.
- Do not copy a brand, logo, flag, film or game character, club crest, kit design or real person into any magnet. The Kitchen pack has no brand names. Text on a magnet is a plain word, for example MILK or Bread.
- If a rule here is not possible or is wrong, stop. Write the problem in docs/backend-plan-questions.md under a new heading, Resin magnets. Do not guess.
- Before you say the task is done, run npx expo lint, npx tsc --noEmit, node scripts/run-unit-tests.cjs, npm run bake:packs and the checks in section 7.

## 1. What makes a magnet look like resin

A cartoon magnet has a thick dark outline and flat colours. A resin magnet has these things:

1. No dark outline. Each shape has a soft edge stroke only: stroke rgba(70,45,20,.38), width 0.6.
2. Shading from gradients, not from flat colours.
   - Linear gradients go from light on the left to dark on the right (for example, the kettle body: #55BEC7, #2A8E99, #155F69).
   - Round things use a radial gradient with the light point at cx .35, cy .3 (for example, the yolk and the tomatoes).
3. One or two small white highlights at the top-left, as ellipses with opacity 0.45 to 0.85. Use the khi helper.
4. One light for every magnet. The light comes from the top-left. Never change the light direction for one magnet.
5. Real materials and real colours: steel, wood, ceramic, glass, bread crust, burlap, paper, enamel. Use the shared gradients for these (section 2), so the same material looks the same in every pack.
6. Thickness, gloss and a contact shadow come from the resin filter (section 3). Do not draw them in the art.

## 2. Art source rules

- Canvas: viewBox 0 0 40 40, the same as now. Keep the important parts inside x 2 to 38 and y 2 to 38. The bake canvas adds 4 units of padding for the thickness.
- Every visible part is a closed, filled shape. Thin lines are only for small details (steam, scoring on bread, weave lines). A magnet made mostly of lines looks flat after the bake.
- Draw from back to front: handles and straps first, then the body, then labels, then highlights.
- Text:
  - 1 or 2 short words only.
  - The font size is at least 3.4 units.
  - Use font-weight 800 or 900 and the font-family system-ui, sans-serif, or Georgia, serif for a printed label (as on the Bread sack).
  - Text is part of the art, so the bake turns it into pixels. Do not depend on a font that the bake machine does not have.
- Old sticker art had a thick white die-cut border (stroke #fff, width 3.5, paint-order stroke). Remove it. Use the soft edge stroke from section 1 in its place.
- Speech-bubble stickers become word magnets: a rounded plaque with the word on it. Use the wordmag helper from the mockup.
- Helpers to port from the mockup into art/magnets/helpers.mjs, as plain functions that return SVG strings:
  - khi: white highlight.
  - rwheel: wheel with tyre and hub.
  - steam: steam lines.
  - burst and star5: star and burst shapes.
  - plaque: the travel place-name plaque.
  - wordmag: word magnet.
  - ksack, kbag and ktom: the sack, the baguette and the tomato from the Kitchen pack.

### 2.1 Shared gradient library

- Make art/magnets/gradients.mjs. It exports one string with every linearGradient and radialGradient element from the hidden svg in the mockup.
- Copy them exactly. Do not rename the ids, because the ART entries use them as url(#id).
- Group them in the file by material, with a short comment for each group. Examples:
  - Metal: kSteel, kGold.
  - Food: kBread, kYolk, kRed, rCheese, tMango.
  - Ceramic and paper: kWhite, kMilk, kBurlap.
  - Wood: kWood, rWalnut, rWillow.
  - Glass: rGlass.
- A new magnet can add a gradient. Add it to this file and reuse it when you can. Do not put gradient definitions inside one magnet's svg.

### 2.2 Catalog changes

- Keep the entry shape: id, pack, label, svg. Add one field, style, with the value resin or cartoon.
- New and ported Kitchen magnets use style resin.
- Existing Starter magnets stay cartoon until they are ported, so the app does not change before the new art is ready.
- Ids: keep the rule pack prefix + name, lower-case. For the Kitchen pack, use kt_kettle, kt_crackegg, kt_friedegg, kt_eggcarton, kt_toaster, kt_breadbag, kt_tomatosack, kt_basket, kt_milk, kt_espresso, kt_skewer.
- Move the items from art/stickers/catalog.mjs into art/magnets/catalog.mjs when you port their pack. When the stickers catalog is empty, delete it and remove its import from the bake script.

## 3. The resin bake filter

Add this filter to scripts/bake-pack.mjs as RESIN_FILTER. It is the filter with id resin from the mockup, without its two shadow nodes. The app draws the shadow on the door (see docs/agent-brief-magnet-3d.md).

```
<filter id="f" x="-20%" y="-20%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feComponentTransfer in="SourceGraphic" result="dk"><feFuncR type="linear" slope=".62"/><feFuncG type="linear" slope=".62"/><feFuncB type="linear" slope=".62"/></feComponentTransfer>
  <feOffset in="dk" dx=".45" dy=".7" result="e1"/><feOffset in="dk" dx=".9" dy="1.4" result="e2"/>
<feOffset in="dk" dx="1.3" dy="2" result="e3"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="2.6" specularConstant=".75" specularExponent="28"
lighting-color="#fff" result="spec"><feDistantLight azimuth="225" elevation="50"/>
</feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
  <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k2="1" k3=".55" result="face0"/>
  <feComposite in="face0" in2="SourceAlpha" operator="in" result="face"/>
  <feMerge><feMergeNode in="e3"/><feMergeNode in="e2"/><feMergeNode in="e1"/><feMergeNode in="face"/>
</feMerge>
</filter>
```

How it differs from the current BODY_FILTER:

- No diffuse lighting. The current filter flattens colours into a cartoon dome. The resin filter keeps the art's own gradients.
- The thickness layers are lighter (slope 0.62, not 0.45), so the edge looks like coloured resin, not a black rim.
- The gloss is a bit weaker and sharper (specularConstant 0.75, exponent 28).

## 4. Bake script changes

1. Import the gradient string and the helpers.
2. In pageHtml, put the gradient string inside defs, next to the filter, for every magnet.
3. Pick the filter from item.style: resin uses RESIN_FILTER, cartoon uses the current BODY_FILTER.
4. Every item is a magnet. Remove the flat sticker path, and bake a shadow file for every item.
5. Keep the sizes (@1x 64, @2x 128, @3x 192 px), the WebP settings, the manifest, the contact sheet and the size budget. Gradients can make files larger. If a file is over 25 KB at @3x, simplify the art. Do not lower the WebP quality.
6. The manifest kind is magnet for every item.
7. Keep the script deterministic. Running it twice must give the same files.

## 5. Port the Kitchen pack first

- Copy the 11 k_ entries from the mockup's ART object into art/magnets/catalog.mjs with the new ids from section 2.2, pack kitchen and style resin.
- Replace the mockup helpers in the SVG strings with the ported helper functions.
- The mockup Kitchen pack also shows 3 old cartoon items as magnets: coffee, heart and done tick. Do not port the cartoon art. Redraw them in the resin style, or leave them out and write which one you chose in your summary.
- Bake with npm run bake:packs -- --pack kitchen. Open dist/packs/preview.html and compare it with the mockup, next to each other.

## 6. Magnets in team colours (later, do not build now)

The football jersey, scarf and foam finger use the family's own 2 team colours, which change at run time. A baked image cannot do this. Write a short plan in docs/backend-plan-questions.md under Resin magnets, with this suggested design, and do not build it in this task:

- Bake 3 images for each team magnet:
  - A flat white mask of the main colour areas.
  - A flat white mask of the trim colour areas.
  - A shading layer: the full magnet baked with mid-grey team colours, kept as light and dark only, on a transparent background.
- In the app, stack the main mask tinted with colour 1, the trim mask tinted with colour 2, then the shading layer, then the name and number as text.
- Check that this looks the same as the mockup on a real phone before you build it for all 3 magnets.

## 7. Checks before you say it is done

1. Every Kitchen magnet is readable at @1x (64 px) and at 56 pt on the fridge door in the app.
2. No magnet has a dark cartoon outline or a white sticker border.
3. All magnets show the light from the top-left. The highlights and the thickness point the same way.
4. A magnet on a door of a similar colour still shows a clear edge. Test the cream door with the bread sack, and the green door with the kettle.
5. Dark mode: the magnets look the same. The door gets darker, the magnets do not.
6. Every @3x body file is 25 KB or less, every shadow is 8 KB or less, and the pack is 400 KB or less.
7. The contact sheet matches the mockup. Note any magnet that looks different, and why.
8. npx expo lint, npx tsc --noEmit and the unit tests pass. Starter art in assets/packs/starter does not change in this task.

At the end, write a short summary: the files you changed, the size of each baked Kitchen file, what you did with coffee, heart and done tick, and the questions you added.
