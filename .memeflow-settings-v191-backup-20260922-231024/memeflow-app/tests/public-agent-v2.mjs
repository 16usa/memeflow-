import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd=path.resolve(new URL('..',import.meta.url).pathname),port=39242,data='data-public-agent-v2-test';
const p=spawn(process.execPath,['app-server.mjs'],{cwd,env:{...process.env,PORT:String(port),DISCOVERY_ENABLED:'false',DATA_DIR:`./${data}`,OWNER_ACCESS_KEY:'entity-owner-test'},stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('start timeout')),8000);p.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});p.on('exit',c=>fail(Error('server exited '+c)))});
let cookie='';async function q(route,opt={}){const r=await fetch(`http://127.0.0.1:${port}${route}`,{...opt,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...(opt.headers||{})}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return[r,await r.json().catch(()=>null)]}
try{
 let[r,s]=await q('/api/owner/public-agent');assert.equal(r.status,403);assert.equal(s.error,'OWNER_REQUIRED');
 [r,s]=await q('/api/owner/claim',{method:'POST',body:JSON.stringify({accessKey:'entity-owner-test'})});assert.equal(r.status,200);assert.equal(s.isOwner,true);
 [r,s]=await q('/api/owner/public-agent');assert.equal(r.status,200);assert.equal(s.x.connected,false);assert.equal(s.x.transport,'disabled-v2');
 [r,s]=await q('/api/owner/public-agent/config',{method:'PUT',body:JSON.stringify({enabled:true,mode:'approval',displayName:'PUBLIC_AGENT',voice:'terminal',events:{watch:true,buyReady:true,positions:true,risk:true}})});assert.equal(r.status,200);assert.equal(s.config.enabled,true);assert.equal(s.config.events.positions,true);
 [r,s]=await q('/api/owner/public-agent');assert.equal(r.status,200);assert.equal(s.config.displayName,'PUBLIC_AGENT');assert.deepEqual(s.queue,[]);
 console.log('public agent v2 owner api ok');
}finally{p.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));fs.rmSync(path.join(cwd,data),{recursive:true,force:true})}
