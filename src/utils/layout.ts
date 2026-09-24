import { NoteWithAuthor } from '../types';
import { fontSizeForText, parseListItems, pinVariantForNote } from './note';
import { seeded } from './id';

/** Reference board width in points. x/width are stored 0-1; y is stored
 *  in these reference points and scaled by (boardWidth / REF_W) at render,
 *  so placement scales across phone sizes. */
export const REF_W = 390;

/** Breathing room at the very top of the board (ref points). */
const TOP_Y = 12;

/** Gap left below a freshly dropped note before older notes resume. */
const PUSH_GAP = 8;

/** Boards with at most this many notes use the roomier two-column layout;
 *  beyond it the denser landing-zone fold takes over. */
export const TWO_COLUMN_MAX = 10;

/** Two-column layout metrics (fractions of board width / ref points). */
const TWO_COL_EDGE = 0.045;
/** Negative gutter: the two sides overlap a touch in the middle so the board
 *  reads as layered paper instead of two tidy table columns. */
const TWO_COL_GUTTER = -0.05;
const TWO_COL_W = (1 - 2 * TWO_COL_EDGE - TWO_COL_GUTTER) / 2;
/** Negative: each paper laps a little over the one above it. */
const TWO_COL_ROW_GAP = -10;
/** Total tilt spread applied to a note, either direction. */
const TWO_COL_ROTATION_SPREAD = 24;
/** Total horizontal drift applied to a note, so the sides aren't aligned. */
const TWO_COL_X_JITTER = 0.05;

/** Floors for notes in the roomy two-column layout, so short or small papers
 *  still read big: width as a fraction of the board, height in ref points. */
export const TWO_COL_MIN_W = 0.41;
export const TWO_COL_MIN_H = 140;

/** Stable width seed shared by creation-time packing and render. */
function widthSeed(input: { text: string; kind: string; authorId: string }): string {
  return `${input.text}|${input.kind}|${input.authorId}`;
}

