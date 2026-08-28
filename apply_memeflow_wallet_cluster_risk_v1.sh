#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_ID="MEMEFLOW_WALLET_CLUSTER_RISK_V1"
COMMIT_MSG="Add one-hop wallet cluster risk scoring"
NEW_MODULE="src/wallet-cluster-risk.mjs"
NEW_TEST="tests/wallet-cluster-risk-v1.mjs"

log(){ printf '[WALLET-RISK] %s\n' "$*"; }
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

[[ -f src/settings.mjs ]] || die "Missing src/settings.mjs"
[[ -f src/event-holder-ledger.mjs ]] || die "Missing src/event-holder-ledger.mjs"

# This patch intentionally reuses the EXISTING V1.5 settings. Do not add another
# Linked Wallets control. The runtime must already know these two keys.
grep -q "maxSuspectedRiskyWalletsPct" src/settings.mjs || die "Existing maxSuspectedRiskyWalletsPct setting is missing; current runtime needs re-audit."
grep -q "maxInsidersPct" src/settings.mjs || die "Existing maxInsidersPct setting is missing; current runtime needs re-audit."
grep -q "maxSuspectedRiskyWalletsPct" src/evaluate.mjs || die "Risk-wallet gate is missing from evaluator; current runtime needs re-audit."
grep -q "maxInsidersPct" src/evaluate.mjs || die "Insiders gate is missing from evaluator; current runtime needs re-audit."
grep -q "eventHolderLedger" app-server.mjs || die "eventHolderLedger is missing from app-server.mjs"
grep -q "evaluateAll" app-server.mjs || die "evaluateAll is missing from app-server.mjs"
grep -q "rpc\.callOnce" app-server.mjs || die "Expected queue-controlled Solana rpc.callOnce runtime is missing"
grep -q "byMint" src/event-holder-ledger.mjs || die "EventHolderLedger.byMint is missing"

if grep -q "$PATCH_ID" src/evaluate.mjs || grep -q "$PATCH_ID" app-server.mjs || [[ -e "$NEW_MODULE" ]]; then
  log "Patch already appears installed. Nothing changed."
  exit 0
fi

TARGETS=(app-server.mjs src/evaluate.mjs)
for f in "${TARGETS[@]}"; do
  git diff --quiet -- "$f" || die "$f has unstaged local changes. Commit/push them first; nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged local changes. Commit/push them first; nothing changed."
done
[[ ! -e "$NEW_MODULE" ]] || die "$NEW_MODULE already exists"
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists"

BACKUP=".wallet-cluster-risk-v1-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
cp app-server.mjs "$BACKUP/app-server.mjs"
cp src/evaluate.mjs "$BACKUP/src/evaluate.mjs"

