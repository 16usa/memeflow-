import {inspectPricePattern} from './quantum-stage27-pattern.mjs';
// Runtime in-memory price observations. No network, persistence, trades or decisions.
export function createStage28PatternTracker({maxMints=3000,maxPoints=90}={}){
 const histories=new Map();
 const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
 return {
  observe(mint,token,now=Date.now()){
   const key=String(mint||'');
   const price=finite(token?.priceSol),at=finite(token?.lastPriceAt);
   if(!key)return inspectPricePattern([],now);
   let points=histories.get(key)||[];
   // Use the actual price source timestamp. Repeated decisions do not manufacture price ticks.
   if(price!==null&&price>0&&at!==null&&at<=now&&at>=now-3600000){
    if(!points.some(p=>p.at===at))points.push({at,priceSol:price});
    points=points.filter(p=>p.at>=now-3600000).sort((a,b)=>a.at-b.at).slice(-maxPoints);
   }
   histories.delete(key);histories.set(key,points);
   while(histories.size>maxMints)histories.delete(histories.keys().next().value);
   return inspectPricePattern(points,now);
  },
  status(){return {trackedMints:histories.size,mode:'SHADOW',trading:false}}
 };
}
