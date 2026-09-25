# Making the board look physical


## 1. Real shadows on paper - src/components/NotePaper.tsx
Why: the current shadow is the note's own pastel tint ( palette. shadow, ~0.28 alpha) x shadow0pacity: 0.38 = 10% darkness. On the grey board it's invisible, so cards look printed on. The mockup uses two neutral shadows: a tight contact shadow and a soft drop.

Replace the inline shadowColor: palette.shadow, line (line ~75) - delete it - and replace the paper style:

```ts
paper: {
// Two Layers Like real paper on a surface: a tight contact shadow where it
// touches, and a soft drop that falls below it.
boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 10px 18px -8px rgba(20,30,25,0.45)',
// Light from above: a faint highlight on the upper part of the sheet.
experimental_backgroundImage:
'Linear-gradient(180deg, rgba(255,255, 255,0.28) 0%, rgba(255,255,255,0) 38%),
// Slightly uneven corners - real paper is never perfectly square.
borderTopLeftRadius: 3, borderTopRightRadius: 4, borderBottomRightRadius: borderBottomLeftRadius: 3,
},
```

And drop borderRadius: RADIUS[variant], from the inline style (the RADIUS map can go). Remove elevation everywhere on paper - it fights boxShadow on Android.

Add a flat?: boolean prop (default false ); when true, skip boxShadow (used by the pinned strip, change 5):
```ts
flat && {boxShadow: undefined },
```

## 2. Quiet attribution - src/components/NotePaper.tsx

Why: the coloured "D" circle + handwritten name reads as chat Ul. The mockup has one small line of plain text: Mom • 2 h.
Replace the whole fauthorName 11 age? (...) : null block with:
```ts
{authorName || age ? (
<Text numberOfLines={1} style={[styles.meta, { color: palette.ink }]}> {[authorName, age].filter(Boolean). join(' . ')}
</Text>
) : null}
```

Styles - replace attribution, signature, age with:
```ts
meta: {
marginTop: 10, 
fontFamily: fonts.ui.semibold, 
fontSize: 11.5, 
opacity: 0.7, 
textAlign: 'right'
},
```
Remove the MemberDot import. Keep MemberDot for the header faces, People screen and note detail.

## 3. One fastener: magnets - src/components/Pin.tsx
Why: tape + spiral + pushpins + binder clip + thumbtack + emoji stickers on one screen reads as clip art. The mockup uses one fastener for everything: a round magnet with a highlight.
Replace fastenerForItem and FastenerView with:

```ts
const MAGNETS = ['#E4572E', '#F2B134', '#2A9D8F', '#3D5A98', '#D96C95'];
export type Fastener = { color: string; x: number };

/** One magnet per item: stable colour and a slightly off-centre spot. */
export function fastenerForItem(seed: string): Fastener {
const rand = seeded(seed);
return {
color: MAGNETS[Math.FLoor(rand() * MAGNETS.length)],
x: 0.3 + rand()*0.4, // 30%-78% across the top edge
};
}

export function FastenerView({ fastener }: { fastener: Fastener }) {
return (
<View 
    pointerEvents="none"
    style = {[styles.magnet, { left: `${fastener.x*100}%`, backgroundColor: fastener.color }]}
/>
);
}

const styles = StyleSheet.create({
magnet: {
position: "absolute', 
top: -11, 
marginLeft: -12, 
width: 24, 
height: 24,
borderRadius: 12, 
zIndex: 2,
experimental_backgroundImage:
    'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 42%)' ,
    boxShadow: '0 3px 5px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(8,0,8,0.18)'.\,
},
})

```

