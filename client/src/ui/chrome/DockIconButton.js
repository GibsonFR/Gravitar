export function createDockIconButton({ id, title, iconMarkup }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ui-dock-icon';
  button.dataset.iconId = id;
  button.setAttribute('aria-label', title);
  button.title = title;

  const glow = document.createElement('span');
  glow.className = 'ui-dock-icon__glow';

  const icon = document.createElement('span');
  icon.className = 'ui-dock-icon__art';
  icon.innerHTML = iconMarkup;

  const label = document.createElement('span');
  label.className = 'ui-dock-icon__label';
  label.textContent = title;

  const badge = document.createElement('span');
  badge.className = 'ui-dock-icon__badge';
  badge.hidden = true;

  button.append(glow, icon, label, badge);
  return { button, badge };
}
