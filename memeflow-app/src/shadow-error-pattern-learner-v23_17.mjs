import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17
//
// SHADOW ONLY.
//
// Learns recurring pre-outcome evidence combinations associated with
// V23.16 directional misses. Associations are NOT causal claims.
// Patterns are diagnostics only and never alter V22/V23 trading authority.
//
// Anti-overfit rules:
// - only directional hit/miss outcomes are learned
// - outcome-derived tags are excluded from pattern keys
// - only 1-way and 2-way combinations are considered
// - minimum support + minimum misses are required
// - empirical miss rates use Beta shrinkage toward global miss rate
// - a lower credible bound must still exceed baseline before maturity
//
// No Score/State/Settings/BUY/SELL mutation.

const TARGET_HORIZON_MS=300_000;
const PRIOR_STRENGTH=12;
const MIN_SUPPORT=12;
const MIN_MISSES=4;
const MIN_POSTERIOR_MISS_PCT=55;
const MIN_LIFT=1.25;
const MIN_LOWER_BOUND_EDGE_PCT=3;

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function confidenceBand(value){
  const n=finite(value);
  if(n===null)return 'UNKNOWN';
  if(n>=75)return 'HIGH';
  if(n>=50)return 'MEDIUM';
  if(n>=25)return 'LOW';
  return 'VERY_LOW';
}

