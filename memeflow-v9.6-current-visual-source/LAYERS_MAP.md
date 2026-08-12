# MEMEFLOW V9.6 — current visual layers

Это карта именно текущей сцены V9.6 из `pepe-game-v9.6-cinematic-hud-hero.zip`.

## Главный контейнер

`#world` — контейнер всей игровой сцены. Все визуальные элементы либо находятся внутри него, либо WebGL-canvas вставляется JavaScript-ом первым дочерним элементом.

## Стек слоёв

| Порядок | Слой | Технология | Назначение |
|---|---|---|---|
| 1 | `#webglScene` | WebGL canvas, z=0 | Космос/атмосфера, nebula, звёзды, облака, Земля, Луна, дальняя планета, horizon glow, speed lanes, vignette/danger tint |
| 2 | `.story-route` | DOM/CSS, z=1 | Пунктирная траектория Земля → Луна |
| 3 | `.trace` | SVG, z=2 | Графическая линия текущего движения/мультипликатора |
| 4 | `.levels` | DOM, z=3 | Метки 1.00× / 1.20× / 1.50× / 2× / 3× / 5× / 10× |
| 5 | `.moon-beacon` | DOM/CSS, z=4 | Графическая Луна/маяк назначения |
| 6 | `.target-reticle` | DOM/CSS, z=5 | Тонкий прицел/ретикл в центре сцены |
| 7 | `.flight-progress` | DOM/CSS, z=7 | PAD → SKY → ATMOS → ORBIT → MOON → DEEP → HYPER |
| 8 | `#rocket.story-hero` | inline SVG + CSS, z=8 | Текущий Pepe + серебряная ракета с красным носом/стабилизаторами |
| 9 | `.rocket-halo` | CSS внутри hero | Свечение вокруг ракеты |
| 10 | `.plasma-tail` | CSS внутри hero | Длинный реактивный/plasma след |
| 11 | `.exhaust` | CSS внутри hero | Основное пламя двигателя; hue меняется от состояния игры |
| 12 | `.shockwave/.emergency-flash/.secure-flash` | DOM/CSS, z=15 | FX результата/опасности |
| 13 | `#milestone` | DOM, z=18 | Временный milestone при переходах уровней |
| 14 | `#centerState` | DOM, z=20 | Countdown / target lock / промежуточные состояния |
| 15 | `#cashoutTelemetry` | DOM, z=22 в LIVE | Нижний компактный LIVE POSITION блок |
| 16 | `#flightPositionHud` | DOM, z=23 | ENTRY / CURRENT / PEAK справа сверху |
| 17 | `#flightAssist` | DOM, z=24 | FLIGHT TELEMETRY слева сверху |
| 18 | `#staleCover` | DOM, z=24 | Full-scene блок, если market data stale |

## Что рисует сам WebGL shader

Внутри `game-webgl-v9.js` один background fragment shader процедурно собирает несколько глубин:

1. основной gradient атмосферы/космоса;
2. procedural nebula через FBM-noise;
3. три плотности звёзд (`a`, `b`, `c`) с разными масштабами;
4. облачный слой на ранних stage;
5. Землю и атмосферное свечение;
6. Луну на orbit/moon stage;
7. дальнюю планету для deep-space;
8. horizon glow;
9. speed lanes при росте `energy/live`;
10. vignette;
11. danger/search tint.

Отдельным WebGL particle program рисуются glow/частицы/speed particles.

## Pepe и ракета

Pepe+rocket сейчас **не PNG**. Они находятся прямо внутри `game.html` как `<svg class="pepe-v6">`.

Внутри SVG отдельно существуют группы:

- `.v6-rocket` — корпус ракеты;
- `.v6-nose` — красный нос;
- `.v6-fin-top` / `.v6-fin-bottom` — красные стабилизаторы;
- `.v6-porthole` — иллюминатор;
- `.v6-pepe` — весь персонаж;
- `.v6-leg-back` / `.v6-leg-front` — ноги;
- `.v6-torso` — чёрная одежда/торс;
- `.v6-arm-left` / `.v6-arm-right` — руки;
- `.v6-wave-hand` — кисть/пальцы для анимации;
- `.v6-head` — голова;
- `.v6-pupils` — глаза;
- `.v6-shades` — чёрные очки;
- `.v6-smile`, `.v6-sad`, `.v6-panic` — три выражения лица.

Поэтому персонажа можно анимировать по частям без замены всей картинки.
