import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {stripeSignature} from '../src/billing.mjs';

const cwd=path.resolve(new URL('..',import.meta.url).pathname),appPort=39092,stripePort=39093,secret='whsec_test';
let lastCheckout=null;
const stripe=http.createServer(async(req,res)=>{
  let raw='';for await(const c of req)raw+=c;
  const f=Object.fromEntries(new URLSearchParams(raw));
  res.setHeader('content-type','application/json');
  if(req.url==='/v1/checkout/sessions'){
    lastCheckout=f;return res.end(JSON.stringify({id:'cs_test_1',url:'https://checkout.stripe.test/cs_test_1'}));
  }
  if(req.url==='/v1/billing_portal/sessions')return res.end(JSON.stringify({id:'bps_1',url:'https://billing.stripe.test/bps_1'}));
  res.statusCode=404;res.end(JSON.stringify({error:{message:'not found'}}));
});
await new Promise(r=>stripe.listen(stripePort,'127.0.0.1',r));
const p=spawn(process.execPath,['app-server.mjs'],{cwd,env:{...process.env,PORT:String(appPort),ALLOW_ANONYMOUS_PAPER:'true',DISCOVERY_ENABLED:'false',DATA_DIR:'./data-billing-test',APP_URL:`http://127.0.0.1:${appPort}`,STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_PRICE_ID:'price_pro_4999',STRIPE_WEBHOOK_SECRET:secret,STRIPE_API_BASE:`http://127.0.0.1:${stripePort}/v1`},stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('start timeout')),5000);p.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});p.on('exit',c=>fail(Error('server exited '+c)))});
let cookie='';async function q(route,opt={}){const r=await fetch(`http://127.0.0.1:${appPort}${route}`,{...opt,headers:{...(opt.headers||{}),...(cookie?{cookie}:{})}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return [r,await r.json().catch(()=>null)]}
async function webhook(event){const raw=JSON.stringify(event);return q('/api/billing/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':stripeSignature(raw,secret)},body:raw})}
try{
  let [r,s]=await q('/api/billing/status');assert.equal(r.status,200);assert.equal(s.liveEntitled,false);
  [r,s]=await q('/api/billing/checkout',{method:'POST'});assert.equal(r.status,200);assert.match(s.url,/checkout\.stripe\.test/);assert.equal(lastCheckout.mode,'subscription');assert.equal(lastCheckout['line_items[0][price]'],'price_pro_4999');
  const uid=decodeURIComponent(cookie.split('=')[1]);assert.equal(lastCheckout.client_reference_id,uid);
  [r]=await webhook({id:'evt_checkout',type:'checkout.session.completed',data:{object:{id:'cs_test_1',customer:'cus_1',subscription:'sub_1',client_reference_id:uid,metadata:{user_id:uid}}}});assert.equal(r.status,200);
  [r]=await webhook({id:'evt_active',type:'customer.subscription.updated',data:{object:{id:'sub_1',customer:'cus_1',status:'active',current_period_end:2000000000,items:{data:[{price:{id:'price_pro_4999'}}]},metadata:{user_id:uid}}}});assert.equal(r.status,200);
  [,s]=await q('/api/billing/status');assert.equal(s.plan,'pro');assert.equal(s.liveEntitled,true);assert.equal(s.subscriptionStatus,'active');
  [r,s]=await q('/api/billing/portal',{method:'POST'});assert.equal(r.status,200);assert.match(s.url,/billing\.stripe\.test/);
  [r,s]=await q('/api/live/execute',{method:'POST'});assert.equal(r.status,423);assert.equal(s.error,'LIVE_EXECUTION_NOT_READY');
  [r]=await webhook({id:'evt_failed',type:'invoice.payment_failed',data:{object:{id:'in_1',customer:'cus_1'}}});assert.equal(r.status,200);
  [,s]=await q('/api/billing/status');assert.equal(s.liveEntitled,false);assert.equal(s.subscriptionStatus,'past_due');
  [r]=await webhook({id:'evt_failed',type:'invoice.payment_failed',data:{object:{id:'in_1',customer:'cus_1'}}});assert.equal(r.status,200);
  [r]=await webhook({id:'evt_cancel',type:'customer.subscription.deleted',data:{object:{id:'sub_1',customer:'cus_1',status:'canceled',metadata:{user_id:uid}}}});assert.equal(r.status,200);
  [,s]=await q('/api/billing/status');assert.equal(s.plan,'free');assert.equal(s.liveEntitled,false);assert.equal(s.subscriptionStatus,'canceled');
  const raw='{}';[r]=await q('/api/billing/webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=bad'},body:raw});assert.equal(r.status,400);
  console.log('billing cycle ok');
}finally{p.kill('SIGTERM');stripe.close();fs.rmSync(path.join(cwd,'data-billing-test'),{recursive:true,force:true})}
