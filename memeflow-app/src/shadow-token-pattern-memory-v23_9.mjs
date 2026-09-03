import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9
// SHADOW ONLY. No Score/State/settings/BUY/SELL authority.

const TARGET_HORIZON_MS=300_000;

const finite=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(v,d=2)=>{
  const n=finite(v);
  if(n===null)return null;
  const p=10**d;
  return Math.round(n*p)/p;
};
const upper=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';
  const r=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);
  if((r!==null&&r>=20)||(mfe!==null&&mfe>=50&&(mae===null||mae>-25)))return 'POSITIVE';
  if((r!==null&&r<=-20)||(mae!==null&&mae<=-25))return 'NEGATIVE';
  return 'NEUTRAL';
}

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';
    const st=fs.statSync(file);
    if(!(st.size>0))return '';
    if(st.size<=maxBytes)return fs.readFileSync(file,'utf8');
    const fd=fs.openSync(file,'r');
    try{
      const buf=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buf,0,maxBytes,st.size-maxBytes);
      let text=buf.toString('utf8');
      const nl=text.indexOf('\n');
      if(nl>=0)text=text.slice(nl+1);
      return text;
    }finally{fs.closeSync(fd);}
  }catch{return '';}
}

function signature(snapshot={}){
  const g=snapshot?.shadowConfidenceGovernor||{};
  const t=snapshot?.shadowTokenTrajectory||{};
  const sm=snapshot?.specialists?.smartMoneyMemory||{};
  const w15=snapshot?.windows?.['15000']||{};
  return {
    trajectoryState:upper(t.trajectoryState),
    regime:upper(snapshot?.evidence?.regime),
    driftStatus:upper(snapshot?.shadowDriftRegime?.driftStatus),
    probability:finite(g.consensusProbabilityPositivePct),
    confidence:finite(g.ensembleConfidencePct),
    disagreement:finite(g.disagreementPct),
    probabilityDelta:finite(t.probabilityDeltaWindow),
    confidenceDelta:finite(t.confidenceDeltaWindow),
    netFlow:finite(snapshot?.evidence?.flowAcceleration?.netFlow5s),
    priceReturn:finite(w15?.price?.returnPct),
    smartMoney:finite(sm.weightedPositiveProbabilityPct),
    completeness:finite(snapshot?.evidence?.dataQuality?.completenessPct),
    coordinated:snapshot?.specialists?.coordination?.suspectedCoordination===true
  };
}

const scales={
  probability:30,confidence:30,disagreement:20,
  probabilityDelta:20,confidenceDelta:20,
  netFlow:0.75,priceReturn:35,smartMoney:30,completeness:30
};

function distance(a={},b={}){
  let cost=0,weight=0,seen=0;
  for(const [k,scale] of Object.entries(scales)){
    const x=finite(a[k]),y=finite(b[k]);
    weight+=1;
    if(x===null&&y===null)continue;
    if(x===null||y===null){cost+=0.35;continue;}
    cost+=Math.min(2,Math.abs(x-y)/scale);
    seen++;
  }
  const cat=(same,penalty,w=1)=>{
    cost+=(same?0:penalty)*w;
    weight+=w;
  };
  cat(upper(a.trajectoryState)===upper(b.trajectoryState),0.80,1.4);
  cat(upper(a.regime)===upper(b.regime),0.55,1);
  cat(upper(a.driftStatus)===upper(b.driftStatus),0.70,1);
  cat(a.coordinated===b.coordinated,0.70,0.8);
  return {
    d:weight?cost/weight:Infinity,
    coveragePct:seen/Object.keys(scales).length*100
  };
}

const similarity=d=>clamp(Math.exp(-2.2*d),0,1);

