export function getShipIconSvg() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="shipIconBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgba(130,220,255,.98)"/>
        <stop offset="1" stop-color="rgba(190,150,255,.95)"/>
      </linearGradient>
    </defs>
    <path d="M32 7 48 42 32 55 16 42 32 7Z" fill="none" stroke="url(#shipIconBody)" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 18 39 40 32 46 25 40 32 18Z" fill="rgba(130,220,255,.18)" stroke="rgba(130,220,255,.72)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M18 42 9 52M46 42l9 10" stroke="rgba(190,150,255,.8)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}
