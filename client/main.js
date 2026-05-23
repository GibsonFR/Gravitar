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

async function boot() {
  try {
    const appUrl = new URL('./src/App.js', import.meta.url);
    const check = await fetch(appUrl, { cache: 'no-store' });
    if (!check.ok) throw new Error(`Impossible de charger ${appUrl.pathname} — HTTP ${check.status}`);
    const mod = await import('./src/App.js');
    mod.startApp();
  } catch (error) {
    showBootError(error);
  }
}

boot();
