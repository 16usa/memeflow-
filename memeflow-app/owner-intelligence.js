const $=id=>document.getElementById(id);

let ownerData=null;
let activeReport=null;
let busy=false;

function esc(value){
  return String(value??'')
    .replace(
      /[&<>"']/g,
      ch=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[ch]
    );
}

function num(value,digits=2){
  const n=Number(value);
  if(!Number.isFinite(n))return '—';

  return n.toLocaleString(
    undefined,
    {
      maximumFractionDigits:digits
    }
  );
}

function pct(value){
  return Number.isFinite(Number(value))
    ? `${num(value,2)}%`
    : '—';
}

async function api(
  path,
  options={}
){
  const response=await fetch(
    path,
    {
      credentials:'same-origin',
      cache:'no-store',
      ...options
    }
  );

  let payload={};

  try{
    payload=await response.json();
  }catch{}

  if(!response.ok){
    const error=new Error(
      payload?.message||
      payload?.error||
      `HTTP ${response.status}`
    );

    error.status=response.status;
    error.payload=payload;
    throw error;
  }

  return payload;
}

function renderAiStatus(ai={}){
  /* MEMEFLOW_OWNER_TRUTH_FIX_V31 */

  const node=$('aiStatus');
  if(!node)return;

  const configured=
    ai?.configured===true;

  const status=
    String(ai?.lastStatus||'unknown')
      .toLowerCase();

  const lastError=
    String(ai?.lastError||'');

  node.className='oi-ai-status';

  if(!configured){
    node.classList.add('offline');
    node.textContent='AI · NOT CONFIGURED';
    node.title='OpenAI API key is not configured.';
    return;
  }

  if(lastError==='AI_CREDITS_REQUIRED'){
    node.classList.add('offline');
    node.textContent='AI · NO CREDITS';
    node.title='OpenAI API billing/credits are unavailable.';
    return;
  }

  if(status==='online'){
    node.classList.add('online');
    node.textContent='AI · ONLINE';
    node.title='A successful Owner AI request was confirmed.';
    return;
  }

  if(status==='offline'){
    node.classList.add('offline');
    node.textContent='AI · OFFLINE';
    node.title='The most recent Owner AI request failed.';
    return;
  }

  node.textContent='AI · CONFIGURED';
  node.title=
    'OpenAI is configured, but online API access has not yet been confirmed.';
}


/* MEMEFLOW_PLATFORM_LEARNING_V2_UI_JS */

/* MEMEFLOW_UNKNOWN_OUTCOME_UI_V4 */
function platformFactorRows(rows=[]){
  if(!Array.isArray(rows)||!rows.length){
    return `
      <div class="oi-row">
        <span>
          Waiting for trades with saved entry snapshots.
          Older backfilled trades may not contain these entry metrics;
          new trades will populate this factor automatically.
        </span>
        <strong>—</strong>
      </div>
    `;
  }

  return rows.map(row=>{
    const total=
      Number(
        row?.totalCount ??
        row?.count ??
        0
      );

    const evaluable=
      Number(
        row?.pnlEvaluableCount ??
        row?.evaluableCount ??
        0
      );

    const hasWinRate=
      row?.winRatePct!==null &&
      row?.winRatePct!==undefined &&
      Number.isFinite(
        Number(row.winRatePct)
      );

    const hasAverage=
      row?.averagePnlPct!==null &&
      row?.averagePnlPct!==undefined &&
      Number.isFinite(
        Number(row.averagePnlPct)
      );

    const outcomeText=
      evaluable>0
        ? `${evaluable} evaluable · ${total} entries`
        : `0 evaluable · ${total} historical entries`;

    return `
      <div class="oi-factor-row">
        <strong>${esc(row.bucket)}</strong>

        <span>
          ${esc(outcomeText)}
        </span>

        <span>
          WR ${hasWinRate ? pct(row.winRatePct) : '—'}
        </span>

        <span>
          AVG ${hasAverage ? pct(row.averagePnlPct) : '—'}
        </span>
      </div>
    `;
  }).join('');
}

function renderPlatform(platform={}){
  const p=platform.performance||{};

  const users=$('platformUsers');
  if(!users)return;

  users.textContent=
    num(p.uniqueUsers,0);

  $('platformPositions').textContent=
    num(p.closedPositions,0);

  $('platformTrades').textContent=
    `${num(p.tradeEvents,0)} trade events`;

  const evaluable=
    Number(
      p.evaluablePositions||0
    );

  const unknownOutcomes=
    Number(
      p.unknownOutcomePositions||0
    );

  $('platformWinRate').textContent=
    evaluable>0 &&
    p.winRatePct!==null &&
    p.winRatePct!==undefined
      ? pct(p.winRatePct)
      : '—';

  $('platformWinsLosses').textContent=
    evaluable>0
      ? (
          `${num(p.wins,0)} wins · `+
          `${num(p.losses,0)} losses · `+
          `${num(p.flat,0)} flat`
        )
      : (
          `${num(evaluable,0)} evaluable · `+
          `${num(unknownOutcomes,0)} outcome unknown`
        );

  $('platformPnl').textContent=
    evaluable>0 &&
    p.realizedPnlSol!==null &&
    p.realizedPnlSol!==undefined
      ? `${num(p.realizedPnlSol,6)} SOL`
      : '—';

  $('platformScoreFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.score
    );

  $('platformHolderFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.holders
    );

  $('platformTop10Factors').innerHTML=
    platformFactorRows(
      platform?.factors?.top10
    );

  $('platformPressureFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.buyPressure
    );

  const reasons=
    Array.isArray(platform.closeReasons)
      ? platform.closeReasons
      : [];

  $('platformExitReasons').innerHTML=
    reasons.length
      ? reasons.map(row=>`
          <div class="oi-row">
            <span>${esc(row.name)}</span>
            <strong>${esc(row.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No completed exits yet</span>
            <strong>—</strong>
          </div>
        `;

  const sources=
    Array.isArray(platform.strategySources)
      ? platform.strategySources
      : [];

  $('platformStrategySources').innerHTML=
    sources.length
      ? sources.map(row=>`
          <div class="oi-row">
            <span>${esc(row.name)}</span>
            <strong>${esc(row.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No strategy data yet</span>
            <strong>—</strong>
          </div>
        `;
}

function renderOverview(data){
  ownerData=data;

  const digest=data?.digest||{};
  const perf=digest?.performance||{};
  const system=digest?.system||{};
  const decisions=digest?.decisions||{};

  $('pnlValue').textContent=
    `${num(perf.realizedPnlSol,6)} SOL`;

  $('pnlSub').textContent=
    `Today ${num(perf.dailyRealizedPnlSol,6)} SOL`;

  $('winRateValue').textContent=
    pct(perf.winRatePct);

  $('winRateSub').textContent=
    `${num(perf.wins,0)} wins · ${num(perf.losses,0)} losses`;

  $('positionsValue').textContent=
    num(perf.openPositions,0);

  $('positionsSub').textContent=
    `${num(perf.closedPositions,0)} closed`;

  $('engineValue').textContent=
    system?.scanner?.connected
      ? 'ONLINE'
      : 'DEGRADED';

  $('engineSub').textContent=
    `${String(system?.execution?.mode||'—').toUpperCase()} · ${String(system?.execution?.environment||'—').toUpperCase()}`;

  const states=decisions.states||{};

  $('decisionStats').innerHTML=[
    ['BUY READY',states['BUY READY']||0],
    ['WATCH',states.WATCH||0],
    ['WAITING',states.WAITING||0],
    ['BLOCKED',states.BLOCKED||0]
  ].map(([name,count])=>`
    <div class="oi-decision">
      <span>${esc(name)}</span>
      <strong>${esc(count)}</strong>
    </div>
  `).join('');

  const reasons=
    Array.isArray(decisions.topReasons)
      ? decisions.topReasons
      : [];

  $('reasonList').innerHTML=
    reasons.length
      ? reasons.map(r=>`
          <div class="oi-row">
            <span>${esc(String(r.name||'').replace('AI score','Score'))}</span>
            <strong>${esc(r.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No current reasons</span>
            <strong>—</strong>
          </div>
        `;

  const scanner=system.scanner||{};
  const execution=system.execution||{};

  $('healthList').innerHTML=[
    [
      'Pump WebSocket',
      scanner.connected
        ? 'CONNECTED'
        : 'DISCONNECTED'
    ],
    [
      'Subscription',
      scanner.subscribed
        ? 'ACTIVE'
        : 'PENDING'
    ],
    [
      'Hot tokens',
      scanner.hotTokens??'—'
    ],
    [
      'Scanner errors',
      scanner.errors??'—'
    ],
    [
      'Pre-open RPC',
      execution.preOpenRpcConfigured
        ? 'CONFIGURED'
        : 'NOT CONFIGURED'
    ],
    [
      'Kill switch',
      execution.killSwitch
        ? 'ACTIVE'
        : 'CLEAR'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  // MEMEFLOW_PLATFORM_LEARNING_V2
  renderPlatform(
    digest.platform||{}
  );

  renderAiStatus(data.ai);

  renderAudit(data.audit||[]);

  const reports=
    Array.isArray(data.reports)
      ? data.reports
      : [];

  if(reports.length){
    renderReport(reports[0]);
  }
}

function renderAudit(rows){
  $('auditList').innerHTML=
    rows.length
      ? rows.slice(0,15).map(row=>{
          const when=row?.at
            ? new Date(row.at).toLocaleString()
            : '—';

          let detail=row?.type||'EVENT';

          if(row?.setting){
            detail+=
              ` · ${row.setting}: `+
              `${String(row.from)} → ${String(row.to)}`;
          }

          return `
            <div class="oi-row">
              <span>${esc(when)}</span>
              <strong>${esc(detail)}</strong>
            </div>
          `;
        }).join('')
      : `
          <div class="oi-row">
            <span>No owner AI changes yet</span>
            <strong>—</strong>
          </div>
        `;
}

function renderReport(report){
  if(!report?.result)return;

  activeReport=report;

  $('coachEmpty').hidden=true;
  $('coachReport').hidden=false;

  const r=report.result;

  $('executiveSummary').textContent=
    r.executiveSummary||'—';

  $('performanceAssessment').textContent=
    r.performanceAssessment||'—';

  $('healthAssessment').textContent=
    r.healthAssessment||'—';

  const findings=
    Array.isArray(r.findings)
      ? r.findings
      : [];

  $('findingsList').innerHTML=
    findings.length
      ? findings.map(f=>`
          <div class="oi-finding">
            <div class="oi-finding-head">
              <span>${esc(f.title)}</span>
              <span class="oi-severity">
                ${esc(f.severity)}
              </span>
            </div>
            <p>${esc(f.evidence)}</p>
          </div>
        `).join('')
      : '<div class="oi-empty">No findings.</div>';

  const proposals=
    Array.isArray(r.proposals)
      ? r.proposals
      : [];

  $('proposalList').innerHTML=
    proposals.length
      ? proposals
          .map(
            (p,index)=>
              proposalHtml(
                report,
                p,
                index
              )
          )
          .join('')
      : `
          <div class="oi-empty">
            AI recommends no changes yet.
          </div>
        `;

  bindProposalButtons();
}

function proposalHtml(
  report,
  p,
  index
){
  const settingChange=
    p.type==='SETTING_CHANGE';

  const diff=
    settingChange
      ? `
          <div class="oi-setting-diff">
            <code>
              ${esc(p.setting||'SETTING')}
            </code>
            <code>
              ${esc(p.current)}
            </code>
            <span>→</span>
            <code>
              ${esc(p.proposed)}
            </code>
          </div>
        `
      : '';

  const buttons=
    p.applyEligible===true
      ? `
          <button
            class="oi-btn"
            data-shadow="${index}"
            data-report="${esc(report.id)}"
            type="button"
          >
            SHADOW TEST
          </button>

          <button
            class="oi-btn primary"
            data-apply="${index}"
            data-report="${esc(report.id)}"
            type="button"
          >
            APPLY
          </button>
        `
      : `
          <button
            class="oi-btn"
            data-discuss="${index}"
            type="button"
          >
            DISCUSS WITH AI
          </button>
        `;

  return `
    <article
      class="oi-proposal"
      data-proposal-row="${index}"
    >
      <div class="oi-proposal-top">
        <div>
          <div class="oi-proposal-title">
            ${esc(p.title)}
          </div>

          <div class="oi-proposal-type">
            ${esc(p.type)}
            · ${esc(p.priority)}
            · ${esc(p.confidence)}%
          </div>
        </div>
      </div>

      ${diff}

      <p>
        <strong>Why:</strong>
        ${esc(p.reason)}
      </p>

      <p>
        <strong>Evidence:</strong>
        ${esc(p.evidence)}
      </p>

      <p>
        <strong>Expected:</strong>
        ${esc(p.expectedEffect)}
      </p>

      <p>
        <strong>Risk:</strong>
        ${esc(p.risk)}
      </p>

      <p>
        <strong>Test:</strong>
        ${esc(p.testPlan)}
      </p>

      <div class="oi-proposal-actions">
        ${buttons}
      </div>

      <div
        class="oi-shadow"
        data-shadow-output="${index}"
        hidden
      ></div>
    </article>
  `;
}

function bindProposalButtons(){
  document
    .querySelectorAll('[data-shadow]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>runShadow(button)
      );
    });

  document
    .querySelectorAll('[data-apply]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>applyProposal(button)
      );
    });

  document
    .querySelectorAll('[data-discuss]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>{
          const index=
            Number(button.dataset.discuss);

          const p=
            activeReport
              ?.result
              ?.proposals
              ?.[index];

          if(!p)return;

          $('chatInput').value=
            `Let's discuss this recommendation before changing anything:\n${p.title}\n\nWhy do you recommend it, what evidence is missing, and how should I test it safely?`;

          $('chatInput').focus();
        }
      );
    });
}

