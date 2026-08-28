import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_EVENT_FIRST_V35E/);
assert.match(app,/MEMEFLOW_EVENT_FIRST_V35B/);

for(const source of [
  'canonical-backfill-v8-pending-live-evidence',
  'canonical-v9-pending-live-evidence',
  'canonical-refresh-pending-live-evidence'
]){
  const idx=app.indexOf(`holderSource:'${source}'`);
  assert.ok(idx>=0,`missing ${source}`);

  const start=app.lastIndexOf('store.setToken(mint,{',idx);
  const end=app.indexOf('});',idx);
  assert.ok(start>=0&&end>idx,`bad object bounds for ${source}`);

  const block=app.slice(start,end+3);
  assert.match(block,/holderFresh:false/);
  assert.doesNotMatch(block,/holderCount\s*:\s*null/);
  assert.doesNotMatch(block,/holders\s*:\s*null/);
  assert.doesNotMatch(block,/top10Pct\s*:\s*null/);
  assert.doesNotMatch(block,/developerPct\s*:\s*null/);
  assert.doesNotMatch(block,/developerSharePct\s*:\s*null/);
}

// API/UI path already exposes the value independently of freshness.
assert.match(app,/holderCount:finite\(t\.holderCount\)/);
assert.match(app,/'Holders':finite\(t\.holderCount\)\?\?'—'/);

console.log('event-first holder visibility v35e ok');
