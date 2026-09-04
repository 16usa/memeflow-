#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="3a7f7ecaef57555b1768003fc936384f4fbcc33e"
APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
HTML="memeflow-app/system-tokens.html"
RANK="memeflow-app/src/feed-ranking.mjs"
RANKTEST="memeflow-app/tests/feed-ranking.mjs"
OLDLIVE="memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs"
NEWTEST="memeflow-app/tests/canonical-live-score-pipeline-v20_8_1.mjs"

for f in "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST"; do
  [[ -f "$f" ]] || { echo "ERROR missing $f"; exit 1; }
done

[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "V20.8.1 REFUSED: wrong branch"; exit 1; }
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V20.8.1 REFUSED: audited HEAD mismatch";
  echo "expected $EXPECTED_HEAD";
  echo "actual   $(git rev-parse HEAD)";
  exit 1;
}

for f in "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST"; do
  git diff --quiet -- "$f" || { echo "V20.8.1 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V20.8.1 REFUSED: staged changes in $f"; exit 1; }
done

echo "=== V20.8.1 AUDITED PRECHECK ==="
python3 - <<'PY'
from pathlib import Path
req={
'memeflow-app/app-server.mjs':['MEMEFLOW_CANONICAL_SCORE_STATE_V20_7','function __mfLiveDecisionForUserV14(','MEMEFLOW_LIVE_TOKEN_STATES_V7','MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2'],
'memeflow-app/system-tokens.js':['MEMEFLOW_NO_DYNAMIC_CACHE_V20_2','function __mfInvalidateDynamicRowV20_2(','MEMEFLOW_CARD_DETAILS_LIVE_AUTHORITY_V20_5'],
'memeflow-app/src/feed-ranking.mjs':['MEMEFLOW_FEED_RELEVANCE_RANKING_V2','score: liveCandidate ? Math.round(relevanceScore) : decisionScore'],
'memeflow-app/tests/feed-ranking.mjs':['live feed score must agree with live ordering']}
for f,marks in req.items():
 s=Path(f).read_text()
 for m in marks:
  if m not in s: raise SystemExit(f'VERSION REFUSED: {f}: {m}')
print('AUDITED_ARCHITECTURE_OK')
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/canonical-live-score-v20_8_1-$STAMP"
mkdir -p "$BACKUP/memeflow-app/src" "$BACKUP/memeflow-app/tests"
for f in "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST"; do cp "$f" "$BACKUP/$f"; done
[[ -f "$OLDLIVE" ]] && cp "$OLDLIVE" "$BACKUP/$OLDLIVE" || true

