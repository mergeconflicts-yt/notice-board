// Shared SVG helpers for resin magnet art. All helpers return inner SVG
// markup for the 40×40 art canvas. The bake script adds the padding, filter
// and shadow.

/** Soft resin edge — no thick cartoon outline. */
export const SOFT = 'stroke="rgba(70,45,20,.38)" stroke-width=".6" stroke-linejoin="round"';
export const soft = (attrs) => `${attrs} ${SOFT}`;

/** Small white highlight, light from the top-left. */
export function khi(cx, cy, rx, ry, opacity = 0.62, rotate = -28) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${opacity}" transform="rotate(${rotate} ${cx} ${cy})"/>`;
}

/** Five-point star. */
export function star5(cx = 20, cy = 20, outer = 16, inner = 7, fill = 'url(#scGoldRadial)') {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `<path ${soft(`d="M${pts.join(' L')} Z"`)} fill="${fill}"/>`;
}

/** Burst / rosette polygon. */
export function burst(cx = 20, cy = 20, points = 16, outer = 17.5, inner = 13, fill = 'url(#scBlue)') {
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `<path ${soft(`d="M${pts.join(' L')} Z"`)} fill="${fill}"/>`;
}

/** Four-point sparkle (concave star) — the cute-pack confetti accent. */
export function sparkle(cx, cy, r, fill = '#fff') {
  const k = r * 0.22;
  return `<path d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z" fill="${fill}"/>`;
}

/** A ring of round beads (bracelet bands). */
export function beadRing(cx, cy, radius, count, colors, beadR = 2.2) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `<circle ${soft(`cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${beadR}"`)} fill="${colors[i % colors.length]}"/>`;
  }).join('\n  ');
}

/** Rounded word plaque with a shine strip and baked text. */
export function wordmag(text, plaqueFill = 'url(#scYellow)', ink = '#3E362E', size = 6) {
  return `
    <rect ${soft('x="2.5" y="11" width="35" height="18" rx="5"')} fill="${plaqueFill}"/>
    <rect x="4" y="12.2" width="32" height="5" rx="2.5" fill="#fff" opacity=".32"/>
    <text x="20" y="${11 + 9 + size * 0.36}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="${size}" fill="${ink}">${text}</text>
    ${khi(8, 14.5, 3.4, 1.6, 0.55)}
  `;
}

/** Simple gold-framed place plaque with a scene window and name banner. */
export function plaque(name, scene = '', banner = 'url(#scBlue)') {
  const size = name.length > 8 ? 3.5 : 4.4;
  return `
    <rect ${soft('x="2" y="5" width="36" height="30" rx="4"')} fill="url(#scGold)"/>
    <rect x="4.4" y="7.4" width="31.2" height="19.6" rx="2" fill="#EAF6FF"/>
    ${scene}
    <rect x="4.4" y="27" width="31.2" height="6" rx="1.4" fill="${banner}"/>
    <text x="20" y="31.3" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="${size}" fill="#fff">${name}</text>
    ${khi(7, 8.5, 3.2, 1.2, 0.6)}
  `;
}

/** Wheel with tyre, rim and hub. */
export function rwheel(cx, cy, r, tyre = '#2B2620', hub = 'url(#scSteel)') {
  return `
    <circle ${soft(`cx="${cx}" cy="${cy}" r="${r}"`)} fill="${tyre}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="${hub}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#3A3733"/>
  `;
}

/** Two steam curves. */
export function steam(x = 20, y = 10) {
  return `
    <path d="M${x - 5} ${y} q2 -3 0 -6 q-2 -3 0 -5" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M${x + 2} ${y + 1} q2 -3 0 -6 q-2 -3 0 -5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.1" stroke-linecap="round"/>
  `;
}
