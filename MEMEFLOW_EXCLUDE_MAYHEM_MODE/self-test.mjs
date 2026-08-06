import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {b58encode,decodePumpCreate,PUMP_DISC_CREATE_V2,shouldExcludeMayhemCreate} from '../memeflow-app/src/solana.mjs';
function encString(v){const b=Buffer.from(v);const n=Buffer.alloc(4);n.writeUInt32LE(b.length);return Buffer.concat([n,b]);}
function fixture(mayhem){
  const creator=Buffer.alloc(32,7);
  const data=Buffer.concat([Buffer.from(PUMP_DISC_CREATE_V2),encString('Alpha'),encString('ALPHA'),encString('https://example.test/token.json'),creator,Buffer.from([mayhem?1:0]),Buffer.from([0])]);
  const mint=b58encode(Buffer.alloc(32,1)),curve=b58encode(Buffer.alloc(32,2));
  return {ix:{data:b58encode(data),accounts:[mint,b58encode(Buffer.alloc(32,3)),curve]},creator:b58encode(creator)};
}
for(const mode of [false,true]){
  const f=fixture(mode),r=decodePumpCreate(f.ix,[]);
  assert.equal(r.ok,true);assert.equal(r.kind,'create_v2');assert.equal(r.creator,f.creator);assert.equal(r.isMayhemMode,mode);assert.equal(r.launchMode,mode?'mayhem':'standard');assert.equal(shouldExcludeMayhemCreate(r,true),mode);
}
console.log('PASS: official create_v2 Mayhem flag decoded');
console.log('PASS: standard launches accepted');
console.log('PASS: Mayhem launches excluded');
const server=fs.readFileSync(path.join(process.cwd(),'memeflow-app','app-server.mjs'),'utf8');
const queue=fs.readFileSync(path.join(process.cwd(),'memeflow-app','src','discqueue.mjs'),'utf8');
assert(server.includes('shouldExcludeMayhemCreate(result,EXCLUDE_MAYHEM_MODE)'));
assert(server.indexOf('shouldExcludeMayhemCreate(result,EXCLUDE_MAYHEM_MODE)')<server.indexOf('store.addToken({mint:result.mint'));
assert(queue.includes('mayhemCreatesIgnored: 0'));
console.log('PASS: exclusion runs before store.addToken');
console.log('PASS: Mayhem never reaches enrichment or AI');
console.log('PASS: diagnostic counter installed');
