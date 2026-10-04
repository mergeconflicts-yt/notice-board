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
      <path ${DIE_CUT} ${o('d="M14 33 L14 21 Q14 18.5 15.5 18 C14.8 14 15.5 9.5 18.5 8 C21.5 6.5 23.6 8.6 22.8 11.8 L22 16.5 L26.5 16.5 Q29 16.5 29 19.5 L29 29.5 Q29 33 25 33 Z"')} fill="#F2C79B"/>
      <rect ${o('x="12" y="29" width="8" height="6" rx="2"')} fill="#3D5A98"/>
      <path ${o('d="M23 21 h3 M23 25 h3"')} fill="none" stroke-linecap="round"/>
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
      <rect ${DIE_CUT} ${o('x="12" y="18" width="16" height="14" rx="2"')} fill="#E4572E"/>
      <rect ${DIE_CUT} ${o('x="10.5" y="13.5" width="19" height="4.5" rx="2"')} fill="#C9453A"/>
      <rect x="18.6" y="13.5" width="2.8" height="18.5" fill="#F2B134"/>
      <path ${o('d="M20 13.5 C16.5 8.5 12.5 8.5 13 11.5 C13.4 14 17 13.8 20 13.5 Z"')} fill="#F2B134"/>
      <path ${o('d="M20 13.5 C23.5 8.5 27.5 8.5 27 11.5 C26.6 14 23 13.8 20 13.5 Z"')} fill="#F2B134"/>
      <circle ${o('cx="20" cy="12.8" r="1.9"')} fill="#F2B134"/>
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
    svg: `<path ${DIE_CUT} ${o('d="M22.5 6 L13.5 22.5 L19.5 22.5 L17.5 34 L26.8 15.5 L20.8 15.5 Z"')} fill="#F2B134"/>`,
  },
];
