export function getOptionsIconSvg() {
  return `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="optGear" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#e7f3ff"/>
          <stop offset="1" stop-color="#7fdcff"/>
        </linearGradient>
      </defs>
      <path fill="none" stroke="url(#optGear)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M32 10l4 7 8-1 4 7-5 6 5 6-4 7-8-1-4 7-8-7-8 1-4-7 5-6-5-6 4-7 8 1z" opacity=".92"/>
      <circle cx="32" cy="32" r="8" fill="rgba(125,233,255,.18)" stroke="#dff7ff" stroke-width="4"/>
    </svg>
  `;
}
