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

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Optional platform-wide anonymized analytics sink.
    // It NEVER participates in entry/exit decisions.
    this.analytics = options.analytics || null;

    this.ensureState();

    // MEMEFLOW_PAPER_POSITION_CHECKPOINT_V55
    // Price/PnL/high/trailing remain live in memory on every TradeEvent.
    // Ordinary mark-to-market persistence is bounded so an active position
    // cannot drive full state.json durability on every hot market tick.
    this.positionCheckpointMs = Math.max(
      250,
      num(
        options.positionCheckpointMs ??
        process.env.PAPER_POSITION_CHECKPOINT_MS,
        1000
      )
    );
    this._lastPositionCheckpointAtV55 = this.clock();

    // MEMEFLOW_PAPER_PROCESSED_RUNTIME_V56
    // paperProcessed stays an object for compatibility with the existing
    // PaperEngine API, but is a bounded same-runtime replay cache only.
    this.paperProcessedMaxEntries = Math.max(
      16,
      Math.floor(
        num(
          options.paperProcessedMaxEntries ??
          process.env.PAPER_PROCESSED_MAX_ENTRIES,
          20000
        )
      )
    );

    this.paperProcessedTrimTo = Math.max(
      8,
      Math.min(
        this.paperProcessedMaxEntries - 1,
        Math.floor(this.paperProcessedMaxEntries * 0.75)
      )
    );
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

  _checkpointOpenPositionStateV55(force = false) {
    const now = this.clock();

    if (
      force !== true &&
      now - this._lastPositionCheckpointAtV55 <
        this.positionCheckpointMs
    ) {
      return false;
    }

    this._lastPositionCheckpointAtV55 = now;
    this.save();
    return true;
  }

  _recordPaperProcessedV56(key, value) {
    const cache = this.store.state.paperProcessed;
    cache[key] = value;

    const entries = Object.entries(cache);

    if (entries.length <= this.paperProcessedMaxEntries) {
      return value;
    }

    // Trimming happens only when capacity is crossed, then removes a full
    // quarter of the cache so hot traffic cannot trigger an O(N log N) sort on
    // every following decision.
    entries.sort((a, b) => {
      const at = Date.parse(a[1]?.at || '') || 0;
      const bt = Date.parse(b[1]?.at || '') || 0;
      return at - bt;
    });

    const removeCount = Math.max(
      0,
      entries.length - this.paperProcessedTrimTo
    );

    for (let i = 0; i < removeCount; i++) {
      delete cache[entries[i][0]];
    }

    return value;
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
      exitOnWeakBuyPressure: settings.exitOnWeakBuyPressure !== false,
      decisionFreshnessSec: Math.max(5, num(settings.decisionFreshnessSec, 60)),
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

  entryReadiness(userId, token, settings) {
    const s = this.settings(settings);
    const now = this.clock();

    // MEMEFLOW_MAYHEM_PAPER_GATE_V17
    const mayhemBlocked =
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem';

    const price = num(token?.priceSol, NaN);
    const tokenUpdatedAt = Number(token?.updatedAt || token?.lastPriceAt || 0);

    const openPositions = this.userPositions(userId, 'OPEN');
    const existingPosition = this.openForMint(userId, token?.mint);
    const dailyEntries = this.dailyEntries(userId, now);
    const dailySpent = this.dailySpent(userId, now);
    const dailyRealizedPnl = this.dailyRealizedPnl(userId, now);
    const deployed = openPositions.reduce(
      (sum, position) => sum + num(position.remainingSizeSol),
      0
    );

    const priceReady = Number.isFinite(price) && price > 0;

    const holderFresh = token?.holderFresh === true;
    const timestampKnown = Number.isFinite(tokenUpdatedAt) && tokenUpdatedAt > 0;
    const decisionFresh =
      timestampKnown &&
      (
        s.decisionFreshnessSec <= 0 ||
        now - tokenUpdatedAt <= s.decisionFreshnessSec * 1000
      );

    const dataFresh = holderFresh && decisionFresh;

    const positionSizeValid =
      s.positionSize > 0 &&
      s.positionSize <= s.maxPositionSize;

    const dailySpendAvailable =
      s.dailySpendLimit <= 0 ||
      dailySpent + s.positionSize <= s.dailySpendLimit;

    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;

    const user = this.store.state.users?.[userId];
    const lossLimitClear =
      s.dailyLossLimit <= 0 ||
      dailyRealizedPnl > -s.dailyLossLimit;

    const killSwitchClear = user?.killSwitch !== true;

    const checks = [
      {
        key: 'mayhemHardBlock',
        name: 'Mayhem mode prohibited',
        pass: !mayhemBlocked,
        code: 'MAYHEM_MODE_BLOCKED'
      },
      {
        key: 'validPrice',
        name: 'Valid price',
        pass: priceReady,
        code: 'INVALID_PRICE'
      },
      {
        key: 'freshData',
        name: 'Fresh token data',
        pass: dataFresh,
        code: holderFresh
          ? 'STALE_DECISION'
          : 'STALE_TOKEN_DATA'
      },
      {
        key: 'noExistingPosition',
        name: 'No existing position',
        pass: !existingPosition,
        code: 'POSITION_EXISTS'
      },
      {
        key: 'positionCapacity',
        name: 'Position capacity',
        pass: openPositions.length < s.maxOpenPositions,
        code: 'MAX_OPEN_POSITIONS'
      },
      {
        key: 'dailyEntries',
        name: 'Daily entries available',
        pass: dailyEntries < s.maxDailyEntries,
        code: 'MAX_DAILY_ENTRIES'
      },
      {
        key: 'positionSize',
        name: 'Position size valid',
        pass: positionSizeValid,
        code: 'INVALID_POSITION_SIZE'
      },
      {
        key: 'dailySpend',
        name: 'Daily spend available',
        pass: dailySpendAvailable,
        code: 'DAILY_SPEND_LIMIT'
      },
      {
        key: 'paperCapital',
        name: 'Paper capital available',
        pass: capitalAvailable,
        code: 'PAPER_CAPITAL_LIMIT'
      },
      {
        key: 'safetyControls',
        name: 'Safety controls clear',
        pass: lossLimitClear && killSwitchClear,
        code: !killSwitchClear ? 'KILL_SWITCH' : 'DAILY_LOSS_LIMIT'
      }
    ];

    return {
      ok: checks.every(check => check.pass),
      checks,
      metrics: {
        openPositions: openPositions.length,
        maxOpenPositions: s.maxOpenPositions,
        dailyEntries,
        maxDailyEntries: s.maxDailyEntries,
        dailySpent,
        dailySpendLimit: s.dailySpendLimit,
        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,
        dailyLossLimit: s.dailyLossLimit,
        positionSize: s.positionSize,
        maxPositionSize: s.maxPositionSize,
        holderFresh,
        tokenUpdatedAt: timestampKnown ? tokenUpdatedAt : null,
        decisionFreshnessSec: s.decisionFreshnessSec,
        killSwitch: user?.killSwitch === true
      }
    };
  }

  canEnter(userId, token, settings) {
    const readiness = this.entryReadiness(userId, token, settings);
    const failed = readiness.checks.find(check => !check.pass);

    if (failed) {
      return {
        ok: false,
        code: failed.code
      };
    }

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

    // MEMEFLOW_MAYHEM_DECISION_GATE_V17
    if (
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem'
    ) {
      return {
        action: 'REJECTED',
        reason: 'MAYHEM_MODE_BLOCKED'
      };
    }
    if (settings.tradingEnvironment !== 'paper') return { action: 'NONE', reason: 'NOT_PAPER' };

    // AUTOMATE + PAPER means automatic paper execution. Repeated BUY READY
    // revisions for a token that already has an open position are ignored
    // before creating extra paperProcessed rows.
    if (settings.operatingMode === 'automate') {
      const existingPosition = this.openForMint(userId, token.mint);
      if (existingPosition) {
        return { action: 'NONE', reason: 'POSITION_EXISTS', position: existingPosition };
      }
    }

    // OBSERVE is intentionally read-only. Seeing BUY READY while paused must
    // never consume the decision or prevent a later ASSIST/AUTOMATE entry.
    if (settings.operatingMode === 'observe') {
      return { action: 'OBSERVED' };
    }

    const key = this.decisionKey(userId, token, decision);
    const processed = this.store.state.paperProcessed[key];

    // Compatibility with older builds that persisted OBSERVED decisions.
    // OBSERVED is not an execution result, so it must not block a later entry.
    if (processed && processed.result !== 'OBSERVED') {
      return { action: 'NONE', reason: 'IDEMPOTENT' };
    }

    if (settings.operatingMode === 'assist') {
      const existing = Object.values(this.store.state.paperProposals).find(
        p => p.userId === userId && p.mint === token.mint && p.status === 'PENDING'
      );
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
      this._recordPaperProcessedV56(
        key,
        {
          result: 'PROPOSED',
          proposalId: proposal.id,
          at: nowIso()
        }
      );
      this.save();
      return { action: 'PROPOSED', proposal };
    }

    if (settings.operatingMode === 'automate') {
      const result = this.openPosition(userId, token, decision, settings, key);
      this._recordPaperProcessedV56(
        key,
        {
          result: result.ok ? 'OPENED' : 'REJECTED',
          code: result.code || null,
          positionId: result.position?.id || null,
          at: nowIso(),
        }
      );
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
      strategySource: decision?.strategySource || null,
      copyTradingWallet: decision?.copyTradingWallet || null,
      copyTradingSource: decision?.copyTradingSource || null,
      tp1Executed: false,
      tp2Executed: false,
      takeProfitHistory: [],
      settingsSnapshot: settings,

      // MEMEFLOW_PLATFORM_LEARNING_V2
      // Market state frozen at the exact entry moment.
      entrySnapshot: {
        marketCapUsd:
          num(
            token?.marketCapUsd ??
            token?.marketCap,
            null
          ),

        liquidityUsd:
          num(token?.liquidityUsd,null),

        holders:
          num(
            token?.holderCount ??
            token?.holders,
            null
          ),

        top10Pct:
          num(
            token?.top10Pct ??
            token?.top10,
            null
          ),

        developerPct:
          num(
            token?.developerPct ??
            token?.developerSharePct,
            null
          ),

        buyPressure:
          num(token?.buyPressure,null),

        bundlePct:
          num(token?.bundlePct,null),

        sniperPct:
          num(token?.sniperPct,null),

        riskyWalletsPct:
          num(
            token?.suspectedRiskyWalletsPct,
            null
          ),

        insidersPct:
          num(token?.insidersPct,null)
      },
    };

    this.store.state.paperPositions[position.id] = position;

    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
    this.store.state.paperMetrics.entries++;
    this.recordTrade(position, 'BUY', quantity, price, 0, decision?.entryReason || 'AUTOMATIC PAPER ENTRY');
    this.save();
    return { ok: true, position };
  }

  approveProposal(userId, proposalId, token) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };
    const user = this.store.state.users[userId];
    const settings = this.settings(user?.settings || {});
    if (settings.decisionFreshnessSec > 0 && this.clock() - Number(proposal.createdAtMs || 0) > settings.decisionFreshnessSec * 1000) {
      proposal.status = 'EXPIRED';proposal.resolvedAt = nowIso();this.save();return { ok: false, code: 'STALE_PROPOSAL' };
    }
    const liveToken = token || this.store.state.tokens[proposal.mint];
    const result = this.openPosition(userId, liveToken, {
      state: 'BUY READY',
      score: proposal.decisionScore,
      confidence: proposal.decisionConfidence,
      primaryReason: proposal.primaryReason,
    }, settings, proposal.idempotencyKey);
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

    const open = Object.values(this.store.state.paperPositions).filter(
      p => p.status === 'OPEN' && p.mint === mint
    );

    let durableMutation = false;

    for (const position of open) {
      const result = this.updatePosition(position, token);
      if (result?.durable === true) durableMutation = true;
    }

    // Irreversible simulated execution state is scheduled for durability
    // immediately. Pure MTM/high/trailing changes are checkpointed.
    if (durableMutation) {
      this._checkpointOpenPositionStateV55(true);
    } else if (open.length) {
      this._checkpointOpenPositionStateV55(false);
    }
  }

  updatePosition(position, token) {
    const price = num(token.priceSol);
    const settings = this.settings(position.settingsSnapshot || {});
    let durableMutation = false;

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
        if (this.partialExit(position, qty, price, 'TP1')) {
          position.tp1Executed = true;
          durableMutation = true;
        }
      }
    }

    if (position.status === 'OPEN' && !position.tp2Executed && profitPct >= settings.tp2Pct) {
      const qty = Math.min(position.remainingTokenQuantity, position.initialTokenQuantity * settings.tp2SellPct / 100);
      if (qty > 0) {
        if (this.partialExit(position, qty, price, 'TP2')) {
          position.tp2Executed = true;
          durableMutation = true;
        }
      }
    }

    if (position.status !== 'OPEN') {
      return { durable: durableMutation };
    }

    if (profitPct <= -settings.hardStopPct) {
      durableMutation =
        this.closePositionInternal(position, price, 'HARD STOP') ||
        durableMutation;

      return { durable: durableMutation };
    }

    if (position.trailingStopPriceSol && price <= position.trailingStopPriceSol) {
      durableMutation =
        this.closePositionInternal(position, price, 'TRAILING STOP') ||
        durableMutation;

      return { durable: durableMutation };
    }

    const heldMinutes = (this.clock() - position.openedAtMs) / 60000;
    if (heldMinutes >= settings.maxHoldMinutes) {
      durableMutation =
        this.closePositionInternal(position, price, 'MAX HOLD TIME') ||
        durableMutation;

      return { durable: durableMutation };
    }

    const pressure = Number(token.buyPressure);
    if (
      settings.exitOnWeakBuyPressure &&
      Number.isFinite(pressure) &&
      pressure < settings.exitBuyPressure
    ) {
      durableMutation =
        this.closePositionInternal(position, price, 'BUY PRESSURE EXIT') ||
        durableMutation;
    }

    return { durable: durableMutation };
  }

  partialExit(position, quantity, price, reason) {
    if (position.status !== 'OPEN' || quantity <= 0) return false;
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
    if (position.remainingTokenQuantity <= 1e-15) {
      this.finalizePosition(position, price, reason);
    }

    return true;
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
    if (position.status !== 'OPEN') return false;
    const qty = position.remainingTokenQuantity;
    if (qty > 0) {
      const pnl = qty * (price - position.entryPriceSol);
      position.realizedPnlSol += pnl;
      this.recordTrade(position, 'SELL', qty, price, pnl, reason);
    }
    position.remainingTokenQuantity = 0;
    position.remainingSizeSol = 0;
    this.finalizePosition(position, price, reason);
    return true;
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

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Final outcome goes to the shared anonymous learning dataset.
    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
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
      strategySource: position.strategySource || null,
      copyTradingWallet: position.copyTradingWallet || null,
      copyTradingSource: position.copyTradingSource || null,
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

    // MEMEFLOW_PLATFORM_LEARNING_V2
    try {
      this.analytics?.recordTrade?.(
        trade,
        position
      );
    } catch {}

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
