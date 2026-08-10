#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"

if [[ -f "$ROOT/memeflow-app/index.html" ]]; then
  TARGET="$ROOT/memeflow-app/index.html"
elif [[ -f "$ROOT/index.html" ]]; then
  TARGET="$ROOT/index.html"
else
  echo "ERROR: memeflow-app/index.html not found. Run this from ~/workspace."
  exit 1
fi

BACKUP_DIR="$(dirname "$TARGET")/.memeflow-patches/pretrade-control-center-v2"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/index.html.$STAMP.bak"
cp "$TARGET" "$BACKUP"
printf '%s\n' "$BACKUP" > "$BACKUP_DIR/latest-backup.txt"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

if 'data-mf-pretrade-v2="1"' in src:
    print("PRE-TRADE CONTROL CENTER V2 is already installed.")
    raise SystemExit(0)

new_execution = r'''<section class="execution-preview active locked" id="executionPreview" data-mf-pretrade-v2="1">
<div class="execution-head"><h2>Pre-trade checks</h2><span class="state wait" id="executionState">LOCKED</span></div>

<div aria-live="polite" class="execution-readiness">
  <div class="execution-readiness-main">
    <div><small>Pre-trade readiness</small><b id="executionReadinessCount">0 / 10 checks</b></div>
    <div class="readiness-label" id="executionReadinessLabel">Market and AI validation pending</div>
  </div>
  <div class="readiness-track"><i id="executionReadinessBar"></i></div>
</div>

<div class="signal-explainer" id="executionSignalExplainer"><b>AI signal:</b> WAITING &nbsp;·&nbsp; <b>Execution:</b> LOCKED</div>

<div aria-live="polite" class="primary-blocker" id="primaryBlocker">
  <div>
    <small>Primary blocker</small>
    <b id="primaryBlockerTitle">AI BUY READY</b>
    <span id="primaryBlockerText">Waiting for the AI decision to reach BUY READY.</span>
  </div>
  <a class="btn execution-decision-link" data-mf-button-icon-v1="pretrade-decision" href="#primary-candidate" id="primaryBlockerAction">View decision</a>
</div>

<button class="btn mf-pm-check-toggle" data-mf-button-icon-v1="pretrade-toggle" id="executionChecksToggle" type="button" aria-expanded="false" aria-controls="executionCheckList">
  <span id="executionChecksToggleLabel">All checks</span>
  <span class="mf-pm-check-count" id="executionPendingCount">10 pending</span>
  <svg class="mf-pm-check-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>

<div class="data-list execution-check-list" id="executionCheckList" role="list" hidden></div>

<!-- Compatibility state anchors used by the existing LIVE/wallet bridges.
     They preserve existing state ownership without rendering duplicate UI. -->
<div class="execution-state-anchors" hidden aria-hidden="true">
  <span id="executionSize">—</span>
  <span id="quoteAge">—</span>
  <span id="executionSlippage">—</span>
  <span id="executionRiskGate">PENDING</span>
  <span id="walletBalanceGate">—</span>
  <span id="walletExecutionGate">NOT CONNECTED</span>
  <span id="executionRouteGate">PENDING</span>
</div>
</section>'''

pattern_execution = re.compile(
    r'<section class="execution-preview active locked" id="executionPreview">.*?</section>\s*'
    r'(?=<section class="grid" id="positions")',
    re.S
)
matches = list(pattern_execution.finditer(src))
if len(matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly 1 current #executionPreview block, found {len(matches)}. Nothing was written."
    )
src = pattern_execution.sub(new_execution + "\n", src, count=1)

