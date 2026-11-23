# Agent guide: magnet types

This guide tells you how to design and build each type of magnet. Users only ever see one thing: a magnet. The type tells you which art template, which build method and which data each magnet needs.

Read docs/agent-brief-resin-magnets.md first. It has the shared resin rules, the gradient library, the resin bake filter and the bake script changes. This guide adds the rules for each type on top of it.

## Read first

- docs/agent-brief-resin-magnets.md: the resin look, the filter and the bake pipeline.
- docs/agent-brief-magnet-3d.md: the Magnet component, the shadow and the placement on the door.
- design-mockups/magnet-types.html: every type with real examples.
- design-mockups/pack-shop-collection.html: the source art. The ART ids that this guide names are in its script.

## 0. Ground rules

- Do not run git commit or git push.
- Migration freeze: add new migrations only. Never edit a migration that was already pushed.
- No brands, logos, flags, film or game characters, club crests, kit designs or real people in any magnet.
- If a rule here is not possible or is wrong, stop. Write the problem in docs/backend-plan-questions.md under a new heading, Magnet types. Do not guess.
- Build only the types marked Build now in this task. For the other types, follow the status line in their section.

## 1. Rules for every type

- Every magnet uses the resin look and the same light from the top-left.
- Users decide where a magnet goes: on the door or on a note. Do not add snap rules or size rules for notes.
- The default size when a user drops a magnet is 56 pt for square magnets. Word magnets and place plaques are wider, so use their own default size (see their sections).
- Each catalog entry gets a new field, type. The values are object, word, badge, place, team, letter, photo, holder and live.
- Database: add a type column to pack_art in a new migration, with a check on the same values. Existing rows default to object.
- Text that is baked into an image cannot be translated in the app. For the types with baked text (word, badge, place), see section 10.

## 2. Object

Status: Build now.

What it is: a small resin copy of a real thing. This is the main type, and most of every pack.

Examples in the mockup: k_kettle, k_toaster, r_cake, r_bus, r_daruma, r_popcorn.

Art template:

- A free silhouette that fits inside x 2 to 38 and y 2 to 38 of the 40 x 40 canvas.
- One clear outer shape. A person must know the thing from its silhouette alone at 64 px.
- At most 3 main colours, plus materials from the gradient library (steel, wood, glass and so on).
- No part thinner than 1 unit, except small details like steam or bread scoring.
- Text only when a real object has it: a label on a sack or a carton, 1 word, at least 3.4 units.

Build: baked, with style resin. Body and shadow files as in the resin brief.

Checks: readable at 64 px; the silhouette is clear on the cream door and on the green door.

## 3. Word

Status: Build now.

What it is: a raised plaque with 1 or 2 words. It lets a magnet say something. It replaces the old speech-bubble stickers.

Examples in the mockup: s_askdad, s_great, s_party, s_tasty, s_howzat.

Art template (use the wordmag helper, do not draw new shapes):

- Plaque: x 2.5, y 11, width 35, height 18, corner radius 5, with the soft edge stroke.
- A shine strip at the top: x 4, y 12.2, width 32, height 5, white at 35% opacity.
- Text: font-weight 900, system-ui, sans-serif. Size 5.6 to 7 units. At most 11 characters, including spaces.
- Colours: a light pastel plaque and a dark ink of the same hue, with a contrast of at least 7:1. Take the colours from the pack palette.

Build: baked, with style resin. The bake canvas is square, so the plaque has empty space above and below it. Crop the baked image to the plaque bounds plus the 4-unit padding, so the file is wider than it is tall.

Default size: 64 x 34 pt.

Copy rules:

- Short, kind and fun. No insults, no jokes about a person's body, no words that only work in one country.
- Keep a list of every word magnet in art/magnets/words.md, so a person can review the tone and plan translations.

## 4. Badge

Status: Build now.

What it is: an award or a reaction, round or star-shaped. People mostly put it on notes.

Examples in the mockup: r_goldstar, r_medal, r_rosette, s_aplus, s_welldone, s_goal.

Art template, 3 base shapes only:

- Circle: radius 16.5, with an inner ring 2 to 3 units inside the edge.
- Star: the star5 helper, outer radius 17.
- Burst: the burst helper, 12 to 16 points, outer radius 17.5, inner radius 11.5 to 14.

Other rules:

- Text: at most 6 characters on one line, or 2 short lines. Font-weight 900.
- Colours: gold (kGold) for awards, blue, red, purple or green for reactions. One main colour for each badge.
- Ribbons or tails (medal straps, rosette tails) are allowed, but they must stay inside the canvas.

Build: baked, with style resin.

## 5. Place plaque

Status: Build now.

What it is: a framed scene with a place name. It is used for travel countries and Wonders of the world.

Examples in the mockup: r_tagra, r_tkyoto, r_tphuket, r_tcanyon, w_colosseum, r_tlondon.

Art template (use the plaque helper):

- Gold frame: x 2, y 5, width 36, height 30, corner radius 4.
- Scene area: x 4.4, y 7.4, width 31.2, height 19.6. Keep every part of the scene inside it.
- Name banner: x 4.4, y 27, height 6, in the country or place colour. The name is in capital letters. Use size 4.4 for up to 8 characters, or size 3.5 for 9 to 12 characters.

Scene rules:

- 3 to 5 flat layers: sky, far land, the main subject, the near ground.
- Sky gradients: tSunset, tSkyBlue or tDusk only, so all plaques look like one set.
- No people with faces. No flags.
- Landmarks: old landmarks are allowed (for example the Taj Mahal or Tower Bridge). Do not draw modern buildings with protected designs, or statues with licensed images. Use nature, food or transport for those places.
- Check heritage-site image rules for each country before launch. Mexico and Peru have such rules. Write each check in backend-plan-questions.md.

