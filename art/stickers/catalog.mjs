// Sticker art source (docs/plan-magnets.md §2, §3.4).
//
// Stickers use the same { id, pack, label, svg } shape as magnets but are baked
// FLAT (no lighting filter). Each carries a white die-cut border via
// `stroke="#fff" paint-order="stroke"`; the app draws a 1.5 pt drop shadow so
// they sit on the paper. ids are `<pack>_<name>`, lower-case.

export const OUTLINE = 'stroke="#282620" stroke-width="1.4" stroke-linejoin="round"';

// White die-cut rim: thicker white stroke painted under the fill.
const DIE_CUT = 'stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
const o = (attrs) => `${attrs} ${OUTLINE}`;

export const STICKERS = [
  {
    id: 'st_love',
    pack: 'starter',
    label: 'Love',
    svg: `<path ${DIE_CUT} ${o('d="M20 33 C6 24 6 13 13 11 C17 10 20 14 20 16 C20 14 23 10 27 11 C34 13 34 24 20 33 Z"')} fill="#E4572E"/>`,
  },
  {
    id: 'st_gotit',
    pack: 'starter',
    label: 'Got it',
    svg: `
      <circle ${DIE_CUT} ${o('cx="20" cy="20" r="13"')} fill="#3FA06A"/>
      <path ${o('d="M13 20.5 L18 25.5 L27 15"')} fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'st_done',
    pack: 'starter',
    label: 'Done',
    svg: `
      <circle ${DIE_CUT} ${o('cx="20" cy="20" r="13"')} fill="#2F80C9"/>
      <path ${o('d="M12.5 20.5 L18 26 L27.5 14"')} fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'st_great',
    pack: 'starter',
    label: 'Great',
    svg: `<path ${DIE_CUT} ${o('d="M20 7 L23.6 15.2 L32.5 16 L25.7 21.9 L27.8 30.5 L20 25.9 L12.2 30.5 L14.3 21.9 L7.5 16 L16.4 15.2 Z"')} fill="#F2B134"/>`,
  },
  {
    id: 'st_haha',
    pack: 'starter',
    label: 'Haha',
    svg: `
      <circle ${DIE_CUT} ${o('cx="20" cy="20" r="13"')} fill="#F5C542"/>
      <path ${o('d="M12 16 q2.5 -3 5 0 M23 16 q2.5 -3 5 0"')} fill="none" stroke="#282620" stroke-width="1.6" stroke-linecap="round"/>
      <path ${o('d="M12.5 22 q7.5 9 15 0 Z"')} fill="#7A2E22" stroke="#282620" stroke-width="1.4" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'st_thanks',
    pack: 'starter',
    label: 'Thanks',
    svg: `
      <path ${DIE_CUT} ${o('d="M15 33 C11 33 9 29 11 25 L16 15 q1.5 -2.5 3.5 -1 q1.5 1.2 0.5 3.5 L18 22 L28 19 q2.5 -0.5 3 1.5 q0.5 2 -2 3 L18 28"')} fill="#F2C79B"/>
    `,
  },
  {
    id: 'st_yum',
    pack: 'starter',
    label: 'Yum',
    svg: `
      <circle ${DIE_CUT} ${o('cx="20" cy="20" r="13"')} fill="#F5C542"/>
      <circle ${o('cx="15.5" cy="17" r="1.7"')} fill="#282620" stroke="none"/>
      <circle ${o('cx="24.5" cy="17" r="1.7"')} fill="#282620" stroke="none"/>
      <path ${o('d="M14 23 q6 5 12 0"')} fill="none" stroke="#282620" stroke-width="1.6" stroke-linecap="round"/>
      <path ${o('d="M17.5 26 q2.5 4 5 0 Z"')} fill="#E4572E" stroke="#282620" stroke-width="1.2" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'st_onit',
    pack: 'starter',
    label: 'On it',
    svg: `<path ${DIE_CUT} ${o('d="M20 5 C26 13 31 16 29 24 C27.5 30 24 34 20 34 C16 34 12.5 30 11 24 C9 16 14 13 20 5 Z"')} fill="#E4572E"/>`,
  },
];
