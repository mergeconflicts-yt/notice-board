import { BoardColor, ItemColor } from '../types';

/**
 * The single source of truth for colour. Components never hardcode a hex or
 * rgba value — they reference these semantic tokens, or look a colour up by
 * its available ID (`noteColors[ItemColor]`, `boardColors[BoardColor]`).
 * Re-theming means editing this file only.
 */
export const colors = {
  // Surfaces
  background: '#FBF5E9',
  surface: '#FFFFFF',

  // Ink / text
  ink: '#3E362E',
  inkSoft: '#6B6156',
  inkFaint: '#A3998C',

  // Accents
  accent: '#E98A5E',
  accentDeep: '#D6754A',
  /** Accent-tinted pill/background (e.g. role chips). */
  highlight: '#FFF0E4',
  /** Softer accent wash (selected controls). */
  accentWash: '#FFF7EC',
  /** Selected tab / toggle background. */
  selected: '#FBEFC3',

  // Lines
  border: '#EDE4D3',
  /** Strong divider between board sections. */
  divider: 'rgba(62, 54, 46, 0.28)',
  /** Faint divider inside a paper (checklist rows). */
  hairline: 'rgba(62, 54, 46, 0.14)',

  // Paper
  /** Warm-white paper (list/photo/photo sheets). */
  paper: '#FFFDF7',
  paperEdge: '#EAE0CC',

  // Overlays
  /** Modal scrim. */
  scrim: 'rgba(62, 54, 46, 0.35)',
  /** Dim behind the note-detail popup. */
  backdrop: 'rgba(62, 54, 46, 0.12)',
  /** Frosted action pill on the detail popup. */
  overlay: 'rgba(255, 255, 255, 0.9)',
  /** Dark badge (e.g. photo remove button). */
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  /** Subtle wash behind a loading image. */
  imageWash: 'rgba(0, 0, 0, 0.04)',
  /** Ring around stacked avatars. */
  avatarRing: 'rgba(255, 255, 255, 0.85)',

  // Shadow
  shadow: 'rgba(92, 76, 54, 0.18)',

  // Danger
  danger: '#D9564A',

  white: '#FFFFFF',
  black: '#000000',
} as const;

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

/** Solid member-dot colours (board header + post attribution), hashed by user. */
export const memberColors = [
  '#6AA84F',
  '#C05B4D',
  '#4A7FB5',
  '#C99A2E',
  '#8E7CC3',
  '#4FA3A3',
] as const;

/** Board cover tints. */
export const boardColors: Record<BoardColor, string> = {
  sage: '#C9DCC0',
  blue: '#BCD2E8',
  clay: '#E5C3AE',
  cream: '#F1E4C3',
  charcoal: '#B9B4AD',
};

export const boardColorKeys = Object.keys(boardColors) as BoardColor[];

/** Decorative junk-drawer fastener colours (used by Pin). */
export const fastenerColors = {
  pins: ['#E2574C', '#3E7CB1', '#F2B134', '#6AA84F', '#8E7CC3'],
  tapes: [
    'rgba(244, 227, 178, 0.92)',
    'rgba(238, 196, 205, 0.88)',
    'rgba(186, 212, 238, 0.88)',
    'rgba(201, 221, 190, 0.88)',
  ],
  stickers: ['#F6C445', '#F194B4', '#9CCB86', '#8FB8DE', '#C3B2E8', '#F49E4C'],
  clip: '#3E362E',
  metal: '#C9CFD6',
  metalEdge: '#9AA1A9',
  metalDark: '#7C838C',
  scotch: 'rgba(238, 242, 246, 0.65)',
  scotchBody: 'rgba(238, 242, 246, 0.6)',
  scotchEdge: 'rgba(255, 255, 255, 0.7)',
  sheen: 'rgba(255, 255, 255, 0.55)',
  glint: 'rgba(255, 255, 255, 0.75)',
  tapeEdge: 'rgba(255, 255, 255, 0.35)',
  shadow: 'rgba(62, 54, 46, 0.28)',
  shadowSoft: 'rgba(62, 54, 46, 0.25)',
  outline: 'rgba(0, 0, 0, 0.14)',
  outlineStrong: 'rgba(0, 0, 0, 0.3)',
  outlineFaint: 'rgba(0, 0, 0, 0.08)',
} as const;
