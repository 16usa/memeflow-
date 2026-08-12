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
const read=(p)=>fs.readFileSync(p,'utf8');
const count=(s,re)=>(s.match(re)||[]).length;
const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const installed={
  'game.html':path.join(appDir,'game.html'),
  'game.css':path.join(appDir,'game.css'),
  'game.js':path.join(appDir,'game.js'),
  'game-engine.mjs':path.join(appDir,'src','game-engine.mjs'),
  'game-assets/pepe-rocket.svg':path.join(appDir,'game-assets','pepe-rocket.svg'),
};
for(const [rel,p] of Object.entries(installed))ok(`${rel} exists`,fs.existsSync(p));

for(const rel of Object.keys(installed)){
  const source=path.join(here,'source',rel);if(fs.existsSync(source)&&fs.existsSync(installed[rel]))ok(`${rel} clean source match`,sha(source)===sha(installed[rel]));
}

const index=read(path.join(appDir,'index.html'));const server=read(path.join(appDir,'app-server.mjs'));const gameJs=fs.existsSync(installed['game.js'])?read(installed['game.js']):'';const gameHtml=fs.existsSync(installed['game.html'])?read(installed['game.html']):'';
ok('exactly two Game navigation links',count(index,/href=["']\/game["']/g)===2);
ok('desktop V4 nav marker once',count(index,/MF_PEPE_ROCKET_V4_DESKTOP_NAV/g)===1);
ok('mobile V4 nav marker once',count(index,/MF_PEPE_ROCKET_V4_MOBILE_NAV/g)===1);
ok('legacy nav markers removed',!index.includes('MF_PEPE_ROCKET_DESKTOP_NAV')&&!index.includes('MF_PEPE_ROCKET_MOBILE_NAV'));
ok('GameEngine import once',count(server,/import\s*\{\s*GameEngine\s*\}\s*from\s*['"]\.\/src\/game-engine\.mjs['"]/g)===1);
ok('pepeGame instance once',count(server,/const\s+pepeGame\s*=\s*new\s+GameEngine\(store\)/g)===1);
ok('legacy game instance removed',count(server,/const\s+game\s*=\s*new\s+GameEngine\(store\)/g)===0);
ok('/game route alias once',count(server,/MF_PEPE_ROCKET_GAME_ROUTE_ALIAS/g)===1);
ok('publish hook once',count(server,/MF_PEPE_ROCKET_GAME_PUBLISH_HOOK/g)===1);
ok('API block once',count(server,/MF_PEPE_ROCKET_GAME_API_ROUTES/g)===1);
ok('game SSE route once',count(server,/url\.pathname==='\/api\/game\/stream'/g)===1);
ok('game health route once',count(server,/url\.pathname==='\/api\/game\/health'/g)===1);
ok('V4 client uses game SSE',gameJs.includes("new EventSource('/api/game/stream'"));
ok('legacy chart SSE removed from Game client',!gameJs.includes('/api/chart/stream'));
ok('single CSS asset loaded',count(gameHtml,/game\.css\?v=4/g)===1);
ok('single JS asset loaded',count(gameHtml,/game\.js\?v=4/g)===1);
ok('single V4 rocket asset loaded',count(gameHtml,/pepe-rocket\.svg\?v=4/g)===1);
ok('legacy V1/V2/V3 asset references removed',!/game\.(?:css|js)\?v=[123]/.test(gameHtml)&&!/pepe-rocket\.svg\?v=[123]/.test(gameHtml));
const htmlIds=[...gameHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicateIds=[...new Set(htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i))];
ok('Game HTML ids unique',duplicateIds.length===0);
const htmlIdSet=new Set(htmlIds);const jsIds=[...gameJs.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);
ok('Game JS DOM references resolve',jsIds.every(id=>htmlIdSet.has(id)));
ok('legacy install marker files removed',['.pepe-game-installed','.pepe-game-v2-installed','.pepe-game-v3-installed'].every(name=>!fs.existsSync(path.join(appDir,name))));
ok('V4 install marker present',fs.existsSync(path.join(appDir,'.pepe-game-v4-installed')));
ok('V4 engine version',read(installed['game-engine.mjs']).includes("const GAME_VERSION = '4.1.0'"));
ok('PAPER-only copy present',/PAPER ONLY/i.test(gameHtml)&&/paperOnly:\s*true/.test(read(installed['game-engine.mjs'])));

for(const p of [installed['game.js'],installed['game-engine.mjs'],path.join(appDir,'app-server.mjs')]){
  if(!fs.existsSync(p))continue;
  try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'});pass.push(`syntax ${path.basename(p)}`);}catch(e){fail.push(`syntax ${path.basename(p)}: ${String(e.stderr||e.message).slice(0,180)}`);}
}
try{execFileSync(process.execPath,[path.join(here,'source','test-game-engine-v4.mjs')],{stdio:'pipe'});pass.push('engine behavior tests');}catch(e){fail.push('engine behavior tests: '+String(e.stderr||e.message).slice(0,240));}

for(const name of pass)console.log('PASS',name);
for(const name of fail)console.error('FAIL',name);
if(fail.length){console.error(`\nPEPE GAME V4 VERIFY: FAIL (${fail.length})`);process.exit(1);}
console.log(`\nPEPE GAME V4 VERIFY: PASS (${pass.length} checks)`);
