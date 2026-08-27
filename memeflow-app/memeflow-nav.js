/* ===== MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */
(() => {
  'use strict';

  if (window.__mfGlobalRightDrawerNavV1) return;
  window.__mfGlobalRightDrawerNavV1 = true;

  const PATCH_ID = 'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1';
  const url = new URL(window.location.href);

  if (url.searchParams.get('mfGalleryLive') === '1') {
    document.documentElement.dataset.mfGalleryLivePreview = '1';
    return;
  }

  const NAV_ITEMS = [
    {
      href: '/system.html',
      title: 'System Overview',
      sub: 'Live architecture and system state'
    },
    {
      href: '/trading.html?v=recent-trades-clean-bottom-v1-20260826',
      title: 'Trading Terminal',
      sub: 'Charts, candidates, positions and execution'
    },
    {
      href: '/settings.html?v=cachefix-c6663c7-20260826-v1',
      title: 'System Settings',
      sub: 'Trading mode, filters, risk and exits'
    },
    {
      href: '/system-tokens.html',
      title: 'Real-Time Pipeline',
      sub: 'Live token states and decision flow'
    }
  ];

  function normalizedPath(pathname = window.location.pathname) {
    return String(pathname || '/').replace(/\/+$/, '') || '/';
  }

  function resolveHeaderHost() {
    const path = normalizedPath();

    if (path.endsWith('/trading.html')) {
      return document.querySelector('.topbar .top-actions');
    }

    if (path.endsWith('/settings.html')) {
      return document.querySelector('.mf-settings-page-header');
    }

    if (path.endsWith('/system-tokens.html')) {
      return document.querySelector('.flow-header');
    }

    if (path.endsWith('/system.html')) {
      return document.querySelector('.topbar .top-actions');
    }

    return (
      document.querySelector('.topbar .top-actions') ||
      document.querySelector('.mf-settings-page-header') ||
      document.querySelector('.flow-header')
    );
  }

  function makeToggle() {
    const host = document.createElement('div');
    host.className = 'mf-nav-host';
    host.dataset.mfNavHost = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mf-nav-toggle';
    button.setAttribute('aria-label', 'Open navigation');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'mfGlobalNavDrawer');

    button.innerHTML = `
      <span class="mf-nav-toggle-lines" aria-hidden="true">
        <span class="mf-nav-toggle-line"></span>
        <span class="mf-nav-toggle-line"></span>
      </span>
    `;

    host.appendChild(button);
    return { host, button };
  }

  function makeBackdrop() {
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mf-nav-backdrop';
    backdrop.setAttribute('aria-label', 'Close navigation');
    backdrop.tabIndex = -1;
    return backdrop;
  }

  function makeDrawer() {
    const drawer = document.createElement('aside');
    drawer.id = 'mfGlobalNavDrawer';
    drawer.className = 'mf-nav-drawer';
    drawer.setAttribute('aria-label', 'MEMEFLOW navigation');
    drawer.setAttribute('aria-hidden', 'true');

    const current = normalizedPath();

    const items = NAV_ITEMS.map(item => {
      const itemPath = normalizedPath(item.href);
      const active = current === itemPath;

      return `
        <li>
          <a
            class="mf-nav-link"
            href="${item.href}"
            ${active ? 'aria-current="page"' : ''}
          >
            <span class="mf-nav-link-copy">
              <span class="mf-nav-link-title">${item.title}</span>
              <span class="mf-nav-link-sub">${item.sub}</span>
            </span>
            <span class="mf-nav-link-arrow" aria-hidden="true">→</span>
          </a>
        </li>
      `;
    }).join('');

    drawer.innerHTML = `
      <div class="mf-nav-drawer-head">
        <div>
          <span class="mf-nav-kicker">MEMEFLOW</span>
          <strong class="mf-nav-drawer-title">Navigation</strong>
        </div>
      </div>

      <nav aria-label="Primary">
        <ul class="mf-nav-list">
          ${items}
        </ul>
      </nav>

      <div class="mf-nav-foot">
        <strong>LIVE SYSTEM</strong>
        <span>Non-custodial automated trading platform</span>
      </div>
    `;

    return drawer;
  }

  function install() {
    if (document.querySelector('[data-mf-nav-host="1"]')) {
      return true;
    }

    const headerHost = resolveHeaderHost();
    if (!headerHost) return false;

    const { host, button } = makeToggle();
    const backdrop = makeBackdrop();
    const drawer = makeDrawer();

    headerHost.appendChild(host);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    let open = false;
    let lastFocused = null;

    const setOpen = (next, { restoreFocus = true } = {}) => {
      const desired = Boolean(next);

      if (desired === open) return;
      open = desired;

      if (open) {
        lastFocused =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : button;

        document.documentElement.dataset.mfNavOpen = '1';
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Close navigation');
        drawer.setAttribute('aria-hidden', 'false');

        const activeLink =
          drawer.querySelector('[aria-current="page"]') ||
          drawer.querySelector('.mf-nav-link');

        window.setTimeout(() => {
          activeLink?.focus?.({ preventScroll: true });
        }, 280);
      } else {
        delete document.documentElement.dataset.mfNavOpen;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Open navigation');
        drawer.setAttribute('aria-hidden', 'true');

        if (restoreFocus) {
          window.setTimeout(() => {
            if (lastFocused?.isConnected) {
              lastFocused.focus?.({ preventScroll: true });
            } else {
              button.focus?.({ preventScroll: true });
            }
          }, 20);
        }
      }
    };

    button.addEventListener('click', () => {
      setOpen(!open);
    });

    backdrop.addEventListener('click', () => {
      setOpen(false);
    });

    drawer.addEventListener('click', event => {
      const link = event.target.closest('.mf-nav-link');
      if (!link) return;
      setOpen(false, { restoreFocus: false });
    });

    document.addEventListener('keydown', event => {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusables = [
          button,
          ...drawer.querySelectorAll('a[href], button:not([disabled])')
        ].filter(node => (
          node instanceof HTMLElement &&
          node.offsetParent !== null
        ));

        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener('pagehide', () => {
      delete document.documentElement.dataset.mfNavOpen;
    }, { once: true });

    console.log(`[NAV] ${PATCH_ID} mounted`);
    return true;
  }

  function boot() {
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (install() || attempts >= 80) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {
      once: true
    });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1 ===== */


/* MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1 */
(() => {
  if (window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1__) return;
  window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1__ = true;
  const script = document.createElement('script');
  script.src = '/account-wallet-settings.js?v=account-wallet-settings-c6663c7-cachefix-c6663c7-20260826-v1';
  script.defer = true;
  document.head.appendChild(script);
})();
/* /MEMEFLOW_ACCOUNT_WALLET_SETTINGS_LOADER_V1 */
