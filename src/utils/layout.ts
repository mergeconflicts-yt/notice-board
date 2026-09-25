import { ItemWithAuthor } from '../types';
import { seeded } from './id';
import { rotationForItem } from './note';

/** Reference board width in points; x/width are stored as fractions. */
export const REF_W = 390;
const TOP_Y = 14;
const COLUMN_GAP = 0.02;
const COLUMN_W = (1 - 2 * 0.04 - COLUMN_GAP) / 2;
const MIN_H = 90;

export type BoardPlacement = { x: number; y: number; w: number; h: number; rotation: number };
export type BoardLayout = Map<string, BoardPlacement>;

/** Minimum vertical gap kept between two posts (ref points). */
const Y_GAP = 10;
const EDGE = 0.02;

type Rect = { x: number; y: number; w: number; h: number };

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Nudge a rect so it touches no other rect: keep it on the board horizontally,
 * then push it straight down past everything it overlaps. Positions are in the
 * layout's own space (x a fraction of width, y in ref points).
 */
export function settleNoOverlap(x: number, y: number, w: number, h: number, others: Rect[]) {
  const nx = Math.max(EDGE, Math.min(1 - EDGE - w, x));
  let ny = Math.max(0, y);
  for (let guard = 0; guard < 200; guard++) {
    let nextBottom = ny;
    let collided = false;
    for (const q of others) {
      if (overlaps({ x: nx, y: ny, w, h }, q)) {
        collided = true;
        nextBottom = Math.max(nextBottom, q.y + q.h + Y_GAP);
      }
    }
    if (!collided) break;
    ny = nextBottom;
  }
  return { x: nx, y: ny };
}

type Dims = Pick<ItemWithAuthor, 'id' | 'type' | 'body' | 'title' | 'eventAt'>;

/** Rendered post heights (ref points) keyed by id, reported by onLayout.
 *  When present these replace the rough estimate, so a taller-than-guessed
 *  post can never be given too little room and overlap its neighbour. */
export type MeasuredHeights = Record<string, number>;

/** Rough height estimate (ref points) at the given width fraction. Mirrors the
 *  handwriting size tiers in NotePaper so first paint doesn't jump. */
export function estimateItemHeight(item: Dims, wFrac: number): number {
  const widthPx = wFrac * REF_W;
  const charsPerLine = Math.max(8, widthPx / 11);
  const lines = (text: string | null, max: number) =>
    Math.min(max, Math.max(1, Math.ceil((text?.length ?? 0) / charsPerLine)));
  switch (item.type) {
    case 'photo':
      return 22 + widthPx * 0.9 + (item.body ? 26 : 0);
    case 'list':
      return 44 + (item.title ? 30 : 0) + 30 * 3;
    case 'date':
      return 40 + 28 * lines(item.title, 3) + 54;
    default: {
      const trimmed = (item.body ?? '').trim();
      if (trimmed.length > 0 && trimmed.length <= 20 && !trimmed.includes('\n')) {
        return 60 + 40 * lines(item.body, 6);
      }
      const perLine = trimmed.length <= 60 ? 30 : 24;
      return (trimmed.length <= 60 ? 50 : 34) + perLine * lines(item.body, 6);
    }
  }
}

/**
 * Deterministic two-column board. Auto items are dealt into the shorter
 * column; a hand-placed item keeps its saved spot. Every post is then settled
 * against the ones placed before it, so no two posts ever overlap — even if a
 * dragged drop or a concurrent move would otherwise collide.
 */
export function computeBoardLayout(
  items: ItemWithAuthor[],
  measured: MeasuredHeights = {},
): BoardLayout {
  const ordered = [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const bottoms = [TOP_Y, TOP_Y];
  const layout: BoardLayout = new Map();
  const placed: Rect[] = [];

  for (const item of ordered) {
    const w = COLUMN_W;
    const h = Math.max(MIN_H, measured[item.id] ?? estimateItemHeight(item, w));
    const column = bottoms[0] <= bottoms[1] ? 0 : 1;
    const columnX = column === 0 ? 0.04 : 0.04 + COLUMN_W + COLUMN_GAP;
    const manual = item.layout?.manual ? item.layout : null;
    // Break the grid a little: nudge auto-placed items by a stable,
    // per-item jitter. Manual spots are untouched, and settleNoOverlap still
    // clamps x and prevents any overlap.
    const rand = seeded(item.id + ':x');
    const jitterX = (rand() - 0.5) * 0.03;
    const jitterY = Math.round(rand() * 10);
    const settled = settleNoOverlap(
      manual ? manual.x : columnX + jitterX,
      manual ? manual.y : bottoms[column] + jitterY,
      w,
      h,
      placed,
    );
    layout.set(item.id, { ...settled, w, h, rotation: rotationForItem(item.id) });
    placed.push({ ...settled, w, h });
    bottoms[column] += h + 12;
  }
  return layout;
}

/** Canvas height (px) needed to show every placed item plus headroom. */
export function boardCanvasHeight(layout: BoardLayout, scale: number): number {
  let bottom = 0;
  layout.forEach((p) => {
    bottom = Math.max(bottom, p.y + p.h);
  });
  return Math.max(900 * scale, bottom * scale + 90);
}
