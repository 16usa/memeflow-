import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildHolderActiveUserContextV70
} from '../src/holder-active-user-context-v70.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const pkg=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

assert.match(
  app,
  /MEMEFLOW_HOLDER_ACTIVE_USER_CONTEXT_V70/
);

// The holder tick must build IDs once and settings context once.
const timerStart=app.indexOf('const holderRefreshTimer=setInterval(()=>{');
const timerEnd=app.indexOf('holderRefreshTimer.unref?.();',timerStart);
assert.ok(timerStart>=0 && timerEnd>timerStart);
const timer=app.slice(timerStart,timerEnd);

assert.match(
  timer,
  /const activeUserIds=__mfActiveScannerUserIds\(now\);/
);

assert.match(
  timer,
  /buildHolderActiveUserContextV70\(\{[\s\S]*?uids:activeUserIds,[\s\S]*?getSettings:uid=>store\.settings\(uid\)\|\|\{\}/
);

assert.match(
  timer,
  /__mfCanonicalHolderNeededV34\([\s\S]*?activeUserIds,[\s\S]*?activeUserContext/
);

// Stable blocked evaluator must consume supplied settings directly.
const stableStart=app.indexOf('function __mfAllActiveUsersStableBlocked(');
const stableEnd=app.indexOf('function __mfEntryAdmissionForUser',stableStart);
assert.ok(stableStart>=0 && stableEnd>stableStart);
const stableBlock=app.slice(stableStart,stableEnd);

assert.match(
  stableBlock,
  /Array\.isArray\(activeUserContext\)/
);

assert.match(
  stableBlock,
  /row\.uid,[\s\S]*?row\.settings,[\s\S]*?now/
);

// Performance contract: 20k token checks x 4 users should require only 4
// settings reads when context is constructed once, not 80k settings reads.
{
  const uids=['u1','u2','u3','u4'];
  let settingsReads=0;

  const rows=buildHolderActiveUserContextV70({
    uids,
    getSettings:uid=>{
      settingsReads++;
      return {uid,minHolders:10};
    }
  });

  assert.equal(settingsReads,4);
  assert.deepEqual(rows.map(x=>x.uid),uids);

  let logicalChecks=0;
  for(let i=0;i<20_000;i++){
    for(const row of rows){
      assert.ok(row.settings);
      logicalChecks++;
    }
  }

  assert.equal(logicalChecks,80_000);
  assert.equal(settingsReads,4);
}

// Exact order and object identity are preserved.
{
  const a={x:1}, b={x:2};
  const map=new Map([['b',b],['a',a]]);

  const rows=buildHolderActiveUserContextV70({
    uids:['b','a'],
    getSettings:uid=>map.get(uid)
  });

  assert.equal(rows[0].uid,'b');
  assert.equal(rows[0].settings,b);
  assert.equal(rows[1].uid,'a');
  assert.equal(rows[1].settings,a);
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/holder-active-user-context-v70\.mjs/
);

console.log('holder active user context v70 ok');
