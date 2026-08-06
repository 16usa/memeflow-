import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const evalPath=path.join(appDir,'src','evaluate.mjs');
const storePath=path.join(appDir,'src','store.mjs');

for(const p of [evalPath,storePath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-anti-rug-v6';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Keep a tiny rolling risk history on each token.
//    No database migration. At most 12 snapshots/token, one every >=5s.
// ─────────────────────────────────────────────────────────────────────────────
{
  let s=fs.readFileSync(storePath,'utf8');

  if(!s.includes('antiRugHistory:antiRugHistory')){
    const marker=`    this.state.tokens[mint]={
      ...old,...t,`;
    if(!s.includes(marker)){
      throw new Error('ABORT: expected store.setToken object block not found');
    }

    const prep=`    const prevHist=Array.isArray(old?.antiRugHistory)?old.antiRugHistory:[];
    const lastHist=prevHist[prevHist.length-1]||null;
    const snap={
      at:now,
      priceSol:hasNextPrice?nextPrice:(Number.isFinite(oldPrice)?oldPrice:null),
      liquiditySol:Number.isFinite(Number(t?.liquiditySol??t?.liquidity))?Number(t?.liquiditySol??t?.liquidity):null,
      holderCount:Number.isFinite(Number(t?.holderCount??t?.holders))?Number(t?.holderCount??t?.holders):null,
      top10Pct:Number.isFinite(Number(t?.top10Pct??t?.top10))?Number(t?.top10Pct??t?.top10):null,
      developerPct:Number.isFinite(Number(t?.developerPct??t?.creatorPct))?Number(t?.developerPct??t?.creatorPct):null,
      buyPressure:Number.isFinite(Number(t?.buyPressure??t?.momentum))?Number(t?.buyPressure??t?.momentum):null
    };
    const meaningfulSnap=Object.values(snap).slice(1).some(v=>v!==null);
    const shouldSnap=meaningfulSnap&&(!lastHist||now-Number(lastHist.at||0)>=5000);
    const antiRugHistory=shouldSnap?[...prevHist,snap].slice(-12):prevHist;

`;
    s=s.replace(marker,prep+`    this.state.tokens[mint]={
      ...old,...t,
      antiRugHistory:antiRugHistory,`);
  }

  fs.writeFileSync(storePath,s);
  console.log('Changed:',storePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Add dynamic staged confirmation to evaluate.mjs.
//    Strong launch: earliest BUY READY after 45s and two real snapshots.
//    Normal launch: 90s.
//    Suspicious-but-not-failed launch: 180s.
//    Hard deterioration blocks immediately.
// ─────────────────────────────────────────────────────────────────────────────
{
  let s=fs.readFileSync(evalPath,'utf8');

  if(!s.includes('function antiRugConfirmation(')){
    const anchor=`export function evaluate(token,s){`;
    if(!s.includes(anchor))throw new Error('ABORT: evaluate() anchor not found');

    const helper=`
function antiRugConfirmation(token,s,now=Date.now()){
  const discovered=Number(token?.discoveredAt||token?.createdAt||0);
  const ageSec=discovered?Math.max(0,(now-discovered)/1000):0;
  const hist=(Array.isArray(token?.antiRugHistory)?token.antiRugHistory:[])
    .filter(x=>x&&Number(x.at)>0)
    .sort((a,b)=>Number(a.at)-Number(b.at));

  const recent=hist.filter(x=>now-Number(x.at)<=180000);
  const first=recent[0]||hist[0]||null;
  const last=recent[recent.length-1]||hist[hist.length-1]||null;
  const spanSec=first&&last?Math.max(0,(Number(last.at)-Number(first.at))/1000):0;

  const currentPrice=num(token,'priceSol');
  const peak=num(token,'peakPriceSol');
  const drawdown=peak>0&&currentPrice!==null?Math.max(0,(peak-currentPrice)/peak*100):0;

  const holderNow=num(token,'holderCount','holders');
  const holderThen=first&&Number.isFinite(Number(first.holderCount))?Number(first.holderCount):null;
  const holderDropPct=holderThen>0&&holderNow!==null?Math.max(0,(holderThen-holderNow)/holderThen*100):0;

  const top10Now=num(token,'top10Pct','top10');
  const top10Then=first&&Number.isFinite(Number(first.top10Pct))?Number(first.top10Pct):null;
  const top10Rise=top10Now!==null&&top10Then!==null?Math.max(0,top10Now-top10Then):0;

  const liqNow=num(token,'liquiditySol','liquidity');
  const liqThen=first&&Number.isFinite(Number(first.liquiditySol))?Number(first.liquiditySol):null;
  const liqDropPct=liqThen>0&&liqNow!==null?Math.max(0,(liqThen-liqNow)/liqThen*100):0;

  const pressure=num(token,'buyPressure','momentum');
  const requiredPressure=enabled(s?.minBuyPressure)?Number(s.minBuyPressure):1.2;

  // Immediate deterioration gates. These are intentionally independent of age.
  if(drawdown>=35 && (pressure===null||pressure<1.15))
    return {block:true,reason:\`Anti-rug: price collapsed \${drawdown.toFixed(1)}% from local peak with weak buy pressure\`};
  if(liqDropPct>=35)
    return {block:true,reason:\`Anti-rug: liquidity fell \${liqDropPct.toFixed(1)}% during confirmation\`};
  if(holderDropPct>=25 && holderThen>=10)
    return {block:true,reason:\`Anti-rug: holder count fell \${holderDropPct.toFixed(1)}% during confirmation\`};
  if(top10Rise>=12)
    return {block:true,reason:\`Anti-rug: Top-10 concentration increased by \${top10Rise.toFixed(1)} percentage points\`};

  const enoughSnapshots=recent.length>=2&&spanSec>=10;
  const holderGrowing=holderThen===null||holderNow===null||holderNow>=holderThen;
  const liquidityStable=liqDropPct<15;
  const concentrationStable=top10Rise<5;
  const pressureStrong=pressure!==null&&pressure>=Math.max(1.5,requiredPressure);
  const priceHealthy=drawdown<20;

  const configuredMinHolders=enabled(s?.minHolders)?Number(s.minHolders):0;
  const holderStrong=holderNow!==null&&holderNow>=Math.max(20,configuredMinHolders);

  const strong=
    enoughSnapshots &&
    holderStrong &&
    holderGrowing &&
    liquidityStable &&
    concentrationStable &&
    pressureStrong &&
    priceHealthy &&
    token?.holderFresh===true;

  const warningCount=
    (drawdown>=20?1:0)+
    (liqDropPct>=15?1:0)+
    (top10Rise>=5?1:0)+
    (!holderGrowing?1:0)+
    (pressure!==null&&pressure<requiredPressure?1:0);

  // Dynamic maturity:
  // strong = 45 sec, normal = 90 sec, suspicious = 180 sec.
  const requiredAgeSec=strong?45:(warningCount>=2?180:90);

  if(!enoughSnapshots)
    return {wait:true,requiredAgeSec,ageSec,reason:'Anti-rug confirmation: waiting for a second independent market snapshot'};
  if(ageSec<requiredAgeSec)
    return {wait:true,requiredAgeSec,ageSec,reason:\`Anti-rug confirmation: \${Math.ceil(requiredAgeSec-ageSec)} sec remaining\`};

  return {
    pass:true,
    requiredAgeSec,
    ageSec,
    strong,
    warningCount,
    diagnostics:{drawdown,liqDropPct,holderDropPct,top10Rise,spanSec}
  };
}

`;
    s=s.replace(anchor,helper+anchor);
  }

  // Insert confirmation just before final score/state selection.
  if(!s.includes('const antiRug=antiRugConfirmation(token,s);')){
    const finalAnchor=` score=Math.max(0,Math.min(100,Math.round(score)));const confidence=Math.max(0,Math.min(100,Math.round((token.dataQuality||0)*100)));
 const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';
 return {state,score,confidence,reasons,primaryReason:reasons[0]||'All configured token filters and AI gates passed',terminal:false,lifecycle:'active',drawdownPct:Number(life.drawdown.toFixed(2))};`;

    const replacement=` const antiRug=antiRugConfirmation(token,s);
 if(antiRug.block){blocked=true;reasons.unshift(antiRug.reason);score-=25}
 else if(antiRug.wait){waiting=true;reasons.unshift(antiRug.reason)}

 score=Math.max(0,Math.min(100,Math.round(score)));const confidence=Math.max(0,Math.min(100,Math.round((token.dataQuality||0)*100)));
 const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';
 return {state,score,confidence,reasons,primaryReason:reasons[0]||'All configured token filters and AI gates passed',terminal:false,lifecycle:'active',drawdownPct:Number(life.drawdown.toFixed(2)),antiRug};`;

    if(!s.includes(finalAnchor))throw new Error('ABORT: evaluate final state block not found');
    s=s.replace(finalAnchor,replacement);
  }

  fs.writeFileSync(evalPath,s);
  console.log('Changed:',evalPath);
}

console.log('');
console.log('Installed MEMEFLOW ANTI-RUG CONFIRMATION V6.');
console.log('Run self-test.mjs. Do not restart until ALL V6 SELF-TESTS PASSED.');