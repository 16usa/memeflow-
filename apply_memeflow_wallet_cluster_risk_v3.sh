#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_ID="MEMEFLOW_WALLET_CLUSTER_RISK_V3"
EXPECTED_HEAD="3a6335b24934e7cb6091722aa699f951fea22566"
COMMIT_MSG="[MEMEFLOW_WALLET_CLUSTER_RISK_V3] Add linked-wallet cluster risk"
NEW_MODULE="src/wallet-cluster-risk.mjs"
NEW_TEST="tests/wallet-cluster-risk-v3.mjs"

log(){ printf '[WALLET-RISK-V3] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$TOP" ]] || die "Run this from inside the MEMEFLOW Git repository."
cd "$TOP"

REMOTE="$(git remote get-url origin 2>/dev/null || true)"
[[ "$REMOTE" == *"16usa/memeflow-"* ]] || die "Unexpected origin: $REMOTE"

BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == "main" ]] || die "Expected branch main, found '$BRANCH'."

git fetch origin main
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"

[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || die "Local main is not exactly synced with origin/main ($LOCAL_SHA != $REMOTE_SHA)."
[[ "$REMOTE_SHA" == "$EXPECTED_HEAD" ]] || die "origin/main moved to $REMOTE_SHA. This V3 patch was audited for $EXPECTED_HEAD; re-audit required."

if [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  APP="$TOP/memeflow-app"
elif [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  APP="$TOP"
else
  die "Cannot find MEMEFLOW app root."
fi
cd "$APP"

for f in \
  app-server.mjs \
  src/settings.mjs \
  src/settings-gate.mjs \
  src/evaluate.mjs \
  src/enrich.mjs \
  system.js \
  settings-page.js
do
  [[ -f "$f" ]] || die "Missing $f"
done

# V2 stopped because these controls ALREADY exist in both current Settings UIs.
# V3 reuses them and does not add/duplicate any UI controls.
python3 - <<'PY'
from pathlib import Path
for name in ("system.js","settings-page.js"):
    s=Path(name).read_text(encoding="utf-8")
    for key in ("maxSuspectedRiskyWalletsPct","maxInsidersPct"):
        if key not in s:
            raise SystemExit(f"{name}: existing UI control {key} is missing")
print("Existing Settings controls: PASS (reused, not duplicated)")
PY

if grep -q "$PATCH_ID" app-server.mjs || grep -q "$PATCH_ID" src/evaluate.mjs; then
  log "Patch already appears installed. Nothing changed."
  exit 0
fi

# Current main has the UI rows, but the backend contract/gate does not have them.
grep -q "maxSuspectedRiskyWalletsPct" src/settings.mjs \
  && die "Backend setting already exists without V3 marker; re-audit required."
grep -q "maxInsidersPct" src/settings.mjs \
  && die "Backend insiders setting already exists without V3 marker; re-audit required."

TARGETS=(
  app-server.mjs
  src/settings.mjs
  src/settings-gate.mjs
  src/evaluate.mjs
  src/enrich.mjs
)

for f in "${TARGETS[@]}"; do
  git diff --quiet -- "$f" || die "$f has unstaged local changes. Commit/stash that file first."
  git diff --cached --quiet -- "$f" || die "$f has staged local changes. Commit/unstage that file first."
done

[[ ! -e "$NEW_MODULE" ]] || die "$NEW_MODULE already exists."
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists."

BACKUP=".wallet-cluster-risk-v3-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src" "$BACKUP/tests"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed. Restoring original runtime files..."
  for f in "${TARGETS[@]}"; do
    [[ -f "$BACKUP/$f" ]] && cp -p "$BACKUP/$f" "$f" || true
  done
  rm -f "$NEW_MODULE" "$NEW_TEST"
  git reset --quiet -- "${TARGETS[@]}" "$NEW_MODULE" "$NEW_TEST" 2>/dev/null || true
  log "ROLLBACK complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Writing one-hop linked-wallet scanner..."
cat > "$NEW_MODULE" <<'EOF_MODULE'
// MEMEFLOW_WALLET_CLUSTER_RISK_V3
// Bounded one-hop Solana funding analysis.
// It intentionally does NOT do deep graph crawling, Helius, external blacklists,
// or multi-hop identity guessing.

const LAMPORTS_PER_SOL=1_000_000_000;

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const clampPct=v=>Math.max(0,Math.min(100,Number(v)||0));

function ms(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='bigint'){
    const n=Number(v);
    if(!Number.isFinite(n))return null;
    return n<1e12?n*1000:n;
  }
  const n=Number(v);
  if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  const parsed=Date.parse(v);
  return Number.isFinite(parsed)?parsed:null;
}

function walletEntry(row){
  if(!row)return null;
  if(typeof row==='string')return {wallet:row,pct:null};
  if(Array.isArray(row))return {wallet:String(row[0]||''),pct:num(row[1])};
  const wallet=String(row.wallet||row.address||row.owner||'').trim();
  if(!wallet)return null;
  return {wallet,pct:num(row.pct??row.percentage??row.sharePct)};
}

function transferInstructions(tx){
  const out=[];
  const top=tx?.transaction?.message?.instructions||[];
  for(const ix of top)out.push(ix);
  for(const row of tx?.meta?.innerInstructions||[]){
    for(const ix of row?.instructions||[])out.push(ix);
  }
  return out;
}

function inboundSystemTransfer(tx,wallet,minLamports){
  let best=null;
  for(const ix of transferInstructions(tx)){
    const parsed=ix?.parsed;
    if(!parsed||String(parsed.type||'').toLowerCase()!=='transfer')continue;
    const info=parsed.info||{};
    const destination=String(info.destination||info.to||'');
    const source=String(info.source||info.from||'');
    const lamports=Number(info.lamports??info.amount??0);
    if(destination!==wallet||!source||source===wallet)continue;
    if(!Number.isFinite(lamports)||lamports<minLamports)continue;
    if(!best||lamports>best.lamports)best={source,lamports};
  }
  return best;
}

async function recentFunder(rpc,wallet,window,opts){
  let signatures;
  try{
    signatures=await rpc.callOnce('getSignaturesForAddress',[
      wallet,
      {limit:opts.signatureLimit,commitment:'confirmed'}
    ]);
  }catch{
    return null;
  }

  const rows=(Array.isArray(signatures)?signatures:[])
    .filter(row=>!row?.err)
    .filter(row=>{
      const at=ms(row?.blockTime);
      return at===null||(at>=window.from&&at<=window.to);
    })
    .slice(0,opts.txPerWallet);

  for(const row of rows){
    if(!row?.signature)continue;
    let tx=null;
    try{
      tx=await rpc.callOnce('getTransaction',[
        row.signature,
        {encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}
      ]);
    }catch{
      continue;
    }
    if(!tx)continue;

    const at=ms(tx?.blockTime)??ms(row?.blockTime);
    if(at!==null&&(at<window.from||at>window.to))continue;

    const transfer=inboundSystemTransfer(tx,wallet,opts.minFundingLamports);
    if(transfer){
      return {
        wallet,
        funder:transfer.source,
        lamports:transfer.lamports,
        at:at??window.to,
        signature:row.signature
      };
    }
  }
  return null;
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);
  let cursor=0;
  const workers=Array.from({length:Math.max(1,Math.min(limit,items.length))},async()=>{
    while(true){
      const i=cursor++;
      if(i>=items.length)return;
      out[i]=await fn(items[i],i);
    }
  });
  await Promise.all(workers);
  return out;
}

class DSU{
  constructor(items){this.p=new Map(items.map(x=>[x,x]));}
  find(x){
    let p=this.p.get(x);
    if(p===undefined){this.p.set(x,x);return x;}
    while(p!==this.p.get(p))p=this.p.get(p);
    let cur=x;
    while(this.p.get(cur)!==p){
      const next=this.p.get(cur);
      this.p.set(cur,p);
      cur=next;
    }
    return p;
  }
  union(a,b){
    const ra=this.find(a),rb=this.find(b);
    if(ra!==rb)this.p.set(rb,ra);
  }
}

function coordinated(rows,opts){
  if(rows.length<2)return false;
  const ats=rows.map(x=>Number(x.at)).filter(Number.isFinite);
  const amounts=rows.map(x=>Number(x.lamports)).filter(x=>Number.isFinite(x)&&x>0);
  if(ats.length!==rows.length||amounts.length!==rows.length)return false;
  const span=Math.max(...ats)-Math.min(...ats);
  if(span>opts.commonFunderWindowMs)return false;
  const lo=Math.min(...amounts),hi=Math.max(...amounts);
  if(!(lo>0)||hi/lo>opts.commonFunderAmountRatio)return false;
  return true;
}

export function walletRiskPenalty(token={}){
  const band=(value,cuts)=>{
    if(!finite(value))return 0;
    const n=Number(value);
    if(n<=cuts[0])return 0;
    if(n<=cuts[1])return 5;
    if(n<=cuts[2])return 10;
    if(n<=cuts[3])return 15;
    return 20;
  };
  return Math.max(
    band(token?.suspectedRiskyWalletsPct,[10,15,20,25]),
    band(token?.insidersPct,[5,10,15,20])
  );
}

export async function scanWalletClusterRisk({rpc,token={},options={}}={}){
  if(!rpc?.callOnce)return {ok:false,reason:'rpc-unavailable'};

  const opts={
    maxWallets:Math.max(3,Math.min(10,Number(options.maxWallets??process.env.WALLET_CLUSTER_MAX_WALLETS??7))),
    signatureLimit:Math.max(2,Math.min(8,Number(options.signatureLimit??process.env.WALLET_CLUSTER_SIGNATURE_LIMIT??5))),
    txPerWallet:Math.max(1,Math.min(4,Number(options.txPerWallet??process.env.WALLET_CLUSTER_TX_PER_WALLET??3))),
    concurrency:Math.max(1,Math.min(4,Number(options.concurrency??process.env.WALLET_CLUSTER_RPC_CONCURRENCY??3))),
    lookbackMs:Math.max(5*60_000,Number(options.lookbackMs??process.env.WALLET_CLUSTER_FUNDING_LOOKBACK_MS??30*60_000)),
    afterLaunchMs:Math.max(30_000,Number(options.afterLaunchMs??process.env.WALLET_CLUSTER_AFTER_LAUNCH_MS??5*60_000)),
    commonFunderWindowMs:Math.max(30_000,Number(options.commonFunderWindowMs??process.env.WALLET_CLUSTER_COMMON_FUNDER_WINDOW_MS??180_000)),
    commonFunderAmountRatio:Math.max(1.25,Number(options.commonFunderAmountRatio??process.env.WALLET_CLUSTER_AMOUNT_RATIO??2.5)),
    commonFunderMinWallets:Math.max(3,Number(options.commonFunderMinWallets??process.env.WALLET_CLUSTER_COMMON_FUNDER_MIN_WALLETS??3)),
    minFundingLamports:Math.max(1_000_000,Number(options.minFundingLamports??process.env.WALLET_CLUSTER_MIN_FUNDING_LAMPORTS??0.02*LAMPORTS_PER_SOL))
  };

  const rawRows=Array.isArray(token.holderRiskWallets)?token.holderRiskWallets:[];
  const rows=rawRows.map(walletEntry).filter(Boolean);
  const creator=String(token.creator||token.creatorWallet||token.developerWallet||token.devWallet||'').trim()||null;

  const ordered=[];
  const pctByWallet=new Map();
  const add=(wallet,pct=null)=>{
    wallet=String(wallet||'').trim();
    if(!wallet)return;
    if(!ordered.includes(wallet))ordered.push(wallet);
    if(finite(pct))pctByWallet.set(wallet,clampPct(pct));
  };

  for(const row of rows)add(row.wallet,row.pct);
  if(creator)add(creator,finite(token.developerPct)?Number(token.developerPct):null);

  let candidates=ordered.slice(0,opts.maxWallets);
  if(creator&&!candidates.includes(creator)){
    candidates=candidates.slice(0,Math.max(0,opts.maxWallets-1));
    candidates.push(creator);
  }

  if(candidates.length<3){
    return {
      ok:true,
      version:'V3_ONE_HOP_COMMON_FUNDER',
      suspectedRiskyWalletsPct:0,
      insidersPct:0,
      sampledWallets:candidates.length,
      fundingRecords:0,
      linkedWallets:0,
      insiderWallets:0,
      commonFunders:0,
      evidence:[],
      scannedAt:Date.now()
    };
  }

  const createdAt=ms(token.pumpCreatedAt??token.discoveredAt??token.createdAt??token.firstSeenAt)??Date.now();
  const window={from:createdAt-opts.lookbackMs,to:createdAt+opts.afterLaunchMs};

  const found=await mapLimit(candidates,opts.concurrency,wallet=>
    recentFunder(rpc,wallet,window,opts)
  );
  const records=found.filter(Boolean);

  const dsu=new DSU(candidates);
  const candidateSet=new Set(candidates);
  const evidence=[];

  // Strong signal 1: one sampled wallet directly funds another sampled wallet.
  for(const rec of records){
    if(candidateSet.has(rec.funder)){
      dsu.union(rec.wallet,rec.funder);
      evidence.push({
        type:'direct-funding',
        funder:rec.funder,
        wallets:[rec.wallet],
        at:rec.at,
        lamports:rec.lamports
      });
    }
  }

  // Strong signal 2: one external source funds several sampled wallets in a
  // tight time window with broadly similar funding sizes.
  const byFunder=new Map();
  for(const rec of records){
    const list=byFunder.get(rec.funder)||[];
    list.push(rec);
    byFunder.set(rec.funder,list);
  }

  let commonFunders=0;
  for(const [funder,list] of byFunder){
    const unique=[...new Map(list.map(row=>[row.wallet,row])).values()];
    const minimum=(creator&&funder===creator)?2:opts.commonFunderMinWallets;
    if(unique.length<minimum||!coordinated(unique,opts))continue;

    commonFunders++;
    const first=unique[0].wallet;
    for(const row of unique.slice(1))dsu.union(first,row.wallet);
    if(candidateSet.has(funder))dsu.union(first,funder);

    evidence.push({
      type:funder===creator?'creator-funder':'common-funder',
      funder,
      wallets:unique.map(x=>x.wallet),
      spanMs:Math.max(...unique.map(x=>Number(x.at)))-Math.min(...unique.map(x=>Number(x.at))),
      minLamports:Math.min(...unique.map(x=>Number(x.lamports))),
      maxLamports:Math.max(...unique.map(x=>Number(x.lamports)))
    });
  }

  const groups=new Map();
  for(const wallet of candidates){
    const root=dsu.find(wallet);
    const list=groups.get(root)||[];
    list.push(wallet);
    groups.set(root,list);
  }

  const linkedGroups=[...groups.values()].filter(group=>group.length>=2);
  const linkedMembers=new Set(linkedGroups.flat());
  const insiderMembers=new Set();

  if(creator){
    for(const group of linkedGroups){
      if(group.includes(creator)){
        for(const wallet of group)insiderMembers.add(wallet);
      }
    }
  }

  const exposure=members=>{
    let total=0;
    for(const wallet of members)total+=pctByWallet.get(wallet)||0;
    return Math.round(clampPct(total)*1000)/1000;
  };

  return {
    ok:true,
    version:'V3_ONE_HOP_COMMON_FUNDER',
    suspectedRiskyWalletsPct:exposure(linkedMembers),
    insidersPct:exposure(insiderMembers),
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

log "Wiring the existing Settings controls into backend normalization..."
python3 - <<'PY'
from pathlib import Path

p=Path("src/settings.mjs")
s=p.read_text(encoding="utf-8")
MARK="MEMEFLOW_WALLET_CLUSTER_RISK_V3"

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {n}")
    return text.replace(old,new,1)

s=once(
    s,
    "'minSniperPct','maxSniperPct'\n];",
    "'minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct'\n];",
    "nullable wallet-risk settings"
)

s=once(
    s,
    "minSniperPct:null,maxSniperPct:null,\n developerBlacklistWallets",
    "minSniperPct:null,maxSniperPct:null,maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25,\n developerBlacklistWallets",
    "wallet-risk defaults"
)

s=once(
    s,
    "'minSniperPct','maxSniperPct'])",
    "'minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct'])",
    "wallet-risk percent validation"
)

s=s.rstrip()+f"\n// {MARK}: existing UI controls are now canonical backend settings.\n"
p.write_text(s,encoding="utf-8")
PY

log "Adding hard WAIT/BLOCK gates for the two existing percentage settings..."
python3 - <<'PY'
from pathlib import Path

p=Path("src/settings-gate.mjs")
s=p.read_text(encoding="utf-8")
MARK="MEMEFLOW_WALLET_CLUSTER_RISK_V3"

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {n}")
    return text.replace(old,new,1)

s=once(
    s,
    "  sniperPct:['sniperPct','snipersPct','sniperSharePct','snipers.percent'],",
    "  sniperPct:['sniperPct','snipersPct','sniperSharePct','snipers.percent'],\n"
    "  suspectedRiskyWalletsPct:['suspectedRiskyWalletsPct','walletClusterRiskPct','linkedWalletsPct'],\n"
    "  insidersPct:['insidersPct','creatorLinkedWalletsPct','insiderWalletsPct'],",
    "wallet-risk metrics"
)

anchor="  range('Sniper share','sniperPct','minSniperPct','maxSniperPct');"
insert=r"""  range('Sniper share','sniperPct','minSniperPct','maxSniperPct');

  // MEMEFLOW_WALLET_CLUSTER_RISK_V3
  // These are existing user-configurable maxima. Missing evidence is WAITING,
  // known excess is BLOCKED, and a known value below the limit passes.
  const maxRiskyWallets=settingNumber(settings,'maxSuspectedRiskyWalletsPct');
  if(maxRiskyWallets!==null){
    const value=metric(token,'suspectedRiskyWalletsPct');
    add(
      'Suspected risky wallets maximum',
      value===null?null:value<=maxRiskyWallets,
      `suspected risky wallets above ${maxRiskyWallets}%`,
      {key:'maxSuspectedRiskyWalletsPct',value,threshold:maxRiskyWallets,operator:'<=',retryable:true,source:'suspectedRiskyWalletsPct'}
    );
  }

  const maxInsiders=settingNumber(settings,'maxInsidersPct');
  if(maxInsiders!==null){
    const value=metric(token,'insidersPct');
    add(
      'Insiders maximum',
      value===null?null:value<=maxInsiders,
      `creator-linked wallets above ${maxInsiders}%`,
      {key:'maxInsidersPct',value,threshold:maxInsiders,operator:'<=',retryable:true,source:'insidersPct'}
    );
  }"""
s=once(s,anchor,insert,"wallet-risk gates")

p.write_text(s,encoding="utf-8")
PY

log "Persisting a small canonical top-holder sample from the existing Solana holder scan..."
python3 - <<'PY'
from pathlib import Path

p=Path("src/enrich.mjs")
s=p.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {n}")
    return text.replace(old,new,1)

s=once(
    s,
    """  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
  const balances=[...walletBalances.values()].sort((a,b)=>b-a);
  const holderCount=balances.length;""",
    """  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
  const holderEntries=[...walletBalances.entries()].sort((a,b)=>b[1]-a[1]);
  const balances=holderEntries.map(([,amount])=>amount);
  const holderCount=balances.length;
  // MEMEFLOW_WALLET_CLUSTER_RISK_V3
  // Keep only the top eight canonical wallet owners + their current supply share.
  // This is bounded public-chain evidence used by the background risk scanner.
  const holderRiskWallets=holderEntries.slice(0,8).map(([wallet,amount])=>({
    wallet,
    pct:total>0?amount/total*100:null
  }));""",
    "canonical holder risk sample"
)

s=once(
    s,
    """    holderFresh:true,
    holderCount,
    top10Pct,""",
    """    holderFresh:true,
    holderCount,
    holderRiskWallets,
    holderRiskWalletsScannedAt:Date.now(),
    top10Pct,""",
    "store canonical holder risk sample"
)

p.write_text(s,encoding="utf-8")
PY

log "Making AI score wallet-risk aware without double-counting..."
python3 - <<'PY'
from pathlib import Path

p=Path("src/evaluate.mjs")
s=p.read_text(encoding="utf-8")
MARK="MEMEFLOW_WALLET_CLUSTER_RISK_V3"

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {n}")
    return text.replace(old,new,1)

s=once(
    s,
    "import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';",
    "import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';\n"
    "import {walletRiskPenalty} from './wallet-cluster-risk.mjs'; // "+MARK,
    "wallet-risk import"
)

s=once(
    s,
    "  return {score: clampScore(score), quality};",
    """  const scoreBeforeWalletRisk=clampScore(score);
  const riskPenalty=walletRiskPenalty(token);
  const adjustedScore=clampScore(scoreBeforeWalletRisk-riskPenalty);
  quality.push({
    key:'walletRiskPenalty',
    value:{
      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null
    },
    points:-riskPenalty,
    maxPoints:0
  });

  return {
    score:adjustedScore,
    quality,
    scoreBeforeWalletRisk,
    walletRiskPenalty:riskPenalty
  };""",
    "AI wallet-risk penalty"
)

s=once(
    s,
    """    state,
    score,
    confidence,
    reasons,""",
    """    state,
    score,
    scoreBeforeWalletRisk:ai.scoreBeforeWalletRisk,
    walletRiskPenalty:ai.walletRiskPenalty,
    walletRisk:{
      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null,
      scannedAt:token.walletClusterRiskScannedAt??null,
      version:token.walletClusterRiskVersion??null
    },
    confidence,
    reasons,""",
    "decision wallet-risk diagnostics"
)

p.write_text(s,encoding="utf-8")
PY

log "Adding a bounded background worker; Pump TradeEvent hot path remains untouched..."
cat >> app-server.mjs <<'EOF_SERVER'

// MEMEFLOW_WALLET_CLUSTER_RISK_V3
// Background only. Canonical holder enrichment supplies a bounded top-wallet sample;
// this worker checks one-hop SOL funding and then re-evaluates the token.
let __mfWalletRiskBusy=false;
let __mfWalletRiskModulePromise=null;
const __mfWalletRiskModule=()=>__mfWalletRiskModulePromise||=import('./src/wallet-cluster-risk.mjs');

function __mfWalletRiskPumpToken(token){
  const p=String(token?.launchPlatform||token?.protocol||token?.source||'').toLowerCase();
  return p.includes('pump');
}

function __mfWalletRiskCandidate(){
  const now=Date.now();
  const maxAge=Math.max(5*60_000,Number(process.env.WALLET_CLUSTER_MAX_TOKEN_AGE_MS||20*60_000));
  const ttl=Math.max(30_000,Number(process.env.WALLET_CLUSTER_SCAN_TTL_MS||120_000));
  const retryDelay=Math.max(10_000,Number(process.env.WALLET_CLUSTER_RETRY_DELAY_MS||25_000));
  const rows=typeof store?.tokens==='function'?store.tokens():Object.values(store?.state?.tokens||{});

  return rows
    .filter(token=>{
      if(!token?.mint||!__mfWalletRiskPumpToken(token))return false;
      if(!Array.isArray(token.holderRiskWallets)||token.holderRiskWallets.length<3)return false;

      const created=Number(token.pumpCreatedAt||token.discoveredAt||token.createdAt||0);
      if(created>0&&now-(created<1e12?created*1000:created)>maxAge)return false;

      // Do not spend RPC on obviously dead/incomplete candidates.
      if(!(Number(token.priceSol)>0))return false;
      if(Number(token.holderCount||0)<10)return false;

      const holdersAt=Number(token.holderRiskWalletsScannedAt||0);
      const scannedAt=Number(token.walletClusterRiskScannedAt||0);
      const attemptedAt=Number(token.walletClusterRiskLastAttemptAt||0);

      // Rescan when the canonical holder sample is newer; otherwise honor TTL.
      if(scannedAt>0&&holdersAt<=scannedAt&&now-scannedAt<ttl)return false;
      if(attemptedAt>scannedAt&&now-attemptedAt<retryDelay)return false;

      return true;
    })
    .sort((a,b)=>{
      const aNever=a?.walletClusterRiskScannedAt?1:0;
      const bNever=b?.walletClusterRiskScannedAt?1:0;
      if(aNever!==bNever)return aNever-bNever;
      return Number(b?.holderRiskWalletsScannedAt||b?.updatedAt||b?.discoveredAt||0)
        -Number(a?.holderRiskWalletsScannedAt||a?.updatedAt||a?.discoveredAt||0);
    })[0]||null;
}

async function __mfWalletRiskTick(){
  if(__mfWalletRiskBusy)return;
  const token=__mfWalletRiskCandidate();
  if(!token)return;

  __mfWalletRiskBusy=true;
  const mint=String(token.mint);
  const now=Date.now();

  try{
    const {scanWalletClusterRisk}=await __mfWalletRiskModule();
    const result=await scanWalletClusterRisk({rpc,token});

    let patch;
    if(result?.ok){
      patch={
        suspectedRiskyWalletsPct:Number(result.suspectedRiskyWalletsPct)||0,
        insidersPct:Number(result.insidersPct)||0,
        walletClusterRiskScannedAt:Number(result.scannedAt)||Date.now(),
        walletClusterRiskLastAttemptAt:Date.now(),
        walletClusterRiskVersion:String(result.version||'V3'),
        walletClusterRiskSampledWallets:Number(result.sampledWallets)||0,
        walletClusterRiskFundingRecords:Number(result.fundingRecords)||0,
        walletClusterRiskLinkedWallets:Number(result.linkedWallets)||0,
        walletClusterRiskInsiderWallets:Number(result.insiderWallets)||0,
        walletClusterRiskCommonFunders:Number(result.commonFunders)||0,
        walletClusterRiskEvidence:Array.isArray(result.evidence)?result.evidence.slice(0,8):[],
        walletClusterRiskLastError:null
      };
    }else{
      patch={
        walletClusterRiskLastAttemptAt:Date.now(),
        walletClusterRiskLastError:String(result?.reason||'scan-failed').slice(0,180)
      };
    }

    const updated=store?.setToken?.(mint,patch)||store?.state?.tokens?.[mint];

    if(updated&&result?.ok){
      try{await Promise.resolve(evaluateAll(updated))}catch{}
      try{publish(mint)}catch{}
    }
  }catch(error){
    try{
      store?.setToken?.(mint,{
        walletClusterRiskLastAttemptAt:Date.now(),
        walletClusterRiskLastError:String(error?.message||error).slice(0,180)
      });
    }catch{}
  }finally{
    __mfWalletRiskBusy=false;
  }
}

const __mfWalletRiskInterval=setInterval(
  ()=>void __mfWalletRiskTick(),
  Math.max(1_000,Number(process.env.WALLET_CLUSTER_SCAN_INTERVAL_MS||1_500))
);
__mfWalletRiskInterval.unref?.();
setTimeout(()=>void __mfWalletRiskTick(),1_000).unref?.();
EOF_SERVER

log "Writing focused regression tests..."
cat > "$NEW_TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import {scanWalletClusterRisk,walletRiskPenalty} from '../src/wallet-cluster-risk.mjs';
import {defaultSettings,normalizeSettings,validateSettings} from '../src/settings.mjs';
import {evaluateSettingsGate} from '../src/settings-gate.mjs';
import {evaluate} from '../src/evaluate.mjs';

const NOW=Date.now();

function transferTx(source,destination,lamports,at){
  return {
    blockTime:Math.floor(at/1000),
    transaction:{
      message:{
        instructions:[
          {program:'system',parsed:{type:'transfer',info:{source,destination,lamports}}}
        ]
      }
    },
    meta:{innerInstructions:[]}
  };
}

function fakeRpc(plan){
  return {
    async callOnce(method,args){
      if(method==='getSignaturesForAddress'){
        const wallet=args[0];
        const row=plan[wallet];
        return row?[{signature:`sig-${wallet}`,blockTime:Math.floor(row.at/1000),err:null}]:[];
      }
      if(method==='getTransaction'){
        const wallet=String(args[0]).replace(/^sig-/,'');
        const row=plan[wallet];
        return row?transferTx(row.funder,wallet,row.lamports,row.at):null;
      }
      throw new Error(`unexpected RPC method ${method}`);
    }
  };
}

const baseToken={
  mint:'RiskMint111111111111111111111111111pump',
  launchPlatform:'pump',
  discoveredAt:NOW-60_000,
  pumpCreatedAt:NOW-60_000,
  creator:'CREATOR',
  developerPct:2,
  holderRiskWallets:[
    {wallet:'A',pct:18},
    {wallet:'B',pct:14},
    {wallet:'C',pct:12},
    {wallet:'D',pct:8},
    {wallet:'E',pct:5}
  ]
};

{
  const at=NOW-70_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'FUNDER-X',lamports:1_000_000_000,at},
      B:{funder:'FUNDER-X',lamports:1_100_000_000,at:at+8_000},
      C:{funder:'FUNDER-X',lamports:950_000_000,at:at+15_000},
      D:{funder:'OTHER',lamports:800_000_000,at:at+3_000}
    }),
    token:baseToken,
    options:{maxWallets:7,signatureLimit:3,txPerWallet:2,concurrency:2}
  });

  assert.equal(result.ok,true);
  assert.equal(result.commonFunders,1);
  assert.equal(result.linkedWallets,3);
  assert.equal(result.suspectedRiskyWalletsPct,44);
  assert.equal(result.insidersPct,0);
}

