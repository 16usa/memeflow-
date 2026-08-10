#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')]
  .find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V51 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
const frontPath=path.join(appDir,'native-ai-sheet-v51.js');
const front=fs.existsSync(frontPath)?fs.readFileSync(frontPath,'utf8'):'';

const checks=[
 ['frontend exists',fs.existsSync(frontPath)],
 ['V51 tag once',(html.match(/native-ai-sheet-v51\.js\?v=51\.0\.0/g)||[]).length===1],
 ['older active AI runtime absent',!/native-ai-sheet-v(?:47|48|49|50)\.js(?:\?[^"']*)?["']/i.test(html)],
 ['sheet is not rebuilt on open',front.includes("if(sheet.dataset.mf51Built==='1') return sheet")],
 ['persistent delegated events',front.includes("window.__MEMEFLOW_AI_V51_EVENTS__=true")],
 ['Analyze wired',front.includes("return scanToken()")],
 ['Ask wired',front.includes("return ask()")],
 ['Strategy wired',front.includes("return strategy()")],
 ['Auto AI wired',front.includes("return toggleAuto(target)")],
 ['scanner API route installed',server.includes("/api/ai/standalone-scan")],
 ['OpenAI status route installed',server.includes("/api/openai/status")],
 ['OpenAI ask route installed',server.includes("/api/openai/ask")],
 ['fetch uses include credentials',front.includes("credentials:'include'")],
 ['request timeout installed',front.includes("setTimeout(()=>controller.abort(),20000)")],
 ['compact AI status',front.includes("AI READY")&&!front.includes("display='KEY FOUND'")],
 ['mint placeholder compact',front.includes('placeholder="Mint, Pump.fun or DexScreener link"')],
 ['Ask placeholder compact',front.includes('placeholder="Ask AI about the scanned token…"')],
 ['iOS input zoom prevention',/mf51-input[\s\S]*font-size:16px!important/.test(front)],
 ['small placeholders',/mf51-input::placeholder[\s\S]*font-size:11px!important/.test(front)],
 ['frontend syntax',fs.existsSync(frontPath)&&spawnSync(process.execPath,['--check',frontPath]).status===0],
 ['server syntax',spawnSync(process.execPath,['--check',path.join(appDir,'app-server.mjs')]).status===0],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)],
 ['rollback backup complete',fs.existsSync(path.join(appDir,'.memeflow-v51-backup','index.html'))]
];

console.log('=== V51 VERIFY ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){console.error(`V51 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V51 VERIFY OK: 26/26');
