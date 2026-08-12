import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v7.2-clean-final');
const expected={"game.html": "279e2be99aee05343bf0a043a92d59a807bcf8da76c8960f3216dd3b45fca936", "game.css": "979a1be421379aa9b1db676d3a6ca4cc997908c02f6331e708bef710720df54f", "game.js": "d9ad38b1f93044a5988c57f909a9f86abb83a04c943d7e547f81219709472cc8"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let n=0;
const pass=(name,ok)=>{if(!ok)throw new Error('FAIL '+name);n++;console.log('PASS',name)};

for(const [f,h] of Object.entries(expected))
  pass('clean hash '+f,fs.existsSync(path.join(app,f))&&sha(path.join(app,f))===h);

const html=fs.readFileSync(path.join(app,'game.html'),'utf8');
const css=fs.readFileSync(path.join(app,'game.css'),'utf8');
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');

pass('clean cache bust',html.includes('/game.css?v=72clean1')&&html.includes('/game.js?v=72clean1'));
pass('obsolete focusMode removed',!js.includes('focusMode')&&!js.includes('dataset.focus'));
pass('obsolete data-focus CSS removed',!css.includes('data-focus='));
pass('obsolete data-focus HTML removed',!html.includes('data-focus='));
pass('old V6/V7.0 CSS labels removed',!/\/\*\s*(?:V6\.|V7\.0)/.test(css));
pass('CSS braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
pass('JS syntax',spawnSync(process.execPath,['--check',path.join(app,'game.js')]).status===0);
pass('runtime smoke',spawnSync(process.execPath,[path.join(pkg,'runtime-smoke-v72-clean.cjs'),app],{stdio:'inherit'}).status===0);

pass('protected engine exists',fs.existsSync(path.join(app,'src','game-engine.mjs')));
pass('protected app-server exists',fs.existsSync(path.join(app,'app-server.mjs')));
pass('protected index exists',fs.existsSync(path.join(app,'index.html')));
pass('rocket asset exists',fs.existsSync(path.join(app,'game-assets','pepe-rocket.svg')));
pass('clean payload only',fs.readdirSync(path.join(pkg,'payload')).sort().join(',')==='game.css,game.html,game.js');

console.log(`PEPE GAME V7.2 CLEAN VERIFY: PASS (${n} checks)`);
