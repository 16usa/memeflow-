MEMEFLOW — MILLION DOLLAR MOBILE V1 (REVERSIBLE)

Это мобильный визуальный патч под утверждённый дизайн:
Black Titanium / decision-first / premium matte glass.

ВАЖНО
------
- Только mobile <= 600 px.
- API, торговая логика, AI decision logic, execution gates и Settings НЕ меняются.
- Патч использует реальные существующие элементы и реальные значения:
  contextBanner, Primary Candidate, AI Score, Confidence, Risk,
  primaryChecks, executionPreview и mobile-nav.
- Старые отдельные header/nav visual-патчи удаляются из рабочего HTML,
  чтобы они не конфликтовали с новым финальным слоем.
- ДО любых изменений создаётся полный backup index.html.
- Rollback возвращает точный файл до установки.

ЧТО ВИЗУАЛЬНО МЕНЯЕТСЯ
----------------------
1. Верхняя статусная шапка:
   PAPER MODE / FREE PLAN / wallet + компактные Wallet/RPC статусы.
2. Active Context:
   крупное человеческое решение + две понятные CTA.
3. Manual AI Scan:
   если блок уже есть в текущем Replit build, он автоматически получает
   premium Black Titanium оформление.
4. Primary Candidate:
   токен/avatar + название/symbol + крупный AI Score.
   Четыре простых показателя:
   Confidence / Risk / Momentum / Liquidity.
5. AI verdict:
   existing primaryReason оформляется как краткое человеческое объяснение.
6. AI Analysis & Market Data:
   компактная строка; по нажатию раскрывает реальный Decision Studio.
7. Pre-trade checks:
   компактная строка; по нажатию раскрывает реальный executionPreview.
8. Нижняя навигация:
   дорогая matte-glass панель, спокойное active state,
   центральный AI визуально выделен.

УСТАНОВКА
---------
unzip -o MEMEFLOW_MILLION_DOLLAR_MOBILE_V1_REVERSIBLE.zip
node install-memeflow-million-dollar-mobile-v1.mjs
node verify-memeflow-million-dollar-mobile-v1.mjs

После установки перезапусти Replit и сделай hard refresh страницы.

ОТКАТ
-----
node rollback-memeflow-million-dollar-mobile-v1.mjs

После отката снова перезапусти Replit и обнови страницу.

Если Replit project root другой, можно передать путь вручную:
node install-memeflow-million-dollar-mobile-v1.mjs path/to/index.html
node verify-memeflow-million-dollar-mobile-v1.mjs path/to/index.html
node rollback-memeflow-million-dollar-mobile-v1.mjs path/to/index.html
