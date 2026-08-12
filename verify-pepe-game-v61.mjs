import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const pkg=path.dirname(new URL(import.meta.url).pathname);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={"game.html": "b0b66a8d814c831c0347f865af7faa6f19319503b619eaf2b1f203652dc6ab2d", "game.css": "e171a0a9fa960797a02d0176d4c73e44f2c2d36a725b6f7e3154de345c0f622e", "game.js": "448d9e10ac24eb0745eedc81d08163d5f26dd90d49863cc054d8bea4b824ede6"};
const expectedBase={"game.html": "86af63a492d5b314747e0a21ffdca2cad8cdecd708d0d561c4db0620c3c89c0a", "game.css": "b02f1d06294f40bc402b6df0f3aa854c41d5a97cd400091826045da7a86d6b53", "game.js": "a4d94bec011dacfd54cddee47ac763110d967ee57abcc0d760c87a3b8086eb3a"};
const expectedEngine='316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e';
let checks=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);checks++;console.log('PASS',name);};
for(const f of ['game.html','game.css','game.js']) pass('hash '+f,sha(path.join(app,f))===expected[f]);
pass('site-authority engine remains expected',sha(path.join(app,'src/game-engine.mjs'))===expectedEngine);

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');

pass('single stylesheet',(html.match(/<link[^>]+stylesheet/g)||[]).length===1);
pass('single Game script',(html.match(/\/game\.js\?v=/g)||[]).length===1);
pass('V6.1 cache bust',html.includes('/game.css?v=61')&&html.includes('/game.js?v=61'));
pass('client version 6.1',js.includes("CLIENT_VERSION='6.1'"));
pass('no old V6.0 cache refs',!html.includes('/game.css?v=60')&&!html.includes('/game.js?v=60'));

pass('no settings mutation endpoint',!js.includes('/api/settings')&&!js.includes('/api/trading/settings'));
pass('no BUY endpoint',!js.includes('/api/game/buy'));
pass('no SELL endpoint',!js.includes('/api/game/sell'));
pass('no Game entry freshness filters',!js.includes('holderMaxAgeMs')&&!js.includes('decisionMaxAgeMs')&&!js.includes('selectionScorePenalty'));
pass('client never assigns feedFresh',!js.includes('game.session.feedFresh='));
pass('client never assigns canCashout',!js.includes('game.session.canCashout='));

pass('motion reset helper',js.includes('function resetMotionState(')&&js.includes("game.velocity=0")&&js.includes("ui.velocity.textContent='0.000×/s'"));
pass('new session resets visual motion',js.includes("if(game.lastSessionId!==sid){resetMotionState();"));
pass('play again resets visual motion',js.includes("game.targetMultiplier=1;game.displayMultiplier=1;resetMotionState();"));
pass('visual timers cleared',js.includes('function clearVisualTimers()')&&js.includes('clearTimeout(game.bankTimer)')&&js.includes('clearTimeout(showResult.secureTimer)')&&js.includes('clearTimeout(cashOut.pulseTimer)'));
pass('locked trigger lines use server session',js.includes("const locked=game.session&&['LIVE','COMPLETE'].includes(game.session.state)")&&js.includes('locked?game.session.autoCashout:ui.auto.value'));
pass('adaptive animation lifecycle',js.includes('function syncVisualActivity()')&&js.includes("['live','settling'].includes(game.mode)")&&js.includes('game.fx?.pause?.();stopVisualLoop();'));
pass('main visual loop can sleep at idle',js.includes("if(active||Math.abs(game.targetMultiplier-game.displayMultiplier)>.0005)startVisualLoop()"));
pass('FX loop throttled',js.includes('ts-lastFrame<32'));
pass('live reduced-motion listener',js.includes("motionQuery?.addEventListener?.('change'")&&js.includes('reducedMotion=event.matches===true'));
pass('reduced motion stops FX loop',js.includes('if(active&&!reducedMotion)'));

