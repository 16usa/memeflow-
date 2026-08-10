MEMEFLOW Premium Mobile V1.6 — Header Module Scroll

Что делает
----------
ТОЛЬКО мобильная версия (CSS viewport <= 600px).

1. Верхняя шапка становится обычным модулем.
2. По ширине она ровно как остальные модули внутри .main.
3. Больше нет full-bleed/edge-to-edge растягивания.
4. Шапка НЕ fixed и НЕ sticky.
5. При прокрутке страницы шапка уезжает вверх вместе со всем контентом.
6. Планшет (>600px) этим патчем не меняется.
7. PAPER MODE / FREE PLAN / wallet остаются в первой строке.
8. Wallet остаётся без отдельной рамки/плитки.
9. Wallet offline / RPC online остаются второй строкой внутри шапки.

Установка
---------
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL.zip
node install-memeflow-premium-mobile-v1-6-header-module-scroll.mjs
node verify-memeflow-premium-mobile-v1-6-header-module-scroll.mjs

Откат
-----
node rollback-memeflow-premium-mobile-v1-6-header-module-scroll.mjs
