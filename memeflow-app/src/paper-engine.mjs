import crypto from 'node:crypto';

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const lower = (value, fallback = '') => String(value ?? fallback).trim().toLowerCase();

const nowIso = () => new Date().toISOString();

export class PaperEngine {
  constructor(store, options = {}) {
    if (!store?.state || typeof store.save !== 'function') {
      throw new TypeError('PaperEngine requires a JsonStore-compatible instance');
    }
    this.store = store;
    this.clock = options.clock || (() => Date.now());
    this.ensureState();
  }

  ensureState() {
    const s = this.store.state;
    s.paperPositions ||= {};
    s.paperTrades ||= {};
    s.paperProposals ||= {};
    s.paperProcessed ||= {};
    s.paperMetrics ||= { entries: 0, exits: 0, errors: 0 };
  }

  save() {
    this.ensureState();
    this.store.save();
  }

  mode(settings = {}) {
    return lower(settings.operatingMode || settings.mode || 'observe');
  }

  environment(settings = {}) {
    return lower(settings.tradingEnvironment || settings.environment || 'paper');
  }

  settings(settings = {}) {
    return {
      ...settings,
      operatingMode: this.mode(settings),
      tradingEnvironment: this.environment(settings),
      positionSize: num(settings.positionSize, 0.1),
      maxPositionSize: num(settings.maxPositionSize, 0.5),
      maxOpenPositions: Math.max(0, Math.floor(num(settings.maxOpenPositions, 4))),
      maxDailyEntries: Math.max(0, Math.floor(num(settings.maxDailyEntries, 10))),
      dailySpendLimit: Math.max(0, num(settings.dailySpendLimit, 0)),
      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      hardStopPct: Math.max(0, num(settings.hardStopPct ?? settings.stopLoss, 25)),
      trailingStopPct: Math.max(0, num(settings.trailingStopPct ?? settings.trailingStop, 15)),
      tp1Pct: Math.max(0, num(settings.tp1Pct ?? settings.tp1, 100)),
      tp1SellPct: Math.max(0, Math.min(100, num(settings.tp1SellPct ?? settings.tp1Sell, 50))),
      tp2Pct: Math.max(0, num(settings.tp2Pct ?? settings.tp2, 200)),
      tp2SellPct: Math.max(0, Math.min(100, num(settings.tp2SellPct ?? settings.tp2Sell, 25))),
      runnerPct: Math.max(0, Math.min(100, num(settings.runnerPct ?? settings.runnerSize, 25))),
      maxHoldMinutes: Math.max(1, num(settings.maxHoldMinutes, 1440)),
      exitBuyPressure: Math.max(0, num(settings.exitBuyPressure, 1.0)),
    };
  }

  userPositions(userId, status = null) {
    return Object.values(this.store.state.paperPositions)
      .filter(p => p.userId === userId && (!status || p.status === status))
      .sort((a, b) => b.openedAtMs - a.openedAtMs);
  }

  userTrades(userId) {
    return Object.values(this.store.state.paperTrades)
      .filter(t => t.userId === userId)
      .sort((a, b) => b.executedAtMs - a.executedAtMs);
  }

  userProposals(userId) {
    return Object.values(this.store.state.paperProposals)
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  dailyEntries(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userPositions(userId).filter(p => p.openedAt.slice(0, 10) === day).length;
  }

  dailySpent(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userPositions(userId)
      .filter(p => p.openedAt.slice(0, 10) === day)
      .reduce((sum, p) => sum + num(p.initialSizeSol), 0);
  }

  dailyRealizedPnl(userId, timestamp = this.clock()) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    return this.userTrades(userId)
      .filter(t => t.executedAt.slice(0, 10) === day)
      .reduce((sum, t) => sum + num(t.realizedPnlSol), 0);
  }

  openForMint(userId, mint) {
    return this.userPositions(userId, 'OPEN').find(p => p.mint === mint) || null;
  }

