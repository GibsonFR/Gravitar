export function getConverterIconSvg() {
  return `
    <svg viewBox="0 0 64 64" class="ui-icon-svg" aria-hidden="true">
      <defs>
        <linearGradient id="convCore" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#e5efff"></stop>
          <stop offset="100%" stop-color="#90a7c8"></stop>
        </linearGradient>
        <linearGradient id="convGlow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8ff3ff" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="#4e9dff" stop-opacity="0.18"></stop>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="rgba(8,14,22,0.95)" stroke="rgba(123,189,255,0.52)" stroke-width="2"></circle>
      <circle cx="32" cy="32" r="10" fill="url(#convCore)"></circle>
      <path d="M32 12a20 20 0 0 1 18 11" fill="none" stroke="url(#convGlow)" stroke-width="4" stroke-linecap="round"></path>
      <path d="M53 24l-1 9-8-4" fill="url(#convGlow)"></path>
      <path d="M32 52A20 20 0 0 1 14 41" fill="none" stroke="url(#convGlow)" stroke-width="4" stroke-linecap="round"></path>
      <path d="M11 40l1-9 8 4" fill="url(#convGlow)"></path>
      <circle cx="32" cy="32" r="4.5" fill="rgba(12,20,31,0.95)"></circle>
    </svg>`;
}
