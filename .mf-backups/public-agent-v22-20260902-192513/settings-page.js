

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_UI */
async function mfPublicAgentInstall(){
  let owner=false;
  try{const r=await fetch('/api/owner/status',{credentials:'same-origin',cache:'no-store'}),p=await r.json();owner=r.ok&&p?.isOwner===true}catch{}
  if(!owner)return;
  const body=document.getElementById('mf293SettingsBody');
  if(!body||document.getElementById('mfPublicAgentGroup'))return;

  if(!document.getElementById('mfPublicAgentV2Styles')){
    const style=document.createElement('style');
    style.id='mfPublicAgentV2Styles';
    style.textContent=`
      #mfPublicAgentGroup .mf-agent-wide{grid-column:1/-1}
      #mfPublicAgentGroup .mf-agent-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      #mfPublicAgentGroup .mf-agent-save{width:auto;min-height:38px;padding:8px 14px}
      #mfPublicAgentGroup .mf-agent-note{font-size:11px;line-height:1.45;color:var(--muted)}
      #mfPublicAgentGroup .mf-agent-list{display:grid;gap:8px;margin-top:7px}
      #mfPublicAgentGroup .mf-agent-item{border:1px solid var(--line);border-radius:10px;padding:9px;background:rgba(127,127,127,.035)}
      #mfPublicAgentGroup .mf-agent-item-top{display:flex;gap:8px;align-items:center;justify-content:space-between}
      #mfPublicAgentGroup .mf-agent-item b{font-size:12px}
      #mfPublicAgentGroup .mf-agent-status{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
      #mfPublicAgentGroup .mf-agent-copy{white-space:pre-wrap;font-size:12px;line-height:1.45;margin-top:6px}
      #mfPublicAgentGroup .mf-agent-review{display:flex;gap:6px;margin-top:8px}
      #mfPublicAgentGroup .mf-agent-review button{min-height:32px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:transparent}
      #mfPublicAgentGroup .mf-agent-events{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #mfPublicAgentGroup .mf-agent-event{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:10px;padding:9px}
      #mfPublicAgentGroup .mf-agent-history{font-size:11px;line-height:1.5;color:var(--muted);white-space:pre-wrap}
      #mfPublicAgentGroup .mf-agent-test{min-height:36px;padding:7px 12px;border:1px solid rgba(0,145,255,.38);border-radius:999px;background:rgba(0,145,255,.06);color:var(--text);font-weight:650;opacity:1;cursor:pointer}
      #mfPublicAgentGroup .mf-agent-test:active{transform:translateY(1px)}
      #mfPublicAgentGroup .mf-agent-test:disabled{border-color:var(--line);background:rgba(127,127,127,.08);color:var(--muted);opacity:.46;cursor:not-allowed}
      @media(max-width:620px){#mfPublicAgentGroup .mf-agent-events{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const sec=document.createElement('details');
  sec.id='mfPublicAgentGroup';
  sec.className='mf293-settings-group';
  sec.innerHTML=`<summary><span><strong>Public Agent</strong><small>Owner only · entity + future X publisher</small></span><i></i></summary>
  <div class="mf293-settings-grid">
    <label class="mf293-field mf293-field-switch"><span class="mf293-field-label">Enable entity</span><span class="mf293-switch"><input id="mfEntityEnabled" type="checkbox"><span class="mf293-switch-track"></span></span></label>
    <label class="mf293-field"><span class="mf293-field-label">Mode</span><select id="mfEntityMode"><option value="off">Off</option><option value="approval">Approval</option><option value="autonomous">Autonomous</option></select></label>
    <label class="mf293-field"><span class="mf293-field-label">Display name</span><input id="mfEntityName" type="text" maxlength="40" placeholder="Choose later"></label>
    <label class="mf293-field"><span class="mf293-field-label">Voice</span><select id="mfEntityVoice"><option value="terminal">Terminal</option><option value="minimal">Minimal</option></select></label>
    <label class="mf293-field mf-agent-wide"><span class="mf293-field-label">X connection</span><input value="Not connected · publishing physically disabled" disabled></label>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Events the entity may speak about</span>
      <div class="mf-agent-events">
        <label class="mf-agent-event"><span>WATCH</span><input id="mfEntityEventWatch" type="checkbox"></label>
        <label class="mf-agent-event"><span>BUY READY</span><input id="mfEntityEventBuyReady" type="checkbox"></label>
        <label class="mf-agent-event"><span>OPEN / EXIT</span><input id="mfEntityEventPositions" type="checkbox"></label>
        <label class="mf-agent-event"><span>REJECT / RISK</span><input id="mfEntityEventRisk" type="checkbox"></label>
      </div>
    </div>
    <div class="mf293-field mf-agent-wide">
      <span class="mf293-field-label">Test entity</span>
      <div class="mf-agent-actions">
        <button type="button" class="mf-agent-test" data-mf-agent-test="WATCH">Test WATCH</button>
        <button type="button" class="mf-agent-test" data-mf-agent-test="BUY READY">Test BUY READY</button>
        <button type="button" class="mf-agent-test" data-mf-agent-test="OPEN POSITION">Test OPEN</button>
        <button type="button" class="mf-agent-test" data-mf-agent-test="EXIT">Test EXIT</button>
        <button type="button" class="mf-agent-test" data-mf-agent-test="RISK">Test RISK</button>
      </div>
      <span class="mf-agent-note">Dry-run only. Does not trade and cannot post to X.</span>
    </div>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Publication queue</span><div id="mfEntityQueue" class="mf-agent-list">Loading…</div></div>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Entity history</span><div id="mfEntityHistory" class="mf-agent-history">Loading…</div></div>
    <div class="mf-agent-wide mf-agent-actions"><button id="mfEntitySave" class="mf293-primary mf-agent-save" type="button">Save Public Agent</button><button id="mfEntityRefresh" class="mf293-secondary" type="button">Refresh queue</button><span class="mf-agent-note">Approved drafts remain READY until X is connected.</span></div>
  </div>`;
  body.prepend(sec);

  const el=id=>document.getElementById(id);

  async function review(id,action){
    const r=await fetch(`/api/owner/public-agent/queue/${encodeURIComponent(id)}/${action}`,{method:'POST',credentials:'same-origin'});
    const p=await r.json().catch(()=>({}));
    if(!r.ok){mf293Error(p?.error||'Draft review failed.');return}
    mf293Status(action==='approve'?'Draft approved':'Draft rejected','saved');
    await load();
  }

  function renderQueue(rows){
    const q=el('mfEntityQueue');q.innerHTML='';
    if(!rows?.length){q.textContent='No drafts yet.';return}
    for(const item of rows.slice(0,10)){
      const wrap=document.createElement('div');wrap.className='mf-agent-item';
      const top=document.createElement('div');top.className='mf-agent-item-top';
      const title=document.createElement('b');title.textContent=`${item.eventType} · ${item.symbol||String(item.mint||'').slice(0,6)}`;
      const status=document.createElement('span');status.className='mf-agent-status';status.textContent=item.status||'PENDING';
      top.append(title,status);
      const copy=document.createElement('div');copy.className='mf-agent-copy';copy.textContent=item.text||'';
      wrap.append(top,copy);
      if(item.status==='PENDING'){
        const actions=document.createElement('div');actions.className='mf-agent-review';
        const approve=document.createElement('button');approve.type='button';approve.textContent='Approve';approve.addEventListener('click',()=>review(item.id,'approve'));
        const reject=document.createElement('button');reject.type='button';reject.textContent='Reject';reject.addEventListener('click',()=>review(item.id,'reject'));
        actions.append(approve,reject);wrap.appendChild(actions);
      }
      q.appendChild(wrap);
    }
  }

  function renderHistory(rows){
    const h=el('mfEntityHistory');
    if(!rows?.length){h.textContent='No entity activity yet.';return}
    h.textContent=rows.slice(0,12).map(x=>`${x.at?new Date(x.at).toLocaleString():'—'} · ${x.type}${x.eventType?` · ${x.eventType}`:''}`).join('\n');
  }

  async function load(){
    const r=await fetch('/api/owner/public-agent',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return;
    const p=await r.json(),c=p.config||{},e=c.events||{};
    el('mfEntityEnabled').checked=c.enabled===true;
    el('mfEntityMode').value=c.mode||'approval';
    el('mfEntityName').value=c.displayName||'';
    el('mfEntityVoice').value=c.voice||'terminal';
    el('mfEntityEventWatch').checked=e.watch!==false;
    el('mfEntityEventBuyReady').checked=e.buyReady!==false;
    el('mfEntityEventPositions').checked=e.positions!==false;
    el('mfEntityEventRisk').checked=e.risk!==false;
    const testsEnabled=c.enabled===true&&c.mode!=='off';
    document.querySelectorAll('[data-mf-agent-test]').forEach(button=>{
      button.disabled=!testsEnabled;
      button.setAttribute('aria-disabled',testsEnabled?'false':'true');
    });
    renderQueue(p.queue||[]);renderHistory(p.audit||[]);
  }

  el('mfEntitySave').addEventListener('click',async()=>{
    const r=await fetch('/api/owner/public-agent/config',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      enabled:el('mfEntityEnabled').checked,
      mode:el('mfEntityMode').value,
      displayName:el('mfEntityName').value,
      voice:el('mfEntityVoice').value,
      events:{watch:el('mfEntityEventWatch').checked,buyReady:el('mfEntityEventBuyReady').checked,positions:el('mfEntityEventPositions').checked,risk:el('mfEntityEventRisk').checked}
    })});
    const p=await r.json().catch(()=>({}));
    if(!r.ok){mf293Error(p?.error||'Public Agent settings could not be saved.');return}
    mf293Status('Public Agent saved','saved');await load();
  });
  document.querySelectorAll('[data-mf-agent-test]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const type=button.getAttribute('data-mf-agent-test');
      const r=await fetch('/api/owner/public-agent/test',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type})
      });
      const p=await r.json().catch(()=>({}));
      if(!r.ok){
        mf293Error(p?.message||p?.error||'Test event failed.');
        return;
      }
      mf293Status(`Test ${type} created`,'saved');
      await load();
    });
  });

  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}


/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1 */
/* MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt = (v, d = 2) => finite(v)
  ? Number(v).toLocaleString(undefined, { maximumFractionDigits: d })
  : '—';
const shortMint = (m = '') => m ? `${m.slice(0, 5)}…${m.slice(-4)}` : '—';
const ago = (ts) => {
  if (!finite(ts) || Number(ts) <= 0) return '—';
  const ms = Math.max(0, Date.now() - Number(ts));
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
};

const MF293 = {
  installed: false,
  settings: null,
  version: null,
  capabilities: null,
  profilePresets: {},
  killSwitchActive: false,
  dirty: false,
  saving: false
};

const MF293_GROUPS = [
  ['logic', 'Logic', 'Post-admission decision rules · controls WAITING / WATCH / BUY READY', false, [
    ['operatingMode', 'Operating mode', 'select', [['observe','Observe'],['assist','Assist'],['automate','Automate']]],
    ['tradingEnvironment', 'Trading environment', 'select', [['paper','Paper'],['live','Live']]],
    ['profile', 'Decision preset', 'select', [['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive'],['custom','Custom']]],
    ['minScore', 'Minimum AI score', 'number', 0, 100, 1],
    ['minConfidence', 'Minimum confidence %', 'number', 0, 100, 1],
    ['minBuyPressure', 'Minimum buy pressure for BUY READY', 'number', 0, null, 0.01],
    ['decisionFreshnessSec', 'Decision freshness sec', 'integer', 5, 3600, 1],
    ['requireFreshHolderSnapshot', 'Require fresh holders for decision', 'boolean'],
    ['requireWebsiteOrX', 'Require website or X for decision', 'boolean'],
    ['shadowValidation', 'Shadow validation', 'boolean'],
    ['changeLog', 'Settings change log', 'boolean']
  ]],
  ['trading', 'Trading', 'Capital, position sizing and daily limits', false, [
    ['tradingCapital', 'Trading capital SOL', 'number', 0, null, 0.01],
    ['dailySpendLimit', 'Daily spend limit SOL', 'number', 0, null, 0.01],
    ['positionSize', 'Default position SOL', 'number', 0.000001, null, 0.01],
    ['maxPositionSize', 'Maximum position SOL', 'number', 0.000001, null, 0.01],
    ['maxOpenPositions', 'Maximum open positions', 'integer', 0, null, 1],
    ['maxDailyEntries', 'Maximum daily entries', 'integer', 0, null, 1],
    ['dailyLossLimit', 'Daily loss limit SOL', 'number', 0, null, 0.01],
    ['feeReserve', 'Fee reserve SOL', 'number', 0, null, 0.001]
  ]],
  /* MEMEFLOW_STANDALONE_COPY_TRADING_SETTINGS_V1 */
  ['copyTrading', 'Copy trading', 'Mirror a Solana wallet with your own position size', false, [
    ['copyTradingEnabled', 'Enable copy trading', 'boolean'],
    ['copyTradingWallet', 'Tracked Solana wallet', 'text'],
    ['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001],
    ['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']
  ]],
  ['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, [
    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],
    ['minHolders', 'Minimum holders', 'nullable', 0, null, 1],
    ['maxHolders', 'Maximum holders', 'nullable', 0, null, 1],
    ['minTokenAgeMinutes', 'Minimum age min', 'nullable', 0, null, 0.1],
    ['maxTokenAgeMinutes', 'Maximum age min', 'nullable', 0, null, 0.1],
    ['minMarketCapUsd', 'Minimum market cap USD', 'nullable', 0, null, 1],
    ['maxMarketCapUsd', 'Maximum market cap USD', 'nullable', 0, null, 1],
    ['minBondingCurvePct', 'Minimum bonding curve %', 'nullable', 0, 100, 0.1],
    ['maxBondingCurvePct', 'Maximum bonding curve %', 'nullable', 0, 100, 0.1],
    ['minTotalFeesSol', 'Minimum total fees SOL', 'nullable', 0, null, 0.001],
    ['maxTotalFeesSol', 'Maximum total fees SOL', 'nullable', 0, null, 0.001],
    ['minVolume24hUsd', 'Minimum 24h volume USD', 'nullable', 0, null, 1],
    ['maxVolume24hUsd', 'Maximum 24h volume USD', 'nullable', 0, null, 1],
    ['minBuyTransactions', 'Minimum buy transactions', 'nullable', 0, null, 1],
    ['maxBuyTransactions', 'Maximum buy transactions', 'nullable', 0, null, 1],
    ['minSellTransactions', 'Minimum sell transactions', 'nullable', 0, null, 1],
    ['maxSellTransactions', 'Maximum sell transactions', 'nullable', 0, null, 1],
    ['minTotalTransactions', 'Minimum total transactions', 'nullable', 0, null, 1],
    ['maxTotalTransactions', 'Maximum total transactions', 'nullable', 0, null, 1],
    ['minTop10Pct', 'Minimum Top 10 %', 'nullable', 0, 100, 0.1],
    ['maxTop10Pct', 'Maximum Top 10 %', 'nullable', 0, 100, 0.1],
    ['minDeveloperPct', 'Minimum developer %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperPct', 'Maximum developer %', 'nullable', 0, 100, 0.1],
    ['minBundlePct', 'Minimum bundle %', 'nullable', 0, 100, 0.1],
    ['maxBundlePct', 'Maximum bundle %', 'nullable', 0, 100, 0.1],
    ['minSniperPct', 'Minimum sniper %', 'nullable', 0, 100, 0.1],
    ['maxSniperPct', 'Maximum sniper %', 'nullable', 0, 100, 0.1],
    ['requireTwitter', 'Require X / Twitter', 'boolean'],
    ['requireWebsite', 'Require website', 'boolean'],
    ['requireTelegram', 'Require Telegram', 'boolean'],
    ['requireAnySocial', 'Require any social', 'boolean'],
    ['includeKeywords', 'Include keywords', 'text'],
    ['excludeKeywords', 'Exclude keywords', 'text'],
    ['developerBlacklistWallets', 'Developer blacklist wallets', 'array']
  ]],
  ['preopen', 'Pre-open RPC verification', 'Only after BUY READY · linked and funded wallet risk', false, [
    ['maxSuspectedRiskyWalletsPct', 'Maximum linked / risky wallets %', 'nullable', 0, 100, 0.1],
    ['maxInsidersPct', 'Maximum insiders / common-funder wallets %', 'nullable', 0, 100, 0.1]
  ]],
  ['exits', 'Risk & exits', 'Stops, take profit allocation and exit pressure', false, [
    ['hardStopPct', 'Hard stop %', 'number', 0.000001, 100, 0.1],
    ['trailingStopPct', 'Trailing stop %', 'number', 0, 100, 0.1],
    ['tp1Pct', 'TP1 gain %', 'number', 0.000001, null, 1],
    ['tp1SellPct', 'TP1 sell %', 'number', 0, 100, 1],
    ['tp2Pct', 'TP2 gain %', 'number', 0.000001, null, 1],
    ['tp2SellPct', 'TP2 sell %', 'number', 0, 100, 1],
    ['runnerPct', 'Runner %', 'number', 0, 100, 1],
    ['maxHoldMinutes', 'Maximum hold min', 'integer', 1, null, 1],
    ['exitBuyPressure', 'Exit buy pressure', 'number', 0, null, 0.01],
    ['exitOnWeakBuyPressure', 'Exit on weak buy pressure', 'boolean']
  ]]
];

/*
 * Strategy profiles are deliberately scoped to the visible Logic group only.
 * Nothing outside this whitelist may be changed by Conservative / Balanced /
 * Aggressive, even if a future server response contains extra preset keys.
 */
const MF293_PROFILE_LOGIC_KEYS = Object.freeze([
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
]);

function mf293Clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mf293Fields() {
  return MF293_GROUPS.flatMap(group => group[4]);
}

function mf293PresetMatches(profile) {
  const key = String(profile || '').trim().toLowerCase();
  const preset = MF293.profilePresets?.[key];
  if (!preset || typeof preset !== 'object') return false;

  for (const settingKey of MF293_PROFILE_LOGIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(preset, settingKey)) continue;
    const input = document.querySelector(`[data-setting-key="${settingKey}"]`);
    if (!input) return false;

    const expected = preset[settingKey];
    if (input.dataset.settingKind === 'boolean') {
      if (input.checked !== Boolean(expected)) return false;
      continue;
    }

    const actual = String(input.value ?? '').trim();
    if (finite(expected)) {
      if (!finite(actual) || Math.abs(Number(actual) - Number(expected)) > 1e-9) return false;
    } else if (actual !== String(expected ?? '')) {
      return false;
    }
  }
  return true;
}

function mf293InferProfileFromLogic() {
  for (const key of ['conservative', 'balanced', 'aggressive']) {
    if (mf293PresetMatches(key)) return key;
  }
  return 'custom';
}

function mf293SyncProfileSelection() {
  const input = document.querySelector('[data-setting-key="profile"]');
  if (!input) return 'custom';
  const profile = mf293InferProfileFromLogic();
  input.value = profile;
  return profile;
}

function mf293ProfileLabel(profile) {
  const key = String(profile || 'custom').trim().toLowerCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function mf293Status(text, state = '') {
  const node = document.getElementById('mf293SettingsStatus');
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function mf293Error(message) {
  let node = document.getElementById('mf293SettingsError');
  if (!node) {
    node = document.createElement('div');
    node.id = 'mf293SettingsError';
    node.className = 'mf293-settings-error';
    document.getElementById('mf293SettingsBody')?.prepend(node);
  }
  node.hidden = false;
  node.textContent = String(message || 'Unknown error');
}

function mf293ClearError() {
  const node = document.getElementById('mf293SettingsError');
  if (node) {
    node.hidden = true;
    node.textContent = '';
  }
}

function mf293Disable(disabled) {
  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {
    const node = document.getElementById(id);
    if (node) node.disabled = disabled;
  }
}

function mf293CreateField(field) {
  const [key, label, kind, min, max, step] = field;
  const wrap = document.createElement('label');
  wrap.className = kind === 'boolean'
    ? 'mf293-field mf293-field-switch'
    : 'mf293-field';

  const title = document.createElement('span');
  title.className = 'mf293-field-label';
  title.textContent = label;
  wrap.appendChild(title);

  let input;

  if (kind === 'boolean') {
    const switchWrap = document.createElement('span');
    switchWrap.className = 'mf293-switch';
    input = document.createElement('input');
    input.type = 'checkbox';
    const track = document.createElement('span');
    track.className = 'mf293-switch-track';
    switchWrap.append(input, track);
    wrap.appendChild(switchWrap);
  } else if (kind === 'select') {
    input = document.createElement('select');
    for (const [value, text] of field[3]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    }
    wrap.appendChild(input);
  } else if (kind === 'array') {
    input = document.createElement('textarea');
    input.rows = 3;
    input.placeholder = 'One wallet per line or comma-separated';
    wrap.classList.add('mf293-field-wide');
    wrap.appendChild(input);
  } else {
    input = document.createElement('input');
    input.type = (kind === 'number' || kind === 'integer' || kind === 'nullable') ? 'number' : 'text';
    if (min !== undefined && min !== null) input.min = String(min);
    if (max !== undefined && max !== null) input.max = String(max);
    if (step !== undefined && step !== null) input.step = String(step);
    if (kind === 'nullable') input.placeholder = 'Off';
    wrap.appendChild(input);
  }

  input.dataset.settingKey = key;
  input.dataset.settingKind = kind;
  const markDirty = () => {
    MF293.dirty = true;

    if (key !== 'profile' && MF293_PROFILE_LOGIC_KEYS.includes(key)) {
      mf293SyncProfileSelection();
    }

    const profileInput = document.querySelector('[data-setting-key="profile"]');
    const profile = profileInput?.value || 'custom';
    mf293Status(`${mf293ProfileLabel(profile)} · Unsaved`, 'dirty');
  };
  input.addEventListener('input', markDirty);
  input.addEventListener('change', markDirty);

  return wrap;
}


function mf293ApplyProfilePreset(profile) {
  const key = String(profile || '').trim().toLowerCase();
  const preset = MF293.profilePresets?.[key];

  if (!preset || typeof preset !== 'object') {
    mf293Error(`Profile preset is unavailable: ${key || 'unknown'}`);
    return false;
  }

  mf293ClearError();

  for (const settingKey of MF293_PROFILE_LOGIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(preset, settingKey)) continue;

    const input = document.querySelector(`[data-setting-key="${settingKey}"]`);
    if (!input) continue;

    const value = preset[settingKey];

    if (input.dataset.settingKind === 'boolean') {
      input.checked = Boolean(value);
    } else {
      input.value = value === null || value === undefined ? '' : String(value);
    }
  }

  mf293SyncProfileSelection();
  MF293.dirty = true;
  mf293Status(`${mf293ProfileLabel(key)} · Unsaved`, 'dirty');
  return true;
}

function mf293Build() {
  if (document.getElementById('mf293SettingsPanel')) return;

  const actions = document.querySelector('.top-actions');
  if (actions) {
    const button = document.createElement('button');
    button.id = 'mf293SettingsBtn';
    button.className = 'tool-btn mf293-settings-trigger';
    button.type = 'button';
    button.textContent = 'Settings';
    actions.insertBefore(button, document.getElementById('resetViewBtn') || null);
    button.addEventListener('click', mf293Open);
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'mf293SettingsBackdrop';
  backdrop.className = 'mf293-settings-backdrop';
  backdrop.hidden = true;

  const panel = document.createElement('section');
  panel.id = 'mf293SettingsPanel';
  panel.className = 'mf293-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'mf293SettingsTitle');
  panel.innerHTML = `
    <header class="mf293-settings-head">
      <div>
        <span class="eyebrow">LIVE CONFIGURATION</span>
        <h2 id="mf293SettingsTitle">System settings</h2>
      </div>
      <div class="mf293-settings-head-actions">
        <span id="mf293SettingsStatus" class="mf293-settings-status">Ready</span>
        <button id="mf293SettingsClose" type="button" aria-label="Close settings">×</button>
      </div>
    </header>
    <div class="mf293-settings-meta">
      <span>Platform<strong>Pump.fun</strong></span>
      <span>AI policy<strong>Propose only</strong></span>
      <span>Kill switch<strong id="mf293KillSwitch">Checking</strong></span>
    </div>
    <div id="mf293SettingsBody" class="mf293-settings-body"></div>
    <footer class="mf293-settings-footer">
      <button id="mf293RestoreDefaults" class="mf293-secondary" type="button">Restore defaults</button>
      <button id="mf293SaveSettings" class="mf293-primary" type="button">Save settings</button>
    </footer>
  `;

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const body = document.getElementById('mf293SettingsBody');
  for (const [id, title, subtitle, open, fields] of MF293_GROUPS) {
    const section = document.createElement('details');
    section.className = 'mf293-settings-group';
    // MEMEFLOW_SETTINGS_ACCORDIONS_CLOSED_DEFAULT_V1
    // All Settings sections start collapsed. The user opens only what they need.
    section.open = false;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span><strong>${title}</strong><small>${subtitle}</small></span><i></i>`;
    const grid = document.createElement('div');
    grid.className = 'mf293-settings-grid';
    for (const field of fields) grid.appendChild(mf293CreateField(field));
    section.append(summary, grid);
    body.appendChild(section);
  }

  document.getElementById('mf293SettingsClose')?.addEventListener('click', mf293Close);
  document.getElementById('mf293SaveSettings')?.addEventListener('click', mf293Save);
  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);
  document.querySelector('[data-setting-key="profile"]')?.addEventListener('change', event => {
    const profile = String(event.currentTarget?.value || '').trim().toLowerCase();

    if (profile === 'custom') {
      MF293.dirty = true;
      mf293Status('Custom · Unsaved', 'dirty');
      return;
    }

    mf293ApplyProfilePreset(profile);
  });

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) mf293Close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !backdrop.hidden) mf293Close();
  });

}

