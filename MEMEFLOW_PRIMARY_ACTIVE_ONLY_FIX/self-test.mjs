import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'memeflow-app', 'index.html');
const html = fs.readFileSync(target, 'utf8');

const checks = [
  ['terminal state filter', "new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED'])"],
  ['terminal flag filter', "c.terminal!==true"],
  ['closed lifecycle filter', "c.lifecycle!=='closed'"],
  ['active-state ranking', "const rank={'BUY READY':4,'WATCH':3,'WAITING':2}"],
  ['empty chart event', "name:'',symbol:'',tokenAddress:'',mint:''"]
];

for (const [name, marker] of checks) {
  if (!html.includes(marker)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}