async function runShadow(button){
  if(busy)return;

  const index=
    Number(button.dataset.shadow);

  const reportId=
    String(button.dataset.report||'');

  const output=
    document.querySelector(
      `[data-shadow-output="${index}"]`
    );

  busy=true;
  button.disabled=true;
  button.textContent='TESTING…';

  try{
    const result=await api(
      '/api/owner/intelligence/shadow',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          reportId,
          proposalIndex:index
        })
      }
    );

    const before=
      result?.currentShadow?.counts||{};

    const after=
      result?.proposedShadow?.counts||{};

    if(output){
      output.hidden=false;
      output.textContent=
        `LIVE FEED SHADOW · `+
        `${result.setting}: `+
        `${String(result.current)} → ${String(result.proposed)}\n`+
        `BUY READY ${before['BUY READY']||0} → ${after['BUY READY']||0} · `+
        `WATCH ${before.WATCH||0} → ${after.WATCH||0} · `+
        `BLOCKED ${before.BLOCKED||0} → ${after.BLOCKED||0}\n`+
        `No settings were changed.`;
    }

  }catch(error){
    if(output){
      output.hidden=false;
      output.textContent=
        error?.payload?.validationErrors?.join('\n')||
        error.message;
    }

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='SHADOW TEST';
  }
}

