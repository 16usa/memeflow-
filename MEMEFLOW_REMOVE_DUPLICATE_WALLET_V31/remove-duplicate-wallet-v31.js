/* MEMEFLOW REMOVE DUPLICATE WALLET V31
   Surgical fix only.

   Removes ONLY wallet controls injected by old AI UI patches:
     id starts with "mf-header-wallet-v"

   Preserves:
   - native #walletConnectTop
   - native bottom-nav [data-sheet="wallet"]
   - desktop sidebar Wallet
   - AI button / OpenAI sheet
   - V26/V27/V30 behavior
   - evaluator / API / trading logic
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31__) return;
  window.__MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31__ = true;

  const STYLE_ID = 'mf-remove-duplicate-wallet-v31-style';
  const DUP_SELECTOR = '[id^="mf-header-wallet-v"]';

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    /* Hide immediately before JS removes the duplicate node. */
    style.textContent = `
      ${DUP_SELECTOR}{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
    `;
  }

  function removeDuplicates(root = document) {
    let removed = 0;

    if (root instanceof Element && root.matches?.(DUP_SELECTOR)) {
      root.remove();
      return 1;
    }

    const nodes = root.querySelectorAll?.(DUP_SELECTOR) || [];

    for (const node of [...nodes]) {
      node.remove();
      removed += 1;
    }

    return removed;
  }

  function install() {
    ensureStyle();

    /* Remove any duplicate already created by V24/V26/V30. */
    removeDuplicates(document);

    /* Older runtimes create their wallet during startup retries.
       Catch only this exact injected-wallet ID family. */
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node.matches?.(DUP_SELECTOR)) {
            node.remove();
            continue;
          }

          removeDuplicates(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    /* Extra deterministic sweeps across all known startup retry windows. */
    [0, 50, 150, 350, 800, 1500, 2600, 4200, 6500, 9000, 12000].forEach(ms => {
      setTimeout(() => removeDuplicates(document), ms);
    });

    /* Old AI runtimes only create this duplicate during startup.
       Disconnect after that window to keep the patch minimal. */
    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
