import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v8.0');
const expected={"game.html": "93f007b6cadc87338f17fd9b2d33ebc00925ab31b203706d21f440bba524610d", "game.css": "44f2362784ab40ea65ec33829a6851cc23d459e70a3173942e2634ca88c0e096", "game.js": "303a31dd3084d65ce375f85f0cc50555ceeab0d12196100dd1381fcede225575"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let n=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);n++;console.log('PASS',name)};

for(const [f,h] of Object.entries(expected))pass(`V8.0 hash ${f}`,fs.existsSync(path.join(app,f))&&sha(path.join(app,f))===h);

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');

pass('V8.0 cache bust',html.includes('/game.css?v=80')&&html.includes('/game.js?v=80'));
pass('arcade stage cashout present',html.includes('id="stageCashoutBtn"'));
pass('arcade 3-column layout present',css.includes('grid-template-areas:')&&css.includes('"launch stage history"'));
pass('no visualViewport jitter code',!js.includes('visualViewport'));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('no literal escaped newline bug',!css.includes('\\n'));
pass('JS syntax',spawnSync(process.execPath,['--check',path.join(app,'game.js')]).status===0);
pass('protected src/game-engine.mjs exists',fs.existsSync(path.join(app,'src/game-engine.mjs')));
pass('protected app-server.mjs exists',fs.existsSync(path.join(app,'app-server.mjs')));
pass('protected index.html exists',fs.existsSync(path.join(app,'index.html')));
pass('protected game engine syntax',spawnSync(process.execPath,['--check',path.join(app,'src/game-engine.mjs')]).status===0);
pass('protected app-server syntax',spawnSync(process.execPath,['--check',path.join(app,'app-server.mjs')]).status===0);
pass('payload visual files only',fs.readdirSync(path.join(pkg,'payload')).sort().join(',')==='game.css,game.html,game.js');
pass('no BUY/SELL endpoint added by Game client',!/\/api\/(?:buy|sell)\b/i.test(js));
pass('no settings mutation endpoint added by Game client',!/\/api\/settings/i.test(js));

const smoke=path.join(pkg,'runtime-smoke-v80.cjs');
if(fs.existsSync(smoke))pass('runtime smoke',spawnSync(process.execPath,[smoke,app],{stdio:'inherit'}).status===0);

console.log(`PEPE GAME V8.0 VERIFY: PASS (${n} checks)`);
