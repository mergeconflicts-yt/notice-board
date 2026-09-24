import { ItemWithAuthor } from '../types';
import { rotationForItem } from './note';

/** Reference board width in points; x/width are stored as fractions. */
export const REF_W = 390;
const TOP_Y = 14;
const COLUMN_GAP = 0.02;
const COLUMN_W = (1 - 2 * 0.04 - COLUMN_GAP) / 2;
const MIN_H = 90;

export type BoardPlacement = { x: number; y: number; w: number; h: number; rotation: number };
export type BoardLayout = Map<string, BoardPlacement>;

type Dims = Pick<ItemWithAuthor, 'id' | 'type' | 'body' | 'title' | 'eventAt'>;

/** Rough height estimate (ref points) at the given width fraction. */
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
    default:
      return 34 + 24 * lines(item.body, 6);
  }
}

/**
 * Deterministic two-column board (docs/plan.md §9): positions come from the
 * item order and ids alone — no stored drag positions. Notes are dealt into
 * the shorter column, with a stable tilt per id.
 */
export function computeBoardLayout(items: ItemWithAuthor[]): BoardLayout {
  const ordered = [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const bottoms = [TOP_Y, TOP_Y];
  const layout: BoardLayout = new Map();

  for (const item of ordered) {
    const w = COLUMN_W;
    const h = Math.max(MIN_H, estimateItemHeight(item, w));
    const column = bottoms[0] <= bottoms[1] ? 0 : 1;
    const x = column === 0 ? 0.04 : 0.04 + COLUMN_W + COLUMN_GAP;
    // A hand-placed item keeps its saved spot; everything else flows.
    const manual = item.layout?.manual ? item.layout : null;
    layout.set(item.id, {
      x: manual ? manual.x : x,
      y: manual ? manual.y : bottoms[column],
      w,
      h,
      rotation: rotationForItem(item.id),
    });
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