{
  const at=NOW-70_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'CREATOR',lamports:1_000_000_000,at},
      B:{funder:'CREATOR',lamports:1_050_000_000,at:at+8_000}
    }),
    token:baseToken,
    options:{maxWallets:7,signatureLimit:3,txPerWallet:2,concurrency:2}
  });

  assert.equal(result.ok,true);
  assert.equal(result.linkedWallets,3); // creator + A + B
  assert.equal(result.suspectedRiskyWalletsPct,34); // 18 + 14 + 2
  assert.equal(result.insidersPct,34);
}

{
  const d=defaultSettings();
  assert.equal(d.maxSuspectedRiskyWalletsPct,35);
  assert.equal(d.maxInsidersPct,25);

  const n=normalizeSettings({...d,maxSuspectedRiskyWalletsPct:22,maxInsidersPct:11});
  assert.equal(n.maxSuspectedRiskyWalletsPct,22);
  assert.equal(n.maxInsidersPct,11);

  assert.equal(validateSettings({...d,maxSuspectedRiskyWalletsPct:101}).ok,false);
}

{
  const settings={
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  };

  let gate=evaluateSettingsGate({},settings);
  assert.equal(gate.state,'WAITING');

  gate=evaluateSettingsGate({suspectedRiskyWalletsPct:40,insidersPct:5},settings);
  assert.equal(gate.state,'BLOCKED');

  gate=evaluateSettingsGate({suspectedRiskyWalletsPct:12,insidersPct:5},settings);
  assert.equal(gate.state,'PASS');
}

