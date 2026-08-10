MEMEFLOW — Primary Candidate Identity Stable V8

Что исправляет V8
-----------------
На V7 мог появиться второй логотип: большой статичный слот с "?" слева и настоящий
логотип токена рядом с названием. V8 делает один авторитетный слот изображения.

Итоговая структура:
[LOGO]  Token Name                         88
        SYMBOL                       AI SCORE

- Только один логотип.
- Настоящее изображение токена переиспользуется, даже если его загрузил старый
  metadata/logo loader.
- Старый/дублирующий визуальный элемент скрывается.
- Название и SYMBOL всегда находятся в одной колонке.
- AI SCORE не перемещается.
- Нет MutationObserver.
- Нет setInterval.
- Нет transform-позиционирования.

Установка
---------
1. Загрузить все файлы из ZIP в корень Replit-проекта.
2. Выполнить:

   node install-primary-identity-stable-v8.mjs
   node verify-primary-identity-stable-v8.mjs

3. Сделать Stop -> Run.
4. Полностью обновить страницу в Safari/приложении.

Проверка должна показать YES для всех пунктов.

Если понадобится откат:
   node rollback-primary-identity-stable-v8.mjs
