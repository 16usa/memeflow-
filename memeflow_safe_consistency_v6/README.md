# MEMEFLOW SAFE CONSISTENCY V6

This patch does not inject a large inline script into `index.html`.

It creates:

- `memeflow-app/full-consistency-v6.js`
- `memeflow-app/src/safe-consistency-v6.test.mjs`

It adds only this line before `</body>`:

```html
<script src="/full-consistency-v6.js" defer></script>
```

The module clones the existing Market Chart container. Old timers keep references
to the detached old container and can no longer erase the visible chart.

## Fixes

- Candidate mint/address binding to Market Chart
- Chart flickering from competing renderers
- LIVE with zero points
- Empty snapshots erasing history
- Old interval/token callbacks
- Quote age without a real quote
- Route PASS without an executable quote
- False readiness / AI BUY READY
- Stale Mission header
- Misleading confidence/data when market fields are absent

## Install from `~/workspace`

```bash
unzip -o MEMEFLOW_SAFE_CONSISTENCY_V6.zip
node memeflow_safe_consistency_v6/apply_safe_consistency_v6.mjs
node --test memeflow-app/src/safe-consistency-v6.test.mjs
```

Expected:

```text
pass 9
fail 0
```

Then restart Project and hard-refresh Preview.

## Rollback

```bash
cp memeflow-app/index.html.before-safe-consistency-v6 memeflow-app/index.html
rm -f memeflow-app/full-consistency-v6.js
rm -f memeflow-app/src/safe-consistency-v6.test.mjs
```
