(() => {
  const STREAM_URL = '/api/game/stream';

  let source = null;
  let lastEventSeq = null;
  let lastTerminalKey = null;

  function game() {
    return window.MemeFlowGame || null;
  }

  function applyMarketTick(payload = {}) {
    const api = game();
    if (!api?.priceTick) return;

    api.priceTick({
      multiplier: payload.multiplier,
      price:
        payload.currentPrice ??
        payload.price ??
        null,
      pnlPct: payload.pnlPct,
      source: 'external'
    });
  }

  function applyTerminalState(payload = {}) {
    if (payload.state !== 'COMPLETE') return;

    const api = game();
    if (!api) return;

    const reason = String(payload.reason || '');
    const terminalKey =
      String(payload.eventSeq || '') +
      ':' +
      reason +
      ':' +
      String(payload.settledPriceAt || '');

    if (terminalKey === lastTerminalKey) return;
    lastTerminalKey = terminalKey;

    switch (reason) {
      case 'AUTO_CASH_OUT':
        api.targetHit?.();
        break;

      case 'STOP_LOSS':
        api.stopLossHit?.();
        break;

      case 'MANUAL_CASH_OUT':
        api.cashOut?.();
        break;

      case 'ROUND_TIMEOUT':
        api.roundCrash?.();
        break;

      case 'MARKET_DATA_LOST_REFUND':
        api.cancel?.();
        break;

      default:
        console.warn(
          '[GAME SSE] unmapped terminal reason:',
          reason,
          payload
        );
        api.cancel?.();
        break;
    }
  }

  function handlePayload(payload = {}) {
    if (
      payload.eventSeq != null &&
      payload.eventSeq === lastEventSeq
    ) {
      return;
    }

    if (payload.eventSeq != null) {
      lastEventSeq = payload.eventSeq;
    }

    if (
      payload.type === 'tick' ||
      payload.state === 'LIVE'
    ) {
      applyMarketTick(payload);
    }

    applyTerminalState(payload);
  }

  function connect() {
    if (source) return;

    source = new EventSource(STREAM_URL);

    source.addEventListener('snapshot', event => {
      try {
        handlePayload(JSON.parse(event.data));
      } catch (error) {
        console.warn('[GAME SSE] snapshot parse failed', error);
      }
    });

    source.addEventListener('tick', event => {
      try {
        handlePayload(JSON.parse(event.data));
      } catch (error) {
        console.warn('[GAME SSE] tick parse failed', error);
      }
    });

    source.addEventListener('state', event => {
      try {
        handlePayload(JSON.parse(event.data));
      } catch (error) {
        console.warn('[GAME SSE] state parse failed', error);
      }
    });

    source.onopen = () => {
      console.log('[GAME SSE] connected');
      game()?.feedRestored?.();
    };

    source.onerror = () => {
      console.warn('[GAME SSE] connection interrupted');
      game()?.feedLost?.();
    };
  }

  function disconnect() {
    source?.close();
    source = null;
  }

  window.MemeFlowGameLiveFeed = {
    connect,
    disconnect,
    get connected() {
      return Boolean(source);
    }
  };

  connect();
})();