{
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:8,insidersPct:3}),0);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:17,insidersPct:3}),10);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:22,insidersPct:12}),15);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:40,insidersPct:40}),20);

  const token={
    holderCount:100,
    top10Pct:10,
    developerPct:2,
    buyPressure:3,
    priceSol:1,
    holderFresh:true,
    suspectedRiskyWalletsPct:22,
    insidersPct:0
  };

  const ready=evaluate(token,{
    minScore:0,
    minConfidence:0,
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  });
  assert.equal(ready.scoreBeforeWalletRisk,100);
  assert.equal(ready.walletRiskPenalty,15);
  assert.equal(ready.score,85);
  assert.equal(ready.state,'BUY READY');

  const watch=evaluate(token,{
    minScore:90,
    minConfidence:0,
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  });
  assert.equal(watch.state,'WATCH');
}

console.log('wallet cluster risk v3: PASS');
EOF_TEST

log "Syntax checks..."
node --check "$NEW_MODULE"
node --check src/settings.mjs
node --check src/settings-gate.mjs
node --check src/evaluate.mjs
node --check src/enrich.mjs
node --check app-server.mjs
node --check "$NEW_TEST"

git --no-pager diff --check -- "${TARGETS[@]}" "$NEW_MODULE" "$NEW_TEST"

