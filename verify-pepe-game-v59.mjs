import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={
  'game.html':'93f752e1497503319b31b697a40d9f2936917af8fd78daa501b7848f926c4122',
  'game.css':'c40b519cc1540c8fc36c33c1d03ca3c067bcdb1b354bd7c6aa229861b19efadc',
  'game.js':'c5f143c024055bb2191330f9902121338b09fb10e4180c582467971a39b9b13d',
  'game-engine.mjs':'316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e'
};
let checks=0;const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);checks++;console.log('PASS',name);};
for(const f of ['game.html','game.css','game.js']) pass('hash '+f,sha(path.join(app,f))===expected[f]);
pass('trading engine unchanged',sha(path.join(app,'src/game-engine.mjs'))===expected['game-engine.mjs']);
const html=fs.readFileSync(path.join(app,'game.html'),'utf8'),css=fs.readFileSync(path.join(app,'game.css'),'utf8'),js=fs.readFileSync(path.join(app,'game.js'),'utf8');
pass('single stylesheet',(html.match(/<link[^>]+stylesheet/g)||[]).length===1);
pass('single Game script',(html.match(/\/game\.js\?v=/g)||[]).length===1);
pass('V5.9 cache bust',html.includes('/game.css?v=59')&&html.includes('/game.js?v=59'));
pass('immersive layers',html.includes('class="atmosphere-haze"')&&html.includes('parallax-far')&&html.includes('parallax-mid')&&html.includes('parallax-near'));
pass('engine visuals',html.includes('class="heat-shimmer"')&&html.includes('class="engine-smoke"'));
pass('screen vignette',html.includes('class="screen-vignette"'));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('parallax CSS present',css.includes('.parallax-field')&&css.includes('--pf-x')&&css.includes('--pn-y'));
pass('smoke visual present',css.includes('.engine-smoke')&&css.includes('@keyframes smokePuff'));
pass('mobile immersive height',css.includes('100dvh - 124px'));
pass('reduced motion coverage',css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('.engine-smoke'));
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);pass('all JS ids resolve',refs.every(x=>ids.includes(x)));
pass('client version 5.9',js.includes("CLIENT_VERSION='5.9'"));
pass('visual parallax variables',js.includes("'--scene-energy'")&&js.includes("'--pf-x'")&&js.includes("'--pn-y'"));
pass('no Game entry filters',!js.includes('holderMaxAgeMs')&&!js.includes('decisionMaxAgeMs')&&!js.includes('selectionScorePenalty'));
pass('no settings mutation endpoint',!js.includes('/api/settings')&&!js.includes('/api/trading/settings'));
pass('no BUY/SELL endpoint',!js.includes('/api/game/buy')&&!js.includes('/api/game/sell'));
for(const f of ['game.js','src/game-engine.mjs','app-server.mjs']){const r=spawnSync(process.execPath,['--check',path.join(app,f)],{encoding:'utf8'});pass('syntax '+f,r.status===0);}
const pointer=path.join(app,'.pepe-game-v59-last-backup');pass('backup pointer exists',fs.existsSync(pointer));
if(fs.existsSync(pointer)){
  const backup=fs.readFileSync(pointer,'utf8').trim(),manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
  pass('engine hash preserved from install',sha(path.join(app,'src/game-engine.mjs'))===manifest.engineHashBefore);
  pass('app-server preserved from install',sha(path.join(app,'app-server.mjs'))===manifest.appServerHashBefore);
  pass('index preserved from install',sha(path.join(app,'index.html'))===manifest.indexHashBefore);
}
console.log(`PEPE GAME V5.9 VERIFY: PASS (${checks} checks)`);