export function createShadowTokenPatternMemoryV23_9({
  dataDir=null,
  maxExamples=5000,
  topK=25,
  minimumExamples=12,
  minimumSimilarity=0.22
}={}){
  const file=dataDir?path.join(dataDir,'token-pattern-memory-v23-9.jsonl'):null;
  const examples=[],recent=[],queue=[];
  let draining=false,rowsLoaded=0,rowsWritten=0,loadErrors=0,writeErrors=0,predictions=0,outcomesRecorded=0,duplicatesRejected=0;

  if(file){try{fs.mkdirSync(path.dirname(file),{recursive:true});}catch{}}

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;
    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);
          await fs.promises.appendFile(file,batch.map(JSON.stringify).join('\n')+'\n','utf8');
          rowsWritten+=batch.length;
        }
      }catch{writeErrors++;}
      finally{draining=false;if(queue.length)kick();}
    });
  }

  function append(row){
    if(!file)return;
    queue.push(row);
    if(queue.length>10000)queue.splice(0,queue.length-10000);
    kick();
  }

  async function flush(){
    if(!file)return true;
    kick();
    const started=Date.now();
    while(draining||queue.length){
      if(Date.now()-started>5000)return false;
      await new Promise(r=>setTimeout(r,5));
    }
    return true;
  }

  function addExample(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    const anchorAt=Number(raw?.anchorAt||0);
    const horizonMs=Number(raw?.horizonMs||0);
    const classification=upper(raw?.classification);
    if(!mint||!(anchorAt>0)||horizonMs!==TARGET_HORIZON_MS)return null;
    if(!['POSITIVE','NEGATIVE'].includes(classification))return null;
    const key=`${mint}:${anchorAt}:${horizonMs}`;
    if(examples.some(x=>x.key===key)){duplicatesRejected++;return null;}
    const row={
      type:'pattern-example',
      version:'MEMEFLOW_TOKEN_PATTERN_EXAMPLE_V23_9',
      shadowOnly:true,key,mint,anchorAt,
      observedAt:Number(raw?.observedAt||0)||null,
      horizonMs,classification,signature:raw?.signature||{}
    };
    examples.push(row);
    const limit=Math.max(100,Number(maxExamples)||5000);
    if(examples.length>limit)examples.splice(0,examples.length-limit);
    if(persist)append(row);
    return row;
  }

  function load(){
    if(!file)return;
    const text=readTailUtf8(file);
    for(const line of text.split('\n')){
      if(!line.trim())continue;
      try{
        const row=JSON.parse(line);
        if(row?.type==='pattern-example'){
          const n=examples.length;
          addExample(row,{persist:false});
          if(examples.length>n)rowsLoaded++;
        }
      }catch{loadErrors++;}
    }
  }

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    const mint=String(meta?.mint||snapshot?.mint||'');
    const now=Number(meta?.at||snapshot?.observedAt||Date.now());
    try{
      const sig=signature(snapshot);
      const eligible=examples.filter(row=>
        row.mint!==mint &&
        (!row.observedAt||Number(row.observedAt)<now)
      );

      if(eligible.length<Math.max(2,Number(minimumExamples)||12)){
        const row={
          version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
          status:'PATTERN_COLD_START',ready:false,historicalExamples:eligible.length,
          neighbourCount:0,patternProbabilityPositivePct:null,matchConfidencePct:0,
          meanSimilarityPct:0,nearestSimilarityPct:null,currentTrajectoryState:sig.trajectoryState,
          currentRegime:sig.regime,neighbours:[],mint:mint||null,observedAt:now
        };
        remember(row);return row;
      }

      const ranked=eligible.map(row=>{
        const m=distance(sig,row.signature);
        return {row,similarity:similarity(m.d),coveragePct:m.coveragePct};
      }).filter(x=>x.similarity>=Number(minimumSimilarity))
        .sort((a,b)=>b.similarity-a.similarity)
        .slice(0,Math.max(3,Number(topK)||25));

      if(ranked.length<3){
        const row={
          version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
          status:'PATTERN_NO_CLOSE_MATCH',ready:false,historicalExamples:eligible.length,
          neighbourCount:ranked.length,patternProbabilityPositivePct:null,matchConfidencePct:0,
          meanSimilarityPct:round(ranked.length?ranked.reduce((s,x)=>s+x.similarity,0)/ranked.length*100:0),
          nearestSimilarityPct:ranked[0]?round(ranked[0].similarity*100):null,
          currentTrajectoryState:sig.trajectoryState,currentRegime:sig.regime,
          neighbours:[],mint:mint||null,observedAt:now
        };
        remember(row);return row;
      }

      let posW=0,totalW=0,simSum=0,covSum=0;
      for(const x of ranked){
        const w=Math.max(0.01,x.similarity);
        totalW+=w;
        posW+=w*(x.row.classification==='POSITIVE'?1:0);
        simSum+=x.similarity;
        covSum+=x.coveragePct;
      }
      const alpha=2+posW;
      const beta=2+Math.max(0,totalW-posW);
      const probability=alpha/(alpha+beta)*100;
      const meanSimilarity=simSum/ranked.length*100;
      const coverage=covSum/ranked.length;
      const breadth=clamp(ranked.length/Math.max(8,Number(topK)||25),0,1);
      const confidence=clamp(meanSimilarity*(0.45+0.55*breadth)*clamp(coverage/100,0,1),0,100);
      const positive=ranked.filter(x=>x.row.classification==='POSITIVE').length;
      const negative=ranked.length-positive;
      const status=confidence>=55&&ranked.length>=8?'PATTERN_STRONG_MATCH':
        confidence>=30?'PATTERN_MATCH':'PATTERN_WEAK_MATCH';

      const row={
        version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,status,ready:true,
        historicalExamples:eligible.length,neighbourCount:ranked.length,
        positiveNeighbours:positive,negativeNeighbours:negative,
        patternProbabilityPositivePct:round(probability),matchConfidencePct:round(confidence),
        meanSimilarityPct:round(meanSimilarity),nearestSimilarityPct:round(ranked[0].similarity*100),
        featureCoveragePct:round(coverage),effectiveNeighbourWeight:round(totalW,4),
        currentTrajectoryState:sig.trajectoryState,currentRegime:sig.regime,
        neighbours:ranked.slice(0,5).map(x=>({
          mint:x.row.mint,anchorAt:x.row.anchorAt,classification:x.row.classification,
          similarityPct:round(x.similarity*100),
          trajectoryState:x.row.signature?.trajectoryState||'UNKNOWN',
          regime:x.row.signature?.regime||'UNKNOWN'
        })),
        mint:mint||null,observedAt:now
      };
      predictions++;remember(row);return row;
    }catch{
      const row={
        version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,status:'ERROR',
        ready:false,historicalExamples:0,neighbourCount:0,patternProbabilityPositivePct:null,
        matchConfidencePct:0,meanSimilarityPct:0,nearestSimilarityPct:null,
        currentTrajectoryState:'UNKNOWN',currentRegime:'UNKNOWN',
        neighbours:[],mint:mint||null,observedAt:now
      };
      remember(row);return row;
    }
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=String(anchor?.mint||outcome?.mint||'');
    if(!mint||!anchor||!outcome)return null;
    if(Number(outcome.horizonMs)!==TARGET_HORIZON_MS)return null;
    const classification=classifyOutcome(outcome);
    if(!['POSITIVE','NEGATIVE'].includes(classification))return null;
    const row=addExample({
      mint,anchorAt:Number(anchor.at)||0,
      observedAt:Number(outcome.observedAt)||null,
      horizonMs:Number(outcome.horizonMs),
      classification,
      signature:signature(anchor.features||{})
    },{persist:true});
    if(row)outcomesRecorded++;
    return row;
  }

  function listRecent({limit=50}={}){
    return recent.slice(0,Math.max(1,Math.min(200,Number(limit)||50)));
  }

  function listExamples({limit=50,classification=null}={}){
    const wanted=classification?upper(classification):null;
    return examples.filter(x=>!wanted||x.classification===wanted)
      .slice(-Math.max(1,Math.min(200,Number(limit)||50))).reverse();
  }

  function status(){
    const positive=examples.filter(x=>x.classification==='POSITIVE').length;
    return {
      version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      target:'P(POSITIVE_5M | SIMILAR_HISTORICAL_TRAJECTORY)',
      targetHorizonMs:TARGET_HORIZON_MS,
      method:'OUTCOME_LINKED_KERNEL_KNN_BETA_SHRINKAGE',
      file,examples:examples.length,positiveExamples:positive,
      negativeExamples:examples.length-positive,predictions,outcomesRecorded,
      duplicatesRejected,recentPredictions:recent.length,rowsLoaded,rowsWritten,
      queued:queue.length,draining,loadErrors,writeErrors
    };
  }

  load();
  return {predict,recordOutcome,listRecent,listExamples,status,flush};
}
