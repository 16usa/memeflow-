#!/usr/bin/env bash
set -euo pipefail

cd "${REPL_HOME:-$PWD}"
if [ -d memeflow-app ]; then
  ROOT="$PWD"
else
  ROOT="$(dirname "$(find /home/runner -maxdepth 2 -type d -name memeflow-app 2>/dev/null | head -n1)")"
fi

if [ -z "${ROOT:-}" ] || [ ! -d "$ROOT/memeflow-app" ]; then
  echo "ERROR: run this from the MEMEFLOW repository root."
  exit 1
fi

cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-scan-v27-$STAMP"
mkdir -p "$BACKUP"

cp memeflow-app/system-tokens.html "$BACKUP/system-tokens.html"
cp memeflow-app/system-tokens.css  "$BACKUP/system-tokens.css"
cp memeflow-app/system-tokens.js   "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path

html_path = Path("memeflow-app/system-tokens.html")
css_path = Path("memeflow-app/system-tokens.css")
js_path = Path("memeflow-app/system-tokens.js")

html = html_path.read_text()
css = css_path.read_text()
js = js_path.read_text()

old_html = '''        <input
          id="tokenSearch"
          type="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Search mint"
        />'''
new_html = '''        <input
          id="tokenSearch"
          type="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Paste Pump.fun URL or mint"
          aria-label="Paste Pump.fun URL or Solana mint to analyze"
        />'''
if old_html not in html:
    raise SystemExit("HTML input anchor not found")
html = html.replace(old_html, new_html, 1)

old_button = '''        <button
          id="refreshButton"
          type="button"
        >
          Refresh
        </button>'''
new_button = '''        <button
          id="refreshButton"
          type="button"
          aria-label="Analyze token"
        >
          Analyze
        </button>'''
if old_button not in html:
    raise SystemExit("HTML Analyze button anchor not found")
html = html.replace(old_button, new_button, 1)

toolbar_close = '''    </section>

    <section
      id="tokenList"
      class="token-list"
    >'''
scan_section = '''    </section>

    <section
      id="tokenScanResult"
      class="mf-token-scan-result"
      aria-live="polite"
      hidden
    ></section>

    <section
      id="tokenList"
      class="token-list"
    >'''
if toolbar_close not in html:
    raise SystemExit("HTML scan-result insertion anchor not found")
html = html.replace(toolbar_close, scan_section, 1)

old_src = 'src="/system-tokens.js?v=canonical-chart-market-v26-20260829"'
new_src = 'src="/system-tokens.js?v=token-scan-v27-20260902"'
if old_src in html:
    html = html.replace(old_src, new_src, 1)

if "/* MEMEFLOW_TOKEN_SCAN_V27 */" not in css:
    css += r'''

/* MEMEFLOW_TOKEN_SCAN_V27 */
.mf-token-scan-result {
  margin-top: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(127, 142, 153, .045);
  color: var(--text);
  overflow: hidden;
}
.mf-token-scan-result[hidden],
.mf-scan-details[hidden] { display: none !important; }
.mf-scan-card { padding: 12px; }
.mf-scan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.mf-scan-title { min-width: 0; }
.mf-scan-kicker {
  display: block;
  color: #708793;
  font-size: var(--mf-type-micro);
  font-weight: 850;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.mf-scan-title strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--mf-type-panel);
}
.mf-scan-mint {
  display: block;
  margin-top: 3px;
  color: #718590;
  font-size: var(--mf-type-micro);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mf-scan-state {
  flex: none;
  padding: 5px 7px;
  border: 1px solid currentColor;
  border-radius: 7px;
  font-size: var(--mf-type-micro);
  font-weight: 900;
  letter-spacing: .06em;
}
.mf-scan-state.ready { color: var(--yellow); }
.mf-scan-state.watch { color: var(--blue); }
.mf-scan-state.blocked { color: var(--red); }
.mf-scan-state.waiting { color: #8ca0ad; }
.mf-scan-state.open { color: var(--green); }
.mf-scan-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.mf-scan-metric,
.mf-scan-detail {
  min-width: 0;
  padding: 7px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(127, 142, 153, .035);
}
.mf-scan-metric span,
.mf-scan-detail span {
  display: block;
  color: #708793;
  font-size: var(--mf-type-micro);
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.mf-scan-metric strong,
.mf-scan-detail strong {
  display: block;
  margin-top: 3px;
  font-size: var(--mf-type-ui);
}
.mf-scan-metric strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mf-scan-detail strong { word-break: break-word; }
.mf-scan-reason {
  margin: 9px 0 0;
  color: #748892;
  font-size: var(--mf-type-ui);
  line-height: 1.45;
}
.mf-scan-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}
.mf-scan-actions button,
.mf-scan-actions a {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(127, 142, 153, .04);
  color: var(--text);
  text-decoration: none;
  font-size: var(--mf-type-micro);
  font-weight: 800;
  cursor: pointer;
}
.mf-scan-actions .mf-scan-buy {
  border-color: rgba(70, 220, 159, .35);
  color: var(--green);
}
.mf-scan-actions button:disabled {
  opacity: .42;
  cursor: not-allowed;
}
.mf-scan-details {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}
.mf-scan-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.mf-scan-notes {
  margin: 8px 0 0;
  padding-left: 17px;
  color: #748892;
  font-size: var(--mf-type-micro);
  line-height: 1.45;
}
.mf-scan-loading,
.mf-scan-error {
  padding: 12px;
  font-size: var(--mf-type-ui);
}
.mf-scan-error { color: var(--red); }

@media (max-width: 760px) {
  .mf-token-scan-result {
    margin-top: 5px;
    border-radius: 9px;
  }
  .mf-scan-card { padding: 9px; }
  .mf-scan-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }
  .mf-scan-detail-grid {
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .mf-scan-actions { gap: 5px; }
  .mf-scan-actions button,
  .mf-scan-actions a {
    min-height: 31px;
    padding: 0 9px;
  }
}
'''

