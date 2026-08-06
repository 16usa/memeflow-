# MEMEFLOW OHLC Layout Cleanup

Apply this after `MEMEFLOW_NATIVE_OHLC_CHART`.

It fixes the current mobile layout by:

- keeping only one chart;
- hiding the old Market Chart completely;
- constraining the Canvas height;
- restoring the token header, toolbar and footer layout;
- making candle bodies thinner;
- preventing the bottom navigation from covering chart content.

## Replit

```bash
unzip -o MEMEFLOW_OHLC_LAYOUT_CLEANUP.zip
node scripts/ohlc-layout-cleanup.mjs
```

Then press **Stop → Run**.

## Rollback

```bash
cp memeflow-app/index.html.before-ohlc-layout-cleanup memeflow-app/index.html
```
