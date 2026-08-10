MEMEFLOW — Primary Identity Clean V13

Что исправляет
--------------
1. Удаляет СРЕДНИЙ второй логотип, который был добавлен V11/V12 как #primaryAvatar.
2. Оставляет большой ЛЕВЫЙ родной логотип токена.
3. Сохраняет очистку emoji из имени/meta.
4. Убирает буквальные \n, которые могли появляться сверху страницы в Safari.
5. AI SCORE не трогает.

Установка
---------
unzip -o MEMEFLOW_PRIMARY_IDENTITY_CLEAN_V13.zip
node install-primary-identity-clean-v13.mjs
node verify-primary-identity-clean-v13.mjs

После установки просто полностью обнови страницу Safari.

Откат
-----
node rollback-primary-identity-clean-v13.mjs
