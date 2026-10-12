import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {sample} from '../scripts/quantum-stage22-sqlite.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf221-'));const db=path.join(dir,'test.sqlite');
const mint='11111111111111111111111111111111';const now=Date.now();
try{
 const py=`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);c.execute('CREATE TABLE tokens (mint TEXT PRIMARY KEY, token_json TEXT)');c.execute('INSERT INTO tokens VALUES (?,?)',('${mint}',json.dumps({'priceSol':0.00001,'lastPriceAt':${now}})));c.commit();c.close()`;
 const setup=spawnSync('python3',['-c',py,db],{encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
 const r=sample({db,directory:path.join(dir,'output'),timestamp:now});assert.equal(r.rowsRead,1);assert.equal(r.eligiblePrices,1);assert.equal(r.decisionsObserved,0);assert.equal(r.quantumAuthorityVerified,false);assert.equal(r.added,1);
 const r2=sample({db,directory:path.join(dir,'output'),timestamp:now+16*60000});assert.equal(r2.eligiblePrices,0);assert.equal(r2.stale,1);
 assert.equal(fs.existsSync(path.join(dir,'output','events.jsonl')),true);
 console.log('Stage 22.1 SQLite read-only tests passed (9 assertions); no live validation.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
