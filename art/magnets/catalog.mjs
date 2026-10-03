// Magnet art source (docs/plan-magnets.md §2).
//
// Export the art as data: each entry is { id, pack, label, svg }, where `svg`
// is the inner markup for a 40×40 viewBox. Every shape must be a *closed,
// filled* form carrying the shared dark OUTLINE — thin line-only art barely
// shows the 3D lighting the bake script applies. Stickers live in
// ../stickers/catalog.mjs and are baked flat (no lighting).
//
// ids follow `<pack>_<name>`, lower-case (st_fuji, kt_tomato, in_chai…).

export const OUTLINE = 'stroke="#282620" stroke-width="1.5" stroke-linejoin="round"';

// Shared outline wrapping: every art function returns inner markup already
// stroked with OUTLINE so the bake script only has to add the filter.
const o = (attrs) => `${attrs} ${OUTLINE}`;

export const PACKS = [
  { id: 'starter', name: 'Starter', kind: 'theme' },
  { id: 'kitchen', name: 'Kitchen', kind: 'theme' },
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

export const MAGNETS = [
  // --- Starter (bundled in the app) ---------------------------------------
  {
    id: 'st_fuji',
    pack: 'starter',
    label: 'Mt. Fuji',
    svg: `
      <path ${o('d="M3 34 L14.5 12.5 L20 20 L25.5 12.5 L37 34 Z"')} fill="#7FA8D8"/>
      <path ${o('d="M12.2 16.6 L14.5 12.5 L20 20 L25.5 12.5 L27.8 16.6 L24 14.6 L20 21 L16 14.6 Z"')} fill="#FFFFFF"/>
    `,
  },
  {
    id: 'st_boba',
    pack: 'starter',
    label: 'Bubble tea',
    svg: `
      <path ${o('d="M26.5 8 L28.5 10 L23 22"')} fill="none" stroke-linecap="round"/>
      <path ${o('d="M11 12 H29 L26.6 34 H13.4 Z"')} fill="#EAD9BC"/>
      <path ${o('d="M11 12 H29 L28.3 17 H11.7 Z"')} fill="#C9A27E"/>
      <path ${o('d="M13.4 30 H26.6 L26.1 34 H13.9 Z"')} fill="#8A5A3B"/>
      <circle ${o('cx="16" cy="28.4" r="2"')} fill="#3A2A20"/>
      <circle ${o('cx="21" cy="30.2" r="2"')} fill="#3A2A20"/>
      <circle ${o('cx="24.4" cy="27.6" r="1.7"')} fill="#3A2A20"/>
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
    id: 'kt_tomato',
    pack: 'kitchen',
    label: 'Tomato',
    svg: `
      <circle ${o('cx="20" cy="22" r="11"')} fill="#E4572E"/>
      <path ${o('d="M16 12 q4 -3 8 0 q-2 2 -4 1 q-2 1 -4 -1 Z"')} fill="#4E9A51"/>
      <path ${o('d="M20 12 V9"')} fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'kt_kettle',
    pack: 'kitchen',
    label: 'Kettle',
    svg: `
      <path ${o('d="M12 16 H28 L26.5 32 H13.5 Z"')} fill="#7A8B94"/>
      <path ${o('d="M28 18 q7 2 0 9"')} fill="none" stroke-linecap="round"/>
      <path ${o('d="M14 16 q6 -6 12 0"')} fill="none" stroke-linecap="round"/>
      <rect ${o('x="17" y="9" width="6" height="3" rx="1.4"')} fill="#B9C4C9"/>
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
];
