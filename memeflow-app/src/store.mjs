import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class JsonStore {
  constructor(dir){this.dir=dir;this.file=path.join(dir,'state.json');this.state={users:{},tokens:{},decisions:{},positions:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0}};fs.mkdirSync(dir,{recursive:true});this.load()}
  load(){try{const d=JSON.parse(fs.readFileSync(this.file,'utf8'));this.state={...this.state,...d}}catch(_){} }
  save(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state));fs.renameSync(tmp,this.file)}
  user(id){if(!this.state.users[id]){this.state.users[id]={id,createdAt:new Date().toISOString(),settings:defaults(),plan:'free',liveEntitled:false,subscriptionStatus:'free',stripeCustomerId:null,stripeSubscriptionId:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,killSwitch:false,isOwner:false,ownerGrantedAt:null,ownerGrantSource:null};this.save()}return this.state.users[id]}
  settings(id){return this.user(id).settings}
  findUserByStripeCustomer(customerId){return Object.values(this.state.users).find(u=>u.stripeCustomerId===customerId)||null}
  updateBilling(id,patch){Object.assign(this.user(id),patch,{billingUpdatedAt:new Date().toISOString()});this.save();return this.user(id)}
  grantOwner(id,source='owner_access_key'){Object.assign(this.user(id),{isOwner:true,ownerGrantedAt:new Date().toISOString(),ownerGrantSource:source});this.save();return this.user(id)}
  revokeOwner(id){Object.assign(this.user(id),{isOwner:false,ownerGrantedAt:null,ownerGrantSource:null});this.save();return this.user(id)}
  hasStripeEvent(id){return Boolean(this.state.stripeEvents?.[id])}
  recordStripeEvent(id,type){this.state.stripeEvents ||= {};this.state.stripeEvents[id]={type,processedAt:new Date().toISOString()};const ids=Object.keys(this.state.stripeEvents);for(const old of ids.slice(0,Math.max(0,ids.length-5000)))delete this.state.stripeEvents[old];this.save()}
  setSettings(id,s){this.user(id).settings={...defaults(),...s};this.save();return this.user(id).settings}
  addToken(t){const old=this.state.tokens[t.mint]||{};this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};this.state.metrics.discovered++;this.save();return this.state.tokens[t.mint]}
  setToken(mint,t){this.state.tokens[mint]={...(this.state.tokens[mint]||{}),...t,updatedAt:Date.now()};this.state.metrics.scanned++;this.save();return this.state.tokens[mint]}
  tokens(){return Object.values(this.state.tokens).sort((a,b)=>(b.discoveredAt||0)-(a.discoveredAt||0))}
  setDecision(uid,mint,d){const key=uid+':'+mint;this.state.decisions[key]={...d,userId:uid,mint,updatedAt:Date.now()};const rows=Object.values(this.state.decisions).filter(x=>x.userId===uid).sort((a,b)=>b.updatedAt-a.updatedAt);for(const x of rows.slice(250))delete this.state.decisions[x.userId+':'+x.mint];this.save()}
  decisions(uid){return Object.values(this.state.decisions).filter(x=>x.userId===uid).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,200)}
}
export function defaults(){return {operatingMode:'observe',profile:'balanced',tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,minScore:72,minConfidence:70,minLiquidityUsd:0,minMarketCapUsd:0,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,minBuyPressure:1.2,minTokenAgeMinutes:0,maxTokenAgeMinutes:180,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,hardStopPct:25,trailingStopPct:15,tp1Pct:100,tp1SellPct:50,tp2Pct:200,tp2SellPct:25,runnerPct:25,maxHoldMinutes:1440,exitBuyPressure:1.0,adaptiveProfile:false,ownerApproval:true,shadowValidation:true,changeLog:true}}
export function sessionId(){return crypto.randomUUID()}
