import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd=path.resolve(new URL('..',import.meta.url).pathname),port=39104,data='data-owner-test';
const p=spawn(process.execPath,['app-server.mjs'],{cwd,env:{...process.env,PORT:String(port),ALLOW_ANONYMOUS_PAPER:'true',DISCOVERY_ENABLED:'false',DATA_DIR:`./${data}`,OWNER_ACCESS_KEY:'owner-secret-test'},stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('start timeout')),5000);p.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});p.on('exit',c=>fail(Error('server exited '+c)))});
let cookie='';async function q(route,opt={}){const r=await fetch(`http://127.0.0.1:${port}${route}`,{...opt,headers:{'content-type':'application/json',...(opt.headers||{}),...(cookie?{cookie}:{})}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return [r,await r.json().catch(()=>null)]}
try{
  let [r,s]=await q('/api/billing/status');assert.equal(r.status,200);assert.equal(s.liveEntitled,false);assert.equal(s.isOwner,false);
  [r,s]=await q('/api/live/execute',{method:'POST'});assert.equal(r.status,402);assert.equal(s.error,'LIVE_ENTITLEMENT_REQUIRED');
  [r,s]=await q('/api/owner/claim',{method:'POST',body:JSON.stringify({accessKey:'wrong'})});assert.equal(r.status,403);
  [r,s]=await q('/api/owner/claim',{method:'POST',body:JSON.stringify({accessKey:'owner-secret-test'})});assert.equal(r.status,200);assert.equal(s.isOwner,true);
  [,s]=await q('/api/billing/status');assert.equal(s.plan,'owner');assert.equal(s.liveEntitled,true);assert.equal(s.entitlementSource,'owner');assert.equal(s.currentPeriodEnd,null);
  [r,s]=await q('/api/live/execute',{method:'POST'});assert.equal(r.status,423);assert.equal(s.error,'LIVE_EXECUTION_NOT_READY');assert.match(s.message,/Owner LIVE entitlement/);
  console.log('owner live entitlement ok');
}finally{p.kill('SIGTERM');fs.rmSync(path.join(cwd,data),{recursive:true,force:true})}
