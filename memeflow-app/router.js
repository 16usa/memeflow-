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

    /*
     * Mobile layout overrides
     *
     * NOTE: #positions and #wallet visibility is handled by the existing CSS:
     *   .context-position #positions { display:block !important; opacity:1 }
     * That rule (already in index.html line 110) activates when the inner
     * Position tab is clicked and body.context-position is set. We do NOT
     * override it globally here — that would permanently show #positions
     * even in Mission context and break the intended tab behaviour.
     *
     * Reduce mobile nav height and its reserved space so the bar
     * does not obscure the bottom of any section.
     * Buttons keep ≥ 40 px for touch targets; safe-area is preserved.
     */
    '@media (max-width: 820px) {',
    '  .mobile-nav {',
    '    height: auto    !important;',
    '    min-height: 0   !important;',
    '    padding: 3px 4px !important;',
    '  }',
    '  .mobile-nav button {',
    '    min-height: 40px !important;',
    '    padding: 5px 2px !important;',
    '  }',
    /* Main content bottom padding = actual nav height (≈ 48 px) +
       safe-area + breathing room so last content row is never hidden */
    '  .main {',
    '    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 24px) !important;',
    '  }',
    /* Sheets carry their own bottom clearance relative to the smaller nav */
    '  .mobile-sheet {',
    '    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 32px) !important;',
    '  }',
    '}',
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
  /*
   * getScroller() — find the element that owns the page's vertical scroll.
   *
   * On iOS Safari, window.scrollTo() and scrollIntoView() are silently
   * disabled when overflow-x:clip or overflow-x:hidden is set on <html>.
   * This page sets both of those (lines 920 and 927 of index.html).
   *
   * The reliable alternative is document.scrollingElement, which the spec
   * defines as the viewport's scroll container. On iOS Safari in standards
   * mode it returns document.documentElement. Setting its .scrollTop
   * directly always works — it bypasses the overflow-x restriction.
   */
  function getScroller() {
    if (document.scrollingElement) return document.scrollingElement;
    /* Probe: which element responds to scrollTop writes? */
    var html = document.documentElement;
    var body = document.body;
    var prev = html.scrollTop;
    html.scrollTop = prev + 1;
    if (html.scrollTop !== prev) { html.scrollTop = prev; return html; }
    return body;
  }

  /*
   * scrollToElement(el) — scroll the viewport to a visible element.
   *
   * Called ONLY for elements that are already display:block at the time
   * of the call. Do not call for elements that are still display:none.
   * Use the body-class + rAF approach (see positionsHandler below) when
   * visibility depends on a CSS body-class toggle.
   */
  function scrollToElement(el) {
    if (!el) return;
    /*
     * Two rAFs:
     *   rAF 1 — style mutations queued before this call are committed.
     *   rAF 2 — layout is recalculated; getBoundingClientRect() accurate.
     *
     * Do NOT use window.scrollTo() or element.scrollIntoView().
     * Both are silently disabled on iOS Safari when html/body carry
     * overflow-x:clip/hidden (this page sets that at lines 920 + 927).
     * document.scrollingElement.scrollTop works on all platforms.
     */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var scroller  = getScroller();
        var rect      = el.getBoundingClientRect();
        var absoluteY = scroller.scrollTop + rect.top;
        var targetY   = Math.max(0, absoluteY - 8); /* 8 px breathing room */
        scroller.scrollTop = targetY;
        try { scroller.scrollTo({ top: targetY, behavior: 'smooth' }); } catch (_) {}
      });
    });
  }

  function scrollTo(hash) {
    if (!hash || hash === '#') return;
    var id     = hash.replace(/^#/, '');
    var target = document.getElementById(id);
    scrollToElement(target);
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
        /* Navigate to the top section without opening any sheet */
        navigate('#mission', true);
        return;
      }
      if (sheet === 'positions') {
        /*
         * One-tap Positions navigation — exact sequence:
         *
         *  1. Find the inner "Position" tab (the Mission/Position/Incident
         *     strip visible on mobile at the top of the page).
         *  2. Click it — fires our context-tabs handler below, which:
         *       a. sets the tab active (removes Mission active)
         *       b. adds body.context-position
         *       c. CSS then shows #positions:
         *            .context-position #positions { display:block!important }
         *          and hides .mission-grid, #workspace.
         *  3. Wait TWO requestAnimationFrames so layout settles with
         *     #positions painted and having real height.
         *  4. Measure #positions and scroll document.scrollingElement.scrollTop
         *     (window.scrollTo is blocked on iOS Safari by overflow-x:clip).
         *  5. Update the URL hash via pushState (no native jump).
         *
         * We do NOT call navigate() here: navigate() calls scrollTo() which
         * would measure #positions while it is still display:none (Mission
         * context), getting rect.top === 0 and scrolling nowhere.
         */
        var innerPositionTab = document.querySelector(
          '.context-tabs button[data-context="position"]'
        );
        if (innerPositionTab) {
          innerPositionTab.click(); /* fires context-tabs handler → body.context-position */
        } else {
          /* Fallback: context tabs not in DOM — apply class manually */
          document.body.classList.remove(
            'context-mission', 'context-position', 'context-incident'
          );
          document.body.classList.add('context-position');
        }

        /* After the body class is set, CSS has made #positions display:block.
           Two rAFs ensure the browser has finished layout before we measure. */
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var target = document.getElementById('positions');
            scrollToElement(target); /* defined above — uses scrollingElement */
            try {
              window.history.pushState({ hash: '#positions' }, '', '#positions');
            } catch (_) {}
          });
        });
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
