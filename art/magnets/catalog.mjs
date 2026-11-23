// Magnet art source (docs/plan-magnets.md §2).
//
// Export the art as data: each entry is { id, pack, label, svg }, where `svg`
// is the inner markup for a 40×40 viewBox. Every shape must be a *closed,
// filled* form carrying the shared dark OUTLINE — thin line-only art barely
// shows the 3D lighting the bake script applies. Stickers live in
// ../stickers/catalog.mjs and are baked flat (no lighting).
//
// ids follow `<pack>_<name>`, lower-case (st_fuji, kt_tomatosack, in_chai…).

export const OUTLINE = 'stroke="#282620" stroke-width="1.5" stroke-linejoin="round"';

// Shared outline wrapping: every art function returns inner markup already
// stroked with OUTLINE so the bake script only has to add the filter.
const o = (attrs) => `${attrs} ${OUTLINE}`;

import { beadRing, burst, khi, soft, sparkle, star5 } from './helpers.mjs';

export const PACKS = [
  { id: 'starter', name: 'Starter', kind: 'theme' },
  { id: 'kitchen', name: 'Kitchen', kind: 'theme' },
  { id: 'star_chart', name: 'Star chart', kind: 'theme' },
  { id: 'japanese_stationery', name: 'Japanese stationery', kind: 'theme' },
  { id: 'cute', name: 'Cute originals', kind: 'theme' },
  { id: 'aesthetic', name: 'Aesthetic', kind: 'theme' },
  { id: 'dorm', name: 'Dorm life', kind: 'theme' },
  { id: 'travel_in', name: 'India', kind: 'travel' },
  { id: 'travel_tw', name: 'Taiwan', kind: 'travel' },
  { id: 'travel_jp', name: 'Japan', kind: 'travel' },
  { id: 'travel_th', name: 'Thailand', kind: 'travel' },
  { id: 'travel_us', name: 'USA', kind: 'travel' },
  { id: 'travel_gb', name: 'UK', kind: 'travel' },
];

