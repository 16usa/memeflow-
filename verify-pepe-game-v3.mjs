import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const app=[cwd,path.join(cwd,'memeflow-app')].find((d)=>fs.existsSync(path.join(d,'app-server.mjs'))&&fs.existsSync(path.join(d,'index.html')));
if(!app){console.error('FAIL: memeflow-app not found');process.exit(1);}
const must=['game.html','game.css','game.js','src/game-engine.mjs','game-assets/pepe-rocket.svg'];
let failed=false;
for(const rel of must){const ok=fs.existsSync(path.join(app,rel));console.log(`${ok?'PASS':'FAIL'} file ${rel}`);if(!ok)failed=true;}
for(const rel of ['game.js','src/game-engine.mjs','app-server.mjs']){const p=path.join(app,rel);if(!fs.existsSync(p))continue;const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});const ok=r.status===0;console.log(`${ok?'PASS':'FAIL'} syntax ${rel}`);if(!ok){failed=true;console.log((r.stderr||r.stdout||'').trim());}}
const server=fs.readFileSync(path.join(app,'app-server.mjs'),'utf8');
const index=fs.readFileSync(path.join(app,'index.html'),'utf8');
const engine=fs.existsSync(path.join(app,'src/game-engine.mjs'))?fs.readFileSync(path.join(app,'src/game-engine.mjs'),'utf8'):'';
for(const marker of ['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_ROUTE_ALIAS','MF_PEPE_ROCKET_GAME_PUBLISH_HOOK','MF_PEPE_ROCKET_GAME_API_ROUTES']){const count=server.split(marker).length-1;const ok=count===1;console.log(`${ok?'PASS':'FAIL'} ${marker} count=${count}`);if(!ok)failed=true;}
const desktopCount=index.split('MF_PEPE_ROCKET_DESKTOP_NAV').length-1;console.log(`${desktopCount===1?'PASS':'FAIL'} desktop Game nav count=${desktopCount}`);if(desktopCount!==1)failed=true;
const versionOk=engine.includes("GAME_VERSION = '3.0.0'");console.log(`${versionOk?'PASS':'FAIL'} Game Engine version 3.0.0`);if(!versionOk)failed=true;
const paperOnly=!fs.readFileSync(path.join(app,'game.js'),'utf8').includes('/api/live/execute')&&!engine.includes('executeTrade');console.log(`${paperOnly?'PASS':'FAIL'} PAPER-only frontend/engine`);if(!paperOnly)failed=true;
console.log(failed?'\nPEPE GAME V3 VERIFY: FAIL':'\nPEPE GAME V3 VERIFY: PASS');
process.exit(failed?1:0);
