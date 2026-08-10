MEMEFLOW Primary Identity Stable V10

Исправляет конкретную ошибку V9:
memeflow:candidatechange содержит name/symbol/mint, но не id. V9 воспринимал это как отсутствие токена и сам скрывал имя/аватар.

V10:
- берет авторитетного кандидата из MEMEFLOW_CORE.getSelected();
- показывает один настоящий логотип;
- показывает большое название токена;
- показывает маленький symbol прямо под большим названием;
- размер логотипа подгоняет по высоте #primaryScore;
- AI SCORE не перемещает;
- без MutationObserver и setInterval.

Установка:
unzip -o MEMEFLOW_PRIMARY_IDENTITY_STABLE_V10.zip
node install-primary-identity-stable-v10.mjs
node verify-primary-identity-stable-v10.mjs

Потом Stop -> Run и полное обновление страницы.