rollback(){
 rc=$?
 if [[ $rc -ne 0 ]]; then
  echo "=== V20.8.1 FAILED — RESTORING ==="
  for f in "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST"; do cp "$BACKUP/$f" "$f" || true; done
  [[ -f "$BACKUP/$OLDLIVE" ]] && cp "$BACKUP/$OLDLIVE" "$OLDLIVE" || true
  rm -f "$NEWTEST"
  git reset -- "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST" "$OLDLIVE" "$NEWTEST" >/dev/null 2>&1 || true
  echo "ROLLBACK_COMPLETE; backup: $BACKUP"
 fi
 exit "$rc"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path
import re
APP=Path('memeflow-app/app-server.mjs'); UI=Path('memeflow-app/system-tokens.js'); HTML=Path('memeflow-app/system-tokens.html'); RANK=Path('memeflow-app/src/feed-ranking.mjs'); TEST=Path('memeflow-app/tests/feed-ranking.mjs'); OLD=Path('memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs')

def rep(s,a,b,label):
 c=s.count(a)
 if c!=1: raise SystemExit(f'{label}: expected 1, found {c}')
 return s.replace(a,b,1)

# 1. Feed relevance is ranking-only; never replace visible AI score.
r=RANK.read_text()
r=rep(r,"""// 3) The card score for WATCH/WAITING is a live feed score. The original
//    decision score is preserved as decisionScore and trading eligibility is
//    not changed here.
""","""// 3) Visible Score is always the canonical evaluator score. Feed/relevance
//    is a separate hidden ranking signal and never replaces the AI score used
//    by minScore, Signal or Risk.
""",'rank comment')
r=rep(r,"""      const liveCandidate = isLiveCandidateState(view.state);
      return {
        ...view,
        decisionScore,
        score: liveCandidate ? Math.round(relevanceScore) : decisionScore,
        feedScore: relevanceScore,
        relevanceScore,
        statePriority: statePriority(view.state)
      };""","""      const liveCandidate = isLiveCandidateState(view.state);
      void liveCandidate;
      return {
        ...view,
        decisionScore,
        // MEMEFLOW_CANONICAL_VISIBLE_AI_SCORE_V20_8_1
        score: decisionScore,
        feedScore: relevanceScore,
        relevanceScore,
        statePriority: statePriority(view.state)
      };""",'rank score overwrite')
RANK.write_text(r)

# 2. Replace the live display decision helper with one fresh evaluator truth.
a=APP.read_text()
fs=a.find('function __mfLiveDecisionForUserV14('); fe=a.find('function __mfLiveCardViewV14(',fs)
if fs<0 or fe<=fs: raise SystemExit('live decision boundaries missing')
old=a[fs:fe]
for m in ['MEMEFLOW_WAITING_PREVIEW_SCORE_V21','previewScore','const __v20truth=__mfCurrentEntryTruthV20_2']:
 if m not in old: raise SystemExit('live decision shape changed: '+m)
new="""// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_1
function __mfLiveDecisionForUserV14(uid,token,settingsOverride=null,admissionOverride=null){
  const mint=String(token?.mint||'').trim();
  if(!mint)return null;
  const settings=settingsOverride&&typeof settingsOverride==='object'?settingsOverride:(store.settings(uid)||{});
  const admission=admissionOverride&&typeof admissionOverride==='object'?admissionOverride:__mfEntryAdmissionForUser(token,uid,settings);
  const eligible=admission?.admitted===true;
  const isOpen=__mfOpenPositionMints().has(mint);
  const admissionState=String(admission?.state||(eligible?'ADMITTED':'PENDING')).trim().toUpperCase();
  const admissionReasons=Array.isArray(admission?.reasons)?admission.reasons.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];

  const persisted=store.state.decisions?.[uid+':'+mint]||null;
  const operational={};
  if(persisted&&typeof persisted==='object'){
    for(const key of ['preOpenRiskVerified','walletRiskPending','walletRisk','preOpenRiskStatus','updatedAt','reevaluatedAt']){
      if(Object.prototype.hasOwnProperty.call(persisted,key))operational[key]=persisted[key];
    }
  }

  let fresh=null;
  try{fresh=evaluate(token,settings)}catch{}
  let decision=fresh&&typeof fresh==='object'
    ? {...fresh,...operational}
    : {...operational,state:'WAITING',score:null,confidence:null,primaryReason:'Fresh evaluator data is unavailable',reasons:['Fresh evaluator data is unavailable'],terminal:false};

  if(isOpen){
    decision={...decision,state:'OPEN POSITION',displayState:'OPEN POSITION'};
  }else if(!eligible){
    const blocked=admissionState==='REJECTED';
    const fallback=blocked?'Entry filters rejected this token':'Waiting for entry-filter data';
    const evaluatorReasons=Array.isArray(decision?.reasons)?decision.reasons.filter(Boolean):[];
    const reasons=[...admissionReasons,...evaluatorReasons].filter((v,i,x)=>v&&x.indexOf(v)===i);
    decision={...decision,state:blocked?'BLOCKED':'WAITING',displayState:blocked?'BLOCKED':'WAITING',primaryReason:admissionReasons[0]||decision?.primaryReason||fallback,reasons:reasons.length?reasons:[fallback],terminal:false};
  }

  const liveTruth=__mfCurrentEntryTruthV20_2(token,{isOpen});
  if(!isOpen&&liveTruth.pass!==true){
    const reason=liveTruth.reason||'Fresh live market evidence is unavailable';
    const prior=Array.isArray(decision?.reasons)?decision.reasons.filter(Boolean):[];
    decision={...decision,state:'WAITING',displayState:'WAITING',primaryReason:decision?.primaryReason||reason,reasons:[...prior,...(prior.includes(reason)?[]:[reason])],terminal:false,liveTruthBlocked:true,liveTruthReason:reason};
  }

  return {...decision,mint,tradeEligible:isOpen?true:eligible&&liveTruth.pass===true,displayOnly:!eligible&&!isOpen,openPositionOverride:isOpen&&!eligible,entryAdmissionState:admissionState,entryAdmissionReasons:admissionReasons.slice(0,20)};
}

"""
a=a[:fs]+new+a[fe:]

# 3. Full live route must use the same decision helper and same live card view.
rs=a.find("if(url.pathname==='/api/system/live-token-states'"); re_=a.find("if(url.pathname==='/api/ai/decisions')",rs)
if rs<0 or re_<=rs: raise SystemExit('full route boundaries missing')
route=a[rs:re_]
ss=route.find("    const _key=u.id+':'+_mint;"); se=route.find("\n  }\n\n  const _flatDecisions",ss)
if ss<0 or se<=ss: raise SystemExit('full decision duplicate block missing')
route=route[:ss]+"""    let _decision=null;
    try{_decision=__mfLiveDecisionForUserV14(u.id,_token,_settings,_admission)}catch(_error){
      _evalErrors++;
      _decision={mint:_mint,state:'WAITING',score:null,confidence:null,primaryReason:'Fresh evaluator data is unavailable',reasons:['Fresh evaluator data is unavailable'],tradeEligible:false,displayOnly:!_isOpen,openPositionOverride:_isOpen,entryAdmissionState:_admissionState,entryAdmissionReasons:Array.isArray(_admission?.reasons)?_admission.reasons.filter(x=>typeof x==='string'):[]};
    }
    _displayRows.push({token:_token,decision:_decision});
"""+route[se:]

vs=route.find('  // Build a JSON-safe Live Token States view directly from canonical token'); ve=route.find('  // MEMEFLOW_FEED_RANKING_COMPAT_V13',vs)
if vs<0 or ve<=vs: raise SystemExit('full safe-view duplicate block missing')
route=route[:vs]+"""  // MEMEFLOW_UNIFIED_FULL_LIVE_VIEW_V20_8_1
  const _rowsByMint=new Map(_displayRows.map(row=>[String(row?.decision?.mint||''),row]));
  const _safeViews=[];
  for(const _decision of _selected){
    const _mint=String(_decision?.mint||'').trim();
    if(!_mint)continue;
    const _token=_rowsByMint.get(_mint)?.token||store.state.tokens?.[_mint]||null;
    if(!_token)continue;
    try{
      const _view=__mfLiveCardViewV14(_token,_decision);
      if(_view)_safeViews.push(_view);else _viewErrors++;
    }catch{_viewErrors++}
  }

"""+route[ve:]
a=a[:rs]+route+a[re_:]

# 4. Remove live-state response cache reads/writes.
a=rep(a,"""const __mfLiveStatesResponseCacheMs=Math.max(
  100,
  Number(process.env.LIVE_STATES_RESPONSE_CACHE_MS||350)
);
const __mfLiveStatesResponseCache=new Map();""","""// MEMEFLOW_NO_DYNAMIC_RESPONSE_CACHE_V20_8_1
const __mfLiveStatesResponseCacheMs=0;
const __mfLiveStatesResponseCache=new Map();""",'response cache declaration')
a=rep(a,'  const _cached=__mfLiveStatesResponseCache.get(_cacheKey);','  const _cached=null;','response cache read')
ws=a.find('  __mfLiveStatesResponseCache.set(_cacheKey,{',rs); we=a.find('\n\n  return json(res,200,_payload);',ws)
if ws<0 or we<=ws: raise SystemExit('response cache write missing')
a=a[:ws]+"  // MEMEFLOW_NO_DYNAMIC_RESPONSE_CACHE_V20_8_1\n  // Intentionally no live-state response cache write.\n"+a[we:]
APP.write_text(a)

# 5. Frontend: only name/symbol/image persists; missing fresh data is unknown, not zero.
u=UI.read_text()
u=rep(u,"""const __MF_TOKEN_IDENTITY_KEYS_V20_2=[
  'name','metadataName','symbol','metadataSymbol',
  'image','imageUrl','imageUri','logo','logoUrl','logoURI',
  'uri','metadataUri','twitterUrl','telegramUrl','websiteUrl',
  'creator','curve','bondingCurve','associatedBondingCurve',
  'pumpCreatedAt','createdAt','decimals','totalSupply',
  'launchPlatform','protocol'
];""","""const __MF_TOKEN_IDENTITY_KEYS_V20_2=[
  // MEMEFLOW_STATIC_IDENTITY_ONLY_V20_8_1
  'name','metadataName','symbol','metadataSymbol',
  'image','imageUrl','imageUri','logo','logoUrl','logoURI'
];""",'identity keys')
u=rep(u,"""      state:'WAITING',
      score:0,
      confidence:0,
      primaryReason:reason,""","""      state:'WAITING',
      score:null,
      confidence:null,
      primaryReason:reason,""",'invalidator top score')
u=rep(u,"""      decision:{
        state:'WAITING',score:0,confidence:0,
        primaryReason:reason,reasons:[reason],tradeEligible:false
      },""","""      decision:{
        state:'WAITING',score:null,confidence:null,
        primaryReason:reason,reasons:[reason],tradeEligible:false
      },""",'invalidator nested score')
u=rep(u,"""    const incomingByMint=new Map(
      incomingRows.map(
        row=>[String(row.mint),row]
      )
    );

    state.rows=""","""    const incomingByMint=new Map(
      incomingRows.map(
        row=>[String(row.mint),row]
      )
    );

    // MEMEFLOW_VISIBLE_INVALIDATION_SCOPE_V20_8_1
    const requestedMints=new Set(mints);

    state.rows=""",'requested set')
u=rep(u,"""        const incoming=incomingByMint.get(mint);

        return incoming
          ? __mfMergeMutableRowV18(previous,incoming)
          : __mfInvalidateDynamicRowV20_2(previous);""","""        const incoming=incomingByMint.get(mint);

        if(!requestedMints.has(mint))return previous;

        return incoming
          ? __mfMergeMutableRowV18(previous,incoming)
          : __mfInvalidateDynamicRowV20_2(previous);""",'visible invalidation')

# SMART uses hidden feed rank; visible Score remains AI score.
u=rep(u,"""        const scoreA =
          Number(tokenScore(a) ?? -1);

        const scoreB =
          Number(tokenScore(b) ?? -1);

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22""","""        // MEMEFLOW_SMART_HIDDEN_FEED_RANK_V20_8_1
        const feedA=finite(a?.feedScore??a?.relevanceScore)?Number(a?.feedScore??a?.relevanceScore):null;
        const feedB=finite(b?.feedScore??b?.relevanceScore)?Number(b?.feedScore??b?.relevanceScore):null;
        if(feedA!==null||feedB!==null){
          const rankA=feedA??Number.NEGATIVE_INFINITY;
          const rankB=feedB??Number.NEGATIVE_INFINITY;
          if(rankA!==rankB)return rankB-rankA;
        }

        const scoreA = Number(tokenScore(a) ?? -1);
        const scoreB = Number(tokenScore(b) ?? -1);
        if (scoreA !== scoreB) return scoreB - scoreA;

        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22""",'smart feed rank')
UI.write_text(u)

# 6. Existing feed-ranking test: order by feedScore, visible score preserved.
t=TEST.read_text()
t=rep(t,"""assert.ok(
  screenshotRegression[0].score > screenshotRegression[1].score,
  'live feed score must agree with live ordering'
);
assert.equal(screenshotRegression[0].decisionScore,0);
assert.equal(screenshotRegression[1].decisionScore,74);""","""assert.ok(
  screenshotRegression[0].feedScore > screenshotRegression[1].feedScore,
  'hidden feed score must agree with live ordering'
);
assert.equal(screenshotRegression[0].score,0);
assert.equal(screenshotRegression[1].score,74);
assert.equal(screenshotRegression[0].decisionScore,0);
assert.equal(screenshotRegression[1].decisionScore,74);""",'feed test')
TEST.write_text(t)

if OLD.exists():
 t=OLD.read_text().replace('force WAITING/0 and cannot remain BUY READY','force WAITING and cannot remain BUY READY')
 OLD.write_text(t)

# Browser JS cache-bust only.
h=HTML.read_text(); h,n=re.subn(r'src="/system-tokens\.js\?v=[^"]+"','src="/system-tokens.js?v=canonical-live-score-v20-8-1-20260903"',h,count=1)
if n!=1: raise SystemExit('asset cache-bust anchor missing')
HTML.write_text(h)
print('V20_8_1_TRANSFORM_OK')
PY

cat > "$NEWTEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const rankSource=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

const row=rankCandidateViews([{mint:'Canonical71',state:'WAITING',score:71,qualityScore:90,opportunityScore:95,holderCount:200,volume5mUsd:5000,transactions5m:100,marketCapUsd:25000,priceChange5mPct:20,quoteAgeMs:1000}])[0];
assert.equal(row.score,71);
assert.equal(row.decisionScore,71);
assert.ok(Number.isFinite(row.feedScore));
assert.match(rankSource,/MEMEFLOW_CANONICAL_VISIBLE_AI_SCORE_V20_8_1/);
assert.doesNotMatch(rankSource,/score:\s*liveCandidate\s*\?/);

const ds=app.indexOf('// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_1');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
const decision=app.slice(ds,de);
assert.ok(ds>=0&&de>ds);
assert.match(decision,/fresh=evaluate\(token,settings\)/);
assert.doesNotMatch(decision,/previewScore/);
assert.doesNotMatch(decision,/score:0/);
assert.doesNotMatch(decision,/confidence:0/);
assert.match(decision,/liveTruthBlocked:true/);

const fullStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const fullEnd=app.indexOf("if(url.pathname==='/api/ai/decisions')",fullStart);
const full=app.slice(fullStart,fullEnd);
assert.match(full,/__mfLiveDecisionForUserV14\(/);
assert.match(full,/__mfLiveCardViewV14\(/);
assert.match(full,/MEMEFLOW_UNIFIED_FULL_LIVE_VIEW_V20_8_1/);
assert.doesNotMatch(full,/__mfLiveStatesResponseCache\.set\(/);

const is=ui.indexOf('function __mfInvalidateDynamicRowV20_2(');
const ie=ui.indexOf('function __mfMergeMutableRowV18(',is);
const inv=ui.slice(is,ie);
assert.match(inv,/score:null/);
assert.match(inv,/confidence:null/);
assert.doesNotMatch(inv,/score:0/);
assert.doesNotMatch(inv,/confidence:0/);
assert.match(ui,/MEMEFLOW_VISIBLE_INVALIDATION_SCOPE_V20_8_1/);
assert.match(ui,/if\(!requestedMints\.has\(mint\)\)return previous;/);
assert.match(ui,/MEMEFLOW_SMART_HIDDEN_FEED_RANK_V20_8_1/);
assert.match(html,/system-tokens\.js\?v=canonical-live-score-v20-8-1-20260903/);

console.log('CANONICAL_LIVE_SCORE_PIPELINE_V20_8_1_OK');
TESTJS

echo "=== V20.8.1 SYNTAX ==="
node --check "$APP"
node --check "$UI"
node --check "$RANK"
node --check "$RANKTEST"
node --check "$NEWTEST"

echo "=== V20.8.1 TARGETED TESTS ==="
(
 cd memeflow-app
 node tests/canonical-live-score-pipeline-v20_8_1.mjs
 node tests/feed-ranking.mjs
 node tests/canonical-score-state-v20_7.mjs
 node tests/card-details-live-authority-v20_5.mjs
 node tests/live-truth-no-dynamic-cache-v20_3.mjs
 node tests/per-mint-card-refresh-v18.mjs
 node tests/settings-gate.mjs
 node tests/opportunity-engine.mjs
)

echo "=== V20.8.1 FULL TEST SUITE ==="
(cd memeflow-app && npm test)

git diff --check -- "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST" "$OLDLIVE" "$NEWTEST"

echo "=== V20.8.1 STATIC INVARIANTS ==="
python3 - <<'PY'
from pathlib import Path
app=Path('memeflow-app/app-server.mjs').read_text(); ui=Path('memeflow-app/system-tokens.js').read_text(); rank=Path('memeflow-app/src/feed-ranking.mjs').read_text()
errs=[]
if 'score: liveCandidate ? Math.round(relevanceScore) : decisionScore' in rank: errs.append('rank still overwrites visible score')
if 'previewScore' in app: errs.append('preview max-score path remains')
fs=app.find("if(url.pathname==='/api/system/live-token-states'"); fe=app.find("if(url.pathname==='/api/ai/decisions')",fs); full=app[fs:fe]
if '__mfLiveDecisionForUserV14(' not in full: errs.append('full route not canonical decision')
if '__mfLiveCardViewV14(' not in full: errs.append('full route not canonical view')
if '__mfLiveStatesResponseCache.set(' in full: errs.append('live response cache write remains')
is_=ui.find('function __mfInvalidateDynamicRowV20_2('); ie=ui.find('function __mfMergeMutableRowV18(',is_); inv=ui[is_:ie]
if 'score:0' in inv or 'confidence:0' in inv: errs.append('frontend still invents zero score')
if 'if(!requestedMints.has(mint))return previous;' not in ui: errs.append('non-visible rows still invalidated')
if errs: raise SystemExit('STATIC_INVARIANTS_FAILED\n- '+'\n- '.join(errs))
print('STATIC_INVARIANTS_OK')
PY

echo "=== V20.8.1 STAGE ==="
git reset >/dev/null
git add "$APP" "$UI" "$HTML" "$RANK" "$RANKTEST" "$NEWTEST"
[[ -f "$OLDLIVE" ]] && git add "$OLDLIVE"
BAD="$(git diff --cached --name-only | grep -Ev '^memeflow-app/(app-server\.mjs|system-tokens\.js|system-tokens\.html|src/feed-ranking\.mjs|tests/feed-ranking\.mjs|tests/live-truth-no-dynamic-cache-v20_3\.mjs|tests/canonical-live-score-pipeline-v20_8_1\.mjs)$' || true)"
if [[ -n "$BAD" ]]; then echo "ERROR unrelated staged files:"; echo "$BAD"; git reset; exit 1; fi
git diff --cached --check
git diff --cached --stat

git commit -m "fix: unify canonical live score pipeline"
git push origin HEAD

trap - EXIT INT TERM

echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo "Card Score = evaluate().score; feedScore = ranking only; missing fresh score = —; zero 5m activity = WAITING without destroying AI score."
