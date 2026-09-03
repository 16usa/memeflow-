#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project=process.cwd();
const app=path.join(project,'memeflow-app');
const htmlPath=path.join(app,'agent-performance.html');
const cssPath=path.join(app,'agent-performance.css');
const jsPath=path.join(app,'agent-performance.js');
const pkgDir=path.dirname(new URL(import.meta.url).pathname);

for(const p of [htmlPath,cssPath,jsPath,path.join(pkgDir,'agent-performance.html'),path.join(pkgDir,'agent-performance.css')]){
  if(!fs.existsSync(p)){console.error(`Missing required file: ${p}`);process.exit(1)}
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(project,'.memeflow-backups',`agent-performance-compact-v2-${stamp}`);
fs.mkdirSync(backup,{recursive:true});
fs.copyFileSync(htmlPath,path.join(backup,'agent-performance.html'));
fs.copyFileSync(cssPath,path.join(backup,'agent-performance.css'));

fs.copyFileSync(path.join(pkgDir,'agent-performance.html'),htmlPath);
fs.copyFileSync(path.join(pkgDir,'agent-performance.css'),cssPath);

const html=fs.readFileSync(htmlPath,'utf8');
const js=fs.readFileSync(jsPath,'utf8');

const ids=[
  'usersValue','positionsValue','tradesValue','winRateValue','recordValue','pnlValue','pnlWindow',
  'evaluableValue','winsLegend','lossesLegend','flatLegend','avgPnlValue','holdValue','coverageValue',
  'unknownValue','updatedAt','datasetMode','outcomeDonut','winsBar','winsPct','lossesBar','lossesPct',
  'flatBar','flatPct','scoreFactors','holderFactors','top10Factors','pressureFactors','exitReasons',
  'strategySources','engineStatus','engineSub','enginePill','refreshBtn','errorBox'
];

for(const id of ids){
  if(!html.includes(`id="${id}"`)){
    fs.copyFileSync(path.join(backup,'agent-performance.html'),htmlPath);
    fs.copyFileSync(path.join(backup,'agent-performance.css'),cssPath);
    console.error(`Verification failed: missing #${id}. Originals restored.`);
    process.exit(2);
  }
}

if(!html.includes('MEMEFLOW_AGENT_PERFORMANCE_COMPACT_V2')){
  console.error('Compact V2 marker missing.');
  process.exit(3);
}

console.log('');
console.log('MEMEFLOW AGENT PERFORMANCE COMPACT V2 installed successfully.');
console.log(`Backup: ${backup}`);
console.log('Changed only:');
console.log('  memeflow-app/agent-performance.html');
console.log('  memeflow-app/agent-performance.css');
console.log('');
console.log('agent-performance.js and backend were not modified.');
console.log('The page remains compatible with the existing Light/Dark theme.');
console.log('Next: refresh the dev page and review the compact layout.');
