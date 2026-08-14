const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const PRESETS = Object.freeze({
  up: Object.freeze({ direction: 1, speed: 0.90, thrust: 1.00, volatility: 0.20, boost: 0.35 }),
  idle: Object.freeze({ direction: 0, speed: 0.22, thrust: 0.25, volatility: 0.08, boost: 0.00 }),
  down: Object.freeze({ direction: -1, speed: 0.08, thrust: 0.08, volatility: 0.28, boost: 0.00 })
});

export function createMotionController({ response = 5.5 } = {}) {
  const target = { ...PRESETS.idle };
  const state = { ...PRESETS.idle };
  const marketTargets = new Set();
  let mode = 'idle';

  function publishTarget() {
    for (const sink of marketTargets) {
      sink.setMarket({
        direction: target.direction,
        speed: target.speed,
        thrust: target.thrust
      });
    }
  }

  function setMarket(next = {}) {
    if (Number.isFinite(next.direction)) target.direction = clamp(next.direction, -1, 1);
    if (Number.isFinite(next.speed)) target.speed = clamp(next.speed, 0, 1);
    if (Number.isFinite(next.thrust)) target.thrust = clamp(next.thrust, 0, 1);
    if (Number.isFinite(next.volatility)) target.volatility = clamp(next.volatility, 0, 1);
    if (Number.isFinite(next.boost)) target.boost = clamp(next.boost, 0, 1);
    publishTarget();
    return target;
  }

  function setMode(nextMode = 'idle') {
    mode = Object.prototype.hasOwnProperty.call(PRESETS, nextMode) ? nextMode : 'idle';
    setMarket(PRESETS[mode]);
    return mode;
  }

  function bindMarketTarget(sink) {
    if (!sink || typeof sink.setMarket !== 'function') {
      throw new Error('[MOTION V33] target must expose setMarket(state)');
    }
    marketTargets.add(sink);
    sink.setMarket({
      direction: target.direction,
      speed: target.speed,
      thrust: target.thrust
    });
    return () => marketTargets.delete(sink);
  }

  function update(dt = 1 / 60) {
    const safeDt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
    const a = 1 - Math.exp(-safeDt * Math.max(0.01, response));
    state.direction += (target.direction - state.direction) * a;
    state.speed += (target.speed - state.speed) * a;
    state.thrust += (target.thrust - state.thrust) * a;
    state.volatility += (target.volatility - state.volatility) * a;
    state.boost += (target.boost - state.boost) * a;
    if (target.boost > 0) target.boost *= Math.exp(-safeDt * 4.2);
    return state;
  }

  return { presets: PRESETS, target, state, setMarket, setMode, bindMarketTarget, update, getMode: () => mode };
}
