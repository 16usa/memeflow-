import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf222-'));
const reader=path.resolve('memeflow-app/scripts/quantum-stage22-sqlite-reader.py');
try {
 const db=path.join(dir,'test.sqlite');const now=Date.now();
 const py=`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);c.execute('CREATE TABLE tokens (mint TEXT PRIMARY KEY, ws_first INTEGER, updated_at INTEGER, token_json TEXT)');c.execute('CREATE INDEX idx_tokens_ws_hot ON tokens(ws_first,updated_at)');\nfor mint,ws,ts in [('old',1,1),('new',1,${now}),('ignored',0,${now+1000})]: c.execute('INSERT INTO tokens VALUES (?,?,?,?)',(mint,ws,ts,json.dumps({'priceSol':0.001,'lastPriceAt':ts})))\nc.commit();c.close()`;
 let p=spawnSync('python3',['-c',py,db],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
 p=spawnSync('python3',[reader,db,'2'],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
 const data=JSON.parse(p.stdout);assert.deepEqual(data.tokens.map(x=>x.mint),['new','old']);assert.equal(data.tokens.length,2);assert.match(data.selection,/idx_tokens_ws_hot/);
 const missing=path.join(dir,'missing.sqlite');const py2=`import sqlite3,sys\nc=sqlite3.connect(sys.argv[1]);c.execute('CREATE TABLE tokens (mint TEXT PRIMARY KEY, ws_first INTEGER, updated_at INTEGER, token_json TEXT)');c.commit();c.close()`;
 p=spawnSync('python3',['-c',py2,missing],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
 p=spawnSync('python3',[reader,missing,'2'],{encoding:'utf8'});assert.notEqual(p.status,0);assert.match(p.stderr,/refusing full scan/);
 console.log('Stage 22.2 indexed reader tests passed (6 assertions); no live validation.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
