import crypto from 'node:crypto';

const GAME_VERSION = '4.1.0';
const HISTORY_LIMIT = 40;
const DEFAULTS = Object.freeze({
  startingBalance: Math.max(100, Number(process.env.GAME_PAPER_STARTING_BALANCE || 10000)),
  maxRoundMs: Math.max(60_000, Number(process.env.GAME_PAPER_MAX_ROUND_MS || 20 * 60_000)),
  startPriceMaxAgeMs: Math.max(2_000, Number(process.env.GAME_START_PRICE_MAX_AGE_MS || 12_000)),
  decisionMaxAgeMs: Math.max(5_000, Number(process.env.GAME_DECISION_MAX_AGE_MS || 45_000)),
  livePriceMaxAgeMs: Math.max(4_000, Number(process.env.GAME_LIVE_PRICE_MAX_AGE_MS || 15_000)),
  cashoutPriceMaxAgeMs: Math.max(4_000, Number(process.env.GAME_CASHOUT_PRICE_MAX_AGE_MS || 20_000)),
  recentMintPenaltyCount: Math.max(0, Math.min(10, Number(process.env.GAME_RECENT_MINT_PENALTY_COUNT || 3))),
});

const finite = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const now = () => Date.now();
const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;
const tokenPrice = (t) => { const p = finite(t?.priceSol ?? t?.price); return p !== null && p > 0 ? p : null; };
// Only a timestamp tied to an actual accepted price may establish quote freshness.
// Generic token.updatedAt can change because of holders/metadata and must not revive an old price.
const tokenPriceAt = (t) => finite(t?.lastPriceAt ?? t?.priceUpdatedAt ?? t?.lastPriceChangeAt);
const decisionAt = (d) => finite(d?.updatedAt ?? d?.reevaluatedAt ?? d?.decisionUpdatedAt ?? d?.createdAt);
const ageMs = (ts, at = now()) => { const n = finite(ts); return n === null ? null : Math.max(0, at - n); };
const bool = (v) => v === true;

function safeTokenView(token, decision) {
  return {
    mint: token?.mint || decision?.mint || '',
    name: token?.name || decision?.name || null,
    symbol: token?.symbol || decision?.symbol || null,
    score: finite(decision?.score ?? decision?.aiScore),
    confidence: finite(decision?.confidence),
    holderCount: finite(token?.holderCount ?? token?.holders ?? decision?.holderCount),
    top10Pct: finite(token?.top10Pct ?? token?.top10 ?? decision?.top10Pct),
    developerPct: finite(token?.developerPct ?? token?.developerSharePct ?? decision?.developerPct),
    buyPressure: finite(token?.buyPressure ?? token?.momentum ?? decision?.buyPressure),
    liquiditySol: finite(token?.liquiditySol ?? token?.liquidity),
    marketCapSol: finite(token?.marketCapSol ?? token?.marketCap),
    holderFresh: bool(token?.holderFresh),
    source: token?.source || decision?.source || 'MEMEFLOW',
    decisionState: decision?.state || null,
    primaryReason: decision?.primaryReason || null,
  };
}

export class GameEngine {
  constructor(store, options = {}) {
    if (!store?.state) throw new TypeError('GameEngine requires a JsonStore-compatible store.');
    this.store = store;
    this.startingBalance = Math.max(100, finite(options.startingBalance) ?? DEFAULTS.startingBalance);
    this.maxRoundMs = Math.max(60_000, finite(options.maxRoundMs) ?? DEFAULTS.maxRoundMs);
    this.startPriceMaxAgeMs = Math.max(2_000, finite(options.startPriceMaxAgeMs) ?? DEFAULTS.startPriceMaxAgeMs);
    this.decisionMaxAgeMs = Math.max(5_000, finite(options.decisionMaxAgeMs) ?? DEFAULTS.decisionMaxAgeMs);
    this.livePriceMaxAgeMs = Math.max(4_000, finite(options.livePriceMaxAgeMs) ?? DEFAULTS.livePriceMaxAgeMs);
    this.cashoutPriceMaxAgeMs = Math.max(4_000, finite(options.cashoutPriceMaxAgeMs) ?? DEFAULTS.cashoutPriceMaxAgeMs);
    this.recentMintPenaltyCount = Math.max(0, Math.min(10, finite(options.recentMintPenaltyCount) ?? DEFAULTS.recentMintPenaltyCount));
    this.activeByMint = new Map();
    this.listeners = new Map();
    this.lastSelectorByUser = new Map();
    this.ensureRoot();
    this.rebuildActiveIndex();
  }