type DimsInput = {
  text: string;
  imageUrl: string | null;
  kind: string;
  authorId: string;
  expiresAt?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Approximate landing columns. A note drops into the first zone with room at
 * the top; large notes span the width and push smaller ones downward. The
 * rotations are intentionally slight so the board never reads as a grid.
 */
export const LANDING_ZONES = [
  { x: 0.04, rotation: -1.8 },
  { x: 0.36, rotation: 1.2 },
  { x: 0.68, rotation: -0.8 },
] as const;

/** Normalized (0-1) width fraction per paper format, with stable jitter. */
export function widthFracForNote(input: DimsInput): number {
  const variant = pinVariantForNote({
    text: input.text,
    imageUrl: input.imageUrl,
    kind: input.kind,
    expiresAt: null,
  });
  const r = seeded(widthSeed(input))();
  const px =
    variant === 'mini'
      ? 105 + r * 20
      : variant === 'announcement'
        ? 200 + r * 60
        : variant === 'list'
          ? 150 + r * 25
          : variant === 'appointment'
            ? 150 + r * 30
            : variant === 'photo'
              ? 150 + r * 40
              : variant === 'receipt'
                ? 110 + r * 30
                : 140 + r * 30;
  return px / REF_W;
}

/**
 * Width fraction for the two-column layout. With only a couple of sections
 * to fill, papers stretch to cover most of their column so the board reads
 * big; the smaller formats keep a little breathing room.
 */
function twoColWidthFrac(input: DimsInput): number {
  const variant = pinVariantForNote({
    text: input.text,
    imageUrl: input.imageUrl,
    kind: input.kind,
    expiresAt: null,
  });
  const r = seeded(widthSeed(input))();
  const fill =
    variant === 'mini'
      ? 0.86 + r * 0.1
      : variant === 'receipt'
        ? 0.88 + r * 0.1
        : variant === 'announcement'
          ? 1
          : 0.9 + r * 0.1;
  return TWO_COL_W * fill;
}

/** Reference-space height for a note at the given width fraction. */
export function noteRefHeight(note: NoteWithAuthor, frac: number): number {
  return estimateNoteHeight(note, frac * REF_W);
}

export type PlacedNote = { x: number; y: number; w: number; h: number };

export type BoardPlacement = PlacedNote & { rotation: number };

/** Deterministic, per-device placement for every note on a board. */
export type BoardLayout = Map<string, BoardPlacement>;

/** Actual rendered note heights (ref points) keyed by id, reported by
 *  onLayout. When present these replace the rough height estimate, so a long
 *  note can never be given too little room and cover its neighbour. */
export type MeasuredHeights = Record<string, number>;

/**
 * A note that has been dragged by hand keeps its spot in positionX (0-1 of
 * board width) and positionY (reference points), flagged with `data.manual`
 * so it can be told apart from the automatic layout.
 */
export function manualPlacement(note: NoteWithAuthor): { x: number; y: number } | null {
  const data = note.data as { manual?: unknown } | null;
  if (!data || data.manual !== true) return null;
  if (typeof note.positionX !== 'number' || typeof note.positionY !== 'number') return null;
  return { x: note.positionX, y: note.positionY };
}

/** Max share of a note (by the smaller of the two areas) that another note
 *  may cover. Kept low so the dense board barely overlaps. */
export const MAX_OVERLAP_FRAC = 0.05;

/** Looser cap for hand-placed notes: they may lap neighbours, but never bury them. */
export const MAX_MANUAL_OVERLAP_FRAC = 0.4;

/**
 * Settle a dropped note: keep it on the board using its own width, then nudge
 * it down while it covers too much of a neighbour. Returns normalized coords.
 */
export function settleManual(
  x: number,
  y: number,
  w: number,
  h: number,
  others: PlacedNote[],
): { x: number; y: number } {
  const edge = 0.02;
  const nx = Math.max(edge, Math.min(1 - edge - w, x));
  let ny = Math.max(TOP_Y, y);
  for (let guard = 0; guard < 20; guard++) {
    let target = ny;
    for (const q of others) {
      const ix = Math.max(0, Math.min(nx + w, q.x + q.w) - Math.max(nx, q.x));
      if (ix <= 0) continue;
      const minArea = Math.min(w * h, q.w * q.h);
      if (minArea <= 0) continue;
      const cap = (MAX_MANUAL_OVERLAP_FRAC * minArea) / ix;
      if (h <= cap) continue;
      const bottom = Math.min(ny + h, q.y + q.h);
      if (bottom - ny > cap) target = Math.max(target, q.y + q.h - cap);
    }
    if (target === ny) break;
    ny = target;
  }
  return { x: nx, y: ny };
}

/**
 * Push a rect straight down the minimum needed so it overlaps no other rect
 * by more than MAX_OVERLAP_FRAC. Small overlaps stay as-is.
 */
export function settleBelow(rect: PlacedNote, others: PlacedNote[]): number {
  let y = rect.y;
  for (let guard = 0; guard < 50; guard++) {
    let target = y;
    for (const q of others) {
      const ix = Math.max(0, Math.min(rect.x + rect.w, q.x + q.w) - Math.max(rect.x, q.x));
      if (ix <= 0) continue;
      const minArea = Math.min(rect.w * rect.h, q.w * q.h);
      if (minArea <= 0) continue;
      // Tolerable intersection height for this x-overlap.
      const cap = (MAX_OVERLAP_FRAC * minArea) / ix;
      if (rect.h <= cap) continue;
      const bottom = Math.min(y + rect.h, q.y + q.h);
      if (bottom - y > cap) target = Math.max(target, q.y + q.h - cap);
    }
    if (target === y) return y;
    y = target;
  }
  return y;
}

export type TopInsertMove = { id: string; y: number };
export type TopInsert = { x: number; y: number; zone: number; moves: TopInsertMove[] };

function horizontalOverlap(a: PlacedNote, b: PlacedNote): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
}

/**
 * Make room for a note dropped at the top. Any existing note the new paper
 * would cover is shoved down by the new note's full height (not just enough
 * to clear the overlap), so the new note lands on clean space. Notes in
 * other zones stay put; the pushed ones then cascade to avoid new clashes.
 */
function placeAtTop(
  placed: (PlacedNote & { id: string })[],
  x: number,
  w: number,
  h: number,
): { moves: TopInsertMove[]; cost: number } {
  const newRect: PlacedNote = { x, y: TOP_Y, w, h };
  const bottom = TOP_Y + h;
  const sorted = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  const rects: PlacedNote[] = [newRect];
  const moves: TopInsertMove[] = [];
  let cost = 0;

  for (const p of sorted) {
    let y = p.y;
    if (horizontalOverlap(newRect, p) > 0 && p.y < bottom) {
      y = p.y + h + PUSH_GAP;
    }
    y = settleBelow({ x: p.x, y, w: p.w, h: p.h }, rects);
    rects.push({ x: p.x, y, w: p.w, h: p.h });
    if (y !== p.y) {
      moves.push({ id: p.id, y });
      cost += y - p.y;
    }
  }
  return { moves, cost };
}

