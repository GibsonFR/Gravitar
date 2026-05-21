export function getCargoIconSvg() {
  return `
    <svg viewBox="0 0 64 64" class="ui-icon-svg" aria-hidden="true">
      <defs>
        <linearGradient id="cargoHull" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#d9e7f5"></stop>
          <stop offset="100%" stop-color="#8ea4bf"></stop>
        </linearGradient>
        <linearGradient id="cargoGlow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8bf7ff" stop-opacity="0.95"></stop>
          <stop offset="100%" stop-color="#4db1ff" stop-opacity="0.15"></stop>
        </linearGradient>
      </defs>
      <path d="M16 19h32l8 10v17a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V29l8-10Z" fill="rgba(8,14,22,0.95)" stroke="rgba(123,189,255,0.55)" stroke-width="2"></path>
      <path d="M24 14h16l7 8H17l7-8Z" fill="url(#cargoHull)"></path>
      <rect x="14" y="26" width="36" height="20" rx="6" fill="url(#cargoHull)" opacity="0.95"></rect>
      <rect x="19" y="30" width="26" height="12" rx="4" fill="rgba(12,20,31,0.9)"></rect>
      <path d="M29 20h6v10h10v4H35v10h-6V34H19v-4h10z" fill="url(#cargoGlow)"></path>
      <circle cx="21" cy="48" r="2.5" fill="#7ce7ff"></circle>
      <circle cx="43" cy="48" r="2.5" fill="#7ce7ff"></circle>
    </svg>`;
}
