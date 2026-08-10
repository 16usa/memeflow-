import fs from 'node:fs';import path from 'node:path';
const target=process.argv[2]?path.resolve(process.argv[2]):(fs.existsSync(path.resolve('memeflow-app/index.html'))?path.resolve('memeflow-app/index.html'):path.resolve('index.html'));
let s=fs.readFileSync(target,'utf8');
s=s.replace(/<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_END -->/g,'').replace(/<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_END -->/g,'');
fs.writeFileSync(target,s,'utf8');console.log('V10 style/script removed. Restore the .before-primary-identity-stable-v10.bak file for full markup rollback.');
