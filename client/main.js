// build v193 progression-cost-audit
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

async function importApp() {
  try {
    return await import('./src/App.js?v=193');
  } catch (firstError) {
    console.warn('[Gravitar boot] App.js?v=193 failed, retrying without cache query', firstError);
    try {
      return await import('./src/App.js');
    } catch (secondError) {
      secondError.message = `${secondError.message || secondError}\n\nPremier essai App.js?v=193 : ${firstError?.message || firstError}`;
      throw secondError;
    }
  }
}

async function boot() {
  try {
    const mod = await importApp();
    mod.startApp();
  } catch (err) {
    showBootError(err, 'Erreur au chargement du jeu');
  }
}

window.addEventListener('error', (ev) => console.error('[Gravitar global error]', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => console.error('[Gravitar unhandled rejection]', ev.reason));

boot();
