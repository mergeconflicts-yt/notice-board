# PRD: Magnets, stickers and packs

## 1. Summary
Preview
Markdown
Let families and roommates decorate their shared fridge the way they decorate a real one. This covers:
-**Magnets:** chunky 3D souvenir and
cute magnets that anyone can place **anywhere on the fridge**, on top of notes
included.
- **Stickers:**
small die-cut stickers that members slap onto a note as a lightweight reaction.
- **Packs:** themed paid sets of magnets, stickers, paper styles and door finishes. Travel magnets are sold per country, and a single "bring one home" gift magnet is sold for whoever is travelling.
The core
app (notes, lists, dates, photos) stays free. Packs only sell decoration.
## 2. Why
-**Retention:** decoration gives people a reason to open the board even when nothing new has been posted, and it makes the board feel like *theirs*.
- **Emotion:** a travel magnet means "we went there", and a gifted one means "I thought of you". Real fridges already do this, so no other app's habit needs teaching.
- **Revenue that doesn't touch the promise:** "No conversations, no pings, nothing gets buried" stays true. Nothing
useful is paywalled.
- **Audiences:** college students (cute, dorm and aesthetic packs) and families (kitchen, kids, festivals, travel).
## 3. Goals and non-goals
**Goals**
1. Any member can place, move and remove magnets anywhere on the door, freely.
2. Any member
can react to a note with a sticker. y
3. Members can buy packs in the app on is and Android; once bought, the whole board can
5. Board themes: door finish plus paper styles from a pack.
**Non-goals (this PRD)**
- User-uploaded or custom magnet art.
- Licensed characters or brands (no Sanrio, Disney or similar). All art is original.
- Comments, reaction counts on notifications, or any chat-like behaviour.
- Selling to other boards or a marketplace.
- Magnets in the widgets (planned later, see §13).
## 4. Users and core stories
| As a... | I want to... | so that... |
|---|---|---|
| Parent | stick a mango magnet on the grocery list | the fridge feels Like our kitchen |  
| Teen /student | cover the door with cute magnets | the board feels fun, not Like a to-do app | 
| Traveller | send one Kyoto magnet home with a note | the family sees I was thinking of them |
| Grandparent | see who stuck a heart on the photo | I know who saw it |
| Board owner | switch the door to the Kitchen theme | the board matches our home |
| Anyone | put a magnet right on top of a note, like on a real fridge | I can decorate however I Like | 

## 5. Concepts
m
Preview Markdown
| Term | Meaning |
|---| ---|
**Poster magnet** | Existing round magnet on each note showing who posted it. Unchanged, not a decoration. |
**Magnet** | Decorative 3D object placed on the door. Free placement and overlap. |
**Sticker** | Flat die-cut vinyl on a note: a reaction tied to a member. |
**Paper style** | Note background (grid, kraft, recipe card, legal pad..). |
**Door theme** | Door finish, handle and title colour for the whole board. |
**Pack** | A set of magnets, stickers, paper styles and/or a door theme, sold as one product |
**Travel pack** | A per-country pack of 6 magnets. Owning one stamps the "passport". |
| **Gift magnet** | One travel magnet with a personal tag ("From Lily • Kyoto, Oct 2026"). |

## 6. Functional requirements
### 6.1 Magnets: placement (the key rule)
**Magnets can be placed anywhere on the fridge, including on top of notes. There are no overlap rules.**

| ID | Requirement |
|---|---|
| M-1 | A magnet can be dropped at any point on either door (top "Always here" door or main door), on empty door, on a note, partly over a note's edge, or over another magnet. |
| M-2 | No collision checks, no auto-nudging, no snapping. A magnet stays exactly where the user drops it (subject only to M-5). |
| M-3 | Magnets render **above** notes and stickers. Among magnets, the most recently placed or moved is on top. |
| M-4 | **Attach on drop:** if a magnet's centre is dropped over a note, it attached to that note and stores its offset relative to the note. When the note moves (manual drag or auto-layout reflow), the magnet moves with it. Dropped on empty door, it's anchored to the door. |
| M-5 | Only the magnet's centre must stay inside the door bounds, so a magnet can hang off the edge of a note or the door, but not disappear. The seam between the doors is allowed. |
| M-6 | When an attached note expires, is removed or is marked done and tidied away, its magnets **fall to the door** at their current on-screen position and become door-anchored. Nothing is lost. If the note is restored within 30 days, the magnets do not re-attach. |
| M-7 | Rotation: random -10°..+10° on first placement. A two-finger twist changes it (v1.1; v1 keeps the random angle). |
| M-8 | One size per magnet (56 pt reference). No resizing in v1. |
| M-9 | Any member can place a magnet from any pack the board can use (see §6.4). |
| M-10 | Any member can move any magnet; it's a shared fridge. The placer or the board owner can remove it. Others see "Only Lily or the owner can take this off". |
| M-11 | Limit: 24 magnets per board, to protect performance (soft cap, tunable server-side). Not a layout rule. | 
| M-12 | Tap a magnet (not editing) → small bubble: "Mt. Fuji - added by Lily", plus "From Lily • Kyoto, Oct 2026" for gifts. |