new_css = r'''  /* 6) Pre-trade Control Center V2.
     UI reads the exact gate array already produced by the existing
     PAPER/LIVE readiness logic. No trading/business rules live here. */
  #executionPreview{
    margin:10px 0!important;
    padding:0!important;
    border-radius:16px!important;
    border-color:var(--mf-pm-line-strong)!important;
    background:rgba(8,12,17,.88)!important;
    box-shadow:none!important;
    overflow:hidden!important;
  }
  #executionPreview .execution-head{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:12px!important;
    padding:12px 13px 10px!important;
    margin:0!important;
    border-bottom:1px solid var(--mf-pm-line)!important;
  }
  #executionPreview .execution-head h2{
    margin:0!important;
    font-size:16px!important;
    line-height:1.15!important;
    letter-spacing:-.025em!important;
  }
  #executionPreview .execution-head .state{
    flex:0 0 auto!important;
    margin:0!important;
  }
  #executionPreview .execution-readiness{
    margin:0!important;
    padding:11px 13px 10px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
  }
  #executionPreview .execution-readiness-main{
    display:flex!important;
    align-items:flex-end!important;
    justify-content:space-between!important;
    gap:12px!important;
    min-width:0!important;
  }
  #executionPreview .execution-readiness-main>div:first-child{
    min-width:max-content!important;
  }
  #executionPreview .execution-readiness small{
    display:block!important;
    margin:0 0 4px!important;
    color:#7e8c9d!important;
    font-size:8px!important;
    line-height:1!important;
    font-weight:760!important;
    letter-spacing:.14em!important;
    text-transform:uppercase!important;
  }
  #executionPreview #executionReadinessCount{
    display:block!important;
    font-size:17px!important;
    line-height:1.1!important;
    letter-spacing:-.03em!important;
    font-variant-numeric:tabular-nums!important;
  }
  #executionPreview .readiness-label{
    min-width:0!important;
    max-width:55%!important;
    color:#8593a4!important;
    font-size:9px!important;
    line-height:1.28!important;
    text-align:right!important;
  }
  #executionPreview .readiness-track{
    width:100%!important;
    height:5px!important;
    margin-top:9px!important;
    overflow:hidden!important;
    border:0!important;
    border-radius:999px!important;
    background:rgba(255,255,255,.055)!important;
  }
  #executionPreview .readiness-track i{
    display:block!important;
    width:0;
    height:100%!important;
    border-radius:inherit!important;
    background:linear-gradient(90deg,var(--cyan),var(--green))!important;
    transition:width .2s ease!important;
  }
  #executionPreview .signal-explainer{
    margin:0 13px 9px!important;
    padding:9px 10px!important;
    border:1px solid rgba(84,221,255,.16)!important;
    border-radius:10px!important;
    background:rgba(84,221,255,.025)!important;
    color:#aab6c4!important;
    font-size:10px!important;
    line-height:1.38!important;
  }
  #executionPreview .signal-explainer b{
    color:#e6edf4!important;
    font-weight:780!important;
  }
  #executionPreview .primary-blocker{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:10px!important;
    align-items:center!important;
    margin:0 13px 9px!important;
    padding:10px 10px 10px 11px!important;
    border:1px solid rgba(242,198,104,.16)!important;
    border-radius:11px!important;
    background:rgba(242,198,104,.025)!important;
  }
  #executionPreview .primary-blocker>div{
    min-width:0!important;
  }
  #executionPreview .primary-blocker small{
    display:block!important;
    margin:0 0 4px!important;
    color:var(--yellow)!important;
    font-size:8px!important;
    line-height:1!important;
    font-weight:850!important;
    letter-spacing:.13em!important;
    text-transform:uppercase!important;
  }
  #executionPreview .primary-blocker b{
    display:block!important;
    margin:0!important;
    color:#f0f4f8!important;
    font-size:11.5px!important;
    line-height:1.25!important;
  }
  #executionPreview .primary-blocker span{
    display:block!important;
    margin-top:4px!important;
    color:#8795a6!important;
    font-size:9.5px!important;
    line-height:1.34!important;
  }
  #executionPreview .execution-decision-link{
    min-height:36px!important;
    height:36px!important;
    margin:0!important;
    padding:0 10px!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    border-radius:9px!important;
    white-space:nowrap!important;
    font-size:9.5px!important;
    font-weight:760!important;
  }
  #executionPreview .mf-pm-check-toggle{
    width:calc(100% - 26px)!important;
    min-height:44px!important;
    height:44px!important;
    margin:0 13px 12px!important;
    padding:0 11px 0 12px!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto 18px!important;
    align-items:center!important;
    gap:8px!important;
    border:1px solid var(--mf-pm-line-strong)!important;
    border-radius:10px!important;
    background:rgba(255,255,255,.012)!important;
    color:#dce5ee!important;
    box-shadow:none!important;
    text-align:left!important;
    font-size:10px!important;
    font-weight:760!important;
    cursor:pointer!important;
    touch-action:manipulation!important;
    -webkit-tap-highlight-color:transparent!important;
  }
  #executionPreview .mf-pm-check-toggle:hover,
  #executionPreview .mf-pm-check-toggle:focus-visible{
    border-color:rgba(84,221,255,.26)!important;
    background:rgba(84,221,255,.025)!important;
  }
  #executionPreview .mf-pm-check-count{
    color:#8391a2!important;
    font-size:9px!important;
    font-weight:650!important;
    white-space:nowrap!important;
  }
  #executionPreview .mf-pm-check-chevron{
    width:17px!important;
    height:17px!important;
    display:block!important;
    color:#93a1b1!important;
    transform:rotate(0deg)!important;
    transition:transform .16s ease!important;
  }
  #executionPreview.mf-pm-checks-open .mf-pm-check-chevron{
    transform:rotate(90deg)!important;
  }
  #executionPreview .execution-check-list[hidden]{
    display:none!important;
  }
  #executionPreview .execution-check-list{
    margin:-2px 13px 12px!important;
    padding:0!important;
    overflow:hidden!important;
    border:1px solid var(--mf-pm-line)!important;
    border-radius:10px!important;
    background:rgba(255,255,255,.009)!important;
  }
  #executionPreview .execution-check-row{
    min-height:42px!important;
    padding:0 10px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:12px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
  }
  #executionPreview .execution-check-row+.execution-check-row{
    border-top:1px solid var(--mf-pm-line)!important;
  }
  #executionPreview .execution-check-name{
    min-width:0!important;
    display:flex!important;
    align-items:center!important;
    gap:8px!important;
  }
  #executionPreview .execution-check-name i{
    width:7px!important;
    height:7px!important;
    flex:0 0 7px!important;
    display:block!important;
    border-radius:50%!important;
    background:#7c8998!important;
    box-shadow:none!important;
  }
  #executionPreview .execution-check-name b{
    min-width:0!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
    color:#cbd5df!important;
    font-size:10px!important;
    font-weight:640!important;
  }
  #executionPreview .execution-check-row em{
    flex:0 0 auto!important;
    font-style:normal!important;
    font-size:8.5px!important;
    font-weight:850!important;
    letter-spacing:.08em!important;
  }
  #executionPreview .execution-check-row.pass .execution-check-name i{background:var(--green)!important}
  #executionPreview .execution-check-row.pass em{color:var(--green)!important}
  #executionPreview .execution-check-row.pending .execution-check-name i{background:var(--yellow)!important}
  #executionPreview .execution-check-row.pending em{color:var(--yellow)!important}
  #executionPreview .execution-check-row.blocked .execution-check-name i{background:var(--red)!important}
  #executionPreview .execution-check-row.blocked em{color:var(--red)!important}
  #executionPreview .execution-state-anchors{
    display:none!important;
  }

'''

