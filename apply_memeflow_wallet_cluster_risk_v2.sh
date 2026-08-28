#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_ID="MEMEFLOW_WALLET_CLUSTER_RISK_V2"
COMMIT_MSG="Add linked-wallet cluster risk gates and scoring"
NEW_MODULE="src/wallet-cluster-risk.mjs"
NEW_TEST="tests/wallet-cluster-risk-v2.mjs"

log(){ printf '[WALLET-RISK-V2] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$TOP" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$TOP"

BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || die "Detached HEAD. Checkout the MEMEFLOW working branch first."
git remote get-url origin >/dev/null 2>&1 || die "Git remote 'origin' is missing."
git fetch origin "$BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || die "Local $BRANCH is not exactly synced with origin/$BRANCH ($LOCAL_SHA != $REMOTE_SHA). Pull/push first; nothing changed."

if [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  APP="$TOP/memeflow-app"
elif [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  APP="$TOP"
else
  die "Cannot find MEMEFLOW app root (app-server.mjs + src/evaluate.mjs)."
fi
cd "$APP"

for f in src/settings.mjs src/evaluate.mjs src/event-holder-ledger.mjs app-server.mjs system.js; do
  [[ -f "$f" ]] || die "Missing required file: $f"
done

grep -q "eventHolderLedger" app-server.mjs || die "eventHolderLedger is missing from app-server.mjs"
grep -q "evaluateAll" app-server.mjs || die "evaluateAll is missing from app-server.mjs"
grep -q "rpc\.callOnce" app-server.mjs || die "Expected queue-controlled Solana rpc.callOnce runtime is missing"
grep -q "byMint" src/event-holder-ledger.mjs || die "EventHolderLedger.byMint is missing"
grep -q "const MF293_GROUPS" system.js || die "Current MF293 System Settings engine is missing"

if grep -q "MEMEFLOW_WALLET_CLUSTER_RISK_V1" src/evaluate.mjs 2>/dev/null || \
   grep -q "$PATCH_ID" src/evaluate.mjs 2>/dev/null || \
   grep -q "$PATCH_ID" app-server.mjs 2>/dev/null || [[ -e "$NEW_MODULE" ]]; then
  die "A wallet-cluster runtime patch already appears installed; re-audit before stacking another one."
fi

TARGETS=(src/settings.mjs src/evaluate.mjs app-server.mjs system.js)
[[ -f settings-page.js ]] && TARGETS+=(settings-page.js)
for f in "${TARGETS[@]}"; do
  git diff --quiet -- "$f" || die "$f has unstaged local changes. Commit/push that file first; nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged local changes. Commit/push that file first; nothing changed."
done
[[ ! -e "$NEW_MODULE" ]] || die "$NEW_MODULE already exists"
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists"

BACKUP=".wallet-cluster-risk-v2-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed. Restoring original runtime/settings files..."
  for f in "${TARGETS[@]}"; do [[ -f "$BACKUP/$f" ]] && cp -p "$BACKUP/$f" "$f" || true; done
  rm -f "$NEW_MODULE" "$NEW_TEST"
  git reset --quiet -- "${TARGETS[@]}" "$NEW_MODULE" "$NEW_TEST" 2>/dev/null || true
  log "ROLLBACK complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Writing bounded one-hop wallet-cluster scanner..."
cat > "$NEW_MODULE" <<'EOF_MODULE'
// MEMEFLOW_WALLET_CLUSTER_RISK_V2
// One-hop only: direct candidate-to-candidate funding or a tightly coordinated
// common funder. No Helius, no external blacklist, no multi-hop graph.

const LAMPORTS_PER_SOL = 1_000_000_000;
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const clampPct = v => Math.max(0, Math.min(100, Math.round(Number(v) * 1000) / 1000));

function ms(v){
  const n=Number(v);
  if(!Number.isFinite(n)||n<=0)return null;
  return n<1e12?n*1000:n;
}

function rawSupply(row, token){
  const decimals=Number.isInteger(Number(row?.decimals))?Number(row.decimals):6;
  const uiCandidates=[row?.totalSupplyUi,token?.totalSupply,token?.supply,token?.totalSupplyUi];
  for(const value of uiCandidates){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)continue;
    const scaled=n*(10**decimals);
    if(Number.isSafeInteger(Math.round(scaled))&&scaled>0)return BigInt(Math.round(scaled));
  }
  return null;
}

function pctRaw(n,d){
  if(typeof n!=='bigint'||typeof d!=='bigint'||d<=0n)return null;
  return clampPct(Number((n*100000n)/d)/1000);
}

function txInstructions(tx){
  const out=[];
  const outer=tx?.transaction?.message?.instructions;
  if(Array.isArray(outer))out.push(...outer);
  const inner=tx?.meta?.innerInstructions;
  if(Array.isArray(inner)){
    for(const group of inner){
      if(Array.isArray(group?.instructions))out.push(...group.instructions);
    }
  }
  return out;
}

function inboundSystemTransfer(tx,wallet,minLamports){
  let best=null;
  for(const ix of txInstructions(tx)){
    const parsed=ix?.parsed;
    const type=String(parsed?.type||'').toLowerCase();
    const info=parsed?.info||{};
    const program=String(ix?.program||'').toLowerCase();
    if(program!=='system'||!['transfer','transferwithseed'].includes(type))continue;
    const destination=String(info?.destination||info?.to||'');
    const source=String(info?.source||info?.from||'');
    const lamports=Number(info?.lamports??info?.amount??0);
    if(destination!==wallet||!source||source===wallet||!Number.isFinite(lamports)||lamports<minLamports)continue;
    if(!best||lamports>best.lamports)best={funder:source,lamports};
  }
  return best;
}

async function recentFunder(rpc,wallet,targetAt,opts){
  const sigLimit=opts.signatureLimit;
  const txLimit=opts.txPerWallet;
  const lookbackMs=opts.lookbackMs;
  const afterSlackMs=opts.afterSlackMs;
  const minLamports=opts.minFundingLamports;
  let rows=[];
  try{
    rows=await rpc.callOnce('getSignaturesForAddress',[wallet,{limit:sigLimit,commitment:'confirmed'}]);
  }catch{
    return null;
  }
  if(!Array.isArray(rows)||!rows.length)return null;
  let fetched=0;
  for(const row of rows){
    if(fetched>=txLimit)break;
    const signature=String(row?.signature||'');
    if(!signature||row?.err)continue;
    const rowAt=ms(row?.blockTime);
    if(rowAt!==null&&targetAt!==null){
      if(rowAt>targetAt+afterSlackMs)continue;
      if(rowAt<targetAt-lookbackMs)break;
    }
    let tx=null;
    try{
      tx=await rpc.callOnce('getTransaction',[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]);
    }catch{
      continue;
    }
    fetched++;
    const at=ms(tx?.blockTime)??rowAt;
    if(targetAt!==null&&at!==null&&(at>targetAt+afterSlackMs||at<targetAt-lookbackMs))continue;
    const inbound=inboundSystemTransfer(tx,wallet,minLamports);
    if(inbound)return {...inbound,wallet,at,signature};
  }
  return null;
}

class DSU{
  constructor(items){this.parent=new Map(items.map(x=>[x,x]));}
  find(x){
    if(!this.parent.has(x))this.parent.set(x,x);
    let p=this.parent.get(x);
    while(p!==this.parent.get(p))p=this.parent.get(p);
    let cur=x;
    while(this.parent.get(cur)!==p){const next=this.parent.get(cur);this.parent.set(cur,p);cur=next;}
    return p;
  }
  union(a,b){const ra=this.find(a),rb=this.find(b);if(ra!==rb)this.parent.set(rb,ra);}
}

function coordinated(records,opts){
  if(records.length<2)return false;
  const times=records.map(x=>Number(x.at)).filter(Number.isFinite);
  if(times.length<2)return false;
  if(Math.max(...times)-Math.min(...times)>opts.commonFunderWindowMs)return false;
  const amounts=records.map(x=>Number(x.lamports)).filter(x=>Number.isFinite(x)&&x>0);
  if(amounts.length<2)return false;
  const ratio=Math.max(...amounts)/Math.min(...amounts);
  return ratio<=opts.commonFunderAmountRatio;
}

export function walletRiskPenalty(riskyPct,insiderPct){
  const risky=finite(riskyPct)?Number(riskyPct):null;
  const insider=finite(insiderPct)?Number(insiderPct):null;
  const band=(value,cutoffs)=>{
    if(value===null)return 0;
    if(value<=cutoffs[0])return 0;
    if(value<=cutoffs[1])return 5;
    if(value<=cutoffs[2])return 10;
    if(value<=cutoffs[3])return 15;
    return 20;
  };
  // Do not double-penalize the same cluster: take the stronger signal only.
  return Math.max(band(risky,[10,15,20,25]),band(insider,[5,10,15,20]));
}

export async function scanWalletClusterRisk({rpc,token={},holderRow,options={}}={}){
  if(!rpc||typeof rpc.callOnce!=='function')return {ok:false,reason:'rpc-unavailable'};
  if(!holderRow||!(holderRow.balances instanceof Map))return {ok:false,reason:'holder-row-unavailable'};

  const opts={
    topHolders:Math.max(3,Math.min(10,Number(options.topHolders??process.env.WALLET_CLUSTER_TOP_HOLDERS??8))),
    earlyBuyers:Math.max(3,Math.min(10,Number(options.earlyBuyers??process.env.WALLET_CLUSTER_EARLY_BUYERS??8))),
    maxWallets:Math.max(6,Math.min(12,Number(options.maxWallets??process.env.WALLET_CLUSTER_MAX_WALLETS??10))),
    signatureLimit:Math.max(2,Math.min(6,Number(options.signatureLimit??process.env.WALLET_CLUSTER_SIGNATURE_LIMIT??4))),
    txPerWallet:Math.max(1,Math.min(3,Number(options.txPerWallet??process.env.WALLET_CLUSTER_TX_PER_WALLET??2))),
    lookbackMs:Math.max(5*60_000,Number(options.lookbackMs??process.env.WALLET_CLUSTER_FUNDING_LOOKBACK_MS??30*60_000)),
    afterSlackMs:Math.max(0,Number(options.afterSlackMs??process.env.WALLET_CLUSTER_AFTER_BUY_SLACK_MS??15_000)),
    commonFunderWindowMs:Math.max(30_000,Number(options.commonFunderWindowMs??process.env.WALLET_CLUSTER_COMMON_FUNDER_WINDOW_MS??180_000)),
    commonFunderAmountRatio:Math.max(1.1,Number(options.commonFunderAmountRatio??process.env.WALLET_CLUSTER_AMOUNT_RATIO??2.5)),
    minFundingLamports:Math.max(1_000_000,Number(options.minFundingLamports??process.env.WALLET_CLUSTER_MIN_FUNDING_LAMPORTS??0.02*LAMPORTS_PER_SOL))
  };

  const holders=[...holderRow.balances.entries()]
    .filter(([wallet,amount])=>wallet&&typeof amount==='bigint'&&amount>0n)
    .sort((a,b)=>a[1]===b[1]?0:(a[1]>b[1]?-1:1));
  const creator=String(holderRow.creator||token.creator||token.creatorWallet||token.developerWallet||'').trim()||null;
  const firstBuyAt=holderRow.firstBuyAt instanceof Map?holderRow.firstBuyAt:new Map();
  const createdAt=ms(holderRow.createdAt||token.pumpCreatedAt||token.discoveredAt||Date.now())||Date.now();

  const ordered=[];
  const seen=new Set();
  const add=wallet=>{wallet=String(wallet||'').trim();if(wallet&&!seen.has(wallet)){seen.add(wallet);ordered.push(wallet);}};
  for(const [wallet] of holders.slice(0,opts.topHolders))add(wallet);
  const early=[...firstBuyAt.entries()]
    .filter(([wallet,at])=>wallet&&ms(at)!==null)
    .sort((a,b)=>ms(a[1])-ms(b[1]))
    .slice(0,opts.earlyBuyers);
  for(const [wallet] of early)add(wallet);
  if(creator)add(creator);

  let candidates=ordered.slice(0,opts.maxWallets);
  if(creator&&!candidates.includes(creator)){
    candidates=candidates.slice(0,Math.max(0,opts.maxWallets-1));
    candidates.push(creator);
  }
  if(candidates.length<2)return {ok:true,version:'V2',suspectedRiskyWalletsPct:0,insidersPct:0,sampledWallets:candidates.length,linkedWallets:0,commonFunders:0,evidence:[]};

  const records=[];
  for(const wallet of candidates){
    const targetAt=ms(firstBuyAt.get(wallet))??(createdAt+2*60_000);
    const rec=await recentFunder(rpc,wallet,targetAt,opts);
    if(rec)records.push(rec);
  }

  const dsu=new DSU(candidates);
  const candidateSet=new Set(candidates);
  const evidence=[];

  // Strong signal #1: a sampled wallet directly funds another sampled wallet.
  for(const rec of records){
    if(candidateSet.has(rec.funder)){
      dsu.union(rec.wallet,rec.funder);
      evidence.push({type:'direct',funder:rec.funder,wallets:[rec.wallet],at:rec.at,lamports:rec.lamports});
    }
  }

  // Strong signal #2: same external funder, close in time, broadly similar amount.
  const byFunder=new Map();
  for(const rec of records){
    const list=byFunder.get(rec.funder)||[];
    list.push(rec);byFunder.set(rec.funder,list);
  }
  let commonFunders=0;
  for(const [funder,list] of byFunder){
    const unique=[...new Map(list.map(x=>[x.wallet,x])).values()];
    const required=creator&&funder===creator?2:3;
    if(unique.length<required||!coordinated(unique,opts))continue;
    commonFunders++;
    const first=unique[0].wallet;
    for(const rec of unique.slice(1))dsu.union(first,rec.wallet);
    if(candidateSet.has(funder))dsu.union(first,funder);
    evidence.push({
      type:'common-funder',funder,
      wallets:unique.map(x=>x.wallet),
      spanMs:Math.max(...unique.map(x=>Number(x.at)))-Math.min(...unique.map(x=>Number(x.at))),
      minLamports:Math.min(...unique.map(x=>Number(x.lamports))),
      maxLamports:Math.max(...unique.map(x=>Number(x.lamports)))
    });
  }

  const groups=new Map();
  for(const wallet of candidates){
    const root=dsu.find(wallet);const list=groups.get(root)||[];list.push(wallet);groups.set(root,list);
  }
  const linkedGroups=[...groups.values()].filter(group=>group.length>=2);
  const linkedMembers=new Set(linkedGroups.flat());
  const insiderMembers=new Set();
  if(creator){
    for(const group of linkedGroups){
      if(group.includes(creator))for(const wallet of group)insiderMembers.add(wallet);
    }
  }

  const supply=rawSupply(holderRow,token);
  if(supply===null){
    return {
      ok:false,reason:'supply-unavailable',version:'V2',sampledWallets:candidates.length,
      linkedWallets:linkedMembers.size,commonFunders,evidence
    };
  }
  const amountFor=wallet=>{
    const amount=holderRow.balances.get(wallet);
    return typeof amount==='bigint'&&amount>0n?amount:0n;
  };
  let linkedRaw=0n,insiderRaw=0n;
  for(const wallet of linkedMembers)linkedRaw+=amountFor(wallet);
  for(const wallet of insiderMembers)insiderRaw+=amountFor(wallet);
  const suspectedRiskyWalletsPct=pctRaw(linkedRaw,supply)??0;
  const insidersPct=pctRaw(insiderRaw,supply)??0;

  return {
    ok:true,
    version:'V2_ONE_HOP_COMMON_FUNDER',
    suspectedRiskyWalletsPct,
    insidersPct,
    sampledWallets:candidates.length,
    fundingRecords:records.length,
    linkedWallets:linkedMembers.size,
    insiderWallets:insiderMembers.size,
    commonFunders,
    evidence:evidence.slice(0,8),
    scannedAt:Date.now()
  };
}
EOF_MODULE

log "Adding the two missing percentage settings to the CURRENT settings contract..."
python3 - <<'PY_SETTINGS'
from pathlib import Path
import re
p=Path('src/settings.mjs')
s=p.read_text(encoding='utf-8')
MARK='MEMEFLOW_WALLET_CLUSTER_RISK_V2_SETTINGS'
if MARK in s:
    raise SystemExit('V2 settings wrapper already installed')
for public,base in (
    ('defaultSettings','__mfWalletV2BaseDefaultSettings'),
    ('normalizeSettings','__mfWalletV2BaseNormalizeSettings'),
    ('validateSettings','__mfWalletV2BaseValidateSettings'),
):
    pat=rf'export\s+function\s+{public}\s*\('
    n=len(re.findall(pat,s))
    if n!=1:
        raise SystemExit(f'settings.mjs expected exactly one export function {public}(), found {n}')
    s=re.sub(pat,f'function {base}(',s,count=1)
wrapper=r"""
// MEMEFLOW_WALLET_CLUSTER_RISK_V2_SETTINGS
// Moderate defaults: protection without an ultra-strict anti-scam wall.
const __mfWalletV2Defaults=Object.freeze({maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25});
const __mfWalletV2Keys=Object.freeze(Object.keys(__mfWalletV2Defaults));
function __mfWalletV2Obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function __mfWalletV2Strip(raw){const o={...__mfWalletV2Obj(raw)};for(const k of __mfWalletV2Keys)delete o[k];return o}
function __mfWalletV2Pct(v,fallback){if(v===''||v===null||v===undefined)return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback}
export function defaultSettings(){return {...__mfWalletV2BaseDefaultSettings(),...__mfWalletV2Defaults}}
export function normalizeSettings(raw={}){
  const input=__mfWalletV2Obj(raw),out={...__mfWalletV2BaseNormalizeSettings(__mfWalletV2Strip(input))};
  for(const k of __mfWalletV2Keys)out[k]=__mfWalletV2Pct(Object.prototype.hasOwnProperty.call(input,k)?input[k]:undefined,__mfWalletV2Defaults[k]);
  return out;
}
export function validateSettings(raw={}){
  const input=__mfWalletV2Obj(raw),base=__mfWalletV2BaseValidateSettings(__mfWalletV2Strip(input));
  const errors=Array.isArray(base?.errors)?[...base.errors]:[];
  for(const k of __mfWalletV2Keys){
    if(!Object.prototype.hasOwnProperty.call(input,k))continue;
    const v=input[k];if(v===''||v===null||v===undefined)continue;
    const n=Number(v);if(!Number.isFinite(n))errors.push(`${k} must be a number.`);else if(n<0||n>100)errors.push(`${k} must be between 0 and 100.`);
  }
  return {...(base&&typeof base==='object'?base:{}),ok:errors.length===0,errors,settings:normalizeSettings(input)};
}
"""
p.write_text(s.rstrip()+'\n\n'+wrapper.strip()+'\n',encoding='utf-8')
PY_SETTINGS

log "Adding the same two controls to MF293 System Settings..."
python3 - <<'PY_UI'
from pathlib import Path
import re
MARK='MEMEFLOW_WALLET_CLUSTER_RISK_V2_UI'
paths=[Path('system.js')]
if Path('settings-page.js').is_file():
    paths.append(Path('settings-page.js'))
fields="""['maxSuspectedRiskyWalletsPct', 'Maximum linked wallets %', 'nullable', 0, 100, 0.1],
['maxInsidersPct', 'Maximum creator-linked wallets %', 'nullable', 0, 100, 0.1],"""
for p in paths:
    s=p.read_text(encoding='utf-8')
    if MARK in s:
        continue
    if 'const MF293_GROUPS' not in s:
        raise SystemExit(f'{p}: MF293_GROUPS missing')
    start=s.find('const MF293_GROUPS')
    end=s.find('function mf293Clone',start)
    if start<0 or end<0:
        raise SystemExit(f'{p}: could not isolate MF293_GROUPS')
    seg=s[start:end]
    if 'maxSuspectedRiskyWalletsPct' in seg or 'maxInsidersPct' in seg:
        raise SystemExit(f'{p}: partial wallet-risk UI fields already exist; refusing duplicate')
    pat=re.compile(r"(?m)^(?P<indent>[ \t]*)\[\s*(['\"])maxDeveloperPct\2\s*,[^\n]*\]\s*,?\s*$")
    matches=list(pat.finditer(seg))
    if len(matches)!=1:
        pat=re.compile(r"(?m)^(?P<indent>[ \t]*)\[\s*(['\"])maxSniperPct\2\s*,[^\n]*\]\s*,?\s*$")
        matches=list(pat.finditer(seg))
    if len(matches)!=1:
        raise SystemExit(f'{p}: unique maxDeveloperPct/maxSniperPct MF293 row not found')
    m=matches[0]
    indent=m.group('indent')
    addition='\n'.join(indent+line for line in fields.splitlines())
    seg=seg[:m.end()]+'\n'+addition+seg[m.end():]
    s=s[:start]+seg+s[end:]+f'\n/* {MARK} */\n'
    p.write_text(s,encoding='utf-8')
PY_UI

log "Wiring hard gates + bounded score penalty into the CURRENT evaluator..."
python3 - <<'PY_EVAL'
from pathlib import Path
import re
p=Path('src/evaluate.mjs')
s=p.read_text(encoding='utf-8')
MARK='MEMEFLOW_WALLET_CLUSTER_RISK_V2'
if MARK in s:
    raise SystemExit('V2 evaluator already installed')
if 'maxSuspectedRiskyWalletsPct' in s or 'maxInsidersPct' in s:
    raise SystemExit('evaluate.mjs already contains a wallet-risk setting key; refusing to double-gate')
pat=re.compile(r'\bexport\s+function\s+evaluate\s*\(')
matches=list(pat.finditer(s))
if len(matches)!=1:
    raise SystemExit(f'evaluate export: expected exactly 1 exported function, found {len(matches)}')
s=pat.sub('function __mfWalletV2BaseEvaluate(',s,count=1)
wrapper=r"""
// MEMEFLOW_WALLET_CLUSTER_RISK_V2
function __mfWalletV2Finite(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null}
function __mfWalletV2Band(v,cuts){const n=__mfWalletV2Finite(v);if(n===null||n<=cuts[0])return 0;if(n<=cuts[1])return 5;if(n<=cuts[2])return 10;if(n<=cuts[3])return 15;return 20}
function __mfWalletV2Penalty(token={}){
  return Math.max(
    __mfWalletV2Band(token?.suspectedRiskyWalletsPct,[10,15,20,25]),
    __mfWalletV2Band(token?.insidersPct,[5,10,15,20])
  );
}
export function evaluate(token={},settings={}){
  const base=__mfWalletV2BaseEvaluate(token,settings);
  const gates=Array.isArray(base?.settingsEvaluation?.gates)?[...base.settingsEvaluation.gates]:[];
  const reasons=Array.isArray(base?.reasons)?[...base.reasons]:[];
  const originalState=String(base?.state||'WAITING').toUpperCase();
  let blocked=false,waiting=false,riskPrimary=null;
  const addMax=(name,settingKey,tokenKey,label)=>{
    const threshold=__mfWalletV2Finite(settings?.[settingKey]);
    if(threshold===null)return;
    const value=__mfWalletV2Finite(token?.[tokenKey]);
    if(value===null){
      waiting=true;
      const reason=`Waiting: ${label} scan pending`;
      gates.push({name,status:'WAITING',pass:false,value:null,threshold,operator:'<='});
      reasons.push(reason);if(!riskPrimary)riskPrimary=reason;return;
    }
    if(value>threshold){
      blocked=true;
      const reason=`${label} ${value}% above configured maximum ${threshold}%`;
      gates.push({name,status:'FAIL',pass:false,value,threshold,operator:'<='});
      reasons.push(reason);if(!riskPrimary)riskPrimary=reason;return;
    }
    gates.push({name,status:'PASS',pass:true,value,threshold,operator:'<='});
  };
  addMax('Maximum linked wallets','maxSuspectedRiskyWalletsPct','suspectedRiskyWalletsPct','linked wallets');
  addMax('Maximum creator-linked wallets','maxInsidersPct','insidersPct','creator-linked wallets');

  const before=Math.max(0,Math.min(100,Number(base?.score)||0));
  const penalty=__mfWalletV2Penalty(token);
  const score=Math.max(0,Math.min(100,before-penalty));
  const minScore=__mfWalletV2Finite(settings?.minScore);
  let state=originalState;
  if(blocked)state='BLOCKED';
  else if(waiting&&originalState!=='BLOCKED')state='WAITING';
  else if(state==='BUY READY'&&minScore!==null&&score<minScore){
    state='WATCH';
    reasons.unshift(`wallet-risk penalty ${penalty} lowered AI score ${before} -> ${score} below minimum ${minScore}`);
  }

  return {
    ...base,state,score,reasons,
    primaryReason:(blocked||waiting)?(riskPrimary||base?.primaryReason||reasons[0]||null):(base?.primaryReason||reasons[0]||null),
    settingsEvaluation:{...(base?.settingsEvaluation||{}),gates},
    scoreBeforeWalletRisk:before,
    walletRiskPenalty:penalty,
    walletRisk:{
      suspectedRiskyWalletsPct:__mfWalletV2Finite(token?.suspectedRiskyWalletsPct),
      insidersPct:__mfWalletV2Finite(token?.insidersPct),
      scannedAt:token?.walletClusterRiskScannedAt||null,
      version:token?.walletClusterRiskVersion||null
    }
  };
}
"""
p.write_text(s.rstrip()+'\n\n'+wrapper.strip()+'\n',encoding='utf-8')
PY_EVAL

log "Adding low-rate background worker; Pump TradeEvent hot path remains untouched..."
cat >> app-server.mjs <<'EOF_SERVER'

// MEMEFLOW_WALLET_CLUSTER_RISK_V2
// Background-only: never blocks the Pump TradeEvent hot path. If the existing
// risk % setting is enabled, evaluate() naturally keeps the token WAITING until
// this evidence is available.
let __mfWalletClusterBusy=false;
let __mfWalletClusterModulePromise=null;
const __mfWalletClusterModule=()=>__mfWalletClusterModulePromise||=(import('./src/wallet-cluster-risk.mjs'));

function __mfWalletClusterPumpToken(t){
  const p=String(t?.launchPlatform||t?.protocol||t?.source||'').toLowerCase();
  return p.includes('pump');
}
function __mfWalletClusterCandidate(){
  const now=Date.now();
  const ttl=Math.max(30_000,Number(process.env.WALLET_CLUSTER_SCAN_TTL_MS||120_000));
  const maxAge=Math.max(5*60_000,Number(process.env.WALLET_CLUSTER_MAX_TOKEN_AGE_MS||20*60_000));
  const rows=typeof store?.tokens==='function'?store.tokens():Object.values(store?.state?.tokens||{});
  return rows
    .filter(t=>{
      if(!t?.mint||!__mfWalletClusterPumpToken(t)||t?.holderFresh!==true)return false;
      if(Number(t?.holderCount||0)<3)return false;
      const created=Number(t?.pumpCreatedAt||t?.discoveredAt||0);
      if(created>0&&now-created>maxAge)return false;
      const last=Number(t?.walletClusterRiskScannedAt||0);
      const failed=Number(t?.walletClusterRiskLastAttemptAt||0);
      if(last>0&&now-last<ttl)return false;
      if(!last&&failed>0&&now-failed<20_000)return false;
      return true;
    })
    .sort((a,b)=>{
      const ap=a?.walletClusterRiskScannedAt?1:0,bp=b?.walletClusterRiskScannedAt?1:0;
      if(ap!==bp)return ap-bp;
      return Number(b?.updatedAt||b?.pumpMarketUpdatedAt||b?.discoveredAt||0)-Number(a?.updatedAt||a?.pumpMarketUpdatedAt||a?.discoveredAt||0);
    })[0]||null;
}

async function __mfWalletClusterTick(){
  if(__mfWalletClusterBusy)return;
  const token=__mfWalletClusterCandidate();
  if(!token)return;
  const mint=String(token.mint);
  const row=eventHolderLedger?.byMint?.get?.(mint)||null;
  if(!row||!(row.balances instanceof Map))return;

  __mfWalletClusterBusy=true;
  try{
    const {scanWalletClusterRisk}=await __mfWalletClusterModule();
    const result=await scanWalletClusterRisk({rpc,token,holderRow:row});
    const now=Date.now();
    let patch;
    if(result?.ok){
      patch={
        suspectedRiskyWalletsPct:Number(result.suspectedRiskyWalletsPct)||0,
        insidersPct:Number(result.insidersPct)||0,
        walletClusterRiskScannedAt:result.scannedAt||now,
        walletClusterRiskLastAttemptAt:now,
        walletClusterRiskVersion:result.version||'V2',
        walletClusterRiskSampledWallets:Number(result.sampledWallets)||0,
        walletClusterRiskLinkedWallets:Number(result.linkedWallets)||0,
        walletClusterRiskInsiderWallets:Number(result.insiderWallets)||0,
        walletClusterRiskCommonFunders:Number(result.commonFunders)||0,
        walletClusterRiskEvidence:Array.isArray(result.evidence)?result.evidence.slice(0,8):[],
        walletClusterRiskLastError:null
      };
    }else{
      patch={
        walletClusterRiskLastAttemptAt:now,
        walletClusterRiskLastError:String(result?.reason||'scan-failed').slice(0,180)
      };
    }
    const updated=store?.setToken?.(mint,patch)||store?.state?.tokens?.[mint];
    if(updated&&result?.ok){
      try{await Promise.resolve(evaluateAll(updated))}catch{}
      try{publish(mint)}catch{}
    }
  }catch(error){
    try{store?.setToken?.(mint,{walletClusterRiskLastAttemptAt:Date.now(),walletClusterRiskLastError:String(error?.message||error).slice(0,180)})}catch{}
  }finally{
    __mfWalletClusterBusy=false;
  }
}

const __mfWalletClusterInterval=setInterval(
  ()=>void __mfWalletClusterTick(),
  Math.max(5_000,Number(process.env.WALLET_CLUSTER_SCAN_INTERVAL_MS||6_000))
);
__mfWalletClusterInterval.unref?.();
setTimeout(()=>void __mfWalletClusterTick(),4_000).unref?.();
EOF_SERVER

log "Writing focused regression tests..."
mkdir -p tests
cat > "$NEW_TEST" <<'EOF_TEST'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanWalletClusterRisk,walletRiskPenalty} from '../src/wallet-cluster-risk.mjs';
import {defaultSettings,normalizeSettings,validateSettings} from '../src/settings.mjs';
import {evaluate} from '../src/evaluate.mjs';

const NOW=Date.now();
function transferTx(source,destination,lamports,atMs){
  return {blockTime:Math.floor(atMs/1000),transaction:{message:{instructions:[{program:'system',parsed:{type:'transfer',info:{source,destination,lamports}}}]}},meta:{innerInstructions:[]}};
}
function fakeRpc(plan){
  return {async callOnce(method,args){
    if(method==='getSignaturesForAddress'){
      const wallet=args[0],rows=plan[wallet]||[];
      return rows.map((row,i)=>({signature:`sig-${wallet}-${i}`,blockTime:Math.floor(row.at/1000),err:null}));
    }
    if(method==='getTransaction'){
      const m=/^sig-(.+)-(\d+)$/.exec(String(args[0]));
      const row=m?(plan[m[1]]||[])[Number(m[2])]:null;
      return row?transferTx(row.funder,m[1],row.lamports,row.at):null;
    }
    throw new Error(`unexpected ${method}`);
  }};
}
function holderRow(){
  return {creator:'CREATOR',decimals:0,totalSupplyUi:1000,createdAt:NOW-60_000,
    balances:new Map([['A',180n],['B',140n],['C',120n],['CREATOR',20n],['D',10n]]),
    firstBuyAt:new Map([['A',NOW-40_000],['B',NOW-39_000],['C',NOW-38_000],['D',NOW-37_000]])};
}

test('settings contract adds moderate adjustable defaults',()=>{
  const d=defaultSettings();
  assert.equal(d.maxSuspectedRiskyWalletsPct,35);
  assert.equal(d.maxInsidersPct,25);
  const n=normalizeSettings({...d,maxSuspectedRiskyWalletsPct:31.5,maxInsidersPct:19});
  assert.equal(n.maxSuspectedRiskyWalletsPct,31.5);
  assert.equal(n.maxInsidersPct,19);
  assert.equal(validateSettings({...d,maxInsidersPct:101}).ok,false);
});

test('external common funder needs three coordinated wallets',async()=>{
  const at=NOW-50_000;
  const two=await scanWalletClusterRisk({
    rpc:fakeRpc({A:[{funder:'FUNDER-X',lamports:1_000_000_000,at}],B:[{funder:'FUNDER-X',lamports:1_100_000_000,at:at+10_000}]}),
    token:{mint:'MINT',creator:'CREATOR',pumpCreatedAt:NOW-60_000,totalSupply:1000},
    holderRow:holderRow(),options:{topHolders:5,earlyBuyers:5,maxWallets:8,signatureLimit:2,txPerWallet:1}
  });
  assert.equal(two.suspectedRiskyWalletsPct,0);

  const three=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:[{funder:'FUNDER-X',lamports:1_000_000_000,at}],
      B:[{funder:'FUNDER-X',lamports:1_100_000_000,at:at+10_000}],
      C:[{funder:'FUNDER-X',lamports:900_000_000,at:at+15_000}]
    }),
    token:{mint:'MINT',creator:'CREATOR',pumpCreatedAt:NOW-60_000,totalSupply:1000},
    holderRow:holderRow(),options:{topHolders:5,earlyBuyers:5,maxWallets:8,signatureLimit:2,txPerWallet:1}
  });
  assert.equal(three.suspectedRiskyWalletsPct,44);
  assert.equal(three.commonFunders,1);
});

