MEMEFLOW — BUTTON ICONS V2 (REVERSIBLE)

V2 заменяет V1. Откатывать V1 перед установкой НЕ НАДО.

Главное исправление V2
----------------------
V1 терял иконки в динамических кнопках, когда приложение делало:
button.textContent = "...";

При этом SVG внутри кнопки удалялся, а маркер V1 оставался.
Из-за этого кнопки ACTIVE CONTEXT · MISSION могли оставаться без иконок.

V2 исправляет это:
- следит за childList + characterData;
- повторно проверяет семантику кнопки после смены текста;
- если SVG исчез — восстанавливает его;
- если смысл кнопки изменился — меняет иконку;
- отдельно форсирует .context-actions внутри #contextBanner/.context-banner.

Примеры ACTIVE CONTEXT
----------------------
Waiting for candidate -> clock
Connect wallet        -> wallet
View evidence         -> eye
Review trade          -> shield-check
AI Analysis           -> brain

Также остаются иконки для остальных кнопок:
Analyze token         -> scan
Save settings         -> save
Restore defaults      -> undo
Calculate impact      -> calculator
Upgrade to Pro        -> sparkles
Manage billing        -> card
Execute trade         -> rocket
Watchlist             -> star
Home                  -> home
Candidates            -> target
Positions             -> briefcase
More                  -> dots

Важно
-----
V2 НЕ меняет:
- click handlers;
- API;
- trading logic;
- execution gates;
- settings logic;
- тексты кнопок.

Установка
---------
1. Загрузи MEMEFLOW_BUTTON_ICONS_V2_REVERSIBLE.zip в корень Replit.
2. Shell:

unzip -o MEMEFLOW_BUTTON_ICONS_V2_REVERSIBLE.zip
node install-memeflow-button-icons-v2.mjs
node verify-memeflow-button-icons-v2.mjs

3. Restart Replit.
4. Hard refresh страницы.

Ожидаемый verifier:
v2Style=YES
v2Script=YES
v1Removed=YES
contextFix=YES
textRewriteFix=YES
forcedContextRefresh=YES
semanticMissionWaiting=YES
semanticMissionWallet=YES
semanticMissionEvidence=YES
mutationObserver=YES
clickHandlersUntouched=YES
backup=YES

Откат
-----
node rollback-memeflow-button-icons-v2.mjs

Rollback возвращает точное состояние index.html непосредственно ДО установки V2.
То есть если до V2 был установлен V1, откат вернёт V1.