pass('stage transition visual',html.includes('id="stageTransition"')&&js.includes('function showStageTransition(')&&css.includes('.stage-transition.is-active'));
pass('result route visual',html.includes('id="resultRoute"')&&js.includes('function renderResultRoute(')&&css.includes('.result-route span.current'));
pass('rocket glint visual',html.includes('class="rocket-glint"')&&css.includes('.game[data-flight="boost"] .rocket-glint'));
pass('engine ring visual',html.includes('engine-ring-a')&&html.includes('engine-ring-b')&&css.includes('@keyframes engineRing'));
pass('mobile landscape polish',css.includes('@media(max-height:520px) and (orientation:landscape) and (max-width:960px)'));
pass('reduced motion covers V6.1 effects',css.includes('.stage-transition,.rocket-glint,.engine-ring{animation:none!important}'));

pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('no literal escaped newline bug',!css.includes('\\n'));

function normalizePrelude(value){return value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').trim();}
function auditCssBlocks(text,context='top',out=new Map()){
  let i=0,start=0,quote=null,comment=false;
  const len=text.length;
  while(i<len){
    if(comment){if(text[i]==='*'&&text[i+1]==='/'){comment=false;i+=2;continue;}i++;continue;}
    if(quote){if(text[i]==='\\'){i+=2;continue;}if(text[i]===quote)quote=null;i++;continue;}
    if(text[i]==='/'&&text[i+1]==='*'){comment=true;i+=2;continue;}
    if(text[i]==='"'||text[i]==="'"){quote=text[i++];continue;}
    if(text[i]!=='{'){i++;continue;}
    const prelude=normalizePrelude(text.slice(start,i));let depth=1,j=i+1,q=null,c=false;
    for(;j<len&&depth>0;j++){
      if(c){if(text[j]==='*'&&text[j+1]==='/'){c=false;j++;}continue;}
      if(q){if(text[j]==='\\'){j++;continue;}if(text[j]===q)q=null;continue;}
      if(text[j]==='/'&&text[j+1]==='*'){c=true;j++;continue;}
      if(text[j]==='"'||text[j]==="'"){q=text[j];continue;}
      if(text[j]==='{')depth++;else if(text[j]==='}')depth--;
    }
    const body=text.slice(i+1,j-1);
    if(prelude.startsWith('@')){
      if(/^@(media|supports|container|layer|keyframes|-webkit-keyframes)\b/i.test(prelude)) auditCssBlocks(body,context+'|'+prelude,out);
    }else if(prelude){
      const key=context+'|'+prelude;out.set(key,(out.get(key)||0)+1);
    }
    start=j;i=j;
  }
  return out;
}
const selectorCounts=auditCssBlocks(css);
const duplicates=[...selectorCounts.entries()].filter(([,count])=>count>1);
pass('no exact duplicate CSS selectors in same context',duplicates.length===0);

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
pass('all JS ids resolve',refs.every(id=>ids.includes(id)));

for(const f of ['game.js','src/game-engine.mjs','app-server.mjs']){
  const r=spawnSync(process.execPath,['--check',path.join(app,f)],{encoding:'utf8'});
  pass('syntax '+f,r.status===0);
}

const smoke=spawnSync(process.execPath,[path.join(pkg,'runtime-smoke-v61.cjs'),app],{encoding:'utf8',timeout:5000});
pass('runtime smoke',smoke.status===0&&smoke.stdout.includes('V6.1 runtime smoke: PASS'));

const sourceFiles=fs.readdirSync(path.join(pkg,'source')).sort();
pass('package source contains visual files only',JSON.stringify(sourceFiles)===JSON.stringify(['game.css','game.html','game.js']));
pass('no trading engine file in package',!fs.existsSync(path.join(pkg,'source','game-engine.mjs')));

const pointer=path.join(app,'.pepe-game-v61-last-backup');
pass('V6.1 backup pointer exists',fs.existsSync(pointer));
if(fs.existsSync(pointer)){
  const backup=fs.readFileSync(pointer,'utf8').trim();
  const manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
  pass('backup started from clean V6.0',Object.keys(expectedBase).every(f=>manifest.visualHashesBefore?.[f]===expectedBase[f]));
  pass('game-engine preserved from install',sha(path.join(app,'src/game-engine.mjs'))===manifest.engineHashBefore);
  pass('app-server preserved from install',sha(path.join(app,'app-server.mjs'))===manifest.appServerHashBefore);
  pass('index preserved from install',sha(path.join(app,'index.html'))===manifest.indexHashBefore);
}
console.log(`PEPE GAME V6.1 VERIFY: PASS (${checks} checks)`);