test('creator funding two wallets is strong insider evidence',async()=>{
  const at=NOW-50_000;
  const r=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:[{funder:'CREATOR',lamports:1_000_000_000,at}],
      B:[{funder:'CREATOR',lamports:1_050_000_000,at:at+8_000}]
    }),
    token:{mint:'MINT',creator:'CREATOR',pumpCreatedAt:NOW-60_000,totalSupply:1000},
    holderRow:holderRow(),options:{topHolders:5,earlyBuyers:5,maxWallets:8,signatureLimit:2,txPerWallet:1}
  });
  assert.equal(r.suspectedRiskyWalletsPct,34);
  assert.equal(r.insidersPct,34);
});

test('score penalty is bounded and never double-counts overlap',()=>{
  assert.equal(walletRiskPenalty(8,3),0);
  assert.equal(walletRiskPenalty(17,3),10);
  assert.equal(walletRiskPenalty(22,12),15);
  assert.equal(walletRiskPenalty(40,40),20);
});

test('evaluator exposes linked-wallet hard gate',()=>{
  const token={
    mint:'RiskGate111111111111111111111111111pump',launchPlatform:'pump',protocol:'pump',source:'Pump create',
    discoveredAt:NOW-60_000,pumpCreatedAt:NOW-60_000,pumpCreatedAtPending:false,
    holderCount:120,holderFresh:true,holderSource:'Solana getProgramAccounts baseline + live Pump TradeEvent delta',holderScannedAt:NOW,
    top10Pct:10,developerPct:2,buyPressure:3,priceSol:1,peakPriceSol:1,dataQuality:1,
    liquidityUsd:1_000_000,marketCapUsd:1_000_000,bondingCurvePct:10,bondingCurveProgressPct:10,volume24hUsd:1_000_000,
    buys24h:100,sells24h:10,buyTransactions:100,sellTransactions:10,totalTransactions:110,totalFeesSol:100,bundlePct:0,sniperPct:0,
    twitter:'https://x.com/risk',website:'https://example.invalid',metadataResolved:true,metadataReady:true,imageUrl:'https://example.invalid/logo.png',
    suspectedRiskyWalletsPct:40,insidersPct:2,pumpMarketUpdatedAt:NOW,lastPriceAt:NOW
  };
  const d=evaluate(token,{...defaultSettings(),minScore:0,minConfidence:0,maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25});
  const gate=d.settingsEvaluation.gates.find(g=>g.name==='Maximum linked wallets');
  assert.equal(gate?.status,'FAIL');
  assert.equal(d.state,'BLOCKED');
  assert.equal(d.walletRiskPenalty,20);
});

