import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v8.1');
const expected={"game.html": "d11dca1ccf40b5b0d93988cf215d2e5bfdf046144572ba17cb25d40dc053c9a4", "game.css": "e609a0a0c5278030d35a9ade8339ca3b62dab11d03dd13ee4481b92927fbcd7b"}, baseline={"game.html": "93f007b6cadc87338f17fd9b2d33ebc00925ab31b203706d21f440bba524610d", "game.css": "44f2362784ab40ea65ec33829a6851cc23d459e70a3173942e2634ca88c0e096", "game.js": "303a31dd3084d65ce375f85f0cc50555ceeab0d12196100dd1381fcede225575"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');let n=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);n++;console.log('PASS',name)};

for(const [f,h] of Object.entries(expected))pass('V8.1 hash '+f,fs.existsSync(path.join(app,f))&&sha(path.join(app,f))===h);
pass('game.js unchanged from V8.0',sha(path.join(app,'game.js'))===baseline['game.js']);

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
pass('V8.1 cache bust',html.includes('/game.css?v=81')&&html.includes('/game.js?v=81'));
pass('rocket absolute positioning',css.includes('.rocket{position:absolute;left:50%'));
pass('desktop viewport cockpit',css.includes('height:calc(100svh - 124px)'));
pass('history internal scrolling',css.includes('overflow:auto;overscroll-behavior:contain'));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('no literal escaped newline bug',!css.includes('\\n'));
pass('game.js syntax',spawnSync(process.execPath,['--check',path.join(app,'game.js')]).status===0);
pass('protected src/game-engine.mjs exists',fs.existsSync(path.join(app,'src','game-engine.mjs')));
pass('protected app-server.mjs exists',fs.existsSync(path.join(app,'app-server.mjs')));
pass('protected index.html exists',fs.existsSync(path.join(app,'index.html')));
pass('payload visual/layout files only',fs.readdirSync(path.join(pkg,'payload')).sort().join(',')==='game.css,game.html');
console.log(`PEPE GAME V8.1 VERIFY: PASS (${n} checks)`);