Put the magnet colours in src/theme/colors.ts (fastenerColors. magnets) to keep the "no hex outside theme" rule.
Update the call in NotePaper.tsx: fastenerForItem(item.id) (no variant). Delete the unused tape/clip/sticker/tack components and their colours.
Also remove the spiral holes on lists (NotePaper.tsx
holes block and tornHole / tornSlit /hole styles, plus the extra




## 4. The door: colour + one light source - src/theme/colors.ts, src/app/board/[id]/index.tsx
Why: a flat mid-grey rectangle has no light direction, and it dulls the pastels. The mockup door has a left-to-right sheen so every shadow agrees with one light.
In the board screen, add the sheen to the root SafeAreaView (line ~347):

```ts
<SafeAreaView
style={[
styles.safe,
{   backgroundColor: boardColors[board.color], 
    experimental_backgroundImage: DOOR_SHEEN,
},
]} 
edges={['top']}
>
```

```ts
// theme/colors.ts
export const DOOR_SHEEN =
';inear-gradient(90deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.06) 100% ':

```

Optional, bigger step toward the mockup: switch boardColors to the mockup's door colours - sage •#9DBBA8', blue
'#9FB6CD', clay '#D29F87', cream '#E6DCC4', charcoal '#464D59° . They're deeper, so pastel paper pops. Charcoal becomes a dark door: the header text,
"Always here" label and status bar must switch to light (rgba(255,255,255,0.85))
when board.color === 'charcoal'.

## 5. Pinned strip: kill the grey band, keep the shadow - src/components/PinnedStrip.tsx
Why: the grey bar at the bottom of pinned cards is a gradient bug 'transparent' is rgba(0,0,0,0), so iS blends through grey into the paper colour. And overfLow: "hidden' on clip cuts off the paper's shadow, so pinned cards look

```ts
const bg = item.color === 'paper ? colors.paper: noteColors[item.color].bg;
<Pressable style={[styles.card, styles.cardShadow, cardH != null && { height: cardH }]} _>
<View style={styles.clip}>
<NotePaper item=(item} flat maxEntries=(maxEntries} entries={_} />
<LinearGradient
colors={[`${bg}00`, bg ]}
style=(styles.fade}
pointerEvents="none"

</View>
</Pressable>

```

```ts
cardShadow: {
borderRadius: 4,
boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 8px 14px -8px rgba(20,30,25,0.4)',
},
```

(bg values are 6-digit hex, so appending ee is valid.) The magnet sits at top: -11 and would be clipped - give the strip paddingTop: 12 and render the magnet outside the clip, or skip magnets on pinned cards (the "Always here" label already explains them).
Pinned photo: resizeMode="cover" instead of "contain", and apply cardshadow to photoCard.

## 6. Handwriting sized by length - src/components/NotePaper.tsx
Why: the mockup has three sizes (33 / 25 / 20.5px), so a two-word note is a bold little slip and a sentence is smaller. Now everything that isn't s20 chars is 20px.
```ts
const len = bodyTrimmed.length;
const bodyFontSize = large
? 26
:item.type |== 'note'
? 18
: len <= 20 && !bodyTrimmed.includes('\n°)
?33
: len <= 60
?25
:20;
```

Mirror the tiers in estimateltemHeight (src/utils/layout.ts) so first paint doesn't jump.

## 7. Break the grid a little - src/utils/layout.ts
Why: two perfectly aligned columns read as a Ul grid. Real notes are off by a few pixels.
In computeBoardLayout, nudge auto-placed items (manual ones keep their spot; settleNoOverLap still prevents overlap):

```ts
const rand = seeded(item.id + ':x');
const jitter = (rand() - 0.5) * 0.03; // +1.5% of board width (~+-6px)
const jitterY = Math.round(rand() * 10); // 0-10px extra drop
const settled = settleNoOverlap(
manual ? manual.x: column + jitterX, 
manual ? manual.y: bottoms[column] + jitterY, 
w, 
h, 
placed,
);

```
Keep the x clamp inside settleNoverlap (or clamp x to [e, 1 - w]). Update the layout unit tests' expected positions.
What not to add
• Paper texture images or noise - the mockup has none; shadows + highlight do the work.
• Curled corners/ folds - heavy to draw in RN and fight the tilt.
• The fridge handle and freezer/fridge split - only if you commit to direction B fully (see ridgeDoor earlier in this conversation's notes).