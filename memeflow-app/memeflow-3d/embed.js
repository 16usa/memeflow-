import { bootMemeflowTrue3D } from './scene.js';

function startTrue3D() {
  const viewport = document.querySelector('.viewport-wrap');

  if (!viewport) {
    console.error('[TRUE-3D-EMBED] viewport-wrap not found');
    return;
  }

  let host = document.getElementById('memeflowTrue3DHost');

  if (!host) {
    host = document.createElement('div');
    host.id = 'memeflowTrue3DHost';
    viewport.appendChild(host);
  }

  window.__MEMEFLOW_TRUE_3D_ACTIVE__ = true;

  requestAnimationFrame(() => {
    try {
      bootMemeflowTrue3D('memeflowTrue3DHost');

      const oldCanvas = document.getElementById('systemCanvas');
      oldCanvas?.setAttribute('aria-hidden', 'true');

      console.log(
        '[TRUE-3D-EMBED] true 3D mounted in existing viewport'
      );
    } catch (error) {
      window.__MEMEFLOW_TRUE_3D_ACTIVE__ = false;
      console.error('[TRUE-3D-EMBED] boot failed', error);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startTrue3D,
    { once: true }
  );
} else {
  startTrue3D();
}
