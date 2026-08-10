MEMEFLOW — Primary Meta Match V20

Что меняет V20
--------------
- Сохраняет логику V19:
  - аватарка токена по верху и по низу совпадает с видимыми цифрами AI Score;
  - большое название стоит в строке с большим числом;
  - маленькое название / symbol стоит в строке с AI SCORE.
- Дополнительно делает точное совпадение размеров для:
  - маленького названия (например wTOAD)
  - и подписи AI SCORE.

Как
---
- Патч читает computed style у настоящей подписи AI SCORE.
- Потом копирует в #primaryMeta:
  - font-size
  - line-height
  - font-weight
  - letter-spacing

Установка
---------
unzip -o MEMEFLOW_PRIMARY_META_MATCH_V20.zip
node install-primary-meta-match-v20.mjs
node verify-primary-meta-match-v20.mjs