function safeTag(value){
  return upper(value)
    .replace(/[^A-Z0-9_:-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,96);
}

function isOutcomeDerivedTag(tag){
  const t=upper(tag);

  return [
    'HIGH_CONFIDENCE_MISS',
    'FALSE_POSITIVE',
    'FALSE_NEGATIVE',
    'TRUE_POSITIVE',
    'TRUE_NEGATIVE',
    'MISS',
    'HIT'
  ].some(
    forbidden=>
      t===forbidden ||
      t.startsWith(`${forbidden}_`)
  );
}

function evidenceTags(review={}){
  const tags=[];

  const raw=
    Array.isArray(review?.attributionTags)
      ? review.attributionTags
      : [];

  for(const item of raw){
    const tag=safeTag(item);

    if(
      tag &&
      !isOutcomeDerivedTag(tag)
    ){
      tags.push(tag);
    }
  }

  const regime=safeTag(review?.regimeAtAnchor);

  if(regime&&regime!=='UNKNOWN'){
    tags.push(`REGIME_${regime}`);
  }

  const stage=safeTag(review?.stageAtAnchor);

  if(stage&&stage!=='UNKNOWN'){
    tags.push(`STAGE_${stage}`);
  }

  const source=safeTag(review?.forecast?.source);

  if(
    source &&
    source!=='NONE' &&
    source!=='UNKNOWN'
  ){
    tags.push(`SOURCE_${source}`);
  }

  const predicted=safeTag(review?.forecast?.predictedClass);

  if(predicted&&predicted!=='UNKNOWN'){
    tags.push(`PREDICTED_${predicted}`);
  }

  const band=confidenceBand(review?.forecast?.confidencePct);

  if(band!=='UNKNOWN'){
    tags.push(`CONFIDENCE_${band}`);
  }

  return [...new Set(tags)]
    .sort()
    .slice(0,16);
}

function combinations(tags=[]){
  const out=[];

  for(let i=0;i<tags.length;i++){
    out.push([tags[i]]);

    for(let j=i+1;j<tags.length;j++){
      out.push([tags[i],tags[j]]);
    }
  }

  return out;
}

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const st=fs.statSync(file);
    if(!(st.size>0))return '';

    if(st.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const fd=fs.openSync(file,'r');

    try{
      const buf=Buffer.allocUnsafe(maxBytes);

      fs.readSync(
        fd,
        buf,
        0,
        maxBytes,
        st.size-maxBytes
      );

      let text=buf.toString('utf8');
      const nl=text.indexOf('\n');

      if(nl>=0){
        text=text.slice(nl+1);
      }

      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
}

function betaPosterior({
  misses,
  support,
  baseRate
}){
  const alpha0=
    Math.max(
      0.001,
      baseRate*PRIOR_STRENGTH
    );

  const beta0=
    Math.max(
      0.001,
      (1-baseRate)*PRIOR_STRENGTH
    );

  const alpha=alpha0+misses;

  const beta=
    beta0+
    Math.max(
      0,
      support-misses
    );

  const total=alpha+beta;
  const mean=alpha/total;

  const variance=
    (alpha*beta)/
    (
      total*total*
      (total+1)
    );

  const sd=
    Math.sqrt(
      Math.max(0,variance)
    );

  const lower=
    clamp(
      mean-1.645*sd,
      0,
      1
    );

  return {
    mean,
    lower,
    alpha,
    beta
  };
}

export function createShadowErrorPatternLearnerV23_17({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'shadow-error-pattern-learner-v23-17.jsonl'
        )
      : null;

  const rows=[];
  const seen=new Set();
  const queue=[];

  let draining=false;
  let rowsLoaded=0;
  let rowsWritten=0;
  let loadErrors=0;
  let writeErrors=0;
  let observed=0;
  let duplicates=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function kick(){
    if(
      draining ||
      !queue.length ||
      !file
    ){
      return;
    }

    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);

          await fs.promises.appendFile(
            file,
            batch
              .map(row=>JSON.stringify(row))
              .join('\n')+
              '\n',
            'utf8'
          );

          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;

        if(queue.length){
          kick();
        }
      }
    });
  }

  function append(row){
    if(!file)return;

    queue.push(row);

    if(queue.length>10_000){
      queue.splice(
        0,
        queue.length-10_000
      );
    }

    kick();
  }

  async function flush(){
    if(!file)return true;

    kick();
    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000){
        return false;
      }

      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
  }

  function add(row,{persist=false}={}){
    if(!row?.key||!row?.mint){
      return null;
    }

    if(seen.has(row.key)){
      duplicates++;
      return null;
    }

    seen.add(row.key);
    rows.push(row);

    const limit=
      Math.max(
        500,
        Number(maxRows)||10_000
      );

    if(rows.length>limit){
      rows.splice(
        0,
        rows.length-limit
      );
    }

    if(persist){
      append(row);
    }

    return row;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);

        if(
          row?.type===
          'shadow-error-pattern-observation'
        ){
          if(
            add(
              row,
              {persist:false}
            )
          ){
            rowsLoaded++;
          }
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function observeReview(review={}){
    const directional=
      review?.hit===true ||
      review?.miss===true;

    if(
      !review?.mint ||
      !directional ||
      !Number.isFinite(
        Number(review?.horizonMs)
      )
    ){
      return null;
    }

    const tags=evidenceTags(review);

    const row={
      type:'shadow-error-pattern-observation',
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_OBSERVATION_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      key:String(
        review?.key||
        [
          review.mint,
          review.anchorAt||0,
          review.horizonMs||0
        ].join(':')
      ),
      mint:String(review.mint),
      anchorAt:
        finite(review?.anchorAt),
      observedAt:
        finite(review?.observedAt),
      horizonMs:
        finite(review?.horizonMs),
      hit:
        review?.hit===true,
      miss:
        review?.miss===true,
      resultType:
        upper(review?.resultType),
      confidencePct:
        finite(review?.forecast?.confidencePct),
      tags,
      disclaimer:
        'PATTERN_ASSOCIATION_IS_NOT_CAUSAL_PROOF'
    };

    const added=
      add(
        row,
        {persist:true}
      );

    if(added){
      observed++;
    }

    return added;
  }

  function patternReport({
    horizonMs=TARGET_HORIZON_MS,
    limit=25,
    includeImmature=false
  }={}){
    const horizon=finite(horizonMs);

    const safeLimit=
      Math.max(
        1,
        Math.min(
          100,
          Number(limit)||25
        )
      );

    const source=
      rows.filter(
        row=>
          (row.hit===true||row.miss===true) &&
          (
            horizon===null ||
            Number(row.horizonMs)===
            Number(horizon)
          )
      );

    const total=source.length;

    const globalMisses=
      source.filter(
        row=>row.miss===true
      ).length;

    const baseRate=
      total
        ? globalMisses/total
        : 0;

    const buckets=new Map();

    for(const row of source){
      const tags=
        Array.isArray(row?.tags)
          ? row.tags
          : [];

      for(const combo of combinations(tags)){
        const key=combo.join(' + ');

        const prev=
          buckets.get(key)||
          {
            key,
            tags:combo,
            support:0,
            misses:0,
            hits:0,
            falsePositives:0,
            falseNegatives:0,
            highConfidenceMisses:0
          };

        prev.support++;

        if(row.miss===true){
          prev.misses++;

          if(row.resultType==='FALSE_POSITIVE'){
            prev.falsePositives++;
          }

          if(row.resultType==='FALSE_NEGATIVE'){
            prev.falseNegatives++;
          }

          if(Number(row.confidencePct)>=70){
            prev.highConfidenceMisses++;
          }
        }else{
          prev.hits++;
        }

        buckets.set(key,prev);
      }
    }

    const globalPosterior=
      betaPosterior({
        misses:globalMisses,
        support:Math.max(1,total),
        baseRate:
          total
            ? baseRate
            : 0.5
      });

    const baselinePct=
      total
        ? baseRate*100
        : null;

    const allPatterns=
      [...buckets.values()]
        .map(row=>{
          const posterior=
            betaPosterior({
              misses:row.misses,
              support:row.support,
              baseRate:
                total
                  ? baseRate
                  : 0.5
            });

          const posteriorPct=
            posterior.mean*100;

          const lowerPct=
            posterior.lower*100;

          const lift=
            total
              ? posterior.mean/
                Math.max(
                  0.01,
                  globalPosterior.mean
                )
              : null;

          const mature=
            row.support>=MIN_SUPPORT &&
            row.misses>=MIN_MISSES &&
            posteriorPct>=MIN_POSTERIOR_MISS_PCT &&
            lift!==null &&
            lift>=MIN_LIFT &&
            baselinePct!==null &&
            lowerPct>=
              baselinePct+
              MIN_LOWER_BOUND_EDGE_PCT;

          let severity='WATCH';

          if(mature){
            severity=
              row.support>=25 &&
              posteriorPct>=65 &&
              lift>=1.5
                ? 'HIGH'
                : 'MEDIUM';
          }

          return {
            patternId:
              row.key,
            tags:
              row.tags,
            support:
              row.support,
            misses:
              row.misses,
            hits:
              row.hits,
            rawMissRatePct:
              row.support
                ? round(
                    row.misses/
                    row.support*
                    100,
                    2
                  )
                : null,
            posteriorMissRatePct:
              round(
                posteriorPct,
                2
              ),
            lowerBoundMissRatePct:
              round(
                lowerPct,
                2
              ),
            baselineMissRatePct:
              baselinePct===null
                ? null
                : round(
                    baselinePct,
                    2
                  ),
            missLift:
              lift===null
                ? null
                : round(
                    lift,
                    3
                  ),
            falsePositives:
              row.falsePositives,
            falseNegatives:
              row.falseNegatives,
            highConfidenceMisses:
              row.highConfidenceMisses,
            mature,
            severity,
            disclaimer:
              'PATTERN_ASSOCIATION_IS_NOT_CAUSAL_PROOF'
          };
        });

    const matureTotal=
      allPatterns.filter(
        row=>row.mature===true
      ).length;

    const highRiskTotal=
      allPatterns.filter(
        row=>
          row.mature===true &&
          row.severity==='HIGH'
      ).length;

    const patterns=
      allPatterns
        .filter(
          row=>
            includeImmature===true ||
            row.mature===true
        )
        .sort(
          (a,b)=>
            Number(b.mature)-Number(a.mature) ||
            Number(b.missLift||0)-Number(a.missLift||0) ||
            Number(b.support||0)-Number(a.support||0)
        )
        .slice(0,safeLimit);

    return {
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_REPORT_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      autoCorrection:false,
      horizonMs:horizon,
      scoredRows:total,
      globalMisses,
      globalMissRatePct:
        baselinePct===null
          ? null
          : round(
              baselinePct,
              2
            ),
      maturePatterns:
        matureTotal,
      highRiskPatterns:
        highRiskTotal,
      patterns,
      policy:{
        priorStrength:PRIOR_STRENGTH,
        maxCombinationSize:2,
        minSupport:MIN_SUPPORT,
        minMisses:MIN_MISSES,
        minPosteriorMissRatePct:
          MIN_POSTERIOR_MISS_PCT,
        minLift:MIN_LIFT,
        minLowerBoundEdgePct:
          MIN_LOWER_BOUND_EDGE_PCT,
        outcomeDerivedTagsExcluded:true,
        causalClaims:false,
        autoCorrection:false
      }
    };
  }

  function status(){
    const target=
      patternReport({
        horizonMs:
          TARGET_HORIZON_MS,
        limit:100,
        includeImmature:false
      });

    return {
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      autoCorrection:false,
      targetHorizonMs:
        TARGET_HORIZON_MS,
      target:{
        scoredRows:
          target.scoredRows,
        globalMisses:
          target.globalMisses,
        globalMissRatePct:
          target.globalMissRatePct,
        maturePatterns:
          target.maturePatterns,
        highRiskPatterns:
          target.highRiskPatterns
      },
      rows:
        rows.length,
      observed,
      duplicates,
      rowsLoaded,
      rowsWritten,
      queued:
        queue.length,
      draining,
      loadErrors,
      writeErrors,
      file
    };
  }

  load();

  return {
    observeReview,
    patternReport,
    status,
    flush
  };
}
