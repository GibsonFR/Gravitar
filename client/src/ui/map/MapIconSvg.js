export function getMapIconSvg() {
  return `
  <svg class="ui-icon-svg" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="gMapA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgba(125,233,255,0.95)"/>
        <stop offset="1" stop-color="rgba(99,169,255,0.92)"/>
      </linearGradient>
      <linearGradient id="gMapB" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="rgba(140,255,205,0.65)"/>
        <stop offset="1" stop-color="rgba(125,233,255,0.15)"/>
      </linearGradient>
    </defs>
    <rect x="8" y="9" width="30" height="28" rx="7" fill="rgba(6,12,18,0.65)" stroke="rgba(180,220,255,0.26)"/>
    <path d="M12 14h22M12 20h22M12 26h22M12 32h22" stroke="rgba(160,210,255,0.22)" stroke-width="1"/>
    <path d="M17 12v22M23 12v22M29 12v22" stroke="rgba(160,210,255,0.18)" stroke-width="1"/>
    <path d="M14.5 30.5c5-7 10-11 17-14" fill="none" stroke="url(#gMapB)" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <circle cx="30.5" cy="16.5" r="2.6" fill="url(#gMapA)"/>
    <circle cx="17.2" cy="29.6" r="2.1" fill="rgba(241,197,90,0.95)"/>
    <circle cx="17.2" cy="29.6" r="5.2" fill="rgba(241,197,90,0.12)"/>
  </svg>`;
}
