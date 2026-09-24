import { NoteColor } from '../types';
import { noteColorKeys, noteColors } from '../theme';

export function colorForNote(seed: string): NoteColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return noteColorKeys[h % noteColorKeys.length];
}

export function rotationForNote(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  // -4.5 .. 4.5 degrees, skewed slightly so most notes lean gently
  const v = (h % 100) / 100;
  return Math.round((v - 0.5) * 90) / 10;
}

export function fontSizeForText(text: string): number {
  if (text.length <= 28) return 22;
  if (text.length <= 70) return 20;
  return 18;
}

export function isLightColor(color: NoteColor): boolean {
  return !!noteColors[color];
}

/** Visual pin shape, inferred from content behind the scenes. */
export type PinVariant =
  | 'mini'
  | 'note'
  | 'announcement'
  | 'photo'
  | 'list'
  | 'appointment'
  | 'receipt';

export type ListItem = { text: string; done: boolean };

const LIST_MARKER =
  /^\s*(?:[-•*○◯☐□▪▫◦–—]|\d+[.)]|\(\d+\)|\[ ?\]|\[x\]|☐|☑|☒|✓|✔|✗)\s+/i;
const DONE_MARKER = /^\s*(?:\[x\]|☑|☒|✓|✔)\s+/i;

const TIME_RE = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;
const DAY_RE =
  /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow|tonight|weekend)\b/i;
const APPT_WORD_RE =
  /(appointment|dentist|doctor|meeting|service|visit|flight|trip|reservation|interview|call|dinner|party|pickup|drop-?off|shower|ceremony)/i;
const RECEIPT_RE =
  /(wifi|wi-?fi|password|passcode|total|\$\s?\d|receipt|check-?in|gate|seat|booking|code\s*[:#=]|pin\s*[:#=])/i;

/** Checklist lines with explicit markers ("- Milk", "☐ Milk", "1. Milk"). */
export function parseMarkedItems(text: string): { title: string | null; items: ListItem[] } {
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

/** Split "title + checklist lines" notes. Also treats bare multi-line
 *  short text ("Milk\nEggs\nBread") as a list. */
export function parseListItems(text: string): { title: string | null; items: ListItem[] } {
  const marked = parseMarkedItems(text);
  if (marked.items.length >= 1) return marked;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 3 && lines.every((l) => l.length <= 32) && text.trim().length <= 140) {
    return { title: lines[0], items: lines.slice(1).map((t) => ({ text: t, done: false })) };
  }
  return { title: null, items: [] };
}

export function pinVariantForNote(input: {
  text: string;
  imageUrl: string | null;
  kind: string;
  expiresAt: string | null;
}): PinVariant {
  const kind = input.kind ?? '';
  if (input.imageUrl || kind === 'photo') return 'photo';
  if (kind === 'list' || kind === 'grocery') return 'list';
  if (kind === 'appointment' || kind === 'date') return 'appointment';

  const text = (input.text ?? '').trim();

  // A chosen plain note stays a plain note: the words are never
  // second-guessed into a list, appointment, or receipt style. Only the
  // size-based mini/announcement styles still apply.
  if (kind === 'note') {
    const lineCount = text.split('\n').filter((l) => l.trim()).length;
    if (text.length >= 110 || lineCount >= 4) return 'announcement';
    if (!text.includes('\n') && text.length <= 26 && input.expiresAt == null) return 'mini';
    return 'note';
  }

  // Unknown kinds (legacy/defensive): keep the old content-guessing behavior.
  if (parseMarkedItems(text).items.length >= 1) {
    return 'list';
  }

  if (
    (TIME_RE.test(text) && (DAY_RE.test(text) || APPT_WORD_RE.test(text))) ||
    (input.expiresAt != null && TIME_RE.test(text) && text.length <= 80)
  ) {
    return 'appointment';
  }

  if (RECEIPT_RE.test(text) && text.length <= 140) return 'receipt';

  if (parseListItems(text).items.length >= 1) return 'list';

  const lineCount = text.split('\n').filter((l) => l.trim()).length;
  if (text.length >= 110 || lineCount >= 4) return 'announcement';

  if (!text.includes('\n') && text.length <= 26 && input.expiresAt == null) return 'mini';

  return 'note';
}

export const AVATAR_EMOJIS = [
  '🐻', '🦊', '🐰', '🐼', '🐨', '🦁', '🐸', '🐙', '🦉', '🐳',
  '🐶', '🐱', '🦄', '🐯', '🐮', '🐷', '🦋', '🐢', '🦜', '🦔',
];