const MAGNETS_ART = [
  // NOTE: st_fuji is photorealistic and owned by scripts/bake-fuji-photo.mjs
  // (cut from art/ref/fuji.jpeg.webp), not by this vector catalog. Run the
  // photo script after `npm run bake:packs -- --pack starter`.
  // --- Starter (bundled in the app) ---------------------------------------
  {
    id: 'st_boba',
    pack: 'starter',
    label: 'Bubble tea',
    svg: `
      <path ${o('d="M21.5 2.5 L23.7 3.8 L20.2 14.5 L18 13.2 Z"')} fill="#D63A3A"/>
      <path ${o('d="M12 15 H28 L26.2 32 Q25.8 34.5 23.2 34.5 H16.8 Q14.2 34.5 13.8 32 Z"')} fill="#EFD9B8"/>
      <path ${o('d="M11 15 C11 10.5 14.5 9 20 9 C25.5 9 29 10.5 29 15 Z"')} fill="#F3C2C8"/>
      <circle ${o('cx="16.3" cy="29.2" r="1.8"')} fill="#3A2A20"/>
      <circle ${o('cx="20" cy="30.6" r="1.8"')} fill="#3A2A20"/>
      <circle ${o('cx="23.4" cy="28.9" r="1.6"')} fill="#3A2A20"/>
      <circle ${o('cx="18.6" cy="27.3" r="1.4"')} fill="#3A2A20"/>
    `,
  },
  {
    id: 'st_bus',
    pack: 'starter',
    label: 'City bus',
    svg: `
      <rect ${o('x="5" y="11" width="30" height="18" rx="3"')} fill="#F2B134"/>
      <rect ${o('x="8" y="14.5" width="9" height="7" rx="1.2"')} fill="#BFE3F5"/>
      <rect ${o('x="19" y="14.5" width="9" height="7" rx="1.2"')} fill="#BFE3F5"/>
      <rect ${o('x="30" y="14.5" width="3.5" height="7" rx="1"')} fill="#BFE3F5"/>
      <circle ${o('cx="12" cy="31" r="3.4"')} fill="#3A3733"/>
      <circle ${o('cx="28" cy="31" r="3.4"')} fill="#3A3733"/>
      <circle ${o('cx="12" cy="31" r="1.2"')} fill="#CFCABB" stroke="none"/>
      <circle ${o('cx="28" cy="31" r="1.2"')} fill="#CFCABB" stroke="none"/>
    `,
  },
  {
    id: 'st_cat',
    pack: 'starter',
    label: 'Fridge cat',
    svg: `
      <path ${o('d="M11 13 L13 5 L18.5 9.5 Z"')} fill="#F7F3EA"/>
      <path ${o('d="M29 13 L27 5 L21.5 9.5 Z"')} fill="#F7F3EA"/>
      <ellipse ${o('cx="20" cy="21" rx="11.5" ry="10.5"')} fill="#F7F3EA"/>
      <ellipse ${o('cx="26" cy="17" rx="4" ry="3.4"')} fill="#EFB0B8" stroke="none"/>
      <circle ${o('cx="16" cy="20" r="1.7"')} fill="#282620" stroke="none"/>
      <circle ${o('cx="24" cy="20" r="1.7"')} fill="#282620" stroke="none"/>
      <path ${o('d="M18.6 24 L21.4 24 L20 26 Z"')} fill="#E88AA0" stroke="none"/>
      <path ${o('d="M15 26 q2 1.6 4 0 M21 26 q2 1.6 4 0"')} fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'st_shell',
    pack: 'starter',
    label: 'Seashell',
    svg: `
      <path ${o('d="M20 33 C10 33 6 24 8 16 C14 20 26 20 32 16 C34 24 30 33 20 33 Z"')} fill="#F3D9C6"/>
      <path ${o('d="M20 33 V15 M14 31 L16 17 M26 31 L24 17"')} fill="none" stroke-linecap="round"/>
    `,
  },

  // --- Kitchen ------------------------------------------------------------
  {
    id: 'kt_kettle',
    pack: 'kitchen',
    label: 'Kettle',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M10 18 C10 13 15 11 20 11 C25 11 30 13 30 18 L28 32 Q27 35 23 35 H17 Q13 35 12 32 Z"')} fill="url(#scTeal)"/>
      <path ${soft('d="M29 21 Q36 18 37 13 L32.5 13.5 Q32 18 28 20 Z"')} fill="url(#scTeal)"/>
      <ellipse cx="35" cy="13.4" rx="2" ry="1" fill="#1B5B57"/>
      <path d="M30 20 Q34 17 35 14" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".8"/>
      <path d="M12 18 C4 14 9 4 20 4 C31 4 36 14 28 18" fill="none" stroke="#2B2620" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M13.5 17 C7 13 11 6 20 6 C29 6 33 13 26.5 17" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-linecap="round"/>
      <rect ${soft('x="16" y="9" width="8" height="5" rx="2"')} fill="url(#scSteel)"/>
      <circle cx="20" cy="7" r="1.5" fill="#3E362E"/>
      <path d="M14 18 V31" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round"/>
      ${khi(15, 16, 2.6, 5.5, 0.55)}
    `,
  },
  {
    id: 'kt_eggcarton',
    pack: 'kitchen',
    label: 'Egg tray',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M5 23 L9 14 H31 L35 23 L31 32 H9 Z"')} fill="url(#ktCardboard)"/>
      <path d="M7 22 H33 M9 26 H31 M10 30 H30" stroke="rgba(90,55,25,.3)" stroke-width=".8"/>
      <ellipse cx="12" cy="23" rx="4" ry="2.2" fill="#A97C4E" opacity=".45"/>
      <ellipse cx="19" cy="23" rx="4" ry="2.2" fill="#A97C4E" opacity=".45"/>
      <ellipse cx="26" cy="23" rx="4" ry="2.2" fill="#A97C4E" opacity=".45"/>
      <circle ${soft('cx="12" cy="20" r="3.2"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="18.5" cy="18.5" r="3.2"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="25" cy="18.5" r="3.2"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="30" cy="20" r="3.2"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="15" cy="27" r="3.2"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="23" cy="27" r="3.2"')} fill="url(#scWhite)"/>
      ${khi(10.5, 18.5, 1.2, 1.8, 0.55)}
      ${khi(16.5, 17, 1.2, 1.8, 0.55)}
    `,
  },
  {
    id: 'kt_friedegg',
    pack: 'kitchen',
    label: 'Fried egg',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M20 7 C28 7 34 12 33 20 C35 26 30 33 22 33 C14 35 7 29 8 22 C6 14 12 8 20 7 Z"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="20" cy="20" r="7.5"')} fill="url(#scYellowRadial)"/>
      <circle cx="20" cy="20" r="4.2" fill="#F2B134" opacity=".45"/>
      ${khi(16.5, 16.5, 2.4, 1.4, 0.65)}
    `,
  },
  {
    id: 'kt_crackegg',
    pack: 'kitchen',
    label: 'Cracked egg',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M9 15 Q13 8 18 12 Q21 14 20 19 L18 26 Q15 30 11 27 Q7 23 9 15 Z"')} fill="url(#ktShell)"/>
      <path ${soft('d="M25 13 Q31 11 33 17 Q35 23 30 27 Q26 29 24 25 L22 19 Q21 15 25 13 Z"')} fill="url(#ktShell)"/>
      <circle ${soft('cx="20" cy="22" r="5.2"')} fill="url(#scYellowRadial)"/>
      <path d="M14 15 L17 18 L15 20" fill="none" stroke="rgba(120,90,50,.4)" stroke-width=".8"/>
      ${khi(11, 14, 1.6, 2.6, 0.6)}
    `,
  },
  {
    id: 'kt_basket',
    pack: 'kitchen',
    label: 'Breakfast basket',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M7 20 H33 L29 34 H11 Z"')} fill="url(#ktBasket)"/>
      <path d="M8 22 H32 M9 25 H31 M10 28 H30 M11 31 H29" stroke="rgba(70,40,15,.45)" stroke-width=".8"/>
      <path d="M8 20 Q11 16 14 20 M12 20 Q15 16 18 20 M17 20 Q20 16 23 20 M22 20 Q25 16 28 20 M27 20 Q30 16 33 20" fill="none" stroke="rgba(255,240,210,.55)" stroke-width=".8"/>
      <path ${soft('d="M13 8 H16 V16 H13 Z"')} fill="url(#ktWine)"/>
      <rect x="13.2" y="10" width="3.6" height="3" fill="#FFFDF7"/>
      <path ${soft('d="M18 9 H21 V16 H18 Z"')} fill="#3A2A20"/>
      <rect x="18.2" y="11" width="3.4" height="2.6" fill="#FFFDF7"/>
      <circle cx="24" cy="16" r="1.6" fill="#6B4A8E"/>
      <circle cx="26.5" cy="15" r="1.5" fill="#8E6FD0"/>
      <circle cx="25.2" cy="18" r="1.5" fill="#6B4A8E"/>
      <path ${soft('d="M27 14 Q31 8 33 15"')} fill="url(#ktBread)"/>
      ${khi(10, 22, 2, 3, 0.4)}
    `,
  },
  {
    id: 'kt_tomatosack',
    pack: 'kitchen',
    label: 'Tomato sack',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M9 15 Q10 12 14 12 H26 Q30 12 31 15 L28 34 H12 Z"')} fill="url(#ktBurlap)"/>
      <path d="M11 17 Q20 19 29 17 M11 20 Q20 22 29 20" fill="none" stroke="rgba(120,85,45,.25)" stroke-width=".7"/>
      ${[13, 16, 19, 22, 25, 28].map((x) => `<path d="M${x} 15 V33" stroke="rgba(120,85,45,.14)" stroke-width=".5"/>`).join('')}
      <circle ${soft('cx="14.5" cy="11.5" r="3.2"')} fill="url(#scRed)"/>
      <circle ${soft('cx="21" cy="9.5" r="3.4"')} fill="url(#scRed)"/>
      <circle ${soft('cx="26.5" cy="12" r="3"')} fill="url(#scRed)"/>
      <path d="M14.5 8.5 L16.5 10 L14 9.5 Z M21 6.5 L23 8 L20.5 7.5 Z M26.5 9 L28 10.5 L26 10 Z" fill="#3B8F4A"/>
      <rect x="12.5" y="24" width="15" height="6" rx="1" fill="#FFFDF7"/>
      <text x="20" y="28.2" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="3.8" fill="#8E2A22">TOMATO</text>
      ${khi(11.5, 16, 1.5, 3, 0.45)}
    `,
  },
  {
    id: 'kt_breadbag',
    pack: 'kitchen',
    label: 'Bread sack',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M9 15 Q10 12 14 12 H26 Q30 12 31 15 L28 34 H12 Z"')} fill="url(#ktBurlap)"/>
      <path d="M11 17 Q20 19 29 17" fill="none" stroke="rgba(120,85,45,.25)" stroke-width=".7"/>
      ${[13, 16, 19, 22, 25, 28].map((x) => `<path d="M${x} 15 V33" stroke="rgba(120,85,45,.14)" stroke-width=".5"/>`).join('')}
      <path ${soft('d="M13 13 Q16 4 20 5 L18 14 Z"')} fill="url(#ktBread)"/>
      <path ${soft('d="M20 14 Q24 4 28 6 L24 15 Z"')} fill="url(#ktBread)"/>
      <path d="M15 8 L18 9 M17 11 L20 12 M23 8 L26 9" stroke="rgba(120,70,25,.45)" stroke-width=".6"/>
      <rect x="13" y="24" width="14" height="6" rx="1" fill="#FFFDF7"/>
      <text x="20" y="28.4" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="4.4" fill="#5A2A1E">Pain</text>
      ${khi(11.5, 16, 1.5, 3, 0.45)}
    `,
  },
  {
    id: 'kt_toaster',
    pack: 'kitchen',
    label: 'Toaster',
    type: 'object',
    style: 'resin',
    svg: `
      <rect ${soft('x="7" y="13" width="26" height="20" rx="5"')} fill="url(#scBlue)"/>
      <rect x="9" y="10" width="8" height="6" rx="2" fill="#3E362E"/>
      <rect x="23" y="10" width="8" height="6" rx="2" fill="#3E362E"/>
      <rect x="11" y="6" width="6" height="8" rx="1" fill="url(#ktBread)"/>
      <rect x="19" y="4" width="6" height="10" rx="1" fill="url(#ktBread)"/>
      <path d="M11 8 H17 M19 6 H25" stroke="rgba(255,255,255,.4)" stroke-width=".8"/>
      <rect x="8" y="23" width="24" height="3.5" fill="#9CC3E5" opacity=".6"/>
      <rect x="9" y="27" width="22" height="5" rx="2.5" fill="#FFFDF7"/>
      <text x="20" y="30.7" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="3.2" fill="#1E5E9E">ALCello</text>
      <circle cx="29" cy="26" r="1.7" fill="#FFFDF7"/>
      ${khi(11, 15, 2.6, 4, 0.5)}
    `,
  },
  {
    id: 'kt_coffee',
    pack: 'kitchen',
    label: 'Coffee',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M10 16 H26 V26 Q26 31 20 31 H16 Q10 31 10 26 Z"')} fill="url(#scWhite)"/>
      <path d="M26 19 Q32 19 32 24 Q32 28 26 28" fill="none" stroke="url(#scSteel)" stroke-width="2"/>
      <ellipse cx="18" cy="17" rx="8" ry="3" fill="#6B4A2F"/>
      <path d="M15 9 Q17 6 15 3 M21 10 Q23 7 21 4" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1" stroke-linecap="round"/>
      ${khi(12, 18, 2.4, 4, 0.55)}
    `,
  },
  {
    id: 'kt_skewer',
    pack: 'kitchen',
    label: 'Candied fruit',
    type: 'object',
    style: 'resin',
    svg: `
      <path d="M8 32 L32 8" stroke="#C9A227" stroke-width="1.4" stroke-linecap="round"/>
      <circle ${soft('cx="13" cy="26" r="3"')} fill="url(#scRed)"/>
      <circle ${soft('cx="18" cy="21" r="3.2"')} fill="url(#scRed)"/>
      <circle ${soft('cx="23" cy="16" r="3.2"')} fill="url(#scRed)"/>
      <circle ${soft('cx="28" cy="11" r="3"')} fill="url(#scRed)"/>
      ${khi(11.5, 24.5, 1.2, 1.6, 0.65)}
      ${khi(21.5, 14.5, 1.2, 1.6, 0.65)}
    `,
  },
  {
    id: 'kt_espresso',
    pack: 'kitchen',
    label: 'Espresso',
    type: 'object',
    style: 'resin',
    svg: `
      <ellipse ${soft('cx="20" cy="29" rx="14" ry="4.5"')} fill="url(#scWhite)"/>
      <ellipse cx="20" cy="29" rx="10" ry="2.9" fill="#C8DDEA" opacity=".55"/>
      <path ${soft('d="M10 15 H26 L24.5 24 Q23 27 19 27 Q15 27 13.5 24 Z"')} fill="url(#scWhite)"/>
      <path d="M10 17.5 H26" stroke="#2F80C9" stroke-width="1.6"/>
      <ellipse cx="18" cy="18.4" rx="6.4" ry="2.2" fill="#4A2A1A"/>
      <path d="M26 18 Q33 18 33 22 Q33 25 26 24.5" fill="none" stroke="url(#scSteel)" stroke-width="1.6"/>
      <path d="M25 28 L33 25" stroke="#C9A227" stroke-width="1.2" stroke-linecap="round"/>
      <ellipse cx="33.5" cy="24.7" rx="2.2" ry="1.1" fill="url(#scGold)"/>
      <text x="20" y="32.4" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="3.2" fill="#1E5E9E">ESPRESSO</text>
      <path d="M15 10 Q17 7 15 4 M21 11 Q23 8 21 5" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1" stroke-linecap="round"/>
      ${khi(12.5, 18, 2, 3, 0.55)}
    `,
  },
  {
    id: 'kt_milk',
    pack: 'kitchen',
    label: 'Milk carton',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M13 10 L27 10 L30 16 V33 H10 V16 Z"')} fill="url(#scWhite)"/>
      <path d="M13 10 L20 6 L27 10" fill="#E8F0F7" stroke="rgba(70,45,20,.38)" stroke-width=".6"/>
      <rect x="11" y="20" width="18" height="8" fill="url(#scBlue)"/>
      <text x="20" y="25.6" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="3.6" fill="#fff">MILK</text>
      <path d="M11 30 H29" stroke="#D9564A" stroke-width="2"/>
      ${khi(13, 12, 2, 4, 0.5)}
    `,
  },
  {
    id: 'kt_done',
    pack: 'kitchen',
    label: 'Done tick',
    type: 'badge',
    style: 'resin',
    svg: `
      <circle ${soft('cx="20" cy="20" r="16"')} fill="url(#scGreen)"/>
      <path d="M12 20 L18 26 L29 13" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
      ${khi(13, 11, 4, 2, 0.55)}
    `,
  },
  {
    id: 'kt_heart',
    pack: 'kitchen',
    label: 'Heart',
    type: 'badge',
    style: 'resin',
    svg: `
      <path ${soft('d="M20 33 C6 24 6 13 13 11 C17 10 20 14 20 16 C20 14 23 10 27 11 C34 13 34 24 20 33 Z"')} fill="url(#scRed)"/>
      ${khi(14, 14, 4, 2, 0.55)}
    `,
  },

  // --- Japanese stationery -------------------------------------------------
  {
    id: 'jp_torii',
    pack: 'japanese_stationery',
    label: 'Torii gate',
    svg: `
      <path ${o('d="M6 11 H34 L32 15 H8 Z"')} fill="#C9453A"/>
      <rect ${o('x="9" y="15" width="3.5" height="20"')} fill="#C9453A"/>
      <rect ${o('x="27.5" y="15" width="3.5" height="20"')} fill="#C9453A"/>
      <rect ${o('x="8" y="19" width="24" height="2.6"')} fill="#C9453A"/>
    `,
  },

  // --- Travel --------------------------------------------------------------
  {
    id: 'in_chai',
    pack: 'travel_in',
    label: 'Masala chai',
    svg: `
      <path ${o('d="M11 14 H27 L25 32 H13 Z"')} fill="#D9A76B"/>
      <path ${o('d="M27 17 q6 1 0 8"')} fill="none" stroke-linecap="round"/>
      <path ${o('d="M13 14 q7 -4 14 0"')} fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'jp_sushi',
    pack: 'travel_jp',
    label: 'Sushi',
    svg: `
      <rect ${o('x="8" y="18" width="24" height="9" rx="4"')} fill="#F7F3EA"/>
      <path ${o('d="M8 20 q12 -9 24 0 q-12 4 -24 0 Z"')} fill="#E4572E"/>
    `,
  },
  // --- Star chart (Family) -----------------------------------------------
  {
    id: 'sc_rewardjar',
    pack: 'star_chart',
    label: 'Reward jar',
    type: 'object',
    style: 'resin',
    svg: `
      <rect ${soft('x="8" y="7" width="24" height="5.5" rx="2"')} fill="url(#scSteel)"/>
      <rect ${soft('x="9.5" y="11.5" width="21" height="23" rx="5"')} fill="url(#scGlass)"/>
      <rect x="10.5" y="14.5" width="19" height="10" rx="2" fill="#FFFDF7"/>
      <text x="20" y="21.5" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="4.2" fill="#1E5E9E">REWARD</text>
      <circle cx="14.8" cy="27" r="2.2" fill="#F2B134"/>
      <circle cx="19.6" cy="28.4" r="2.5" fill="#D9564A"/>
      <circle cx="24.8" cy="27" r="2.1" fill="#3B8FD6"/>
      <circle cx="17" cy="31.2" r="2" fill="#2A9D8F"/>
      <circle cx="22.9" cy="31.4" r="2.2" fill="#8E6FD0"/>
      ${khi(13, 15.5, 2.6, 5.2, 0.55)}
    `,
  },
  {
    id: 'sc_firstplace',
    pack: 'star_chart',
    label: 'First place',
    type: 'badge',
    style: 'resin',
    svg: `
      <path ${soft('d="M14 30 L10 38 L16 36 L18 30 Z"')} fill="url(#scRed)"/>
      <path ${soft('d="M26 30 L30 38 L24 36 L22 30 Z"')} fill="url(#scBlue)"/>
      ${burst(20, 19, 12, 17.5, 14, 'url(#scBlue)')}
      <circle ${soft('cx="20" cy="19" r="12"')} fill="#EAF4FF"/>
      <text x="20" y="24.2" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="9" fill="#1E5E9E">1st</text>
      ${khi(14, 11, 4, 2.2, 0.7)}
    `,
  },
  {
    id: 'sc_welldone',
    pack: 'star_chart',
    label: 'Well done',
    type: 'badge',
    style: 'resin',
    svg: `
      <circle ${soft('cx="20" cy="20" r="16.5"')} fill="url(#scWhite)"/>
      <circle ${soft('cx="20" cy="20" r="12.2"')} fill="url(#scBlueDeep)"/>
      <text x="20" y="18.6" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="5.4" fill="#fff">WELL</text>
      <text x="20" y="24.9" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="5.4" fill="#fff">DONE</text>
      ${khi(13, 11.5, 4, 2, 0.65)}
    `,
  },
  {
    id: 'sc_smiley',
    pack: 'star_chart',
    label: 'Smiley',
    type: 'object',
    style: 'resin',
    svg: `
      <circle ${soft('cx="20" cy="20" r="16.5"')} fill="url(#scYellowRadial)"/>
      <ellipse cx="14.6" cy="17" rx="1.6" ry="2.2" fill="#3E362E"/>
      <ellipse cx="25.4" cy="17" rx="1.6" ry="2.2" fill="#3E362E"/>
      <path d="M13 23.5 Q20 30 27 23.5" fill="none" stroke="#3E362E" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="11.5" cy="22" r="2.4" fill="#E88AA0" opacity=".35"/>
      <circle cx="28.5" cy="22" r="2.4" fill="#E88AA0" opacity=".35"/>
      ${khi(13, 11.5, 4.2, 2.2, 0.7)}
    `,
  },
  {
    id: 'sc_medal',
    pack: 'star_chart',
    label: 'Medal',
    type: 'badge',
    style: 'resin',
    svg: `
      <path ${soft('d="M15 3 L9.5 19 L15.5 16.5 L18 5 Z"')} fill="url(#scRed)"/>
      <path ${soft('d="M25 3 L30.5 19 L24.5 16.5 L22 5 Z"')} fill="url(#scBlue)"/>
      <circle ${soft('cx="20" cy="13" r="3.2"')} fill="url(#scGold)"/>
      <circle cx="20" cy="13" r="1.4" fill="#8E6A10"/>
      <circle ${soft('cx="20" cy="25.5" r="12"')} fill="url(#scGoldRadial)"/>
      <circle cx="20" cy="25.5" r="9.3" fill="none" stroke="#B8860B" stroke-width=".9" opacity=".65"/>
      ${star5(20, 25.5, 5.6, 2.4, '#8E6A10')}
      ${khi(15, 20.5, 3.6, 1.8, 0.7)}
    `,
  },
  {
    id: 'sc_choretimer',
    pack: 'star_chart',
    label: 'Chore timer',
    type: 'object',
    style: 'resin',
    svg: `
      <rect ${soft('x="9" y="7" width="22" height="27" rx="4"')} fill="url(#scGold)"/>
      <rect x="12" y="10" width="16" height="20" rx="2" fill="#FFFDF7"/>
      <path ${soft('d="M16 13 H24 L21 19 L24 26 H16 L19 19 Z"')} fill="url(#scBlueDeep)"/>
      <path d="M16 13 H24 L21 19 Z" fill="#F2B134"/>
      <circle cx="15" cy="5.8" r="1.5" fill="url(#scSteel)"/>
      <circle cx="25" cy="5.8" r="1.5" fill="url(#scSteel)"/>
      ${khi(13, 11, 3, 1.4, 0.55)}
    `,
  },
  {
    id: 'sc_superhelper',
    pack: 'star_chart',
    label: 'Super helper',
    type: 'badge',
    style: 'resin',
    svg: `
      ${burst(20, 20, 16, 17.5, 13, 'url(#scPurple)')}
      <text x="20" y="18.2" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="4.8" fill="#fff">SUPER</text>
      <text x="20" y="22.8" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="4.6" fill="#fff">HELPER</text>
      ${khi(13, 12, 3.6, 1.8, 0.55)}
    `,
  },
  {
    id: 'sc_goldstar',
    pack: 'star_chart',
    label: 'Gold star',
    type: 'badge',
    style: 'resin',
    svg: `
      ${star5(20, 20, 17, 8, 'url(#scGoldRadial)')}
      ${star5(20, 19, 9, 3.8, 'rgba(255,255,255,.22)')}
      ${khi(15, 12.5, 4.2, 2.2, 0.7)}
    `,
  },
  {
    id: 'sc_crown',
    pack: 'star_chart',
    label: 'Crown',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M7 14 L12 26 L16 18 L20 27 L24 18 L28 26 L33 14 L31 30 H9 Z"')} fill="url(#scGold)"/>
      <rect ${soft('x="9" y="29" width="22" height="4" rx="1.5"')} fill="url(#scGold)"/>
      <circle cx="12" cy="26" r="1.3" fill="#D9564A"/>
      <circle cx="20" cy="27" r="1.6" fill="#3B8FD6"/>
      <circle cx="28" cy="26" r="1.3" fill="#2A9D8F"/>
      ${khi(12, 16, 4, 1.8, 0.65)}
    `,
  },
  {
    id: 'sc_plusone',
    pack: 'star_chart',
    label: '+1',
    type: 'badge',
    style: 'resin',
    svg: `
      <rect ${soft('x="5" y="11" width="30" height="20" rx="6"')} fill="url(#scGreen)"/>
      <rect x="6.5" y="12.5" width="27" height="6" rx="3" fill="#fff" opacity=".25"/>
      <text x="20" y="26" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="11" fill="#fff">+1</text>
      ${khi(10, 15, 3.5, 1.6, 0.55)}
    `,
  },

  // --- Cute originals ------------------------------------------------------
  {
    id: 'cu_mochi',
    pack: 'cute',
    label: 'Mochi the cat',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M11.8 13.2 L10.2 2.6 L19.6 9 Z"')} fill="url(#cuCream)"/>
      <path ${soft('d="M28.2 13.2 L29.8 2.6 L20.4 9 Z"')} fill="url(#cuCream)"/>
      <path d="M13 10.8 L12.2 5.4 L17.2 9 Z" fill="#F6BFCB"/>
      <path d="M27 10.8 L27.8 5.4 L22.8 9 Z" fill="#F6BFCB"/>
      <path ${soft('d="M8.6 17.4 C8.6 10.6 13.2 7.4 20 7.4 C26.8 7.4 31.4 10.6 31.4 17.4 L31.4 25.4 C31.4 30.8 26.6 33.6 20 33.6 C13.4 33.6 8.6 30.8 8.6 25.4 Z"')} fill="url(#cuCream)"/>
      <ellipse cx="12.4" cy="24.6" rx="3.2" ry="2" fill="#F8C8D2" opacity=".55"/>
      <ellipse cx="27.6" cy="24.6" rx="3.2" ry="2" fill="#F8C8D2" opacity=".55"/>
      <path d="M14.4 20.4 q2.2 2.1 4.4 0 M21.2 20.4 q2.2 2.1 4.4 0" fill="none" stroke="#6B4A55" stroke-width="1.15" stroke-linecap="round"/>
      <path ${soft('d="M18.9 22.6 H21.1 L20 24.1 Z"')} fill="#E8899F"/>
      <path d="M20 24.1 v1.2 M20 25.3 q-1.7 1.5 -3.2 0 M20 25.3 q1.7 1.5 3.2 0" fill="none" stroke="#6B4A55" stroke-width=".95" stroke-linecap="round"/>
      <rect ${soft('x="12.4" y="29.8" width="15.2" height="3.2" rx="1.6"')} fill="url(#cuPink)"/>
      <path d="M16 30.2 v2.4 M20 30.2 v2.4 M24 30.2 v2.4" stroke="#FFF2F6" stroke-width=".9" opacity=".7"/>
      <circle ${soft('cx="20" cy="34.8" r="1.9"')} fill="url(#scGold)"/>
      <path d="M20 33.8 v.6" stroke="#8E6A10" stroke-width=".8" stroke-linecap="round"/>
      ${khi(14, 11.8, 3, 1.6, 0.75)}
    `,
  },
  {
    id: 'cu_toast',
    pack: 'cute',
    label: 'Squishy cat bread',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M13.2 12 L14 5.2 L18.6 9.2 Z"')} fill="url(#cuToast)"/>
      <path ${soft('d="M26.8 12 L26 5.2 L21.4 9.2 Z"')} fill="url(#cuToast)"/>
      <path ${soft('d="M9.4 16 Q9.4 9.2 15 9.2 H25 Q30.6 9.2 30.6 16 V29.2 Q30.6 34 25.4 34 H14.6 Q9.4 34 9.4 29.2 Z"')} fill="url(#cuToast)"/>
      <path ${soft('d="M12 17.2 Q12 12.6 16 12.6 H24 Q28 12.6 28 17.2 V27.6 Q28 31.4 24.4 31.4 H15.6 Q12 31.4 12 27.6 Z"')} fill="url(#cuCream)"/>
      <path d="M15.4 15.4 L15.9 12 L18.4 14.4 Z" fill="#F6BFCB"/>
      <path d="M24.6 15.4 L24.1 12 L21.6 14.4 Z" fill="#F6BFCB"/>
      <ellipse cx="14.6" cy="24.8" rx="2.6" ry="1.7" fill="#F8C8D2" opacity=".6"/>
      <ellipse cx="25.4" cy="24.8" rx="2.6" ry="1.7" fill="#F8C8D2" opacity=".6"/>
      <path d="M16.4 20.4 q1.9 1.9 3.8 0 M19.8 20.4 q1.9 1.9 3.8 0" fill="none" stroke="#6B4A55" stroke-width="1.05" stroke-linecap="round"/>
      <path ${soft('d="M19 22.5 H21 L20 23.9 Z"')} fill="#E8899F"/>
      <path d="M20 23.9 v1 M20 24.9 q-1.5 1.4 -2.9 0 M20 24.9 q1.5 1.4 2.9 0" fill="none" stroke="#6B4A55" stroke-width=".9" stroke-linecap="round"/>
      ${khi(14.6, 15.4, 2.6, 1.5, 0.6)}
    `,
  },
  {
    id: 'cu_strawberry',
    pack: 'cute',
    label: 'Strawberry',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M20 9.6 C27.4 9.6 32.6 15 31.6 21.4 C30.6 27.8 25.4 34.2 20 34.2 C14.6 34.2 9.4 27.8 8.4 21.4 C7.4 15 12.6 9.6 20 9.6 Z"')} fill="url(#cuStrawberry)"/>
      <path ${soft('d="M20 11 C17.5 8.2 13.8 7 11 8.6 C13 10.4 15 11.4 17.4 11.8 C15.4 13 14.2 14.4 13.6 16.4 C16.6 15.4 18.6 13.6 20 11.6 C21.4 13.6 23.4 15.4 26.4 16.4 C25.8 14.4 24.6 13 22.6 11.8 C25 11.4 27 10.4 29 8.6 C26.2 7 22.5 8.2 20 11 Z"')} fill="url(#scGreen)"/>
      <path ${soft('d="M19.4 10.4 Q19 6.6 21 5 Q21.6 7.4 20.6 10.6 Z"')} fill="#3E7A45"/>
      <ellipse cx="14" cy="17" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(-18 14 17)"/>
      <ellipse cx="20" cy="15.6" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9"/>
      <ellipse cx="26" cy="17" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(18 26 17)"/>
      <ellipse cx="12.6" cy="22.6" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(-24 12.6 22.6)"/>
      <ellipse cx="27.4" cy="22.6" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(24 27.4 22.6)"/>
      <ellipse cx="17" cy="25" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(-14 17 25)"/>
      <ellipse cx="23" cy="25" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9" transform="rotate(14 23 25)"/>
      <ellipse cx="20" cy="30.4" rx="1" ry="1.5" fill="#FFE7C4" opacity=".9"/>
      <path d="M15.6 20.4 q2 1.9 4 0 M20.4 20.4 q2 1.9 4 0" fill="none" stroke="#6B2A2A" stroke-width="1.05" stroke-linecap="round"/>
      <path ${soft('d="M19 22.5 q1 1 2 0"')} fill="#6B2A2A"/>
      <ellipse cx="13.4" cy="23.2" rx="2.4" ry="1.6" fill="#F2A0A0" opacity=".55"/>
      <ellipse cx="26.6" cy="23.2" rx="2.4" ry="1.6" fill="#F2A0A0" opacity=".55"/>
      ${khi(13, 14.6, 3, 2, 0.45)}
    `,
  },
  {
    id: 'cu_sunglasses',
    pack: 'cute',
    label: 'Heart sunglasses',
    type: 'object',
    style: 'resin',
    svg: `
      <path d="M7.2 16.6 L4.6 13.8 M32.8 16.6 L35.4 13.8" fill="none" stroke="#B95670" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M18.8 19.2 q1.2 1.7 2.4 0" fill="none" stroke="#B95670" stroke-width="1.4" stroke-linecap="round"/>
      <g transform="translate(13.2 20.4) scale(.716) translate(-10 -9.4)">
        <path ${soft('d="M10 18.4 C4 13.6 1.2 10.7 1.2 7.7 C1.2 5 3.4 3.4 5.6 3.4 C7.4 3.4 9.2 4.8 10 6.2 C10.8 4.8 12.6 3.4 14.4 3.4 C16.6 3.4 18.8 5 18.8 7.7 C18.8 10.7 16 13.6 10 18.4 Z"')} fill="url(#cuPinkDeep)"/>
        <path d="M10 16.4 C5.4 12.6 3.4 10.4 3.4 8.2 C3.4 6.4 4.8 5.4 6.2 5.4 C7.5 5.4 8.9 6.6 10 8.4 C11.1 6.6 12.5 5.4 13.8 5.4 C15.2 5.4 16.6 6.4 16.6 8.2 C16.6 10.4 14.6 12.6 10 16.4 Z" fill="#F7C3D0" opacity=".9"/>
        <path d="M5.2 8.6 q1.6 -2.4 3.8 -2.2" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".75"/>
      </g>
      <g transform="translate(26.8 20.4) scale(.716) translate(-10 -9.4)">
        <path ${soft('d="M10 18.4 C4 13.6 1.2 10.7 1.2 7.7 C1.2 5 3.4 3.4 5.6 3.4 C7.4 3.4 9.2 4.8 10 6.2 C10.8 4.8 12.6 3.4 14.4 3.4 C16.6 3.4 18.8 5 18.8 7.7 C18.8 10.7 16 13.6 10 18.4 Z"')} fill="url(#cuPinkDeep)"/>
        <path d="M10 16.4 C5.4 12.6 3.4 10.4 3.4 8.2 C3.4 6.4 4.8 5.4 6.2 5.4 C7.5 5.4 8.9 6.6 10 8.4 C11.1 6.6 12.5 5.4 13.8 5.4 C15.2 5.4 16.6 6.4 16.6 8.2 C16.6 10.4 14.6 12.6 10 16.4 Z" fill="#F7C3D0" opacity=".9"/>
        <path d="M5.2 8.6 q1.6 -2.4 3.8 -2.2" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".75"/>
      </g>
      ${sparkle(25.8, 9.6, 2.4, '#F2C443')}
      ${sparkle(32.2, 13.6, 1.6, '#EFA3B4')}
      ${sparkle(29, 7.4, 1.2, '#EFA3B4')}
      ${khi(10.4, 16.6, 2.2, 1.2, 0.55)}
    `,
  },
  {
    id: 'cu_bow',
    pack: 'cute',
    label: 'Satin bow',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M19.2 21.8 C16.4 26 14.6 29.6 13.4 33.4 L17 31.8 L18.6 34.2 C19.2 30 19.8 25.8 20.2 22.4 Z"')} fill="url(#cuPinkDeep)"/>
      <path ${soft('d="M20.8 21.8 C23.6 26 25.4 29.6 26.6 33.4 L23 31.8 L21.4 34.2 C20.8 30 20.2 25.8 19.8 22.4 Z"')} fill="url(#cuPinkDeep)"/>
      <path ${soft('d="M19.4 21 C14.8 14.4 8.6 14.6 7.4 18.4 C6.2 22.4 11.4 25.2 19.4 21 Z"')} fill="url(#cuPink)"/>
      <path ${soft('d="M20.6 21 C25.2 14.4 31.4 14.6 32.6 18.4 C33.8 22.4 28.6 25.2 20.6 21 Z"')} fill="url(#cuPink)"/>
      <path d="M10.4 18.6 C12 16.6 15.4 16.6 18 20.2" fill="none" stroke="#D0879C" stroke-width="1" stroke-linecap="round" opacity=".8"/>
      <path d="M29.6 18.6 C28 16.6 24.6 16.6 22 20.2" fill="none" stroke="#D0879C" stroke-width="1" stroke-linecap="round" opacity=".8"/>
      <rect ${soft('x="17.4" y="18.6" width="5.2" height="4.8" rx="2.2"')} fill="url(#cuPinkDeep)"/>
      ${khi(13.4, 18.4, 3, 1.4, 0.55)}
      ${khi(28.4, 18, 2.4, 1.2, 0.4)}
    `,
  },
  {
    id: 'cu_bunny',
    pack: 'cute',
    label: 'Bunny plush',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M14.6 12.6 C12.6 6 13.2 3.4 15.4 3.4 C17.6 3.4 18.6 6.6 18.4 12 Z"')} fill="url(#cuCream)"/>
      <path ${soft('d="M21.6 12 C21.4 6.6 22.4 3.4 24.6 3.4 C26.8 3.4 27.4 6 25.4 12.6 Z"')} fill="url(#cuCream)"/>
      <path d="M15.6 11.2 C14.8 7 15 5.4 15.6 5.2 C16.4 5.2 17 7 17.4 10.8 Z" fill="#F6BFCB"/>
      <path d="M24.4 11.2 C25.2 7 25 5.4 24.4 5.2 C23.6 5.2 23 7 22.6 10.8 Z" fill="#F6BFCB"/>
      <ellipse ${soft('cx="20" cy="28.2" rx="9.6" ry="7.8"')} fill="url(#cuCream)"/>
      <ellipse cx="20" cy="29.6" rx="5.4" ry="4.4" fill="#FBEFF2"/>
      <ellipse ${soft('cx="13.6" cy="25" rx="2.4" ry="3.4"')} fill="url(#cuCream)" transform="rotate(18 13.6 25)"/>
      <ellipse ${soft('cx="26.4" cy="25" rx="2.4" ry="3.4"')} fill="url(#cuCream)" transform="rotate(-18 26.4 25)"/>
      <ellipse ${soft('cx="15" cy="33.2" rx="3.4" ry="2.3"')} fill="url(#cuCream)"/>
      <ellipse ${soft('cx="25" cy="33.2" rx="3.4" ry="2.3"')} fill="url(#cuCream)"/>
      <ellipse cx="15" cy="33.2" rx="1.7" ry="1.1" fill="#F6BFCB"/>
      <ellipse cx="25" cy="33.2" rx="1.7" ry="1.1" fill="#F6BFCB"/>
      <ellipse ${soft('cx="20" cy="16.6" rx="8" ry="7.2"')} fill="url(#cuCream)"/>
      <ellipse cx="13.2" cy="20.4" rx="2.6" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <ellipse cx="26.8" cy="20.4" rx="2.6" ry="1.8" fill="#F8C8D2" opacity=".6"/>
      <path d="M15 17.4 q2 1.9 3.9 0 M21.1 17.4 q2 1.9 3.9 0" fill="none" stroke="#6B4A55" stroke-width="1.05" stroke-linecap="round"/>
      <path ${soft('d="M19.1 19.8 H20.9 L20 21.1 Z"')} fill="#E8899F"/>
      <path d="M20 21.1 v.9 M20 22 q-1.5 1.3 -2.8 0 M20 22 q1.5 1.3 2.8 0" fill="none" stroke="#6B4A55" stroke-width=".85" stroke-linecap="round"/>
      ${khi(16.4, 11.4, 1.6, 2.8, 0.5)}
      ${khi(15.2, 27.6, 2.4, 1.4, 0.4)}
    `,
  },
  {
    id: 'cu_mic',
    pack: 'cute',
    label: 'Sparkle mic',
    type: 'object',
    style: 'resin',
    svg: `
      <g transform="rotate(-17 22 24)">
        <rect ${soft('x="20.2" y="22.2" width="17.6" height="4.6" rx="2.3"')} fill="url(#cuPink)"/>
        <rect ${soft('x="22" y="21.9" width="2.4" height="5.2" rx="1.1"')} fill="url(#scGold)"/>
        <rect x="27.6" y="23.1" width="7" height="1" rx=".5" fill="#fff" opacity=".38"/>
      </g>
      <circle ${soft('cx="14" cy="21.4" r="8.2"')} fill="url(#scSteel)"/>
      <path d="M7.8 18.6 q6.2 2.2 12.4 0 M7.2 21.8 q6.8 2.4 13.6 0 M8.2 25 q5.8 2 11.6 0" fill="none" stroke="rgba(70,80,90,.35)" stroke-width=".75"/>
      <path d="M14 13.2 v16.4 M10.2 14.4 q-1.6 7 0 14 M17.8 14.4 q1.6 7 0 14" fill="none" stroke="rgba(70,80,90,.22)" stroke-width=".7"/>
      <circle ${soft('cx="14" cy="21.4" r="8.2"')} fill="none"/>
      ${khi(10.6, 17.4, 3, 2.1, 0.85)}
      ${sparkle(27.6, 9.4, 2.6, '#F2C443')}
      ${sparkle(33.2, 20.2, 1.8, '#EFA3B4')}
      ${sparkle(30, 6.4, 1.2, '#EFA3B4')}
      <circle cx="24" cy="8.4" r=".9" fill="#F2C443"/>
    `,
  },
  {
    id: 'cu_rainbow',
    pack: 'cute',
    label: 'Rainbow',
    type: 'object',
    style: 'resin',
    svg: `
      <path ${soft('d="M4 28 A16 16 0 0 1 36 28 L33.8 28 A13.8 13.8 0 0 0 6.2 28 Z"')} fill="url(#cuPink)"/>
      <path ${soft('d="M6.2 28 A13.8 13.8 0 0 1 33.8 28 L31.6 28 A11.6 11.6 0 0 0 8.4 28 Z"')} fill="#F8C9A8"/>
      <path ${soft('d="M8.4 28 A11.6 11.6 0 0 1 31.6 28 L29.4 28 A9.4 9.4 0 0 0 10.6 28 Z"')} fill="#F7DF8E"/>
      <path ${soft('d="M10.6 28 A9.4 9.4 0 0 1 29.4 28 L27.2 28 A7.2 7.2 0 0 0 12.8 28 Z"')} fill="#BCE6CC"/>
      <path ${soft('d="M12.8 28 A7.2 7.2 0 0 1 27.2 28 L26 28 A6 6 0 0 0 14 28 Z"')} fill="#A9D8F0"/>
      <ellipse ${soft('cx="7.4" cy="29.6" rx="5" ry="3.6"')} fill="url(#scWhite)"/>
      <ellipse ${soft('cx="11.4" cy="27.8" rx="4" ry="3.1"')} fill="url(#scWhite)"/>
      <ellipse ${soft('cx="15" cy="30" rx="3.8" ry="2.8"')} fill="url(#scWhite)"/>
      <ellipse ${soft('cx="32.6" cy="29.6" rx="5" ry="3.6"')} fill="url(#scWhite)"/>
      <ellipse ${soft('cx="28.6" cy="27.8" rx="4" ry="3.1"')} fill="url(#scWhite)"/>
      <ellipse ${soft('cx="25" cy="30" rx="3.8" ry="2.8"')} fill="url(#scWhite)"/>
      <path d="M5.8 29.6 q1.2 1.2 2.4 0 M13.8 30 q1.2 1.2 2.4 0 M31 29.6 q1.2 1.2 2.4 0 M23.8 30 q1.2 1.2 2.4 0" fill="none" stroke="#6B4A55" stroke-width=".85" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cu_butterfly',
    pack: 'cute',
    label: 'Butterfly clip',
    type: 'object',
    style: 'resin',
    svg: `
      <path d="M18.8 12.6 Q17 7.6 14.8 6.4 M21.2 12.6 Q23 7.6 25.2 6.4" fill="none" stroke="#6B4A55" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="14.4" cy="6.2" r="1.1" fill="#6B4A55"/>
      <circle cx="25.6" cy="6.2" r="1.1" fill="#6B4A55"/>
      <path ${soft('d="M19 20 C13 10.6 5.6 10.4 4.6 16.2 C3.8 21 10.4 22.8 19 21.6 Z"')} fill="url(#cuLav)"/>
      <path ${soft('d="M21 20 C27 10.6 34.4 10.4 35.4 16.2 C36.2 21 29.6 22.8 21 21.6 Z"')} fill="url(#cuLav)"/>
      <path ${soft('d="M19 22.4 C12.6 23 7.4 25.6 8.4 30.2 C9.4 34.4 15.4 32.6 19 25.6 Z"')} fill="url(#cuLav)"/>
      <path ${soft('d="M21 22.4 C27.4 23 32.6 25.6 31.6 30.2 C30.6 34.4 24.6 32.6 21 25.6 Z"')} fill="url(#cuLav)"/>
      <ellipse cx="10.6" cy="17.2" rx="2.4" ry="1.8" fill="#EFE4FC" opacity=".7" transform="rotate(-24 10.6 17.2)"/>
      <ellipse cx="29.4" cy="17.2" rx="2.4" ry="1.8" fill="#EFE4FC" opacity=".7" transform="rotate(24 29.4 17.2)"/>
      <ellipse cx="12.6" cy="27.2" rx="1.9" ry="1.5" fill="#EFE4FC" opacity=".6"/>
      <ellipse cx="27.4" cy="27.2" rx="1.9" ry="1.5" fill="#EFE4FC" opacity=".6"/>
      <ellipse ${soft('cx="20" cy="21.4" rx="1.9" ry="8.4"')} fill="#6B4A55"/>
      <circle ${soft('cx="20" cy="13" r="2.2"')} fill="#6B4A55"/>
      <circle cx="19.3" cy="12.4" r=".7" fill="#EFE4FC" opacity=".9"/>
      <rect ${soft('x="17.6" y="34" width="4.8" height="2.6" rx="1.3"')} fill="url(#scGold)"/>
      <path d="M20 30 v3.4" stroke="#C9A227" stroke-width="1.1" stroke-linecap="round"/>
      ${khi(9.4, 14.4, 2.6, 1.2, 0.5)}
      ${sparkle(30.8, 10.4, 1.5, '#F2C443')}
    `,
  },
  {
    id: 'cu_lovebracelet',
    pack: 'cute',
    label: 'LOVE bracelet',
    type: 'object',
    style: 'resin',
    svg: `
      ${beadRing(20, 21, 10.6, 15, ['#F6C6D4', '#D9C8F2', '#BEE7D2', '#FBE7A8', '#BFDCF2', '#F8D2B4'])}
      <text x="13.6" y="29.8" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="1.9" fill="#5A4A50">L</text>
      <text x="17.8" y="32.1" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="1.9" fill="#5A4A50">O</text>
      <text x="22.2" y="32.1" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="1.9" fill="#5A4A50">V</text>
      <text x="26.4" y="29.8" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="1.9" fill="#5A4A50">E</text>
      <circle cx="20" cy="33.9" r="1" fill="none" stroke="#B8860B" stroke-width=".75"/>
      <path ${soft('d="M20 37.4 C18.7 36.4 18.1 35.8 18.1 35.3 C18.1 34.9 18.45 34.6 18.85 34.6 C19.2 34.6 19.55 34.85 20 35.2 C20.45 34.85 20.8 34.6 21.15 34.6 C21.55 34.6 21.9 34.9 21.9 35.3 C21.9 35.8 21.3 36.4 20 37.4 Z"')} fill="url(#scGold)"/>
      ${khi(14.6, 12.4, 2.6, 1.4, 0.6)}
    `,
  },
  {
    id: 'cu_roundmagnet',
    pack: 'cute',
    label: 'Round magnets',
    type: 'holder',
    style: 'resin',
    svg: `
      <circle ${soft('cx="20" cy="20" r="13"')} fill="url(#cuPinkRadial)"/>
      <ellipse cx="20" cy="28.4" rx="8.6" ry="2.6" fill="#A9536D" opacity=".22"/>
      ${khi(15.4, 14, 4.6, 3.4, 0.8)}
    `,
  },

];

// Every existing row is an object magnet for now. Ported resin art
// overrides style: 'resin' (and specific type) on its catalog entry.
export const MAGNETS = MAGNETS_ART.map((item) => ({
  type: 'object',
  style: 'cartoon',
  ...item,
}));
