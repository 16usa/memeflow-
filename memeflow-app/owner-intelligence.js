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

/* MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15_UI_JS */
function scorecardTone(card={}){
  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  if(blockers.length){
    return 'warn';
  }

  const p=Number(card?.probabilityPositivePct);
  const c=Number(card?.confidencePct);

  if(
    Number.isFinite(p) &&
    Number.isFinite(c) &&
    p>=62 &&
    c>=50
  ){
    return 'positive';
  }

  if(
    Number.isFinite(p) &&
    p<=38
  ){
    return 'negative';
  }

  return 'neutral';
}

function scorecardCardHtml(card={}){
  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  const probability=
    Number(card?.probabilityPositivePct);

  const confidence=
    Number(card?.confidencePct);

  return `
    <button
      type="button"
      class="oi-scorecard-card ${scorecardTone(card)}"
      data-scorecard-mint="${esc(card?.mint||'')}"
    >
      <div class="oi-scorecard-card-head">
        <strong>${esc(card?.mint||'UNKNOWN')}</strong>
        <span>${esc(String(card?.stage||'—'))}</span>
      </div>

      <div class="oi-scorecard-card-main">
        <div>
          <small>V23 probability</small>
          <b>
            ${
              Number.isFinite(probability)
                ? `${num(probability,1)}%`
                : '—'
            }
          </b>
        </div>

        <div>
          <small>confidence</small>
          <b>
            ${
              Number.isFinite(confidence)
                ? `${num(confidence,1)}%`
                : '—'
            }
          </b>
        </div>

        <div>
          <small>evidence</small>
          <b>${num(card?.evidenceReadinessPct,1)}%</b>
        </div>
      </div>

      <div class="oi-scorecard-card-foot">
        <span>
          ${esc(String(card?.direction||'UNKNOWN'))}
          · ${esc(String(card?.trajectory?.state||'COLD'))}
        </span>
        <span>
          ${
            blockers.length
              ? `${blockers.length} blocker${blockers.length===1?'':'s'}`
              : 'clear'
          }
        </span>
      </div>
    </button>
  `;
}

function renderTokenScorecardDetail(card={}){
  const node=$('tokenScorecardDetail');
  if(!node)return;

  const factors=
    Array.isArray(card?.factorRows)
      ? card.factorRows
      : [];

  const blockers=
    Array.isArray(card?.blockers)
      ? card.blockers
      : [];

  node.hidden=false;

  node.innerHTML=`
    <div class="oi-scorecard-detail-head">
      <div>
        <span class="oi-eyebrow">TOKEN INTELLIGENCE</span>
        <h3>${esc(card?.mint||'UNKNOWN')}</h3>
      </div>

      <span class="oi-scorecard-direction ${scorecardTone(card)}">
        ${esc(String(card?.direction||'UNKNOWN'))}
      </span>
    </div>

    <div class="oi-scorecard-detail-metrics">
      <div>
        <span>V23 probability</span>
        <strong>
          ${
            Number.isFinite(Number(card?.probabilityPositivePct))
              ? `${num(card.probabilityPositivePct,2)}%`
              : '—'
          }
        </strong>
        <small>${esc(card?.probabilitySource||'NONE')}</small>
      </div>

      <div>
        <span>Confidence</span>
        <strong>${pct(card?.confidencePct)}</strong>
        <small>${esc(card?.confidenceBand||'UNKNOWN')}</small>
      </div>

      <div>
        <span>Evidence ready</span>
        <strong>${pct(card?.evidenceReadinessPct)}</strong>
        <small>${esc(card?.regime||'UNKNOWN')} regime</small>
      </div>

      <div>
        <span>Canonical Score</span>
        <strong>${num(card?.canonicalScore,2)}</strong>
        <small>V22 source signal · unchanged</small>
      </div>
    </div>

    <div class="oi-scorecard-factor-grid">
      ${
        factors.map(row=>`
          <div
            class="oi-scorecard-factor ${row?.caution===true?'caution':''}"
          >
            <div>
              <strong>${esc(row?.label||row?.key||'FACTOR')}</strong>
              <small>${esc(String(row?.status||'UNKNOWN').replaceAll('_',' '))}</small>
            </div>
            <div>
              <b>
                ${
                  Number.isFinite(Number(row?.value))
                    ? num(row.value,2)
                    : '—'
                }
              </b>
              <small>${esc(row?.detail||'')}</small>
            </div>
          </div>
        `).join('')
      }
    </div>

    <div class="oi-scorecard-blockers">
      ${
        blockers.length
          ? blockers.map(x=>`
              <span>${esc(String(x).replaceAll('_',' '))}</span>
            `).join('')
          : '<span class="clear">NO ACTIVE SHADOW BLOCKERS</span>'
      }
    </div>
  `;
}