rollback(){
  code=$?
  log "Validation failed. Restoring the two original runtime files..."
  cp "$BACKUP/app-server.mjs" app-server.mjs || true
  cp "$BACKUP/src/evaluate.mjs" src/evaluate.mjs || true
  rm -f "$NEW_MODULE" "$NEW_TEST"
  git reset --quiet -- app-server.mjs src/evaluate.mjs "$NEW_MODULE" "$NEW_TEST" 2>/dev/null || true
  log "ROLLBACK complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Writing bounded one-hop wallet-cluster scanner..."
cat > "$NEW_MODULE" <<'EOF_MODULE'
// MEMEFLOW_WALLET_CLUSTER_RISK_V1
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
    topHolders:Math.max(3,Math.min(12,Number(options.topHolders??process.env.WALLET_CLUSTER_TOP_HOLDERS??10))),
    earlyBuyers:Math.max(3,Math.min(12,Number(options.earlyBuyers??process.env.WALLET_CLUSTER_EARLY_BUYERS??10))),
    maxWallets:Math.max(6,Math.min(16,Number(options.maxWallets??process.env.WALLET_CLUSTER_MAX_WALLETS??12))),
    signatureLimit:Math.max(3,Math.min(10,Number(options.signatureLimit??process.env.WALLET_CLUSTER_SIGNATURE_LIMIT??6))),
    txPerWallet:Math.max(1,Math.min(4,Number(options.txPerWallet??process.env.WALLET_CLUSTER_TX_PER_WALLET??3))),
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
  if(candidates.length<2)return {ok:true,version:'V1',suspectedRiskyWalletsPct:0,insidersPct:0,sampledWallets:candidates.length,linkedWallets:0,commonFunders:0,evidence:[]};

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
    if(unique.length<2||!coordinated(unique,opts))continue;
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
      ok:false,reason:'supply-unavailable',version:'V1',sampledWallets:candidates.length,
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
    version:'V1_ONE_HOP_COMMON_FUNDER',
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

log "Wrapping AI score with a bounded wallet-risk penalty..."
python3 - <<'PY'
from pathlib import Path
import re

p=Path('src/evaluate.mjs')
s=p.read_text(encoding='utf-8')
MARK='MEMEFLOW_WALLET_CLUSTER_RISK_V1'
if MARK in s:
    raise SystemExit('evaluate already patched')

pat=re.compile(r'\bexport\s+function\s+evaluate\s*\(')
ms=list(pat.finditer(s))
if len(ms)!=1:
    raise SystemExit(f'evaluate export: expected exactly 1 exported function, found {len(ms)}')
s=pat.sub('function __mfWalletClusterBaseEvaluate(',s,count=1)

wrapper=r'''

// MEMEFLOW_WALLET_CLUSTER_RISK_V1
// Score remains opportunity/quality-oriented, but coordinated wallet ownership
// can remove at most 20 points. The same cluster is never penalized twice.
function __mfWalletRiskFinite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function __mfWalletRiskBand(v,cuts){
  if(!__mfWalletRiskFinite(v))return 0;
  const n=Number(v);
  if(n<=cuts[0])return 0;
  if(n<=cuts[1])return 5;
  if(n<=cuts[2])return 10;
  if(n<=cuts[3])return 15;
  return 20;
}
function __mfWalletRiskPenalty(token={}){
  return Math.max(
    __mfWalletRiskBand(token?.suspectedRiskyWalletsPct,[10,15,20,25]),
    __mfWalletRiskBand(token?.insidersPct,[5,10,15,20])
  );
}
export function evaluate(token={},settings={}){
  const base=__mfWalletClusterBaseEvaluate(token,settings);
  const before=Math.max(0,Math.min(100,Number(base?.score)||0));
  const penalty=__mfWalletRiskPenalty(token);
  const score=Math.max(0,Math.min(100,before-penalty));
  let state=String(base?.state||'WATCH').toUpperCase();
  const reasons=Array.isArray(base?.reasons)?[...base.reasons]:[];
  const minScore=__mfWalletRiskFinite(settings?.minScore)?Number(settings.minScore):null;

  // Base evaluator already owns hard risk gates. This wrapper only prevents a
  // post-penalty token from staying BUY READY when it no longer clears minScore.
  if(state==='BUY READY'&&minScore!==null&&score<minScore){
    state='WATCH';
    reasons.unshift(`wallet-risk penalty ${penalty} lowered AI score ${before} -> ${score} below minimum ${minScore}`);
  }

  return {
    ...base,
    state,
    score,
    reasons,
    scoreBeforeWalletRisk:before,
    walletRiskPenalty:penalty,
    walletRisk:{
      suspectedRiskyWalletsPct:__mfWalletRiskFinite(token?.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:__mfWalletRiskFinite(token?.insidersPct)?Number(token.insidersPct):null,
      scannedAt:token?.walletClusterRiskScannedAt||null,
      version:token?.walletClusterRiskVersion||null
    }
  };
}
'''
p.write_text(s.rstrip()+wrapper+'\n',encoding='utf-8')
PY

log "Adding a low-rate background worker to app-server.mjs..."
cat >> app-server.mjs <<'EOF_SERVER'

// MEMEFLOW_WALLET_CLUSTER_RISK_V1
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
  const ttl=Math.max(30_000,Number(process.env.WALLET_CLUSTER_SCAN_TTL_MS||90_000));
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
        walletClusterRiskVersion:result.version||'V1',
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
  Math.max(4_000,Number(process.env.WALLET_CLUSTER_SCAN_INTERVAL_MS||7_000))
);
__mfWalletClusterInterval.unref?.();
setTimeout(()=>void __mfWalletClusterTick(),4_000).unref?.();
EOF_SERVER

log "Writing focused regression tests..."
cat > "$NEW_TEST" <<'EOF_TEST'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanWalletClusterRisk,walletRiskPenalty} from '../src/wallet-cluster-risk.mjs';
import {defaultSettings} from '../src/settings.mjs';
import {evaluate} from '../src/evaluate.mjs';

