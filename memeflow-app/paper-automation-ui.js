(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number.isFinite(Number(n)) ? `${Number(n).toFixed(4)} SOL` : '—';
  const pct = n => Number.isFinite(Number(n)) ? `${Number(n).toFixed(2)}%` : '—';

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', headers: { accept: 'application/json', ...(options.headers || {}) }, ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `HTTP ${response.status}`);
    return body;
  }

  function card(position) {
    const pnl = position.status === 'OPEN' ? position.unrealizedPnlSol : position.realizedPnlSol;
    const pnlPct = position.status === 'OPEN' ? position.unrealizedPnlPct : position.realizedPnlPct;
    return `<article class="mf-paper-position">
      <div class="mf-paper-head"><div><b>${esc(position.name || position.symbol)}</b><small>${esc(position.symbol)} · SIMULATED PAPER</small></div><span class="state ${position.status === 'OPEN' ? 'buy' : 'wait'}">${esc(position.status)}</span></div>
      <div class="mf-paper-grid">
        <div><small>Entry</small><b>${money(position.entryPriceSol)}</b></div>
        <div><small>Current</small><b>${money(position.currentPriceSol)}</b></div>
        <div><small>P&amp;L</small><b class="${Number(pnl) >= 0 ? 'mf-positive' : 'mf-negative'}">${money(pnl)} · ${pct(pnlPct)}</b></div>
        <div><small>Remaining</small><b>${money(position.remainingSizeSol)}</b></div>
        <div><small>Trailing stop</small><b>${money(position.trailingStopPriceSol)}</b></div>
        <div><small>Exit reason</small><b>${esc(position.closeReason || '—')}</b></div>
      </div>
      ${position.status === 'OPEN' ? `<button class="btn mf-paper-close" data-id="${esc(position.id)}" type="button">Close PAPER position</button>` : ''}
    </article>`;
  }

  async function render() {
    try {
      const [positions, proposals, status] = await Promise.all([
        api('/api/paper/positions'),
        api('/api/paper/proposals'),
        api('/api/paper/status')
      ]);

      const host = $('#mobilePosition') || $('#positions .panel-body');
      if (host) {
        const rows = positions.positions || [];
        host.innerHTML = `<div class="mf-paper-status"><b>${status.paperAutomationActive ? 'PAPER AUTOMATION ACTIVE' : 'PAPER MODE'}</b><span>${esc(status.operatingMode)}</span></div>` +
          (rows.length ? rows.map(card).join('') : '<div class="production-empty">No PAPER positions yet.</div>');
      }

      const pending = (proposals.proposals || []).filter(p => p.status === 'PENDING');
      if (pending.length && host) {
        host.insertAdjacentHTML('afterbegin', pending.map(p => `<article class="mf-paper-proposal">
          <b>${esc(p.name)} · PAPER proposal</b>
          <span>${money(p.proposedSizeSol)} at ${money(p.proposedPriceSol)}</span>
          <div><button class="btn primary" data-approve="${esc(p.id)}" type="button">Approve</button><button class="btn" data-reject="${esc(p.id)}" type="button">Reject</button></div>
        </article>`).join(''));
      }

      document.querySelectorAll('.mf-paper-close').forEach(btn => btn.onclick = async () => {
        await api(`/api/paper/positions/${encodeURIComponent(btn.dataset.id)}/close`, { method: 'POST' });
        render();
      });
      document.querySelectorAll('[data-approve]').forEach(btn => btn.onclick = async () => {
        await api(`/api/paper/proposals/${encodeURIComponent(btn.dataset.approve)}/approve`, { method: 'POST' });
        render();
      });
      document.querySelectorAll('[data-reject]').forEach(btn => btn.onclick = async () => {
        await api(`/api/paper/proposals/${encodeURIComponent(btn.dataset.reject)}/reject`, { method: 'POST' });
        render();
      });
    } catch (error) {
      console.info('PAPER UI unavailable:', error.message);
    }
  }

  window.MEMEFLOW_PAPER_UI = { refresh: render };
  render();
  setInterval(render, 5000);
})();
