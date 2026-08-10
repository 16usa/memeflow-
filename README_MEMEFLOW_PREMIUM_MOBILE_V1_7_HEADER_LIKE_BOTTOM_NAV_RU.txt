MEMEFLOW Premium Mobile V1.7 — Header Like Bottom Nav

Что делает
----------
Только мобильная версия <= 600px.

- Верхняя шапка по горизонтали копирует РЕАЛЬНЫЕ размеры нижнего .mobile-nav.
- Берётся фактический left и width нижнего меню через getBoundingClientRect().
- Никаких 50vw и никаких угаданных 8/12 px для ширины.
- Также копируются border-radius, border, background, shadow и backdrop-filter нижнего меню.
- Верхняя шапка остаётся position: static и уезжает вверх вместе со страницей.
- Верхний padding родителя компенсируется, чтобы шапка доходила до верхней границы контента.
- PAPER MODE / FREE PLAN / wallet остаются внутри.
- Wallet остаётся без отдельной плитки/рамки.
- Планшет и desktop не меняются.

Установка
---------
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV.zip
node install-memeflow-premium-mobile-v1-7-header-like-bottom-nav.mjs
node verify-memeflow-premium-mobile-v1-7-header-like-bottom-nav.mjs

Откат
-----
node rollback-memeflow-premium-mobile-v1-7-header-like-bottom-nav.mjs