const NOW=Date.now();
function transferTx(source,destination,lamports,atMs){
  return {
    blockTime:Math.floor(atMs/1000),
    transaction:{message:{instructions:[{program:'system',parsed:{type:'transfer',info:{source,destination,lamports}}}]}},
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
      throw new Error(`unexpected ${method}`);
    }
  };
}

function holderRow(){
  return {
    creator:'CREATOR',
    decimals:0,
    totalSupplyUi:1000,
    createdAt:NOW-60_000,
    balances:new Map([
      ['A',180n],['B',140n],['C',120n],['CREATOR',20n],['D',10n]
    ]),
    firstBuyAt:new Map([
      ['A',NOW-40_000],['B',NOW-39_000],['C',NOW-38_000],['D',NOW-37_000]
    ])
  };
}

test('coordinated common funder becomes suspected risky-wallet exposure',async()=>{
  const at=NOW-50_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'FUNDER-X',lamports:1_000_000_000,at},
      B:{funder:'FUNDER-X',lamports:1_100_000_000,at:at+10_000},
      C:{funder:'OTHER',lamports:900_000_000,at:at+5_000}
    }),
    token:{mint:'MINT',creator:'CREATOR',pumpCreatedAt:NOW-60_000,totalSupply:1000},
    holderRow:holderRow(),
    options:{topHolders:5,earlyBuyers:5,maxWallets:8,signatureLimit:3,txPerWallet:1}
  });
  assert.equal(result.ok,true);
  assert.equal(result.suspectedRiskyWalletsPct,32);
  assert.equal(result.insidersPct,0);
  assert.equal(result.commonFunders,1);
});

test('creator-funded wallets become insiders',async()=>{
  const at=NOW-50_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'CREATOR',lamports:1_000_000_000,at},
      B:{funder:'CREATOR',lamports:1_050_000_000,at:at+8_000}
    }),
    token:{mint:'MINT',creator:'CREATOR',pumpCreatedAt:NOW-60_000,totalSupply:1000},
    holderRow:holderRow(),
    options:{topHolders:5,earlyBuyers:5,maxWallets:8,signatureLimit:3,txPerWallet:1}
  });
  assert.equal(result.ok,true);
  assert.equal(result.suspectedRiskyWalletsPct,34); // A + B + creator current holdings
  assert.equal(result.insidersPct,34);
});

test('wallet-risk penalty is bounded and does not double count',()=>{
  assert.equal(walletRiskPenalty(8,3),0);
  assert.equal(walletRiskPenalty(17,3),10);
  assert.equal(walletRiskPenalty(22,12),15);
  assert.equal(walletRiskPenalty(40,40),20);
});

test('existing risk settings remain authoritative hard gates',()=>{
  const settings={...defaultSettings(),minScore:0,minConfidence:0,maxSuspectedRiskyWalletsPct:20,maxInsidersPct:null};
  const token={
    mint:'RiskGate111111111111111111111111111pump',launchPlatform:'pump',protocol:'pump',source:'Pump create',
    discoveredAt:NOW-5*60_000,pumpCreatedAt:NOW-5*60_000,pumpCreatedAtPending:false,
    holderCount:120,holderFresh:true,holderSource:'Solana getProgramAccounts baseline + live Pump TradeEvent delta',holderScannedAt:NOW,
    top10Pct:10,developerPct:2,buyPressure:3,priceSol:1,peakPriceSol:1,dataQuality:1,
    liquidityUsd:1_000_000,marketCapUsd:1_000_000,bondingCurvePct:10,bondingCurveProgressPct:10,volume24hUsd:1_000_000,
    buys24h:100,sells24h:10,buyTransactions:100,sellTransactions:10,totalTransactions:110,totalFeesSol:100,bundlePct:0,sniperPct:0,
    twitter:'https://x.com/risk',website:'https://example.invalid',metadataResolved:true,metadataReady:true,imageUrl:'https://example.invalid/logo.png',
    suspectedRiskyWalletsPct:22,insidersPct:0,
    pumpMarketUpdatedAt:NOW,lastPriceAt:NOW
  };
  const d=evaluate(token,settings);
  assert.equal(d.state,'BLOCKED');
  assert.equal(d.walletRiskPenalty,15);
});

