#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="43e718c2676e388d2cdcb1189d7c57e4648d3670"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
REPORT="memeflow-app/src/shadow-promotion-report-v23_14.mjs"
TEST="memeflow-app/tests/shadow-promotion-report-v23_14.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$REPORT" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW PROMOTION REPORT V23.14 ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    active=""

    for proc in /proc/[0-9]*; do
      [[ -r "$proc/comm" ]] || continue
      comm="$(cat "$proc/comm" 2>/dev/null || true)"

      case "$comm" in
        git|git-*)
          cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
          if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/"* ]]; then
            active="$proc:$comm:$cwd"
            break
          fi
        ;;
      esac
    done

    if [[ -n "$active" ]]; then
      echo "V23.14 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.14 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.14 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.14 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.14 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.14 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.14 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-promotion-report-v23-14-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.14 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] &&
        cp "$BACKUP/$f" "$f" ||
        true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$REPORT" <<'EOF_REPORT'
// MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
//
// OWNER READ-ONLY REPORT.
//
// Consolidates V23.10-V23.13 evidence into one promotion-readiness view.
// It NEVER changes V22, Score, State, Settings, BUY or SELL.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function progress(actual,target){
  const a=Math.max(0,Number(actual)||0);
  const t=Math.max(1,Number(target)||1);
  return round(clamp(a/t*100,0,100),1);
}

function labelForStatus(status){
  switch(upper(status)){
    case 'PROMOTION_CANDIDATE':
      return 'READY FOR MANUAL REVIEW';
    case 'PROMOTION_BLOCKED':
      return 'BLOCKED';
    case 'PROMOTION_PROBATION':
      return 'PROBATION';
    case 'PROMOTION_EVIDENCE_BUILDING':
      return 'LEARNING';
    case 'PROMOTION_GATE_ERROR':
      return 'ERROR';
    default:
      return 'NOT READY';
  }
}

