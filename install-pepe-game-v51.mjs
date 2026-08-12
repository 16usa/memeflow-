import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const VERSION='5.1.0';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app','index.html'))?path.join(root,'memeflow-app'):(fs.existsSync(path.join(root,'index.html'))?root:null);
if(!appDir)throw new Error('MEMEFLOW app not found. Run this installer from /home/runner/workspace or the memeflow-app directory.');

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
if(!fs.existsSync(indexPath)||!fs.existsSync(serverPath))throw new Error('Expected index.html and app-server.mjs in '+appDir);

const sourceDir=path.join(here,'source');
const sourceMap={
  'game.html':'game.html',
  'game.css':'game.css',
  'game.js':'game.js',
  'src/game-engine.mjs':'game-engine.mjs',
  'game-assets/pepe-rocket.svg':'game-assets/pepe-rocket.svg',
};
for(const rel of Object.values(sourceMap))if(!fs.existsSync(path.join(sourceDir,rel)))throw new Error('Missing V5 source file: '+rel);

const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const rel of ['game.js','game-engine.mjs'])execFileSync(process.execPath,['--check',path.join(sourceDir,rel)],{stdio:'pipe'});
const sourceHtml=fs.readFileSync(path.join(sourceDir,'game.html'),'utf8');
const sourceJs=fs.readFileSync(path.join(sourceDir,'game.js'),'utf8');
const sourceCss=fs.readFileSync(path.join(sourceDir,'game.css'),'utf8');
const htmlIds=[...sourceHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicateIds=[...new Set(htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i))];
if(duplicateIds.length)throw new Error('V5.1 preflight failed: duplicate HTML ids: '+duplicateIds.join(', '));
const htmlIdSet=new Set(htmlIds);
const jsIds=[...sourceJs.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
const missingIds=[...new Set(jsIds.filter(id=>!htmlIdSet.has(id)))];
if(missingIds.length)throw new Error('V5.1 preflight failed: game.js references missing HTML ids: '+missingIds.join(', '));
if(/game\.(?:css|js)\?v=[1-5](?:["'])/.test(sourceHtml)||/pepe-rocket\.svg\?v=[1-5](?:["'])/.test(sourceHtml))throw new Error('V5.1 preflight failed: legacy Game asset reference remains in game.html.');
let cssDepth=0;for(const ch of sourceCss){if(ch==='{')cssDepth++;else if(ch==='}')cssDepth--;if(cssDepth<0)break;}if(cssDepth!==0)throw new Error('V5.1 preflight failed: game.css brace balance is invalid.');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(appDir,'.memeflow-patches','pepe-game-v51',stamp);
fs.mkdirSync(backupDir,{recursive:true});
const tracked=['index.html','app-server.mjs','game.html','game.css','game.js','src/game-engine.mjs','game-assets'];
const manifest={version:VERSION,createdAt:new Date().toISOString(),files:{}};
for(const rel of tracked){
  const src=path.join(appDir,rel);const exists=fs.existsSync(src);manifest.files[rel]={existed:exists};if(!exists)continue;
  const dst=path.join(backupDir,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});
  const stat=fs.statSync(src);if(stat.isDirectory())fs.cpSync(src,dst,{recursive:true});else fs.copyFileSync(src,dst);
}
fs.writeFileSync(path.join(backupDir,'backup-manifest.json'),JSON.stringify(manifest,null,2),'utf8');

function need(haystack,needle,label){if(!haystack.includes(needle))throw new Error(`Cannot find ${label}. MEMEFLOW structure changed; live files were not replaced.`);}
function cleanIndex(html){
  html=html.replace(/<!--\s*MF_PEPE_ROCKET(?:_V\d+)?_(?:DESKTOP|MOBILE)_NAV\s*-->/g,'');
  html=html.replace(/<a\b[^>]*href=["']\/game["'][^>]*>\s*Game\s*<\/a>/g,'');
  return html;
}
function cleanServer(server){
  server=server.replace(/\n?import\s*\{\s*GameEngine\s*\}\s*from\s*['"]\.\/src\/game-engine\.mjs['"];?[^\n]*\n?/g,'\n');
  server=server.replace(/\n?const\s+(?:game|pepeGame)\s*=\s*new\s+GameEngine\(store\);?[^\n]*\n?/g,'\n');
  server=server.replace(/\(url\.pathname==='\/game'\|\|url\.pathname==='\/game\/'\)\?'game\.html':url\.pathname\.slice\(1\)/g,"url.pathname.slice(1)");
  server=server.replace(/url\.pathname==='\/game'\?'game\.html':url\.pathname\.slice\(1\)/g,"url.pathname.slice(1)");
  server=server.replace(/\n\s*\/\/ MF_PEPE_ROCKET_GAME_PUBLISH_HOOK[^\n]*\n\s*try\{(?:game|pepeGame)\.onTokenUpdate\(mint,store\.state\.tokens\[mint\]\)\}catch\(_\)\{\}\s*/g,'\n');
  server=server.replace(/\n\s*\/\/ MF_PEPE_ROCKET_GAME_API_ROUTES[\s\S]*?(?=\n\s*if\(url\.pathname==='\/api\/settings'&&req\.method==='GET'\))/g,'\n');
  server=server.replace(/[ \t]*\/\/ MF_PEPE_ROCKET_GAME_ROUTE_ALIAS[^\n]*/g,'');
  return server;
}

let html=cleanIndex(fs.readFileSync(indexPath,'utf8'));
let server=cleanServer(fs.readFileSync(serverPath,'utf8'));

const desktopNeedle='<a class="active" href="#mission">Mission Control</a><a href="#workspace">Decision Studio</a><a href="#positions">Positions</a>';
need(html,desktopNeedle,'desktop navigation anchor');
html=html.replace(desktopNeedle,'<a class="active" href="#mission">Mission Control</a><a href="#workspace">Decision Studio</a><!-- MF_PEPE_ROCKET_V51_DESKTOP_NAV --><a href="/game">Game</a><a href="#positions">Positions</a>');

const mobileNeedle='<div class="grid"><button class="btn" id="openInspectorFromMore" type="button">Decision Inspector</button></div>';
need(html,mobileNeedle,'mobile More navigation anchor');
html=html.replace(mobileNeedle,'<div class="grid"><!-- MF_PEPE_ROCKET_V51_MOBILE_NAV --><a class="btn" href="/game">Game</a><button class="btn" id="openInspectorFromMore" type="button">Decision Inspector</button></div>');

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
if(!publishRe.test(server))throw new Error('Cannot find publish(mint) hook anchor. MEMEFLOW structure changed; live files were not replaced.');
server=server.replace(publishRe,`function publish(mint){\n  // MF_PEPE_ROCKET_GAME_PUBLISH_HOOK: one clean server-authoritative GameEngine receives the same accepted token updates.\n  try{pepeGame.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}\n  // Hot path: live Pump events can call publish many times per second.`);

const apiAnchor=" if(url.pathname==='/api/settings'&&req.method==='GET')";
need(server,apiAnchor,'authenticated API anchor');
const routes=` // MF_PEPE_ROCKET_GAME_API_ROUTES\n if(url.pathname==='/api/game/health'&&req.method==='GET')return json(res,200,pepeGame.health());\n if(url.pathname==='/api/game/status'&&req.method==='GET')return json(res,200,pepeGame.status(u.id));\n if(url.pathname==='/api/game/start'&&req.method==='POST'){const r=pepeGame.start(u.id,await body(req));const code=r.ok?200:(r.code==='KILL_SWITCH'?423:(r.code==='NO_CANDIDATE'||r.code==='ACTIVE_ROUND_EXISTS'||r.code==='ROUND_RESULT_PENDING'?409:400));return json(res,code,r);}\n if(url.pathname==='/api/game/cashout'&&req.method==='POST'){const r=pepeGame.cashout(u.id);return json(res,r.ok?200:409,r);}\n if(url.pathname==='/api/game/reset'&&req.method==='POST'){const r=pepeGame.reset(u.id);return json(res,r.ok?200:409,r);}\n if(url.pathname==='/api/game/history/clear'&&req.method==='POST')return json(res,200,pepeGame.clearHistory(u.id));\n if(url.pathname==='/api/game/stream'&&req.method==='GET'){\n  res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-store, no-transform','connection':'keep-alive','x-accel-buffering':'no'});\n  res.flushHeaders?.();\n  try{res.write('retry: 2500\\n\\n')}catch{}\n  const send=(payload)=>{try{const event=String(payload?.type||'state').replace(/[^a-z0-9_-]/gi,'');res.write('event: '+event+'\\ndata: '+JSON.stringify(payload)+'\\n\\n')}catch{}};\n  const unsubscribe=pepeGame.subscribe(u.id,send);\n  send({type:'snapshot',...pepeGame.status(u.id)});\n  const heartbeat=setInterval(()=>{try{res.write(': ping\\n\\n')}catch{}},12000);heartbeat.unref?.();\n  let closed=false;const close=()=>{if(closed)return;closed=true;clearInterval(heartbeat);unsubscribe();};req.once('close',close);req.once('aborted',close);res.once('close',close);\n  return;\n }\n\n`;
server=server.replace(apiAnchor,routes+apiAnchor);

for(const [label,content,checks] of [
  ['index.html',html,['MF_PEPE_ROCKET_V51_DESKTOP_NAV','MF_PEPE_ROCKET_V51_MOBILE_NAV']],
  ['app-server.mjs',server,['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_ROUTE_ALIAS','MF_PEPE_ROCKET_GAME_PUBLISH_HOOK','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']],
]) for(const check of checks) if(!content.includes(check))throw new Error(`${label} rewrite validation failed: ${check}`);

const stageDir=path.join(backupDir,'.stage');fs.mkdirSync(stageDir,{recursive:true});
const stagedIndex=path.join(stageDir,'index.html');const stagedServer=path.join(stageDir,'app-server.mjs');
fs.writeFileSync(stagedIndex,html,'utf8');fs.writeFileSync(stagedServer,server,'utf8');
execFileSync(process.execPath,['--check',stagedServer],{stdio:'pipe'});
for(const [destRel,srcRel] of Object.entries(sourceMap)){
  const dst=path.join(stageDir,destRel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(sourceDir,srcRel),dst);
}
execFileSync(process.execPath,['--check',path.join(stageDir,'game.js')],{stdio:'pipe'});
execFileSync(process.execPath,['--check',path.join(stageDir,'src','game-engine.mjs')],{stdio:'pipe'});

function atomicReplace(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});const tmp=to+'.pepe-v51-tmp';try{fs.unlinkSync(tmp)}catch{}fs.copyFileSync(from,tmp);fs.renameSync(tmp,to);}
// Replace dedicated Game assets as a directory so stale V1/V2/V3/V4 graphics cannot remain live.
try{fs.rmSync(path.join(appDir,'game-assets'),{recursive:true,force:true})}catch{}
fs.mkdirSync(path.join(appDir,'game-assets'),{recursive:true});
for(const rel of ['game.html','game.css','game.js','src/game-engine.mjs','game-assets/pepe-rocket.svg'])atomicReplace(path.join(stageDir,rel),path.join(appDir,rel));
// Integrate only after all Game module files are valid and present.
atomicReplace(stagedIndex,indexPath);atomicReplace(stagedServer,serverPath);

for(const name of fs.readdirSync(appDir).filter(x=>/^\.pepe-game(?:-v\d+)?-installed$/.test(x)))try{fs.unlinkSync(path.join(appDir,name))}catch{}
fs.writeFileSync(path.join(appDir,'.pepe-game-v51-installed'),JSON.stringify({version:VERSION,installedAt:new Date().toISOString(),mode:'clean-replacement',backupDir,sourceHashes:Object.fromEntries(Object.entries(sourceMap).map(([dest,src])=>[dest,sha(path.join(sourceDir,src))]))},null,2),'utf8');
try{fs.rmSync(stageDir,{recursive:true,force:true})}catch{}

console.log(`Pepe Rocket GAME V${VERSION} CLEAN replacement installed into: ${appDir}`);
console.log('One live Game CSS file. One live Game JS file. One live rocket asset. One live GameEngine.');
console.log('No V1/V2/V3/V4/V5 Game layer is loaded.');
console.log('Game route: /game');
console.log('Backup: '+backupDir);
console.log('Next: node ./verify-pepe-game-v51.mjs');
