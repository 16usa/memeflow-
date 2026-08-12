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
for(const [key,name] of [['html','game.html'],['css','game.css'],['js','game.js']])pass(`${name} matches packaged V5.7 source`,hash(files[key])===hash(path.join(here,'source',name)));

execFileSync(process.execPath,['--check',files.js],{stdio:'pipe'});pass('game.js syntax',true);
execFileSync(process.execPath,['--check',files.engine],{stdio:'pipe'});pass('game-engine syntax',true);
execFileSync(process.execPath,['--check',files.server],{stdio:'pipe'});pass('app-server syntax',true);

pass('V5.7 client version',js.includes("const CLIENT_VERSION='5.7.0';"));
pass('V5.4 server engine retained',engine.includes("const GAME_VERSION = '5.4.0';"));
pass('single V5.7 game.js script',(html.match(/<script\s+src=["']\/game\.js\?v=57["']/g)||[]).length===1&&(html.match(/\/game\.js/g)||[]).length===1);
pass('single V5.7 game.css stylesheet',(html.match(/<link\s+rel=["']stylesheet["']\s+href=["']\/game\.css\?v=57["']/g)||[]).length===1&&(html.match(/\/game\.css/g)||[]).length===1);
pass('no extra linked scripts',(html.match(/<script\s+src=/g)||[]).length===1);
pass('no extra stylesheets',(html.match(/<link\s+rel=["']stylesheet["']/g)||[]).length===1);
pass('no stacked Game patch assets',!html.match(/game-(?:v|fix|patch)\d*\.(?:css|js)/i));

pass('flight-plan deck present',html.includes('id="riskDeck"')&&css.includes('.risk-deck'));
pass('projected payout present',html.includes('id="projectedPayout"')&&js.includes('ui.projectedPayout.textContent'));
pass('projected profit present',html.includes('id="projectedProfit"')&&js.includes('ui.projectedProfit.textContent'));
pass('projected downside present',html.includes('id="projectedLoss"')&&js.includes('ui.projectedLoss.textContent'));
pass('reward risk ratio present',html.includes('id="rewardRisk"')&&js.includes('ui.rewardRisk.textContent'));
pass('risk profile helper',js.includes('function targetProfile(auto)')&&js.includes("'moonshot','MOONSHOT'"));
pass('risk preview helper',js.includes('function updateRiskPreview()'));
pass('risk projections are clearly non-authoritative',html.includes('These numbers are projections')||js.includes('These numbers are projections'));
pass('manual mode handled',js.includes("if(!(auto>1))return['manual','MANUAL']"));
pass('stop off handled',js.includes("loss=stop>0&&stop<1?bet*(1-stop):null"));
pass('target preset controls',html.includes('id="targetPresets"')&&(html.match(/data-auto=/g)||[]).length===5);
pass('target presets disabled during active/search states',js.includes("$$('.target-presets button').forEach(b=>b.disabled=live||searching||settling)"));
pass('target preset click updates existing select',js.includes("ui.auto.value=b.dataset.auto;updateTriggerLines()"));
pass('start projected hint',html.includes('id="startHint"')&&js.includes('ui.startHint.textContent=hint'));
pass('mobile projected hint',html.includes('id="mobileStartHint"')&&js.includes('ui.mobileStartHint.textContent'));
pass('result records selected flight plan',html.includes('id="resultPlan"')&&js.includes('ui.resultPlan.textContent'));
pass('result plan uses locked server session settings',js.includes('num(s.autoCashout)')&&js.includes('num(s.stopLoss)'));

pass('V5.6 selector radar preserved',html.includes('id="targetReticle"')&&js.includes('function updateSearchRadar()'));
pass('V5.6 smooth banking preserved',js.includes('game.visualTilt+= (tiltTarget-game.visualTilt)'));
pass('V5.5 launch sequence preserved',js.includes("'verified','TARGET VERIFIED'")&&js.includes("'locked','ENTRY LOCKED'"));
pass('V5.5 warp preserved',css.includes('.game[data-stage="hyper"] .warp-tunnel'));
pass('V5.4 Flight Telemetry preserved',html.includes('id="flightAssist"')&&js.includes("state='BOOST'"));
pass('V5.3 mobile focus mode preserved',css.includes('.game[data-focus="live"] .cockpit')&&js.includes("ui.game.dataset.focus=focus?'live':'normal'"));

pass('server-authoritative start preserved',js.includes("api('/api/game/start'"));
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

const backupRoot=path.join(app,'.memeflow-patches','pepe-game-v57');
if(fs.existsSync(backupRoot)){
  const dirs=fs.readdirSync(backupRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  const manifestFile=dirs.map(d=>path.join(backupRoot,d,'manifest.json')).find(f=>fs.existsSync(f));
  if(manifestFile){const m=JSON.parse(fs.readFileSync(manifestFile,'utf8'));pass('V5.7 updater left engine byte-exact',m.engineUntouched===hash(files.engine));pass('V5.7 updater left app-server byte-exact',m.serverUntouched===hash(files.server));}
}

execFileSync(process.execPath,[path.join(here,'source','test-game-engine-v57.mjs'),files.engine],{stdio:'inherit'});pass('live V5.4 engine remains V5.7-compatible',true);
console.log(`PEPE GAME V5.7 VERIFY: PASS (${checks} checks)`);
