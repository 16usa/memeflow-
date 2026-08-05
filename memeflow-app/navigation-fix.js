/* MEMEFLOW — navigation-fix.js
 * Hash-based client-side router, mobile sheet manager, and button wiring.
 * Loaded as <script src="/navigation-fix.js" defer> at the bottom of index.html.
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1.  Inject router CSS
         Uses data-page on .main to show/hide sections.
         All selectors use higher specificity + !important to beat
         the existing cascade rules that already use !important.
  ───────────────────────────────────────────── */
  var css = document.createElement('style');
  css.id = 'mf-router-css';
  css.textContent = [
    '/* === MEMEFLOW page router (navigation-fix.js) === */',

    /* ── Mission page: hide all non-mission sections ── */
    '.main[data-page="mission"] #positions,',
    '.main[data-page="mission"] #system,',
    '.main[data-page="mission"] #billing,',
    '.main[data-page="mission"] #settings { display: none !important; }',

    /* ── Positions / Wallet page ── */
    '.main[data-page="positions"] .context-banner,',
    '.main[data-page="positions"] .operator-timeline,',
    '.main[data-page="positions"] .context-tabs,',
    '.main[data-page="positions"] .connection-strip,',
    '.main[data-page="positions"] .quality-strip,',
    '.main[data-page="positions"] .loading-skeleton,',
    '.main[data-page="positions"] .mission-grid,',
    '.main[data-page="positions"] .live-strip,',
    '.main[data-page="positions"] #workspace,',
    '.main[data-page="positions"] .execution-preview,',
    '.main[data-page="positions"] .decision-intelligence,',
    '.main[data-page="positions"] .advanced-intelligence,',
    '.main[data-page="positions"] #system,',
    '.main[data-page="positions"] #billing,',
    '.main[data-page="positions"] #settings { display: none !important; }',
    '.main[data-page="positions"] #positions { display: grid !important; }',

    '.main[data-page="wallet"] .context-banner,',
    '.main[data-page="wallet"] .operator-timeline,',
    '.main[data-page="wallet"] .context-tabs,',
    '.main[data-page="wallet"] .connection-strip,',
    '.main[data-page="wallet"] .quality-strip,',
    '.main[data-page="wallet"] .loading-skeleton,',
    '.main[data-page="wallet"] .mission-grid,',
    '.main[data-page="wallet"] .live-strip,',
    '.main[data-page="wallet"] #workspace,',
    '.main[data-page="wallet"] .execution-preview,',
    '.main[data-page="wallet"] .decision-intelligence,',
    '.main[data-page="wallet"] .advanced-intelligence,',
    '.main[data-page="wallet"] #system,',
    '.main[data-page="wallet"] #billing,',
    '.main[data-page="wallet"] #settings { display: none !important; }',
    '.main[data-page="wallet"] #positions { display: grid !important; }',

    /* ── System page ── */
    '.main[data-page="system"] .context-banner,',
    '.main[data-page="system"] .operator-timeline,',
    '.main[data-page="system"] .context-tabs,',
    '.main[data-page="system"] .connection-strip,',
    '.main[data-page="system"] .quality-strip,',
    '.main[data-page="system"] .loading-skeleton,',
    '.main[data-page="system"] .mission-grid,',
    '.main[data-page="system"] .live-strip,',
    '.main[data-page="system"] #workspace,',
    '.main[data-page="system"] .execution-preview,',
    '.main[data-page="system"] .decision-intelligence,',
    '.main[data-page="system"] .advanced-intelligence,',
    '.main[data-page="system"] #positions,',
    '.main[data-page="system"] #billing,',
    '.main[data-page="system"] #settings { display: none !important; }',
    '.main[data-page="system"] #system { display: block !important; }',

    /* ── Billing page ── */
    '.main[data-page="billing"] .context-banner,',
    '.main[data-page="billing"] .operator-timeline,',
    '.main[data-page="billing"] .context-tabs,',
    '.main[data-page="billing"] .connection-strip,',
    '.main[data-page="billing"] .quality-strip,',
    '.main[data-page="billing"] .loading-skeleton,',
    '.main[data-page="billing"] .mission-grid,',
    '.main[data-page="billing"] .live-strip,',
    '.main[data-page="billing"] #workspace,',
    '.main[data-page="billing"] .execution-preview,',
    '.main[data-page="billing"] .decision-intelligence,',
    '.main[data-page="billing"] .advanced-intelligence,',
    '.main[data-page="billing"] #positions,',
    '.main[data-page="billing"] #system,',
    '.main[data-page="billing"] #settings { display: none !important; }',
    '.main[data-page="billing"] #billing { display: block !important; }',

    /* ── Settings page ── */
    /* NOTE: .decision-intelligence and .advanced-intelligence are siblings of
       #settings in the DOM (line 1128, after </section> for #settings).
       They were always visible when the user scrolled to the settings section
       pre-router, so they must NOT be hidden on this page. */
    '.main[data-page="settings"] .context-banner,',
    '.main[data-page="settings"] .operator-timeline,',
    '.main[data-page="settings"] .context-tabs,',
    '.main[data-page="settings"] .connection-strip,',
    '.main[data-page="settings"] .quality-strip,',
    '.main[data-page="settings"] .loading-skeleton,',
    '.main[data-page="settings"] .mission-grid,',
    '.main[data-page="settings"] .live-strip,',
    '.main[data-page="settings"] #workspace,',
    '.main[data-page="settings"] .execution-preview,',
    '.main[data-page="settings"] #positions,',
    '.main[data-page="settings"] #system,',
    '.main[data-page="settings"] #billing { display: none !important; }',
    '.main[data-page="settings"] #settings { display: block !important; }',
    /* ── Restore .decision-intelligence + .advanced-intelligence on settings page ──
       These are DOM-siblings of #settings (line 1128 of index.html, after </section>).
       They must be visible on ALL viewports including mobile.
       Hiding sources that are overridden here:
         index.html line 234: @media(max-width:820px){.advanced-intelligence{display:none!important}}  spec=(0,1,0)
         index.html line 250: @media(max-width:820px){.decision-intelligence{display:none!important}}  spec=(0,1,0)
       Our selectors are spec=(0,3,0)+!important — higher specificity wins per CSS cascade.
       The explicit @media block below reinforces the override for every mobile breakpoint. */
    '.main[data-page="settings"] .decision-intelligence,',
    '.main[data-page="settings"] .advanced-intelligence {',
    '  display: block !important;',
    '  visibility: visible !important;',
    '  opacity: 1 !important;',
    '  height: auto !important;',
    '  max-height: none !important;',
    '  overflow: visible !important;',
    '  transform: none !important;',
    '}',
    /* Same rules wrapped in the exact breakpoint the original uses.
       Covers 320px / 390px / 430px / 768px per spec requirement. */
    '@media (max-width: 820px) {',
    '  .main[data-page="settings"] .decision-intelligence,',
    '  .main[data-page="settings"] .advanced-intelligence {',
    '    display: block !important;',
    '    visibility: visible !important;',
    '    opacity: 1 !important;',
    '    height: auto !important;',
    '    max-height: none !important;',
    '    overflow: visible !important;',
    '    transform: none !important;',
    '  }',
    '}',
    /* Also ensure their interactive children are accessible */
    '.main[data-page="settings"] .decision-intelligence > summary,',
    '.main[data-page="settings"] .advanced-intelligence > summary {',
    '  display: flex !important;',
    '  visibility: visible !important;',
    '}',
    '.main[data-page="settings"] .decision-intelligence-intro,',
    '.main[data-page="settings"] .advanced-intelligence-intro,',
    '.main[data-page="settings"] .advanced-intelligence-content {',
    '  visibility: visible !important;',
    '  opacity: 1 !important;',
    '}',

    /* ── Focus view ── */
    'body.focus-view .change-rail,',
    'body.focus-view .live-strip { display: none !important; }',
    '.focus-toggle.active { border-color: rgba(84,221,255,.52); color: var(--cyan); background: rgba(84,221,255,.07); }',

    /* ── Mobile sheet open ── */
    '.mobile-sheet { display: none; }',
    '.mobile-sheet.open { display: block !important; }',

    /* ── Sidebar nav active enhancement ── */
    '.nav a.active { color: #fff; background: rgba(84,221,255,.07); border-color: rgba(84,221,255,.22); }',

    /* ── Mobile nav active ── */
    '.mobile-nav button.active { color: #fff !important; background: #16202b !important; }',
  ].join('\n');
  document.head.appendChild(css);

  /* ─────────────────────────────────────────────
     2.  Page + hash definitions
  ───────────────────────────────────────────── */
  var HASH_TO_PAGE = {
    '': 'mission',
    'mission': 'mission',
    'workspace': 'mission',
    'decision-studio': 'mission',
    'inspector': 'mission',
    'executionpreview': 'mission',
    'executionPreview': 'mission',
    'positions': 'positions',
    'wallet': 'wallet',
    'system': 'system',
    'billing': 'billing',
    'settings': 'settings',
  };

  function hashToPage(hash) {
    var h = (hash || '').replace('#', '');
    return HASH_TO_PAGE[h] || HASH_TO_PAGE[h.toLowerCase()] || 'mission';
  }

  /* ─────────────────────────────────────────────
     3.  Nav active state
  ───────────────────────────────────────────── */
  function setNavActive(hash) {
    var h = hash || '#mission';
    var page = hashToPage(h);

    // Sidebar / desktop nav
    document.querySelectorAll('.nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var active =
        href === h ||
        (href === '#mission' && page === 'mission') ||
        (href === '#workspace' && page === 'mission' && h === '#workspace') ||
        (href === '#inspector' && page === 'mission' && h === '#inspector');
      a.classList.toggle('active', active);
    });

    // Mobile bottom nav
    document.querySelectorAll('.mobile-nav button[data-sheet]').forEach(function (btn) {
      var sheet = btn.dataset.sheet;
      var active =
        (sheet === 'home' && page === 'mission') ||
        (sheet === 'positions' && (page === 'positions' || page === 'wallet'));
      btn.classList.toggle('active', active);
    });
  }

  /* ─────────────────────────────────────────────
     4.  Mobile sheets (overlay panels)
  ───────────────────────────────────────────── */
  function closeMobileSheets() {
    document.querySelectorAll('.mobile-sheet.open').forEach(function (s) {
      s.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  function openSheet(id) {
    closeMobileSheets();
    var sheet = document.getElementById('sheet-' + id);
    if (sheet) {
      sheet.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  /* ─────────────────────────────────────────────
     5.  Core navigate function
  ───────────────────────────────────────────── */
  var MAIN = document.querySelector('.main');

  function navigate(hash, pushState) {
    var page = hashToPage(hash);
    if (MAIN) MAIN.dataset.page = page;

    setNavActive(hash);
    closeMobileSheets();

    // Scroll behavior
    if (page !== 'mission') {
      window.scrollTo(0, 0);
    } else if (hash && hash !== '#mission' && hash !== '#workspace') {
      // Smooth-scroll within mission page
      var target = document.querySelector(hash);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }

    // Push history entry so back/forward works
    if (pushState && window.history && window.history.pushState) {
      try {
        window.history.pushState({ page: page, hash: hash }, '', hash || '#mission');
      } catch (_) { /* cross-origin or blocked — silently ignore */ }
    }
  }

  /* ─────────────────────────────────────────────
     6.  Event listeners — hashchange + popstate
  ───────────────────────────────────────────── */
  window.addEventListener('hashchange', function () {
    navigate(window.location.hash, false);
  });

  window.addEventListener('popstate', function (e) {
    var h = (e.state && e.state.hash) ? e.state.hash : (window.location.hash || '#mission');
    navigate(h, false);
  });

  /* Intercept sidebar/nav anchor clicks to push a history entry */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href === '#') return;
    // Let the browser update location.hash, then sync router state with history
    setTimeout(function () { navigate(href, true); }, 0);
  }, true);

  /* ─────────────────────────────────────────────
     7.  Wire up buttons (runs after DOM is ready)
  ───────────────────────────────────────────── */
  function wireButtons() {
    /* ── Mobile bottom nav ── */
    document.querySelectorAll('.mobile-nav button[data-sheet]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sheet = this.dataset.sheet;
        if (sheet === 'home') {
          window.location.hash = '#mission';
          return;
        }
        if (sheet === 'positions') {
          window.location.hash = '#positions';
          return;
        }
        // candidates / wallet / more → open as overlays
        openSheet(sheet === 'wallet' ? 'wallet' : sheet === 'candidates' ? 'candidates' : 'more');
        // Mark the tapped button active
        document.querySelectorAll('.mobile-nav button').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
      });
    });

    /* ── Close-sheet buttons ── */
    document.querySelectorAll('.close-sheet').forEach(function (btn) {
      btn.addEventListener('click', closeMobileSheets);
    });

    /* ── Click outside sheet to close ── */
    document.querySelectorAll('.mobile-sheet').forEach(function (sheet) {
      sheet.addEventListener('click', function (e) {
        if (e.target === this) closeMobileSheets();
      });
    });

    /* ── Inspector from More sheet ── */
    var openInspector = document.getElementById('openInspectorFromMore');
    if (openInspector) {
      openInspector.addEventListener('click', function () {
        closeMobileSheets();
        window.location.hash = '#workspace';
      });
    }

    /* ── Wallet execution settings button ── */
    var walletExecSettings = document.getElementById('walletExecutionSettings');
    if (walletExecSettings) {
      walletExecSettings.addEventListener('click', function () {
        window.location.hash = '#settings';
      });
    }
    var mobileWalletExec = document.getElementById('mobileWalletExecution');
    if (mobileWalletExec) {
      mobileWalletExec.addEventListener('click', function () {
        closeMobileSheets();
        window.location.hash = '#settings';
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

    /* ── Wallet modal: close on Escape ── */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // Close explain overlay if open
        var overlay = document.getElementById('explainOverlay');
        if (overlay && overlay.classList.contains('open')) {
          overlay.classList.remove('open');
          return;
        }
        // Close wallet modal if open
        var walletModal = document.getElementById('walletModal');
        if (walletModal && walletModal.classList.contains('open')) {
          walletModal.classList.remove('open');
          document.body.style.overflow = '';
          return;
        }
        // Close any open mobile sheet
        closeMobileSheets();
      }
    });

    /* ── Explain overlay close ── */
    var closeExplain = document.getElementById('closeExplain');
    if (closeExplain) {
      closeExplain.addEventListener('click', function () {
        var overlay = document.getElementById('explainOverlay');
        if (overlay) overlay.classList.remove('open');
      });
    }

    /* ── Refresh billing button (if not already wired) ── */
    var refreshBilling = document.getElementById('refreshBilling');
    if (refreshBilling && !refreshBilling._mfWired) {
      refreshBilling._mfWired = true;
      refreshBilling.addEventListener('click', function () {
        // The billing script handles this via its own status() call
        // Trigger it via a custom event as a fallback
        window.dispatchEvent(new CustomEvent('mf:billing-refresh'));
      });
    }
  }

  /* ─────────────────────────────────────────────
     8.  Expose sheet API on MEMEFLOW_CORE
  ───────────────────────────────────────────── */
  function patchCore() {
    if (window.MEMEFLOW_CORE) {
      window.MEMEFLOW_CORE.openSheet = openSheet;
      window.MEMEFLOW_CORE.closeSheets = closeMobileSheets;
    }
  }

  /* ─────────────────────────────────────────────
     9.  Initialise
  ───────────────────────────────────────────── */
  function init() {
    navigate(window.location.hash || '#mission', false);
    wireButtons();
    patchCore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-patch MEMEFLOW_CORE once it's available (it's declared after this script in the HTML)
  window.addEventListener('load', patchCore);

})();
