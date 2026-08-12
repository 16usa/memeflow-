# MEMEFLOW V9.6 visual source export

Здесь лежит **полный исходный код текущей визуальной версии V9.6**, без сокращений.

## full-source/

- `game.html` — полный HTML страницы игры, включая inline SVG Pepe+rocket и все HUD-слои.
- `game.css` — полный CSS всей игры и адаптивных режимов.
- `game.js` — полный client runtime: session/state, отображение multiplier, движение героя, mood, flame mapping, HUD и т.д.
- `game-webgl-v9.js` — полный WebGL 2.5D renderer.

## layers/

- `pepe-rocket-v6-current.svg` — текущий персонаж+ракета отдельно как SVG.
- `world-scene-current.html` — только текущий DOM сцены `#world`.
- `webgl-background-fragment.glsl` — background fragment shader отдельно.
- `webgl-particles.vert.glsl`
- `webgl-particles.frag.glsl`

## Документация

- `LAYERS_MAP.md` — что за каждый слой и какой у него z-index.
- `STATE_BINDINGS.md` — как цена/multiplier/state/danger связаны с WebGL, Pepe, ракетой и пламенем.

Это экспорт из пакета `pepe-game-v9.6-cinematic-hud-hero.zip`.