export function createShadowPromotionReportV23_14({
  promotionGate=null,
  championBenchmark=null,
  outcomeCalibration=null,
  driftRegime=null,
  evidenceSynthesis=null
}={}){
  let generated=0;
  let errors=0;

  function report(){
    try{
      const gate=
        promotionGate?.status?.()||{};

      const benchmark=
        championBenchmark?.status?.()||{};

      const target=
        benchmark?.target||{};

      const calibration=
        outcomeCalibration?.status?.()||{};

      const drift=
        driftRegime?.status?.()||{};

      const synthesis=
        evidenceSynthesis?.status?.()||{};

      const checks=
        Array.isArray(gate?.checks)
          ? gate.checks
          : [];

      const passedChecks=
        checks.filter(row=>row?.pass===true).length;

      const totalChecks=
        checks.length;

      const failedChecks=
        checks
          .filter(row=>row?.pass!==true)
          .map(row=>String(row?.name||'UNKNOWN'));

      const paired=
        Number(target?.pairedRows||0);

      const positive=
        Number(target?.positive||0);

      const negative=
        Number(target?.negative||0);

      const status=
        upper(gate?.status);

      const candidate=
        gate?.candidateForManualReview===true;

      const automaticPromotion=
        gate?.automaticPromotion===true;

      const sampleProgressPct=
        progress(paired,100);

      const positiveProgressPct=
        progress(positive,20);

      const negativeProgressPct=
        progress(negative,20);

      const checkProgressPct=
        totalChecks
          ? round(passedChecks/totalChecks*100,1)
          : 0;

      const readinessPct=
        round(
          (
            sampleProgressPct*0.35+
            positiveProgressPct*0.10+
            negativeProgressPct*0.10+
            checkProgressPct*0.45
          ),
          1
        );

      const verdict=
        upper(target?.verdict?.status);

      const calibrationStatus=
        upper(calibration?.targetStatus);

      const driftStatus=
        upper(drift?.drift?.status);

      const primaryBlocker=
        failedChecks[0]||
        (
          candidate
            ? null
            : 'WAITING_FOR_COMPLETE_GATE'
        );

      generated++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        tradingAuthority:'V22',
        automaticPromotion,
        candidateForManualReview:candidate,
        status,
        statusLabel:labelForStatus(status),
        readinessPct,
        progress:{
          paired5mPct:sampleProgressPct,
          positivePct:positiveProgressPct,
          negativePct:negativeProgressPct,
          checksPct:checkProgressPct
        },
        sample:{
          paired5m:paired,
          requiredPaired5m:100,
          positive5m:positive,
          requiredPositive5m:20,
          negative5m:negative,
          requiredNegative5m:20
        },
        benchmark:{
          verdict,
          v22:
            target?.v22||{
              meanBrier:null,
              meanLogLoss:null,
              accuracyPct:null
            },
          v23:
            target?.v23||{
              meanBrier:null,
              meanLogLoss:null,
              accuracyPct:null
            },
          delta:{
            brier:
              finite(target?.delta?.brier),
            logLoss:
              finite(target?.delta?.logLoss),
            accuracyPct:
              finite(target?.delta?.accuracyPct)
          },
          pairedWins:
            target?.pairedWins||{
              v22:0,
              v23:0,
              ties:0
            }
        },
        calibration:{
          status:calibrationStatus,
          scoredRows:
            Number(
              calibration?.targetScoredRows||0
            ),
          accuracyPct:
            finite(
              calibration?.targetAccuracyPct
            ),
          ecePct:
            finite(
              calibration?.targetEcePct
            ),
          brier:
            finite(
              calibration?.targetBrier
            ),
          logLoss:
            finite(
              calibration?.targetLogLoss
            )
        },
        drift:{
          status:driftStatus,
          ready:
            drift?.drift?.ready===true
        },
        synthesis:{
          predictions:
            Number(
              synthesis?.predictions||0
            ),
          coldStarts:
            Number(
              synthesis?.coldStarts||0
            ),
          conflicts:
            Number(
              synthesis?.conflicts||0
            ),
          errors:
            Number(
              synthesis?.errors||0
            )
        },
        gate:{
          passedChecks,
          totalChecks,
          failedChecks,
          primaryBlocker,
          checks
        },
        safety:{
          v22RemainsTradingAuthority:true,
          automaticPromotionDisabled:
            automaticPromotion!==true,
          manualReviewRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false
        },
        generatedAt:
          Date.now()
      };
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        tradingAuthority:'V22',
        automaticPromotion:false,
        candidateForManualReview:false,
        status:'PROMOTION_REPORT_ERROR',
        statusLabel:'ERROR',
        readinessPct:0,
        progress:{
          paired5mPct:0,
          positivePct:0,
          negativePct:0,
          checksPct:0
        },
        sample:{
          paired5m:0,
          requiredPaired5m:100,
          positive5m:0,
          requiredPositive5m:20,
          negative5m:0,
          requiredNegative5m:20
        },
        benchmark:null,
        calibration:null,
        drift:null,
        synthesis:null,
        gate:{
          passedChecks:0,
          totalChecks:0,
          failedChecks:[
            'PROMOTION_REPORT_ERROR'
          ],
          primaryBlocker:
            'PROMOTION_REPORT_ERROR',
          checks:[]
        },
        safety:{
          v22RemainsTradingAuthority:true,
          automaticPromotionDisabled:true,
          manualReviewRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false
        },
        generatedAt:
          Date.now()
      };
    }
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
      ownerOnly:true,
      shadowOnly:true,
      generated,
      errors,
      report:
        report()
    };
  }

  return {
    report,
    status
  };
}

EOF_REPORT

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPromotionReportV23_14
} from '../src/shadow-promotion-report-v23_14.mjs';