test('current UI and worker are wired without Helius',()=>{
  const sys=fs.readFileSync(new URL('../system.js',import.meta.url),'utf8');
  assert.match(sys,/Maximum linked wallets %/);
  assert.match(sys,/Maximum creator-linked wallets %/);
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  const i=app.lastIndexOf('// MEMEFLOW_WALLET_CLUSTER_RISK_V2');
  assert.ok(i>=0);
  const block=app.slice(i);
  assert.match(block,/eventHolderLedger\?\.byMint/);
  assert.match(block,/scanWalletClusterRisk/);
  assert.doesNotMatch(block,/helius/i);
});
EOF_TEST

log "Syntax checks..."
node --check src/settings.mjs
node --check src/evaluate.mjs
node --check "$NEW_MODULE"
node --check app-server.mjs
node --check system.js
[[ -f settings-page.js ]] && node --check settings-page.js
node --check "$NEW_TEST"
git --no-pager diff --check

log "Focused wallet-cluster tests..."
node --test "$NEW_TEST"

log "Existing MEMEFLOW test suite..."
npm test

log "Final static checks..."
grep -q "MEMEFLOW_WALLET_CLUSTER_RISK_V2_SETTINGS" src/settings.mjs || die "settings V2 marker missing"
for f in src/evaluate.mjs app-server.mjs "$NEW_MODULE"; do
  grep -q "$PATCH_ID" "$f" || die "$PATCH_ID marker missing from $f"
