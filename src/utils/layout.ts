import { NoteWithAuthor } from '../types';
import { fontSizeForText, parseListItems, pinVariantForNote } from './note';
import { seeded } from './id';

/** Reference board width in points. x/width are stored 0-1; y is stored
 *  in these reference points and scaled by (boardWidth / REF_W) at render,
 *  so placement scales across phone sizes. */
export const REF_W = 390;

/** Small intentional overlap so pins feel casually assembled (ref points). */
const OVERLAP = 10;

/** Stable width seed shared by creation-time packing and render. */
function widthSeed(input: { text: string; kind: string; authorId: string }): string {
  return `${input.text}|${input.kind}|${input.authorId}`;
}

type DimsInput = {
  text: string;
  imageUrl: string | null;
  kind: string;
  authorId: string;
};

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

/** Reference-space height for a note at the given width fraction. */
export function noteRefHeight(note: NoteWithAuthor, frac: number): number {
  return estimateNoteHeight(note, frac * REF_W);
}

export type PlacedNote = { x: number; y: number; w: number; h: number };

function dimsFor(note: NoteWithAuthor): { w: number; h: number } {
  const w = widthFracForNote(note);
  return { w, h: noteRefHeight(note, w) };
}

/** Find a free, slightly irregular — and slightly overlapping — spot. */
export function findSpot(placed: PlacedNote[], input: DimsInput): { x: number; y: number } {
  const r = seeded(`${widthSeed(input)}:spot`);
  const wFrac = widthFracForNote(input);
  const probe = {
    text: input.text,
    imageUrl: input.imageUrl,
    kind: input.kind,
    authorId: input.authorId,
  } as NoteWithAuthor;
  const h = noteRefHeight(probe, wFrac);
  const maxY = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  const slots = Array.from({ length: 9 }, (_, i) => 0.03 + i * 0.1);
  const start = Math.floor(r() * slots.length);
  for (let y = 12; y < maxY + 500; y += 16) {
    for (let k = 0; k < slots.length; k++) {
      const rawX = slots[(start + k) % slots.length];
      const x = Math.min(rawX, 1 - wFrac - 0.03);
      if (x < 0.02) continue;
      const clash = placed.some(
        (p) =>
          x < p.x + p.w - OVERLAP / REF_W &&
          x + wFrac - OVERLAP / REF_W > p.x &&
          y < p.y + p.h - OVERLAP &&
          y + h - OVERLAP > p.y,
      );
      if (!clash) return { x, y };
    }
  }
  return { x: 0.05 + r() * Math.max(0.05, 0.9 - wFrac), y: maxY + 20 };
}

/** Packing dims for notes that already have persisted positions. */
export function placedDims(notes: NoteWithAuthor[]): (PlacedNote & { id: string })[] {
  return notes.map((n) => {
    const { w, h } = dimsFor(n);
    return { id: n.id, x: n.positionX, y: n.positionY, w, h };
  });
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

/**
 * Distribute notes into two balanced columns (greedy by estimated height).
 * Notes are expected to already be in display order.
 */
export function splitIntoColumns(notes: NoteWithAuthor[]): [NoteWithAuthor[], NoteWithAuthor[]] {
  const left: NoteWithAuthor[] = [];
  const right: NoteWithAuthor[] = [];
  let leftH = 0;
  let rightH = 0;

  for (const note of notes) {
    const h = estimateNoteHeight(note);
    if (leftH <= rightH) {
      left.push(note);
      leftH += h;
    } else {
      right.push(note);
      rightH += h;
    }
  }
  return [left, right];
}