function providers({
  gateStatus='PROMOTION_EVIDENCE_BUILDING',
  candidate=false,
  paired=55,
  positive=28,
  negative=27,
  failed=['PAIRED_5M_SAMPLE'],
  verdict='BENCHMARK_INCONCLUSIVE',
  brierDelta=0.004,
  logLossDelta=0.008,
  accuracyDelta=1,
  calibration='CALIBRATION_LEARNING',
  ece=12,
  drift='STABLE'
}={}){
  const checks=[
    {
      name:'PAIRED_5M_SAMPLE',
      pass:!failed.includes('PAIRED_5M_SAMPLE'),
      actual:paired,
      required:'>=100'
    },
    {
      name:'CALIBRATION_HEALTH',
      pass:!failed.includes('CALIBRATION_HEALTH'),
      actual:calibration,
      required:'CALIBRATION_HEALTHY'
    }
  ];

  return {
    promotionGate:{
      status(){
        return {
          status:gateStatus,
          automaticPromotion:false,
          candidateForManualReview:candidate,
          checks
        };
      }
    },
    championBenchmark:{
      status(){
        return {
          target:{
            pairedRows:paired,
            positive,
            negative,
            v22:{
              meanBrier:0.24,
              meanLogLoss:0.68,
              accuracyPct:58
            },
            v23:{
              meanBrier:0.20,
              meanLogLoss:0.61,
              accuracyPct:63
            },
            delta:{
              brier:brierDelta,
              logLoss:logLossDelta,
              accuracyPct:accuracyDelta
            },
            pairedWins:{
              v22:20,
              v23:30,
              ties:5
            },
            verdict:{
              status:verdict
            }
          }
        };
      }
    },
    outcomeCalibration:{
      status(){
        return {
          targetScoredRows:paired,
          targetStatus:calibration,
          targetAccuracyPct:63,
          targetEcePct:ece,
          targetBrier:0.20,
          targetLogLoss:0.61
        };
      }
    },
    driftRegime:{
      status(){
        return {
          drift:{
            status:drift,
            ready:true
          }
        };
      }
    },
    evidenceSynthesis:{
      status(){
        return {
          predictions:90,
          coldStarts:10,
          conflicts:4,
          errors:0
        };
      }
    }
  };
}

{
  const monitor=
    createShadowPromotionReportV23_14(
      providers()
    );

  const report=
    monitor.report();

  assert.equal(
    report.tradingAuthority,
    'V22'
  );

  assert.equal(
    report.automaticPromotion,
    false
  );

  assert.equal(
    report.sample.paired5m,
    55
  );

  assert.equal(
    report.sample.requiredPaired5m,
    100
  );

  assert.ok(
    report.readinessPct>0 &&
    report.readinessPct<100
  );

  assert.equal(
    report.gate.primaryBlocker,
    'PAIRED_5M_SAMPLE'
  );

  assert.equal(
    report.safety.buySellMutation,
    false
  );
}

{
  const monitor=
    createShadowPromotionReportV23_14(
      providers({
        gateStatus:'PROMOTION_CANDIDATE',
        candidate:true,
        paired:140,
        positive:70,
        negative:70,
        failed:[],
        verdict:'V23_CHALLENGER_WINS',
        brierDelta:0.02,
        logLossDelta:0.04,
        accuracyDelta:4,
        calibration:'CALIBRATION_HEALTHY',
        ece:5
      })
    );

  const report=
    monitor.report();

  assert.equal(
    report.status,
    'PROMOTION_CANDIDATE'
  );

  assert.equal(
    report.statusLabel,
    'READY FOR MANUAL REVIEW'
  );

  assert.equal(
    report.candidateForManualReview,
    true
  );

  assert.equal(
    report.readinessPct,
    100
  );
}

const source=
  fs.readFileSync(
    'src/shadow-promotion-report-v23_14.mjs',
    'utf8'
  );

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);

