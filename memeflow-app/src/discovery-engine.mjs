import { performance } from 'node:perf_hooks';
import { configHash, evaluateToken } from './evaluator.mjs';

export class InMemoryTenantStore {
  #settings=new Map(); #decisions=new Map(); #positions=new Map();
  constructor({maxDecisionsPerUser=500}={}){ this.maxDecisionsPerUser=maxDecisionsPerUser; }
  setSettings(userId, settings){ this.#settings.set(userId, structuredClone(settings)); }
  getSettings(userId){ const v=this.#settings.get(userId); return v?structuredClone(v):null; }
  putDecision(userId, tokenMint, decision){
    if(!this.#decisions.has(userId)) this.#decisions.set(userId,new Map());
    const bucket=this.#decisions.get(userId); bucket.set(tokenMint, structuredClone(decision));
    while(bucket.size>this.maxDecisionsPerUser){ bucket.delete(bucket.keys().next().value); }
  }
  getDecisions(userId){ return [...(this.#decisions.get(userId)?.values()||[])].map(v=>structuredClone(v)); }
  putPosition(userId, id, position){ if(!this.#positions.has(userId)) this.#positions.set(userId,new Map()); this.#positions.get(userId).set(id,structuredClone(position)); }
  getPosition(userId,id){ const v=this.#positions.get(userId)?.get(id); return v?structuredClone(v):null; }
  userIds(){ return [...this.#settings.keys()]; }
}

export class DiscoveryEngine {
  constructor({store}){ this.store=store; this.groups=new Map(); this.metrics={tokens:0,evaluations:0,groupEvaluations:0,latencies:[],startedAt:performance.now()}; }
  rebuildGroups(){
    this.groups.clear();
    for(const userId of this.store.userIds()){
      const settings=this.store.getSettings(userId); const hash=configHash(settings);
      if(!this.groups.has(hash)) this.groups.set(hash,{settings,userIds:[]});
      this.groups.get(hash).userIds.push(userId);
    }
  }
  ingest(token){
    const start=performance.now(); this.metrics.tokens++;
    for(const group of this.groups.values()){
      const result=evaluateToken(token,group.settings); this.metrics.groupEvaluations++;
      for(const userId of group.userIds){
        this.store.putDecision(userId,token.mint,{userId,mint:token.mint,createdAt:token.discoveredAt,processedAt:Date.now(),...result});
        this.metrics.evaluations++;
      }
    }
    const latency=performance.now()-start; this.metrics.latencies.push(latency); return latency;
  }
  summary(){
    const a=[...this.metrics.latencies].sort((x,y)=>x-y); const pct=p=>a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:0;
    const elapsed=(performance.now()-this.metrics.startedAt)/1000;
    return {users:this.store.userIds().length,configGroups:this.groups.size,tokens:this.metrics.tokens,evaluations:this.metrics.evaluations,groupEvaluations:this.metrics.groupEvaluations,elapsedSec:elapsed,tokensPerSec:this.metrics.tokens/elapsed,evaluationsPerSec:this.metrics.evaluations/elapsed,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:a.at(-1)||0};
  }
}
