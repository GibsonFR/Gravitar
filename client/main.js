function showBootError(error) {
  const message = error?.stack || error?.message || String(error || 'Erreur inconnue');
  console.error('[Gravitar boot]', error);
  const root = document.getElementById('ui-root') || document.body;
  const box = document.createElement('div');
  box.className = 'boot-error';
  box.innerHTML = `
    <div class="boot-error__panel">
      <div class="boot-error__title">Erreur au chargement du jeu</div>
      <div class="boot-error__hint">Recharge avec Ctrl+F5. Si ça reste bloqué, copie cette erreur.</div>
      <pre></pre>
    </div>
  `;
  box.querySelector('pre').textContent = message;
  root.appendChild(box);
}

import('./src/App.js?v=101')
  .then((mod) => mod.startApp())
  .catch(showBootError);