assert.doesNotMatch(
  source,
  /openPosition\s*\(/
);

assert.doesNotMatch(
  source,
  /closePosition\s*\(/
);

assert.doesNotMatch(
  source,
  /setSettings\s*\(/
);

assert.doesNotMatch(
  source,
  /tradeEligible/
);

assert.doesNotMatch(
  source,
  /decisionScore/
);

const shadow=
  fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

const app=
  fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

const html=
  fs.readFileSync(
    'owner-intelligence.html',
    'utf8'
  );

const js=
  fs.readFileSync(
    'owner-intelligence.js',
    'utf8'
  );

assert.match(
  shadow,
  /createShadowPromotionReportV23_14/
);

assert.match(
  shadow,
  /promotionReportStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/promotion-report/
);

assert.match(
  html,
  /id="promotionReadiness"/
);

assert.match(
  html,
  /id="promotionChecks"/
);

assert.match(
  js,
  /loadPromotionReport/
);

assert.match(
  js,
  /\/api\/owner\/intelligence\/promotion-report/
);

console.log(
  'shadow promotion report v23.14 ok'
);

EOF_TEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)

    if n!=1:
        raise SystemExit(
            f"V23.14 REFUSED: {label}: expected 1 exact match, got {n}"
        )

    return text.replace(old,new,1)

old="""import {
  createShadowPromotionGateV23_13
} from './shadow-promotion-gate-v23_13.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowPromotionReportV23_14
} from './shadow-promotion-report-v23_14.mjs';""",
    "promotion report import"
)

old="""  const shadowPromotionGate=
    createShadowPromotionGateV23_13({
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowPromotionReport=
    createShadowPromotionReportV23_14({
      promotionGate:shadowPromotionGate,
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime,
      evidenceSynthesis:shadowEvidenceSynthesis
    });""",
    "promotion report construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_13'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_14'",
    "network version"
)

old="""      shadowChampionBenchmark:shadowChampionBenchmark.status(),
      shadowPromotionGate:shadowPromotionGate.status()
"""

s=once(
    s,
    old,
    """      shadowChampionBenchmark:shadowChampionBenchmark.status(),
      shadowPromotionGate:shadowPromotionGate.status(),
      shadowPromotionReport:shadowPromotionReport.status()
""",
    "promotion report status"
)

old="""    promotionGateStatus:
      ()=>shadowPromotionGate.status(),
    status
"""

