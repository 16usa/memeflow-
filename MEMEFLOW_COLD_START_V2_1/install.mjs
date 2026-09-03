#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const project=process.cwd();
const appDir=path.join(project,'memeflow-app');
const serverPath=path.join(appDir,'app-server.mjs');
const storePath=path.join(appDir,'src','store.mjs');

for(const p of [serverPath,storePath]){
  if(!fs.existsSync(p)){
    console.error(`Missing required file: ${p}`);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(project,'.memeflow-backups',`cold-start-v2-1-${stamp}`);
fs.mkdirSync(backupDir,{recursive:true});
fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));
fs.copyFileSync(storePath,path.join(backupDir,'store.mjs'));

let server=fs.readFileSync(serverPath,'utf8');
let store=fs.readFileSync(storePath,'utf8');

function restoreAndFail(msg,code=2){
  try{
    fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
    fs.copyFileSync(path.join(backupDir,'store.mjs'),storePath);
  }catch{}
  console.error(msg);
  process.exit(code);
}

function replaceOnce(text,re,repl,label){
  if(!re.test(text)) restoreAndFail(`${label} not found; no changes kept.`,3);
  return text.replace(re,repl);
}

// 1) Bound synchronous token warm restore.
if(!store.includes('MEMEFLOW_COLD_START_V2_1_WARM_LIMIT')){
  store=replaceOnce(
    store,
    /const warmLimit=Math\.max\(\s*1000,\s*Number\(process\.env\.TOKEN_REGISTRY_WARM_LIMIT\|\|5000\)\s*\);/m,
`// MEMEFLOW_COLD_START_V2_1_WARM_LIMIT
    const warmLimit=Math.max(
      250,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||750)
    );`,
    'store warm-limit anchor'
  );
}

// 2) Defer platform analytics backfill from module-load critical path.
if(!server.includes('MEMEFLOW_COLD_START_V2_1_ANALYTICS')){
  const analyticsRe=/\/\/ Import already-existing trades from every user\.[\s\S]*?try\{\s*const backfilled=\s*platformAnalytics\.backfillState\(store\);[\s\S]*?\}\s*catch\(error\)\{[\s\S]*?\}\s*/m;
  server=replaceOnce(
    server,
    analyticsRe,
`// MEMEFLOW_COLD_START_V2_1_ANALYTICS
function __mfDeferredPlatformAnalyticsBackfillV21(){
  try{
    const started=Date.now();
    const backfilled=platformAnalytics.backfillState(store);
    console.log('[PLATFORM ANALYTICS] deferred backfill',backfilled,'in',Date.now()-started,'ms');
  }catch(error){
    console.error('[PLATFORM ANALYTICS] deferred backfill error',error?.message||error);
  }
}

`,
    'analytics backfill anchor'
  );
}

// 3) Remove eager discovery bridge start before server.listen().
if(!server.includes('MEMEFLOW_COLD_START_V2_1_BRIDGE')){
  server=replaceOnce(
    server,
    /\nstartDiscoveryBridge\(\);\s*\n(?=\s*\/\/ MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1)/m,
`\n// MEMEFLOW_COLD_START_V2_1_BRIDGE
// Deferred until after HTTP is listening.\n\n`,
    'discovery bridge eager-start anchor'
  );
}