pattern_css = re.compile(
    r'  /\* 6\) Pre-trade: summary first, detailed seven-check grid on demand\. \*/.*?'
    r'(?=  /\* 7\) Billing:)',
    re.S
)
css_matches = list(pattern_css.finditer(src))
if len(css_matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly 1 Premium Mobile pre-trade CSS section, found {len(css_matches)}. Nothing was written."
    )
src = pattern_css.sub(new_css, src, count=1)

src, border_changes = re.subn(
    r'#executionPreview\{border-color:rgba\(242,198,104,\.25\)!important\}',
    '#executionPreview{border-color:var(--mf-pm-line-strong)!important}',
    src,
    count=1
)
if border_changes != 1:
    raise SystemExit(
        f"ERROR: expected exactly 1 old mobile executionPreview amber-border rule, found {border_changes}."
    )

old_toggle_pattern = re.compile(
    r'''  function installChecksToggle\(\)\{.*?^  \}\n\n  function init\(\)\{\n'''
    r'''    tagManualScan\(\);\n'''
    r'''    syncPrimaryEmpty\(\);\n'''
    r'''    installChecksToggle\(\);\n'''
    r'''  \}''',
    re.S | re.M
)

new_toggle = r'''  function bindChecksToggle(){
    const host=q('#executionPreview');
    const btn=q('#executionChecksToggle',host||document);
    const list=q('#executionCheckList',host||document);
    const label=q('#executionChecksToggleLabel',host||document);
    if(!host||!btn||!list||btn.dataset.mfBound==='1')return;

    btn.dataset.mfBound='1';
    btn.addEventListener('click',()=>{
      const open=host.classList.toggle('mf-pm-checks-open');
      btn.setAttribute('aria-expanded',String(open));
      list.hidden=!open;
      if(label)label.textContent=open?'Hide checks':'All checks';
    });
  }

  function init(){
    tagManualScan();
    syncPrimaryEmpty();
    bindChecksToggle();
  }'''

toggle_matches = list(old_toggle_pattern.finditer(src))
if len(toggle_matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly 1 current installChecksToggle() implementation, found {len(toggle_matches)}. Nothing was written."
    )
src = old_toggle_pattern.sub(new_toggle, src, count=1)

sync_pattern = re.compile(
    r''' const gates=paperMode\?paperGates:liveGates;.*?'''
    r''' const preview=\$\('#executionPreview'\);\n'''
    r''' if\(preview\)preview\.classList\.toggle\('locked',!safe\);''',
    re.S
)

