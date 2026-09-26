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

  // Fridge chrome
  /** Dark cabinet strip visible between the two fridge doors. */
  seam: '#2B2620',
  /** Brushed-steel face of the vertical door handles, light edge to dark. */
  steel: ['#FAF8F3', '#E6E1D4', '#C6C0B0', '#9D9787'],
} as const;

/** Paper palettes for the seven item colours: main colour, ink, then the
 *  shadow-side colour as the edge. (`peach` holds Announcement green — the
 *  key names are internal only; the DB enum is untouched.) */
export const noteColors: Record<
  ItemColor,
  { bg: string; ink: string; edge: string; shadow: string }
> = {
  butter: { bg: '#FFF3A6', ink: '#4A3E22', edge: '#F2DF78', shadow: 'rgba(168, 143, 66, 0.28)' },
  blush: { bg: '#F8DDE0', ink: '#53343C', edge: '#EEC5CA', shadow: 'rgba(188, 124, 136, 0.28)' },
  sage: { bg: '#DDF3D5', ink: '#2E4330', edge: '#C6E5BC', shadow: 'rgba(106, 138, 90, 0.26)' },
  sky: { bg: '#DCECF8', ink: '#263E57', edge: '#C5DDED', shadow: 'rgba(94, 138, 182, 0.26)' },
  lavender: { bg: '#E9E0F6', ink: '#3D3458', edge: '#D7C9EC', shadow: 'rgba(122, 108, 168, 0.26)' },
  peach: { bg: '#D4F0DC', ink: '#2F4A34', edge: '#BDE2C7', shadow: 'rgba(90, 140, 105, 0.28)' },
  paper: { bg: '#FFFDF7', ink: '#3E362E', edge: '#F2EEE5', shadow: 'rgba(120, 108, 88, 0.22)' },
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

/** Board cover tints. Cream is plain white paper. */
export const boardColors: Record<BoardColor, string> = {
  sage: '#C9DCC0',
  blue: '#BCD2E8',
  clay: '#E5C3AE',
  cream: '#FFFDF7',
  charcoal: '#B9B4AD',
  mint: '#BFE3D0',
  butter: '#F4E3A1',
  blush: '#F2C9CE',
  powder: '#C9D8E8',
};

export const boardColorKeys = Object.keys(boardColors) as BoardColor[];

/** Enamel door tints per board colour: light face, base, shaded edge —
 *  the website fridge doors sprayed onto the app board. */
export const doorTints: Record<BoardColor, { light: string; base: string; shade: string }> = {
  sage: { light: '#DCE8D6', base: '#C9DCC0', shade: '#A9BE9C' },
  blue: { light: '#D3E3F2', base: '#BCD2E8', shade: '#9DBBD9' },
  clay: { light: '#F1D8C6', base: '#E5C3AE', shade: '#D0A78D' },
  cream: { light: '#FFFFFF', base: '#FFFDF7', shade: '#E7DCC6' },
  charcoal: { light: '#D2CEC7', base: '#B9B4AD', shade: '#A09B93' },
  mint: { light: '#CDE9D9', base: '#A3D4BA', shade: '#79B495' },
  butter: { light: '#F9ECB8', base: '#EDD68A', shade: '#D3B45E' },
  blush: { light: '#F8D5DA', base: '#E9AEB6', shade: '#C98891' },
  powder: { light: '#D5E2F2', base: '#ACC3DD', shade: '#7E9CBE' },
};

/** Handle face per door colour: a deeper enamel tone that belongs with the
 *  door instead of generic steel. */
export const handleTints: Record<BoardColor, [string, string, string]> = {
  sage: ['#A9C29B', '#8BA87D', '#6E8F61'],
  blue: ['#9DBEDC', '#7FA3C6', '#5F86AC'],
  clay: ['#D8A985', '#C08A63', '#A06B45'],
  cream: ['#D9CBAE', '#C2B28E', '#A8976F'],
  charcoal: ['#8E8980', '#736E66', '#57534C'],
  mint: ['#79B495', '#5F9A7C', '#477A60'],
  butter: ['#D3B45E', '#B8943F', '#8F7330'],
  blush: ['#C98891', '#A96C75', '#875057'],
  powder: ['#7E9CBE', '#62819F', '#48637D'],
};

/** Nameplate face per door colour: lighter enamel than the door with a
 *  darker engraved edge and screw heads. */
export const plateTints: Record<
  BoardColor,
  { bg: string; edge: string; screw: string; screwEdge: string }
> = {
  sage: { bg: '#CBDDBF', edge: '#8AA37C', screw: '#6E8F61', screwEdge: '#4E6A44' },
  blue: { bg: '#C3D8EC', edge: '#7CA0C2', screw: '#5F86AC', screwEdge: '#42607E' },
  clay: { bg: '#EAC9AE', edge: '#B9835C', screw: '#9C6846', screwEdge: '#73492E' },
  cream: { bg: '#F4EAD2', edge: '#C4AC7E', screw: '#A8976F', screwEdge: '#7D6D49' },
  charcoal: { bg: '#BDB8B0', edge: '#7E7972', screw: '#57534C', screwEdge: '#38352F' },
  mint: { bg: '#D8EDDF', edge: '#8CC3A6', screw: '#63A281', screwEdge: '#477A60' },
  butter: { bg: '#FAF0C2', edge: '#D9BC62', screw: '#B8943F', screwEdge: '#8A6F2D' },
  blush: { bg: '#FADFE2', edge: '#D69AA3', screw: '#B4717B', screwEdge: '#8C525A' },
  powder: { bg: '#DEE8F5', edge: '#8CADCF', screw: '#6889AC', screwEdge: '#4A6580' },
};

/** The single fastener everywhere: round magnets in fixed colours (used by Pin). */
export const fastenerColors = {
  magnets: ['#E4572E', '#F2B134', '#2A9D8F', '#3D5A98', '#D96C95'],
} as const;
