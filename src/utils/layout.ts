import { NoteWithAuthor } from '../types';
import { parseListItems, pinVariantForNote } from './note';

/** Rough visual height estimate used to balance two masonry columns. */
export function estimateNoteHeight(note: NoteWithAuthor): number {
  const variant = pinVariantForNote(note);
  switch (variant) {
    case 'photo':
      return 250 + Math.min(3, note.text.split('\n').length) * 26;
    case 'mini':
      return 118;
    case 'announcement':
      return 190 + note.text.length * 1.0;
    case 'list': {
      const { items, title } = parseListItems(note.text);
      return 110 + (title ? 32 : 0) + Math.min(items.length, 7) * 26;
    }
    case 'appointment':
      return 210;
    case 'receipt':
      return 140 + note.text.length * 0.9;
    default: {
      let h = 64; // padding + attribution row
      h += Math.min(1, note.text.length / 22) * 96;
      h += note.text.length * 1.4;
      return h;
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