new_sync = r''' const gates=paperMode?paperGates:liveGates;
 const passed=gates.filter(g=>g.pass).length;
 const safe=passed===gates.length;
 const failedGates=gates.filter(g=>!g.pass);

 const hardPaperCodes=new Set([
   'POSITION_EXISTS',
   'MAX_OPEN_POSITIONS',
   'MAX_DAILY_ENTRIES',
   'INVALID_POSITION_SIZE',
   'DAILY_SPEND_LIMIT',
   'PAPER_CAPITAL_LIMIT',
   'KILL_SWITCH',
   'DAILY_LOSS_LIMIT'
 ]);

 const uiStateForGate=gate=>{
   if(gate?.pass===true)return {label:'PASS',cls:'pass'};
   if(
     String(gate?.name||'').toUpperCase()==='AI BUY READY' &&
     String(state||'').toUpperCase()==='BLOCKED'
   )return {label:'BLOCKED',cls:'blocked'};
   if(paperMode && hardPaperCodes.has(String(gate?.code||''))){
     return {label:'BLOCKED',cls:'blocked'};
   }
   return {label:'PENDING',cls:'pending'};
 };

 const gateUi=gates.map(g=>({...g,ui:uiStateForGate(g)}));
 const blockedCount=gateUi.filter(g=>g.ui.cls==='blocked').length;
 const pendingCount=gateUi.filter(g=>g.ui.cls==='pending').length;

 text('#executionReadinessCount',passed+' / '+gates.length+' checks');
 text(
   '#executionReadinessLabel',
   safe
     ? (paperMode?'Paper execution ready':'All pre-trade checks passed')
     : blockedCount
       ? blockedCount+' blocked · '+pendingCount+' pending'
       : pendingCount+' pending'
 );

 const bar=$('#executionReadinessBar');
 if(bar){
   bar.style.width=Math.round(passed/gates.length*100)+'%';
 }

 const execState=$('#executionState');
 if(execState){
   execState.textContent=safe
     ? (paperMode?'PAPER READY':'SAFE')
     : 'LOCKED';
   execState.className='state '+(safe?'buy':'wait');
 }

 const explainer=$('#executionSignalExplainer');
 if(explainer){
   explainer.innerHTML=
     '<b>AI signal:</b> '+state+
     ' &nbsp;·&nbsp; <b>Execution:</b> '+
     (safe
       ? (paperMode?'PAPER READY':'SAFE TO VALIDATE')
       : 'LOCKED');
 }

 text('#executionSize',Number.isFinite(positionSize)?positionSize+' SOL':'—');
 text('#quoteAge',paperMode?'NOT REQUIRED':fmt.age(quoteAge));
 text('#executionSlippage',paperMode?'NOT REQUIRED':(finite(c?.slippagePct)?fmt.pct(c.slippagePct):'—'));

 const risk=$('#executionRiskGate');
 if(risk){
   risk.textContent=riskReady?'PASS':'PENDING';
   risk.style.color=riskReady?'var(--green)':'var(--yellow)';
 }

 const route=$('#executionRouteGate');
 if(route){
   route.textContent=routeReady?'PASS':'PENDING';
   route.style.color=routeReady?'var(--green)':'var(--yellow)';
 }

 const walletGate=$('#walletExecutionGate');
 if(walletGate && paperMode){
   walletGate.textContent='NOT REQUIRED';
   walletGate.style.color='var(--green)';
 }

 const balanceGate=$('#walletBalanceGate');
 if(balanceGate && paperMode){
   balanceGate.textContent='PAPER';
   balanceGate.style.color='var(--green)';
 }

 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
   '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
 }[ch]));

 const list=$('#executionCheckList');
 if(list){
   list.innerHTML=gateUi.map(g=>
     '<div class="data-row execution-check-row '+g.ui.cls+'" role="listitem" data-gate-code="'+
       escapeHtml(g.code||'')+'">'+
       '<span class="execution-check-name"><i aria-hidden="true"></i><b>'+
         escapeHtml(g.name||'Check')+
       '</b></span>'+
       '<em>'+g.ui.label+'</em>'+
     '</div>'
   ).join('');
 }

 const countLabel=$('#executionPendingCount');
 if(countLabel){
   countLabel.textContent=safe
     ? 'All passed'
     : blockedCount
       ? blockedCount+' blocked · '+pendingCount+' pending'
       : pendingCount+' pending';
 }

 const firstBlocked=gateUi.find(g=>!g.pass)||null;
 const blockerMessage=gate=>{
   if(!gate)return paperMode
     ? 'All paper execution checks passed.'
     : 'The selected candidate is eligible for final validation.';

   if(String(gate.name||'').toUpperCase()==='AI BUY READY'){
     return String(state||'').toUpperCase()==='BLOCKED'
       ? 'The current AI decision is BLOCKED by the evaluation gates.'
       : 'Waiting for the AI decision to reach BUY READY.';
   }

   const messages={
     INVALID_PRICE:'Waiting for a valid verified token price.',
     STALE_DECISION:'Waiting for a fresh decision snapshot.',
     STALE_TOKEN_DATA:'Waiting for fresh holder and token evidence.',
     POSITION_EXISTS:'A PAPER position for this token is already open.',
     MAX_OPEN_POSITIONS:'The configured maximum number of open positions has been reached.',
     MAX_DAILY_ENTRIES:'The configured daily entry limit has been reached.',
     INVALID_POSITION_SIZE:'Position size is outside the configured limits.',
     DAILY_SPEND_LIMIT:'This entry would exceed the configured daily spend limit.',
     PAPER_CAPITAL_LIMIT:'Available PAPER capital is insufficient for this entry.',
     KILL_SWITCH:'The account kill switch is active.',
     DAILY_LOSS_LIMIT:'The configured daily loss limit is active.'
   };
   return messages[String(gate.code||'')] || (gate.name+' has not passed yet.');
 };

 text(
   '#primaryBlockerTitle',
   safe
     ? (paperMode?'Paper execution ready':'All checks passed')
     : (firstBlocked?.name||'Validation pending')
 );
 text('#primaryBlockerText',blockerMessage(firstBlocked));

 const blockerAction=$('#primaryBlockerAction');
 if(blockerAction){
   blockerAction.textContent=safe
     ? (paperMode?'View positions':'Validate execution')
     : 'View decision';

   blockerAction.href=safe
     ? (paperMode?'#positions':'#executionPreview')
     : '#primary-candidate';
 }

 const validate=$('#validateBtn');
 if(validate){
   validate.disabled=!safe;
   validate.setAttribute('aria-disabled',String(!safe));
 }

 const preview=$('#executionPreview');
 if(preview){
   preview.classList.toggle('locked',!safe);
   preview.dataset.executionMode=paperMode?'paper':'live';
 }'''

