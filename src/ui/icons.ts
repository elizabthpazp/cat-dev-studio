import type { Role } from '../game/store';

/** Iconos propios en SVG (24×24) para no depender de emojis, que cambian según el sistema. */
const P: Record<string, string> = {
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.7 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.7 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path fill="var(--ico-2, rgba(0,0,0,.28))" d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm.9 8.6v1.2h-1.8v-1.2c-1-.2-1.8-.9-2-1.9l1.6-.5c.2.6.7 1 1.5 1 .7 0 1.1-.3 1.1-.7 0-.5-.5-.7-1.5-.9-1.3-.3-2.5-.7-2.5-2.1 0-1 .7-1.7 1.8-1.9V7.7h1.8v1.2c.9.2 1.5.8 1.8 1.6l-1.5.6c-.2-.5-.6-.8-1.2-.8s-1 .3-1 .6c0 .4.4.6 1.4.8 1.4.3 2.6.8 2.6 2.2 0 1-.7 1.8-2.1 2.2z"/>',
  bug: '<path d="M8.6 5.2 7 3.6l1.2-1.2 1.9 1.9a5 5 0 0 1 3.8 0l1.9-1.9L17 3.6l-1.6 1.6A5 5 0 0 1 17 8.3H7a5 5 0 0 1 1.6-3.1z"/><path d="M6.5 9.8h11v4.7a5.5 5.5 0 0 1-4.7 5.4v-8h-1.6v8a5.5 5.5 0 0 1-4.7-5.4z"/><path d="M2.5 10.5h3.2v1.8H2.5zm15.8 0h3.2v1.8h-3.2zM2.5 16.5l3.4-1.3.6 1.7-3.4 1.3zm19 0-3.4-1.3-.6 1.7 3.4 1.3z"/>',
  clock: '<path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm1 9.6 3.6 2.1-.9 1.6-4.6-2.7V6.5H13z"/>',
  pause: '<rect x="5.5" y="4" width="4.6" height="16" rx="1.6"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.6"/>',
  play: '<path d="M7 4.6v14.8c0 .8.9 1.3 1.6.8l11.2-7.4a1 1 0 0 0 0-1.6L8.6 3.8C7.9 3.3 7 3.8 7 4.6z"/>',
  coffee: '<path d="M3 8h14v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z"/><path d="M17 9.5h1.5a3 3 0 0 1 0 6H16.6l.6-2h1.3a1 1 0 0 0 0-2H17z"/><path d="M7 2.5c1.2 1 1.2 2.2 0 3.3M11 2.5c1.2 1 1.2 2.2 0 3.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  eye: '<path d="M12 5C6.5 5 2.6 9.5 1.5 12c1.1 2.5 5 7 10.5 7s9.4-4.5 10.5-7C21.4 9.5 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/><circle cx="12" cy="12" r="2"/>',
  help: '<path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 15.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.4-5.1c-.6.4-.6.6-.6 1.2h-2c0-1.4.4-2 1.4-2.7.8-.5 1.2-.8 1.2-1.5 0-.6-.5-1.1-1.4-1.1-.9 0-1.5.5-1.6 1.4l-2-.3C8.6 7.9 10 6.7 12 6.7c2.2 0 3.6 1.2 3.6 3 0 1.4-.9 2.2-2.2 3z"/>',
  scroll: '<path d="M6 3h11a3 3 0 0 1 3 3v1h-4v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h3V6a3 3 0 0 1 3-3z" opacity=".35"/><path d="M8 3h9a3 3 0 0 1 3 3v1h-4v11a3 3 0 0 1-6 0v-1H8z"/><path d="M11 9h3M11 12h3" stroke="var(--ico-2, rgba(0,0,0,.35))" stroke-width="1.6" stroke-linecap="round"/>',
  restart: '<path d="M12 4.5a7.5 7.5 0 1 1-7.3 9.2l2-.5A5.5 5.5 0 1 0 8.2 8l2.3 2.2H3.5V3.2l2.3 2.3A7.5 7.5 0 0 1 12 4.5z"/>',
  home: '<path d="M12 3 2.5 11h2.8v9.5h5V15h3.4v5.5h5V11h2.8z"/>',
  close: '<path d="m6.2 4.4 5.8 5.8 5.8-5.8 1.8 1.8-5.8 5.8 5.8 5.8-1.8 1.8-5.8-5.8-5.8 5.8-1.8-1.8 5.8-5.8-5.8-5.8z"/>',
  check: '<path d="M9.5 15.6 5.4 11.5l-2 2 6.1 6.1L20.6 8.5l-2-2z"/>',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 6 10zm2 0h6V8a3 3 0 0 0-6 0z"/>',
  bolt: '<path d="M13.5 2 5 13.5h6L10 22l9-12.5h-6z"/>',
  flame: '<path d="M12.5 2c.5 3-1.6 4.6-3 6.3C8 10 7 11.6 7 14a5 5 0 0 0 10 0c0-1.7-.7-3.2-1.6-4.3-.2 1.2-.8 2-1.7 2.4.4-3.6-.6-7.1-1.2-10.1z"/>',
  star: '<path d="m12 2.6 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5-4.9-4.5 6.6-.8z"/>',
  sound: '<path d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mouse: '<path d="M12 2.5a6 6 0 0 0-6 6v7a6 6 0 0 0 12 0v-7a6 6 0 0 0-6-6zm.9 6.5h-1.8V5.3h1.8z"/>',
  hammer: '<path d="M3.5 6.5 8 2l5.5 3-2 2 1.5 1.5L21 16.5 18.5 19l-8-8L9 12.5z"/>',
  team: '<circle cx="8" cy="8" r="3.2"/><circle cx="16.5" cy="8.6" r="2.7"/><path d="M1.8 19c.4-3.6 3-5.8 6.2-5.8s5.8 2.2 6.2 5.8zm13.4 0c-.2-1.9-.9-3.4-2-4.5a5.4 5.4 0 0 1 9 4.5z"/>'
};