done
grep -q "Maximum linked wallets %" system.js || die "linked-wallet UI field missing"
grep -q "Maximum creator-linked wallets %" system.js || die "creator-linked UI field missing"
[[ ! -f settings-page.js ]] || grep -q "Maximum linked wallets %" settings-page.js || die "standalone settings-page.js field missing"

git fetch origin "$BRANCH"
LATEST_REMOTE="$(git rev-parse "origin/$BRANCH")"
[[ "$LATEST_REMOTE" == "$REMOTE_SHA" ]] || die "origin/$BRANCH moved during tests ($REMOTE_SHA -> $LATEST_REMOTE). Nothing committed/pushed; rollback will restore local files."

STAGE=("${TARGETS[@]}" "$NEW_MODULE" "$NEW_TEST")
git add -- "${STAGE[@]}"
CHANGED="$(git diff --cached --name-only)"
for expected in "${STAGE[@]}"; do
  grep -qx "$expected" <<<"$CHANGED" || die "Expected staged file missing: $expected"
done
COUNT="$(printf '%s\n' "$CHANGED" | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "$COUNT" == "${#STAGE[@]}" ]] || die "Unexpected staged files detected:\n$CHANGED"

git commit -m "$COMMIT_MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin "HEAD:$BRANCH"

trap - ERR INT TERM
log "SUCCESS"
log "Pushed $NEW_SHA to origin/$BRANCH"
log "Behavior:"
log "  - adds ONLY two adjustable settings: Maximum linked wallets % (default 35) and Maximum creator-linked wallets % (default 25)"
log "  - scans top holders + early buyers using one-hop Solana funding evidence only"
log "  - external common funder requires 3 coordinated wallets; creator funding needs 2"
log "  - score penalty is 0/5/10/15/20 and never double-counts the same cluster"
log "  - above configured maximum => BLOCKED; scan pending => WAITING"
log "  - background/rate-limited worker; Pump TradeEvent hot path is untouched"