sync_matches = list(sync_pattern.finditer(src))
if len(sync_matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly 1 current readiness presentation block, found {len(sync_matches)}. Nothing was written."
    )
src = sync_pattern.sub(new_sync, src, count=1)

checks = {
    'V2 source marker': src.count('data-mf-pretrade-v2="1"') == 1,
    'one executionPreview': src.count('id="executionPreview"') == 1,
    'one readiness count': src.count('id="executionReadinessCount"') == 1,
    'one check list': src.count('id="executionCheckList"') == 1,
    'one static check toggle': src.count('id="executionChecksToggle"') == 1,
    'old runtime creator removed': 'function installChecksToggle()' not in src,
    'old seven-card mobile CSS removed': 'detailed seven-check grid on demand' not in src,
    'old execution grid markup removed': '<div class="execution-grid">' not in src,
    'old execution verdict markup removed': '<div class="execution-verdict">' not in src,
    'server endpoint untouched': '/api/paper/readiness?mint=' in src,
    'existing gate selection retained': 'const gates=paperMode?paperGates:liveGates;' in src,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('ERROR: verification failed: ' + ', '.join(failed))

path.write_text(src, encoding="utf-8")

print("PRE-TRADE CONTROL CENTER V2 installed.")
print("Changed source HTML: #executionPreview")
print("Changed existing CSS section: Premium Mobile pre-trade")
print("Changed existing JS: static toggle binding + readiness renderer")
print("Trading/PAPER server logic: NOT CHANGED")
print("/api/paper/readiness: NOT CHANGED")
print("PaperEngine.entryReadiness(): NOT CHANGED")
PY

if ! grep -q 'data-mf-pretrade-v2="1"' "$TARGET"; then
  echo "ERROR: V2 marker missing after install. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if grep -q 'function installChecksToggle()' "$TARGET"; then
  echo "ERROR: old runtime toggle creator still present. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if grep -q '<div class="execution-grid">' "$TARGET"; then
  echo "ERROR: old seven-card execution grid still present. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

echo
echo "OK: PRE-TRADE CONTROL CENTER V2 installed cleanly."
echo "File: $TARGET"
echo "Backup: $BACKUP"
echo
echo "No overlay."
echo "No new <style> layer."
echo "No cloned execution block."
echo "No trading/server gate changes."
echo
echo "Now: Stop -> Run, then refresh the page."
