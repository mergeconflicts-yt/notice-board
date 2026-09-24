import { BoardColor, ItemColor } from '../types';

export const colors = {
  // Surfaces
  background: '#FBF5E9',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFDF8',

  // Ink / text
  ink: '#3E362E',
  inkSoft: '#6B6156',
  inkFaint: '#A3998C',

  // Accents
  accent: '#E98A5E',
  accentDeep: '#D6754A',
  tape: '#F4E3B2',

  // Lines
  border: '#EDE4D3',
  hairline: 'rgba(62, 54, 46, 0.08)',

  // Shadow
  shadow: 'rgba(92, 76, 54, 0.18)',

  // Danger
  danger: '#D9564A',

  white: '#FFFFFF',
} as const;

export type NoteColorKey = ItemColor;

/** Paper palettes for the seven item colours. */
export const noteColors: Record<
  ItemColor,
  { bg: string; ink: string; edge: string; shadow: string }
> = {
  butter: { bg: '#FCEFB4', ink: '#4A3E22', edge: '#E9D98F', shadow: 'rgba(168, 143, 66, 0.28)' },
  blush: { bg: '#FAD9DD', ink: '#53343C', edge: '#EBBFC6', shadow: 'rgba(188, 124, 136, 0.28)' },
  sage: { bg: '#DBEBCB', ink: '#2E4330', edge: '#C4D9AE', shadow: 'rgba(106, 138, 90, 0.26)' },
  sky: { bg: '#D7E7F7', ink: '#263E57', edge: '#BBD3EC', shadow: 'rgba(94, 138, 182, 0.26)' },
  lavender: { bg: '#E6E0F5', ink: '#3D3458', edge: '#CFC6E8', shadow: 'rgba(122, 108, 168, 0.26)' },
  peach: { bg: '#FADFCB', ink: '#5A3A22', edge: '#EEC7A9', shadow: 'rgba(190, 130, 84, 0.26)' },
  paper: { bg: '#FFFDF7', ink: '#3E362E', edge: '#EAE0CC', shadow: 'rgba(120, 108, 88, 0.22)' },
};

export const noteColorKeys = Object.keys(noteColors) as ItemColor[];

/** Board cover tints. */
export const boardColors: Record<BoardColor, string> = {
  sage: '#C9DCC0',
  blue: '#BCD2E8',
  clay: '#E5C3AE',
  cream: '#F1E4C3',
  charcoal: '#B9B4AD',
};

export const boardColorKeys = Object.keys(boardColors) as BoardColor[];
