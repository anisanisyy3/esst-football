// ============================================================================
// LOGO HELPERS
// - tournamentMark(): original football-inspired ESST mark (inline SVG).
// - teamLogo(): uploaded logo, or automatic initials logo when none exists.
// No copyrighted club logos are used anywhere.
// ============================================================================

import { escapeHtml } from '../utils/dom.js';

/** Inline SVG badge used in the header, hero and admin sidebar. */
export function tournamentMark(size = 36) {
  return `
  <svg class="tournament-mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="esst-ball" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#10b981"/>
        <stop offset="1" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="21" fill="url(#esst-ball)"/>
    <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
    <path d="M24 16 L31.4 21.4 L28.6 30 L19.4 30 L16.6 21.4 Z"
          fill="#0b1120" stroke="#ecfdf5" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M24 16 V6.5 M31.4 21.4 L40.4 18.4 M28.6 30 L34.4 38.4 M19.4 30 L13.6 38.4 M16.6 21.4 L7.6 18.4"
          stroke="#ecfdf5" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

/** Deterministic pleasant color per team name (used for initials logos). */
const LOGO_COLORS = ['#10b981', '#38bdf8', '#a78bfa', '#f59e0b', '#fb7185', '#2dd4bf', '#f97316'];
function colorFor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

function initialsSvg(name, size) {
  const initials = String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
  const color = colorFor(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="${color}"/>
    <text x="32" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="700"
          fill="#071022" text-anchor="middle">${escapeHtml(initials)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Team logo element (HTML string).
 * Falls back to generated initials if the image URL is missing or broken.
 */
export function teamLogo(team, size = 40, cssClass = 'team-logo') {
  const fallback = initialsSvg(team?.name, size);
  if (team?.logo_url) {
    return `<img class="${cssClass}" src="${escapeHtml(team.logo_url)}" alt=""
      width="${size}" height="${size}" loading="lazy"
      style="width:${size}px;height:${size}px"
      onerror="this.onerror=null;this.src='${fallback}'">`;
  }
  return `<img class="${cssClass}" src="${fallback}" alt="" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px">`;
}
