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

  // Ink / text — deep greens: cream screens carry green text.
  ink: '#143C34',
  inkSoft: '#47645B',
  inkFaint: '#93A8A0',

  // Accents — bright orange tuned against pine: fills read ~4.4:1 on the
  // green; small bold uses on cream hold the previous ratio. Keep the pair
  // in step (deep ≈ fill darkened) so active states match their fills.
  accent: '#F26B1D',
  accentDeep: '#CE5410',
  /** Accent-tinted pill/background (e.g. role chips). */
  highlight: '#FFF0E4',
  /** Softer accent wash (selected controls). */
  accentWash: '#FFF7EC',
  /** Selected tab / toggle background. */
  selected: '#FBEFC3',

  // Lines
  border: '#EDE4D3',
  /** Strong divider between board sections. */
  divider: 'rgba(20, 60, 52, 0.28)',
  /** Faint divider inside a paper (checklist rows). */
  hairline: 'rgba(20, 60, 53, 0.14)',

  // Paper
  /** Warm-white paper (list/photo/photo sheets). */
  paper: '#FFFDF7',
  paperEdge: '#EAE0CC',

  // Overlays
  /** Modal scrim. */
  scrim: 'rgba(11, 45, 38, 0.4)',
  /** Dim behind the note-detail popup. */
  backdrop: 'rgba(20, 60, 52, 0.12)',
  /** Frosted action pill on the detail popup. */
  overlay: 'rgba(255, 255, 255, 0.9)',
  /** Dark badge (e.g. photo remove button). */
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  /** Subtle wash behind a loading image. */
  imageWash: 'rgba(0, 0, 0, 0.04)',
  /** Ring around stacked avatars. */
  avatarRing: 'rgba(255, 255, 255, 0.85)',

  // Shadow
  shadow: 'rgba(20, 70, 60, 0.18)',

  // Danger
  danger: '#D9564A',

  white: '#FFFFFF',
  black: '#000000',

  // Brand pine (identity — deep green field, cream ink)
  pine: '#0B4F41',
  pineDeep: '#07332A',
  onPine: '#F6F0DC',
  onPineSoft: 'rgba(246, 240, 220, 0.72)',
  onPineFaint: 'rgba(246, 240, 220, 0.5)',
  brandYellow: '#F1D876',
  /** Ghost button fill on pine: cream at low opacity ("opacity less"). */
  pineGhost: 'rgba(246, 240, 220, 0.14)',
  /** Light-green button fill: pine text on it (~7:1). Secondary buttons. */
  leaf: '#A9CFB2',

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

/** Board cover tints — a vivid multi-hue family at brand intensity, not
 *  pastels. Keys are the stored DB enum: rename nothing, only retune hexes.
 *  Pine + ember keep the brand anchor; blue/mint/powder/blush bring back
 *  variety. `darkDoors` below stays {charcoal, sage, blue}. */
export const boardColors: Record<BoardColor, string> = {
  vintage_mint: '#9ED6B8',
  vintage_butter: '#F1D876',
  vintage_blush: '#EAA3AC',
  vintage_powder: '#A8C1DC',
  charcoal: '#3A3733',
  sage: '#4E7A5C',
  blue: '#3B7BD4',
  mint: '#3ECF8E',
  powder: '#9CC3E5',
  cream: '#FFF3D6',
  butter: '#F0C443',
  clay: '#CE7A45',
  blush: '#E85D7A',
};

/** Doors dark enough to need cream ink instead of ink (badge, chips, id
 *  card). Keep in sync with `boardColors` above. */
export const darkDoors: ReadonlySet<BoardColor> = new Set(['charcoal', 'sage', 'blue']);

export function doorInk(color: BoardColor): string {
  return darkDoors.has(color) ? colors.onPine : colors.ink;
}

export function doorSoft(color: BoardColor): string {
  return darkDoors.has(color) ? colors.onPineSoft : colors.inkSoft;
}

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Readable text on an arbitrary tint: cream below the threshold, ink above.
 *  Threshold picked so every door shade lands cream and every light tint
 *  lands ink. */
export function onTint(bg: string): string {
  return luminance(bg) < 0.3 ? colors.onPine : colors.ink;
}

export const boardColorKeys = Object.keys(boardColors) as BoardColor[];

/** Colors offered in the create/settings pickers, in display order. The rest
 *  stay valid (existing boards keep rendering) — just not offered. */
export const offeredBoardColors: BoardColor[] = [
  'vintage_mint',
  'vintage_powder',
  'powder',
  'cream',
  'sage',
  'vintage_blush',
];

/** Enamel door tints per board colour: light face, base, shaded edge —
 *  the website fridge doors sprayed onto the app board. Bases match
 *  `boardColors`; keep the three in step. */
