import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const VERSION='4.1.0';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app','index.html'))?path.join(root,'memeflow-app'):(fs.existsSync(path.join(root,'index.html'))?root:null);
if(!appDir)throw new Error('MEMEFLOW app not found. Run this installer from /home/runner/workspace or the memeflow-app directory.');

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
if(!fs.existsSync(indexPath)||!fs.existsSync(serverPath))throw new Error('Expected index.html and app-server.mjs in '+appDir);

const sourceDir=path.join(here,'source');
const sourceFiles=['game.html','game.css','game.js','game-engine.mjs','game-assets/pepe-rocket.svg'];
for(const rel of sourceFiles){if(!fs.existsSync(path.join(sourceDir,rel)))throw new Error('Missing V4 source file: '+rel);}

// Preflight the clean package before creating or replacing any live Game file.
for(const rel of ['game.js','game-engine.mjs'])execFileSync(process.execPath,['--check',path.join(sourceDir,rel)],{stdio:'pipe'});
const sourceHtml=fs.readFileSync(path.join(sourceDir,'game.html'),'utf8');
const sourceJs=fs.readFileSync(path.join(sourceDir,'game.js'),'utf8');
const htmlIds=[...sourceHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicateIds=[...new Set(htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i))];
if(duplicateIds.length)throw new Error('V4 preflight failed: duplicate HTML ids: '+duplicateIds.join(', '));
const htmlIdSet=new Set(htmlIds);
const jsIds=[...sourceJs.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
const missingIds=[...new Set(jsIds.filter(id=>!htmlIdSet.has(id)))];
if(missingIds.length)throw new Error('V4 preflight failed: game.js references missing HTML ids: '+missingIds.join(', '));
if(/game\.(?:css|js)\?v=[123](?:["'])/.test(sourceHtml)||/pepe-rocket\.svg\?v=[123](?:["'])/.test(sourceHtml))throw new Error('V4 preflight failed: legacy V1/V2/V3 asset reference remains in game.html.');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(appDir,'.memeflow-patches','pepe-game-v4',stamp);
fs.mkdirSync(backupDir,{recursive:true});
for(const rel of ['index.html','app-server.mjs','game.html','game.css','game.js','src/game-engine.mjs','game-assets/pepe-rocket.svg']){
  const src=path.join(appDir,rel);if(!fs.existsSync(src))continue;const dst=path.join(backupDir,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);
}

function need(haystack,needle,label){if(!haystack.includes(needle))throw new Error(`Cannot find ${label}. MEMEFLOW structure changed; nothing was written.`);}
function cleanIndex(html){
  html=html.replace(/<!--\s*MF_PEPE_ROCKET[^>]*NAV\s*-->/g,'');
  html=html.replace(/<a\b[^>]*href=["']\/game["'][^>]*>\s*Game\s*<\/a>/g,'');
  return html;
}
function cleanServer(server){
  server=server.replace(/\n?import\s*\{\s*GameEngine\s*\}\s*from\s*['"]\.\/src\/game-engine\.mjs['"];?[^\n]*\n?/g,'\n');
  server=server.replace(/\n?const\s+(?:game|pepeGame)\s*=\s*new\s+GameEngine\(store\);?[^\n]*\n?/g,'\n');
  server=server.replace(/url\.pathname==='\/game'\?'game\.html':url\.pathname\.slice\(1\)/g,"url.pathname.slice(1)");
  server=server.replace(/\(url\.pathname==='\/game'\|\|url\.pathname==='\/game\/'\)\?'game\.html':url\.pathname\.slice\(1\)/g,"url.pathname.slice(1)");
  server=server.replace(/\n\s*\/\/ MF_PEPE_ROCKET_GAME_PUBLISH_HOOK[^\n]*\n\s*try\{(?:game|pepeGame)\.onTokenUpdate\(mint,store\.state\.tokens\[mint\]\)\}catch\(_\)\{\}\s*/g,'\n');
  server=server.replace(/\n\s*\/\/ MF_PEPE_ROCKET_GAME_API_ROUTES[\s\S]*?(?=\n\s*if\(url\.pathname==='\/api\/settings'&&req\.method==='GET'\))/g,'\n');
  server=server.replace(/[ \t]*\/\/ MF_PEPE_ROCKET_GAME_ROUTE_ALIAS[^\n]*/g,'');
  return server;
}

let html=cleanIndex(fs.readFileSync(indexPath,'utf8'));
let server=cleanServer(fs.readFileSync(serverPath,'utf8'));

const desktopNeedle='<a class="active" href="#mission">Mission Control</a><a href="#workspace">Decision Studio</a><a href="#positions">Positions</a>';
need(html,desktopNeedle,'desktop navigation anchor');
html=html.replace(desktopNeedle,'<a class="active" href="#mission">Mission Control</a><a href="#workspace">Decision Studio</a><!-- MF_PEPE_ROCKET_V4_DESKTOP_NAV --><a href="/game">Game</a><a href="#positions">Positions</a>');

const mobileNeedle='<div class="grid"><button class="btn" id="openInspectorFromMore" type="button">Decision Inspector</button></div>';
need(html,mobileNeedle,'mobile More navigation anchor');
html=html.replace(mobileNeedle,'<div class="grid"><!-- MF_PEPE_ROCKET_V4_MOBILE_NAV --><a class="btn" href="/game">Game</a><button class="btn" id="openInspectorFromMore" type="button">Decision Inspector</button></div>');

const importNeedle="import {OpenAIIntelligence} from './src/openai-intelligence.mjs';import {PaperEngine} from './src/paper-engine.mjs';";
need(server,importNeedle,'PaperEngine import anchor');
server=server.replace(importNeedle,`${importNeedle}\nimport {GameEngine} from './src/game-engine.mjs'; // MF_PEPE_ROCKET_GAME_IMPORT`);

const instanceNeedle='const paper=new PaperEngine(store);';
need(server,instanceNeedle,'PaperEngine instance anchor');
server=server.replace(instanceNeedle,`${instanceNeedle}\nconst pepeGame=new GameEngine(store); // MF_PEPE_ROCKET_GAME_INSTANCE`);

const staticNeedle="const p=url.pathname==='/'?'index.html':url.pathname.slice(1);const f=path.resolve(root,p);";
need(server,staticNeedle,'static route resolver');
server=server.replace(staticNeedle,"const p=url.pathname==='/'?'index.html':(url.pathname==='/game'||url.pathname==='/game/')?'game.html':url.pathname.slice(1);const f=path.resolve(root,p); // MF_PEPE_ROCKET_GAME_ROUTE_ALIAS");

const publishRe=/function publish\(mint\)\{\n\s*\/\/ Hot path: live Pump events can call publish many times per second\./;
if(!publishRe.test(server))throw new Error('Cannot find publish(mint) hook anchor. MEMEFLOW structure changed; nothing was written.');
server=server.replace(publishRe,`function publish(mint){\n  // MF_PEPE_ROCKET_GAME_PUBLISH_HOOK: one authoritative game engine receives the same live token updates.\n  try{pepeGame.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}\n  // Hot path: live Pump events can call publish many times per second.`);

const apiAnchor=" if(url.pathname==='/api/settings'&&req.method==='GET')";
need(server,apiAnchor,'authenticated API anchor');
const routes=` // MF_PEPE_ROCKET_GAME_API_ROUTES\n if(url.pathname==='/api/game/health'&&req.method==='GET')return json(res,200,pepeGame.health());\n if(url.pathname==='/api/game/status'&&req.method==='GET')return json(res,200,pepeGame.status(u.id));\n if(url.pathname==='/api/game/start'&&req.method==='POST'){const r=pepeGame.start(u.id,await body(req));const code=r.ok?200:(r.code==='NO_CANDIDATE'||r.code==='ACTIVE_ROUND_EXISTS'||r.code==='ROUND_RESULT_PENDING'?409:400);return json(res,code,r);}\n if(url.pathname==='/api/game/cashout'&&req.method==='POST'){const r=pepeGame.cashout(u.id);return json(res,r.ok?200:409,r);}\n if(url.pathname==='/api/game/reset'&&req.method==='POST'){const r=pepeGame.reset(u.id);return json(res,r.ok?200:409,r);}\n if(url.pathname==='/api/game/history/clear'&&req.method==='POST')return json(res,200,pepeGame.clearHistory(u.id));\n if(url.pathname==='/api/game/stream'&&req.method==='GET'){\n  res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});\n  const send=(payload)=>{try{const event=String(payload?.type||'state').replace(/[^a-z0-9_-]/gi,'');res.write('event: '+event+'\\ndata: '+JSON.stringify(payload)+'\\n\\n')}catch{}};\n  const unsubscribe=pepeGame.subscribe(u.id,send);\n  send({type:'snapshot',...pepeGame.status(u.id)});\n  const heartbeat=setInterval(()=>{try{res.write(': ping\\n\\n')}catch{}},15000);heartbeat.unref?.();\n  const close=()=>{clearInterval(heartbeat);unsubscribe();};req.once('close',close);res.once('close',close);\n  return;\n }\n\n`;
server=server.replace(apiAnchor,routes+apiAnchor);

// Validate the rewritten text before touching production files.
for(const [label,content,checks] of [
  ['index.html',html,['MF_PEPE_ROCKET_V4_DESKTOP_NAV','MF_PEPE_ROCKET_V4_MOBILE_NAV']],
  ['app-server.mjs',server,['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_ROUTE_ALIAS','MF_PEPE_ROCKET_GAME_PUBLISH_HOOK','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']],
]) for(const check of checks) if(!content.includes(check)) throw new Error(`${label} rewrite validation failed: ${check}`);

// Syntax-check the fully rewritten server before touching the live app-server.mjs.
const serverCheckPath=path.join(backupDir,'.app-server-v4-preflight.mjs');
fs.writeFileSync(serverCheckPath,server,'utf8');
try{execFileSync(process.execPath,['--check',serverCheckPath],{stdio:'pipe'});}finally{try{fs.unlinkSync(serverCheckPath);}catch{}}

// Clean replacement: these are the only live Game presentation/engine files after install.
fs.writeFileSync(indexPath,html,'utf8');
fs.writeFileSync(serverPath,server,'utf8');
for(const rel of sourceFiles){
  const from=path.join(sourceDir,rel);const dest=rel==='game-engine.mjs'?path.join(appDir,'src','game-engine.mjs'):path.join(appDir,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,dest);
}

for(const marker of ['.pepe-game-installed','.pepe-game-v2-installed','.pepe-game-v3-installed','.pepe-game-v4-installed']){try{fs.unlinkSync(path.join(appDir,marker));}catch{}}
fs.writeFileSync(path.join(appDir,'.pepe-game-v4-installed'),JSON.stringify({version:VERSION,installedAt:new Date().toISOString(),mode:'clean-replacement',backupDir},null,2),'utf8');

console.log(`Pepe Rocket GAME V${VERSION} clean replacement installed into: ${appDir}`);
console.log('No V1/V2/V3 Game CSS/JS layer is loaded.');
console.log('Game route: /game');
console.log('Backup: '+backupDir);
console.log('Next: node ./verify-pepe-game-v4.mjs');
