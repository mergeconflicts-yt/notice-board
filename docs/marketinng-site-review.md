# Marketing site review - Fridge Board (website/)
Reviewed 2026-09-29. Scope: website/index.html (+ web/site/index.html, web/vercel.json).

# TL;DR
The page has strong ingredients: pain-first stories, the chat-vs-note comparison, a "tidies itself" differentiator, and a fun interactive fridge. Three problems hold it back:

1. The hero doesn't say what the product is. It defines the app by what it lacks (struck-through Replies/ Reactions / Read receipts). A first-time visitor gets "no noise" but not "a shared board app for your household." There is no `<h1>` at all.
2. The problem→ solution story is split across three sections (hero chaos animation, "Lost it in the chat again?", "Stop scrolling up for the Wi-Fi password") that each re-tell the same idea. The best visual, the chat-vs-note compare, sits at section 3.
3. SEO is close to zero. No h1, no keyword in the title, no OG/social tags, no structured data, no sitemap/robots, no favicon, dead store links, and a brand split (Fridge Board vs Notice Board).

## 1. The 5-second test
A visitor should be able to answer three questions without scrolling:
| Question | Now | Target |
| --- | --- | --- |
| What is it? | Unclear. The eyebrow "Fridge door, in everyone's pocket" is the only hint. | "A shared board for your home" |
| Who is it for? | Not in the hero | Families, roommates, couples |
| Why not WhatsApp / a group chat? | Implied by struck list | Said outright: "things don't get buried" |

### Proposed hero (pain + solution in one view, which is still pain-first)
```
[every phone]
Fridge Board is one shared board for your home. The Wi-Fi password, the grocery list, Saturday's dentist time: pinned where everyone can see it. No replies, no pings, nothing scrolls away.

[eyebrow] The family noticeboard, on
[h1)
Stop losing important stuff in the family group chat.
[sub]

[CTA]
[App Storel [Google Play]
• Try it as a guest. No sign-up.
• iPhone & Android

```

Visual on the right: keep the fridge, but make the first static frame tell the story. Today the chat bubbles appear, get struck, then the note is revealed, so anyone who glances before the animation finishes (or who has reduced motion enabled) misses the point. Options:
• Split frame: a noisy chat phone on the left, the clean fridge on the right, and an arrow between them. This is your compare section promoted into the hero.
• Or keep the animation but start it on the finished board with 2-3 chat bubbles fading off it, so frame 0 already shows the solution.
Keep the struck list. It's memorable. Move it down to be the header of the "Why it's not another chat" section, where the reader already knows what the product is.

### Headline alternatives to A/B test
- "The family chat buries everything. The fridge board doesn't."
- "Where's the Wi-Fi password? On the board."
- "One board for your home. Nothing gets buried."


## 2. Recommended page structure
Each section answers the next objection a reader has. Current section numbers are shown in brackets.
I
| # | Section | Job | Change |
| --- | --- | --- | --- |
| 1 | Hero | What / who / why + CTA | Rewrite as above. Add the h1. |
| 2 | The problem ("Lost it in the Emotional resonance chat again?") | Keep the 3 buried cards and merge in the Wi-Fi chat-vs-note compare. One section, one story. Consider swapping the boyfriend/colour card (a memory problem, not a shared household info problem) for a roommates one, e.g. "Rent's due on the 1st. Bins are Tuesday." |
| 3 | What goes on the board |Show the product | New, currently missing.Four tiles for Notes, Lists, Dates and Photos, each with a real app screenshot in a phone frame. Right now nobody sees the actual app Ul. |
| 4 | Why it's not another chat Differentiator | Your current "trio" plus the struck list: no replies, no pings, nothing buried.|
| 5 | idies itself [4] | Second differentiator | Keep. It's unique. Shorten the expiry list to a single visual timeline. |
| 6 | How it works [6] | Remove effort fear | Keep. |
| 7 | Made for [7] | Self-identification | Make each tag a link to its own landing page (see 84). |
| 8 | Social proof | Trust | New. Even 3 beta-tester quotes, or "Used by N households", once you have them. |
| 9 | Privacy [8] | Trust | Keep, maybe compress into one row. |
| 10 | FAQ [9] | Objections + SEO |Add "How is this different from WhatsApp / Google. Keep / a family calendar?" and "Is it free?" |
| 11 | Final CTA | Convert | Keep. |

Nav: the labels "Lost it?" and "No noise" are clever but unclear. Use Features • How it works • Privacy • FAQ with the Get the app button.

## 3. Technical SEO fixes (do these first; they're cheap)
**Critical**
- [ ] Add exactly one `<h1>` with the core phrase (for example "shared family board").
- [ ] Wire up real App Store / Play Store URLs. Every store button is href="#" or #get-the-app today.
- [ ] Pick one brand. web/site/index.html says Notice Board, website/ says Fridge Board, and the repo is notice-board. Delete or align the stale one.
- [ ] Make sure the marketing site is not served by the web/ Vercel project. web/vercel. json sends X-Robots- Tag: noindex, nofollow on /(.*), which is correct for the invite-link domain but fatal for marketing. Use a separate project or domain, or scope the header to `/j/*`.

