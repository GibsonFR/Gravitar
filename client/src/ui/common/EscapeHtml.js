export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

export function formatNumber(value = 0, decimals = 1) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

export function normalizeAmount(value = 0) {
  return Math.max(0, Math.floor(Number(value) || 0));
}
