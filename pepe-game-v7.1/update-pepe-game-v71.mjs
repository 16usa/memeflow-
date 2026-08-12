import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root='/home/runner/workspace', app=path.join(root,'memeflow-app'), pkg=path.join(root,'pepe-game-v7.1'), src=path.join(pkg,'payload'), backup=path.join(pkg,'backup-v70');
const expected={"game.html": "ac271703de010f0112e269f2abf1ca51bcbd5d35e6b4d75252f8605be8eb69e0", "game.css": "9ac468a5b6fbfefe2ba5cb64e640f77c74c40e9c541d2237af37132789d81743", "game.js": "116c403af94ed2f53c84bc3a85efe22a45d12f7daba61f28a4c4453a04ae3777"};
const next={"game.html": "a4587438b2cf58738fb82f9383d2f9f7171b1c858d126cc05c2bb5728fa16b76", "game.css": "11a94aed0125a5a8e7b1f38ac74eb57251c25a8887658d80bb3acad3c378245d", "game.js": "5c7e2f1f8a04b038b97e0c489f5e172124d06b21db300a5d5ee6af294b2e40e6"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of Object.keys(expected)){
  const target=path.join(app,f);
  if(!fs.existsSync(target))throw new Error(`Missing ${target}`);
  const h=sha(target);
  if(h===next[f]){console.log(`UNCHANGED ${f} already V7.1`);continue;}
  if(h!==expected[f])throw new Error(`REFUSING ${f}: current file is not exact V7.0 baseline`);
  fs.mkdirSync(backup,{recursive:true});
  const b=path.join(backup,f); if(!fs.existsSync(b))fs.copyFileSync(target,b);
  fs.copyFileSync(path.join(src,f),target); console.log(`UPDATED ${f}`);
}
console.log('PEPE GAME V7.1 installed. Trading/server files were not touched.');
