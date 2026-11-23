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

import { sparkle } from '../magnets/helpers.mjs';

const STICKERS_ART = [
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

  // --- Cute originals (16) — `cs_` keeps sticker ids clear of the cu_ magnets.
  {
    id: 'cs_love',
    pack: 'cute',
    label: 'Love',
    svg: `
      <path ${DIE_CUT} ${o('d="M20 33 C6 24 6 13 13 11 C17 10 20 14 20 16 C20 14 23 10 27 11 C34 13 34 24 20 33 Z"')} fill="#E86A83"/>
      <ellipse cx="16" cy="16.6" rx="3.4" ry="2" fill="#fff" opacity=".45" transform="rotate(-30 16 16.6)"/>
    `,
  },
  {
    id: 'cs_mochi',
    pack: 'cute',
    label: 'Mochi',
    svg: `
      <path ${DIE_CUT} ${o('d="M12.4 13.6 L12 5.8 L19.2 11 Z"')} fill="#F7F3EA"/>
      <path ${DIE_CUT} ${o('d="M27.6 13.6 L28 5.8 L20.8 11 Z"')} fill="#F7F3EA"/>
      <path ${DIE_CUT} ${o('d="M9 18 C9 12 13.4 9.2 20 9.2 C26.6 9.2 31 12 31 18 L31 25.4 C31 30.4 26.4 33 20 33 C13.6 33 9 30.4 9 25.4 Z"')} fill="#F7F3EA"/>
      <path d="M13.2 11.8 L13 8.2 L16.6 10.8 Z" fill="#F6BFCB"/>
      <path d="M26.8 11.8 L27 8.2 L23.4 10.8 Z" fill="#F6BFCB"/>
      <ellipse cx="13" cy="24" rx="2.8" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <ellipse cx="27" cy="24" rx="2.8" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <path d="M14.8 20.4 q2.1 2 4.2 0 M21 20.4 q2.1 2 4.2 0" fill="none" stroke="#6B4A55" stroke-width="1.1" stroke-linecap="round"/>
      <path ${o('d="M19 22.4 H21 L20 23.8 Z"')} fill="#E8899F"/>
      <path d="M20 23.8 v1 M20 24.8 q-1.6 1.4 -3 0 M20 24.8 q1.6 1.4 3 0" fill="none" stroke="#6B4A55" stroke-width=".9" stroke-linecap="round"/>
      <rect ${o('x="12.6" y="29.4" width="14.8" height="3.2" rx="1.6"')} fill="#F2A9BE"/>
      <circle ${o('cx="20" cy="34.4" r="1.8"')} fill="#F2C443"/>
    `,
  },
  {
    id: 'cs_strawberry',
    pack: 'cute',
    label: 'Strawberry',
    svg: `
      <path ${DIE_CUT} ${o('d="M20 11 C26.8 11 31.4 16 30.6 21.6 C29.8 27.4 25.2 33.2 20 33.2 C14.8 33.2 10.2 27.4 9.4 21.6 C8.6 16 13.2 11 20 11 Z"')} fill="#E4574C"/>
      <path ${DIE_CUT} ${o('d="M20 12.2 C17.8 9.6 14.4 8.4 11.8 9.8 C13.6 11.6 15.4 12.4 17.6 12.8 C15.8 14 14.8 15.2 14.2 17 C16.8 16.2 18.8 14.6 20 12.8 C21.2 14.6 23.2 16.2 25.8 17 C25.2 15.2 24.2 14 22.4 12.8 C24.6 12.4 26.4 11.6 28.2 9.8 C25.6 8.4 22.2 9.6 20 12.2 Z"')} fill="#3BA55D"/>
      <ellipse cx="14.4" cy="18" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <ellipse cx="20" cy="16.6" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <ellipse cx="25.6" cy="18" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <ellipse cx="13.4" cy="23" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <ellipse cx="26.6" cy="23" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <ellipse cx="20" cy="25.6" rx=".9" ry="1.3" fill="#FFE7C4"/>
      <path d="M15.8 20.4 q1.9 1.8 3.8 0 M20.4 20.4 q1.9 1.8 3.8 0" fill="none" stroke="#6B2A2A" stroke-width="1" stroke-linecap="round"/>
      <path ${o('d="M19 22.4 q1 1 2 0"')} fill="#6B2A2A"/>
    `,
  },
  {
    id: 'cs_bow',
    pack: 'cute',
    label: 'Bow',
    svg: `
      <path ${DIE_CUT} ${o('d="M19.4 21.4 C16.8 25.4 15 29 13.8 32.6 L17.2 31 L18.8 33.4 C19.4 29.4 20 25.4 20.4 22 Z"')} fill="#E79BB0"/>
      <path ${DIE_CUT} ${o('d="M20.6 21.4 C23.2 25.4 25 29 26.2 32.6 L22.8 31 L21.2 33.4 C20.6 29.4 20 25.4 19.6 22 Z"')} fill="#E79BB0"/>
      <path ${DIE_CUT} ${o('d="M19.2 21 C15 14.8 9.2 15 8 18.6 C6.8 22.4 11.8 25 19.2 21 Z"')} fill="#F2A9BE"/>
      <path ${DIE_CUT} ${o('d="M20.8 21 C25 14.8 30.8 15 32 18.6 C33.2 22.4 28.2 25 20.8 21 Z"')} fill="#F2A9BE"/>
      <path d="M11.4 18.6 C12.8 16.8 15.8 16.8 18.2 20.2" fill="none" stroke="#D0879C" stroke-width="1" stroke-linecap="round"/>
      <path d="M28.6 18.6 C27.2 16.8 24.2 16.8 21.8 20.2" fill="none" stroke="#D0879C" stroke-width="1" stroke-linecap="round"/>
      <rect ${DIE_CUT} ${o('x="17.4" y="18.4" width="5.2" height="4.8" rx="2.2"')} fill="#D0879C"/>
      <ellipse cx="13.6" cy="18.4" rx="2.6" ry="1.2" fill="#fff" opacity=".4" transform="rotate(-18 13.6 18.4)"/>
    `,
  },
  {
    id: 'cs_bunny',
    pack: 'cute',
    label: 'Bunny',
    svg: `
      <path ${DIE_CUT} ${o('d="M14.6 13 C12.8 7 13.4 4.4 15.4 4.4 C17.4 4.4 18.4 7.2 18.2 12.4 Z"')} fill="#F7F3EA"/>
      <path ${DIE_CUT} ${o('d="M21.8 12.4 C21.6 7.2 22.6 4.4 24.6 4.4 C26.6 4.4 27.2 7 25.4 13 Z"')} fill="#F7F3EA"/>
      <path d="M15.6 11.6 C15 8 15.2 6.2 15.6 6 C16.2 6 16.8 7.8 17.2 11.2 Z" fill="#F6BFCB"/>
      <path d="M24.4 11.6 C25 8 24.8 6.2 24.4 6 C23.8 6 23.2 7.8 22.8 11.2 Z" fill="#F6BFCB"/>
      <ellipse ${DIE_CUT} ${o('cx="20" cy="21" rx="10" ry="9.4"')} fill="#F7F3EA"/>
      <ellipse cx="13" cy="23.4" rx="2.6" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <ellipse cx="27" cy="23.4" rx="2.6" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <path d="M14.6 19.6 q2.1 2 4.2 0 M21.2 19.6 q2.1 2 4.2 0" fill="none" stroke="#6B4A55" stroke-width="1.1" stroke-linecap="round"/>
      <path ${o('d="M19 22 H21 L20 23.4 Z"')} fill="#E8899F"/>
      <path d="M20 23.4 v1 M20 24.4 q-1.6 1.4 -3 0 M20 24.4 q1.6 1.4 3 0" fill="none" stroke="#6B4A55" stroke-width=".9" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cs_rainbow',
    pack: 'cute',
    label: 'Rainbow',
    svg: `
      <path ${DIE_CUT} ${o('d="M5 28 A15 15 0 0 1 35 28 L31.8 28 A11.8 11.8 0 0 0 8.2 28 Z"')} fill="#F2A9BE"/>
      <path ${DIE_CUT} ${o('d="M8.2 28 A11.8 11.8 0 0 1 31.8 28 L28.6 28 A8.6 8.6 0 0 0 11.4 28 Z"')} fill="#F7DF8E"/>
      <path ${DIE_CUT} ${o('d="M11.4 28 A8.6 8.6 0 0 1 28.6 28 L26 28 A6 6 0 0 0 14 28 Z"')} fill="#A9D8F0"/>
      <ellipse ${DIE_CUT} ${o('cx="11" cy="29.6" rx="5" ry="3.4"')} fill="#fff"/>
      <ellipse ${DIE_CUT} ${o('cx="15" cy="28" rx="4" ry="3"')} fill="#fff"/>
      <ellipse ${DIE_CUT} ${o('cx="18.4" cy="30" rx="3.6" ry="2.6"')} fill="#fff"/>
      <path d="M9 29.8 q1.2 1.2 2.4 0 M15.8 30 q1.2 1.2 2.4 0" fill="none" stroke="#6B4A55" stroke-width=".85" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cs_mic',
    pack: 'cute',
    label: 'Sparkle mic',
    svg: `
      <g transform="rotate(-17 22 24)">
        <rect ${DIE_CUT} ${o('x="20.4" y="21.8" width="15.2" height="5.4" rx="2.7"')} fill="#F2A9BE"/>
        <rect ${o('x="22.2" y="21.6" width="2.8" height="5.8" rx="1.2"')} fill="#F2C443"/>
      </g>
      <circle ${DIE_CUT} ${o('cx="14.6" cy="21.4" r="8.4"')} fill="#C9CED4"/>
      <path d="M8.4 18.6 q6.2 2.2 12.4 0 M7.8 22 q6.8 2.4 13.6 0 M9.2 25.4 q5.4 2 10.8 0" fill="none" stroke="rgba(70,80,90,.35)" stroke-width=".8"/>
      <ellipse cx="11.2" cy="17.4" rx="3" ry="2" fill="#fff" opacity=".55" transform="rotate(-28 11.2 17.4)"/>
      ${sparkle(28, 9.6, 2.6, '#F2C443')}
      ${sparkle(33, 20.4, 1.8, '#EFA3B4')}
      <circle cx="24.4" cy="8.4" r=".9" fill="#F2C443"/>
    `,
  },
  {
    id: 'cs_sunglasses',
    pack: 'cute',
    label: 'Heart sunglasses',
    svg: `
      <path d="M7.6 17.4 L5.2 14.6 M32.4 17.4 L34.8 14.6" fill="none" stroke="#B95670" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M18.8 19.2 q1.2 1.7 2.4 0" fill="none" stroke="#B95670" stroke-width="1.4" stroke-linecap="round"/>
      <g transform="translate(13.2 20.6) scale(.7) translate(-10 -9.4)">
        <path ${DIE_CUT} ${o('d="M10 18.4 C4 13.6 1.2 10.7 1.2 7.7 C1.2 5 3.4 3.4 5.6 3.4 C7.4 3.4 9.2 4.8 10 6.2 C10.8 4.8 12.6 3.4 14.4 3.4 C16.6 3.4 18.8 5 18.8 7.7 C18.8 10.7 16 13.6 10 18.4 Z"')} fill="#B95670"/>
        <path d="M10 16.2 C5.6 12.4 3.6 10.2 3.6 8.2 C3.6 6.6 5 5.6 6.2 5.6 C7.5 5.6 8.9 6.6 10 8.4 C11.1 6.6 12.5 5.6 13.8 5.6 C15 5.6 16.4 6.6 16.4 8.2 C16.4 10.2 14.4 12.4 10 16.2 Z" fill="#F7C3D0"/>
      </g>
      <g transform="translate(26.8 20.6) scale(.7) translate(-10 -9.4)">
        <path ${DIE_CUT} ${o('d="M10 18.4 C4 13.6 1.2 10.7 1.2 7.7 C1.2 5 3.4 3.4 5.6 3.4 C7.4 3.4 9.2 4.8 10 6.2 C10.8 4.8 12.6 3.4 14.4 3.4 C16.6 3.4 18.8 5 18.8 7.7 C18.8 10.7 16 13.6 10 18.4 Z"')} fill="#B95670"/>
        <path d="M10 16.2 C5.6 12.4 3.6 10.2 3.6 8.2 C3.6 6.6 5 5.6 6.2 5.6 C7.5 5.6 8.9 6.6 10 8.4 C11.1 6.6 12.5 5.6 13.8 5.6 C15 5.6 16.4 6.6 16.4 8.2 C16.4 10.2 14.4 12.4 10 16.2 Z" fill="#F7C3D0"/>
      </g>
      ${sparkle(26.2, 9.8, 2.4, '#F2C443')}
      ${sparkle(32.4, 13.6, 1.5, '#EFA3B4')}
    `,
  },
  {
    id: 'cs_butterfly',
    pack: 'cute',
    label: 'Butterfly',
    svg: `
      <path d="M19 13 Q17.4 8.6 15.4 7.4 M21 13 Q22.6 8.6 24.6 7.4" fill="none" stroke="#6B4A55" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="15" cy="7.2" r="1.1" fill="#6B4A55"/>
      <circle cx="25" cy="7.2" r="1.1" fill="#6B4A55"/>
      <path ${DIE_CUT} ${o('d="M19 20.4 C13.4 11.6 6.6 11.4 5.6 16.6 C4.8 21.2 11 22.8 19 21.8 Z"')} fill="#B49AE6"/>
      <path ${DIE_CUT} ${o('d="M21 20.4 C26.6 11.6 33.4 11.4 34.4 16.6 C35.2 21.2 29 22.8 21 21.8 Z"')} fill="#B49AE6"/>
      <path ${DIE_CUT} ${o('d="M19 22.6 C13 23.2 8.4 25.6 9.4 29.8 C10.4 33.8 16 32.2 19 25.8 Z"')} fill="#B49AE6"/>
      <path ${DIE_CUT} ${o('d="M21 22.6 C27 23.2 31.6 25.6 30.6 29.8 C29.6 33.8 24 32.2 21 25.8 Z"')} fill="#B49AE6"/>
      <ellipse cx="11" cy="17.4" rx="2.2" ry="1.6" fill="#EFE4FC" opacity=".8" transform="rotate(-24 11 17.4)"/>
      <ellipse cx="29" cy="17.4" rx="2.2" ry="1.6" fill="#EFE4FC" opacity=".8" transform="rotate(24 29 17.4)"/>
      <ellipse ${o('cx="20" cy="21.4" rx="1.9" ry="8.4"')} fill="#6B4A55"/>
      <circle ${o('cx="20" cy="13" r="2.2"')} fill="#6B4A55"/>
      <circle cx="19.3" cy="12.4" r=".7" fill="#EFE4FC" opacity=".9"/>
    `,
  },
  {
    id: 'cs_cherry',
    pack: 'cute',
    label: 'Cherries',
    svg: `
      <path d="M20 8 C17.6 14 14.6 20 12.6 24.6 M20 8 C23 14 25.6 19.6 27.4 23.6" fill="none" stroke="#4E8A4A" stroke-width="2" stroke-linecap="round"/>
      <path ${DIE_CUT} ${o('d="M20 8 C21.8 5.6 25.2 4.8 27.6 6.4 C26.2 9 23 9.6 20 8 Z"')} fill="#7CC08A"/>
      <circle ${DIE_CUT} ${o('cx="13" cy="27.4" r="6.4"')} fill="#D9564A"/>
      <circle ${DIE_CUT} ${o('cx="27" cy="26.6" r="6"')} fill="#D9564A"/>
      <ellipse cx="10.6" cy="25" rx="2" ry="1.4" fill="#fff" opacity=".5" transform="rotate(-28 10.6 25)"/>
      <ellipse cx="24.8" cy="24.4" rx="1.8" ry="1.3" fill="#fff" opacity=".5" transform="rotate(-28 24.8 24.4)"/>
      <path d="M10.8 27.6 q1.2 1.2 2.4 0 M15.4 27.6 q1.2 1.2 2.4 0" fill="none" stroke="#6B2A2A" stroke-width=".9" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cs_flower',
    pack: 'cute',
    label: 'Flower',
    svg: `
      ${[-90, -18, 54, 126, 198].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return `<circle ${DIE_CUT} ${o(`cx="${(20 + Math.cos(a) * 9.2).toFixed(2)}" cy="${(20 + Math.sin(a) * 9.2).toFixed(2)}" r="4.8"`)} fill="#F7C3D0"/>`;
      }).join('\n      ')}
      <circle ${DIE_CUT} ${o('cx="20" cy="20" r="5.6"')} fill="#F2C443"/>
      <circle cx="18" cy="18" r="1" fill="#E8A93A"/>
      <circle cx="22.4" cy="20.6" r=".9" fill="#E8A93A"/>
      <circle cx="20.2" cy="23" r=".8" fill="#E8A93A"/>
    `,
  },
  {
    id: 'cs_star',
    pack: 'cute',
    label: 'Star',
    svg: `
      <path ${DIE_CUT} ${o('d="M20 5.4 L24.6 15.4 L35.2 16.4 L27.2 23.4 L29.6 34 L20 28.6 L10.4 34 L12.8 23.4 L4.8 16.4 L15.4 15.4 Z"')} fill="#F5C542"/>
      <path d="M17 14.4 L20 9.4 L21.6 14.6 Z" fill="#FFF3B8"/>
    `,
  },
  {
    id: 'cs_milk',
    pack: 'cute',
    label: 'Strawberry milk',
    svg: `
      <rect ${DIE_CUT} ${o('x="11" y="10.4" width="18" height="23.4" rx="2.4"')} fill="#FBD9E3"/>
      <path ${DIE_CUT} ${o('d="M11 10.4 L15.4 5.4 H28.6 L24.6 10.4 Z"')} fill="#F6C6D4"/>
      <rect x="11" y="19.4" width="18" height="7" fill="#F2A9BE"/>
      <path ${o('d="M17.6 16.4 C19.4 16.4 20.6 17.6 20.6 19 C20.6 20.6 19.2 22.2 17.6 22.2 C16 22.2 14.6 20.6 14.6 19 C14.6 17.6 15.8 16.4 17.6 16.4 Z"')} fill="#D9564A"/>
      <path d="M17.6 16.8 L16.4 15.2 M17.6 16.8 L18.8 15.2" stroke="#3BA55D" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="16.8" cy="18.4" r=".4" fill="#fff"/>
      <circle cx="18.4" cy="19.2" r=".4" fill="#fff"/>
      <rect ${o('x="23" y="21" width="3" height="2" rx="1"')} fill="#fff"/>
      <text x="20" y="31" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="3.2" fill="#8E3A52">MILK</text>
      <rect ${DIE_CUT} ${o('x="27.4" y="4.6" width="3.2" height="11" rx="1.4" transform="rotate(18 29 10)"')} fill="#F2C443"/>
    `,
  },
  {
    id: 'cs_cookie',
    pack: 'cute',
    label: 'Cookie',
    svg: `
      <path ${DIE_CUT} ${o('d="M12.6 10.6 L13.2 5.6 L17.2 8.8 Z"')} fill="#D9A85F"/>
      <path ${DIE_CUT} ${o('d="M27.4 10.6 L26.8 5.6 L22.8 8.8 Z"')} fill="#D9A85F"/>
      <circle ${DIE_CUT} ${o('cx="20" cy="21" r="12.6"')} fill="#E8B86B"/>
      <circle ${DIE_CUT} ${o('cx="20" cy="21" r="10"')} fill="#F3D9A8"/>
      <circle cx="14.6" cy="17.4" r="1.5" fill="#8E5A2E"/>
      <circle cx="25.4" cy="17.4" r="1.5" fill="#8E5A2E"/>
      <circle cx="17.4" cy="26" r="1.2" fill="#8E5A2E"/>
      <circle cx="23.4" cy="26.6" r="1.2" fill="#8E5A2E"/>
      <circle cx="20" cy="23.4" r="1.2" fill="#8E5A2E"/>
      <path d="M16.6 20 q1.6 1.6 3.2 0 M20.2 20 q1.6 1.6 3.2 0" fill="none" stroke="#6B4A55" stroke-width="1" stroke-linecap="round"/>
      <path ${o('d="M19.2 22.2 H20.8 L20 23.4 Z"')} fill="#E8899F"/>
    `,
  },
  {
    id: 'cs_cloud',
    pack: 'cute',
    label: 'Sleepy cloud',
    svg: `
      <ellipse ${DIE_CUT} ${o('cx="13.4" cy="24.6" rx="7.4" ry="6"')} fill="#fff"/>
      <ellipse ${DIE_CUT} ${o('cx="20.4" cy="19.4" rx="8" ry="7.2"')} fill="#fff"/>
      <ellipse ${DIE_CUT} ${o('cx="27.6" cy="23.4" rx="6.6" ry="5.6"')} fill="#fff"/>
      <ellipse ${DIE_CUT} ${o('cx="20.4" cy="27" rx="11" ry="5.2"')} fill="#fff"/>
      <path d="M15.8 22.4 q1.8 1.7 3.6 0 M21.6 22.4 q1.8 1.7 3.6 0" fill="none" stroke="#7A7E8C" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="15.2" cy="25.6" rx="2" ry="1.4" fill="#F7C3D0" opacity=".7"/>
      <ellipse cx="25.8" cy="25.6" rx="2" ry="1.4" fill="#F7C3D0" opacity=".7"/>
      ${sparkle(30.6, 10.6, 2, '#F2C443')}
      ${sparkle(10.4, 12.4, 1.4, '#EFA3B4')}
    `,
  },
  {
    id: 'cs_sparkle',
    pack: 'cute',
    label: 'Sparkles',
    svg: `
      ${sparkle(20, 17, 11, '#F2C443')}
      ${sparkle(31.2, 27.6, 5, '#EFA3B4')}
      ${sparkle(9, 28.4, 4.2, '#EFA3B4')}
      <circle cx="31.6" cy="10" r="1.6" fill="#F7C3D0"/>
      <circle cx="9" cy="13.4" r="1.2" fill="#F2C443"/>
      <circle cx="22.4" cy="33.6" r="1.2" fill="#F2C443"/>
    `,
  },
];

// Every existing row is an object magnet for now. Ported resin art
// overrides style: 'resin' (and specific type) on its catalog entry.
export const STICKERS = STICKERS_ART.map((item) => ({
  type: 'object',
  style: 'cartoon',
  ...item,
}));