  canEnter(userId, token, settings) {
    const s = this.settings(settings);
    const price = num(token?.priceSol, NaN);
    if (!Number.isFinite(price) || price <= 0) return { ok: false, code: 'INVALID_PRICE' };
    if (token?.holderFresh === false) return { ok: false, code: 'STALE_TOKEN_DATA' };
    if (this.openForMint(userId, token.mint)) return { ok: false, code: 'POSITION_EXISTS' };
    if (this.userPositions(userId, 'OPEN').length >= s.maxOpenPositions) return { ok: false, code: 'MAX_OPEN_POSITIONS' };
    if (this.dailyEntries(userId) >= s.maxDailyEntries) return { ok: false, code: 'MAX_DAILY_ENTRIES' };
    if (s.positionSize <= 0 || s.positionSize > s.maxPositionSize) return { ok: false, code: 'INVALID_POSITION_SIZE' };
    if (s.dailySpendLimit > 0 && this.dailySpent(userId) + s.positionSize > s.dailySpendLimit) return { ok: false, code: 'DAILY_SPEND_LIMIT' };
    if (s.tradingCapital > 0) {
      const deployed = this.userPositions(userId, 'OPEN').reduce((sum, p) => sum + num(p.remainingSizeSol), 0);
      if (deployed + s.positionSize > s.tradingCapital) return { ok: false, code: 'PAPER_CAPITAL_LIMIT' };
    }
    if (s.dailyLossLimit > 0 && this.dailyRealizedPnl(userId) <= -s.dailyLossLimit) return { ok: false, code: 'DAILY_LOSS_LIMIT' };
    const user = this.store.state.users?.[userId];
    if (user?.killSwitch) return { ok: false, code: 'KILL_SWITCH' };
    return { ok: true };
  }

  decisionKey(userId, token, decision) {
    const revision = decision.updatedAt || decision.decisionUpdatedAt || token.updatedAt || this.clock();
    return `${userId}:${token.mint}:${revision}`;
  }

  onDecision(userId, token, decision, rawSettings = {}) {
    this.ensureState();
    const settings = this.settings(rawSettings);
    if (!userId || !token?.mint || decision?.state !== 'BUY READY') return { action: 'NONE' };
    if (settings.tradingEnvironment !== 'paper') return { action: 'NONE', reason: 'NOT_PAPER' };

    const key = this.decisionKey(userId, token, decision);
    if (this.store.state.paperProcessed[key]) return { action: 'NONE', reason: 'IDEMPOTENT' };

    if (settings.operatingMode === 'observe') {
      this.store.state.paperProcessed[key] = { result: 'OBSERVED', at: nowIso() };
      this.save();
      return { action: 'OBSERVED' };
    }

    if (settings.operatingMode === 'assist') {
      const existing = Object.values(this.store.state.paperProposals).find(p => p.idempotencyKey === key);
      if (existing) return { action: 'PROPOSAL_EXISTS', proposal: existing };
      const proposal = {
        id: crypto.randomUUID(),
        idempotencyKey: key,
        userId,
        mint: token.mint,
        name: token.name || token.symbol || token.mint.slice(0, 6),
        symbol: token.symbol || 'TOKEN',
        status: 'PENDING',
        mode: 'paper',
        createdAt: nowIso(),
        createdAtMs: this.clock(),
        proposedPriceSol: num(token.priceSol, null),
        proposedSizeSol: settings.positionSize,
        decisionScore: decision.score ?? null,
        decisionConfidence: decision.confidence ?? null,
        primaryReason: decision.primaryReason || null,
      };
      this.store.state.paperProposals[proposal.id] = proposal;
      this.store.state.paperProcessed[key] = { result: 'PROPOSED', proposalId: proposal.id, at: nowIso() };
      this.save();
      return { action: 'PROPOSED', proposal };
    }

    if (settings.operatingMode === 'automate') {
      const result = this.openPosition(userId, token, decision, settings, key);
      this.store.state.paperProcessed[key] = {
        result: result.ok ? 'OPENED' : 'REJECTED',
        code: result.code || null,
        positionId: result.position?.id || null,
        at: nowIso(),
      };
      this.save();
      return result.ok ? { action: 'OPENED', position: result.position } : { action: 'REJECTED', reason: result.code };
    }

    return { action: 'NONE', reason: 'UNKNOWN_MODE' };
  }

