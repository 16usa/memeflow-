(() => {
  'use strict';

  const KEY = 'memeflow.theme.v1';
  const ROOT = document.documentElement;
  const VALID = new Set(['dark', 'light']);

  function normalize(value) {
    return VALID.has(String(value || '').toLowerCase())
      ? String(value).toLowerCase()
      : 'dark';
  }

  function readTheme() {
    try {
      return normalize(localStorage.getItem(KEY));
    } catch {
      return 'dark';
    }
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }

  function updateMeta(theme) {
    let colorScheme = document.querySelector('meta[name="color-scheme"]');
    if (!colorScheme) {
      colorScheme = document.createElement('meta');
      colorScheme.name = 'color-scheme';
      document.head?.appendChild(colorScheme);
    }
    colorScheme.content = theme;

    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head?.appendChild(themeColor);
    }
    themeColor.content = theme === 'light' ? '#f4f6f8' : '#0f141a';
  }

  function syncLogos(theme) {
    const file = theme === 'light'
      ? '/brand/memeflow-dragonfly-light.png?v=final-v5'
      : '/brand/memeflow-dragonfly-dark.png?v=final-v5';

    document.querySelectorAll('img').forEach((img) => {
      const src = String(img.getAttribute('src') || '');
      if (
        src.includes('memeflow-dragonfly-dark.png') ||
        src.includes('memeflow-dragonfly-light.png')
      ) {
        if (img.getAttribute('src') !== file) img.setAttribute('src', file);
      }
    });
  }

  function syncControls(theme) {
    document.querySelectorAll('[data-mf-theme-choice]').forEach((button) => {
      const active = button.dataset.mfThemeChoice === theme;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const value = document.getElementById('mfThemeCurrentValue');
    if (value) value.textContent = theme === 'light' ? 'Light' : 'Dark';
  }

  function applyTheme(next, options = {}) {
    const theme = normalize(next);
    ROOT.dataset.theme = theme;
    ROOT.style.colorScheme = theme;

    if (options.persist !== false) writeTheme(theme);

    updateMeta(theme);
    syncLogos(theme);
    syncControls(theme);

    window.dispatchEvent(new CustomEvent('memeflow:themechange', {
      detail: { theme }
    }));

    return theme;
  }

  function mountAppearance() {
    if (!/\/settings\.html$/i.test(location.pathname)) return true;
    if (document.getElementById('mfThemeAppearance')) return true;

    const body = document.getElementById('mf293SettingsBody');
    if (!body) return false;

    const section = document.createElement('section');
    section.id = 'mfThemeAppearance';
    section.className = 'mf-theme-appearance';
    section.setAttribute('aria-labelledby', 'mfThemeAppearanceTitle');

    section.innerHTML = `
      <div class="mf-theme-appearance-copy">
        <strong id="mfThemeAppearanceTitle">Appearance</strong>
        <small>Interface only · trading logic is unchanged</small>
      </div>
      <div class="mf-theme-appearance-control">
        <span class="mf-theme-appearance-label">Theme</span>
        <div class="mf-theme-segmented" role="group" aria-label="Theme">
          <button type="button" data-mf-theme-choice="dark" aria-pressed="false">Dark</button>
          <button type="button" data-mf-theme-choice="light" aria-pressed="false">Light</button>
        </div>
        <span class="mf-theme-current" id="mfThemeCurrentValue"></span>
      </div>
    `;

    body.prepend(section);

    section.querySelectorAll('[data-mf-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        applyTheme(button.dataset.mfThemeChoice);
      });
    });

    syncControls(readTheme());
    return true;
  }

  function boot() {
    applyTheme(readTheme(), { persist: false });

    if (!mountAppearance()) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (mountAppearance() || attempts >= 120) {
          window.clearInterval(timer);
        }
      }, 100);
    }
  }

  window.MEMEFLOW_THEME = Object.freeze({
    get: readTheme,
    set: (theme) => applyTheme(theme)
  });

  window.addEventListener('storage', (event) => {
    if (event.key === KEY) applyTheme(event.newValue, { persist: false });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
