import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const p=spawnSync(process.execPath,[path.join(root,'memeflow-app/scripts/quantum-stage16-runtime-audit.mjs')],{encoding:'utf8',timeout:10000});
if(p.status!==0)throw Error(p.stderr||p.stdout||`Exit ${p.status}`);
const report=JSON.parse(p.stdout);
if(report.failed!==0||report.passed!==12||report.liveReady!==false||report.transactions!==0)throw Error('Unexpected audit result');
console.log('Stage 16 offline runtime assertions passed (12/12; NO live trading validation)');