  openPosition(userId, token, decision, rawSettings = {}, idempotencyKey = null) {
    const settings = this.settings(rawSettings);
    const gate = this.canEnter(userId, token, settings);
    if (!gate.ok) return gate;

    const price = num(token.priceSol);
    const size = settings.positionSize;
    const quantity = size / price;
    const timestamp = this.clock();
    const position = {
      id: crypto.randomUUID(),
      idempotencyKey,
      userId,
      mint: token.mint,
      name: token.name || token.symbol || token.mint.slice(0, 6),
      symbol: token.symbol || 'TOKEN',
      status: 'OPEN',
      mode: 'paper',
      openedAt: new Date(timestamp).toISOString(),
      openedAtMs: timestamp,
      closedAt: null,
      closedAtMs: null,
      entryPriceSol: price,
      currentPriceSol: price,
      exitPriceSol: null,
      initialSizeSol: size,
      remainingSizeSol: size,
      initialTokenQuantity: quantity,
      remainingTokenQuantity: quantity,
      realizedPnlSol: 0,
      unrealizedPnlSol: 0,
      realizedPnlPct: 0,
      unrealizedPnlPct: 0,
      highestPriceSol: price,
      trailingStopPriceSol: null,
      closeReason: null,
      decisionScore: decision?.score ?? null,
      decisionConfidence: decision?.confidence ?? null,
      sourceDecisionId: decision?.id || token.mint,
      primaryReason: decision?.primaryReason || null,
      tp1Executed: false,
      tp2Executed: false,
      takeProfitHistory: [],
      settingsSnapshot: settings,
    };
    this.store.state.paperPositions[position.id] = position;
    this.store.state.paperMetrics.entries++;
    this.recordTrade(position, 'BUY', quantity, price, 0, 'AUTOMATIC PAPER ENTRY');
    this.save();
    return { ok: true, position };
  }

