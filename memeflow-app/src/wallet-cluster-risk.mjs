// MEMEFLOW_WALLET_CLUSTER_RISK_V3
// Bounded one-hop Solana funding analysis.
// It intentionally does NOT do deep graph crawling, Helius, external blacklists,
// or multi-hop identity guessing.

const LAMPORTS_PER_SOL=1_000_000_000;

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const clampPct=v=>Math.max(0,Math.min(100,Number(v)||0));

// MEMEFLOW_WALLET_RISK_PRIORITY_V1
// This scanner is explicitly low priority. Yield to the Node event loop before
// every optional RPC so incoming Pump CREATE notifications can enqueue first.
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function walletRiskPriorityYield(rpc){
  const cooldownUntil=Number(rpc?.metrics?.cooldownUntil||0);

  if(Number.isFinite(cooldownUntil) && cooldownUntil>Date.now()){
    await sleep(Math.min(12_000,Math.max(0,cooldownUntil-Date.now())+50));
  }

  const configured=Number(process.env.WALLET_CLUSTER_PRIORITY_YIELD_MS);
  const delayMs=Number.isFinite(configured)
    ? Math.max(25,Math.min(500,configured))
    : 100;

  await sleep(delayMs);
}

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
    // MEMEFLOW_WALLET_RISK_PRIORITY_V1
    await walletRiskPriorityYield(rpc);
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
      // MEMEFLOW_WALLET_RISK_PRIORITY_V1
      await walletRiskPriorityYield(rpc);
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
    // MEMEFLOW_WALLET_RISK_PRIORITY_V1
    // Still enough wallets to detect a >=3-wallet common-funder cluster, but
    // bounded tightly so this optional safety pass cannot starve discovery.
    maxWallets:Math.max(3,Math.min(10,Number(options.maxWallets??process.env.WALLET_CLUSTER_MAX_WALLETS??5))),
    signatureLimit:Math.max(2,Math.min(8,Number(options.signatureLimit??process.env.WALLET_CLUSTER_SIGNATURE_LIMIT??3))),
    txPerWallet:Math.max(1,Math.min(4,Number(options.txPerWallet??process.env.WALLET_CLUSTER_TX_PER_WALLET??2))),
    concurrency:Math.max(1,Math.min(4,Number(options.concurrency??process.env.WALLET_CLUSTER_RPC_CONCURRENCY??1))),
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