function mf293Populate() {
  if (!MF293.settings) return;

  for (const field of mf293Fields()) {
    const [key, , kind] = field;
    const input = document.querySelector(`[data-setting-key="${key}"]`);
    if (!input) continue;
    const value = MF293.settings[key];

    if (kind === 'boolean') input.checked = Boolean(value);
    else if (kind === 'array') input.value = Array.isArray(value) ? value.join('\n') : '';
    else if (kind === 'nullable') input.value = value === null || value === undefined ? '' : String(value);
    else input.value = value === null || value === undefined ? '' : String(value);
  }

  mf293SyncProfileSelection();

  const environment = document.querySelector('[data-setting-key="tradingEnvironment"]');
  if (environment) {
    const liveOption = [...environment.options].find(option => option.value === 'live');
    if (liveOption) {
      const currentLive = MF293.settings.tradingEnvironment === 'live';
      liveOption.disabled = !currentLive && MF293.capabilities?.liveAutomation !== true;
    }
  }

  const kill = document.getElementById('mf293KillSwitch');
  if (kill) {
    kill.textContent = MF293.killSwitchActive ? 'ACTIVE' : 'Off';
    kill.dataset.active = MF293.killSwitchActive ? 'true' : 'false';
  }

  MF293.dirty = false;
  mf293Status(`v${MF293.version ?? '—'}`, 'saved');
}

