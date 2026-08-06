import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const app = path.join(cwd, 'app-server.mjs');
const store = path.join(cwd, 'src', 'store.mjs');
const index = path.join(cwd, 'index.html');
const engineSource = path.join(cwd, 'paper-automate-patch', 'src', 'paper-engine.mjs');
const uiSource = path.join(cwd, 'paper-automate-patch', 'paper-automation-ui.js');
const cssSource = path.join(cwd, 'paper-automate-patch', 'paper-automation-ui.css');

const fail = message => { console.error(`INSTALL ABORTED: ${message}`); process.exit(1); };
for (const file of [app, store, index, engineSource, uiSource, cssSource]) if (!fs.existsSync(file)) fail(`Missing ${file}`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(cwd, `backup-before-paper-automate-${stamp}`);
fs.mkdirSync(path.join(backupDir, 'src'), { recursive: true });
fs.copyFileSync(app, path.join(backupDir, 'app-server.mjs'));
fs.copyFileSync(store, path.join(backupDir, 'src', 'store.mjs'));
fs.copyFileSync(index, path.join(backupDir, 'index.html'));

let server = fs.readFileSync(app, 'utf8');
let storeText = fs.readFileSync(store, 'utf8');
let html = fs.readFileSync(index, 'utf8');

const importNeedle = "import {evaluate} from './src/evaluate.mjs';";
if (!server.includes(importNeedle) && !server.includes("paper-engine.mjs")) fail('Expected evaluate import was not found in app-server.mjs');
if (!server.includes("paper-engine.mjs")) server = server.replace(importNeedle, `${importNeedle}import {PaperEngine} from './src/paper-engine.mjs';`);

const storeNeedle = "const billing=new StripeBilling";
if (!server.includes("const paper=new PaperEngine(store);")) {
  if (!server.includes(storeNeedle)) fail('Expected billing initialization was not found');
  server = server.replace(storeNeedle, "const paper=new PaperEngine(store);\nconst billing=new StripeBilling");
}

const evalRegex = /function evaluateAll\(token\)\{for\(const uid of Object\.keys\(store\.state\.users\)\)\{const d=evaluate\(token,store\.settings\(uid\)\);store\.setDecision\(uid,token\.mint,\{\.\.\.d,primaryReason:d\.primaryReason\}\)\}\}/;
if (!server.includes("paper.onDecision(uid,token")) {
  if (!evalRegex.test(server)) fail('evaluateAll structure changed; no files were overwritten');
  server = server.replace(evalRegex, "function evaluateAll(token){for(const uid of Object.keys(store.state.users)){const d=evaluate(token,store.settings(uid));const saved={...d,primaryReason:d.primaryReason,updatedAt:Date.now()};store.setDecision(uid,token.mint,saved);paper.onDecision(uid,token,saved,store.settings(uid))}}");
}

const publishNeedle = "function publish(mint){const rows=store.tokens();const t=store.state.tokens[mint];";
if (!server.includes("paper.onTokenUpdate(mint,t);")) {
  if (!server.includes(publishNeedle)) fail('publish() structure changed; no files were overwritten');
  server = server.replace(publishNeedle, "function publish(mint){const rows=store.tokens();const t=store.state.tokens[mint];paper.onTokenUpdate(mint,t);");
}

const routeMarker = "if(url.pathname==='/api/discovery/status')";
if (!server.includes("'/api/paper/positions'")) {
  if (!server.includes(routeMarker)) fail('API route marker was not found; no files were overwritten');
  const routes = `
 if(url.pathname==='/api/paper/positions'&&req.method==='GET')return json(res,200,{positions:paper.userPositions(u.id)});
 if(url.pathname==='/api/paper/trades'&&req.method==='GET')return json(res,200,{trades:paper.userTrades(u.id)});
 if(url.pathname==='/api/paper/proposals'&&req.method==='GET')return json(res,200,{proposals:paper.userProposals(u.id)});
 if(url.pathname==='/api/paper/status'&&req.method==='GET')return json(res,200,paper.status(u.id));
 {const m=url.pathname.match(/^\\/api\\/paper\\/proposals\\/([^/]+)\\/(approve|reject)$/);if(m&&req.method==='POST'){const result=m[2]==='approve'?paper.approveProposal(u.id,decodeURIComponent(m[1])):paper.rejectProposal(u.id,decodeURIComponent(m[1]));return json(res,result.ok?200:(result.code==='NOT_FOUND'?404:409),result)}}
 {const m=url.pathname.match(/^\\/api\\/paper\\/positions\\/([^/]+)\\/close$/);if(m&&req.method==='POST'){const result=paper.closePosition(u.id,decodeURIComponent(m[1]));return json(res,result.ok?200:(result.code==='NOT_FOUND'?404:409),result)}}
 `;
  server = server.replace(routeMarker, routes + routeMarker);
}

if (!storeText.includes("paperPositions")) {
  const stateNeedle = "this.state={users:{},tokens:{},decisions:{},positions:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0}}";
  if (!storeText.includes(stateNeedle)) fail('JsonStore initial state structure changed; no files were overwritten');
  storeText = storeText.replace(stateNeedle, "this.state={users:{},tokens:{},decisions:{},positions:{},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0}}");
}

if (!storeText.includes("tradingEnvironment:'paper'")) {
  storeText = storeText.replace("return {operatingMode:'observe',", "return {tradingEnvironment:'paper',operatingMode:'observe',");
}

const settingsPut = "if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);return json(res,200,{settings:store.setSettings(u.id,b.settings||{}),version:Date.now()})}";
if (server.includes(settingsPut)) {
  server = server.replace(settingsPut, `if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const incoming=b.settings||{};const mode=String(incoming.operatingMode||'observe').toLowerCase();const environment=String(incoming.tradingEnvironment||'paper').toLowerCase();if(!['observe','assist','automate'].includes(mode))return json(res,400,{error:'INVALID_OPERATING_MODE'});if(!['paper','live'].includes(environment))return json(res,400,{error:'INVALID_TRADING_ENVIRONMENT'});if(environment==='live'&&!hasLiveEntitlement(u))return json(res,403,{error:'PRO_REQUIRED',price:49.99});incoming.operatingMode=mode;incoming.tradingEnvironment=environment;return json(res,200,{settings:store.setSettings(u.id,incoming),version:Date.now()})}`);
}

fs.copyFileSync(engineSource, path.join(cwd, 'src', 'paper-engine.mjs'));
fs.copyFileSync(uiSource, path.join(cwd, 'paper-automation-ui.js'));
fs.copyFileSync(cssSource, path.join(cwd, 'paper-automation-ui.css'));

html = html
  .replace(/\n?<link[^>]+data-mf-paper-automation[^>]*>\n?/g, '\n')
  .replace(/\n?<script[^>]+data-mf-paper-automation[^>]*><\/script>\n?/g, '\n');
html = html.replace('</head>', '<link rel="stylesheet" href="./paper-automation-ui.css?v=1" data-mf-paper-automation="true">\n</head>');
html = html.replace('</body>', '<script src="./paper-automation-ui.js?v=1" defer data-mf-paper-automation="true"></script>\n</body>');

fs.writeFileSync(app, server);
fs.writeFileSync(store, storeText);
fs.writeFileSync(index, html);

console.log('PAPER Automate patch installed.');
console.log(`Backup created: ${backupDir}`);
console.log('Run: node paper-automate-patch/self-test.mjs');
console.log('Then restart the existing Replit workflow with Stop → Run.');