export const icon = (name: keyof typeof P | string, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P[name] ?? ''}</svg>`;

/** Ajusta el brillo de un color hex (k > 0 aclara, k < 0 oscurece). */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255];
  const out = c.map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Retrato de gato dibujado en SVG, teñido con el color de cada miembro y con un accesorio por rol. */
export function catPortrait(role: Role, color: string) {
  const fur = color, dark = shade(color, -.45), light = shade(color, .35), line = '#1a1220';
  const extra: Record<Role, string> = {
    // Michi Jr.: cascos de gamer.
    junior: `<path d="M13 34a19 19 0 0 1 38 0" fill="none" stroke="${line}" stroke-width="4.5" stroke-linecap="round"/><rect x="8" y="31" width="9" height="14" rx="4" fill="#5fe3a1" stroke="${line}" stroke-width="2.5"/><rect x="47" y="31" width="9" height="14" rx="4" fill="#5fe3a1" stroke="${line}" stroke-width="2.5"/>`,
    // Gatardo: cejas de veterano y gafas rectangulares.
    senior: `<path d="M18 28l9 2.5M46 28l-9 2.5" stroke="${line}" stroke-width="3" stroke-linecap="round"/><rect x="17" y="31.5" width="12" height="8" rx="2.5" fill="rgba(180,220,255,.25)" stroke="${line}" stroke-width="2.4"/><rect x="35" y="31.5" width="12" height="8" rx="2.5" fill="rgba(180,220,255,.25)" stroke="${line}" stroke-width="2.4"/><path d="M29 35h6" stroke="${line}" stroke-width="2.4"/>`,
    // Michi PM: lápiz detrás de la oreja.
    pm: `<g transform="rotate(-38 50 18)"><rect x="40" y="15" width="22" height="5" rx="1.5" fill="#ffcf5a" stroke="${line}" stroke-width="2"/><path d="M62 15l5 2.5-5 2.5z" fill="#f6dcb5" stroke="${line}" stroke-width="2" stroke-linejoin="round"/><rect x="37" y="15" width="4" height="5" fill="#ff8a7a" stroke="${line}" stroke-width="2"/></g>`,
    // Doña QA: lupa.
    qa: `<circle cx="42" cy="36" r="8" fill="rgba(200,240,255,.35)" stroke="${line}" stroke-width="3"/><path d="M48 42l6 6" stroke="${line}" stroke-width="4.5" stroke-linecap="round"/>`
  };
  return `<svg class="portrait" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M12 30 10 9l15 10M52 30l2-21-15 10" fill="${fur}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 23l-1-9 7 5M50 23l1-9-7 5" fill="#ffb3c0"/>
    <ellipse cx="32" cy="37" rx="22" ry="19" fill="${fur}" stroke="${line}" stroke-width="3"/>
    <ellipse cx="32" cy="45" rx="11" ry="7.5" fill="${light}"/>
    <path d="M23 21q9-4 18 0" fill="none" stroke="${dark}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="23" cy="35.5" rx="3.6" ry="${role === 'senior' ? 2.4 : 4.2}" fill="${line}"/><ellipse cx="41" cy="35.5" rx="3.6" ry="${role === 'senior' ? 2.4 : 4.2}" fill="${line}"/>
    <circle cx="24.2" cy="34" r="1.3" fill="#fff"/><circle cx="42.2" cy="34" r="1.3" fill="#fff"/>
    <path d="M30 42h4l-2 2.4z" fill="#ff8aa0" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M32 44.5q-1.8 3-4.5 1.5M32 44.5q1.8 3 4.5 1.5" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M10 41l9 1M10 46l9-1.5M54 41l-9 1M54 46l-9-1.5" stroke="${line}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
    ${extra[role]}
  </svg>`;
}