**Interaction model**

- **Decorate mode** is entered from a * button on the board header. In decorate mode, the tray of owned magnets slides up and notes stay fully visible. Drag a magnet from the tray onto the fridge, drag placed magnets around, and drag one
onto "Drop here to take off" to remove it.
- Outside decorate mode, magnets don't move: tapping a magnet shows its bubble, and tapping a note opens the note.
That way decorating never gets in the way of everyday reading.
- **COvered notes:** because magnets may sit on top of text, the note detail view (opened by tapping the note) always shows the note *without* decorations. A per-user **"Hide decorations"** toggle in the board menu temporarily hides all magnets and stickers, for reading or screenshots. It's local only and doesn't change what others see.
- Hit-testing: a tap lands on the topmost thing under the finger. If a magnet fully covers a note, the user opens the note by tapping its uncovered part, or by long-pressing the magnet "Open the note underneath".

**Feel**
- **Picking up** a magnet lifts it: scale 1.18, a bigger and softer shadow, and a light haptic.
- **Dropping** it snaps it down: a 60 ms squash, the shadow tightens, and a light haptic.
- **Removing** it twists it off and fades it out in 180 ms.
- With *Reduce Motion* on, all of these become simple fades.

### 6.2 Stickers (note reactions)
| ID | Requirement |
|---|---|
|S-1 | Press and hold a note → sticker tray (sheet). Tap a sticker → it slaps onto the note. | 
| S-2 | Stickers sit at note corners in a fixed order: bottom-right, top-right, bottom-left. Max 3 kinds per note. |
| S-3 | One sticker of each kind per member per note. If another member adds the same kind, a count badge appears ("2"). Tapping your own sticker in the tray again peels it off. | 
| S-4 | Tap a sticker → "Love from Dad and Lily". |
|S-5 | Stickers expire with their note. They never send notifications. I
|S-6 | Free set of 8 (Love, Got it, Done, Great, Haha, Thanks, Yum, On it). Packs add more kinds. | 

(Stickers keep corner slots so reactions stay readable and countable. Free placement applies to magnets only; see open question Q1.)

### 6.3 Packs and the shop

