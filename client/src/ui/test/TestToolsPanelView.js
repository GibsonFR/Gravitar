export class TestToolsPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'test-tools-panel';
    this.el.innerHTML = `
      <div class="test-tools-panel__banner">TEST — non persistant</div>
      <h2>Outils de zone</h2>
      <div class="test-tools-panel__grid">
        <button class="ui-btn" type="button" data-test-cmd="test_give">Ressources + munitions</button>
        <button class="ui-btn" type="button" data-test-cmd="test_spawn_dummy">Cible blindée</button>
        <button class="ui-btn" type="button" data-test-cmd="test_spawn_mob">Créer un mob</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-test-cmd="test_clear">Nettoyer mes structures</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-test-cmd="test_reset">Réinitialiser la zone</button>
      </div>
    `;
    this.el.addEventListener('pointerdown', (ev) => {
      const button = ev.target instanceof Element ? ev.target.closest('[data-test-cmd]') : null;
      if (!button) {
        ev.stopPropagation();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      this.sendCmd?.(button.dataset.testCmd, {});
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
  }
}
