import { escapeHtml, normalizeAmount } from './EscapeHtml.js';

export function renderResourceTransferRows(entries = [], options = {}) {
  const {
    classPrefix = 'ui-resource-list',
    actionLabel = 'Transférer',
    action = 'transfer',
    structureId = 0,
    resourceDataset = 'data-resource',
    actionDataset = 'data-resource-action',
    amountDataset = 'data-amount',
    emptyLabel = 'Vide.',
    includeFive = false,
    disabled = false
  } = options;

  if (!entries.length) return `<div class="${classPrefix}__empty">${escapeHtml(emptyLabel)}</div>`;

  return entries.map((entry) => {
    const amount = normalizeAmount(entry.amount);
    const key = escapeHtml(entry.key || '');
    const name = escapeHtml(entry.name || entry.key || 'Ressource');
    const color = escapeHtml(entry.colorHex || '#d0d7e4');
    const disabledAttr = disabled || amount <= 0 ? 'disabled' : '';
    const baseAttrs = `${actionDataset}="${escapeHtml(action)}" data-resource-key="${key}" ${amountDataset}="${amount}" data-structure="${structureId | 0}"`;
    return `
      <div class="${classPrefix}__row" ${resourceDataset}="${key}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="${classPrefix}__dot" style="background:${color}"></span>
        <span class="${classPrefix}__name" title="${name}">${name}</span>
        <span class="${classPrefix}__qty">${amount}</span>
        <span class="${classPrefix}__actions">
          <button type="button" class="${classPrefix}__mini" ${baseAttrs} data-transfer-amount="1" ${disabledAttr}>1</button>
          ${includeFive ? `<button type="button" class="${classPrefix}__mini" ${baseAttrs} data-transfer-amount="5" ${disabledAttr}>5</button>` : ''}
          <button type="button" class="${classPrefix}__main" ${baseAttrs} data-transfer-amount="all" ${disabledAttr}>${escapeHtml(actionLabel)}</button>
        </span>
      </div>`;
  }).join('');
}
