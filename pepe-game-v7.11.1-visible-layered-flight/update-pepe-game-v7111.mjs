import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v7.11.1-visible-layered-flight'),backup=path.join(pkg,'backup-current');
const allowed={"game.html": ["ecfbfe1095555b5958cbd060536250dce0ac27a50788404722d9c899c1feae8f", "559a5f2ce3cb25583a1f19a97cd728a6ce1f5660498e774b1c6729691dd20076"], "game.css": ["b149c818e5aa2233c59c14f0c01179e5a86cd26faf07534fe053b54813404420", "a921cea8b027d50768157f8ab758778187f5646415e60f3c4c9e51e78b4b4561"], "game.js": ["04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509", "821c2051d212ee70e1c99ec8574b066485a4f82c33e83ee6e0b2c1b0283cedd9"]},next={"game.html": "d338d48ddb62d030ae5038c813529dafd695b72980898398912eb260e9c9e053", "game.css": "f0228a1c9dc2102dc9c0dd3681da1d3eaeb6d4eff5e9983f4b3a1b51d74f9396", "game.js": "821c2051d212ee70e1c99ec8574b066485a4f82c33e83ee6e0b2c1b0283cedd9", "game-scene.js": "6ee9f0ce6ef5e06333ec85dc4b809892737f697f2b6ed566006df2ec93c3cac2"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of ['game.html','game.css','game.js']){
  const p=path.join(app,f);if(!fs.existsSync(p))throw new Error('Missing '+p);
  const h=sha(p);if(!allowed[f].includes(h)&&h!==next[f])throw new Error('REFUSING '+f+': current file is not exact V7.10/V7.11/V7.11.1');
}
fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css','game.js']){
  const p=path.join(app,f),b=path.join(backup,f),h=sha(p);
  if(!fs.existsSync(b)&&h!==next[f])fs.copyFileSync(p,b);
  if(h!==next[f]){fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f)}else console.log('UNCHANGED',f);
}
const sceneDst=path.join(app,'game-scene.js'),sceneBackup=path.join(backup,'game-scene.js');
if(fs.existsSync(sceneDst)&&!fs.existsSync(sceneBackup))fs.copyFileSync(sceneDst,sceneBackup);
fs.copyFileSync(path.join(pkg,'payload','game-scene.js'),sceneDst);console.log('UPDATED game-scene.js');
console.log('PEPE GAME V7.11.1 Visible Layered Flight installed. UI and trading/server logic untouched.');
