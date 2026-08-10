MEMEFLOW — BUTTON ICONS V1 (REVERSIBLE)

Что делает
----------
Добавляет тематические line-иконки в action/navigation-кнопки MEMEFLOW.

Стиль:
- тонкие monochrome line icons;
- currentColor, поэтому иконка подстраивается под цвет кнопки;
- cyan/green/amber/red используются только по смыслу;
- без emoji;
- без тяжёлых картинок;
- нижняя mobile-nav получает аккуратные иконки над текстом;
- уже существующие графические иконки НЕ дублируются;
- динамически созданные кнопки также получают иконки через MutationObserver.

Примеры
-------
Analyze token        -> scan
Connect wallet       -> wallet
Verify ownership     -> shield-check
View evidence        -> eye
Validate execution   -> shield-check
Decision replay      -> history
Compare              -> compare
Save settings        -> save
Reload/Refresh       -> refresh
Restore defaults     -> undo
Calculate impact     -> calculator
Upgrade to Pro       -> sparkles
Manage billing       -> card
Execute trade        -> rocket
Add to watchlist     -> star
Home                 -> home
Candidates           -> target
Positions            -> briefcase
More                 -> dots

Важно
-----
Патч НЕ меняет:
- click handlers;
- routes/navigation logic;
- trading logic;
- API;
- settings logic;
- execution gates;
- тексты кнопок.

Перед установкой создаётся полный backup index.html.

Установка в Replit
------------------
1. Загрузи ZIP в корень проекта.
2. Открой Shell.
3. Выполни:

unzip -o MEMEFLOW_BUTTON_ICONS_V1_REVERSIBLE.zip
node install-memeflow-button-icons-v1.mjs
node verify-memeflow-button-icons-v1.mjs

4. Перезапусти Replit.
5. Сделай hard refresh страницы.

Откат
-----
node rollback-memeflow-button-icons-v1.mjs

После отката перезапусти Replit и обнови страницу.

Если index.html находится не в memeflow-app/index.html, можно передать путь вручную:

node install-memeflow-button-icons-v1.mjs path/to/index.html
node verify-memeflow-button-icons-v1.mjs path/to/index.html
node rollback-memeflow-button-icons-v1.mjs path/to/index.html