/**
 * Drop a note at the very top without wasting space: try each landing zone
 * and push only the notes that actually collide downwards (keeping their
 * x), then keep the zone with the least total movement — ties break toward
 * the leftmost zone. No randomness, so every device computes the same spot.
 */
export function insertAtTop(
  placed: (PlacedNote & { id: string })[],
  input: DimsInput,
  hOverride?: number,
): TopInsert {
  const wFrac = widthFracForNote(input);
  const probe = {
    text: input.text,
    imageUrl: input.imageUrl,
    kind: input.kind,
    authorId: input.authorId,
    expiresAt: input.expiresAt ?? null,
    data: input.data ?? null,
  } as NoteWithAuthor;
  const h = hOverride ?? noteRefHeight(probe, wFrac);

  let best: TopInsert | null = null;
  let bestCost = Infinity;

  for (let zone = 0; zone < LANDING_ZONES.length; zone++) {
    const x = Math.min(LANDING_ZONES[zone].x, Math.max(0, 1 - wFrac - 0.03));
    if (x < 0.02) continue;
    const { moves, cost } = placeAtTop(placed, x, wFrac, h);
    // Nudge the score by zone so equal-cost zones prefer left → right.
    const score = cost + zone * 1e-4;
    if (score < bestCost) {
      bestCost = score;
      best = { x, y: TOP_Y, zone, moves };
    }
  }
  if (best) return best;
  const maxY = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  return { x: 0.05, y: maxY + 20, zone: 0, moves: [] };
}

/** Slight, stable rotation biased by the note's landing zone. */
function rotationForZone(zone: number, noteId: string): number {
  const base = LANDING_ZONES[zone]?.rotation ?? 0;
  const jitter = (seeded(`${noteId}:rot`)() - 0.5) * 1.4;
  return Math.round((base + jitter) * 10) / 10;
}

/** Stable tilt with no side bias, so a note leans either way at random. */
function rotationForNote(noteId: string): number {
  const tilt = (seeded(`${noteId}:rot`)() - 0.5) * TWO_COL_ROTATION_SPREAD;
  return Math.round(tilt * 10) / 10;
}

/**
 * The dense layout for busier boards. Notes are replayed oldest → newest,
 * each one dropped at the top and settling older notes downward. Because the
 * fold only depends on id/createdAt/format/width/rotation — never on
 * device-local randomness — every phone renders the exact same board.
 * Editing a note keeps its createdAt, so it never jumps back to the top.
 */
function foldLayout(ordered: NoteWithAuthor[], measured: MeasuredHeights): BoardLayout {
  const placed: (PlacedNote & { id: string })[] = [];
  const byId = new Map<string, PlacedNote & { id: string }>();
  const rotations = new Map<string, number>();

  for (const note of ordered) {
    const w = widthFracForNote(note);
    const h = measured[note.id] ?? noteRefHeight(note, w);
    const insert = insertAtTop(
      placed,
      {
        text: note.text,
        imageUrl: note.imageUrl,
        kind: note.kind,
        authorId: note.authorId,
        expiresAt: note.expiresAt,
        data: note.data,
      },
      h,
    );
    for (const m of insert.moves) {
      const p = byId.get(m.id);
      if (p) p.y = m.y;
    }
    const rect = { id: note.id, x: insert.x, y: insert.y, w, h };
    placed.push(rect);
    byId.set(note.id, rect);
    rotations.set(note.id, rotationForZone(insert.zone, note.id));
  }

  // Read positions only after the full fold, so notes pushed down by later
  // arrivals report their settled y rather than their original slot.
  const layout: BoardLayout = new Map();
  for (const p of placed) {
    layout.set(p.id, {
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      rotation: rotations.get(p.id) ?? 0,
    });
  }
  return layout;
}

/**
 * The roomy layout for small boards. Two sections split the width evenly and
 * papers stretch to cover their section, so a handful of notes fill the board
 * instead of clustering in a corner. Notes are balanced between the two
 * sections, stacked with a gap, and never overlap.
 */
