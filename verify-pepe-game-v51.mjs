import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app','index.html'))?path.join(root,'memeflow-app'):(fs.existsSync(path.join(root,'index.html'))?root:null);
if(!appDir)throw new Error('MEMEFLOW app not found. Run from /home/runner/workspace or memeflow-app.');
const fail=[];const pass=[];
const ok=(name,condition)=>{(condition?pass:fail).push(name);};
const read=p=>fs.readFileSync(p,'utf8');
const count=(s,re)=>(s.match(re)||[]).length;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const installed={
  'game.html':path.join(appDir,'game.html'),
  'game.css':path.join(appDir,'game.css'),
  'game.js':path.join(appDir,'game.js'),
  'src/game-engine.mjs':path.join(appDir,'src','game-engine.mjs'),
  'game-assets/pepe-rocket.svg':path.join(appDir,'game-assets','pepe-rocket.svg'),
};
const sourceRel={'game.html':'game.html','game.css':'game.css','game.js':'game.js','src/game-engine.mjs':'game-engine.mjs','game-assets/pepe-rocket.svg':'game-assets/pepe-rocket.svg'};
for(const [rel,p] of Object.entries(installed))ok(`${rel} exists`,fs.existsSync(p));
for(const [rel,p] of Object.entries(installed)){
  const source=path.join(here,'source',sourceRel[rel]);
  ok(`${rel} clean source match`,fs.existsSync(source)&&fs.existsSync(p)&&sha(source)===sha(p));
}

