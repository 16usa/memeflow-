#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const project = process.cwd();
const appDir = path.join(project,'memeflow-app');
const serverPath = path.join(appDir,'app-server.mjs');
const storePath = path.join(appDir,'src','store.mjs');

for (const p of [serverPath,storePath]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing required file: ${p}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backupDir = path.join(project,'.memeflow-backups',`cold-start-v2-${stamp}`);
fs.mkdirSync(backupDir,{recursive:true});
fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));
fs.copyFileSync(storePath,path.join(backupDir,'store.mjs'));

let server = fs.readFileSync(serverPath,'utf8');
let store = fs.readFileSync(storePath,'utf8');

function fail(message, code=2) {
  console.error(message);
  process.exit(code);
}

// 1) Reduce synchronous SQLite/JSON warm restore at cold boot.
// The permanent SQLite registry remains complete and JsonStore.getToken()
// already lazy-loads any token that becomes active again.
if (!store.includes('MEMEFLOW_COLD_START_V2_WARM_LIMIT')) {
  const oldWarm = `    const warmLimit=Math.max(
      1000,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||5000)
    );`;

  const newWarm = `    // MEMEFLOW_COLD_START_V2_WARM_LIMIT
    // Keep cold boot bounded. The permanent SQLite registry remains the source
    // of truth and older tokens are lazy-hydrated by getToken() when needed.
    const warmLimit=Math.max(
      250,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||750)
    );`;

  if (!store.includes(oldWarm)) {
    fail('store.mjs warm-limit anchor not found; refusing to patch.',3);
  }
  store = store.replace(oldWarm,newWarm);
}