async function applyProposal(button){
  if(busy)return;

  const index=
    Number(button.dataset.apply);

  const reportId=
    String(button.dataset.report||'');

  const proposal=
    activeReport
      ?.result
      ?.proposals
      ?.[index];

  if(!proposal)return;

  const confirmed=window.confirm(
    `Apply owner-approved setting change?\n\n`+
    `${proposal.setting}: `+
    `${String(proposal.current)} → `+
    `${String(proposal.proposed)}\n\n`+
    `MEMEFLOW will re-evaluate current candidates after application.`
  );

  if(!confirmed)return;

  busy=true;
  button.disabled=true;
  button.textContent='APPLYING…';

  try{
    const result=await api(
      '/api/owner/intelligence/apply',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          reportId,
          proposalIndex:index,
          confirm:'APPLY'
        })
      }
    );

    alert(
      `Applied:\n`+
      `${result.setting}: `+
      `${String(result.from)} → `+
      `${String(result.to)}`
    );

    await load();

  }catch(error){
    alert(
      error?.payload?.validationErrors?.join('\n')||
      error.message
    );

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='APPLY';
  }
}

async function analyze(){
  if(busy)return;

  const button=$('analyzeBtn');
  busy=true;

  button.disabled=true;
  button.textContent='OPENAI ANALYZING…';

  try{
    const result=await api(
      '/api/owner/intelligence/analyze',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          focus:
            $('focusInput').value.trim()
        })
      }
    );

    renderReport(result.report);

    await load({
      preserveReport:true
    });

  }catch(error){
    const message=
      error?.payload?.message||
      error.message;

    addChat(
      'assistant',
      message,
      true
    );

    await load({
      preserveReport:true
    });

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='ANALYZE PERFORMANCE';
  }
}