  approveProposal(userId, proposalId, token) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };
    const user = this.store.state.users[userId];
    const liveToken = token || this.store.state.tokens[proposal.mint];
    const result = this.openPosition(userId, liveToken, {
      state: 'BUY READY',
      score: proposal.decisionScore,
      confidence: proposal.decisionConfidence,
      primaryReason: proposal.primaryReason,
    }, user?.settings || {}, proposal.idempotencyKey);
    if (!result.ok) return result;
    proposal.status = 'APPROVED';
    proposal.resolvedAt = nowIso();
    proposal.positionId = result.position.id;
    this.save();
    return result;
  }

  rejectProposal(userId, proposalId) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };
    proposal.status = 'REJECTED';
    proposal.resolvedAt = nowIso();
    this.save();
    return { ok: true, proposal };
  }

  onTokenUpdate(mint, token) {
    this.ensureState();
    if (!mint || !token) return;
    const price = num(token.priceSol, NaN);
    if (!Number.isFinite(price) || price <= 0) return;
    const open = Object.values(this.store.state.paperPositions).filter(p => p.status === 'OPEN' && p.mint === mint);
    for (const position of open) this.updatePosition(position, token);
    if (open.length) this.save();
  }

  updatePosition(position, token) {
    const price = num(token.priceSol);
    const settings = this.settings(position.settingsSnapshot || {});
    position.currentPriceSol = price;
    position.highestPriceSol = Math.max(num(position.highestPriceSol, price), price);
    position.unrealizedPnlSol = position.remainingTokenQuantity * (price - position.entryPriceSol);
    position.unrealizedPnlPct = position.entryPriceSol > 0 ? ((price / position.entryPriceSol) - 1) * 100 : 0;

    const profitPct = position.unrealizedPnlPct;
    if (profitPct > 0 && settings.trailingStopPct > 0) {
      position.trailingStopPriceSol = position.highestPriceSol * (1 - settings.trailingStopPct / 100);
    }

    if (!position.tp1Executed && profitPct >= settings.tp1Pct) {
      const qty = Math.min(position.remainingTokenQuantity, position.initialTokenQuantity * settings.tp1SellPct / 100);
      if (qty > 0) {
        this.partialExit(position, qty, price, 'TP1');
        position.tp1Executed = true;
      }
    }

    if (position.status === 'OPEN' && !position.tp2Executed && profitPct >= settings.tp2Pct) {
      const qty = Math.min(position.remainingTokenQuantity, position.initialTokenQuantity * settings.tp2SellPct / 100);
      if (qty > 0) {
        this.partialExit(position, qty, price, 'TP2');
        position.tp2Executed = true;
      }
    }

    if (position.status !== 'OPEN') return;

    if (profitPct <= -settings.hardStopPct) {
      this.closePositionInternal(position, price, 'HARD STOP');
      return;
    }

    if (position.trailingStopPriceSol && price <= position.trailingStopPriceSol) {
      this.closePositionInternal(position, price, 'TRAILING STOP');
      return;
    }

    const heldMinutes = (this.clock() - position.openedAtMs) / 60000;
    if (heldMinutes >= settings.maxHoldMinutes) {
      this.closePositionInternal(position, price, 'MAX HOLD TIME');
      return;
    }

    const pressure = Number(token.buyPressure);
    if (Number.isFinite(pressure) && pressure < settings.exitBuyPressure) {
      this.closePositionInternal(position, price, 'BUY PRESSURE EXIT');
    }
  }

  partialExit(position, quantity, price, reason) {
    if (position.status !== 'OPEN' || quantity <= 0) return;
    quantity = Math.min(quantity, position.remainingTokenQuantity);
    const cost = quantity * position.entryPriceSol;
    const value = quantity * price;
    const pnl = value - cost;
    position.remainingTokenQuantity -= quantity;
    position.remainingSizeSol = position.remainingTokenQuantity * position.entryPriceSol;
    position.realizedPnlSol += pnl;
    position.realizedPnlPct = position.initialSizeSol > 0 ? position.realizedPnlSol / position.initialSizeSol * 100 : 0;
    position.takeProfitHistory.push({ reason, price, quantity, valueSol: value, realizedPnlSol: pnl, at: nowIso() });
    this.recordTrade(position, 'SELL', quantity, price, pnl, reason);
    if (position.remainingTokenQuantity <= 1e-15) this.finalizePosition(position, price, reason);
  }

  closePosition(userId, positionId, reason = 'MANUAL PAPER CLOSE') {
    const position = this.store.state.paperPositions[positionId];
    if (!position || position.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (position.status !== 'OPEN') return { ok: false, code: 'POSITION_NOT_OPEN' };
    const price = num(position.currentPriceSol, position.entryPriceSol);
    this.closePositionInternal(position, price, reason);
    this.save();
    return { ok: true, position };
  }

  closePositionInternal(position, price, reason) {
    if (position.status !== 'OPEN') return;
    const qty = position.remainingTokenQuantity;
    if (qty > 0) {
      const pnl = qty * (price - position.entryPriceSol);
      position.realizedPnlSol += pnl;
      this.recordTrade(position, 'SELL', qty, price, pnl, reason);
    }
    position.remainingTokenQuantity = 0;
    position.remainingSizeSol = 0;
    this.finalizePosition(position, price, reason);
  }

  finalizePosition(position, price, reason) {
    position.status = 'CLOSED';
    position.exitPriceSol = price;
    position.currentPriceSol = price;
    position.closedAtMs = this.clock();
    position.closedAt = new Date(position.closedAtMs).toISOString();
    position.closeReason = reason;
    position.unrealizedPnlSol = 0;
    position.unrealizedPnlPct = 0;
    position.realizedPnlPct = position.initialSizeSol > 0 ? position.realizedPnlSol / position.initialSizeSol * 100 : 0;
    this.store.state.paperMetrics.exits++;
  }

  recordTrade(position, side, quantity, price, realizedPnlSol, reason) {
    const timestamp = this.clock();
    const trade = {
      id: crypto.randomUUID(),
      userId: position.userId,
      positionId: position.id,
      mint: position.mint,
      symbol: position.symbol,
      mode: 'paper',
      simulated: true,
      side,
      quantity,
      priceSol: price,
      valueSol: quantity * price,
      realizedPnlSol,
      reason,
      executedAtMs: timestamp,
      executedAt: new Date(timestamp).toISOString(),
    };
    this.store.state.paperTrades[trade.id] = trade;
    return trade;
  }

  status(userId) {
    const user = this.store.state.users[userId];
    const settings = this.settings(user?.settings || {});
    return {
      environment: settings.tradingEnvironment,
      operatingMode: settings.operatingMode,
      paperAutomationActive: settings.tradingEnvironment === 'paper' && settings.operatingMode === 'automate',
      openPositions: this.userPositions(userId, 'OPEN').length,
      closedPositions: this.userPositions(userId, 'CLOSED').length,
      pendingProposals: this.userProposals(userId).filter(p => p.status === 'PENDING').length,
      realizedPnlSol: this.userPositions(userId).reduce((sum, p) => sum + num(p.realizedPnlSol), 0),
      simulated: true,
      walletRequired: false,
      proRequired: false,
    };
  }
}
