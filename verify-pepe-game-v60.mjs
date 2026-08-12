import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={
  'game.html':'86af63a492d5b314747e0a21ffdca2cad8cdecd708d0d561c4db0620c3c89c0a',
  'game.css':'b02f1d06294f40bc402b6df0f3aa854c41d5a97cd400091826045da7a86d6b53',
  'game.js':'a4d94bec011dacfd54cddee47ac763110d967ee57abcc0d760c87a3b8086eb3a',
  'game-engine.mjs':'316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e'
};
let checks=0;const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);checks++;console.log('PASS',name);};
for(const f of ['game.html','game.css','game.js']) pass('hash '+f,sha(path.join(app,f))===expected[f]);
pass('trading engine unchanged',sha(path.join(app,'src/game-engine.mjs'))===expected['game-engine.mjs']);
const html=fs.readFileSync(path.join(app,'game.html'),'utf8'),css=fs.readFileSync(path.join(app,'game.css'),'utf8'),js=fs.readFileSync(path.join(app,'game.js'),'utf8');
pass('single stylesheet',(html.match(/<link[^>]+stylesheet/g)||[]).length===1);
pass('single Game script',(html.match(/\/game\.js\?v=/g)||[]).length===1);
pass('V6 cache bust',html.includes('/game.css?v=60')&&html.includes('/game.js?v=60'));
pass('client version 6.0',js.includes("CLIENT_VERSION='6.0'"));
pass('engine epoch reset includes state revision',js.includes('game.lastStateRevision=0')&&js.includes('game.lastSessionId=null')&&js.includes('resetOrderingForEngineEpoch'));
pass('client does not overwrite server feedFresh',!js.includes('game.session.feedFresh=false'));
pass('client does not overwrite server canCashout',!js.includes('game.session.canCashout=false'));
pass('pagehide lifecycle',js.includes("addEventListener('pagehide'")&&js.includes("dataset.lifecycle='paused'"));
pass('managed main animation frame',js.includes('function startVisualLoop()')&&js.includes('function stopVisualLoop()')&&js.includes('cancelAnimationFrame(game.raf)'));
pass('managed FX lifecycle',js.includes('function resume()')&&js.includes('function pause()')&&js.includes('removeEventListener(\'resize\',resize)'));
pass('flight state visual-only machine',js.includes('function resolveFlightState()')&&js.includes("setFlightState(resolveFlightState())"));
pass('visual state layers',html.includes('class="aurora-band"')&&html.includes('class="orbital-grid"')&&html.includes('class="plasma-wake"')&&html.includes('class="flight-state-ring"')&&html.includes('class="plasma-tail"'));
pass('V6 flight CSS',css.includes('[data-flight="boost"]')&&css.includes('[data-flight="danger"]')&&css.includes('@keyframes ringSecure'));
pass('mobile immersive V6',css.includes('100dvh - 112px'));
pass('reduced motion V6',css.includes('.plasma-wake,.plasma-tail')&&css.includes('prefers-reduced-motion:reduce'));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('CSS parser escape bug removed',!css.includes('\\n')&&!css.includes('/* V5.'));
pass('canonical selectors not layered',!css.includes('.world{--pf-x')&&!css.includes('.world{--flight-ring-opacity')&&!css.includes('.selector-status{position:relative')&&!css.includes('.result-card{overflow:hidden}')&&!css.includes('.result-receipt{grid-template-columns:repeat(5,1fr)}'));
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);pass('all JS ids resolve',refs.every(x=>ids.includes(x)));
pass('no Game entry filters',!js.includes('holderMaxAgeMs')&&!js.includes('decisionMaxAgeMs')&&!js.includes('selectionScorePenalty'));
pass('no settings mutation endpoint',!js.includes('/api/settings')&&!js.includes('/api/trading/settings'));
pass('no BUY/SELL endpoint',!js.includes('/api/game/buy')&&!js.includes('/api/game/sell'));
for(const f of ['game.js','src/game-engine.mjs','app-server.mjs']){const r=spawnSync(process.execPath,['--check',path.join(app,f)],{encoding:'utf8'});pass('syntax '+f,r.status===0);}
const pointer=path.join(app,'.pepe-game-v60-last-backup');pass('backup pointer exists',fs.existsSync(pointer));
if(fs.existsSync(pointer)){
  const backup=fs.readFileSync(pointer,'utf8').trim(),manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
  pass('engine hash preserved from install',sha(path.join(app,'src/game-engine.mjs'))===manifest.engineHashBefore);
  pass('app-server preserved from install',sha(path.join(app,'app-server.mjs'))===manifest.appServerHashBefore);
  pass('index preserved from install',sha(path.join(app,'index.html'))===manifest.indexHashBefore);
}
console.log(`PEPE GAME V6.0 VERIFY: PASS (${checks} checks)`);
