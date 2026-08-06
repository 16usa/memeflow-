import fs from 'node:fs';import path from 'node:path';
const w=process.cwd(),a=fs.existsSync(path.join(w,'memeflow-app'))?path.join(w,'memeflow-app'):w;
const files=[path.join(a,'src','solana.mjs'),path.join(a,'src','discqueue.mjs'),path.join(a,'app-server.mjs')];
for(const f of files){const b=`${f}.before-exclude-mayhem-mode`;if(!fs.existsSync(b)){console.error(`ROLLBACK ABORTED: missing ${b}`);process.exit(1)}}
for(const f of files)fs.copyFileSync(`${f}.before-exclude-mayhem-mode`,f);
console.log('Mayhem Mode exclusion rolled back.');