const index=read(path.join(appDir,'index.html'));const server=read(path.join(appDir,'app-server.mjs'));const gameJs=read(installed['game.js']);const gameHtml=read(installed['game.html']);const gameCss=read(installed['game.css']);const engine=read(installed['src/game-engine.mjs']);
ok('exactly two Game navigation links',count(index,/href=["']\/game["']/g)===2);
ok('desktop V5.1 nav marker once',count(index,/MF_PEPE_ROCKET_V51_DESKTOP_NAV/g)===1);
ok('mobile V5.1 nav marker once',count(index,/MF_PEPE_ROCKET_V51_MOBILE_NAV/g)===1);
ok('legacy Game nav markers removed',!/(MF_PEPE_ROCKET_(?:V(?:[1-5])_)?(?:DESKTOP|MOBILE)_NAV)/.test(index));
ok('GameEngine import once',count(server,/import\s*\{\s*GameEngine\s*\}\s*from\s*['"]\.\/src\/game-engine\.mjs['"]/g)===1);
ok('pepeGame instance once',count(server,/const\s+pepeGame\s*=\s*new\s+GameEngine\(store\)/g)===1);
ok('legacy game instance removed',count(server,/const\s+game\s*=\s*new\s+GameEngine\(store\)/g)===0);
ok('/game route alias once',count(server,/MF_PEPE_ROCKET_GAME_ROUTE_ALIAS/g)===1);
ok('publish hook once',count(server,/MF_PEPE_ROCKET_GAME_PUBLISH_HOOK/g)===1);
ok('API block once',count(server,/MF_PEPE_ROCKET_GAME_API_ROUTES/g)===1);
ok('game SSE route once',count(server,/url\.pathname==='\/api\/game\/stream'/g)===1);
ok('game health route once',count(server,/url\.pathname==='\/api\/game\/health'/g)===1);
ok('SSE buffering disabled',server.includes("'x-accel-buffering':'no'"));
ok('SSE retry configured',server.includes("res.write('retry: 2500\\n\\n')"));
ok('V5 client uses game SSE',gameJs.includes("new EventSource('/api/game/stream'"));
ok('legacy chart SSE absent from Game client',!gameJs.includes('/api/chart/stream'));
ok('single V5.1 CSS asset loaded',count(gameHtml,/game\.css\?v=51/g)===1);
ok('single V5.1 JS asset loaded',count(gameHtml,/game\.js\?v=51/g)===1);
ok('single V5.1 rocket asset loaded',count(gameHtml,/pepe-rocket\.svg\?v=51/g)===1);
ok('legacy V1-V5 Game assets absent',!/game\.(?:css|js)\?v=[1-5](?:[\"'])/.test(gameHtml)&&!/pepe-rocket\.svg\?v=[1-5](?:[\"'])/.test(gameHtml));
const assetDir=path.join(appDir,'game-assets');const assetNames=fs.existsSync(assetDir)?fs.readdirSync(assetDir).sort():[];
ok('dedicated Game asset directory is clean',JSON.stringify(assetNames)===JSON.stringify(['pepe-rocket.svg']));
const htmlIds=[...gameHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);const duplicateIds=[...new Set(htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i))];
ok('Game HTML ids unique',duplicateIds.length===0);
const htmlIdSet=new Set(htmlIds);const jsIds=[...gameJs.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
ok('Game JS DOM references resolve',jsIds.every(id=>htmlIdSet.has(id)));
let depth=0,minDepth=0;for(const ch of gameCss){if(ch==='{')depth++;else if(ch==='}')depth--;minDepth=Math.min(minDepth,depth);}ok('Game CSS block balance',depth===0&&minDepth===0);
ok('single Game stylesheet file',!gameHtml.includes('<style')&&count(gameHtml,/rel="stylesheet"/g)===1);
ok('legacy install markers removed',fs.readdirSync(appDir).filter(x=>/^\.pepe-game(?:-v[1-5])?-installed$/.test(x)).length===0);
ok('V5.1 install marker present',fs.existsSync(path.join(appDir,'.pepe-game-v51-installed')));
ok('V5.1 engine version',engine.includes("const GAME_VERSION = '5.1.0'"));
ok('PAPER-only copy and engine',/PAPER ONLY/i.test(gameHtml)&&/paperOnly:\s*true/.test(engine));
ok('kill switch gate enabled',engine.includes("account.killSwitch === true"));
ok('fresh holder selector gate enabled',engine.includes('this.requireHolderFresh')&&engine.includes('staleHolders'));
ok('holder timestamp freshness gate enabled',engine.includes('holderMaxAgeMs')&&engine.includes('staleHolderAge')&&engine.includes('holderScannedAt'));
ok('decision/evidence coherence gate enabled',engine.includes('decisionCoherenceToleranceMs')&&engine.includes('decisionBehindPrice')&&engine.includes('decisionBehindHolder'));
ok('non-finite multiplier guard enabled',engine.includes('!Number.isFinite(rawMultiplier)'));
ok('background/offline search pause enabled',gameJs.includes('Search paused while the game is in the background')&&gameJs.includes('Search paused while the device is offline'));
ok('complete result requires Play Again',gameJs.includes("complete=game.mode==='complete'")&&gameJs.includes("if(game.mode!=='idle')return"));
ok('offline cashout lock enabled',gameJs.includes('game.session.feedFresh=false')&&gameJs.includes('game.session.canCashout=false'));
ok('holder-age telemetry enabled',gameHtml.includes('id="holderAge"')&&gameJs.includes('holderAgeAtEntryMs'));
ok('search timeout recovery enabled',gameJs.includes('Selector request timed out')&&gameJs.includes("if(status?.session?.state==='LIVE')"));
ok('cashout response reconciliation enabled',gameJs.includes('Cash out response timed out')&&gameJs.includes("const status=await api('/api/game/status')"));
ok('cross-tab reset overlay reconciliation enabled',gameJs.includes("if(!ui.result.hidden){ui.result.hidden=true;game.showingResult=null;}"));
ok('result dialog accessibility enabled',gameHtml.includes('role="dialog"')&&gameHtml.includes('aria-labelledby="resultTitle"')&&gameJs.includes('ui.playAgain.focus'));
ok('live region scope avoids multiplier spam',!gameHtml.includes('class="stage-card" aria-live')&&gameHtml.includes('class="round-state" role="status"'));
ok('future-dated quote guard enabled',engine.includes('futurePriceToleranceMs')&&engine.includes('futurePrice'));
ok('dead market refund enabled',engine.includes('MARKET_DATA_LOST_REFUND')&&engine.includes('marketLossAbortMs'));
ok('server sweeper enabled',engine.includes('startSweeper()')&&engine.includes('sweep()'));
ok('cashout idempotency enabled',engine.includes('idempotent: true'));
ok('session revision enabled',engine.includes('revision: 1')&&engine.includes('bumpSession'));
ok('state revision enabled',engine.includes('stateRevision')&&gameJs.includes('lastStateRevision'));
ok('engine epoch restart guard enabled',engine.includes('engineEpoch')&&gameJs.includes('engineEpoch'));
ok('duplicate price snapshots ignored',engine.includes('exact duplicate snapshot'));
ok('mobile wake lock enabled',gameJs.includes('navigator.wakeLock?.request'));
ok('online/offline lifecycle recovery enabled',gameJs.includes("addEventListener('online'")&&gameJs.includes("addEventListener('offline'"));
ok('void/refund result UI enabled',gameJs.includes("'VOID'")&&gameHtml.includes('resultSettlement'));
ok('flight statistics UI enabled',gameHtml.includes('FLIGHT RECORD')&&gameJs.includes('renderStats'));
ok('expanded flight stages enabled',['clouds','strato','orbit','moon','deep','hyper'].every(x=>gameJs.includes(`'${x}'`)));
ok('trigger distance telemetry enabled',gameHtml.includes('autoDistance')&&gameHtml.includes('stopDistance')&&gameJs.includes('updateTriggerDistances'));

for(const p of [installed['game.js'],installed['src/game-engine.mjs'],path.join(appDir,'app-server.mjs')]){
  try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'});pass.push(`syntax ${path.basename(p)}`);}catch(e){fail.push(`syntax ${path.basename(p)}: ${String(e.stderr||e.message).slice(0,200)}`);}
}
try{execFileSync(process.execPath,[path.join(here,'source','test-game-engine-v51.mjs')],{stdio:'pipe'});pass.push('engine behavior tests');}catch(e){fail.push('engine behavior tests: '+String(e.stderr||e.message).slice(0,260));}

for(const name of pass)console.log('PASS',name);
for(const name of fail)console.error('FAIL',name);
if(fail.length){console.error(`\nPEPE GAME V5.1 VERIFY: FAIL (${fail.length} failures, ${pass.length} passes)`);process.exit(1);}
console.log(`\nPEPE GAME V5.1 VERIFY: PASS (${pass.length} checks)`);