// 2) Move platform analytics backfill off the pre-listen critical path.
if (!server.includes('MEMEFLOW_COLD_START_V2_ANALYTICS')) {
  const oldAnalytics = `// Import already-existing trades from every user.
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

  const newAnalytics = `// MEMEFLOW_COLD_START_V2_ANALYTICS
// Importing historical analytics is idempotent but potentially expensive.
// Define it now; run it only after HTTP is already listening.
function __mfDeferredPlatformAnalyticsBackfillV2(){
  try{
    const started=Date.now();
    const backfilled=
      platformAnalytics.backfillState(store);

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

  if (!server.includes(oldAnalytics)) {
    fail('app-server.mjs analytics-backfill anchor not found; refusing to patch.',4);
  }
  server = server.replace(oldAnalytics,newAnalytics);
}

// 3) Do not run discovery bridge before server.listen().
if (!server.includes('MEMEFLOW_COLD_START_V2_BRIDGE_DEFER')) {
  const oldBridge = `}
startDiscoveryBridge();


// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1`;

  const newBridge = `}
// MEMEFLOW_COLD_START_V2_BRIDGE_DEFER
// The authoritative Pump WebSocket still starts immediately after listen.
// The heavier bridge starts shortly after the first static requests can land.


// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1`;

  if (!server.includes(oldBridge)) {
    fail('app-server.mjs discovery-bridge anchor not found; refusing to patch.',5);
  }
  server = server.replace(oldBridge,newBridge);
}

// 4) Schedule non-critical startup work after the listener is accepting traffic.
// Live discovery remains immediate.
if (!server.includes('MEMEFLOW_COLD_START_V2_POST_LISTEN')) {
  const listenNeedle = `  // Priority #1: live WebSocket starts immediately.
  startDiscovery();

  // Priority #2: low-rate history/gap sync starts in the background. It never`;

  const listenReplacement = `  // Priority #1: live WebSocket starts immediately.
  startDiscovery();

  // MEMEFLOW_COLD_START_V2_POST_LISTEN
  // Give Safari/Replit time to receive HTML/CSS/JS before CPU/disk recovery work.
  const __mfColdStartTimer=(delay,fn)=>{
    const t=setTimeout(()=>{
      try{fn()}catch(error){
        console.error('[COLD START V2]',error?.message||error);
      }
    },delay);
    t.unref?.();
    return t;
  };

  __mfColdStartTimer(
    Math.max(500,Number(process.env.DISCOVERY_BRIDGE_START_DELAY_MS||1200)),
    ()=>startDiscoveryBridge()
  );

  __mfColdStartTimer(
    Math.max(1500,Number(process.env.PLATFORM_ANALYTICS_START_DELAY_MS||3500)),
    ()=>__mfDeferredPlatformAnalyticsBackfillV2()
  );

  // Priority #2: low-rate history/gap sync starts in the background. It never`;

  if (!server.includes(listenNeedle)) {
    fail('app-server.mjs post-listen anchor not found; refusing to patch.',6);
  }
  server = server.replace(listenNeedle,listenReplacement);
}

// 5) Delay history backfill itself a little so first-page assets are not
// competing with history I/O immediately after an autoscale wake-up.
if (!server.includes('MEMEFLOW_COLD_START_V2_HISTORY_DELAY')) {
  const historyStart = `  // Priority #2: low-rate history/gap sync starts in the background. It never
  // blocks the live scanner and never consumes Solana RPC capacity.
  __mfPumpHistoryBackfill=startPumpHistoryBackfill({`;

  const historyStartNew = `  // Priority #2: low-rate history/gap sync starts in the background. It never
  // blocks the live scanner and never consumes Solana RPC capacity.
  // MEMEFLOW_COLD_START_V2_HISTORY_DELAY
  __mfColdStartTimer(
    Math.max(2000,Number(process.env.HISTORY_BACKFILL_START_DELAY_MS||5000)),
    ()=>{
      __mfPumpHistoryBackfill=startPumpHistoryBackfill({`;

  if (!server.includes(historyStart)) {
    fail('app-server.mjs history-backfill start anchor not found; refusing to patch.',7);
  }
  server = server.replace(historyStart,historyStartNew);

  const recoveryAnchor = `  });

  startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:0,processing:0}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})`;

  const recoveryReplacement = `      });
    }
  );

  __mfColdStartTimer(
    Math.max(3000,Number(process.env.DECISION_RECOVERY_START_DELAY_MS||7000)),
    ()=>startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:0,processing:0}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})`;

  if (!server.includes(recoveryAnchor)) {
    fail('app-server.mjs recovery anchor not found; refusing to patch.',8);
  }
  server = server.replace(recoveryAnchor,recoveryReplacement);

  const recoveryTail = `    .then(()=>{const ms=recoveryMetrics.decisionRecoveryCompletedAt-listenAt;console.log(\`[RECOVERY] complete in \${ms}ms — \${recoveryMetrics.decisionRecoveryTokensProcessed} tokens, \${recoveryMetrics.decisionRecoveryDecisionsCreated} decisions, \${recoveryMetrics.decisionRecoveryErrors} errors\`)})
    .catch(e=>console.error('[RECOVERY] error',e.message));
});`;

  const recoveryTailNew = `      .then(()=>{const ms=recoveryMetrics.decisionRecoveryCompletedAt-listenAt;console.log(\`[RECOVERY] complete in \${ms}ms — \${recoveryMetrics.decisionRecoveryTokensProcessed} tokens, \${recoveryMetrics.decisionRecoveryDecisionsCreated} decisions, \${recoveryMetrics.decisionRecoveryErrors} errors\`)})
      .catch(e=>console.error('[RECOVERY] error',e.message))
  );
});`;

  if (!server.includes(recoveryTail)) {
    fail('app-server.mjs recovery tail anchor not found; refusing to patch.',9);
  }
  server = server.replace(recoveryTail,recoveryTailNew);
}

fs.writeFileSync(serverPath,server);
fs.writeFileSync(storePath,store);

try {
  execFileSync(process.execPath,['--check',serverPath],{stdio:'inherit'});
  execFileSync(process.execPath,['--check',storePath],{stdio:'inherit'});
} catch {
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
  fs.copyFileSync(path.join(backupDir,'store.mjs'),storePath);
  console.error('Syntax check failed. Original files restored automatically.');
  process.exit(10);
}

const required = [
  ['server','MEMEFLOW_COLD_START_V2_ANALYTICS',server],
  ['server','MEMEFLOW_COLD_START_V2_BRIDGE_DEFER',server],
  ['server','MEMEFLOW_COLD_START_V2_POST_LISTEN',server],
  ['server','MEMEFLOW_COLD_START_V2_HISTORY_DELAY',server],
  ['store','MEMEFLOW_COLD_START_V2_WARM_LIMIT',store]
];

for (const [name,marker,text] of required) {
  if (!text.includes(marker)) {
    fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
    fs.copyFileSync(path.join(backupDir,'store.mjs'),storePath);
    fail(`Verification failed: ${name} missing ${marker}. Restored originals.`,11);
  }
}

console.log('');
console.log('MEMEFLOW COLD START V2 installed successfully.');
console.log(`Backup: ${backupDir}`);
console.log('Changed only:');
console.log('  memeflow-app/app-server.mjs');
console.log('  memeflow-app/src/store.mjs');
console.log('');
console.log('Live Pump discovery still starts immediately after server.listen().');
console.log('Deferred: discovery bridge ~1.2s, analytics ~3.5s, history ~5s, decision recovery ~7s.');
console.log('Startup token warm restore default: 5000 -> 750 (permanent SQLite registry unchanged).');
console.log('');
console.log('Next: restart/redeploy the Replit app.');