async function mf293Load() {
  mf293Status('Loading', 'busy');
  mf293Disable(true);
  mf293ClearError();

  try {
    const response = await fetch('/api/settings', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to load settings');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? 1;
    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
    MF293.killSwitchActive = payload.killSwitchActive === true;
    mf293Populate();
  } catch (error) {
    mf293Status('Load failed', 'error');
    mf293Error(error.message || 'Unable to load settings');
  } finally {
    mf293Disable(false);
  }
}

function mf293Read(field, input) {
  const kind = field[2];
  if (kind === 'boolean') return input.checked;
  if (kind === 'array') {
    return [...new Set(String(input.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(Boolean))];
  }
  if (kind === 'nullable') {
    const text = String(input.value || '').trim();
    return text === '' ? null : Number(text);
  }
  if (kind === 'number') return Number(input.value);
  if (kind === 'integer') return Math.trunc(Number(input.value));
  return String(input.value || '').trim();
}

function mf293Collect() {
  if (!MF293.settings) throw new Error('Settings are not loaded');
  const next = mf293Clone(MF293.settings);

  for (const field of mf293Fields()) {
    const input = document.querySelector(`[data-setting-key="${field[0]}"]`);
    if (input) next[field[0]] = mf293Read(field, input);
  }

  // Discovery remains Pump.fun only.
  next.launchPlatforms = ['pump'];
  next.aiChangePolicy = 'propose';
  next.adaptiveProfile = false;
  return next;
}

async function mf293Save() {
  if (MF293.saving) return;
  mf293ClearError();

  let next;
  try {
    next = mf293Collect();
  } catch (error) {
    mf293Error(error.message);
    return;
  }

  MF293.saving = true;
  mf293Disable(true);
  mf293Status('Saving', 'busy');

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({settings: next, version: MF293.version})
    });
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 409) {
        await mf293Load();
        throw new Error('Settings changed on the server. Latest values were reloaded.');
      }
      const message = Array.isArray(payload?.errors)
        ? payload.errors.join(' ')
        : (payload?.message || payload?.error || 'Unable to save settings');
      throw new Error(message);
    }

    MF293.settings = mf293Clone(payload.settings || next);
    MF293.version = payload.version ?? MF293.version;
    MF293.dirty = false;
    mf293Populate();

    const count = Number(payload.decisionsReevaluated);
    mf293Status(
      Number.isFinite(count) ? `Saved · ${count} re-evaluated` : 'Saved',
      'saved'
    );
  } catch (error) {
    mf293Status('Save failed', 'error');
    mf293Error(error.message || 'Unable to save settings');
  } finally {
    MF293.saving = false;
    mf293Disable(false);
  }
}

