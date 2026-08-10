MEMEFLOW — PRIMARY IDENTITY STABLE V7

Зачем V7
--------
V6 был неправильным: MutationObserver повторно искал/переставлял DOM при каждом
обновлении карточки. Из-за этого блок avatar + name + symbol мог перескакивать
вправо, когда Primary Candidate обновлялся.

V7 это полностью убирает.

Что делает V7
-------------
- AI SCORE не передвигается и не получает V7-стилей.
- Левая часть Primary Candidate — постоянная CSS Grid структура.
- Слева avatar 54x54.
- Справа от avatar: большое название.
- Маленький symbol находится ПОД большим названием, с тем же левым краем.
- Никаких transform для позиционирования.
- Никакого MutationObserver.
- Никакого setInterval.
- При обновлении кандидата меняется только src изображения avatar.
- Старые V1–V6 patch-блоки удаляются установщиком.

Установка в Replit
------------------
unzip -o MEMEFLOW_PRIMARY_IDENTITY_STABLE_V7.zip
node install-primary-identity-stable-v7.mjs
node verify-primary-identity-stable-v7.mjs

Проверка должна вернуть OK и YES для всех пунктов.
После этого Stop -> Run и полностью обновить страницу.

Откат
-----
node rollback-primary-identity-stable-v7.mjs
