import fs from 'node:fs';
const p='memeflow-app/index.html', b=p+'.before-primary-identity-v5.bak';
if(!fs.existsSync(b)){console.error('Backup not found: '+b);process.exit(1)}
fs.copyFileSync(b,p);console.log('Restored '+p+' from V5 backup.');
