#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename=fileURLToPath(import.meta.url);const __dirname=path.dirname(__filename);const root=process.cwd();
const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V36: index.html not found.');process.exit(1)}
const appDir=path.dirname(target);const backup=target+'.pre-ai-sparkles-v36.bak';if(!fs.existsSync(backup))fs.copyFileSync(target,backup);
let html=fs.readFileSync(target,'utf8');
if(!/class=["'][^"']*mobile-nav/i.test(html)){console.error('V36: .mobile-nav not found. No changes made.');process.exit(1)}
html=html.replace(/\s*<script\b[^>]*src=["']\.\/ai-sparkles-icon-v36\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,'\n');
const tag='<script src="./ai-sparkles-icon-v36.js?v=36.0.0" defer></script>';
if(!/<\/body>/i.test(html)){console.error('V36: </body> not found. No changes made.');process.exit(1)}
html=html.replace(/<\/body>/i,`${tag}\n</body>`);fs.writeFileSync(target,html,'utf8');
fs.copyFileSync(path.join(__dirname,'ai-sparkles-icon-v36.js'),path.join(appDir,'ai-sparkles-icon-v36.js'));
const out=fs.readFileSync(target,'utf8');const checks=[['mobile nav preserved',/class=["'][^"']*mobile-nav/i.test(out)],['V36 tag exactly once',(out.match(/ai-sparkles-icon-v36\.js\?v=36\.0\.0/g)||[]).length===1],['runtime exists',fs.existsSync(path.join(appDir,'ai-sparkles-icon-v36.js'))]];
console.log('=== MEMEFLOW V36 INSTALL CHECK ===');for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);const f=checks.filter(([,o])=>!o);if(f.length){fs.copyFileSync(backup,target);console.error('V36 failed; backup restored.');process.exit(1)}console.log('V36 INSTALL OK: 3/3');console.log('AI center icon upgraded to a 3-sparkle SVG. Click behavior untouched.');
