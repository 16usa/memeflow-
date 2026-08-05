/* MEMEFLOW router.js
 * Clean scroll-based navigation controller.
 *
 * Rules:
 *  - NO display:none on sections, panels, or Settings modules.
 *  - NO main-element page attribute used for routing.
 *  - NO page-switching CSS on main children.
 *  - Clicking a nav item smoothly scrolls to the existing section.
 *  - Mobile sheets are fixed-position overlays; they are hidden by default
 *    (pointer-events:none + display:none) and shown when .open is added.
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1.  Minimal injected CSS
         Only covers: mobile-sheet visibility, nav active states,
         focus-view helper, pointer-events on closed overlays.
         Nothing here hides any section, panel, or Settings module.
  ───────────────────────────────────────────── */
  var style = document.createElement('style');
  style.id = 'mf-router-css';
  style.textContent = [
    /* Mobile sheets — fixed overlays, hidden until .open */
    '.mobile-sheet { display: none !important; pointer-events: none; }',
    '.mobile-sheet.open { display: block !important; pointer-events: auto; }',

    /* Desktop sidebar active link */
    '.nav a.active { color: #fff !important; background: rgba(84,221,255,.07) !important;',
    '  border-color: rgba(84,221,255,.22) !important; }',

    /* Mobile bottom-nav active button */
    '.mobile-nav button.active { color: #fff !important; background: #16202b !important; }',

    /* Focus-view mode (user-toggled, not navigation-related) */
    'body.focus-view .change-rail,',
    'body.focus-view .live-strip { display: none !important; }',
    '.focus-toggle.active { border-color: rgba(84,221,255,.52) !important;',
    '  color: var(--cyan) !important; background: rgba(84,221,255,.07) !important; }',
  ].join('\n');
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────
     2.  Mobile sheet helpers
  ───────────────────────────────────────────── */
  function closeMobileSheets() {
    document.querySelectorAll('.mobile-sheet.open').forEach(function (s) {
      s.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  function openMobileSheet(id) {
    closeMobileSheets();
    var sheet = document.getElementById('sheet-' + id);
    if (sheet) {
      sheet.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  /* ─────────────────────────────────────────────
     3.  Scroll to a section by hash
  ───────────────────────────────────────────── */
  function scrollTo(hash) {
    if (!hash || hash === '#') return;
    var id = hash.replace(/^#/, '');
    var target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ─────────────────────────────────────────────
     4.  Active nav state (desktop sidebar)
  ───────────────────────────────────────────── */
  function setNavActive(hash) {
    document.querySelectorAll('.nav a[href^="#"]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  }

  /* ─────────────────────────────────────────────
     5.  Primary navigate function
         Scrolls to section + sets nav active.
         Does NOT hide anything.
  ───────────────────────────────────────────── */
  function navigate(hash, pushState) {
    if (!hash || hash === '#') return;
    closeMobileSheets();
    setNavActive(hash);
    scrollTo(hash);
    if (pushState && window.history && window.history.pushState) {
      try {
        window.history.pushState({ hash: hash }, '', hash);
      } catch (_) { /* cross-origin or sandboxed — ignore */ }
    }
  }

  /* ─────────────────────────────────────────────
     6.  Desktop sidebar nav links
  ───────────────────────────────────────────── */
  document.querySelectorAll('.nav a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      window.location.hash = href;   // update URL hash
      navigate(href, true);
    });
  });

  /* ─────────────────────────────────────────────
     7.  Mobile bottom-nav buttons
  ───────────────────────────────────────────── */
  document.querySelectorAll('.mobile-nav button[data-sheet]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sheet = this.dataset.sheet;

      // Clear active, then set this one active
      document.querySelectorAll('.mobile-nav button').forEach(function (b) {
        b.classList.remove('active');
      });
      this.classList.add('active');

      if (sheet === 'home') {
        closeMobileSheets();
        window.location.hash = '#mission';
        navigate('#mission', true);
        return;
      }
      if (sheet === 'positions') {
        closeMobileSheets();
        window.location.hash = '#positions';
        navigate('#positions', true);
        return;
      }
      // candidates / wallet / more → open overlay sheet
      openMobileSheet(sheet);
    });
  });

  /* ─────────────────────────────────────────────
     8.  Close-sheet buttons (mobile sheets + wallet modal inner close)
         Wallet modal outer close is already wired by the wallet JS.
  ───────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.close-sheet');
    if (!btn) return;
    // Only close mobile sheets here; wallet modal is handled by wallet JS
    var inWalletModal = btn.closest('#walletModal');
    if (!inWalletModal) {
      closeMobileSheets();
    }
  });

  // Click outside sheet backdrop to close
  document.querySelectorAll('.mobile-sheet').forEach(function (sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target === this) closeMobileSheets();
    });
  });

  /* ─────────────────────────────────────────────
     9.  hashchange + popstate (browser back/forward)
  ───────────────────────────────────────────── */
  window.addEventListener('hashchange', function () {
    var h = window.location.hash;
    if (h) setNavActive(h);
  });

  window.addEventListener('popstate', function (e) {
    var h = (e.state && e.state.hash) ? e.state.hash : (window.location.hash || '#mission');
    navigate(h, false);
  });

  /* ─────────────────────────────────────────────
     10.  Wire buttons not already handled by inline JS
  ───────────────────────────────────────────── */
  function wireButtons() {

    /* ── Wallet execution settings → scroll to #settings ── */
    var walletExecSettings = document.getElementById('walletExecutionSettings');
    if (walletExecSettings) {
      walletExecSettings.addEventListener('click', function () {
        window.location.hash = '#settings';
        navigate('#settings', true);
      });
    }

    /* ── Mobile wallet "Execution settings" → close sheet + scroll to #settings ── */
    var mobileWalletExec = document.getElementById('mobileWalletExecution');
    if (mobileWalletExec) {
      mobileWalletExec.addEventListener('click', function () {
        closeMobileSheets();
        window.location.hash = '#settings';
        navigate('#settings', true);
      });
    }

    /* ── Mobile wallet action buttons — delegate to desktop counterparts ──
       The wallet JS wires walletConnectMain, walletVerify, walletCopy,
       walletDisconnect. Mobile buttons delegate to those elements so that
       the wallet state machine is invoked correctly. */
    var mobileWalletConnect = document.getElementById('mobileWalletConnect');
    if (mobileWalletConnect) {
      mobileWalletConnect.addEventListener('click', function () {
        closeMobileSheets();
        document.getElementById('walletConnectMain') &&
          document.getElementById('walletConnectMain').click();
      });
    }

    var mobileWalletVerify = document.getElementById('mobileWalletVerify');
    if (mobileWalletVerify) {
      mobileWalletVerify.addEventListener('click', function () {
        closeMobileSheets();
        document.getElementById('walletVerify') &&
          document.getElementById('walletVerify').click();
      });
    }

    var mobileWalletCopy = document.getElementById('mobileWalletCopy');
    if (mobileWalletCopy) {
      mobileWalletCopy.addEventListener('click', function () {
        document.getElementById('walletCopy') &&
          document.getElementById('walletCopy').click();
      });
    }

    var mobileWalletDisconnect = document.getElementById('mobileWalletDisconnect');
    if (mobileWalletDisconnect) {
      mobileWalletDisconnect.addEventListener('click', function () {
        closeMobileSheets();
        document.getElementById('walletDisconnect') &&
          document.getElementById('walletDisconnect').click();
      });
    }

    /* ── Inspector from More sheet ── */
    var openInspectorFromMore = document.getElementById('openInspectorFromMore');
    if (openInspectorFromMore) {
      openInspectorFromMore.addEventListener('click', function () {
        closeMobileSheets();
        window.location.hash = '#workspace';
        navigate('#workspace', true);
      });
    }

    /* ── Focus view toggle ── */
    var focusToggle = document.getElementById('focusToggle');
    if (focusToggle) {
      focusToggle.addEventListener('click', function () {
        var on = document.body.classList.toggle('focus-view');
        this.setAttribute('aria-pressed', String(on));
        this.classList.toggle('active', on);
        this.textContent = on ? 'Exit focus' : 'Focus view';
      });
    }

    /* ── Explain overlay close ── */
    var closeExplain = document.getElementById('closeExplain');
    if (closeExplain) {
      closeExplain.addEventListener('click', function () {
        var overlay = document.getElementById('explainOverlay');
        if (overlay) overlay.classList.remove('open');
      });
    }

    /* ── Explain overlay backdrop ── */
    var explainOverlay = document.getElementById('explainOverlay');
    if (explainOverlay) {
      explainOverlay.addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('open');
      });
    }

    /* ── Escape key: close sheets / explain overlay ──
       Wallet modal Escape is already handled by wallet JS. ── */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var overlay = document.getElementById('explainOverlay');
      if (overlay && overlay.classList.contains('open')) {
        overlay.classList.remove('open');
        return;
      }
      closeMobileSheets();
    });

    /* ── Mobile context tabs (Mission / Position / Incident) ──
       These toggle body classes that are used by the original
       @media(max-width:820px) CSS in index.html. ── */
    document.querySelectorAll('.context-tabs button[data-context]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctx = this.dataset.context;
        document.querySelectorAll('.context-tabs button').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
        document.body.classList.remove('context-mission', 'context-position', 'context-incident');
        document.body.classList.add('context-' + ctx);
      });
    });
  }

  /* ─────────────────────────────────────────────
     11.  Patch MEMEFLOW_CORE stubs
          MEMEFLOW_CORE is defined in inline JS (line 1214 of index.html)
          with openSheet:()=>{} and closeSheets:()=>{} as empty stubs.
  ───────────────────────────────────────────── */
  function patchCore() {
    if (window.MEMEFLOW_CORE) {
      window.MEMEFLOW_CORE.openSheet  = openMobileSheet;
      window.MEMEFLOW_CORE.closeSheets = closeMobileSheets;
      window.MEMEFLOW_CORE.navigate   = navigate;
    }
  }

  /* ─────────────────────────────────────────────
     12.  Initialise
  ───────────────────────────────────────────── */
  function init() {
    var hash = window.location.hash || '#mission';
    setNavActive(hash);
    wireButtons();
    patchCore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-patch after all inline scripts have run (MEMEFLOW_CORE is declared mid-document)
  window.addEventListener('load', patchCore);

})();