function bindTokenScorecardRows(){
  document
    .querySelectorAll('[data-scorecard-mint]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>{
          const mint=
            String(
              button.dataset.scorecardMint||''
            );

          if(mint){
            $('tokenScorecardMint').value=mint;
            inspectTokenScorecard(mint);
          }
        }
      );
    });
}

function renderTokenScorecards(payload={}){
  const status=payload?.status||{};
  const rows=
    Array.isArray(payload?.scorecards)
      ? payload.scorecards
      : [];

  $('tokenScorecardStatus').className=
    'oi-ai-status '+
    (rows.length?'online':'');

  $('tokenScorecardStatus').textContent=
    rows.length
      ? 'LIVE'
      : 'LEARNING';

  $('tokenScorecardTracked').textContent=
    num(status?.tracked,0);

  $('tokenScorecardProbable').textContent=
    num(status?.withProbability,0);

  $('tokenScorecardReady').textContent=
    num(status?.highReadiness,0);

  $('tokenScorecardAverage').textContent=
    pct(status?.averageReadinessPct);

  $('tokenScorecardListSummary').textContent=
    `${rows.length} shown`;

  $('tokenScorecardList').innerHTML=
    rows.length
      ? rows.map(scorecardCardHtml).join('')
      : `
          <div class="oi-empty">
            No active Token Intelligence scorecards yet.
            The shadow network needs live token events.
          </div>
        `;

  bindTokenScorecardRows();
}

