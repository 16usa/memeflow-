import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const payload=path.join(here,'payload');
const app=path.resolve(process.cwd(),'memeflow-app');
const expected={"game.html":"8a09f72b2d2c93abaeb00cd55b9323bfa621d7c1bdda4b43c5e3413aa1d346a8","game.css":"10c5313021dba5fb04c45dfff84a5bbbd1d1d11035ec2d876cca707fd9463362","game.js":"106bd3bb646467271fce539d6f4d18d09dc2fba33026c4ebe7cdd5f88c496837"};
const files=['game.html','game.css','game.js'];
let checks=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);checks++;console.log('PASS',name)};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function cssBracesBalanced(source){
  let depth=0,quote=null,comment=false,escape=false;
  for(let i=0;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment){if(c==='*'&&n==='/'){comment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote=null;continue;}
    if(c==='/'&&n==='*'){comment=true;i++;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'){depth--;if(depth<0)return false;}
  }
  return depth===0&&!quote&&!comment;
}

pass('namespaced V6.3 package directory',path.basename(here)==='pepe-game-v6.3');
pass('package payload contains visual files only',JSON.stringify(fs.readdirSync(payload).sort())===JSON.stringify([...files].sort()));
for(const f of files){pass('payload hash '+f,sha(path.join(payload,f))===expected[f]);pass('installed hash '+f,sha(path.join(app,f))===expected[f]);}

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');

pass('V6.3 client version',js.includes("CLIENT_VERSION='6.3'"));
pass('V6.3 cache bust',html.includes('/game.js?v=63')&&html.includes('/game.css?v=63'));
pass('fallback starts while SSE connects',js.includes("ui.streamState.textContent='Game stream connecting';startFallback();"));
pass('stale SSE packet cannot mark healthy',js.includes("if(accepted===false){game.streamHealthy=false"));
pass('apply returns stale event rejection',js.includes('eventSeq<game.lastEventSeq)return false'));
pass('hidden countdown requires visible page',js.includes("game.pageVisible&&!game.lifecyclePaused&&game.session?.id===s.id"));
pass('visibilitychange cancels countdown',js.includes("game.countdownSeq++;game.resultFxSeq++;ui.center.hidden=true"));
pass('visual milestone timer centrally cleared',js.includes('clearTimeout(showMilestone.timer);showMilestone.timer=null'));
pass('visual shockwave timer centrally cleared',js.includes('clearTimeout(pulseShockwave.timer);pulseShockwave.timer=null'));
pass('idle clock activity controller',js.includes('function syncClockActivity()'));
pass('idle boot does not force clock',!js.includes("game.fx?.pause?.();startClock();setMode('idle'"));
pass('adaptive canvas density',js.includes('const desiredCount=()=>'));
pass('result flight trace visual',html.includes('id="resultTrace"')&&html.includes('id="resultTracePath"')&&html.includes('id="resultTracePeak"')&&html.includes('id="resultTraceExit"'));
pass('result trace uses observed client points',js.includes('const pts=game.points.filter'));
pass('result trace declares reload limitation',js.includes('Live path unavailable after reload'));
pass('result trace called on result',js.includes('renderResultRoute(peak);renderResultTrace();'));
pass('no client feedFresh mutation',!js.includes('session.feedFresh =')&&!js.includes('session.feedFresh='));
pass('no client canCashout mutation',!js.includes('session.canCashout =')&&!js.includes('session.canCashout='));
pass('no Game settings mutation endpoint',!js.includes('/api/settings'));
pass('no Game BUY endpoint',!js.includes('/api/buy'));
pass('no Game SELL endpoint',!js.includes('/api/sell'));
pass('no old Game coherence entry gate',!js.includes('decisionMaxAge')&&!js.includes('holderMaxAge')&&!js.includes('coherence gate'));

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
pass('unique HTML ids',new Set(ids).size===ids.length);
const refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
pass('all JS ids resolve',refs.every(id=>ids.includes(id)));
pass('CSS braces balanced',cssBracesBalanced(css));
pass('no literal escaped newline bug',!css.includes('\\n.'));
pass('single Game stylesheet',([...html.matchAll(/<link\b[^>]*rel="stylesheet"/g)].length)===1);
pass('single Game script',([...html.matchAll(/<script\b[^>]*src=/g)].length)===1);

for(const f of ['game.js','src/game-engine.mjs','app-server.mjs']){
  execFileSync(process.execPath,['--check',path.join(app,f)],{stdio:'ignore'});
  pass('syntax '+f,true);
}

pass('protected game engine not packaged',!fs.existsSync(path.join(payload,'game-engine.mjs')));
pass('protected app server not packaged',!fs.existsSync(path.join(payload,'app-server.mjs')));
pass('protected index not packaged',!fs.existsSync(path.join(payload,'index.html')));

const latest=path.join(app,'.memeflow-patches','pepe-game-v63','latest.json');
pass('V6.3 protection metadata exists',fs.existsSync(latest));
if(fs.existsSync(latest)){
  const meta=JSON.parse(fs.readFileSync(latest,'utf8'));
  for(const f of ['src/game-engine.mjs','app-server.mjs','index.html'])pass('protected unchanged '+f,sha(path.join(app,f))===meta.protectedBefore[f]);
}

execFileSync(process.execPath,[path.join(here,'runtime-smoke-v63.cjs'),app],{stdio:'inherit'});
pass('runtime smoke',true);

console.log(`PEPE GAME V6.3 VERIFY: PASS (${checks} checks)`);
