import { ItemColor, ItemType, ItemWithAuthor } from '../types';
import { noteColorKeys } from '../theme';

/** Deterministic colour deal for an item id (used when the user doesn't pick). */
export function colorForItem(seed: string): ItemColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return noteColorKeys[h % noteColorKeys.length];
}

/** Stable tilt in degrees, roughly ±4.5°. */
export function rotationForItem(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const v = (h % 100) / 100;
  return Math.round((v - 0.5) * 90) / 10;
}

/** Visual paper style — driven entirely by the author's chosen type. */
export type PaperVariant = 'note' | 'list' | 'appointment' | 'photo';

export function paperVariantFor(type: ItemType): PaperVariant {
  switch (type) {
    case 'list':
      return 'list';
    case 'date':
      return 'appointment';
    case 'photo':
      return 'photo';
    default:
      return 'note';
  }
}

export type ListItem = { text: string; done: boolean };

const LIST_MARKER =
  /^\s*(?:[-•*○◯☐□▪▫◦–—]|\d+[.)]|\(\d+\)|\[ ?\]|\[x\]|☐|☑|☒|✓|✔|✗)\s+/i;
const DONE_MARKER = /^\s*(?:\[x\]|☑|☒|✓|✔)\s+/i;

/** Parse composer text into a title + checklist rows (composer convenience only). */
export function parseListItems(text: string): { title: string | null; items: ListItem[] } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items: ListItem[] = [];
  let title: string | null = null;
  for (const line of lines) {
    if (LIST_MARKER.test(line)) {
      const cleaned = line.replace(LIST_MARKER, '').trim();
      items.push({ text: cleaned || line, done: DONE_MARKER.test(line) });
    } else if (items.length === 0 && title === null) {
      title = line;
    } else {
      return { title: null, items: [] };
    }
  }
  if (items.length < 1) return { title: null, items: [] };
  return { title, items };
}

/** Human date for a date item's event. */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Leaves the board Thu 1 Oct" style copy, straight from the server's keep_until. */
export function keepUntilLabel(keepUntil: string | null): string | null {
  if (!keepUntil) return null;
  const d = new Date(keepUntil);
  if (Number.isNaN(d.getTime())) return null;
  const label = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Leaves the board ${label}`;
}

/** Caption / body preview used for accessibility labels. */
export function itemPreview(item: ItemWithAuthor): string {
  const text = (item.body ?? item.title ?? '').trim().replace(/\s+/g, ' ');
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export const AVATAR_EMOJIS = [
  '🐻', '🦊', '🐰', '🐼', '🐨', '🦁', '🐸', '🐙', '🦉', '🐳',
  '🐶', '🐱', '🦄', '🐯', '🐮', '🐷', '🦋', '🐢', '🦜', '🦔',
];
