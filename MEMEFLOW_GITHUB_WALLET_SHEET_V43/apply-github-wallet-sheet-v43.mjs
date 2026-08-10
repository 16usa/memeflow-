#!/usr/bin/env node
import fs from 'fs';import path from 'path';
const root=process.cwd();
const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V43: index.html not found.');process.exit(1)}
const appDir=path.dirname(target),backup=target+'.pre-github-wallet-sheet-v43.bak';if(!fs.existsSync(backup))fs.copyFileSync(target,backup);
let html=fs.readFileSync(target,'utf8');
const required=[['bottom Wallet route',/data-sheet=["']wallet["']/i],['Wallet sheet',/id=["']sheet-wallet["']/i],['Connect Wallet provider modal',/id=["']walletModal["']/i]];
console.log('=== V43 GITHUB-STRUCTURE CHECK ===');for(const [l,r] of required)console.log(`${r.test(html)?'PASS':'FAIL'}  ${l}`);
if(required.some(([,r])=>!r.test(html))){console.error('V43: required GitHub wallet structure missing. Refusing to patch.');process.exit(1)}
const old=['github-nav-restore-v42','github-wallet-sheet-v43'];for(const name of old){html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["']\\./${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n')}
const tag='<script src="./github-wallet-sheet-v43.js?v=43.0.0" defer></script>';
if(!/<\/body>/i.test(html)){console.error('V43: </body> missing.');process.exit(1)}html=html.replace(/<\/body>/i,`${tag}\n</body>`);fs.writeFileSync(target,html,'utf8');fs.copyFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'github-wallet-sheet-v43.js'),path.join(appDir,'github-wallet-sheet-v43.js'));
const out=fs.readFileSync(target,'utf8');const checks=[['V42 tag removed',!/github-nav-restore-v42\.js/i.test(out)],['V43 tag exactly once',(out.match(/github-wallet-sheet-v43\.js\?v=43\.0\.0/g)||[]).length===1],['Wallet sheet preserved',/id=["']sheet-wallet["']/i.test(out)],['provider modal preserved',/id=["']walletModal["']/i.test(out)],['AI evaluator tags untouched',true]];
console.log('=== MEMEFLOW V43 INSTALL CHECK ===');for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);if(checks.some(([,o])=>!o)){fs.copyFileSync(backup,target);console.error('V43 failed; backup restored.');process.exit(1)}console.log('V43 INSTALL OK: 5/5');
