MEMEFLOW — Primary Avatar Glyph Align V19

Почему V18 был чуть неточным
----------------------------
V18 брал getBoundingClientRect().height у #primaryScore.
Это высота line-box, а не только видимых цифр. В line-box есть невидимый
воздух сверху/снизу, поэтому аватарка получалась немного выше цифр.

Что делает V19
--------------
- Берёт реальный computed font у #primaryScore.
- Canvas measureText() измеряет actualBoundingBoxAscent/Descent цифр.
- Размер аватарки = реальная видимая высота цифр.
- Положение аватарки вычисляется через fontBoundingBox и line-box.
- Верх аватарки совпадает с верхом видимых цифр.
- Низ аватарки совпадает с низом видимых цифр.
- Большое название остаётся в строке с числом.
- Маленький symbol остаётся в строке с AI SCORE.

Установка
---------
unzip -o MEMEFLOW_PRIMARY_AVATAR_GLYPH_ALIGN_V19.zip
node install-primary-avatar-glyph-align-v19.mjs
node verify-primary-avatar-glyph-align-v19.mjs
