import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd=path.resolve(new URL('..',import.meta.url).pathname),port=39217,data='data-live-noncustodial-v1-test';
const child=spawn(process.execPath,['live-bootstrap.mjs'],{cwd,env:{...process.env,PORT:String(port),ALLOW_ANONYMOUS_PAPER:'true',DISCOVERY_ENABLED:'false',DATA_DIR:`./${data}`,OWNER_ACCESS_KEY:'owner-live-test',LIVE_TRADING_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('server start timeout')),7000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});child.on('exit',c=>fail(Error('server exited '+c)))});
let cookie='';async function q(route,opt={}){const r=await fetch(`http://127.0.0.1:${port}${route}`,{...opt,headers:{'content-type':'application/json',...(opt.headers||{}),...(cookie?{cookie}:{})}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return [r,await r.json().catch(()=>null)]}
try{
  let [r,s]=await q('/api/live/status');assert.equal(r.status,200);assert.equal(s.enabled,false);assert.equal(s.nonCustodial,true);assert.equal(s.walletSigning,'required');
  [r,s]=await q('/api/live/execute',{method:'POST',body:'{}'});assert.equal(r.status,402);assert.equal(s.error,'LIVE_ENTITLEMENT_REQUIRED');
  [r]=await q('/api/owner/claim',{method:'POST',body:JSON.stringify({accessKey:'owner-live-test'})});assert.equal(r.status,200);
  [r,s]=await q('/api/live/execute',{method:'POST',body:'{}'});assert.equal(r.status,423);assert.equal(s.error,'LIVE_EXECUTION_NOT_READY');
  console.log('non-custodial LIVE fail-closed tests ok');
}finally{child.kill('SIGTERM');fs.rmSync(path.join(cwd,data),{recursive:true,force:true})}