| ID | Requirement |
|---|---|
| P-1 | The shop opens from the * tray ("Get more") and from the board menu. |
| P-2 | Sections: a featured/limited pack; themed packs (2-column cards showing the user's own board in that theme; travel (passport strip); bundles; Restore purchases. |
| P-3 | Every pack has a **live preview on the user's real board**, with a "PREVIEW" tag, before buying. | 
| P-4 | The buy button carries the price ("Unlock • $1.99"), with a line under it: "Shared with every board you're on." Purchases use the native App Store / Play Billing sheet. |
| P-5 | After purchase, the pack's items appear in the tray immediately for every member of every board the buyer belongs to (see §6.4). |
| P-6 | Theme packs show **Use on this fridge** (owner only) to apply the door theme. Paper styles become available in the composer for everyone. |
| P-7 | Limited packs (festivals) show their end date. After it, they can no longer be bought, but owners keep them forever. |
| P-8 | A "Restore purchases" button is always visible (an App Store requirement). |

**Launch catalogue** (all original art):

| Pack | Contents | Price |
|---|---|---|
| Starter | current magnets + 4 souvenirs + 8 stickers + 7 papers | Free |
| Kitchen | 10 magnets, 6 stickers, recipe/gingham papers, cream door | $1.99 |
| Japanese stationery | 8 magnets, 12 stickers, grid/kraft papers, 4 washi tapes, light door | $1.99 |
| Cute originals | 12 magnets (Mochi the fridge cat & friends, 16 stickers, pastel papers, pink door | $1.99 |
| Aesthetic | 6 magnets, 10 stickers, linen papers, brass clips, linen door | $1.99 |
| Dorm life | 8 magnets, 10 stickers, legal-pad papers, navy door | $1.99 |
| Festival (Diwali, Lunar New Year, Christmas...) | 6 magnets, 8 stickers, 3 papers, door | $0.99, Limited | 
| Every pack | all current themed packs + this year's festivals | $6.99 |

### 6.4 Ownership model
**Decision: purchases belong to the buyer and are shared with every board the buyer is a member of.** 

- This matches how App Store and Play purchases work (tied to the buyer's store account), so restoring purchases and Family Sharing just work.
- In the UI: "Owned by Dad • shared with this board".
- A board can use a pack if **any current member** owns it.
- If the owning member leaves, magnets and papers **already placed stay**, but members can no longer place new items from that pack.
- A refunded purchase (store webhook) works the same way: placed items stay, and new placement stops.
- Family Sharing (ioS) is on for all non-consumable packs.

### 6.5 Travel

| ID | Requirement |
|---|---|
| T-1 | **Home country free:** 1-2 magnets for the device region, stamped "HOME" in the passport. |
| T-2 | Country packs: 6 magnets each, $0.99. Launch with India, Taiwan, Japan, Thailand, USA and UK; add more based on demand.
| T-3 | **Passport:** a horizontal strip of country tiles. Owned countries show an ink stamp ("VISITED • JP • OCT 2026"), and the header counts "2 of 6 stamped", |
| T-4 | **World traveller**, $4.99: all countries, including future ones. |
| T-5 | **Bring one home**, $0.49, consumable: pick a country → pick a magnet → write a tag note (≤ 28 chars) → it's placed on the chosen board's door with a kraft tag. It's free if the sender owns that country pack.|
| T-6 | "qNear you"uses coarse location only, asked for only when the shop opens, and never stored. Without permission, the list is alphabetical with the home country first.|
| T-7 | Gift magnets **never expire** and keep their tag. They follow the normal magnet rules otherwise: free placement, can be moved. Only the sender or the owner can remove one. |
| T-8 | Art uses food, transport, nature and everyday objects. No national flags. No specific modern Landmarks with commercial-use restrictions; check each landmark before drawing it. |

### 6.6 Themes and paper
| ID | Requirement |
|---|---|
|H-1 | The board owner sets the door theme (boards. theme_pack'). Everyone sees it. The default is Starter. I
I H-2 | The paper style is chosen per note in the composer from the papers the board can use (items. paper_style"). A note keeps its paper even if the theme changes. |
I H-3 | Contrast: every paper must keep note text ≥ 7:1, and every door must keep the board title ≥ 4.5:1. Packs that fail don't ship. 1
I H-4 | Washi tape and clips replace the poster magnet as the fastener **only** on notes using that pack's paper. Member identity stays visible through the author line (Mom • 2 h"). |

## 7. UX states and copy
| State | Behaviour |
|---|---|
| No magnets yet | * button pulses once on first visit after release; tray opens with Starter + "Get more". | 
| At cap (24) | Tray items disabled, "This fridge is full. Take one off to add another." | 
| Offline | Placement and moves queue locally and sync later; magnets placed offline show at full opacity (no "pending" look). 1
| Pack not owned (other member's) | Tray shows it with a small "Dad's" Label; usable. |
| Owner left/refunded | Pack greyed in tray: "Needs someone on this board to own kitchen." |
| Purchase failed / cancelled | Silent on cancel; a toast on failure. Never charge without the native sheet. |
| Limited pack ended | Card hidden for non-owners; owners see "Owned". |

## 8. Accessibility
Preview
Markdown
- Every magnet has a label: "Torii gate magnet, from Lily, Kyoto October 2026, on the Groceries note".
- Notes list their decorations at the end of their label: "2 stickers, 1 magnet".
- VoiceOver/TalkBack: decorate mode offers "Move to.." actions (on note X / top door / main door), so no dragging is needed.
- Reduce Motion turns the motion into fades. The "Hide decorations" toggle helps low-vision readers.
- Note detail always renders text undecorated (see §6.1).

## 9. Data and API (Supabase)
Migration freeze rules apply: **add new migrations only**. All writes go through 'security definer RPCs, and reads go
through views
with RLS.
**Tables**

```sql
-- The pack catalogue. Data, not code: adding a pack = inserting rows.
create table public.pack_catalog (
    id text primary key,    -- 'kitchen', 'travel_jp', 'fest_diwali 2026'
    kind text not null check (kind in ('theme', 'travel', 'festival', 'bundle', 'gift')), 
    name text not null, 
    blurb text, 
    store_product_id text,          -- null for free packs
    price_label text,               -- display only; real price comes from the store
    sort int not null default 100,
    status text not null default 'draft' check (status in ('draft', 'live', 'retired')), 
    available_from timestamptz,     -- Limited packs: sales window
    available_until timestamptz, 
    min_renderer int not null default 1, -- hide packs this app build can't draw (see 9.1)
    spec ison not null,                 -- door, papers, fasteners, sticker/magnet Lists (see 9.1)
    assets_version int not null default 1,  -- bump to make clients re-download art
    bundle_of text[]                    -- for bundles: pack ids included
) ;

create table public.pack_art ( 
    art_id text primary key,            - - 'jp_torii'
    pack_id text not null references public.pack_catalog(id),
    kind text not null check (kind in ('magnet', 'sticker', 'paper', 'fastener', 'door')), 
    label text not null,                -- accessibility + tag text: 'Torii gate'
    path text not null,                 -- storage path: packs/travel_jp/v1/jp_torii@3x.webp
    w int, h int                        -- natural size in ref points
) ;

-- Store-verified ownership (written only by the webhook function). 
create table public.user_entitlements (
    user_id vuid references public.profiles(id) on delete cascade, 
    pack_id text not null,
    source text not null check (source in ('app_store', 'play', 'promo', 'free')), store_txn_id text, 
    revoked_at timestamptz,
    created_at timestamptz not null default now(), 
    primary key (user_id, pack_id)
);


create table public.board_magnets (
    id uuid primary key,
    board_id vuid not null references public.boards(id) on delete cascade, 
    art_id text not null,           -- e.g. 'jp_torii'
    pack_id text not null,
    item_id uvid references public. items(id) on delete set null, -- attached note, else door 
    x double precision not null, -- door: fraction of width; attached: fraction of note width
    y double precision not null, -- door: ref points; attached: ref points from note top
    rotation real not null default 0, 
    z bigint not null,  -- stacking order, higher = on top
    placed_by vuid references public.profiles(id) on delete set null, 
    gift_note text check (char_length(gift_note) <= 28), 
    version integer not null default 1, 
    created_at timestamptz not null default now(), 
    updated_at timestamptz not null default now()
) ;

create table public.item_stickers ( 
    item_id vuid not null references
    public. items(id) on delete cascade,
    boardid uid not null,
    member_id uuid not null references public.profiles(id) on delete cascade, 
    art_id text not null,
    created_at timestamptz not null default now(), 
    primary key (item_id, member_id, art_id)
);

alter table public. boards add column theme_pack text not null default 'starter';
alter table public.items add column paper_style text; - - null = colour-only paper

```

- `art_id` and `pack_id` are validated against `pack_catalog` / `pack_art`, so a client can't invent art. Both tables
are readable by any signed-in user (only status = 'live' rows); only the service role writes them.
- `item_id ... on delete set null` alone doesn't move a magnet when its note goes. The tidy-up step (M-6) converts its position to door coordinates before purging, and the `purge` function is extended to do the same.

**RPCs**
| Function | Notes |
|---|---|
| `place_magnet(board, art, x, y, item?, rotation, gift_note?) `| Membership check, board_can_use (board, pack), cap check, sets z = max+1'
| `move_magnet(id, x, y, item?, version)` | Any member; last write wins on version conflict, and the client re-renders. Bumps z. l
|`remove_magnet(id)` | Placer or owner only. |
|`add_sticker(item, art) / remove_sticker(item, art)` | Member and pack-entitlement checks; max 3 kinds per note. | 
|`set_board_theme (board, pack)` | Owner only, plus an entitlement check. I
| `board_can_use (board, pack)` | Returns true if the pack is free or any current member holds an active entitlement. |

**Purchases**
- CLient: RevenueCat (`react-native-purchases`, with a dev build) for product listing, buying and restoring.
- Server: a new Edge Function `store-webhook` that verifies RevenueCat events and upserts or revokes `user_entitlements`. The client never writes entitlements.
- Gift magnet: a consumable product. The webhook creates a single-use grant, and `place_magnet `consumes it.
- Realtime: add `board_magnets` and `item_stickers` to the existing board realtime publication, so moves show Live for other members.

### 9.1 Server-driven packs: new packs without an app update
**Decision:** only the Starter pack ships inside the app. Every other pack - its definition and its art - comes from the server. Adding a pack needs **no app release and no EAS Update**.
**How it works**
1. **Catalogue.** On shop open (and at most once a day otherwise), the app fetches pack catalog'+ pack_art for
' status = "live'•
, and caches the result. It sends If-None-Match', so this is usually a 304.
2. **Art.** Images live in a public Supabase Storage bucket packs/ (behind the CDN), with versioned paths: packs/ <pack_id›/v<assets_version>/<art_id>@3x.webp'. Art is not secret; ownership is enforced by the RPCS, not by hiding
3. **DownLoad on demand.** Shop thumbnails use
small @1x previews. Full art downLoads when someone opens a preview,
owns the pack, or a board shows a magnet from it. Images are cached on the device with 'expo-image' (disk cache) - a board with downloaded magnets renders offline.
4. **Missing art.** If a magnet's art isn't cached yet and the phone is offline, it shows a neutral placeholder (round grey magnet with the label) and swaps in the real art when it arrives. Positions never wait for art.

5. **Generic renderer.** The app has **no code per pack**. It draws any pack from its

```jsonc
"door":
{"light": "#FBEFDO", "base": "#F3E2B3", "shade": "#DCC791", "handle": "chrome", "titleInk": "#7A2E22" },
"papers": [{ "id": "kitchen_recipe", "bg": "#FFFDF7", "ink": "#5A2A1E", "texture": "recipe", "fastener": "washi: kitchen_gingham" }],
"magnets": ["kt_tomato", "kt_kettle", "kt_Lemon"],
"stickers": ["kt_egg"],
"preview": { "papers": [0,1,0,2,3], "decor": ["kt_tomato", "kt_kettle", "kt_Lemon", "kt_egg"] }
```

**Renderer building blocks** (ship these in Phase 0/1 so later packs are data-only):
| Block | Options the app can draw from data |
|---|---|
| Door | 3 colours + handle style (' steel, chrome wood, pink, brass, gold) +  title colour |
| Paper texture | plain, grid, ruled, ruled margin, 'recipe, "legal, dots , kraft, "linen', "torn_top, border_pattern, or image (a tileable PNG from the pack) |
| Fastener | magnet (any colour), washi (any tileable PNG), clip (any PNG), tape (any PNG) | 
| Magnet / sticker | any PNG/WebP with alpha; magnets get the standard contact + drop shadow in code |
 Gift tag | standard kraft tag, text from gift_note |

`spec` has a version. Each app build declares the highest renderer version it understands; packs with a higher
'min_renderer stay hidden on older builds ("Update the app to see 2 new packs"). **An app update is only needed when a pack needs a new building block** (an animated magnet, a new fastener type, a new paper effect) - and then only once for that block, not per pack.

**Art pipeline**

- Magnets are drawn as SVG, then baked to WebP with the 3D lighting (the filter from the mockups) at @1x/@2x/@3x. The shadow on the door is added by code so it can grow while dragging.
- Stickers: WebP with the white die-cut border baked in.
- Budget: ≤ 25 KB per magnet @3x, ≤ 400 KB per pack total.

**Adding a new pack (runbook, no release)**
1. Draw the art; bake WebPs with the export script ('scripts/bake-pack.mjs', to build).
2. UpLoad to 'packs/<pack_id>/v1/.
3. Insert 'pack_catalog' (status
draft') + pack_art rows - via a small admin script using the service role. These
are data rows, not schema, so the migration freeze is not affected.
4. Create the product in App Store Connect and PLay Console; add it to the RevenueCat offering; set store_product_id.
5. Preview it on a test board (drafts are visible to an allow-list of test accounts).
6. Apple reviews the new in-app purchase (after the first approved purchase, new ones can be submitted without a new app version). When approved, set status = "live'"
7. Limited packs: set available_from / available_until; the shop shows and hides them on its own.

**What still needs an app release:** a new renderer building block, changes to placement or shop UI, and the Starter pack (it's bundled so the app works on first launch with no network).

**Store rules**
- Packs are images and data only - no downloaded code - which fits AppStore Review Guideline 2.5.2.
- Prices always come from the store (RevenueCat), never from price_label, so regional pricing works.

## 10. Analytics (privacy-friendly, no content)
| Event | Properties |
| --- | --- |
|decorate_open | board size |
|magnet_place / move / remove | pack_id, on_note (bool)| 
| sticker_add | pack_id | 
| shop_open, pack_preview, 'purchase_start, "purchase_success, "purchase_fail, "restore" | pack_id, price tier |
gift_send | country, free vs paid
| hide_decorations_toggle | on/off |

## 11. Success metrics (90 days after the shop launches)
1 Metric | Target |
|---|---|
| Boards with ≥ 1 placed magnet | 40% of weekly active boards |
| D30 retention, decorated vs undecorated boards | +5 pts (directional) |
| Shop visitors who buy anything 3-5% |
| Paying boards (any member owns a pack) | 4% of active boards |
| Refund rate | < 2% |
| Notes tapped through a covering magnet (Long-press → open underneath) | tracked, should be low; if high, revisit Q1 |

## 12. Rollout
| Phase | Scope | Gate |
|---|---|---|
| **0** | Free stickers + free magnet engine (Starter magnets, decorate mode, attach-on-drop, hide decorations) | v1 stable; 3D art for Starter |
| **1** | Shop + RevenueCat + webhook + server catalogue + generic pack renderer + art pipeline, launching with 3 packs (Kitchen, Cute, Japanese stationery) + Every pack | Phase 0 shows ≥ 25 % of boards decorating |
|**2** | Travel (6 countries, passport, world bundle, Bring one home) | Phase 1 conversion ≥ 2% |
| **3**| Door themes + paper styles in the composer; Aesthetic, Dorm Life; first festival pack timed ~3 weeks before the festival | Contrast audit passes |

A free festival pack (Diwali or Lunar New Year) can ship inside Phase 0 as a cheap test of interest in decoration.
## 13. Later (out of scope now)
- Magnets visible in the large home-screen widget.
- Two-finger rotate, pinch to resize within limits.
- Seasonal packs that appear on the door automatically for a week and can be dismissed.
- Kids pack, door finishes (stainless steel, chalkboard), more countries.

## 14. Risks
| Risk | Mitigation |
|---|---|
| Magnets covering important text (Wi-Fi, dates) | Note detail always clean; Hide decorations; long-press → open underneath; watch the metric in §11. |
| Clutter makes the board look like clip art | Cap of 24; pack art made as matched everyday use. |
| Members fighting over moving magnets | Anyone can move a magnet, but only the placer or owner can remove it; the bubble shows who placed it. |
| Store review: paid features in a family app | Purely cosmetic purchases, the price is on the button, Restore purchases is visible, no loot boxes or random items. |
| IP: characters and landmarks | Original art only; legal check of landmark list before Travel ships. |
| Performance with many 3D images | Baked WebPs, one layer, cap of 24; test on low-end Android. |
| Art not downLoaded when offline | Disk cache; placeholder magnet with its label until art arrives; positions never wait for art. |
| A pack needs something the renderer can't draw | 'min_renderer hides it on old builds; build a varied set of building blocks up front. |
| Accidental drags while reading | Magnets only move in decorate mode. |

## 15. Open questions
1. **Q1:** Should stickers also allow free placement on notes (not only corners)? *Proposed: no in vi; revisit with
2. **Q2:** Do magnets show in the board's thumbnail and invite link preview? *Proposed: yes, the door thumbnail only.*
3. **Q3:** Should the board owner be able to Lock decorating (e.g. a strict roommates board)? *Proposed: an owner toggle "Members can decorate" (default on).*
4.**04:** Final prices per region (India and Taiwan price tiers) and whether to launch the subscription-free model everywhere.
5. **Q5:** Cap value: 24 magnets per board, or scale it with board height?
6. **Q6:** Does "Every pack" include packs added after purchase? With a server catalogue this is just "bundle_of";
*proposed: yes for themed packs released in the same year, not for travel (World traveller covers that).*