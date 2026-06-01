import { escapeHtml, formatNumber } from './EscapeHtml.js';

export function machineStateClass({ powered = false, enabled = true, busy = false, danger = false } = {}) {
  if (danger) return 'is-danger';
  if (!enabled) return 'is-idle';
  if (!powered) return 'is-warning';
  if (busy) return 'is-busy';
  return 'is-ok';
}

export function renderMachineHeader({
  eyebrow = 'Machine',
  title = 'Machine',
  meta = '',
  state = 'is-ok',
  closeAttr = '',
  closeLabel = '×',
  badges = []
} = {}) {
  const badgeHtml = (badges || []).filter(Boolean).map((badge) => {
    const label = typeof badge === 'string' ? badge : badge.label;
    const cls = typeof badge === 'string' ? '' : (badge.className || '');
    return `<span class="machine-ui__badge ${escapeHtml(cls)}">${escapeHtml(label || '')}</span>`;
  }).join('');
  return `
    <div class="machine-ui__head ${escapeHtml(state)}">
      <div class="machine-ui__head-main">
        <div class="machine-ui__eyebrow">${escapeHtml(eyebrow)}</div>
        <div class="machine-ui__title-row">
          <div class="machine-ui__title">${escapeHtml(title)}</div>
          ${badgeHtml ? `<div class="machine-ui__badges">${badgeHtml}</div>` : ''}
        </div>
        ${meta ? `<div class="machine-ui__meta">${escapeHtml(meta)}</div>` : ''}
      </div>
      ${closeAttr ? `<button type="button" class="machine-ui__close" ${closeAttr}>${escapeHtml(closeLabel)}</button>` : ''}
    </div>`;
}

export function renderMachineStatusCard({
  label = 'État',
  value = 'Prêt',
  hint = '',
  state = 'is-ok',
  actionHtml = ''
} = {}) {
  return `
    <div class="machine-ui__status-card ${escapeHtml(state)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${hint ? `<em>${escapeHtml(hint)}</em>` : ''}
      ${actionHtml || ''}
    </div>`;
}

export function renderMachineProgress({
  label = 'Progression',
  value = 0,
  right = '',
  state = 'is-ok',
  compact = false
} = {}) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return `
    <div class="machine-ui__progress ${escapeHtml(state)} ${compact ? 'is-compact' : ''}">
      <div class="machine-ui__progress-head">
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(right || `${pct}%`)}</b>
      </div>
      <div class="machine-ui__bar"><span style="width:${pct}%"></span></div>
    </div>`;
}

export function renderMachineMetricStrip(metrics = []) {
  const safe = (metrics || []).filter((m) => m && m.label != null);
  if (!safe.length) return '';
  return `<div class="machine-ui__metrics">${safe.map((m) => `
    <div class="machine-ui__metric ${escapeHtml(m.className || '')}">
      <span>${escapeHtml(m.label)}</span>
      <strong>${escapeHtml(m.value ?? '')}</strong>
    </div>`).join('')}</div>`;
}

export function renderMachineSection({ title = '', subtitle = '', pill = '', scrollKey = '', className = '', body = '' } = {}) {
  return `
    <section class="machine-ui__section ${escapeHtml(className)}">
      ${(title || subtitle || pill) ? `<div class="machine-ui__section-head">
        <div>
          ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${pill ? `<span>${escapeHtml(pill)}</span>` : ''}
      </div>` : ''}
      <div class="machine-ui__section-body" ${scrollKey ? `data-scroll-key="${escapeHtml(scrollKey)}"` : ''}>${body || ''}</div>
    </section>`;
}

export function formatMachineAmount(value, digits = 0) {
  return formatNumber(Number(value) || 0, digits);
}