log "Focused wallet-cluster tests..."
node "$NEW_TEST"

log "Existing MEMEFLOW test suite..."
npm test

log "Static safety checks..."
grep -q "$PATCH_ID" src/settings.mjs
grep -q "$PATCH_ID" src/settings-gate.mjs
grep -q "$PATCH_ID" src/evaluate.mjs
grep -q "$PATCH_ID" app-server.mjs
grep -q "$PATCH_ID" "$NEW_MODULE"
grep -q "holderRiskWallets" src/enrich.mjs

# Prove V3 did not duplicate or rewrite the existing Settings UI controls.
git diff --quiet -- system.js
git diff --quiet -- settings-page.js

git fetch origin main
LATEST_REMOTE="$(git rev-parse origin/main)"
[[ "$LATEST_REMOTE" == "$REMOTE_SHA" ]] || die "origin/main moved during tests ($REMOTE_SHA -> $LATEST_REMOTE). Nothing will be committed/pushed."

git add -- \
  app-server.mjs \
  src/settings.mjs \
  src/settings-gate.mjs \
  src/evaluate.mjs \
  src/enrich.mjs \
  "$NEW_MODULE" \
  "$NEW_TEST"

EXPECTED_FILES="$(
  printf '%s\n' \
    app-server.mjs \
    src/settings.mjs \
    src/settings-gate.mjs \
    src/evaluate.mjs \
    src/enrich.mjs \
    "$NEW_MODULE" \
    "$NEW_TEST" | sort
)"
ACTUAL_FILES="$(git diff --cached --name-only | sort)"

[[ "$ACTUAL_FILES" == "$EXPECTED_FILES" ]] || {
  printf '[WALLET-RISK-V3] STOP: staged file set differs.\nExpected:\n%s\nActual:\n%s\n' "$EXPECTED_FILES" "$ACTUAL_FILES" >&2
  exit 1
}

git diff --cached --check
git commit -m "$COMMIT_MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin HEAD:main

trap - ERR INT TERM
log "SUCCESS"
log "Pushed $NEW_SHA to origin/main"
log "Behavior:"
log "  - reuses the two wallet-risk percentage controls already present in System Settings"
log "  - backend defaults: risky wallets 35%, creator-linked insiders 25%"
log "  - canonical getProgramAccounts holder scan supplies only the top 8 wallet owners"
log "  - one-hop direct/common-funder analysis only; no deep graph and no Helius"
log "  - external common funder needs 3 wallets; creator funding needs 2"
log "  - score penalty is bounded to 0/5/10/15/20 and uses the larger risk only"
log "  - enabled risk evidence missing => WAITING; above configured maximum => BLOCKED"
log "  - Pump TradeEvent hot path is untouched"
