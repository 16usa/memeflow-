
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={
  "game.html": "843686d211650170f1eca8e3d916f6109d64805a8a95243efc235c2651eb6276",
  "game.css": "af7dba16d475ef7238bddf32b15d05471296c15d62a5563915d767669ce0938d",
  "game.js": "e46bdff4d0717f37f465dc015976e1800c901c8aa18808463e5de2068d748148",
  "game-engine.mjs": "316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e"
};
let checks=0;
const pass=(name,ok)=>{if(!ok) throw new Error('FAIL '+name); checks++; console.log('PASS',name);};
for(const f of ['game.html','game.css','game.js']) pass('hash '+f,sha(path.join(app,f))===expected[f]);
pass('game-engine unchanged',sha(path.join(app,'src/game-engine.mjs'))===expected['game-engine.mjs']);
const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');
pass('single stylesheet', (html.match(/\/game\.css\?v=/g)||[]).length===1);
pass('single Game script', (html.match(/\/game\.js\?v=/g)||[]).length===1);
pass('V5.8 cache bust',html.includes('/game.css?v=58')&&html.includes('/game.js?v=58'));
pass('cashout telemetry present',html.includes('id="cashoutTelemetry"')&&html.includes('id="cashoutMeterFill"'));
pass('result flight strip present',html.includes('id="resultCaptureHero"')&&html.includes('id="resultTimeHero"'));
pass('visual-only notice',html.includes('server owns entry')||html.includes('server-authoritative'));
pass('no Game entry filter resurrection',!js.includes('holderMaxAgeMs')&&!js.includes('decisionMaxAgeMs')&&!js.includes('selectionScorePenalty'));
pass('no fetch to settings mutation',!js.includes('/api/settings')&&!js.includes('/api/trading/settings'));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('no extra stylesheet tag',(html.match(/<link[^>]+stylesheet/g)||[]).length===1);

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
pass('all JS ids resolve',refs.every(x=>ids.includes(x)));

for(const f of ['game.js','src/game-engine.mjs','app-server.mjs']) {
  const p=path.join(app,f); if(!fs.existsSync(p)) continue;
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  pass('syntax '+f,r.status===0);
}
pass('client version 5.8',js.includes("CLIENT_VERSION='5.8'"));
pass('cashout telemetry renderer',js.includes('function renderCashoutTelemetry'));
pass('cash pulse visual only',js.includes("dataset.cashpulse='locking'"));
pass('no new trade endpoints',!js.includes('/api/game/buy')&&!js.includes('/api/game/sell'));
console.log(`PEPE GAME V5.8 VERIFY: PASS (${checks} checks)`);
