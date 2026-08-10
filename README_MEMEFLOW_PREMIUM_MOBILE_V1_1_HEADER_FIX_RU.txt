MEMEFLOW Premium Mobile V1.1 — Header Fix

Исправляет только верхнюю мобильную шапку после Premium Mobile V1.

Что исправлено:
- шапка снова full-width / full-bleed;
- убран внешний rounded-card вид у topbar;
- wallet-кнопка больше не должна уходить за правый край;
- остальные изменения Premium Mobile V1 сохраняются.

Установка:
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_1_HEADER_FIX.zip
node install-memeflow-premium-mobile-v1-1-header-fix.mjs
node verify-memeflow-premium-mobile-v1-1-header-fix.mjs

Откат только этого hotfix:
node rollback-memeflow-premium-mobile-v1-1-header-fix.mjs
