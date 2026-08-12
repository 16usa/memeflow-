# Как сцена связана с логикой игры

## Источник данных

`game.js` получает/обновляет session и рынок, затем выставляет значения на DOM:

- `#multiplierNumber` — текущий multiplier;
- `#game[data-state]` — idle/searching/live/settling/complete;
- `#game[data-stage]` — ground/clouds/strato/orbit/moon/deep/hyper;
- `#game[data-flight]` — idle/cruise/boost/caution/danger/settling/secured;
- `#game[data-direction]` — up/flat/down;
- `#game[data-danger]` — none/low/medium/high;
- `#game[data-outcome]` — secure/crash/void и т.п.

## WebGL

`game-webgl-v9.js -> read()` читает эти dataset + `#multiplierNumber`.

После этого:

- `stage` переключает атмосферу Земля → космос → Луна → deep space;
- `energy` вычисляется из multiplier и усиливает звёзды, speed lines и particles;
- `search` добавляет search tint/energy;
- `live` включает более активные particles;
- `danger` добавляет красный tint/vignette;
- pointer position создаёт лёгкий parallax (`P`).

## Движение Pepe/ракеты

В `game.js` функция `updateStoryFlight(...)` вычисляет:

- прогресс по траектории из multiplier;
- `--flight-x`;
- `--flight-y`;
- `--flight-scale`;
- `--moon-progress`;
- `data-mood` для Pepe;
- `--flame-hue`, `--flame-bright`, `--flame-sat` для двигателя.

То есть рост рынка не просто меняет цифру: он непосредственно меняет положение/вид героя и FX.

## Эмоции Pepe

CSS использует `#rocket[data-mood=...]`:

- `ready` — спокойное движение;
- `scan` — движение головы/очков;
- `boost` — радость + активная рука/пальцы;
- `moon` — усиленная радостная анимация;
- `dip` — sad mouth;
- `danger/crash` — panic mouth + shake;
- `secure` — победная реакция.

## Пламя

`updateStoryFlight()` задаёт CSS custom properties:

```css
--flame-hue
--flame-bright
--flame-sat
```

`.exhaust` и `.plasma-tail` читают их через `filter: hue-rotate(...) saturate(...) brightness(...)`.

Поэтому цвет двигателя можно полностью привязать к direction, danger, stage или любому серверному параметру.