old_listener = '''$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfLoadStructureV18()
        .finally(
          ()=>__mfKickCardClockV19()
        );
    }
  );'''

new_listener = r'''// MEMEFLOW_TOKEN_SCAN_V27
let __mfTokenScanBusyV27=false;

function __mfScanNumberV27(value,digits=2){
  if(!finite(value))return '—';
  return Number(value).toLocaleString(
    undefined,
    {maximumFractionDigits:digits}
  );
}

function __mfScanCompactUsdV27(value){
  if(!finite(value))return '—';
  return '$'+compactMetricNumber(Number(value),1);
}

function __mfScanMintFromInputV27(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const matches=text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[];
  return matches.find(mint=>mint.length>=32&&mint.length<=44)||'';
}

function __mfScanStateClassV27(value){
  const key=stateKey(value);
  return key==='ready'?'ready':
    key==='watch'?'watch':
    key==='blocked'?'blocked':
    key==='open'?'open':'waiting';
}

function __mfScanDecisionV27(scan,liveRow){
  if(liveRow){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }
  return scan?.evaluation||{};
}

async function __mfScanFetchV27(path,options={}){
  const response=await fetch(path,{
    cache:'no-store',
    credentials:'same-origin',
    ...options
  });
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(
      payload?.message||payload?.error||`HTTP ${response.status}`
    );
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function __mfTrackedLiveRowV27(mint){
  if(!mint)return null;
  try{
    const payload=await __mfScanFetchV27(
      '/api/system/live-token-state?mint='+
      encodeURIComponent(mint)+'&_='+Date.now()
    );
    return payload?.row||null;
  }catch(error){
    if(error?.status===404)return null;
    throw error;
  }
}

async function __mfBuyContextV27(mint,decision){
  const result={readiness:null,proposal:null};
  if(!mint||stateKey(decision?.state)!=='ready')return result;

  try{
    const [readyPayload,proposalPayload]=await Promise.all([
      __mfScanFetchV27(
        '/api/paper/readiness?mint='+encodeURIComponent(mint)+'&_='+Date.now()
      ),
      __mfScanFetchV27('/api/paper/proposals?_='+Date.now())
    ]);

    result.readiness=readyPayload;
    const proposals=Array.isArray(proposalPayload?.proposals)
      ? proposalPayload.proposals : [];

    result.proposal=proposals
      .filter(p=>
        String(p?.mint||'')===mint &&
        String(p?.status||'').toUpperCase()==='PENDING'
      )
      .sort((a,b)=>
        Number(b?.createdAtMs||Date.parse(b?.createdAt||'')||0)-
        Number(a?.createdAtMs||Date.parse(a?.createdAt||'')||0)
      )[0]||null;
  }catch(error){
    console.debug('[token-scan] buy context unavailable',error);
  }
  return result;
}

function __mfScanRenderV27({scan,liveRow,buyContext}){
  const host=$('tokenScanResult');
  if(!host)return;

  const tracked=Boolean(liveRow);
  const decision=__mfScanDecisionV27(scan,liveRow);
  const mint=String(scan?.mint||liveRow?.mint||'');
  const name=scan?.name||liveRow?.name||liveRow?.symbol||shortMint(mint);
  const symbol=scan?.symbol||liveRow?.symbol||'';
  const market=scan?.market||{};
  const chain=scan?.onchain||{};
  const stateText=stateLabel(decision?.state||'WAITING');
  const stateClass=__mfScanStateClassV27(decision?.state);

  const reasons=[
    decision?.primaryReason,
    ...(Array.isArray(decision?.reasons)?decision.reasons:[])
  ].filter(Boolean);

  const warnings=Array.isArray(scan?.warnings)?scan.warnings:[];

  const canApproveBuy=Boolean(
    tracked &&
    stateKey(decision?.state)==='ready' &&
    buyContext?.readiness?.ok===true &&
    buyContext?.proposal?.id
  );

  const buyTitle=!tracked
    ? 'Manual scans cannot bypass the canonical trading pipeline.'
    : stateKey(decision?.state)!=='ready'
      ? `Buy unavailable while state is ${stateText}.`
      : buyContext?.readiness?.ok!==true
        ? 'Canonical entry readiness is not passing.'
        : !buyContext?.proposal?.id
          ? 'No pending ASSIST proposal is available. AUTOMATE mode handles entry itself.'
          : 'Approve the current canonical MEMEFLOW proposal.';

  host.hidden=false;
  host.innerHTML=`
    <div class="mf-scan-card">
      <div class="mf-scan-head">
        <div class="mf-scan-title">
          <span class="mf-scan-kicker">
            ${tracked?'TRACKED BY MEMEFLOW':'MANUAL TOKEN SCAN'}
          </span>
          <strong>${escapeHtml(symbol?`${symbol} · ${name}`:name)}</strong>
          <span class="mf-scan-mint">${escapeHtml(mint)}</span>
        </div>
        <span class="mf-scan-state ${stateClass}">
          ${escapeHtml(stateText)}
        </span>
      </div>

      <div class="mf-scan-grid">
        <div class="mf-scan-metric"><span>Score</span><strong>${escapeHtml(__mfScanNumberV27(decision?.score,0))}</strong></div>
        <div class="mf-scan-metric"><span>Holders</span><strong>${escapeHtml(chain?.holderCountDisplay??chain?.holderCount??holderCount(liveRow||{}))}</strong></div>
        <div class="mf-scan-metric"><span>Top 10</span><strong>${finite(chain?.top10Pct)?escapeHtml(__mfScanNumberV27(chain.top10Pct,1)+'%'):'—'}</strong></div>
        <div class="mf-scan-metric"><span>Dev</span><strong>${finite(chain?.developerPct)?escapeHtml(__mfScanNumberV27(chain.developerPct,1)+'%'):'—'}</strong></div>
        <div class="mf-scan-metric"><span>MC</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</strong></div>
        <div class="mf-scan-metric"><span>Buy pressure</span><strong>${finite(market?.buyPressure)?escapeHtml(__mfScanNumberV27(market.buyPressure,2)+'×'):'—'}</strong></div>
      </div>

      <p class="mf-scan-reason">
        ${escapeHtml(reasons[0]||(
          tracked
            ? 'Current canonical MEMEFLOW live state.'
            : 'Independent scan completed with the current MEMEFLOW evaluator.'
        ))}
      </p>

      <div class="mf-scan-actions">
        <button type="button" data-mf-scan-details>Full analysis</button>
        ${tracked?'<button type="button" data-mf-scan-open-card>Open card</button>':''}
        <button
          type="button"
          class="mf-scan-buy"
          data-mf-scan-buy
          ${canApproveBuy?'':'disabled'}
          title="${escapeHtml(buyTitle)}"
        >Buy</button>
        <a
          href="https://pump.fun/coin/${encodeURIComponent(mint)}"
          target="_blank"
          rel="noopener noreferrer"
        >Pump.fun</a>
      </div>

      <div class="mf-scan-details" data-mf-scan-details-panel hidden>
        <div class="mf-scan-detail-grid">
          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.liquidityUsd))}</strong></div>
          <div class="mf-scan-detail"><span>Vol 5m</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</strong></div>
          <div class="mf-scan-detail"><span>5m buys / sells</span><strong>${escapeHtml(`${__mfScanNumberV27(market?.buys5m,0)} / ${__mfScanNumberV27(market?.sells5m,0)}`)}</strong></div>
          <div class="mf-scan-detail"><span>Mint authority</span><strong>${escapeHtml(chain?.mintAuthority?'ACTIVE':'NONE')}</strong></div>
          <div class="mf-scan-detail"><span>Freeze authority</span><strong>${escapeHtml(chain?.freezeAuthority?'ACTIVE':'NONE')}</strong></div>
          <div class="mf-scan-detail"><span>Sources</span><strong>${escapeHtml((scan?.sources||[]).join(' · ')||'MEMEFLOW live')}</strong></div>
        </div>

        ${reasons.length>1
          ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
          : ''}
        ${warnings.length
          ? `<ul class="mf-scan-notes">${warnings.slice(0,8).map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>`
          : ''}
      </div>
    </div>
  `;

  host.querySelector('[data-mf-scan-details]')?.addEventListener(
    'click',
    event=>{
      const panel=host.querySelector('[data-mf-scan-details-panel]');
      if(!panel)return;
      panel.hidden=!panel.hidden;
      event.currentTarget.textContent=panel.hidden?'Full analysis':'Hide analysis';
    }
  );

  host.querySelector('[data-mf-scan-open-card]')?.addEventListener(
    'click',
    ()=>{
      const card=[...document.querySelectorAll('.flow-token[data-mint]')]
        .find(node=>String(node.dataset.mint||'')===mint);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'center'});
        card.classList.add('expanded');
        const button=card.querySelector('.details-button');
        if(button)button.textContent='Close';
      }
    }
  );

  const buyButton=host.querySelector('[data-mf-scan-buy]');
  if(canApproveBuy&&buyButton){
    buyButton.addEventListener('click',async ()=>{
      buyButton.disabled=true;
      buyButton.textContent='Buying…';
      try{
        await __mfScanFetchV27(
          '/api/paper/proposals/'+
          encodeURIComponent(buyContext.proposal.id)+
          '/approve',
          {method:'POST'}
        );
        buyButton.textContent='Approved';
        void __mfRefreshOpenPositionsV16({patchDom:true});
        void __mfLoadStructureV18();
      }catch(error){
        buyButton.disabled=false;
        buyButton.textContent='Buy';
        buyButton.title=error?.message||'Buy approval failed';
      }
    });
  }
}

async function __mfAnalyzeTokenV27(){
  const input=String($('tokenSearch')?.value||'').trim();
  const host=$('tokenScanResult');
  const button=$('refreshButton');

  if(!input){
    state.query='';
    state.page=1;
    render();
    if(host){
      host.hidden=true;
      host.innerHTML='';
    }
    void __mfLoadStructureV18().finally(()=>__mfKickCardClockV19());
    return;
  }

  if(__mfTokenScanBusyV27)return;
  __mfTokenScanBusyV27=true;

  if(button){
    button.disabled=true;
    button.textContent='Scanning…';
  }
  if(host){
    host.hidden=false;
    host.innerHTML='<div class="mf-scan-loading">Running full MEMEFLOW token analysis…</div>';
  }

  try{
    const hintedMint=__mfScanMintFromInputV27(input);
    let liveRow=hintedMint
      ? await __mfTrackedLiveRowV27(hintedMint)
      : null;

    const payload=await __mfScanFetchV27(
      '/api/ai/standalone-scan',
      {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({input})
      }
    );

    const scan=payload?.scan||null;
    if(!scan?.mint)throw new Error('Token scan returned no mint.');

    if(!liveRow||String(liveRow?.mint||'')!==String(scan.mint)){
      liveRow=await __mfTrackedLiveRowV27(scan.mint);
    }

    const decision=__mfScanDecisionV27(scan,liveRow);
    const buyContext=await __mfBuyContextV27(scan.mint,decision);

    state.query=liveRow?String(scan.mint):'';
    state.page=1;
    render();

    __mfScanRenderV27({scan,liveRow,buyContext});
  }catch(error){
    if(host){
      host.hidden=false;
      host.innerHTML=`<div class="mf-scan-error">${escapeHtml(error?.message||'Token analysis failed.')}</div>`;
    }
  }finally{
    __mfTokenScanBusyV27=false;
    if(button){
      button.disabled=false;
      button.textContent='Analyze';
    }
    __mfKickCardClockV19();
  }
}

$('refreshButton')
  .addEventListener(
    'click',
    ()=>{ void __mfAnalyzeTokenV27(); }
  );

$('tokenSearch')
  ?.addEventListener(
    'keydown',
    event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        void __mfAnalyzeTokenV27();
      }
    }
  );'''

if old_listener not in js:
    raise SystemExit("JS refresh listener anchor not found")
js = js.replace(old_listener, new_listener, 1)

html_path.write_text(html)
css_path.write_text(css)
js_path.write_text(js)
PY

if command -v node >/dev/null 2>&1; then
  node --check memeflow-app/system-tokens.js
fi

git diff --check
git add memeflow-app/system-tokens.html memeflow-app/system-tokens.css memeflow-app/system-tokens.js "$BACKUP"

git commit -m "upgrade token search to full standalone scan" || true
git push origin HEAD:main

echo
echo "DONE"
echo "Backup: $BACKUP"
echo "Refresh the Replit deployment after the push."
