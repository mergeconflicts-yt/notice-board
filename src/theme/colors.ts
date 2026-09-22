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

export type NoteColorKey = 'yellow' | 'green' | 'pink' | 'blue' | 'lavender';

export const noteColors: Record<
  NoteColorKey,
  { bg: string; ink: string; edge: string; shadow: string }
> = {
  yellow: { bg: '#FCEFB4', ink: '#4A3E22', edge: '#E9D98F', shadow: 'rgba(168, 143, 66, 0.28)' },
  green: { bg: '#DBEBCB', ink: '#2E4330', edge: '#C4D9AE', shadow: 'rgba(106, 138, 90, 0.26)' },
  pink: { bg: '#FAD9DD', ink: '#53343C', edge: '#EBBFC6', shadow: 'rgba(188, 124, 136, 0.28)' },
  blue: { bg: '#D7E7F7', ink: '#263E57', edge: '#BBD3EC', shadow: 'rgba(94, 138, 182, 0.26)' },
  lavender: { bg: '#E6E0F5', ink: '#3D3458', edge: '#CFC6E8', shadow: 'rgba(122, 108, 168, 0.26)' },
};

export const noteColorKeys = Object.keys(noteColors) as NoteColorKey[];
