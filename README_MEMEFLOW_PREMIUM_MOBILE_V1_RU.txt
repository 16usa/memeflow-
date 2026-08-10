MEMEFLOW PREMIUM MOBILE V1 — REVERSIBLE

Что делает
----------
Это отдельный финальный MOBILE design layer. Торговую логику, API, AI, wallet, billing logic и settings logic не меняет.

Изменения:
- компактнее верхняя зона PAPER/FREE + Wallet/RPC
- вертикальная плотность выше примерно на 15–25%
- меньше лишних внутренних рамок
- компактнее Active Context
- компактнее Manual AI Scan
- пустой Primary Candidate занимает меньше места
- Pre-trade показывает summary; подробные 7 checks открываются кнопкой View all checks
- Plans & Billing компактнее и больше похож на приложение, а не лендинг
- Settings rows существенно ниже и плотнее
- secondary text чуть спокойнее/меньше
- bottom navigation ниже и легче
- yellow оставлен в основном для WAITING/LOCKED/warnings

Установка
---------
unzip -o MEMEFLOW_PREMIUM_MOBILE_V1_REVERSIBLE.zip
node install-memeflow-premium-mobile-v1.mjs
node verify-memeflow-premium-mobile-v1.mjs

Откат ТОЧНО к состоянию до патча
--------------------------------
node rollback-memeflow-premium-mobile-v1.mjs

Важно
-----
При первой установке создаётся полный backup текущего index.html:
memeflow-app/index.html.before-premium-mobile-v1.bak

Повторный запуск installer не перезаписывает исходный backup и не наслаивает второй V1 слой.
