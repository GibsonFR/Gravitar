// build v217 remove drone map overlay
function showBootError(error, title = 'Erreur au chargement du jeu') {
  const message = error?.stack || error?.message || String(error || 'Erreur inconnue');
  console.error('[Gravitar boot]', error);
  const root = document.getElementById('ui-root') || document.body;
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'boot-error';
  box.innerHTML = `
    <div class="boot-error__panel">
      <div class="boot-error__title"></div>
      <div class="boot-error__hint">Recharge avec Ctrl+F5. Si ça reste bloqué, copie cette erreur.</div>
      <pre></pre>
    </div>
  `;
  box.querySelector('.boot-error__title').textContent = title;
  box.querySelector('pre').textContent = message;
  root.appendChild(box);
}

async function boot() {
  try {
    const mod = await import('./src/App.js?v=moblootprojectilefix1');
    mod.startApp();
  } catch (err) {
    showBootError(err, 'Erreur au chargement du jeu');
  }
}

window.addEventListener('error', (ev) => console.error('[Gravitar global error]', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => console.error('[Gravitar unhandled rejection]', ev.reason));

boot();