**`<head>` additions**

```html
<title>Fridge Board: Shared Family Board for Notes & Lists</title>
<meta name="description" content="Stop losing the Wi-Fi password, grocery list and dentist time in the family chat. One shared board for your home. No replies, no pings. iPhone & Android." /> 
<link rel="canonical" href="https://YOURDOMAIN/" />
<link rel="icon" href="/favicon.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#FBF5E9" />
<meta name="apple-itunes-app" content="app-id=APP_STORE_ID" />
<meta property="og: type" content="website" />
<meta property="og: title" content="Fridge Board: the family noticeboard on every phone" />
<meta property="og: description" content="Notes, lists, dates and photos that don't get buried in the group chat." />
<meta property="og: image" content="https://YOURDOMAIN/og.png" /> <!-- 1200×630, fridge + headline -->
<meta name="twitter:card" content="summary_large_image" />
```

OG images matter a lot for this product: your growth loop is people sharing links in family chats, and the preview card is the ad.

**Structured data** (JSON-LD): MobileApplication (name, operatingSystem, applicationCategory LifestyleApplication, offers, and later aggregateRating), FAQPage for the FAQ block, and Organization.

**Also**
- [ ] robots.txt + sitemap. xml.
- [ ] Self-host the hero photo (currently hotlinked from Unsplash) and fonts. Preload Caveat and Nunito with font-display: swap. Google Fonts is render-blocking right now.
- [ ] Respect prefers-reduced-motion for the chaos animation and make sure the no-animation state still tells the story.
- [ ] Decide the primary market (the copy mixes "kettle boils" UK tone with Goa / Riya). Set Lang="en-US" / en-IN / en-GB accordingly, because it affects both ranking and ad targeting.
- [ ] Privacy-friendly analytics (Plausible / Fathom) + UTM on store links + App Store ct= campaign tokens / Play referrer, so you know which page drives installs.

## 4. Marketing & SEO growth plan
A homepage alone ranks for your brand name and not much else. Rankable traffic comes from pages that each target one intent.

### a. Use-case landing pages (one per "Made for" tag)

Each page reuses the same template with its own pains, example board and keywords.

| Page | Example pains on the board | Target queries |
| --- | --- | --- |
| `/families` | Wi-Fi, school pickup, dentist | family organizer app, family notice board app, shared family calendar |
| `/roommates` | rent due, bin day, cleaning rota | roommate app, shared house chores app, flatmate bills reminder |
| `/couples` | groceries, date night, "sage green" | shared grocery list for couples, couple to-do app |
| `/grandparents` | photos, visit dates | simple family photo sharing for grandparents |
| `/clubs` |  match times, kit list |  sports club notice board app |

### b. Comparison / alternative pages (highest buying intent)

- "Fridge Board vs WhatsApp family group"
- "Cozi alternative" / "FamilyWall alternative" / "TimeTree alternative"
- "Google Keep shared notes vs Fridge Board"

Be fair and specific. Your wedge is no chat, no pings, auto-tidy, which most competitors don't do.

### c. Problem-led content (top of funnel)

Write short, useful posts that answer a real query and end with the board as the fix:

- "How to stop important messages getting lost in the family group chat"
- "Where to keep the Wi-Fi password so guests can find it"
- "A roommate chore rota that actually works" + a free printable fridge chart (a link magnet) "or put it on the board"

### d. ASO (probably worth more than web SEO for an app)
- App name + subtitle carry keywords: Fridge Board - Family Notice Board / subtitle Shared notes, lists & dates.
- Screenshots tell the same story as the hero: screenshot 1 is chat chaos board, with the headline over it.
- Add an in-app rating prompt after a positive moment, e.g. a list gets fully ticked.

### e. Built-in distribution
- The invite link is your best landing page. Every /j/<token> fallback should sell the product: "Dad invited you to Jack Family's board" + one line on what it is + store buttons. Keep it noindex, but give it full marketing care.
- Short-form video: the hero animation (chat bubbles → struck → clean note) is already a 7-second Reel/Short. Post it with the Wi-Fi / dentist stories.
- Communities: r/roommates, r/Parenting, r/InternetsBeautiful, parenting newsletters, Product Hunt launch.


## 5. Priority order
1. h1 + title/meta + OG image + real store links + brand/domain/noindex fix. (1 day, unblocks everything)
2. Hero rewrite + merge the problem sections + add "What goes on the board" with real screenshots. (2-3 days)
3. Analytics + attribution.
4. Invite landing page polish.
5. /families and / roommates pages, then comparison pages, then content.