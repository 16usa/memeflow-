import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const evaluatePath=path.join(appDir,'src','evaluate.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

for(const p of [evaluatePath,serverPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-filter-pipeline-v9';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

function save(p,s){fs.writeFileSync(p,s,'utf8');console.log('Changed:',p)}
function check(p){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(r.status||1)}
  console.log('PASS syntax:',path.relative(appDir,p));
}

// ── 1. OPTIONAL FILTERS: numeric 0 = OFF ──────────────────────────────────
let e=fs.readFileSync(evaluatePath,'utf8');

if(!e.includes("const filterEnabled=")){
  const anchor="const enabled=(v)=>v!==null&&v!==undefined&&v!=='';";
  if(!e.includes(anchor)){console.error('ABORT: evaluate enabled() anchor missing');process.exit(1)}
  e=e.replace(anchor,anchor+"\n// Optional numeric Settings filters: null/blank/0 = disabled.\nconst filterEnabled=(v)=>enabled(v)&&(!Number.isFinite(Number(v))||Number(v)!==0);");
}

// range() is used by optional min/max user filters.
e=e.replace(
  /const range=\(value,min,max,label,unit='',pen=12\)=>\{if\(!enabled\(min\)&&!enabled\(max\)\)return;if\(value===null\)return need\(null,`\$\{label\} data pending`,pen\);if\(enabled\(min\)\)need\(value>=Number\(min\),`\$\{label\} \$\{value\}\$\{unit\} below minimum \$\{min\}\$\{unit\}`,pen\);if\(enabled\(max\)\)need\(value<=Number\(max\),`\$\{label\} \$\{value\}\$\{unit\} above maximum \$\{max\}\$\{unit\}`,pen\)\};/,
  "const range=(value,min,max,label,unit='',pen=12)=>{const minOn=filterEnabled(min),maxOn=filterEnabled(max);if(!minOn&&!maxOn)return;if(value===null)return need(null,`${label} data pending`,pen);if(minOn)need(value>=Number(min),`${label} ${value}${unit} below minimum ${min}${unit}`,pen);if(maxOn)need(value<=Number(max),`${label} ${value}${unit} above maximum ${max}${unit}`,pen)};"
);

// V7 may already have a liquidity range. If present, zero now disables it through range().
if(!e.includes("num(token,'liquidityUsd')")){
  const anchor=" range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);";
  if(!e.includes(anchor)){console.error('ABORT: bonding curve range anchor missing');process.exit(1)}
  e=e.replace(anchor,anchor+"\n range(num(token,'liquidityUsd'),s.minLiquidityUsd,null,'Liquidity USD','',14);");
}

// minHolders helper should not create pending when set to 0.
e=e.replace(
  "need(token.holderCount==null&&enabled(s.minHolders)?null:true,'holder data pending',5);",
  "need(token.holderCount==null&&filterEnabled(s.minHolders)?null:true,'holder data pending',5);"
);

// minBuyPressure=0 should be OFF as well.
e=e.replace(
  "if(enabled(s.minBuyPressure))need(token.buyPressure==null?null:Number(token.buyPressure)>=Number(s.minBuyPressure),`buy pressure below ${s.minBuyPressure}×`,15);",
  "if(filterEnabled(s.minBuyPressure))need(token.buyPressure==null?null:Number(token.buyPressure)>=Number(s.minBuyPressure),`buy pressure below ${s.minBuyPressure}×`,15);"
);

// Anti-rug should use 1.2 default when user has explicitly disabled minBuyPressure with 0,
// not treat 0 as a meaningful pressure threshold.
e=e.replace(
  "const requiredPressure=enabled(s?.minBuyPressure)?Number(s.minBuyPressure):1.2;",
  "const requiredPressure=filterEnabled(s?.minBuyPressure)?Number(s.minBuyPressure):1.2;"
);
e=e.replace(
  "const configuredMinHolders=enabled(s?.minHolders)?Number(s.minHolders):0;",
  "const configuredMinHolders=filterEnabled(s?.minHolders)?Number(s.minHolders):0;"
);

// maxTokenAgeMinutes=0 is an optional OFF value, not "expire immediately".
e=e.replace(
  "const configuredMax=enabled(s?.maxTokenAgeMinutes)?Number(s.maxTokenAgeMinutes):180;",
  "const configuredMax=filterEnabled(s?.maxTokenAgeMinutes)?Number(s.maxTokenAgeMinutes):180;"
);

// If V7 has blocked precedence, keep it; otherwise fix it.
e=e.replace(
  "const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';",
  "const state=blocked?'BLOCKED':waiting?'WAITING':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';"
);

save(evaluatePath,e);

// ── 2. DISCOVERY: Pump.fun identity survives every stage ────────────────────
let s=fs.readFileSync(serverPath,'utf8');

// The create instruction is authoritative: if decodePumpCreate succeeded, launchPlatform is pump.
// Add it at first storage so evaluate() never has to infer protocol from mutable source labels.
s=s.replace(
  "isMayhemMode:false,launchMode:'standard',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'",
  "isMayhemMode:false,launchMode:'standard',launchPlatform:'pump',protocol:'pump',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'"
);

// Price polling used to change source to "Solana bonding curve". Keep that descriptive source,
// but explicitly preserve launch identity in the update too.
s=s.replace(
  "scanError:null,\n          source:'Solana bonding curve'",
  "scanError:null,\n          launchPlatform:t.launchPlatform||'pump',\n          protocol:t.protocol||'pump',\n          source:'Solana bonding curve'"
);

// Expose launch identity in candidate payload for diagnostics.
if(!s.includes("launchPlatform:t.launchPlatform||null")){
  const anchor="    source:t.source||'Solana on-chain',";
  if(!s.includes(anchor)){console.error('ABORT: candidate source anchor missing');process.exit(1)}
  s=s.replace(anchor,anchor+"\n    launchPlatform:t.launchPlatform||null,\n    protocol:t.protocol||t.launchPlatform||null,");
}

// ── 3. SETTINGS SAVE: force a fresh per-user re-evaluation of cached tokens ─
const reevalRegex=/function reevaluateUser\(uid\)\{const s=store\.settings\(uid\);const tokens=store\.tokens\(\);let count=0;for\(const token of tokens\)\{try\{const d=evaluate\(token,s\);const saved=\{\.\.\.d,primaryReason:d\.primaryReason\};store\.setDecision\(uid,token\.mint,saved\);if\(d\.state==='BUY READY'\)\{try\{paper\.onDecision\(uid,token,saved,s\)\}catch\(_\)\{\}\}count\+\+\}catch\(_\)\{\}\}return count\}/;

const newReeval=`function reevaluateUser(uid){
  const settings=store.settings(uid);
  const tokens=store.tokens();
  const settingsVersion=store.user(uid)?.settingsVersion||store.user(uid)?.updatedAt||Date.now();
  let count=0,errors=0;
  const states={WAITING:0,WATCH:0,BLOCKED:0,'BUY READY':0,EXPIRED:0};

  for(const token of tokens){
    try{
      const d=evaluate(token,settings);
      const saved={...d,primaryReason:d.primaryReason,settingsVersion,reevaluatedAt:Date.now()};
      store.setDecision(uid,token.mint,saved);
      states[d.state]=(states[d.state]||0)+1;
      // PAPER receives only the fresh current decision. It still applies owner approval,
      // capital and execution gates internally.
      if(d.state==='BUY READY'){
        try{paper.onDecision(uid,token,saved,settings)}catch(_){}
      }
      count++;
    }catch(_){errors++}
  }
  return {count,errors,states,settingsVersion};
}`;

if(reevalRegex.test(s)){
  s=s.replace(reevalRegex,newReeval);
} else if(!s.includes("reevaluatedAt:Date.now()")){
  console.error('ABORT: reevaluateUser() anchor not found');
  process.exit(1);
}

// V7 may return decisionsReevaluated as an object; old build returned integer. Both are fine.
// Add a defensive version marker to newly saved settings if current store supports it.
if(s.includes("const saved=store.setSettings(u.id,checked.settings);const decisionsReevaluated=reevaluateUser(u.id);")){
  s=s.replace(
    "const saved=store.setSettings(u.id,checked.settings);const decisionsReevaluated=reevaluateUser(u.id);",
    "const saved=store.setSettings(u.id,checked.settings);const decisionsReevaluated=reevaluateUser(u.id);"
  );
}

// Make chart/candidates compatible with V8 if installed; nothing to do if V8 already owns the route.
// Add launch diagnostics endpoint to prove protocol propagation without exposing secrets.
if(!s.includes("'/api/debug/filter-pipeline'")){
  const marker=" if(url.pathname==='/api/settings'&&req.method==='GET')";
  if(!s.includes(marker)){console.error('ABORT: settings GET marker missing');process.exit(1)}
  const route=` if(url.pathname==='/api/debug/filter-pipeline'){
    const rows=store.tokens().slice(0,50);
    const decisions=store.decisions(u.id);
    const pumpTagged=rows.filter(t=>String(t.launchPlatform||t.protocol||'').toLowerCase()==='pump').length;
    const byState={};for(const d of decisions.slice(0,200))byState[d.state]=(byState[d.state]||0)+1;
    return json(res,200,{
      settingsVersion:store.user(u.id)?.settingsVersion||store.user(u.id)?.updatedAt||null,
      settings:{minLiquidityUsd:store.settings(u.id).minLiquidityUsd,minHolders:store.settings(u.id).minHolders,launchPlatforms:store.settings(u.id).launchPlatforms},
      recentTokens:rows.length,
      recentPumpTagged:pumpTagged,
      decisionStates:byState,
      sample:rows.slice(0,10).map(t=>({mint:t.mint,launchPlatform:t.launchPlatform||null,protocol:t.protocol||null,source:t.source||null}))
    });
  }
`;
  s=s.replace(marker,route+marker);
}

save(serverPath,s);

check(evaluatePath);
check(serverPath);

console.log('');
console.log('INSTALLED MEMEFLOW FILTER PIPELINE V9');
console.log('Run self-test.mjs. Restart only after ALL V9 SELF-TESTS PASSED.');
