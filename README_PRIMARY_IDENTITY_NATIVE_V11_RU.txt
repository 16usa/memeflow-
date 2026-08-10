MEMEFLOW — Primary Identity Native V11

ПОЧЕМУ V10 НЕ РАБОТАЛ
---------------------
V10 добавлял второй renderer поверх production-core.
Но production-core уже является владельцем Primary Candidate и обновляет
primaryName / primaryMeta / primaryScore каждые 10 секунд.
Из-за двух renderer-ов появлялись гонки и пропадали имя/symbol.

ЧТО ДЕЛАЕТ V11
--------------
- Полностью удаляет V7–V10 identity/align патчи.
- Не создаёт второй renderer.
- Встраивает обновление аватара прямо в существующий production-core render().
- Большое имя остаётся #primaryName.
- Маленький symbol остаётся #primaryMeta и стоит под большим именем.
- Один логотип стоит слева.
- Высота логотипа берётся из уже отрисованного #primaryScore.
- AI SCORE не перемещается и не рестайливается.
- Нет V11 MutationObserver / setInterval / candidatechange listener.

УСТАНОВКА
---------
unzip -o MEMEFLOW_PRIMARY_IDENTITY_NATIVE_V11.zip
node install-primary-identity-native-v11.mjs
node verify-primary-identity-native-v11.mjs

Затем Stop -> Run и открыть страницу заново.

ОТКАТ
-----
node rollback-primary-identity-native-v11.mjs
