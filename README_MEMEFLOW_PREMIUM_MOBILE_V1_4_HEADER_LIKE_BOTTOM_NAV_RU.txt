MEMEFLOW Premium Mobile V1.4 — Header Like Bottom Nav

Исправляет только верхнюю мобильную шапку поверх Premium Mobile V1.

Что изменено:
- удалён calc(50% - 50vw), который мог давать лишнюю ширину на Safari;
- шапка компенсирует padding .main точными пикселями и остаётся внутри viewport;
- слева и справа до края экрана;
- внешний border сверху/слева/справа убран;
- фон/blur/shadow в той же системе, что нижнее меню;
- PAPER MODE + FREE PLAN + wallet находятся в одной строке;
- у wallet удалены рамка, фон, shadow и pseudo-elements;
- Wallet offline / RPC online остаются второй строкой той же шапки;
- отдельный rollback возвращает состояние ровно до V1.4.

Установка:
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV.zip
node install-memeflow-premium-mobile-v1-4-header-like-bottom-nav.mjs
node verify-memeflow-premium-mobile-v1-4-header-like-bottom-nav.mjs

Откат:
node rollback-memeflow-premium-mobile-v1-4-header-like-bottom-nav.mjs