Build: baked, with style resin. Crop like the word magnet.

Default size: 64 x 54 pt.

## 6. Team

Status: Build next. Write a plan and build a prototype of the jersey only. Do not build all 3 team magnets until the prototype is approved.

What it is: the jersey, scarf and foam finger in the family's 2 team colours, with a name and a number.

Examples in the mockup: r_jersey, r_scarf, r_foam. They use the CSS variables t1 and t2.

Build, in layers, because one fixed image cannot change colour:

1. Bake a flat white mask of the main-colour areas: id_t1.
2. Bake a flat white mask of the trim-colour areas: id_t2.
3. Bake a shading layer: the full magnet with mid-grey team colours, kept as light and dark only, on a transparent background: id_shade.
4. In the app, stack these from bottom to top: id_t1 tinted with colour 1, id_t2 tinted with colour 2, then id_shade, then the name and the number as native text, then the shadow under all of them.

Data:

- Each board stores its team: colour 1, colour 2, a name of up to 9 letters (A to Z, space, dot, apostrophe, hyphen) and a number from 0 to 99.
- This needs a new table or new columns in a new migration. Write the design in backend-plan-questions.md first.

Colours: only the 12 colours in the mockup picker (KIT). No free colour picker, so the text always has enough contrast.

Checks:

- The prototype looks the same as the mockup on a real phone, in light mode and in dark mode.
- A name of 9 letters fits on the jersey.

## 7. Letter

Status: Decide. Do not build until the owner decides. You may write the plan.

What it is: the classic A to Z and 0 to 9 set. Children spell names and short words on the door.

Example in the mockup: the F A M I L Y row in design-mockups/magnet-types.html.

Art template:

- One glyph fills the canvas. Use a rounded, heavy font with a licence that allows use in images, for example a SIL Open Font License font.
- Convert each glyph to a path before the bake, so the bake does not depend on fonts on the machine.

Build: use the same tint method as team magnets, so you do not bake 36 glyphs in 6 colours. That means 36 masks + 36 shading layers, tinted in the app with 6 colours: red, yellow, blue, green, orange, purple.

Default size: 40 pt, smaller than other magnets, because people use many letters together.

## 8. Photo

Status: Decide. Do not build until the owner decides. You may write the plan.

What it is: a family photo in a resin frame.

Examples in the mockup: the photo frame and the heart frame in design-mockups/magnet-types.html.

Build:

- Bake the frame only (the resin ring, its shine and its shadow) as an image with a transparent window.
- In the app, show the user's photo under the frame, cropped to the window shape. For the heart, use a mask.
- Use the existing photo pipeline in src/lib/photos.ts and src/lib/photoCache.ts for upload, compression and cache.

Data and safety:

- Same storage, same quota and same moderation as photo notes. Read docs/hosted-setup.md for the storage quota.
- Only members of the board can see the photo.
- When the author leaves the board, ask the owner what happens to their photo magnets. Do not decide this yourself.

## 9. Holder

Status: Build now.

What it is: the magnet, tape or clip that holds each note on the door. The app adds it to every note on its own. Users do not place holders.

Examples in the mockup: the fastener function. Each pack has one style in its fast field (mag with a colour, washi, clip).

Rules:

- One holder style for each pack, from the pack spec. It is not chosen per note.
- The round magnet holder uses the resin look at 22 pt.
- Washi and tape are tileable images from the pack. Clips are images from the pack.
- Holders are drawn by the note component, not by the magnet layer. They move with the note and do not have their own drag.
- Holders are not counted as magnets in the shop. The shop detail screen lists them under Holds notes.

## 10. Text in baked art and translation

Word magnets, badges and place plaques have text inside the image.

- Version 1 ships these in English only.
- Store the words for each magnet in the catalog in a text field, next to the svg. Then a later bake can make a version for each language, with the same id plus a language suffix, for example s_askdad_hi.
- Place names stay in English capitals on the plaque, the same as on real souvenir magnets.
- Object magnets with a label (MILK, Bread) follow the same rule as word magnets.

## 11. Add-ons (not types)

Status: Build now, but only after the travel feature has its data.

- Gift tag:
  - A kraft tag drawn by the app as a native view, not baked: From {name} · {place}, {month year}.
  - It sits at the bottom-right of the magnet and moves with it.
  - Data: the PRD (section 9) plans a gift_note column on board_magnets, with at most 28 characters. Check whether a pushed migration already has it. If not, add it, and a from_member column, in a new migration.
- Visited stamp:
  - A small red VISITED stamp drawn by the app, rotated 12 degrees, at the top-right of a place plaque.
  - Data: which board marked which plaque as visited, by whom and when. Write the design in backend-plan-questions.md.

## 12. Live

Status: Later. Do not build anything.

What it is: a magnet that shows live data, for example a trip countdown or who is home.

Examples in the mockup: the countdown and Who is home magnets in design-mockups/magnet-types.html.

Only write down, in backend-plan-questions.md, which data each live magnet would need and how often it would update. The owner decides later.

## 13. Order of work

1. Add the type field to the catalog and the type column in a new migration.
2. Port and bake the Kitchen pack (object magnets). This is task 5 of the resin brief.
3. Port and bake the word magnets and the badges from one pack (Star chart), with the crop for wide magnets.
4. Port and bake the place plaques of one travel country (Japan).
5. Update the holder magnet to the resin look.
6. Write the plans for team, letter, photo, add-ons and live in backend-plan-questions.md.

At the end, write a short summary: the files you changed, the migration name, the size of each baked file, and the questions you added.
