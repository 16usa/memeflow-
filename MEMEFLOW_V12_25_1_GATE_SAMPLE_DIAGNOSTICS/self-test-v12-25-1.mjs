import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const APP = path.resolve(process.env.HOME || '/home/runner', 'workspace/memeflow-app/app-server.mjs');
const s = fs.readFileSync(APP,'utf8');
let fails=0;
function check(name, ok){ console.log((ok?'PASS: ':'FAIL: ')+name); if(!ok)fails++; }

check('V12.25.1 marker', s.includes("version:'V12.25.1'"));
check('diagnostic augmenter', s.includes('gateSampleDiagnostics:sample.map'));
check('holders gate', s.includes("failed.push('MIN_HOLDERS')"));
check('Top10 gate', s.includes("failed.push('MAX_TOP10')"));
check('developer gate', s.includes("failed.push('MAX_DEVELOPER')"));
check('buy pressure gate', s.includes("failed.push('MIN_BUY_PRESSURE')"));
check('decisionReason output', s.includes('decisionReason:decision?.primaryReason'));
check('explicit no trading logic change', s.includes('tradingLogicChanged:false'));
check('V12.24 preserved', s.includes("version:'V12.24'"));
check('V12.23 preserved', s.includes("version:'V12.23'"));
check('V12.22 preserved', s.includes("version:'V12.22'") || s.includes("liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null"));

const nc = spawnSync(process.execPath,['--check',APP],{encoding:'utf8'});
check('node --check app-server', nc.status===0);
if(nc.status!==0) console.log(nc.stderr||nc.stdout);

if(fails){ console.error(`FAIL: ${fails} self-test(s)`); process.exit(1); }
console.log('PASS: all V12.25.1 self-tests');
