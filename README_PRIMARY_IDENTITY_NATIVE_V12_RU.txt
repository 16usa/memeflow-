MEMEFLOW — Primary Identity Native V12

Что исправляет
--------------
На некоторых токенах имя и symbol приходят как emoji:
- большое имя: "🐸 frog emoji"
- маленькая строка: "🐸"

После V11 это выглядело как два лишних логотипа рядом с названием.
V12 их убирает:
- из большого имени удаляет ведущий emoji/logo
- если маленькая строка состоит только из emoji/logo, она скрывается
- основной левый логотип остаётся один

Установка
---------
unzip -o MEMEFLOW_PRIMARY_IDENTITY_NATIVE_V12.zip
node install-primary-identity-native-v12.mjs
node verify-primary-identity-native-v12.mjs

Потом обнови страницу.
