MEMEFLOW Premium Mobile V1.2 — Header Card

Что исправляет
--------------
Верхняя шапка теперь геометрически повторяет нижнее мобильное меню:
- отступ от левого края viewport: 8px
- отступ от правого края viewport: 8px
- border-radius: 14px
- border: var(--line2)
- тот же тёмный фон rgba(7,11,16,.97)
- тот же blur 18px

Wallet-кнопка принудительно остаётся внутри шапки.
Остальной Premium Mobile V1 не изменяется.

Установка
---------
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_2_HEADER_CARD.zip
node install-memeflow-premium-mobile-v1-2-header-card.mjs
node verify-memeflow-premium-mobile-v1-2-header-card.mjs

Откат только V1.2
-----------------
node rollback-memeflow-premium-mobile-v1-2-header-card.mjs
