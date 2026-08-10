MEMEFLOW Premium Mobile V1.5 — Header Shell

Что исправляет
--------------
- Верхняя шапка больше НЕ является обведённой карточкой.
- Чёрная поверхность шапки идёт от левого края экрана до правого.
- Внешняя рамка сверху/слева/справа полностью отключена.
- Контент остаётся ВНУТРИ шапки за счёт внутренних padding.
- Свободный нижний край имеет скругление 22px — по принципу нижнего меню.
- PAPER MODE, FREE PLAN и wallet находятся в одной первой строке.
- У wallet сбрасывается оформление всей action-обёртки и внутренних wrappers,
  а не только самой кнопки: border/background/shadow = none.
- Wallet offline / RPC online остаются второй строкой внутри той же шапки.

Установка
---------
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_5_HEADER_SHELL.zip
node install-memeflow-premium-mobile-v1-5-header-shell.mjs
node verify-memeflow-premium-mobile-v1-5-header-shell.mjs

Откат только V1.5
-----------------
node rollback-memeflow-premium-mobile-v1-5-header-shell.mjs
