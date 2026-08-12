import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));const workspace=process.cwd();let app=path.join(workspace,'memeflow-app');if(!fs.existsSync(path.join(app,'game.html')))app=workspace;
const files={html:path.join(app,'game.html'),js:path.join(app,'game.js'),css:path.join(app,'game.css'),engine:path.join(app,'src','game-engine.mjs'),server:path.join(app,'app-server.mjs'),index:path.join(app,'index.html')};
let checks=0;const pass=(name,cond)=>{if(!cond)throw new Error('VERIFY FAIL: '+name);checks++;console.log('PASS',name);};
for(const [k,f] of Object.entries(files))pass(`${k} exists`,fs.existsSync(f));
const html=fs.readFileSync(files.html,'utf8'),js=fs.readFileSync(files.js,'utf8'),css=fs.readFileSync(files.css,'utf8'),engine=fs.readFileSync(files.engine,'utf8'),server=fs.readFileSync(files.server,'utf8');
const hash=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
for(const [key,name] of [['html','game.html'],['css','game.css'],['js','game.js']])pass(`${name} matches packaged V5.6 source`,hash(files[key])===hash(path.join(here,'source',name)));

execFileSync(process.execPath,['--check',files.js],{stdio:'pipe'});pass('game.js syntax',true);
execFileSync(process.execPath,['--check',files.engine],{stdio:'pipe'});pass('game-engine syntax',true);
execFileSync(process.execPath,['--check',files.server],{stdio:'pipe'});pass('app-server syntax',true);

pass('V5.6 client version',js.includes("const CLIENT_VERSION='5.6.0';"));
pass('V5.4 server engine retained',engine.includes("const GAME_VERSION = '5.4.0';"));
pass('single V5.6 game.js script',(html.match(/<script\s+src=["']\/game\.js\?v=56["']/g)||[]).length===1&&(html.match(/\/game\.js/g)||[]).length===1);
pass('single V5.6 game.css stylesheet',(html.match(/<link\s+rel=["']stylesheet["']\s+href=["']\/game\.css\?v=56["']/g)||[]).length===1&&(html.match(/\/game\.css/g)||[]).length===1);
pass('no extra linked scripts',(html.match(/<script\s+src=/g)||[]).length===1);
pass('no extra stylesheets',(html.match(/<link\s+rel=["']stylesheet["']/g)||[]).length===1);
pass('no stacked Game patch assets',!html.match(/game-(?:v|fix|patch)\d*\.(?:css|js)/i));

pass('selector root state',html.includes('data-selector="idle"'));
pass('bank root state',html.includes('data-bank="neutral"'));
pass('target reticle UI',html.includes('id="targetReticle"')&&css.includes('.target-reticle'));
pass('selector phase UI',html.includes('id="selectorPhase"')&&css.includes('.selector-phase'));
pass('selector check chips',html.includes('class="selector-checks"')&&css.includes('.selector-checks'));
pass('search radar helper',js.includes('function updateSearchRadar()')&&js.includes("Checking current BUY READY decisions"));
pass('selector lock helper',js.includes('function lockSelector(s)')&&js.includes('Fresh coherent server entry locked at 1.00×.'));
pass('search state initialized',js.includes("setSelectorState('searching','SCAN')")&&js.includes('game.searchStartedAt=Date.now()'));
pass('selector diagnostics retained',js.includes('game.selectorDiag=d'));
pass('selector reset on cancel',js.includes("setSelectorState('idle');ui.selectorStatus.dataset.step='decision'"));
pass('selector live after launch',js.includes("setSelectorState('live','LIVE')"));
pass('selector settled after round',js.includes("setSelectorState('complete','SETTLED')"));

pass('acceleration derived from server price updates',js.includes('game.acceleration=clamp((nextV-prevV)'));
pass('visual tilt is smoothed',js.includes('game.visualTilt+= (tiltTarget-game.visualTilt)'));
pass('reversal crossing detector',js.includes('prevV>.018&&nextV<-.018'));
pass('reversal haptic is rate limited',js.includes('game.lastReversalHapticAt>2400'));
pass('reversal bank styling',css.includes('.game[data-bank="reversal"] .rocket-halo'));
pass('reduced-motion scan protection',css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('.target-reticle span{animation:none!important}'));

pass('V5.5 launch sequence preserved',js.includes("'verified','TARGET VERIFIED'")&&js.includes("'locked','ENTRY LOCKED'")&&js.includes("dataset.launch='ignition'")&&js.includes("dataset.launch='go'"));
pass('V5.5 warp tunnel preserved',css.includes('.game[data-stage="hyper"] .warp-tunnel'));
pass('V5.5 result peak capture preserved',html.includes('id="resultCapture"')&&js.includes('exit/peak*100'));
pass('V5.4 Flight Telemetry preserved',html.includes('id="flightAssist"')&&js.includes("state='REVERSAL'")&&js.includes("state='BOOST'"));
pass('V5.3 mobile focus mode preserved',css.includes('.game[data-focus="live"] .cockpit')&&js.includes("ui.game.dataset.focus=focus?'live':'normal'"));
pass('graduated danger preserved',css.includes('data-danger="medium"')&&css.includes('data-danger="high"'));

pass('server-authoritative cashout preserved',js.includes("api('/api/game/cashout'")&&engine.includes("settle(uid, 'MANUAL_CASH_OUT')"));
pass('stale cashout protection preserved',engine.includes("code: 'PRICE_STALE'"));
pass('market loss refund preserved',engine.includes('MARKET_DATA_LOST_REFUND'));
pass('auto cashout preserved',engine.includes("'AUTO_CASH_OUT'"));
pass('stop loss preserved',engine.includes("'STOP_LOSS'"));
pass('paper-only engine preserved',engine.includes('paperOnly: true')&&!engine.includes('executeTrade'));

pass('CSS balanced',(css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length);
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);pass('unique HTML ids',new Set(ids).size===ids.length);
const idSet=new Set(ids),refs=new Set([...js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]));pass('all game.js DOM ids exist',[...refs].every(id=>idSet.has(id)));
pass('GameEngine integration remains singular',(server.match(/MF_PEPE_ROCKET_GAME_IMPORT/g)||[]).length===1&&(server.match(/MF_PEPE_ROCKET_GAME_INSTANCE/g)||[]).length===1&&(server.match(/MF_PEPE_ROCKET_GAME_API_ROUTES/g)||[]).length===1);
pass('game stream remains singular',(server.match(/\/api\/game\/stream/g)||[]).length===1);
pass('no legacy chart stream in Game client',!js.includes('/api/chart/stream'));

const backupRoot=path.join(app,'.memeflow-patches','pepe-game-v56');
if(fs.existsSync(backupRoot)){
  const dirs=fs.readdirSync(backupRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  const manifestFile=dirs.map(d=>path.join(backupRoot,d,'manifest.json')).find(f=>fs.existsSync(f));
  if(manifestFile){const m=JSON.parse(fs.readFileSync(manifestFile,'utf8'));pass('V5.6 updater left engine byte-exact',m.engineUntouched===hash(files.engine));pass('V5.6 updater left app-server byte-exact',m.serverUntouched===hash(files.server));}
}

execFileSync(process.execPath,[path.join(here,'source','test-game-engine-v56.mjs'),files.engine],{stdio:'inherit'});pass('live V5.4 engine remains V5.6-compatible',true);
console.log(`PEPE GAME V5.6 VERIFY: PASS (${checks} checks)`);
