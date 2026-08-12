import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),payload=path.join(here,'payload'),app=path.resolve(process.cwd(),'memeflow-app');
const expected={"game.html":"5a2c52c9bec7aa38b95b2cb67243e8a221402663e5bb5254c9a6d21256171f4f","game.css":"6be28741de5a08329835163fb42508170f688fcdb81b5969327bb489c925ffec","game.js":"36e48d2ac3382bbe19fad418ebfbba88d0825258d69035040de9182a0413026f"};
const files=['game.html','game.css','game.js'];let checks=0;const pass=(n,ok)=>{if(!ok)throw new Error('FAIL '+n);checks++;console.log('PASS',n)};const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function braces(s){let d=0,q=null,c=false,e=false;for(let i=0;i<s.length;i++){const x=s[i],n=s[i+1];if(c){if(x==='*'&&n==='/'){c=false;i++;}continue}if(q){if(e){e=false;continue}if(x==='\\'){e=true;continue}if(x===q)q=null;continue}if(x==='/'&&n==='*'){c=true;i++;continue}if(x==='"'||x==="'"){q=x;continue}if(x==='{')d++;else if(x==='}'){if(--d<0)return false}}return d===0&&!q&&!c}
function duplicates(source){source=source.replace(/\/\*[\s\S]*?\*\//g,'');const out=[];function walk(start,end,ctx){const seen=new Map();let i=start;while(i<end){while(i<end&&/\s/.test(source[i]))i++;if(i>=end)break;let q=null,p=0,j=i,open=-1,semi=-1;for(;j<end;j++){const c=source[j];if(q){if(c==='\\')j++;else if(c===q)q=null;continue}if(c==='"'||c==="'"){q=c;continue}if(c==='('){p++;continue}if(c===')'){p=Math.max(0,p-1);continue}if(!p&&c==='{'){open=j;break}if(!p&&c===';'){semi=j;break}}if(semi>=0&&(open<0||semi<open)){i=semi+1;continue}if(open<0)break;const head=source.slice(i,open).trim().replace(/\s+/g,' ');let d=1,k=open+1,r=null;for(;k<end&&d>0;k++){const c=source[k];if(r){if(c==='\\')k++;else if(c===r)r=null;continue}if(c==='"'||c==="'"){r=c;continue}if(c==='{')d++;else if(c==='}')d--}const close=k-1;if(head.startsWith('@'))walk(open+1,close,ctx+' > '+head);else{const n=(seen.get(head)||0)+1;seen.set(head,n);if(n>1)out.push(ctx+' :: '+head)}i=k}}walk(0,source.length,'root');return out}
pass('namespaced V6.6 package directory',path.basename(here)==='pepe-game-v6.6');pass('payload contains visual files only',JSON.stringify(fs.readdirSync(payload).sort())===JSON.stringify([...files].sort()));
for(const f of files){pass('payload hash '+f,sha(path.join(payload,f))===expected[f]);pass('installed hash '+f,sha(path.join(app,f))===expected[f]);}
const html=fs.readFileSync(path.join(app,'game.html'),'utf8'),css=fs.readFileSync(path.join(app,'game.css'),'utf8'),js=fs.readFileSync(path.join(app,'game.js'),'utf8');
pass('V6.6 client version',js.includes("CLIENT_VERSION='6.6'"));pass('V6.6 cache bust',html.includes('/game.js?v=66')&&html.includes('/game.css?v=66'));
pass('wake lock request is serialized',js.includes('game.wakeRequestPending')&&js.includes('const seq=++game.wakeRequestSeq'));
pass('late wake lock is released',js.includes("seq!==game.wakeRequestSeq||!game.pageVisible||game.lifecyclePaused"));
pass('stream does not connect hidden/offline',js.includes("if(!game.pageVisible||game.lifecyclePaused||navigator.onLine===false)return;"));
pass('resync reconnect is lifecycle guarded',js.includes("if(connect&&game.pageVisible&&!game.lifecyclePaused&&navigator.onLine!==false)connectStream()"));
pass('search background wait is event based',js.includes('function waitForSearchResume(seq)')&&js.includes("addEventListener('online',check)"));
pass('old polling search wait removed',!js.includes('await wait(500);'));
pass('trace rejects backward server timestamps',js.includes('if(last&&serverTime<last.t)return;'));
pass('same-timestamp trace point replaces instead of appending',js.includes('if(last&&serverTime===last.t)'));
pass('result focus timeout tracked',js.includes('game.resultFocusTimer=setTimeout')&&js.includes('clearTimeout(game.resultFocusTimer)'));
pass('visual viewport height sync',js.includes("'--vvh'")&&js.includes('globalThis.visualViewport?.height'));
pass('visual viewport listeners cleaned up',js.includes("removeEventListener?.('resize',scheduleViewportHeight)"));
pass('mobile dynamic viewport CSS',css.includes('var(--vvh,100dvh)'));
pass('flight progress HTML',html.includes('id="flightProgress"')&&html.includes('data-flight-stage="hyper"'));
pass('flight progress visual JS',js.includes('function updateFlightProgress(m)')&&js.includes("node.classList.toggle('current'"));
pass('flight progress CSS',css.includes('.flight-progress{')&&css.includes('.flight-progress span.current'));
pass('orbit satellite visual',html.includes('orbit-satellite')&&css.includes('@keyframes satellitePass'));
pass('deep-space meteor visual',html.includes('meteor-shower')&&css.includes('@keyframes meteorFall'));
pass('boost lens flare visual',html.includes('lens-flare')&&css.includes('[data-flight="boost"] .lens-flare'));
pass('V6.6 milestone burst is coalesced',js.includes('const crossed=levels.filter')&&js.includes('const [level,label]=crossed.at(-1)'));
pass('hidden visibility closes Game SSE',js.includes("ui.streamState.textContent='Game stream paused in background'")&&js.includes("game.streamHealthy=false;try{game.stream?.close?.();}catch{}game.stream=null"));
pass('background search has no periodic 30s wake',!js.includes('setTimeout(finish,30000)'));
pass('trace cap preserves first observed point',js.includes("const first=game.points[0];game.points=[first,...game.points.slice(-118)]"));
pass('flight position HUD HTML',html.includes('id="flightPositionHud"')&&html.includes('id="flightPositionCurrent"')&&html.includes('id="flightPositionPeak"'));
pass('flight position HUD visual JS',js.includes("ui.flightPositionCurrent.textContent")&&js.includes("ui.flightPositionPeak.textContent"));
pass('rocket ghost visual',html.includes('class="rocket-ghost"')&&css.includes('.rocket-ghost{')&&js.includes("'--ghost-opacity'"));
pass('no client feedFresh mutation',!js.includes('session.feedFresh =')&&!js.includes('session.feedFresh='));pass('no client canCashout mutation',!js.includes('session.canCashout =')&&!js.includes('session.canCashout='));pass('no settings mutation endpoint',!js.includes('/api/settings'));pass('no BUY endpoint',!js.includes('/api/buy'));pass('no SELL endpoint',!js.includes('/api/sell'));pass('no old Game entry freshness/ranking filters',!js.includes('decisionMaxAge')&&!js.includes('holderMaxAge')&&!js.includes('coherence gate'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),refs=[...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);pass('unique HTML ids',new Set(ids).size===ids.length);pass('all JS ids resolve',refs.every(id=>ids.includes(id)));pass('CSS braces balanced',braces(css));pass('no exact duplicate CSS selectors',duplicates(css).length===0);pass('no literal escaped newline bug',!css.includes('\\n.'));pass('single Game stylesheet',([...html.matchAll(/<link\b[^>]*rel="stylesheet"/g)].length)===1);pass('single Game script',([...html.matchAll(/<script\b[^>]*src=/g)].length)===1);
execFileSync(process.execPath,['--check',path.join(app,'game.js')],{stdio:'ignore'});pass('syntax game.js',true);
pass('game engine not packaged',!fs.existsSync(path.join(payload,'game-engine.mjs')));pass('app server not packaged',!fs.existsSync(path.join(payload,'app-server.mjs')));pass('index not packaged',!fs.existsSync(path.join(payload,'index.html')));
const latest=path.join(app,'.memeflow-patches','pepe-game-v66','latest.json');pass('V6.6 protection metadata exists',fs.existsSync(latest));if(fs.existsSync(latest)){const meta=JSON.parse(fs.readFileSync(latest,'utf8'));for(const f of ['src/game-engine.mjs','app-server.mjs','index.html'])pass('protected unchanged '+f,sha(path.join(app,f))===meta.protectedBefore[f]);}
execFileSync(process.execPath,[path.join(here,'runtime-smoke-v66.cjs'),app],{stdio:'inherit'});pass('runtime smoke',true);console.log(`PEPE GAME V6.6 VERIFY: PASS (${checks} checks)`);
