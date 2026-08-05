#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
APP="$ROOT/memeflow-app"

if [ ! -d "$APP" ]; then
  echo "ERROR: memeflow-app directory not found. Run this script from repository root."
  exit 1
fi

cat > "$APP/navigation-fix.js" <<'EOF'
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function resolveTarget(value) {
    if (!value || value === '#') return null;
    try {
      const id = decodeURIComponent(value.replace(/^#/, ''));
      return id ? document.getElementById(id) : null;
    } catch {
      return null;
    }
  }

  function closeMobileSheets() {
    $$('.mobile-sheet.open, .mobile-sheet[aria-hidden="false"]').forEach((sheet) => {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('menu-open', 'sheet-open');
    document.body.style.removeProperty('overflow');
  }

  function setActive(hash) {
    const normalized = hash && hash !== '#' ? hash : '#mission';
    $$('.nav a[href^="#"], .mobile-nav a[href^="#"], .mobile-nav button').forEach((item) => {
      const raw = item.getAttribute('href') || item.dataset.target || item.dataset.section || item.dataset.sheet || item.getAttribute('aria-controls');
      const target = raw && raw.startsWith('#') ? raw : raw ? `#${raw}` : '';
      const active = target === normalized;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function navigate(hash, options = {}) {
    const target = resolveTarget(hash);
    if (!target) return false;

    closeMobileSheets();
    const normalized = `#${target.id}`;

    if (window.location.hash !== normalized) {
      history[options.replace ? 'replaceState' : 'pushState'](null, '', normalized);
    }

    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
    setActive(normalized);

    if (options.focus) {
      const hadTabIndex = target.hasAttribute('tabindex');
      if (!hadTabIndex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (!hadTabIndex) {
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    }
    return true;
  }

  function bindAnchors() {
    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor) return;
      const hash = anchor.getAttribute('href');
      if (!resolveTarget(hash)) return;
      event.preventDefault();
      navigate(hash, { focus: true });
    });
  }

  function bindMobileButtons() {
    $$('.mobile-nav button').forEach((button) => {
      if (button.dataset.navigationBound === 'true') return;
      button.dataset.navigationBound = 'true';

      button.addEventListener('click', () => {
        const raw = button.dataset.target || button.dataset.section || button.dataset.sheet || button.getAttribute('aria-controls');
        if (!raw) return;

        const hash = raw.startsWith('#') ? raw : `#${raw}`;
        const target = resolveTarget(hash);
        if (!target) return;

        if (target.classList.contains('mobile-sheet')) {
          const shouldOpen = !target.classList.contains('open');
          closeMobileSheets();
          if (shouldOpen) {
            target.classList.add('open');
            target.setAttribute('aria-hidden', 'false');
            document.body.classList.add('sheet-open');
            document.body.style.overflow = 'hidden';
          }
          return;
        }

        navigate(hash, { focus: true });
      });
    });

    $$('[data-close-sheet], .mobile-sheet-close, .sheet-close').forEach((button) => {
      button.addEventListener('click', closeMobileSheets);
    });
  }

  function bindHashChanges() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash || '#mission';
      setActive(hash);
      resolveTarget(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }

  function repairLinks() {
    $$('.nav a[href^="#"]').forEach((anchor) => {
      const target = resolveTarget(anchor.getAttribute('href'));
      if (!target) {
        anchor.setAttribute('aria-disabled', 'true');
        anchor.title = 'Section is not available';
      } else {
        anchor.removeAttribute('aria-disabled');
      }
    });
  }

  function observeSections() {
    if (!('IntersectionObserver' in window)) return;

    const sections = $$('.main [id], main [id]').filter((node) =>
      document.querySelector(`.nav a[href="#${CSS.escape(node.id)}"], .mobile-nav a[href="#${CSS.escape(node.id)}"]`)
    );

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) setActive(`#${visible.target.id}`);
    }, {
      rootMargin: '-18% 0px -65% 0px',
      threshold: [0.05, 0.2, 0.5]
    });

    sections.forEach((section) => observer.observe(section));
  }

  function init() {
    bindAnchors();
    bindMobileButtons();
    bindHashChanges();
    repairLinks();
    observeSections();

    const initialHash = resolveTarget(window.location.hash) ? window.location.hash : '#mission';
    setActive(initialHash);

    if (window.location.hash && resolveTarget(window.location.hash)) {
      requestAnimationFrame(() => {
        resolveTarget(window.location.hash)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }

    window.MEMEFLOW_NAVIGATION = {
      navigate,
      closeMobileSheets,
      refresh: init
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
EOF

cat > "$APP/start.mjs" <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(root, 'index.html');
const scriptTag = '<script src="/navigation-fix.js" defer></script>';

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('/navigation-fix.js')) {
  if (!html.includes('</body>')) {
    throw new Error('index.html does not contain </body>');
  }

  html = html.replace('</body>', `${scriptTag}\n</body>`);
  fs.writeFileSync(indexPath, html);
  console.log('Navigation fix injected into index.html');
}

await import('./app-server.mjs');
EOF

node <<'EOF'
const fs = require('fs');
const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.scripts ||= {};
pkg.scripts.start = 'cd memeflow-app && node start.mjs';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
EOF

node --check "$APP/navigation-fix.js"
node --check "$APP/start.mjs"
node --check "$APP/app-server.mjs"

if grep -q '^memeflow-app/data/state.json$' .gitignore 2>/dev/null; then
  :
else
  printf '\n# Runtime state generated by MEMEFLOW\nmemeflow-app/data/state.json\n' >> .gitignore
fi

echo
echo "Fix installed successfully."
echo "Changed files:"
git status --short
echo
echo "Next commands:"
echo "  pnpm start"
echo "  git add .gitignore package.json memeflow-app/start.mjs memeflow-app/navigation-fix.js"
echo "  git commit -m \"Fix navigation and runtime startup\""
echo "  git push"