function addChat(
  role,
  text,
  error=false
){
  const node=document.createElement('div');

  node.className=
    `oi-chat-message ${role}`+
    (error?' error':'');

  node.textContent=String(text||'');

  $('ownerChat').appendChild(node);
  $('ownerChat').scrollTop=
    $('ownerChat').scrollHeight;
}

async function sendChat(){
  if(busy)return;

  const input=$('chatInput');
  const message=input.value.trim();

  if(!message)return;

  addChat('user',message);
  input.value='';

  const button=$('chatSendBtn');

  busy=true;
  button.disabled=true;
  button.textContent='THINKING…';

  try{
    const result=await api(
      '/api/owner/intelligence/chat',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          message
        })
      }
    );

    addChat(
      'assistant',
      result.text
    );

  }catch(error){
    addChat(
      'assistant',
      error?.payload?.message||
      error.message,
      true
    );

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='SEND';
  }
}

async function load(
  {
    preserveReport=false
  }={}
){
  try{
    const data=await api(
      '/api/owner/intelligence'
    );

    $('accessError').hidden=true;
    $('ownerApp').hidden=false;

    const previous=
      preserveReport
        ? activeReport
        : null;

    renderOverview(data);

    if(previous){
      renderReport(previous);
    }

  }catch(error){
    if(
      error.status===401 ||
      error.status===403
    ){
      $('ownerApp').hidden=true;
      $('accessError').hidden=false;

      // MEMEFLOW_OWNER_ACCESS_UI_V1
      queueMicrotask(()=>{
        try{mfBindOwnerAccess()}catch{}
      });

      return;
    }

    $('ownerApp').hidden=true;
    $('accessError').hidden=false;
    $('accessError').textContent=
      `OWNER INTELLIGENCE ERROR: ${error.message}`;
  }
}

