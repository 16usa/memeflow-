MEMEFLOW — Manual Analysis token logo = AI Score size

Что делает патч
----------------
Патч меняет ТОЛЬКО изображение токена внутри блока MANUAL ANALYSIS.
Размер логотипа автоматически берётся по фактической высоте большого числа AI SCORE.
Поэтому на телефоне, планшете и desktop логотип остаётся визуально того же размера,
что и число AI Score, даже если адаптивный CSS меняет размер шрифта.

Установка в Replit
------------------
1. Загрузите файлы патча в корень проекта.
2. В Shell выполните:

   node apply-manual-logo-score-size.mjs

3. Перезапустите приложение.
4. На iPhone сделайте hard refresh / полностью перезагрузите страницу.

Если index.html лежит в другом месте:
   node apply-manual-logo-score-size.mjs path/to/index.html

Для текущей структуры MEMEFLOW скрипт автоматически ищет:
   memeflow-app/index.html
а затем:
   index.html

Откат
-----
   node remove-manual-logo-score-size.mjs

Безопасность
------------
- Торговая логика, API, evaluator, настройки, Candidate Feed и данные не меняются.
- Патч не меняет AI Score — он только подгоняет размер token image под уже
  отрисованный размер числа.
- Перед первой установкой автоматически создаётся backup:
  index.html.before-manual-logo-patch.bak
- Повторный запуск не наслаивает копии патча: предыдущий блок заменяется.