// 4) Inject a post-listen scheduler immediately after startDiscovery().
if(!server.includes('MEMEFLOW_COLD_START_V2_1_POST_LISTEN')){
  server=replaceOnce(
    server,
    /(\n\s*\/\/ Priority #1: live WebSocket starts immediately\.\s*\n\s*startDiscovery\(\);\s*)/m,
`$1

  // MEMEFLOW_COLD_START_V2_1_POST_LISTEN
  const __mfColdStartLaterV21=(delay,fn)=>{
    const t=setTimeout(()=>{
      try{
        const value=fn();
        if(value&&typeof value.then==='function'){
          value.catch(error=>console.error('[COLD START V2.1]',error?.message||error));
        }
      }catch(error){
        console.error('[COLD START V2.1]',error?.message||error);
      }
    },delay);
    t.unref?.();
    return t;
  };

  __mfColdStartLaterV21(
    Math.max(500,Number(process.env.DISCOVERY_BRIDGE_START_DELAY_MS||1200)),
    ()=>startDiscoveryBridge()
  );

  __mfColdStartLaterV21(
    Math.max(1500,Number(process.env.PLATFORM_ANALYTICS_START_DELAY_MS||3500)),
    ()=>__mfDeferredPlatformAnalyticsBackfillV21()
  );
`,
    'post-listen startDiscovery anchor'
  );
}

// 5) Defer history backfill using a flexible source transform.
// We wrap only the assignment statement through its matching "});" that is
// immediately followed by startDecisionRecovery.
if(!server.includes('MEMEFLOW_COLD_START_V2_1_HISTORY')){
  const start = server.indexOf('__mfPumpHistoryBackfill=startPumpHistoryBackfill({');
  const recovery = server.indexOf('startDecisionRecovery({', start);
  if(start<0 || recovery<0) restoreAndFail('history/recovery block not found; no changes kept.',4);

  const close = server.lastIndexOf('});', recovery);
  if(close<start) restoreAndFail('history block closing anchor not found; no changes kept.',5);

  const before=server.slice(0,start);
  const block=server.slice(start,close+3);
  const after=server.slice(close+3);

  server =
    before +
`// MEMEFLOW_COLD_START_V2_1_HISTORY
  __mfColdStartLaterV21(
    Math.max(2000,Number(process.env.HISTORY_BACKFILL_START_DELAY_MS||5000)),
    ()=>{
      ` +
    block.replace(/\n/g,'\n      ') +
`
    }
  );` +
    after;
}

// 6) Defer decision recovery with a source-location transform that does not
// depend on exact whitespace/line wrapping.
if(!server.includes('MEMEFLOW_COLD_START_V2_1_RECOVERY')){
  const start=server.indexOf('startDecisionRecovery({');
  if(start<0) restoreAndFail('decision recovery start not found; no changes kept.',6);

  const catchNeedle=".catch(e=>console.error('[RECOVERY] error',e.message));";
  const catchPos=server.indexOf(catchNeedle,start);
  if(catchPos<0) restoreAndFail('decision recovery tail not found; no changes kept.',7);

  const end=catchPos+catchNeedle.length;
  const block=server.slice(start,end);

  server =
    server.slice(0,start) +
`// MEMEFLOW_COLD_START_V2_1_RECOVERY
  __mfColdStartLaterV21(
    Math.max(3000,Number(process.env.DECISION_RECOVERY_START_DELAY_MS||7000)),
    ()=>` +
    block.replace(/\n/g,'\n      ') +
`
  );` +
    server.slice(end);
}

fs.writeFileSync(serverPath,server);
fs.writeFileSync(storePath,store);

try{
  execFileSync(process.execPath,['--check',serverPath],{stdio:'inherit'});
  execFileSync(process.execPath,['--check',storePath],{stdio:'inherit'});
}catch{
  restoreAndFail('Syntax check failed. Originals restored automatically.',8);
}

for(const marker of [
  'MEMEFLOW_COLD_START_V2_1_WARM_LIMIT',
  'MEMEFLOW_COLD_START_V2_1_ANALYTICS',
  'MEMEFLOW_COLD_START_V2_1_BRIDGE',
  'MEMEFLOW_COLD_START_V2_1_POST_LISTEN',
  'MEMEFLOW_COLD_START_V2_1_HISTORY',
  'MEMEFLOW_COLD_START_V2_1_RECOVERY'
]){
  if(!(server.includes(marker)||store.includes(marker))){
    restoreAndFail(`Verification failed: ${marker}. Originals restored.`,9);
  }
}

console.log('');
console.log('MEMEFLOW COLD START V2.1 installed successfully.');
console.log(`Backup: ${backupDir}`);
console.log('Changed only:');
console.log('  memeflow-app/app-server.mjs');
console.log('  memeflow-app/src/store.mjs');
console.log('');
console.log('Immediate: HTTP listener + primary Pump discovery.');
console.log('Deferred: bridge ~1.2s, analytics ~3.5s, history ~5s, recovery ~7s.');
console.log('Warm token restore default: 5000 -> 750; SQLite registry remains intact.');
console.log('');
console.log('Next: Stop -> Run -> Redeploy.');
