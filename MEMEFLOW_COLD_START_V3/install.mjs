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
const backupDir=path.join(project,'.memeflow-backups',`cold-start-v3-${stamp}`);
fs.mkdirSync(backupDir,{recursive:true});
fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));
fs.copyFileSync(storePath,path.join(backupDir,'store.mjs'));

let server=fs.readFileSync(serverPath,'utf8');
let store=fs.readFileSync(storePath,'utf8');

function restore(){
  try{
    fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
    fs.copyFileSync(path.join(backupDir,'store.mjs'),storePath);
  }catch{}
}

function die(message,code=2){
  restore();
  console.error(message);
  console.error('Original files restored automatically.');
  process.exit(code);
}

/* 1) Bound the synchronous SQLite/JSON warm restore.
      This does NOT truncate/delete the registry. JsonStore.getToken() already
      lazy-loads older tokens from SQLite when they become active. */
if(!store.includes('MEMEFLOW_COLD_START_V3_WARM_LIMIT')){
  const oldWarm=`    const warmLimit=Math.max(
      1000,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||5000)
    );`;

  const newWarm=`    // MEMEFLOW_COLD_START_V3_WARM_LIMIT
    // Bounded cold boot; permanent SQLite token registry remains intact.
    const warmLimit=Math.max(
      250,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||750)
    );`;

  if(!store.includes(oldWarm)){
    die('V3: store warm-limit anchor not found. Nothing was kept.',3);
  }
  store=store.replace(oldWarm,newWarm);
}

/* 2) Platform analytics historical import is synchronous and was running
      BEFORE server.listen(). Convert it into a deferred function. */
if(!server.includes('MEMEFLOW_COLD_START_V3_ANALYTICS')){
  const oldAnalytics=`// Import already-existing trades from every user.
// INSERT/UPSERT makes restart/backfill idempotent.
try{
  const backfilled=
    platformAnalytics.backfillState(store);

  console.log(
    '[PLATFORM ANALYTICS] backfill',
    backfilled
  );
}catch(error){
  console.error(
    '[PLATFORM ANALYTICS] backfill error',
    error?.message||error
  );
}`;

  const newAnalytics=`// MEMEFLOW_COLD_START_V3_ANALYTICS
// Historical import is idempotent but synchronous, so it must not block listen.
function __mfDeferredPlatformAnalyticsBackfillV3(){
  try{
    const started=Date.now();
    const backfilled=platformAnalytics.backfillState(store);
    console.log(
      '[PLATFORM ANALYTICS] deferred backfill',
      backfilled,
      'in',
      Date.now()-started,
      'ms'
    );
  }catch(error){
    console.error(
      '[PLATFORM ANALYTICS] deferred backfill error',
      error?.message||error
    );
  }
}`;

  if(!server.includes(oldAnalytics)){
    die('V3: analytics backfill anchor not found. Nothing was kept.',4);
  }
  server=server.replace(oldAnalytics,newAnalytics);
}

/* 3) Discovery bridge was started during module initialization, before listen.
      Remove only that eager call; do not modify the bridge implementation. */
if(!server.includes('MEMEFLOW_COLD_START_V3_BRIDGE_DEFER')){
  const oldBridge=`}
startDiscoveryBridge();


// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1`;

  const newBridge=`}
// MEMEFLOW_COLD_START_V3_BRIDGE_DEFER
// Heavy bridge is started shortly after HTTP begins listening.


// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1`;

  if(!server.includes(oldBridge)){
    die('V3: discovery bridge eager-start anchor not found. Nothing was kept.',5);
  }
  server=server.replace(oldBridge,newBridge);
}

/* 4) Schedule only the two pre-listen heavy tasks after primary live discovery.
      IMPORTANT: history backfill and decision recovery blocks are intentionally
      NOT rewritten in V3. They already begin after server.listen(), and this
      avoids touching fragile trading/recovery code. */
if(!server.includes('MEMEFLOW_COLD_START_V3_POST_LISTEN')){
  const oldListen=`  // Priority #1: live WebSocket starts immediately.
  startDiscovery();

  // Priority #2: low-rate history/gap sync starts in the background. It never`;

  const newListen=`  // Priority #1: live WebSocket starts immediately.
  startDiscovery();

  // MEMEFLOW_COLD_START_V3_POST_LISTEN
  // First allow the deployment to answer HTML/CSS/JS; then start non-critical
  // pre-listen work that was moved here.
  const __mfStartLaterV3=(delay,fn)=>{
    const timer=setTimeout(()=>{
      try{fn()}catch(error){
        console.error('[COLD START V3]',error?.message||error);
      }
    },delay);
    timer.unref?.();
    return timer;
  };

  __mfStartLaterV3(
    Math.max(500,Number(process.env.DISCOVERY_BRIDGE_START_DELAY_MS||1200)),
    ()=>startDiscoveryBridge()
  );

  __mfStartLaterV3(
    Math.max(1500,Number(process.env.PLATFORM_ANALYTICS_START_DELAY_MS||3500)),
    ()=>__mfDeferredPlatformAnalyticsBackfillV3()
  );

  // Priority #2: low-rate history/gap sync starts in the background. It never`;

  if(!server.includes(oldListen)){
    die('V3: post-listen anchor not found. Nothing was kept.',6);
  }
  server=server.replace(oldListen,newListen);
}

fs.writeFileSync(serverPath,server);
fs.writeFileSync(storePath,store);

/* Hard syntax verification. If either file is invalid, rollback immediately. */
try{
  execFileSync(process.execPath,['--check',serverPath],{stdio:'inherit'});
  execFileSync(process.execPath,['--check',storePath],{stdio:'inherit'});
}catch{
  die('V3: syntax verification failed.',7);
}

const markers=[
  ['server','MEMEFLOW_COLD_START_V3_ANALYTICS',server],
  ['server','MEMEFLOW_COLD_START_V3_BRIDGE_DEFER',server],
  ['server','MEMEFLOW_COLD_START_V3_POST_LISTEN',server],
  ['store','MEMEFLOW_COLD_START_V3_WARM_LIMIT',store]
];

for(const [where,marker,text] of markers){
  if(!text.includes(marker)){
    die(`V3: verification failed (${where}: ${marker}).`,8);
  }
}

console.log('');
console.log('MEMEFLOW COLD START V3 installed successfully.');
console.log(`Backup: ${backupDir}`);
console.log('Changed only:');
console.log('  memeflow-app/app-server.mjs');
console.log('  memeflow-app/src/store.mjs');
console.log('');
console.log('V3 intentionally does NOT rewrite history/recovery/trading blocks.');
console.log('Primary Pump discovery still starts immediately after server.listen().');
console.log('Deferred after listen: discovery bridge ~1.2s, analytics backfill ~3.5s.');
console.log('Default synchronous token warm restore: 5000 -> 750.');
console.log('Permanent SQLite registry is unchanged.');
console.log('');
console.log('Next: Stop -> Run -> Redeploy.');
