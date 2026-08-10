MEMEFLOW Primary Identity Stable V9 — WAITING state hotfix

Что исправлено
--------------
- Сохраняет стабильную карточку выбранного токена из V8.
- Когда BUY READY токена нет, НЕ резервирует пустой 54px слот под аватар.
- Не показывает обрезанное "No token s...".
- Пустое состояние показывает одной чистой строкой: "No token selected".
- При появлении токена снова включается схема:
  [реальный логотип] [имя]
                   [symbol]
  AI SCORE остается справа и не двигается.
- Нет MutationObserver, setInterval или transform-позиционирования в V9.
- Manual AI Scan патч не удаляется этим установщиком.

Установка
---------
unzip -o MEMEFLOW_PRIMARY_IDENTITY_STABLE_V9.zip
node install-primary-identity-stable-v9.mjs
node verify-primary-identity-stable-v9.mjs

После этого Stop -> Run и открыть страницу заново.

Откат
-----
node rollback-primary-identity-stable-v9.mjs
