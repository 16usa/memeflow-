import {
  bootMemeflowTrue3D
} from './scene.js?v=data-tunnel-page-v1';

async function startDataTunnel() {
  const viewport =
    document.querySelector(
      '.viewport-wrap'
    );

  if (!viewport) {
    console.error(
      '[DATA-TUNNEL] viewport-wrap not found'
    );

    return;
  }

  let host =
    document.getElementById(
      'memeflowTrue3DHost'
    );

  if (!host) {
    host =
      document.createElement(
        'div'
      );

    host.id =
      'memeflowTrue3DHost';

    viewport.appendChild(
      host
    );
  }

  window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
    true;

  requestAnimationFrame(
    async () => {
      try {
        const previous =
          window.__memeflowTrue3D;

        if (
          previous
          && typeof previous.dispose === 'function'
        ) {
          previous.dispose();
        }

        window.__memeflowTrue3D =
          await bootMemeflowTrue3D(
            'memeflowTrue3DHost'
          );

        document
          .getElementById(
            'systemCanvas'
          )
          ?.setAttribute(
            'aria-hidden',
            'true'
          );

        console.log(
          '[DATA-TUNNEL] page V1 mounted'
        );
      }

      catch (error) {
        window.__MEMEFLOW_TRUE_3D_ACTIVE__ =
          false;

        console.error(
          '[DATA-TUNNEL] boot failed',
          error
        );
      }
    }
  );
}

if (
  document.readyState
  === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startDataTunnel,
    {
      once: true
    }
  );
}

else {
  startDataTunnel();
}