  ensureRoot() {
    const state = this.store.state;
    state.gamePaper ||= { version: GAME_VERSION, users: {} };
    state.gamePaper.version = GAME_VERSION;
    state.gamePaper.users ||= {};
    return state.gamePaper;
  }

  ensureUser(uid) {
    const root = this.ensureRoot();
    if (!root.users[uid]) {
      root.users[uid] = { balance: this.startingBalance, session: null, history: [], createdAt: now() };
      this.store.save?.();
    }
    const user = root.users[uid];
    const balance = finite(user.balance);
    user.balance = balance === null ? this.startingBalance : Math.max(0, roundMoney(balance));
    if (!Array.isArray(user.history)) user.history = [];
    user.history = user.history.slice(0, HISTORY_LIMIT);
    if (user.session && typeof user.session !== 'object') user.session = null;
    return user;
  }

  rebuildActiveIndex() {
    this.activeByMint.clear();
    for (const [uid, user] of Object.entries(this.ensureRoot().users || {})) {
      const s = user?.session;
      if (s?.state === 'LIVE' && s?.mint) this.indexActive(uid, s.mint);
    }
  }

  indexActive(uid, mint) {
    if (!mint) return;
    if (!this.activeByMint.has(mint)) this.activeByMint.set(mint, new Set());
    this.activeByMint.get(mint).add(uid);
  }

  unindexActive(uid, mint) {
    const users = this.activeByMint.get(mint);
    if (!users) return;
    users.delete(uid);
    if (!users.size) this.activeByMint.delete(mint);
  }

  activeRoundCount() {
    let count = 0;
    for (const users of this.activeByMint.values()) count += users.size;
    return count;
  }