async function loadTokenScorecards(){
  try{
    const payload=await api(
      '/api/owner/intelligence/token-scorecards?limit=20'
    );

    renderTokenScorecards(payload);
  }catch(error){
    const badge=$('tokenScorecardStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('tokenScorecardList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

async function inspectTokenScorecard(mint=null){
  mint=String(
    mint||
    $('tokenScorecardMint')?.value||
    ''
  ).trim();

  if(!mint)return;

  const button=$('tokenScorecardInspectBtn');

  if(button){
    button.disabled=true;
    button.textContent='INSPECTING…';
  }

  try{
    const payload=await api(
      '/api/owner/intelligence/token-scorecard?mint='+
      encodeURIComponent(mint)
    );

    renderTokenScorecardDetail(
      payload?.scorecard||{}
    );
  }catch(error){
    const node=$('tokenScorecardDetail');

    if(node){
      node.hidden=false;
      node.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }finally{
    if(button){
      button.disabled=false;
      button.textContent='INSPECT TOKEN';
    }
  }
}

/* MEMEFLOW_SHADOW_OUTCOME_REVIEW_V23_16_UI_JS */
function outcomeReviewTone(type=''){
  const t=String(type||'').toUpperCase();

  if(
    t==='TRUE_POSITIVE' ||
    t==='TRUE_NEGATIVE'
  ){
    return 'hit';
  }

  if(
    t==='FALSE_POSITIVE' ||
    t==='FALSE_NEGATIVE'
  ){
    return 'miss';
  }

  return 'neutral';
}

function renderOutcomeReviews(payload={}){
  const summary=payload?.summary||{};
  const reviews=
    Array.isArray(payload?.reviews)
      ? payload.reviews
      : [];

  const badge=$('outcomeReviewStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (Number(summary?.scored||0)>0
        ? 'online'
        : '');

    badge.textContent=
      Number(summary?.scored||0)>0
        ? 'LEARNING'
        : 'COLD START';
  }

  $('outcomeReviewScored').textContent=
    num(summary?.scored,0);

  $('outcomeReviewHitRate').textContent=
    pct(summary?.hitRatePct);

  $('outcomeReviewErrors').textContent=
    `${num(summary?.falsePositives,0)} / ${num(summary?.falseNegatives,0)}`;

  $('outcomeReviewHighMiss').textContent=
    num(summary?.highConfidenceMisses,0);

  const tags=
    Array.isArray(summary?.topMissTags)
      ? summary.topMissTags
      : [];

  $('outcomeReviewTags').innerHTML=
    tags.length
      ? tags.map(row=>`
          <div class="oi-row">
            <span>
              ${esc(String(row?.tag||'UNKNOWN').replaceAll('_',' '))}
            </span>
            <strong>${esc(row?.count??0)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No miss associations yet</span>
            <strong>—</strong>
          </div>
        `;

  $('outcomeReviewList').innerHTML=
    reviews.length
      ? reviews.slice(0,12).map(row=>{
          const tags=
            Array.isArray(row?.attributionTags)
              ? row.attributionTags.slice(0,3)
              : [];

          return `
            <div class="oi-outcome-review-row ${outcomeReviewTone(row?.resultType)}">
              <div class="oi-outcome-review-head">
                <strong>${esc(row?.mint||'UNKNOWN')}</strong>
                <span>
                  ${esc(String(row?.resultType||'UNKNOWN').replaceAll('_',' '))}
                </span>
              </div>

              <div class="oi-outcome-review-metrics">
                <span>
                  P+ ${Number.isFinite(Number(row?.forecast?.probabilityPositivePct))
                    ? `${num(row.forecast.probabilityPositivePct,1)}%`
                    : '—'}
                </span>
                <span>
                  conf ${Number.isFinite(Number(row?.forecast?.confidencePct))
                    ? `${num(row.forecast.confidencePct,1)}%`
                    : '—'}
                </span>
                <span>
                  return ${Number.isFinite(Number(row?.outcome?.returnPct))
                    ? `${num(row.outcome.returnPct,1)}%`
                    : '—'}
                </span>
              </div>

              <div class="oi-outcome-review-tags">
                ${
                  tags.length
                    ? tags.map(tag=>`
                        <span>
                          ${esc(String(tag).replaceAll('_',' '))}
                        </span>
                      `).join('')
                    : '<span class="clear">NO ASSOCIATION TAGS</span>'
                }
              </div>
            </div>
          `;
        }).join('')
      : `
          <div class="oi-empty">
            No completed 5m shadow reviews yet.
          </div>
        `;
}

async function loadOutcomeReviews(){
  try{
    const payload=await api(
      '/api/owner/intelligence/outcome-reviews?limit=30&horizonMs=300000'
    );

    renderOutcomeReviews(payload);
  }catch(error){
    const badge=$('outcomeReviewStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('outcomeReviewList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

/* MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17_UI_JS */
function renderErrorPatterns(payload={}){
  const report=payload?.report||{};
  const patterns=
    Array.isArray(report?.patterns)
      ? report.patterns
      : [];

  const badge=$('errorPatternStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        Number(report?.maturePatterns||0)>0
          ? 'online'
          : ''
      );

    badge.textContent=
      Number(report?.scoredRows||0)>=12
        ? 'LEARNING'
        : 'COLD START';
  }

  $('errorPatternScored').textContent=
    num(report?.scoredRows,0);

  $('errorPatternBaseline').textContent=
    pct(report?.globalMissRatePct);

  $('errorPatternMature').textContent=
    num(report?.maturePatterns,0);

  $('errorPatternHigh').textContent=
    num(report?.highRiskPatterns,0);

  $('errorPatternList').innerHTML=
    patterns.length
      ? patterns.slice(0,20).map(row=>`
          <div
            class="oi-error-pattern-row ${String(row?.severity||'watch').toLowerCase()}"
          >
            <div class="oi-error-pattern-head">
              <div class="oi-error-pattern-tags">
                ${
                  (Array.isArray(row?.tags)?row.tags:[])
                    .map(tag=>`
                      <span>
                        ${esc(String(tag).replaceAll('_',' '))}
                      </span>
                    `)
                    .join('')
                }
              </div>

              <strong>
                ${esc(String(row?.severity||'WATCH'))}
              </strong>
            </div>

            <div class="oi-error-pattern-metrics">
              <span>
                support ${num(row?.support,0)}
              </span>
              <span>
                misses ${num(row?.misses,0)}
              </span>
              <span>
                posterior ${pct(row?.posteriorMissRatePct)}
              </span>
              <span>
                lower bound ${pct(row?.lowerBoundMissRatePct)}
              </span>
              <span>
                lift ${Number.isFinite(Number(row?.missLift))
                  ? `${num(row.missLift,2)}×`
                  : '—'}
              </span>
              <span>
                FP/FN ${num(row?.falsePositives,0)} / ${num(row?.falseNegatives,0)}
              </span>
            </div>
          </div>
        `).join('')
      : `
          <div class="oi-empty">
            No mature recurring error patterns yet.
            V23.17 needs repeated directional 5m outcomes before
            declaring an association mature.
          </div>
        `;
}

async function loadErrorPatterns(){
  try{
    const payload=await api(
      '/api/owner/intelligence/error-patterns?limit=25&horizonMs=300000'
    );

    renderErrorPatterns(payload);
  }catch(error){
    const badge=$('errorPatternStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('errorPatternList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
function promotionTone(status=''){
  const s=String(status||'').toUpperCase();

  if(s==='PROMOTION_CANDIDATE'){
    return 'online';
  }

  if(
    s==='PROMOTION_BLOCKED' ||
    s==='PROMOTION_GATE_ERROR' ||
    s==='PROMOTION_REPORT_ERROR'
  ){
    return 'offline';
  }

  return '';
}

function renderPromotionReport(payload={}){
  const report=payload?.report||{};
  const sample=report?.sample||{};
  const benchmark=report?.benchmark||{};
  const calibration=report?.calibration||{};
  const drift=report?.drift||{};
  const gate=report?.gate||{};

  const status=
    String(report?.status||'NOT READY');

  const badge=$('promotionStatusBadge');

  if(badge){
    badge.className=
      'oi-ai-status '+
      promotionTone(status);

    badge.textContent=
      String(
        report?.statusLabel||
        status
      );
  }

  const readiness=
    Number(report?.readinessPct);

  $('promotionReadiness').textContent=
    Number.isFinite(readiness)
      ? `${num(readiness,1)}%`
      : '—';

  $('promotionReadinessSub').textContent=
    report?.candidateForManualReview===true
      ? 'candidate · manual approval required'
      : 'shadow evidence only';

  $('promotionPaired').textContent=
    `${num(sample?.paired5m,0)} / ${num(sample?.requiredPaired5m||100,0)}`;

  $('promotionPairedSub').textContent=
    `${num(report?.progress?.paired5mPct,1)}% of paired target`;

  $('promotionBalance').textContent=
    `${num(sample?.positive5m,0)} / ${num(sample?.negative5m,0)}`;

  $('promotionVerdict').textContent=
    String(
      benchmark?.verdict||
      '—'
    ).replaceAll('_',' ');

  $('promotionAuthority').textContent=
    `${String(report?.tradingAuthority||'V22')} trading authority`;

  const fill=$('promotionMeterFill');

  if(fill){
    fill.style.width=
      `${Math.max(0,Math.min(100,readiness||0))}%`;
  }

  const v22=benchmark?.v22||{};
  const v23=benchmark?.v23||{};
  const delta=benchmark?.delta||{};

  $('promotionBenchmark').innerHTML=[
    [
      'V22 Brier',
      num(v22?.meanBrier,6)
    ],
    [
      'V23 Brier',
      num(v23?.meanBrier,6)
    ],
    [
      'Brier Δ',
      num(delta?.brier,6)
    ],
    [
      'V22 Log-loss',
      num(v22?.meanLogLoss,6)
    ],
    [
      'V23 Log-loss',
      num(v23?.meanLogLoss,6)
    ],
    [
      'Log-loss Δ',
      num(delta?.logLoss,6)
    ],
    [
      'Accuracy Δ',
      Number.isFinite(
        Number(delta?.accuracyPct)
      )
        ? `${num(delta.accuracyPct,2)}%`
        : '—'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('promotionHealth').innerHTML=[
    [
      'Calibration',
      String(calibration?.status||'—')
        .replaceAll('_',' ')
    ],
    [
      'Calibration rows',
      num(calibration?.scoredRows,0)
    ],
    [
      'ECE',
      Number.isFinite(
        Number(calibration?.ecePct)
      )
        ? `${num(calibration.ecePct,2)}%`
        : '—'
    ],
    [
      'Calibration Brier',
      num(calibration?.brier,6)
    ],
    [
      'Drift',
      String(drift?.status||'—')
        .replaceAll('_',' ')
    ],
    [
      'Automatic promotion',
      report?.automaticPromotion===true
        ? 'ENABLED'
        : 'DISABLED'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  const checks=
    Array.isArray(gate?.checks)
      ? gate.checks
      : [];

  $('promotionGateSummary').textContent=
    `${num(gate?.passedChecks,0)} / ${num(gate?.totalChecks,0)} passed`;

  $('promotionChecks').innerHTML=
    checks.length
      ? checks.map(row=>`
          <div
            class="oi-promotion-check ${row?.pass===true?'pass':'fail'}"
          >
            <span class="oi-promotion-check-dot"></span>
            <div>
              <strong>
                ${esc(String(row?.name||'CHECK').replaceAll('_',' '))}
              </strong>
              <small>
                actual ${esc(row?.actual??'—')} ·
                required ${esc(row?.required??'—')}
              </small>
            </div>
          </div>
        `).join('')
      : `
          <div class="oi-empty">
            No promotion gate evidence yet.
          </div>
        `;

  const blocker=$('promotionBlocker');

  if(blocker){
    const primary=
      gate?.primaryBlocker;

    blocker.dataset.state=
      report?.candidateForManualReview===true
        ? 'ready'
        : 'blocked';

    blocker.textContent=
      report?.candidateForManualReview===true
        ? 'V23 passed every shadow gate. Manual owner review is now allowed; nothing was promoted automatically.'
        : (
            primary
              ? `NEXT BLOCKER · ${String(primary).replaceAll('_',' ')}`
              : 'Waiting for additional shadow evidence.'
          );
  }
}

async function loadPromotionReport(){
  try{
    const payload=await api(
      '/api/owner/intelligence/promotion-report'
    );

    renderPromotionReport(payload);
  }catch(error){
    const badge=$('promotionStatusBadge');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const blocker=$('promotionBlocker');

    if(blocker){
      blocker.dataset.state='blocked';
      blocker.textContent=
        `Promotion monitor unavailable: ${error.message}`;
    }
  }
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

    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns()
    ]);

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

$('tokenScorecardInspectBtn')
  ?.addEventListener(
    'click',
    ()=>inspectTokenScorecard()
  );

$('tokenScorecardMint')
  ?.addEventListener(
    'keydown',
    event=>{
      if(
        event.key==='Enter' &&
        !event.isComposing
      ){
        event.preventDefault();
        inspectTokenScorecard();
      }
    }
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
