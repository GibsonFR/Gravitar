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

async function bootFromSource() {
  const mod = await import('./src/App.js');
  mod.startApp();
}

async function bootFromBundle(sourceError) {
  console.warn('[Gravitar boot] Source modules failed, loading fallback bundle.', sourceError);
  await import('./app.bundle.js?v=103');
}

async function boot() {
  try {
    await bootFromSource();
  } catch (sourceError) {
    try {
      await bootFromBundle(sourceError);
    } catch (bundleError) {
      const combined = `${bundleError?.stack || bundleError?.message || bundleError}\n\nSource module error:\n${sourceError?.stack || sourceError?.message || sourceError}`;
      showBootError(new Error(combined), 'Erreur au chargement du jeu');
    }
  }
}

window.addEventListener('error', (ev) => console.error('[Gravitar global error]', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => console.error('[Gravitar unhandled rejection]', ev.reason));

boot();