function twoColumnLayout(ordered: NoteWithAuthor[], measured: MeasuredHeights): BoardLayout {
  type ColumnNote = PlacedNote & { id: string; rotation: number };
  const columns: ColumnNote[][] = [[], []];
  const bottoms = [TOP_Y, TOP_Y];

  for (const note of ordered) {
    const w = Math.max(twoColWidthFrac(note), TWO_COL_MIN_W);
    const h = Math.max(measured[note.id] ?? noteRefHeight(note, w), TWO_COL_MIN_H);
    const column = bottoms[0] <= bottoms[1] ? 0 : 1;

    // Newest note lands on top; the rest of the section settles below it.
    for (const placed of columns[column]) placed.y += h + TWO_COL_ROW_GAP;

    const edge = column === 0 ? TWO_COL_EDGE : 1 - TWO_COL_EDGE - w;
    const wobble = (seeded(`${note.id}:x`)() - 0.5) * TWO_COL_X_JITTER;
    const x = Math.max(0.012, Math.min(1 - w - 0.012, edge + wobble));

    columns[column].unshift({
      id: note.id,
      x,
      y: TOP_Y,
      w,
      h,
      rotation: rotationForNote(note.id),
    });
    bottoms[column] += h + TWO_COL_ROW_GAP;
  }

  const layout: BoardLayout = new Map();
  for (const column of columns) {
    for (const p of column) layout.set(p.id, p);
  }
  return layout;
}

/**
 * Derive the whole board deterministically from note metadata alone. Small
 * boards get two roomy sections; busier ones fall back to the denser fold.
 * Notes dragged by hand keep the spot they were dropped in for either mode,
 * and the underlying layout still runs for them so their neighbours never
 * shift.
 */
export function computeBoardLayout(
  notes: NoteWithAuthor[],
  measured: MeasuredHeights = {},
): BoardLayout {
  const ordered = [...notes].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const base =
    ordered.length <= TWO_COLUMN_MAX
      ? twoColumnLayout(ordered, measured)
      : foldLayout(ordered, measured);

  const byIdNote = new Map(ordered.map((n) => [n.id, n]));
  const layout: BoardLayout = new Map();
  for (const [id, p] of base) {
    const note = byIdNote.get(id);
    const manual = note ? manualPlacement(note) : null;
    layout.set(id, manual ? { ...p, x: manual.x, y: manual.y } : p);
  }
  return layout;
}

/** Rough visual height estimate, tuned to the real rendered papers. */
export function estimateNoteHeight(note: NoteWithAuthor, widthPx = 175): number {
  const variant = pinVariantForNote(note);
  const linesFor = (len: number, fs: number, lineH: number, max: number) => {
    const charsPerLine = Math.max(8, widthPx / (fs * 0.5));
    return Math.min(max, Math.max(1, Math.ceil(len / charsPerLine))) * lineH;
  };
  const attrH = 34; // attribution row: margin + avatar
  switch (variant) {
    case 'photo':
      return 250 + Math.min(3, note.text.split('\n').length) * 26;
    case 'mini': {
      const fs = 19;
      return 24 + linesFor(note.text.length, fs, fs * 1.25, 3) + attrH;
    }
    case 'announcement': {
      const fs = 27;
      return 32 + linesFor(note.text.length, fs, fs * 1.25, 8) + attrH;
    }
    case 'list': {
      const { items, title } = parseListItems(note.text);
      const shown = Math.min(items.length, 7);
      return 48 + (title ? 34 : 0) + shown * 30 + (items.length > shown ? 26 : 0) + attrH;
    }
    case 'appointment': {
      const fs = 22;
      const data = note.data as { eventAt?: unknown } | null;
      const hasEvent = !!data && typeof data.eventAt === 'string' && !!data.eventAt;
      return 32 + linesFor(note.text.length, fs, fs * 1.2, 3) + (hasEvent ? 56 : 0) + attrH;
    }
    case 'receipt': {
      return 100 + linesFor(note.text.length, 13.5, 20, 8) + attrH;
    }
    default: {
      const fs = fontSizeForText(note.text);
      return 32 + linesFor(note.text.length, fs, fs * 1.25, 6) + attrH + (note.expiresAt ? 24 : 0);
    }
  }
}
