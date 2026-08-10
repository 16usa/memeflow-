MEMEFLOW — PRIMARY CANDIDATE IDENTITY ALIGN V3

ЧТО ИСПРАВЛЯЕТ
1. AI SCORE НЕ ДВИГАЕТСЯ И НЕ ПОЛУЧАЕТ НИКАКИХ CSS-СТИЛЕЙ ОТ ПАТЧА.
2. Аватар токена становится ровно той же высоты, что фактически отрисованное большое число #primaryScore.
3. Аватар двигается по Y так, чтобы его ВЕРХ совпал с верхом AI Score.
   Одинаковая высота + одинаковый верх = одинаковый низ.
4. #primaryMeta (например PUMPSHEEP) переносится из-под картинки в одну строку рядом с #primaryName (PumpSheep).

ПОЧЕМУ V3 ОТЛИЧАЕТСЯ ОТ V2
- V2 искал только тег <img>. V3 умеет находить и <img>, и аватар, нарисованный через CSS background-image.
- V2 правил один предполагаемый index.html. V3 автоматически находит и патчит ВСЕ HTML проекта,
  где реально присутствуют #primary-candidate + #primaryScore + #primaryName + #primaryMeta.
- V3 сохраняет существующий wrapper аватара, а не вырывает картинку из runtime-компонента.
- V3 повторяет проверку каждые 1.5 секунды, поэтому поздняя runtime-подстановка картинки тоже обрабатывается.

УСТАНОВКА В REPLIT
1. Загрузить MEMEFLOW_PRIMARY_IDENTITY_ALIGN_V3.zip в КОРЕНЬ проекта.
2. Распаковать:
   unzip -o MEMEFLOW_PRIMARY_IDENTITY_ALIGN_V3.zip
3. Установить:
   node install-primary-identity-align-v3.mjs
4. Проверить, куда реально установился патч:
   node verify-primary-identity-align-v3.mjs
5. Stop -> Run в Replit.
6. На iPhone полностью закрыть страницу Preview/вкладку и открыть заново или сделать hard refresh.

НОРМАЛЬНЫЙ ВЫВОД verify:
OK  memeflow-app/index.html  V3=YES  oldV2=NO  oldAvatar=NO
(путь может быть другим; это нормально — V3 найдёт фактически существующие Primary Candidate HTML-файлы.)

ОТКАТ
node rollback-primary-identity-align-v3.mjs

ДИАГНОСТИКА В БРАУЗЕРЕ
После загрузки страницы V3 ставит на карточке:
  data-mf-primary-align="v3-aligned"
когда аватар найден и выровнен.
Если avatar runtime ещё не появился:
  data-mf-primary-align="v3-waiting-avatar"

Торговая логика, API, evaluator, settings и сам AI Score не изменяются.