  subscribe(uid, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!this.listeners.has(uid)) this.listeners.set(uid, new Set());
    this.listeners.get(uid).add(callback);
    return () => {
      const set = this.listeners.get(uid);
      set?.delete(callback);
      if (!set?.size) this.listeners.delete(uid);
    };
  }

  emit(uid, type = 'state', payload = null) {
    const set = this.listeners.get(uid);
    if (!set?.size) return;
    const data = payload || (type === 'tick' ? this.tick(uid) : this.status(uid, { sync: false }));
    for (const callback of [...set]) {
      try { callback({ type, ...data }); } catch {}
    }
  }

  selectorDiagnostics(uid) {
    return this.lastSelectorByUser.get(uid) || null;
  }

  pickCandidate(uid) {
    const decisions = this.store.decisions?.(uid) || [];
    const at = now();
    const diag = {
      seen: decisions.length, buyReady: 0, terminal: 0, noMint: 0, noToken: 0,
      noPrice: 0, stalePrice: 0, staleDecision: 0, eligible: 0, selectedMint: null,
    };
    const history = this.ensureUser(uid).history || [];
    const recentMints = new Set(history.slice(0, this.recentMintPenaltyCount).map(x => x?.mint).filter(Boolean));
    const rows = [];

    for (const decision of decisions) {
      if (String(decision?.state || '').toUpperCase() !== 'BUY READY') continue;
      diag.buyReady++;
      if (decision?.terminal === true || String(decision?.lifecycle || '').toLowerCase() === 'closed') { diag.terminal++; continue; }

      const mint = String(decision?.mint || '').trim();
      if (!mint) { diag.noMint++; continue; }
      const token = this.store.state.tokens?.[mint];
      if (!token) { diag.noToken++; continue; }

      const price = tokenPrice(token);
      if (price === null) { diag.noPrice++; continue; }
      const pAt = tokenPriceAt(token);
      const dAt = decisionAt(decision);
      const pAge = ageMs(pAt, at);
      const dAge = ageMs(dAt, at);
      if (pAge === null || pAge > this.startPriceMaxAgeMs) { diag.stalePrice++; continue; }
      if (dAge === null || dAge > this.decisionMaxAgeMs) { diag.staleDecision++; continue; }

      const score = finite(decision?.score ?? decision?.aiScore ?? decision?.priority) ?? 0;
      const pressure = Math.max(0, finite(token?.buyPressure ?? token?.momentum) ?? 0);
      const liq = Math.max(0, finite(token?.liquiditySol ?? token?.liquidity) ?? 0);
      const top10 = Math.max(0, finite(token?.top10Pct ?? token?.top10) ?? 100);
      const dev = Math.max(0, finite(token?.developerPct ?? token?.developerSharePct) ?? 100);
      const completeness = [token?.holderCount, token?.top10Pct, token?.developerPct ?? token?.developerSharePct, token?.buyPressure ?? token?.momentum, token?.liquiditySol ?? token?.liquidity]
        .reduce((sum, v) => sum + (finite(v) !== null ? 1 : 0), 0);
      const repeatPenalty = recentMints.has(mint) ? 5 : 0;
      const selectorScore = score
        + Math.min(pressure, 4) * 1.15
        + Math.min(Math.log10(1 + liq) * 2.2, 4)
        + completeness * 0.55
        + (token?.holderFresh === true ? 1.2 : 0)
        - Math.min(top10 / 18, 4.5)
        - Math.min(dev / 18, 3.5)
        - repeatPenalty
        - Math.min(pAge / 1000, 10) * 0.16;

      rows.push({ decision, token, mint, price, score, selectorScore, priceAt: pAt, decisionAt: dAt, priceAgeMs: pAge, decisionAgeMs: dAge });
      diag.eligible++;
    }

    rows.sort((a, b) =>
      (b.selectorScore - a.selectorScore) ||
      (b.score - a.score) ||
      (a.priceAgeMs - b.priceAgeMs) ||
      (b.decisionAt - a.decisionAt)
    );
    diag.selectedMint = rows[0]?.mint || null;
    this.lastSelectorByUser.set(uid, diag);
    return rows[0] || null;
  }

  validateStart(user, input = {}) {
    const bet = roundMoney(finite(input.bet) ?? finite(input.betAmount) ?? 0);
    const autoCashout = finite(input.autoCashout) ?? 0;
    const stopLoss = finite(input.stopLoss) ?? 0;
    if (!(bet >= 1)) return { ok: false, code: 'INVALID_BET', message: 'Paper stake must be at least $1.' };
    if (bet > user.balance) return { ok: false, code: 'INSUFFICIENT_PAPER_BALANCE', message: 'Paper stake exceeds the virtual balance.' };
    if (autoCashout !== 0 && (autoCashout < 1.01 || autoCashout > 100)) return { ok: false, code: 'INVALID_AUTO_CASHOUT', message: 'Auto cash out must be off or between 1.01× and 100×.' };
    if (stopLoss !== 0 && (stopLoss <= 0 || stopLoss >= 1)) return { ok: false, code: 'INVALID_STOP_LOSS', message: 'Stop loss must be off or below 1.00×.' };
    return { ok: true, bet, autoCashout, stopLoss };
  }

  start(uid, input = {}) {
    const user = this.ensureUser(uid);
    const requestId = String(input.requestId || '').trim().slice(0, 100) || crypto.randomUUID();
    const existing = user.session;

    if (existing?.state === 'LIVE') {
      if (existing.requestId === requestId) return { ok: true, resumed: true, ...this.status(uid) };
      return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Finish the active paper round before starting another.', status: this.status(uid) };
    }
    if (existing?.state === 'COMPLETE') return { ok: false, code: 'ROUND_RESULT_PENDING', message: 'Acknowledge the completed round before starting another.', status: this.status(uid) };

    const checked = this.validateStart(user, input);
    if (!checked.ok) return checked;
    const candidate = this.pickCandidate(uid);
    if (!candidate) return { ok: false, code: 'NO_CANDIDATE', message: 'No fresh BUY READY candidate with a fresh live price is available yet.', selector: this.selectorDiagnostics(uid) };

    const startedAt = now();
    const session = {
      id: crypto.randomBytes(5).toString('hex').toUpperCase(),
      requestId,
      state: 'LIVE',
      mint: candidate.mint,
      token: safeTokenView(candidate.token, candidate.decision),
      bet: checked.bet,
      autoCashout: checked.autoCashout,
      stopLoss: checked.stopLoss,
      entryPrice: candidate.price,
      currentPrice: candidate.price,
      multiplier: 1,
      peak: 1,
      trough: 1,
      maxDrawdownPct: 0,
      startedAt,
      updatedAt: startedAt,
      lastPriceAt: candidate.priceAt,
      priceAtEntryAt: candidate.priceAt,
      decisionAtEntryAt: candidate.decisionAt,
      selectionScore: candidate.selectorScore,
      timeoutPending: false,
      reason: null,
      payout: null,
      profit: null,
      completedAt: null,
      settledPriceAt: null,
    };

    user.balance = roundMoney(Math.max(0, user.balance - checked.bet));
    user.session = session;
    this.indexActive(uid, session.mint);
    this.store.save?.();
    const result = { ok: true, resumed: false, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  updateSessionFromToken(session, token) {
    if (!session || session.state !== 'LIVE') return false;
    const price = tokenPrice(token);
    const pAt = tokenPriceAt(token);
    if (price === null || pAt === null || session.entryPrice <= 0) return false;
    const previousAt = finite(session.lastPriceAt) ?? 0;
    if (pAt < previousAt) return false; // reject out-of-order market snapshots
    const multiplier = Math.max(0, price / session.entryPrice);
    session.currentPrice = price;
    session.multiplier = multiplier;
    session.peak = Math.max(finite(session.peak) ?? 1, multiplier);
    session.trough = Math.min(finite(session.trough) ?? 1, multiplier);
    const drawdown = session.peak > 0 ? Math.max(0, (session.peak - multiplier) / session.peak * 100) : 0;
    session.maxDrawdownPct = Math.max(finite(session.maxDrawdownPct) ?? 0, drawdown);
    session.updatedAt = now();
    session.lastPriceAt = pAt;
    return true;
  }

  syncSession(uid, explicitToken = null) {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session;
    const token = explicitToken?.mint === session.mint ? explicitToken : this.store.state.tokens?.[session.mint];
    this.updateSessionFromToken(session, token);

    // Freshness is based only on a price snapshot the session actually accepted.
    // Unrelated token metadata updates must never make a stale quote look fresh.
    const pAge = ageMs(session.lastPriceAt);
    const fresh = pAge !== null && pAge <= this.livePriceMaxAgeMs;
    const elapsed = now() - Number(session.startedAt || now());

    if (fresh && session.autoCashout > 0 && session.multiplier >= session.autoCashout) return this.settle(uid, 'AUTO_CASH_OUT');
    if (fresh && session.stopLoss > 0 && session.multiplier <= session.stopLoss) return this.settle(uid, 'STOP_LOSS');

    if (elapsed >= this.maxRoundMs) {
      if (fresh) return this.settle(uid, 'ROUND_TIMEOUT');
      session.timeoutPending = true;
    }
    if (session.timeoutPending && fresh) return this.settle(uid, 'ROUND_TIMEOUT');
    return session;
  }

  settle(uid, reason = 'MANUAL_CASH_OUT') {
    const user = this.ensureUser(uid);
    const session = user.session;
    if (!session || session.state !== 'LIVE') return session || null;
    const token = this.store.state.tokens?.[session.mint];
    this.updateSessionFromToken(session, token);

    const multiplier = Math.max(0, finite(session.multiplier) ?? 0);
    const payout = roundMoney(session.bet * multiplier);
    const profit = roundMoney(payout - session.bet);
    session.state = 'COMPLETE';
    session.reason = reason;
    session.payout = payout;
    session.profit = profit;
    session.completedAt = now();
    session.updatedAt = session.completedAt;
    session.settledPriceAt = finite(session.lastPriceAt);
    user.balance = roundMoney(user.balance + payout);
    user.history.unshift(this.historyRow(session));
    user.history = user.history.slice(0, HISTORY_LIMIT);
    this.unindexActive(uid, session.mint);
    this.store.save?.();
    this.emit(uid, 'state', { ...this.status(uid, { sync: false }) });
    return session;
  }

  cashout(uid) {
    const user = this.ensureUser(uid);
    if (!user.session || user.session.state !== 'LIVE') return { ok: false, code: 'NO_ACTIVE_ROUND', message: 'There is no live paper round to cash out.', status: this.status(uid) };
    this.syncSession(uid);
    if (user.session.state !== 'LIVE') return { ok: true, ...this.status(uid, { sync: false }) };
    const pAge = ageMs(user.session.lastPriceAt);
    if (pAge === null || pAge > this.cashoutPriceMaxAgeMs) {
      return { ok: false, code: 'PRICE_STALE', message: 'The latest MEMEFLOW price is stale. Cash out unlocks automatically when a fresh quote arrives.', status: this.status(uid, { sync: false }) };
    }
    this.settle(uid, 'MANUAL_CASH_OUT');
    return { ok: true, ...this.status(uid, { sync: false }) };
  }

  reset(uid) {
    const user = this.ensureUser(uid);
    if (user.session?.state === 'LIVE') return { ok: false, code: 'ACTIVE_ROUND_EXISTS', message: 'Cash out the active round before resetting.', status: this.status(uid) };
    user.session = null;
    this.store.save?.();
    const result = { ok: true, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  clearHistory(uid) {
    const user = this.ensureUser(uid);
    user.history = [];
    this.store.save?.();
    const result = { ok: true, ...this.status(uid, { sync: false }) };
    this.emit(uid, 'state', result);
    return result;
  }

  publicSession(session) {
    // lastPriceAt advances only after updateSessionFromToken accepts a valid,
    // monotonic market price. It is therefore the authoritative quote timestamp.
    const latestPriceAt = finite(session.lastPriceAt);
    const priceAgeMs = latestPriceAt !== null ? Math.max(0, now() - latestPriceAt) : null;
    const decisionAgeMs = session.decisionAtEntryAt ? Math.max(0, session.startedAt - session.decisionAtEntryAt) : null;
    const feedFresh = priceAgeMs !== null && priceAgeMs <= this.livePriceMaxAgeMs;
    const canCashout = session.state === 'LIVE' && priceAgeMs !== null && priceAgeMs <= this.cashoutPriceMaxAgeMs;
    const drawdownPct = session.peak > 0 ? Math.max(0, (session.peak - session.multiplier) / session.peak * 100) : 0;
    return {
      id: session.id, state: session.state, mint: session.mint, token: session.token,
      bet: session.bet, autoCashout: session.autoCashout, stopLoss: session.stopLoss,
      entryPrice: session.entryPrice, currentPrice: session.currentPrice, multiplier: session.multiplier,
      peak: session.peak, trough: session.trough, drawdownPct, maxDrawdownPct: session.maxDrawdownPct,
      startedAt: session.startedAt, updatedAt: session.updatedAt, completedAt: session.completedAt,
      reason: session.reason, payout: session.payout, profit: session.profit,
      latestPriceAt, priceAgeMs, decisionAgeMs, feedFresh, canCashout,
      timeoutPending: session.timeoutPending === true,
      selectionScore: session.selectionScore ?? null,
      settledPriceAt: session.settledPriceAt ?? null,
    };
  }

  tick(uid) {
    const user = this.ensureUser(uid);
    const session = user.session ? this.publicSession(user.session) : null;
    return { version: GAME_VERSION, paperOnly: true, balance: roundMoney(user.balance), session, serverTime: now() };
  }

  status(uid, options = {}) {
    const sync = options.sync !== false;
    const user = this.ensureUser(uid);
    if (sync) this.syncSession(uid);
    const session = user.session ? this.publicSession(user.session) : null;
    return {
      version: GAME_VERSION,
      paperOnly: true,
      balance: roundMoney(user.balance),
      session,
      history: user.history.slice(0, HISTORY_LIMIT),
      selector: this.selectorDiagnostics(uid),
      activeRounds: this.activeRoundCount(),
      limits: {
        maxRoundMs: this.maxRoundMs,
        startPriceMaxAgeMs: this.startPriceMaxAgeMs,
        decisionMaxAgeMs: this.decisionMaxAgeMs,
        livePriceMaxAgeMs: this.livePriceMaxAgeMs,
        cashoutPriceMaxAgeMs: this.cashoutPriceMaxAgeMs,
      },
      serverTime: now(),
    };
  }

  health() {
    return { ok: true, version: GAME_VERSION, paperOnly: true, activeRounds: this.activeRoundCount(), listeners: [...this.listeners.values()].reduce((n, s) => n + s.size, 0) };
  }

  onTokenUpdate(mint, token) {
    const users = this.activeByMint.get(mint);
    if (!users?.size) return 0;
    let updated = 0;
    for (const uid of [...users]) {
      const before = this.ensureUser(uid).session?.state;
      this.syncSession(uid, token);
      const after = this.ensureUser(uid).session?.state;
      updated++;
      if (after === 'LIVE') this.emit(uid, 'tick');
      // A LIVE -> COMPLETE transition is emitted by settle() itself, so do not duplicate it here.
    }
    return updated;
  }

  historyRow(session) {
    const durationMs = session.completedAt && session.startedAt ? Math.max(0, session.completedAt - session.startedAt) : null;
    const roiPct = session.bet > 0 ? (session.profit / session.bet) * 100 : 0;
    return {
      id: session.id,
      symbol: session.token?.symbol || session.token?.name || 'TOKEN',
      mint: session.mint,
      reason: session.reason,
      stake: session.bet,
      payout: session.payout,
      profit: session.profit,
      roiPct,
      multiplier: session.multiplier,
      peak: session.peak,
      maxDrawdownPct: session.maxDrawdownPct ?? null,
      durationMs,
      at: session.completedAt,
    };
  }
}
