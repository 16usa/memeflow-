(() => {
  'use strict';

  const VERSION = 'V1';

  /*
   * IMPORTANT:
   * This patch changes ONLY the content inside the existing
   * Selected Launch token avatar.
   *
   * No CSS.
   * No width/height changes.
   * No border changes.
   * No position changes.
   */

  function cleanUrl(value) {
    if (!value || typeof value !== 'string') return '';

    const v = value.trim();

    if (
      v.startsWith('http://') ||
      v.startsWith('https://') ||
      v.startsWith('data:image/') ||
      v.startsWith('blob:')
    ) {
      return v;
    }

    return '';
  }


  function getAvatarBox() {
    /*
     * Current Flight UI normally uses .token-avatar.
     * Restrict search to Selected Launch / token panel.
     */
    return (
      document.querySelector('.token-panel .token-avatar') ||
      document.querySelector('.token-panel [data-token-image]') ||
      document.querySelector(
        '.token-panel .token-head > :first-child'
      )
    );
  }


  function imageFromElement(root) {
    if (!root) return '';

    /*
     * Same image selectors already used by
     * market-chart-final.js in this project.
     */
    const img = root.matches?.('img[src]')
      ? root
      : root.querySelector?.(
          '.token-logo img[src], ' +
          '.token-avatar img[src], ' +
          '[data-token-image] img[src], ' +
          'img[data-token-image][src], ' +
          'img[src]'
        );

    if (img) {
      const src = cleanUrl(
        img.currentSrc ||
        img.src ||
        img.getAttribute('src')
      );

      if (src) return src;
    }

    /*
     * Existing data attributes, if the card stores the URL
     * without rendering an IMG yet.
     */
    const nodes = [
      root,
      ...(root.querySelectorAll?.(
        '[data-token-image], ' +
        '[data-image-url], ' +
        '[data-image], ' +
        '[data-logo], ' +
        '[data-logo-url]'
      ) || [])
    ];

    for (const el of nodes) {
      const values = [
        el?.dataset?.tokenImage,
        el?.dataset?.imageUrl,
        el?.dataset?.image,
        el?.dataset?.logo,
        el?.dataset?.logoUrl
      ];

      for (const value of values) {
        const url = cleanUrl(value);
        if (url) return url;
      }
    }

    return '';
  }


  function getSelectedTokenImage() {
    /*
     * Priority:
     * 1. Explicit active/selected candidate
     * 2. Primary candidate/card
     * 3. Current token card
     *
     * We deliberately DO NOT grab a random token image
     * from the page.
     */
    const roots = [
      document.querySelector('.candidate.active'),
      document.querySelector('[data-selected-token="true"]'),
      document.querySelector('[aria-selected="true"].candidate'),
      document.querySelector('.primary-card'),
      document.querySelector('.primary-candidate'),
      document.querySelector('.token-card.active'),
      document.querySelector('.token-card.selected'),
      document.querySelector('.selected-token')
    ].filter(Boolean);

    for (const root of roots) {
      const url = imageFromElement(root);
      if (url) return url;
    }

    /*
     * market-chart-final.js already uses these selectors.
     * Restrict this fallback to visible images only.
     */
    const imgs = [
      ...document.querySelectorAll(
        '.candidate.active .token-logo img[src], ' +
        '.candidate.active .token-avatar img[src], ' +
        '.primary-card .token-logo img[src], ' +
        '.primary-card .token-avatar img[src], ' +
        '.primary-card [data-token-image] img[src]'
      )
    ];

    for (const img of imgs) {
      if (img.closest('.token-panel')) continue;

      const rect = img.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) continue;

      const url = cleanUrl(
        img.currentSrc ||
        img.src ||
        img.getAttribute('src')
      );

      if (url) return url;
    }

    return '';
  }


  function restoreFallback(box) {
    if (!box) return;

    const img = box.querySelector(
      ':scope > img[data-mf-selected-token-image]'
    );

    if (img) img.remove();

    /*
     * Restore original '?' only if the box became empty.
     * We don't replace any existing project markup.
     */
    const visibleText = (box.textContent || '').trim();

    if (!visibleText && box.children.length === 0) {
      box.textContent = '?';
    }

    box.removeAttribute('data-mf-image-active');
  }


  function render() {
    const box = getAvatarBox();

    if (!box) return;

    const url = getSelectedTokenImage();

    if (!url) {
      restoreFallback(box);
      return;
    }

    const existing = box.querySelector(
      ':scope > img[data-mf-selected-token-image]'
    );

    if (
      existing &&
      existing.dataset.sourceUrl === url
    ) {
      return;
    }

    /*
     * Save original fallback exactly once.
     */
    if (!box.hasAttribute('data-mf-original-html')) {
      box.setAttribute(
        'data-mf-original-html',
        box.innerHTML
      );
    }

    const img = document.createElement('img');

    img.setAttribute(
      'data-mf-selected-token-image',
      VERSION
    );

    img.dataset.sourceUrl = url;
    img.alt = '';

    /*
     * Inline styles affect ONLY the IMG.
     * Existing avatar wrapper/ring/border is untouched.
     */
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: 'cover',
      borderRadius: 'inherit'
    });

    img.addEventListener(
      'load',
      () => {
        /*
         * Remove only the fallback contents after image
         * has successfully loaded.
         */
        for (const child of [...box.childNodes]) {
          if (child !== img) {
            child.remove();
          }
        }

        box.appendChild(img);
        box.setAttribute(
          'data-mf-image-active',
          '1'
        );
      },
      { once: true }
    );

    img.addEventListener(
      'error',
      () => {
        img.remove();

        const original =
          box.getAttribute(
            'data-mf-original-html'
          );

        if (
          original !== null &&
          !box.innerHTML.trim()
        ) {
          box.innerHTML = original;
        }

        box.removeAttribute(
          'data-mf-image-active'
        );
      },
      { once: true }
    );

    /*
     * Append first, but keep original fallback until
     * LOAD succeeds.
     */
    img.style.position = 'absolute';
    img.style.inset = '0';

    const computed =
      getComputedStyle(box);

    if (computed.position === 'static') {
      /*
       * Only needed to place image inside existing box.
       * Does not move/resize the avatar.
       */
      box.style.position = 'relative';
    }

    box.appendChild(img);
  }


  let queued = false;

  function scheduleRender() {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }


  function boot() {
    scheduleRender();

    /*
     * Selected token changes dynamically while scanning,
     * so observe DOM updates rather than patching game logic.
     */
    const observer =
      new MutationObserver(scheduleRender);

    observer.observe(
      document.body,
      {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'src',
          'class',
          'data-token-image',
          'data-image-url',
          'data-image',
          'data-logo',
          'data-logo-url',
          'data-selected-token',
          'aria-selected'
        ]
      }
    );

    window.addEventListener(
      'pageshow',
      scheduleRender
    );

    console.info(
      '[MEMEFLOW]',
      'Selected Launch token image',
      VERSION,
      'active'
    );
  }


  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