async function mf293Restore() {
  if (!window.confirm('Restore all MEMEFLOW settings to server defaults?')) return;
  mf293ClearError();
  mf293Disable(true);
  mf293Status('Restoring', 'busy');

  try {
    const response = await fetch('/api/settings/defaults', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to restore defaults');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? MF293.version;
    mf293Populate();
    mf293Status('Defaults restored', 'saved');
  } catch (error) {
    mf293Status('Restore failed', 'error');
    mf293Error(error.message || 'Unable to restore defaults');
  } finally {
    mf293Disable(false);
  }
}

async function mf293Open() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  backdrop.hidden = false;
  document.body.classList.add('mf293-settings-open');
  await mf293Load();
}

function mf293Close() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  if (MF293.dirty && !window.confirm('Close settings without saving changes?')) return;
  backdrop.hidden = true;
  document.body.classList.remove('mf293-settings-open');
}

function mf293Install() {
  if (MF293.installed) return;
  MF293.installed = true;
  mf293Build();
  void mfPublicAgentInstall();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (typeof mf29Camera === 'function' && app?.camera && app?.controls) {
        mf29Camera(true);
        resize();
      }
    });
  });
}

mf293Install();

/* Standalone page owns navigation; the former modal close button is hidden. */
document.getElementById('mf293SettingsClose')?.setAttribute('tabindex', '-1');

const mfStandaloneSettingsOpen = async () => {
  try {
    await mf293Open();
  } catch (error) {
    console.error('[SETTINGS-PAGE] failed to open settings', error);
  } finally {
    document.body.classList.add('mf-settings-page-ready');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mfStandaloneSettingsOpen, { once: true });
} else {
  mfStandaloneSettingsOpen();
}