test('score penalty can demote BUY READY to WATCH without inventing a new hard gate',()=>{
  const settings={...defaultSettings(),minScore:90,minConfidence:0,maxSuspectedRiskyWalletsPct:null,maxInsidersPct:null};
  const token={
    mint:'ScoreRisk111111111111111111111111111pump',launchPlatform:'pump',protocol:'pump',source:'Pump create',
    discoveredAt:NOW-5*60_000,pumpCreatedAt:NOW-5*60_000,pumpCreatedAtPending:false,
    holderCount:120,holderFresh:true,holderSource:'Solana getProgramAccounts baseline + live Pump TradeEvent delta',holderScannedAt:NOW,
    top10Pct:10,developerPct:2,buyPressure:3,priceSol:1,peakPriceSol:1,dataQuality:1,
    liquidityUsd:1_000_000,marketCapUsd:1_000_000,bondingCurvePct:10,bondingCurveProgressPct:10,volume24hUsd:1_000_000,
    buys24h:100,sells24h:10,buyTransactions:100,sellTransactions:10,totalTransactions:110,totalFeesSol:100,bundlePct:0,sniperPct:0,
    twitter:'https://x.com/risk',website:'https://example.invalid',metadataResolved:true,metadataReady:true,imageUrl:'https://example.invalid/logo.png',
    suspectedRiskyWalletsPct:22,insidersPct:0,
    pumpMarketUpdatedAt:NOW,lastPriceAt:NOW
  };
  const d=evaluate(token,settings);
  assert.ok(d.scoreBeforeWalletRisk>=d.score);
  assert.equal(d.walletRiskPenalty,15);
  if(d.scoreBeforeWalletRisk>=90 && d.score<90)assert.equal(d.state,'WATCH');
});

test('runtime worker is background-only and uses existing holder ledger + Solana RPC',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  const i=app.lastIndexOf('// MEMEFLOW_WALLET_CLUSTER_RISK_V1');
  assert.ok(i>=0);
  const block=app.slice(i);
  assert.match(block,/eventHolderLedger\?\.byMint/);
  assert.match(block,/scanWalletClusterRisk/);
  assert.match(block,/evaluateAll\(updated\)/);
  assert.doesNotMatch(block,/helius/i);
});
EOF_TEST

log "Syntax checks..."
node --check "$NEW_MODULE"
node --check src/evaluate.mjs
node --check app-server.mjs
node --check "$NEW_TEST"

git --no-pager diff --check

log "Focused wallet-cluster tests..."
node --test "$NEW_TEST"

log "Existing MEMEFLOW test suite..."
npm test

log "Final static checks..."
grep -q "$PATCH_ID" src/evaluate.mjs
grep -q "$PATCH_ID" app-server.mjs
grep -q "$PATCH_ID" "$NEW_MODULE"
grep -q "suspectedRiskyWalletsPct" "$NEW_MODULE"
grep -q "insidersPct" "$NEW_MODULE"

# Re-check remote immediately before commit/push so we never overwrite a newer patch.
git fetch origin "$BRANCH"
LATEST_REMOTE="$(git rev-parse "origin/$BRANCH")"
[[ "$LATEST_REMOTE" == "$REMOTE_SHA" ]] || die "origin/$BRANCH moved during tests ($REMOTE_SHA -> $LATEST_REMOTE). Nothing committed/pushed; rollback will restore local files."

git add app-server.mjs src/evaluate.mjs "$NEW_MODULE" "$NEW_TEST"
CHANGED="$(git diff --cached --name-only)"
for expected in app-server.mjs src/evaluate.mjs "$NEW_MODULE" "$NEW_TEST"; do
  grep -qx "$expected" <<<"$CHANGED" || die "Expected staged file missing: $expected"
done
COUNT="$(printf '%s\n' "$CHANGED" | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "$COUNT" == "4" ]] || die "Unexpected staged files detected:\n$CHANGED"

git commit -m "$COMMIT_MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin "HEAD:$BRANCH"

trap - ERR INT TERM
log "SUCCESS"
log "Pushed $NEW_SHA to origin/$BRANCH"
log "Behavior:"
log "  - reuses existing Maximum suspected risky wallets % and Maximum insiders % settings"
log "  - scans top holders + early buyers with one-hop Solana funding evidence"
log "  - common funder only counts when timing is tight and funding sizes are broadly similar"
log "  - score penalty is 0/5/10/15/20 and never double-counts insider + risky-wallet overlap"
log "  - configured max % still owns hard BLOCKED; unknown enabled evidence stays WAITING"
log "  - worker is background-only and rate-limited; Pump TradeEvent hot path is untouched"
