export function getBaseIconSvg() {
  return `<svg class="ui-icon-svg" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="baseG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#8ee8ff"/><stop offset="1" stop-color="#67f0c7"/></linearGradient></defs>
    <path d="M12 48h40V24L32 12 12 24v24z" fill="rgba(12,26,38,.68)" stroke="url(#baseG)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 48V31h20v17" fill="none" stroke="rgba(220,250,255,.75)" stroke-width="2.5"/>
    <path d="M18 24h28M26 38h12" stroke="rgba(126,232,255,.85)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