s=once(
    s,
    old,
    """    promotionGateStatus:
      ()=>shadowPromotionGate.status(),
    promotionReportStatus:
      ()=>shadowPromotionReport.status(),
    promotionReport:
      ()=>shadowPromotionReport.report(),
    status
""",
    "promotion report API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_MONITOR_V23_14
 * Owner-only, read-only consolidated promotion readiness report.
 */
 if(
   url.pathname==='/api/owner/intelligence/promotion-report' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     automaticPromotion:false,
     report:
       tokenIntelligenceShadowV23
         .promotionReport()
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "promotion report owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      
      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      
      <!-- MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI -->
      <section
        id="promotionMonitor"
        class="oi-panel oi-promotion-monitor"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              V22 vs V23 · SHADOW ONLY
            </span>
            <h2>AI Brain Promotion Readiness</h2>
            <p>
              One owner-only view of paired outcomes, calibration,
              drift and every promotion gate. V22 remains in control.
            </p>
          </div>

          <span
            id="promotionStatusBadge"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>READINESS</span>
            <strong id="promotionReadiness">—</strong>
            <small id="promotionReadinessSub">manual review only</small>
          </article>

          <article class="oi-stat">
            <span>PAIRED 5M</span>
            <strong id="promotionPaired">—</strong>
            <small id="promotionPairedSub">target 100</small>
          </article>

          <article class="oi-stat">
            <span>POSITIVE / NEGATIVE</span>
            <strong id="promotionBalance">—</strong>
            <small>minimum 20 / 20</small>
          </article>

          <article class="oi-stat">
            <span>CURRENT VERDICT</span>
            <strong id="promotionVerdict">—</strong>
            <small id="promotionAuthority">V22 authority</small>
          </article>
        </div>

        <div class="oi-promotion-meter">
          <div
            id="promotionMeterFill"
            class="oi-promotion-meter-fill"
          ></div>
        </div>

        <div class="oi-grid oi-grid-2 oi-promotion-details">
          <div>
            <h3>V22 vs V23</h3>
            <div id="promotionBenchmark" class="oi-list"></div>
          </div>

          <div>
            <h3>Calibration / Drift</h3>
            <div id="promotionHealth" class="oi-list"></div>
          </div>
        </div>

        <div class="oi-divider"></div>

        <div class="oi-promotion-check-head">
          <h3>Promotion gates</h3>
          <span id="promotionGateSummary">—</span>
        </div>

        <div
          id="promotionChecks"
          class="oi-promotion-checks"
        ></div>

        <div
          id="promotionBlocker"
          class="oi-promotion-blocker"
        >
          Waiting for shadow evidence.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "promotion UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""function renderOverview(data){
"""

js_block=r"""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
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
"""

j=once(
    j,
    js_anchor,
    js_block,
    "promotion UI JS"
)

old="""    renderOverview(data);

    if(previous){
"""

j=once(
    j,
    old,
    """    renderOverview(data);
    await loadPromotionReport();

    if(previous){
""",
    "promotion report load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""@media(max-width:900px){
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */

.oi-promotion-monitor{
  overflow:hidden;
}

.oi-promotion-meter{
  height:7px;
  margin:
    -2px
    0
    14px;
  overflow:hidden;
  border-radius:999px;
  background:rgba(255,255,255,.045);
}

.oi-promotion-meter-fill{
  width:0;
  height:100%;
  border-radius:inherit;
  background:var(--cyan);
  transition:width .28s ease;
}

.oi-promotion-details{
  margin-top:0;
}

.oi-promotion-check-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.oi-promotion-check-head h3{
  margin:0;
}

.oi-promotion-check-head span{
  color:var(--muted);
  font-size:var(--mf-type-meta);
}

.oi-promotion-checks{
  display:grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap:7px;
  margin-top:9px;
}

.oi-promotion-check{
  display:grid;
  grid-template-columns:
    8px
    minmax(0,1fr);
  gap:9px;
  align-items:start;
  min-width:0;
  padding:9px 10px;
  border:
    1px solid
    rgba(38,56,69,.65);
  border-radius:10px;
  background:rgba(255,255,255,.012);
}

.oi-promotion-check-dot{
  width:7px;
  height:7px;
  margin-top:5px;
  border-radius:50%;
  background:var(--amber);
}

.oi-promotion-check.pass
.oi-promotion-check-dot{
  background:var(--green);
}

.oi-promotion-check.fail
.oi-promotion-check-dot{
  background:var(--red);
}

.oi-promotion-check strong{
  display:block;
  overflow-wrap:anywhere;
  color:#dbe5ea;
  font-size:var(--mf-type-meta);
}

.oi-promotion-check small{
  display:block;
  margin-top:3px;
  overflow-wrap:anywhere;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-promotion-blocker{
  margin-top:10px;
  padding:10px 11px;
  border:
    1px solid
    rgba(239,200,106,.22);
  border-radius:10px;
  background:rgba(239,200,106,.035);
  color:var(--amber);
  font-size:var(--mf-type-meta);
  font-weight:800;
  line-height:1.45;
}

.oi-promotion-blocker[data-state="ready"]{
  border-color:rgba(81,231,168,.22);
  background:rgba(81,231,168,.035);
  color:var(--green);
}

.oi-promotion-blocker[data-state="blocked"]{
  border-color:rgba(255,104,120,.18);
}

@media(max-width:900px){
"""

c=once(
    c,
    css_anchor,
    css_block,
    "promotion UI CSS"
)

mobile_anchor="""@media(max-width:650px){
  .oi-shell{
"""

mobile_new="""@media(max-width:650px){
  .oi-promotion-checks{
    grid-template-columns:1fr;
  }

  .oi-shell{
"""

c=once(
    c,
    mobile_anchor,
    mobile_new,
    "promotion mobile CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_14_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-promotion-gate-v23_13.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-promotion-gate-v23_13.mjs && node tests/shadow-promotion-report-v23_14.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.14 REFUSED: package test anchor changed"
    )

if "shadow-promotion-report-v23_14.mjs" in s:
    raise SystemExit(
        "V23.14 REFUSED: report test already installed"
    )

d["scripts"]["test:core"] = s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(d,indent=2)+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

# Normalize every touched text file to exactly one final newline.
python3 - <<'PY'
from pathlib import Path

for name in [
 "memeflow-app/app-server.mjs",
 "memeflow-app/src/token-intelligence-shadow-v23.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-promotion-report-v23_14.mjs",
 "memeflow-app/tests/shadow-promotion-report-v23_14.mjs"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_14_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.14 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$REPORT"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.14 TARGETED TESTS ==="

(
  cd memeflow-app

  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/shadow-confidence-governor-v23_7.mjs
  node tests/shadow-token-trajectory-v23_8.mjs
  node tests/shadow-token-pattern-memory-v23_9.mjs
  node tests/shadow-evidence-synthesis-v23_10.mjs
  node tests/shadow-outcome-calibration-v23_11.mjs
  node tests/shadow-champion-benchmark-v23_12.mjs
  node tests/shadow-promotion-gate-v23_13.mjs
  node tests/shadow-promotion-report-v23_14.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.14 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.14 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-promotion-report-v23_14.mjs"
).read_text()

s=Path(
 "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

a=Path(
 "memeflow-app/app-server.mjs"
).read_text()

h=Path(
 "memeflow-app/owner-intelligence.html"
).read_text()

j=Path(
 "memeflow-app/owner-intelligence.js"
).read_text()

c=Path(
 "memeflow-app/owner-intelligence.css"
).read_text()

p=Path(
 "memeflow-app/package.json"
).read_text()

errors=[]

for x in [
 "MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14",
 "tradingAuthority:'V22'",
 "automaticPromotion",
 "candidateForManualReview",
 "requiredPaired5m:100",
 "requiredPositive5m:20",
 "requiredNegative5m:20",
 "readinessPct",
 "primaryBlocker",
 "v22RemainsTradingAuthority:true",
 "buySellMutation:false"
]:
    if x not in m:
        errors.append("report marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createShadowPromotionReportV23_14",
 "shadowPromotionReport:shadowPromotionReport.status()",
 "promotionReportStatus",
 "promotionReport:",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_14"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/promotion-report",
 "MEMEFLOW_SHADOW_PROMOTION_REPORT_MONITOR_V23_14",
 "automaticPromotion:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="promotionReadiness"',
 'id="promotionPaired"',
 'id="promotionBalance"',
 'id="promotionVerdict"',
 'id="promotionChecks"',
 'id="promotionBlocker"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "renderPromotionReport",
 "loadPromotionReport",
 "/api/owner/intelligence/promotion-report",
 "promotionMeterFill",
 "promotionGateSummary"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

for x in [
 ".oi-promotion-monitor",
 ".oi-promotion-meter",
 ".oi-promotion-checks",
 ".oi-promotion-check",
 ".oi-promotion-blocker"
]:
    if x not in c:
        errors.append("UI CSS missing: "+x)

if "shadow-promotion-report-v23_14.mjs" not in p:
    errors.append("V23.14 test missing from package")

for x in [
 "shadowMathBrain.predict",
 "shadowModelArena.predict",
 "shadowDriftRegime.predict",
 "shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe",
 "shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict",
 "shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome",
 "shadowPromotionGate.status"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_14_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_14_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.14 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-promotion-report-v23_14\.mjs|tests/shadow-promotion-report-v23_14\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.14 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.14 STAGED ==="

git diff --cached --stat

git commit -m "feat: add owner shadow promotion report v23.14"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.14 CONTRACT:"
echo "  Owner Intelligence now shows one consolidated V22-vs-V23 readiness panel"
echo "  panel displays readiness, paired 5m sample, class balance, benchmark deltas, calibration, drift and every gate"
echo "  primary blocker is visible directly in UI"
echo "  report is owner-only and read-only"
echo "  V22 remains the only trading authority"
echo "  automatic promotion remains disabled"
echo "  no Score/State/BUY/SELL mutation"