$('refreshBtn')
  .addEventListener(
    'click',
    ()=>load()
  );

$('analyzeBtn')
  .addEventListener(
    'click',
    analyze
  );

$('chatSendBtn')
  .addEventListener(
    'click',
    sendChat
  );

$('chatInput')
  .addEventListener(
    'keydown',
    event=>{
      if(
        event.key==='Enter' &&
        !event.shiftKey &&
        !event.isComposing
      ){
        event.preventDefault();
        sendChat();
      }
    }
  );

load();

/* =========================================================
   MEMEFLOW_OWNER_ACCESS_UI_V1
   Uses existing protected /api/owner/claim.
   Does not weaken owner authorization.
   ========================================================= */

async function mfClaimOwnerAccess(){
  const input=document.getElementById('ownerAccessKey');
  const button=document.getElementById('ownerUnlockBtn');
  const message=document.getElementById('ownerAccessMessage');

  const accessKey=String(input?.value||'').trim();

  if(!accessKey){
    if(message){
      message.textContent='Enter the Owner Access Key.';
      message.dataset.state='error';
    }
    return;
  }

  if(button){
    button.disabled=true;
    button.textContent='VERIFYING…';
  }

  if(message){
    message.textContent='Verifying owner access…';
    message.dataset.state='working';
  }

  try{
    const response=await fetch(
      '/api/owner/claim',
      {
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          'content-type':'application/json',
          'accept':'application/json'
        },
        body:JSON.stringify({
          accessKey
        })
      }
    );

    let payload={};

    try{
      payload=await response.json();
    }catch{}

    if(
      !response.ok ||
      payload?.isOwner!==true
    ){
      throw new Error(
        payload?.message ||
        payload?.error ||
        'Owner access was not accepted.'
      );
    }

    // Never retain the owner key in the DOM longer than necessary.
    if(input){
      input.value='';
    }

    if(message){
      message.textContent='OWNER VERIFIED · opening dashboard…';
      message.dataset.state='success';
    }

    // Same session cookie now owns the grant.
    setTimeout(
      ()=>window.location.reload(),
      250
    );

  }catch(error){
    if(input){
      input.value='';
      input.focus();
    }

    if(message){
      message.textContent=
        'Owner verification failed. Check the Owner Access Key.';
      message.dataset.state='error';
    }

  }finally{
    if(button){
      button.disabled=false;
      button.textContent='UNLOCK OWNER';
    }
  }
}

function mfBindOwnerAccess(){
  const button=
    document.getElementById('ownerUnlockBtn');

  const input=
    document.getElementById('ownerAccessKey');

  if(button && !button.dataset.bound){
    button.dataset.bound='1';

    button.addEventListener(
      'click',
      mfClaimOwnerAccess
    );
  }

  if(input && !input.dataset.bound){
    input.dataset.bound='1';

    input.addEventListener(
      'keydown',
      event=>{
        if(
          event.key==='Enter' &&
          !event.isComposing
        ){
          event.preventDefault();
          mfClaimOwnerAccess();
        }
      }
    );
  }
}

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',
    mfBindOwnerAccess,
    {once:true}
  );
}else{
  mfBindOwnerAccess();
}
