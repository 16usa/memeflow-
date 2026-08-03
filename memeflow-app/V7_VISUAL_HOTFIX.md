# V7 visual hotfix

The deployed V6 page could restore the old `mf-theme=light` value from Safari localStorage. The light palette did not cover every legacy component, producing white cards, invisible white text, a dark page background and a dark fixed navigation at the same time.

V7 changes:
- verified dark palette is locked for the production release;
- old `mf-theme` values are removed on startup;
- the theme control is hidden;
- a defensive dark-theme override prevents an old cached `data-theme=light` attribute from breaking contrast;
- HTML responses use no-cache headers;
- extra mobile bottom spacing prevents fixed navigation from covering the final content.

`Solana RPC: Unavailable` is not a CSS error. It means `SOLANA_RPC_URLS` / `SOLANA_WS_URLS` are missing or unreachable in Replit Secrets.
