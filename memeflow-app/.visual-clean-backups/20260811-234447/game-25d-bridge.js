import { createPepeRocket25D } from '/game-25d.js?v=25dfix3';

const root = document.getElementById('game');
const world = document.getElementById('world');
const mount = document.getElementById('threeStage');
const multiplierEl = document.getElementById('multiplierNumber');
const result = document.getElementById('result');

if (!root || !world || !mount) {
  console.error('[MF 2.5D] Required mount nodes are missing.');
} else {
  const visual = createPepeRocket25D({
    mount,
    sky: world,
    shell: root
  });

  let lastState = '';
  let lastMultiplier = NaN;

  const suppressLegacyCanvases = () => {
    world.querySelectorAll('canvas').forEach((canvas) => {
      if (!mount.contains(canvas)) {
        canvas.dataset.mfLegacyVisual = '1';
        canvas.style.setProperty(
          'display',
          'none',
          'important'
        );
      }
    });
  };

  const mapState = () => {
    if (result && !result.hidden) {
      return 'complete';
    }

    const state = [
      root.dataset.state,
      root.dataset.flight,
      root.dataset.launch,
      root.dataset.selector
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      /live|running|flight|climb|ascending/.test(state)
    ) {
      return 'live';
    }

    if (
      /search|scan|select|lock|launching|pending/.test(state)
    ) {
      return 'searching';
    }

    return 'idle';
  };

  visual.ready.then((ok) => {
    if (!ok) return;

    world.classList.add('mf-three-ready');
    suppressLegacyCanvases();

    console.info(
      '[MF 2.5D] Three.js renderer active.'
    );
  });

  const canvasObserver =
    new MutationObserver(suppressLegacyCanvases);

  canvasObserver.observe(
    world,
    {
      childList:true,
      subtree:true
    }
  );

  const tick = () => {
    const state = mapState();

    if (state !== lastState) {
      if (
        state === 'idle' &&
        lastState &&
        lastState !== 'idle'
      ) {
        visual.reset();
      }

      visual.setState(state);
      lastState = state;
    }

    const multiplier =
      Number.parseFloat(
        (multiplierEl?.textContent || '1')
          .replace(',', '.')
      );

    if (
      Number.isFinite(multiplier) &&
      multiplier !== lastMultiplier
    ) {
      visual.updateMultiplier(multiplier);
      lastMultiplier = multiplier;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  window.addEventListener(
    'beforeunload',
    () => {
      canvasObserver.disconnect();
      visual.destroy();
    },
    { once:true }
  );
}
