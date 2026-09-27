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
  sage: '#AFCDA1',
  blue: '#98BBDE',
  clay: '#DBA98A',
  cream: '#FFF7DE',
  charcoal: '#A69E92',
  mint: '#9ED6B8',
  butter: '#F1D876',
  blush: '#EAA3AC',
  powder: '#A8C1DC',
};

export const boardColorKeys = Object.keys(boardColors) as BoardColor[];

/** Enamel door tints per board colour: light face, base, shaded edge —
 *  the website fridge doors sprayed onto the app board. */
export const doorTints: Record<BoardColor, { light: string; base: string; shade: string }> = {
  sage: { light: '#B6D1A9', base: '#9DBBA8', shade: '#A4C295' },
  blue: { light: '#A0C1E2', base: '#98BBDE', shade: '#8EB3D8' },
  clay: { light: '#E0B192', base: '#DBA98A', shade: '#D39F7F' },
  cream: { light: '#FBF5E5', base: '#FFF7DE', shade: '#F4EACF' },
  charcoal: { light: '#AFA79B', base: '#A69E92', shade: '#9D9589' },
  mint: { light: '#91CEAD', base: '#82C7A2', shade: '#74BB95' },
  butter: { light: '#EED16F', base: '#E9C960', shade: '#DFBC52' },
  blush: { light: '#E795A0', base: '#E18894', shade: '#D47C88' },
  powder: { light: '#98B6D9', base: '#8AABD1', shade: '#7A9DC6' },
};

/** Handle face per door colour: a deeper enamel tone that belongs with the
 *  door instead of generic steel. */
export const handleTints: Record<BoardColor, [string, string, string]> = {
  sage: ['#90B37C', '#729761', '#58764D'],
  blue: ['#79A8D2', '#5D8CBA', '#496F94'],
  clay: ['#CF9060', '#B17244', '#825535'],
  cream: ['#CCB88D', '#B49F6E', '#948155'],
  charcoal: ['#797367', '#5C574F', '#403C35'],
  mint: ['#59A67E', '#4B8065', '#355E49'],
  butter: ['#CCA437', '#987931', '#6E5823'],
  blush: ['#BD6672', '#94535D', '#6C3D43'],
  powder: ['#5D84B1', '#4E6A85', '#364C61'],
};

/** Nameplate face per door colour: lighter enamel than the door with a
 *  darker engraved edge and screw heads. */
export const plateTints: Record<
  BoardColor,
  { bg: string; edge: string; screw: string; screwEdge: string }
> = {
  sage: { bg: '#B2CFA0', edge: '#729061', screw: '#58764D', screwEdge: '#394F31' },
  blue: { bg: '#9FC1E2', edge: '#5A89B6', screw: '#496F94', screwEdge: '#314961' },
  clay: { bg: '#E2B188', edge: '#A46C43', screw: '#7E5336', screwEdge: '#533420' },
  cream: { bg: '#ECD9AC', edge: '#B8985C', screw: '#948155', screwEdge: '#625437' },
  charcoal: { bg: '#AAA295', edge: '#68625A', screw: '#403C35', screwEdge: '#201E19' },
  mint: { bg: '#B8E0C5', edge: '#6CB58F', screw: '#4E896A', screwEdge: '#355E49' },
  butter: { bg: '#F8E696', edge: '#D2AD3B', screw: '#987931', screwEdge: '#695420' },
  blush: { bg: '#F5B6BD', edge: '#CB7784', screw: '#A4535F', screwEdge: '#713F46' },
  powder: { bg: '#BACFEB', edge: '#6A96C4', screw: '#4F7297', screwEdge: '#384E64' },
};

/** The single fastener everywhere: round magnets in fixed colours (used by Pin). */
export const fastenerColors = {
  magnets: ['#E4572E', '#F2B134', '#2A9D8F', '#3D5A98', '#D96C95'],
} as const;