export const doorTints: Record<BoardColor, { light: string; base: string; shade: string }> = {
  charcoal: { light: '#4C4741', base: '#3A3733', shade: '#2B2724' },
  sage: { light: '#5F8F6E', base: '#4E7A5C', shade: '#3D6448' },
  blue: { light: '#5490DD', base: '#3B7BD4', shade: '#2F63AC' },
  mint: { light: '#5BD9A0', base: '#3ECF8E', shade: '#31A572' },
  powder: { light: '#AED0EB', base: '#9CC3E5', shade: '#82ABCB' },
  cream: { light: '#FFFAEA', base: '#FFF3D6', shade: '#EFE1BC' },
  butter: { light: '#F4D169', base: '#F0C443', shade: '#D4A731' },
  clay: { light: '#DB9060', base: '#CE7A45', shade: '#AF6335' },
  blush: { light: '#ED7591', base: '#E85D7A', shade: '#BB4A62' },
  vintage_mint: { light: '#B5E2C6', base: '#9ED6B8', shade: '#84BD9E' },
  vintage_butter: { light: '#F6DE85', base: '#F1D876', shade: '#D6BC5E' },
  vintage_blush: { light: '#F2B3BD', base: '#EAA3AC', shade: '#D18B94' },
  vintage_powder: { light: '#B9CFE8', base: '#A8C1DC', shade: '#8FA9C2' },
};

/** Handle face per door colour: a deeper enamel tone that belongs with the
 *  door instead of generic steel. */
export const handleTints: Record<BoardColor, [string, string, string]> = {
  charcoal: ['#2B2724', '#211E1B', '#171412'],
  sage: ['#3D6448', '#2F4F3A', '#223A2B'],
  blue: ['#2F63AC', '#244C85', '#1A375D'],
  mint: ['#31A572', '#268058', '#1C5C40'],
  powder: ['#82ABCB', '#64849D', '#475D70'],
  cream: ['#D9C491', '#B39D63', '#84744A'],
  butter: ['#D4A731', '#A37F27', '#77601D'],
  clay: ['#AF6335', '#884D2A', '#63381F'],
  blush: ['#BB4A62', '#8F394C', '#65303A'],
  vintage_mint: ['#84BD9E', '#679A7E', '#4A705C'],
  vintage_butter: ['#D6BC5E', '#A78E45', '#786734'],
  vintage_blush: ['#D18B94', '#A26A71', '#744C51'],
  vintage_powder: ['#8FA9C2', '#6F8399', '#4F5D6C'],
};

/** Nameplate face per door colour: lighter enamel than the door with a
 *  darker engraved edge and screw heads. (Currently unused — the badge sits
 *  straight on the enamel — kept coherent in case plates return.) */
export const plateTints: Record<
  BoardColor,
  { bg: string; edge: string; screw: string; screwEdge: string }
> = {
  charcoal: { bg: '#4E4843', edge: '#241F1C', screw: '#1A1714', screwEdge: '#100E0C' },
  sage: { bg: '#648F70', edge: '#3A5C44', screw: '#2C4634', screwEdge: '#1B2C21' },
  blue: { bg: '#6395DB', edge: '#2C5DA3', screw: '#23497F', screwEdge: '#173154' },
  mint: { bg: '#69D8A4', edge: '#2E9A67', screw: '#247852', screwEdge: '#185236' },
  powder: { bg: '#B4D2EC', edge: '#6E9CC4', screw: '#577A99', screwEdge: '#3A5266' },
  cream: { bg: '#FBEFCB', edge: '#C9AE72', screw: '#A08A58', screwEdge: '#6C5D3A' },
  butter: { bg: '#F6D878', edge: '#C1932C', screw: '#96712A', screwEdge: '#66501E' },
  clay: { bg: '#DE9A6B', edge: '#9C5A30', screw: '#7A4626', screwEdge: '#523019' },
  blush: { bg: '#EE8299', edge: '#A8455C', screw: '#843647', screwEdge: '#5A2530' },
  vintage_mint: { bg: '#B5E2C6', edge: '#7CB894', screw: '#60976F', screwEdge: '#42684D' },
  vintage_butter: { bg: '#F6DE85', edge: '#CBB14E', screw: '#9E8A3E', screwEdge: '#6C5F2B' },
  vintage_blush: { bg: '#F2B3BD', edge: '#C98C95', screw: '#9D6D74', screwEdge: '#6C4B50' },
  vintage_powder: { bg: '#B9CFE8', edge: '#87A6C2', screw: '#688197', screwEdge: '#475A68' },
};

/** The single fastener everywhere: round magnets in fixed colours (used by Pin). */
export const fastenerColors = {
  magnets: ['#E4572E', '#F2B134', '#2A9D8F', '#3D5A98', '#D96C95'],
} as const;
