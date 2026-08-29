#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW OWNER INTELLIGENCE V1"

# ------------------------------------------------------------
# Resolve app
# ------------------------------------------------------------
if [ -f "/home/runner/workspace/memeflow-app/app-server.mjs" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/app-server.mjs" ]; then
  APP="$(cd ./memeflow-app && pwd)"
elif [ -f "./app-server.mjs" ]; then
  APP="$(pwd)"
else
  echo "[patch] ERROR: memeflow-app/app-server.mjs not found"
  exit 1
fi

SERVER="$APP/app-server.mjs"
HTML="$APP/owner-intelligence.html"
CSS="$APP/owner-intelligence.css"
JS="$APP/owner-intelligence.js"
TRADING="$APP/trading.html"
LINKJS="$APP/owner-intelligence-link.js"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.owner-intelligence-backup-$STAMP"
mkdir -p "$BACKUP"

cp "$SERVER" "$BACKUP/app-server.mjs"
[ -f "$TRADING" ] && cp "$TRADING" "$BACKUP/trading.html" || true
[ -f "$HTML" ] && cp "$HTML" "$BACKUP/owner-intelligence.html" || true
[ -f "$CSS" ] && cp "$CSS" "$BACKUP/owner-intelligence.css" || true
[ -f "$JS" ] && cp "$JS" "$BACKUP/owner-intelligence.js" || true

echo "[patch] backup: $BACKUP"

# ------------------------------------------------------------
# BACKEND
# ------------------------------------------------------------
python3 - "$SERVER" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

HELPER_MARKER = "MEMEFLOW_OWNER_INTELLIGENCE_V1_HELPERS"
ROUTE_MARKER = "MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES"

helpers = r'''
/* ============================================================
   MEMEFLOW_OWNER_INTELLIGENCE_V1_HELPERS

   OpenAI is NOT part of the realtime decision loop here.
   No background OpenAI calls.
   Only an authenticated OWNER can manually invoke the coach.

   AI -> PROPOSE
   LOCAL ENGINE -> SHADOW TEST
   OWNER -> APPLY
   ============================================================ */

const __MF_OWNER_AI_TUNABLE_SETTINGS=new Set([
  'minScore',
  'minConfidence',
  'minLiquidityUsd',
  'minBuyPressure',

  'minMarketCapUsd',
  'maxMarketCapUsd',
  'minHolders',
  'maxHolders',
  'maxBundlePct',
  'maxTokenAgeMinutes',
  'maxTop10Pct',
  'maxDeveloperPct',
  'maxSniperPct',
  'maxSuspectedRiskyWalletsPct',
  'maxInsidersPct',

  'hardStopPct',
  'trailingStopPct',
  'tp1Pct',
  'tp1SellPct',
  'tp2Pct',
  'tp2SellPct',
  'runnerPct',
  'maxHoldMinutes',
  'exitBuyPressure',
  'decisionFreshnessSec'
]);

function __mfOwnerFinite(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function __mfOwnerRound(value,digits=4){
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  const p=10**digits;
  return Math.round(n*p)/p;
}

function __mfOwnerIntelState(uid){
  store.state.ownerIntelligence||={};
  store.state.ownerIntelligence[uid]||={
    reports:[],
    audit:[],
    lastAiStatus:'unknown',
    lastAiError:null,
    lastAiAt:null
  };
  return store.state.ownerIntelligence[uid];
}

function __mfOwnerTopCounts(values,limit=10){
  const map=new Map();

  for(const value of values){
    const key=String(value||'').trim();
    if(!key)continue;
    map.set(key,(map.get(key)||0)+1);
  }

  return [...map.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,limit)
    .map(([name,count])=>({name,count}));
}

function __mfOwnerDecisionDigest(uid){
  const decisions=store.decisions(uid)||[];

  const states={
    WAITING:0,
    WATCH:0,
    'BUY READY':0,
    BLOCKED:0,
    EXPIRED:0
  };

  const scores=[];

  for(const d of decisions){
    const state=String(d?.state||'WAITING');
    states[state]=(states[state]||0)+1;

    const score=__mfOwnerFinite(d?.score);
    if(score!==null)scores.push(score);
  }

  const avgScore=scores.length
    ? scores.reduce((a,b)=>a+b,0)/scores.length
    : null;

  const reasons=__mfOwnerTopCounts(
    decisions.flatMap(d=>{
      const out=[];
      if(d?.primaryReason)out.push(d.primaryReason);
      if(Array.isArray(d?.reasons))out.push(...d.reasons.slice(0,3));
      return out;
    }),
    12
  );

  return {
    currentDecisionCount:decisions.length,
    states,
    averageScore:__mfOwnerRound(avgScore,2),
    topReasons:reasons
  };
}

function __mfOwnerPerformanceDigest(uid){
  const positions=paper.userPositions(uid)||[];
  const trades=paper.userTrades(uid)||[];

  const open=positions.filter(
    p=>String(p?.status||'').toUpperCase()==='OPEN'
  );

  const closed=positions.filter(
    p=>String(p?.status||'').toUpperCase()==='CLOSED'
  );

  const wins=closed.filter(p=>Number(p?.realizedPnlSol)>0);
  const losses=closed.filter(p=>Number(p?.realizedPnlSol)<0);
  const flat=closed.length-wins.length-losses.length;

  const pnlSol=closed.reduce(
    (sum,p)=>sum+(Number(p?.realizedPnlSol)||0),
    0
  );

  const pnlPcts=closed
    .map(p=>__mfOwnerFinite(p?.realizedPnlPct))
    .filter(v=>v!==null);

  const avgPnlPct=pnlPcts.length
    ? pnlPcts.reduce((a,b)=>a+b,0)/pnlPcts.length
    : null;

  const holdMinutes=closed
    .map(p=>{
      const a=Number(p?.openedAtMs);
      const b=Number(p?.closedAtMs);
      if(!(a>0&&b>=a))return null;
      return (b-a)/60000;
    })
    .filter(v=>v!==null);

  const avgHoldMinutes=holdMinutes.length
    ? holdMinutes.reduce((a,b)=>a+b,0)/holdMinutes.length
    : null;

  const compactPosition=p=>({
    mint:p?.mint||null,
    symbol:p?.symbol||p?.name||null,
    openedAt:p?.openedAt||null,
    closedAt:p?.closedAt||null,
    decisionScore:__mfOwnerFinite(p?.decisionScore),
    decisionConfidence:__mfOwnerFinite(p?.decisionConfidence),
    realizedPnlSol:__mfOwnerRound(p?.realizedPnlSol,6),
    realizedPnlPct:__mfOwnerRound(p?.realizedPnlPct,2),
    closeReason:p?.closeReason||null,
    primaryReason:p?.primaryReason||null
  });

  const recentClosed=closed
    .slice(0,25)
    .map(compactPosition);

  const biggestLosses=[...closed]
    .sort(
      (a,b)=>
        (Number(a?.realizedPnlSol)||0)-
        (Number(b?.realizedPnlSol)||0)
    )
    .slice(0,8)
    .map(compactPosition);

  const biggestWins=[...closed]
    .sort(
      (a,b)=>
        (Number(b?.realizedPnlSol)||0)-
        (Number(a?.realizedPnlSol)||0)
    )
    .slice(0,8)
    .map(compactPosition);

  return {
    totalPositions:positions.length,
    openPositions:open.length,
    closedPositions:closed.length,
    wins:wins.length,
    losses:losses.length,
    flat,
    winRatePct:closed.length
      ? __mfOwnerRound(wins.length/closed.length*100,2)
      : null,
    realizedPnlSol:__mfOwnerRound(pnlSol,6),
    averagePnlPct:__mfOwnerRound(avgPnlPct,2),
    averageHoldMinutes:__mfOwnerRound(avgHoldMinutes,1),
    dailyRealizedPnlSol:__mfOwnerRound(
      paper.dailyRealizedPnl(uid),
      6
    ),
    tradeEvents:trades.length,
    recentClosed,
    biggestLosses,
    biggestWins
  };
}

function __mfOwnerCandidateDigest(uid){
  const decisions=store.decisions(uid)||[];

  return decisions
    .filter(
      d=>
        d?.mint&&
        ['BUY READY','WATCH'].includes(String(d?.state||''))
    )
    .slice(0,20)
    .map(d=>{
      const t=store.state.tokens?.[d.mint]||{};

      return {
        mint:d.mint,
        symbol:t.symbol||t.name||null,
        state:d.state,
        score:__mfOwnerFinite(d.score),
        confidence:__mfOwnerFinite(d.confidence),
        primaryReason:d.primaryReason||null,
        marketCapUsd:__mfOwnerFinite(
          t.marketCapUsd??t.marketCap
        ),
        liquidityUsd:__mfOwnerFinite(t.liquidityUsd),
        holders:__mfOwnerFinite(
          t.holderCount??t.holders
        ),
        top10Pct:__mfOwnerFinite(
          t.top10Pct??t.top10
        ),
        developerPct:__mfOwnerFinite(
          t.developerPct??t.developerSharePct
        ),
        buyPressure:__mfOwnerFinite(t.buyPressure),
        bundlePct:__mfOwnerFinite(t.bundlePct),
        sniperPct:__mfOwnerFinite(t.sniperPct)
      };
    });
}

function __mfOwnerSystemDigest(uid){
  const now=Date.now();

  return {
    generatedAt:new Date(now).toISOString(),

    scanner:{
      connected:discovery?.connected===true,
      subscribed:discovery?.subscribed===true,
      lastEventAt:discovery?.lastEventAt||null,
      lastCreateAt:discovery?.lastCreateAt||null,
      reconnects:Number(discovery?.reconnects||0),
      hotTokens:Object.keys(store.state.tokens||{}).length,
      discovered:Number(store.state.metrics?.discovered||0),
      scanned:Number(store.state.metrics?.scanned||0),
      errors:Number(store.state.metrics?.errors||0)
    },

    execution:{
      environment:paper.environment(
        store.settings(uid)
      ),
      mode:paper.mode(
        store.settings(uid)
      ),
      preOpenRpcConfigured:
        Array.isArray(__mfPreOpenRpcUrls)&&
        __mfPreOpenRpcUrls.length>0,
      killSwitch:
        store.user(uid)?.killSwitch===true
    },

    openai:{
      configured:Boolean(process.env.OPENAI_API_KEY),
      model:
        process.env.OPENAI_OWNER_COACH_MODEL||
        OPENAI_MODEL||
        process.env.OPENAI_MODEL||
        'gpt-5-mini',
      automaticBackgroundCalls:false,
      ownerManualOnly:true
    }
  };
}

function __mfOwnerIntelDigest(uid){
  return {
    system:__mfOwnerSystemDigest(uid),
    settings:store.settings(uid),
    settingsHistory:store.settingsHistory(uid,12),
    decisions:__mfOwnerDecisionDigest(uid),
    performance:__mfOwnerPerformanceDigest(uid),
    interestingCandidates:__mfOwnerCandidateDigest(uid)
  };
}

const __MF_OWNER_COACH_SCHEMA={
  type:'object',
  additionalProperties:false,

  properties:{
    executiveSummary:{
      type:'string'
    },

    healthAssessment:{
      type:'string'
    },

    performanceAssessment:{
      type:'string'
    },

    findings:{
      type:'array',
      items:{
        type:'object',
        additionalProperties:false,
        properties:{
          title:{type:'string'},
          evidence:{type:'string'},
          severity:{
            type:'string',
            enum:['INFO','LOW','MEDIUM','HIGH','CRITICAL']
          }
        },
        required:[
          'title',
          'evidence',
          'severity'
        ]
      }
    },

    proposals:{
      type:'array',
      items:{
        type:'object',
        additionalProperties:false,

        properties:{
          type:{
            type:'string',
            enum:[
              'SETTING_CHANGE',
              'LOGIC_CHANGE',
              'NEW_FUNCTION',
              'MONITOR'
            ]
          },

          title:{type:'string'},

          setting:{
            type:['string','null']
          },

          current:{
            type:[
              'number',
              'string',
              'boolean',
              'null'
            ]
          },

          proposed:{
            type:[
              'number',
              'string',
              'boolean',
              'null'
            ]
          },

          reason:{type:'string'},
          evidence:{type:'string'},

          expectedEffect:{
            type:'string'
          },

          risk:{
            type:'string'
          },

          testPlan:{
            type:'string'
          },

          confidence:{
            type:'integer',
            minimum:0,
            maximum:100
          },

          priority:{
            type:'string',
            enum:[
              'LOW',
              'MEDIUM',
              'HIGH'
            ]
          }
        },

        required:[
          'type',
          'title',
          'setting',
          'current',
          'proposed',
          'reason',
          'evidence',
          'expectedEffect',
          'risk',
          'testPlan',
          'confidence',
          'priority'
        ]
      }
    },

    questionsToInvestigate:{
      type:'array',
      items:{type:'string'}
    },

    nextReviewAfterTrades:{
      type:'integer',
      minimum:1,
      maximum:10000
    }
  },

  required:[
    'executiveSummary',
    'healthAssessment',
    'performanceAssessment',
    'findings',
    'proposals',
    'questionsToInvestigate',
    'nextReviewAfterTrades'
  ]
};

async function __mfOwnerCoachAnalyze(
  uid,
  digest,
  focus=''
){
  const key=process.env.OPENAI_API_KEY||'';

  if(!key){
    const e=new Error(
      'OpenAI API is not configured.'
    );
    e.status=503;
    e.code='OPENAI_NOT_CONFIGURED';
    throw e;
  }

  const model=
    process.env.OPENAI_OWNER_COACH_MODEL||
    OPENAI_MODEL||
    process.env.OPENAI_MODEL||
    'gpt-5-mini';

  const compact=JSON.stringify({
    focus:String(focus||'').slice(0,1200),
    digest
  }).slice(0,24000);

  const controller=new AbortController();

  const timer=setTimeout(
    ()=>controller.abort(),
    Math.max(
      10000,
      Number(
        process.env.OPENAI_OWNER_COACH_TIMEOUT_MS||
        45000
      )
    )
  );

  try{
    const response=await fetch(
      OPENAI_RESPONSES_URL,
      {
        method:'POST',

        headers:{
          authorization:`Bearer ${key}`,
          'content-type':'application/json'
        },

        body:JSON.stringify({
          model,

          instructions:[
            'You are MEMEFLOW Owner Strategy Coach.',
            'You are NOT the realtime trader.',
            'Analyze the supplied trading-engine telemetry, decisions, settings and completed paper-trade outcomes.',
            'Use only supplied evidence. Never invent missing measurements.',
            'Do not promise profit.',
            'Prefer a small number of high-value changes instead of changing many settings at once.',
            'Separate correlation from causation.',
            'SETTING_CHANGE proposals must use an existing MEMEFLOW setting name.',
            'LOGIC_CHANGE means a change to scoring/risk/decision logic.',
            'NEW_FUNCTION means a useful new engineering capability or diagnostic the owner should consider implementing.',
            'MONITOR means collect more evidence before changing behavior.',
            'Never request private keys.',
            'Never automatically execute trades.',
            'Never claim a proposal was applied.',
            'Every proposed change must include a test plan.',
            'When evidence is insufficient, say so explicitly.'
          ].join('\n'),

          input:compact,

          text:{
            format:{
              type:'json_schema',
              name:'memeflow_owner_strategy_coach',
              strict:true,
              schema:__MF_OWNER_COACH_SCHEMA
            }
          }
        }),

        signal:controller.signal
      }
    );

    const data=await response.json().catch(()=>({}));

    if(!response.ok){
      const e=new Error(
        data?.error?.message||
        `OpenAI HTTP ${response.status}`
      );

      e.status=response.status;
      e.code='OPENAI_REQUEST_FAILED';
      throw e;
    }

    const raw=openAiText(data);

    if(!raw){
      const e=new Error(
        'OpenAI returned no strategy report.'
      );
      e.status=502;
      e.code='OPENAI_EMPTY_RESPONSE';
      throw e;
    }

    let result;

    try{
      result=JSON.parse(raw);
    }catch{
      const e=new Error(
        'OpenAI returned an invalid strategy report.'
      );
      e.status=502;
      e.code='OPENAI_BAD_REPORT';
      throw e;
    }

    result.proposals=
      Array.isArray(result.proposals)
        ? result.proposals
            .slice(0,12)
            .map(p=>({
              ...p,
              applyEligible:
                p?.type==='SETTING_CHANGE' &&
                typeof p?.setting==='string' &&
                __MF_OWNER_AI_TUNABLE_SETTINGS.has(
                  p.setting
                )
            }))
        : [];

    return {
      result,
      model:data?.model||model,
      responseId:data?.id||null,
      usage:{
        inputTokens:
          Number(
            data?.usage?.input_tokens||
            0
          )||null,

        outputTokens:
          Number(
            data?.usage?.output_tokens||
            0
          )||null,

        totalTokens:
          Number(
            data?.usage?.total_tokens||
            0
          )||null
      }
    };

  }catch(error){
    if(error?.name==='AbortError'){
      const e=new Error(
        'Owner AI Coach timed out.'
      );
      e.status=504;
      e.code='OPENAI_TIMEOUT';
      throw e;
    }

    throw error;

  }finally{
    clearTimeout(timer);
  }
}

function __mfOwnerFriendlyAiError(error){
  const raw=String(
    error?.message||
    ''
  );

  if(
    /no credits remaining/i.test(raw) ||
    /insufficient[_ -]?quota/i.test(raw) ||
    /billing/i.test(raw) ||
    /credit balance/i.test(raw) ||
    /quota exceeded/i.test(raw)
  ){
    return {
      status:503,
      error:'AI_CREDITS_REQUIRED',
      message:
        'Owner AI Coach is temporarily offline because the OpenAI API balance is unavailable. MEMEFLOW trading continues normally.'
    };
  }

  if(
    error?.code==='OPENAI_NOT_CONFIGURED'
  ){
    return {
      status:503,
      error:'AI_NOT_CONFIGURED',
      message:
        'Owner AI Coach is not configured. MEMEFLOW trading continues normally.'
    };
  }

  if(
    error?.code==='OPENAI_TIMEOUT'
  ){
    return {
      status:504,
      error:'AI_TIMEOUT',
      message:
        'Owner AI Coach did not respond in time. MEMEFLOW trading continues normally.'
    };
  }

  return {
    status:
      Number(error?.status)>=400
        ? Number(error.status)
        : 503,

    error:'AI_TEMPORARILY_UNAVAILABLE',

    message:
      'Owner AI Coach is temporarily unavailable. MEMEFLOW trading continues normally.'
  };
}

function __mfOwnerProposalFromReport(
  uid,
  reportId,
  proposalIndex
){
  const state=__mfOwnerIntelState(uid);

  const report=
    state.reports.find(
      r=>r.id===reportId
    );

  if(!report){
    return {
      ok:false,
      code:'REPORT_NOT_FOUND'
    };
  }

  const index=Number(proposalIndex);

  if(
    !Number.isInteger(index) ||
    index<0
  ){
    return {
      ok:false,
      code:'INVALID_PROPOSAL_INDEX'
    };
  }

  const proposal=
    report?.result?.proposals?.[index];

  if(!proposal){
    return {
      ok:false,
      code:'PROPOSAL_NOT_FOUND'
    };
  }

  return {
    ok:true,
    report,
    proposal,
    index
  };
}

/* ============================================================
   /MEMEFLOW_OWNER_INTELLIGENCE_V1_HELPERS
   ============================================================ */
'''

routes = r'''
 /* ============================================================
    MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES
    OWNER DATA/ACTIONS ONLY
    ============================================================ */

 if(
   url.pathname==='/api/owner/intelligence' &&
   req.method==='GET'
 ){
   if(!u){
     return json(res,401,{
       error:'AUTH_REQUIRED'
     });
   }

   if(u.isOwner!==true){
     return json(res,403,{
       error:'OWNER_REQUIRED'
     });
   }

   const state=__mfOwnerIntelState(u.id);

   return json(res,200,{
     ok:true,
     owner:true,
     manualAiOnly:true,
     backgroundOpenAiCalls:false,

     ai:{
       configured:
         Boolean(process.env.OPENAI_API_KEY),

       model:
         process.env.OPENAI_OWNER_COACH_MODEL||
         OPENAI_MODEL||
         process.env.OPENAI_MODEL||
         'gpt-5-mini',

       lastStatus:
         state.lastAiStatus||'unknown',

       lastError:
         state.lastAiError||null,

       lastAt:
         state.lastAiAt||null
     },

     digest:
       __mfOwnerIntelDigest(u.id),

     reports:
       state.reports.slice(0,10),

     audit:
       state.audit.slice(0,25)
   });
 }


 if(
   url.pathname==='/api/owner/intelligence/analyze' &&
   req.method==='POST'
 ){
   if(!u){
     return json(res,401,{
       error:'AUTH_REQUIRED'
     });
   }

   if(u.isOwner!==true){
     return json(res,403,{
       error:'OWNER_REQUIRED'
     });
   }

   const state=__mfOwnerIntelState(u.id);

   try{
     const b=await body(req);
     const focus=String(b?.focus||'').trim();

     // This is the ONLY OpenAI call in this route.
     // It runs only because the owner explicitly pressed ANALYZE.
     const digest=
       __mfOwnerIntelDigest(u.id);

     const output=
       await __mfOwnerCoachAnalyze(
         u.id,
         digest,
         focus
       );

     const report={
       id:crypto.randomUUID(),
       at:new Date().toISOString(),
       settingsSnapshot:{
         ...store.settings(u.id)
       },
       digestSnapshot:{
         decisions:digest.decisions,
         performance:digest.performance,
         system:digest.system
       },
       focus,
       ...output
     };

     state.reports.unshift(report);
     state.reports=
       state.reports.slice(0,30);

     state.lastAiStatus='online';
     state.lastAiError=null;
     state.lastAiAt=report.at;

     state.audit.unshift({
       at:report.at,
       type:'AI_ANALYSIS',
       reportId:report.id,
       proposalCount:
         report?.result?.proposals?.length||0
     });

     state.audit=
       state.audit.slice(0,200);

     store.save();

     return json(res,200,{
       ok:true,
       report
     });

   }catch(error){
     const friendly=
       __mfOwnerFriendlyAiError(error);

     state.lastAiStatus='offline';
     state.lastAiError=friendly.error;
     state.lastAiAt=
       new Date().toISOString();

     store.save();

     return json(
       res,
       friendly.status,
       friendly
     );
   }
 }


 if(
   url.pathname==='/api/owner/intelligence/shadow' &&
   req.method==='POST'
 ){
   if(!u){
     return json(res,401,{
       error:'AUTH_REQUIRED'
     });
   }

   if(u.isOwner!==true){
     return json(res,403,{
       error:'OWNER_REQUIRED'
     });
   }

   const b=await body(req);

   const selected=
     __mfOwnerProposalFromReport(
       u.id,
       String(b?.reportId||''),
       b?.proposalIndex
     );

   if(!selected.ok){
     return json(res,404,{
       error:selected.code
     });
   }

   const p=selected.proposal;

   if(
     p.type!=='SETTING_CHANGE' ||
     !p.applyEligible ||
     !__MF_OWNER_AI_TUNABLE_SETTINGS.has(
       p.setting
     )
   ){
     return json(res,400,{
       error:'PROPOSAL_NOT_SHADOWABLE',
       message:
         'Only approved setting-change proposals can run through the local settings shadow test.'
     });
   }

   const current={
     ...store.settings(u.id)
   };

   const candidate={
     ...current,
     [p.setting]:p.proposed
   };

   const validated=
     validateSettings(candidate);

   if(!validated.ok){
     return json(res,400,{
       error:'PROPOSED_SETTINGS_INVALID',
       validationErrors:
         validated.errors
     });
   }

   const currentShadow=
     shadowValidateSettings(
       current,
       150
     );

   const proposedShadow=
     shadowValidateSettings(
       validated.settings,
       150
     );

   return json(res,200,{
     ok:true,

     setting:p.setting,
     current:
       current[p.setting],

     proposed:
       validated.settings[p.setting],

     testType:
       'CURRENT_LIVE_FEED_SHADOW',

     note:
       'This does not simulate historical P&L. It compares how the current live candidate feed would classify under each setting set.',

     currentShadow,
     proposedShadow
   });
 }


 if(
   url.pathname==='/api/owner/intelligence/apply' &&
   req.method==='POST'
 ){
   if(!u){
     return json(res,401,{
       error:'AUTH_REQUIRED'
     });
   }

   if(u.isOwner!==true){
     return json(res,403,{
       error:'OWNER_REQUIRED'
     });
   }

   const b=await body(req);

   if(b?.confirm!=='APPLY'){
     return json(res,400,{
       error:'OWNER_CONFIRMATION_REQUIRED'
     });
   }

   const selected=
     __mfOwnerProposalFromReport(
       u.id,
       String(b?.reportId||''),
       b?.proposalIndex
     );

   if(!selected.ok){
     return json(res,404,{
       error:selected.code
     });
   }

   const {
     report,
     proposal:p,
     index
   }=selected;

   if(
     p.type!=='SETTING_CHANGE' ||
     !p.applyEligible ||
     !__MF_OWNER_AI_TUNABLE_SETTINGS.has(
       p.setting
     )
   ){
     return json(res,400,{
       error:'PROPOSAL_NOT_APPLICABLE'
     });
   }

   const current={
     ...store.settings(u.id)
   };

   // Prevent application of a stale AI proposal after the owner
   // has manually changed that setting since analysis.
   const expected=
     report?.settingsSnapshot?.[
       p.setting
     ];

   if(
     JSON.stringify(
       current[p.setting]
     )!==
     JSON.stringify(expected)
   ){
     return json(res,409,{
       error:'SETTING_CHANGED_SINCE_ANALYSIS',
       setting:p.setting,
       analyzedValue:expected,
       currentValue:
         current[p.setting]
     });
   }

   const candidate={
     ...current,
     [p.setting]:p.proposed
   };

   const validated=
     validateSettings(candidate);

   if(!validated.ok){
     return json(res,400,{
       error:'PROPOSED_SETTINGS_INVALID',
       validationErrors:
         validated.errors
     });
   }

   // Local, free shadow test before mutation.
   const shadow=
     shadowValidateSettings(
       validated.settings,
       150
     );

   const before={
     ...current
   };

   const after=
     store.setSettings(
       u.id,
       {
         [p.setting]:
           validated.settings[p.setting]
       }
     );

   store.recordSettingsChange(
     u.id,
     before,
     {...after},
     {
       actor:u.id,
       source:'owner-ai-approved'
     }
   );

   const reevaluation=
     reevaluateUser(u.id);

   const state=
     __mfOwnerIntelState(u.id);

   const auditRow={
     at:new Date().toISOString(),
     type:'OWNER_APPLIED_AI_PROPOSAL',
     reportId:report.id,
     proposalIndex:index,
     setting:p.setting,
     from:before[p.setting],
     to:after[p.setting],
     shadow,
     reevaluation
   };

   state.audit.unshift(auditRow);
   state.audit=
     state.audit.slice(0,200);

   store.save();

   return json(res,200,{
     ok:true,
     applied:true,
     setting:p.setting,
     from:before[p.setting],
     to:after[p.setting],
     shadow,
     reevaluation
   });
 }


 if(
   url.pathname==='/api/owner/intelligence/chat' &&
   req.method==='POST'
 ){
   if(!u){
     return json(res,401,{
       error:'AUTH_REQUIRED'
     });
   }

   if(u.isOwner!==true){
     return json(res,403,{
       error:'OWNER_REQUIRED'
     });
   }

   const b=await body(req);
   const message=
     String(b?.message||'').trim();

   if(!message){
     return json(res,400,{
       error:'MESSAGE_REQUIRED'
     });
   }

   const state=
     __mfOwnerIntelState(u.id);

   try{
     const digest=
       __mfOwnerIntelDigest(u.id);

     const recentReports=
       state.reports
         .slice(0,3)
         .map(r=>({
           id:r.id,
           at:r.at,
           executiveSummary:
             r?.result?.executiveSummary||null,
           proposals:
             (r?.result?.proposals||[])
               .slice(0,6)
               .map(p=>({
                 type:p.type,
                 title:p.title,
                 setting:p.setting,
                 current:p.current,
                 proposed:p.proposed,
                 reason:p.reason,
                 confidence:p.confidence
               }))
         }));

     const prompt=[
       'You are speaking directly to the MEMEFLOW owner.',
       'Act as a strategy coach and engineering advisor, not as a realtime trader.',
       'Answer the owner question using only the supplied current engine data and recent coach reports.',
       'You may recommend settings, tests, diagnostics, scoring changes or new functions.',
       'Do not claim any setting was changed unless the supplied context explicitly says it was applied.',
       '',
       'OWNER QUESTION:',
       message
     ].join('\n');

     const output=
       await callMemeflowOpenAI(
         prompt,
         {
           digest,
           recentReports
         },
         'owner-coach-chat'
       );

     state.lastAiStatus='online';
     state.lastAiError=null;
     state.lastAiAt=
       new Date().toISOString();

     store.save();

     return json(res,200,{
       ok:true,
       text:output.text,
       model:output.model,
       responseId:
         output.responseId||null
     });

   }catch(error){
     const friendly=
       __mfOwnerFriendlyAiError(error);

     state.lastAiStatus='offline';
     state.lastAiError=friendly.error;
     state.lastAiAt=
       new Date().toISOString();

     store.save();

     return json(
       res,
       friendly.status,
       friendly
     );
   }
 }

 /* ============================================================
    /MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES
    ============================================================ */
'''

if HELPER_MARKER not in text:
    anchor = "async function handler(req,res){"
    if anchor not in text:
        raise SystemExit(
            "[patch] ERROR: handler anchor not found"
        )

    text = text.replace(
        anchor,
        helpers + "\n\n" + anchor,
        1
    )
else:
    print("[patch] backend helpers already installed")

if ROUTE_MARKER not in text:
    anchor = " /* MEMEFLOW_NATIVE_AI_V46_ROUTES_BEGIN */"
    if anchor not in text:
        raise SystemExit(
            "[patch] ERROR: API route anchor not found"
        )

    text = text.replace(
        anchor,
        routes + "\n\n" + anchor,
        1
    )
else:
    print("[patch] backend routes already installed")

path.write_text(text,encoding="utf-8")
print("[patch] backend updated")
PY

# ------------------------------------------------------------
# OWNER PAGE
# ------------------------------------------------------------
cat > "$HTML" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  >
  <meta
    http-equiv="Cache-Control"
    content="no-cache, no-store, must-revalidate"
  >
  <title>MEMEFLOW · Owner Intelligence</title>
  <link
    rel="stylesheet"
    href="/owner-intelligence.css?v=1"
  >
</head>

<body>
  <div class="oi-shell">

    <header class="oi-top">
      <div>
        <div class="oi-kicker">OWNER ONLY</div>
        <h1>OWNER INTELLIGENCE</h1>
        <p>
          MEMEFLOW Strategy Coach · performance · diagnostics ·
          shadow validation
        </p>
      </div>

      <div class="oi-top-actions">
        <a
          class="oi-btn ghost"
          href="/trading.html"
        >
          TRADING TERMINAL
        </a>

        <button
          class="oi-btn"
          id="refreshBtn"
          type="button"
        >
          REFRESH
        </button>
      </div>
    </header>

    <div
      id="accessError"
      class="oi-access"
      hidden
    >
      OWNER ACCESS REQUIRED
    </div>

    <main id="ownerApp" hidden>

      <section class="oi-notice">
        <div>
          <strong>
            OpenAI is not in the realtime trading loop.
          </strong>
          <span>
            API is called only when the owner presses ANALYZE
            or sends an Owner Chat message.
          </span>
        </div>

        <div
          class="oi-ai-status"
          id="aiStatus"
        >
          AI —
        </div>
      </section>

      <section class="oi-grid oi-grid-4">
        <article class="oi-stat">
          <span>REALIZED P&L</span>
          <strong id="pnlValue">—</strong>
          <small id="pnlSub">—</small>
        </article>

        <article class="oi-stat">
          <span>WIN RATE</span>
          <strong id="winRateValue">—</strong>
          <small id="winRateSub">—</small>
        </article>

        <article class="oi-stat">
          <span>OPEN POSITIONS</span>
          <strong id="positionsValue">—</strong>
          <small id="positionsSub">—</small>
        </article>

        <article class="oi-stat">
          <span>ENGINE</span>
          <strong id="engineValue">—</strong>
          <small id="engineSub">—</small>
        </article>
      </section>

      <section class="oi-grid oi-grid-2">

        <article class="oi-panel">
          <div class="oi-panel-head">
            <div>
              <span class="oi-eyebrow">
                REALTIME ENGINE
              </span>
              <h2>Decision state</h2>
            </div>
          </div>

          <div
            id="decisionStats"
            class="oi-decision-stats"
          ></div>

          <div class="oi-divider"></div>

          <h3>Top blockers / reasons</h3>
          <div
            id="reasonList"
            class="oi-list"
          ></div>
        </article>

        <article class="oi-panel">
          <div class="oi-panel-head">
            <div>
              <span class="oi-eyebrow">
                SYSTEM
              </span>
              <h2>Health</h2>
            </div>
          </div>

          <div
            id="healthList"
            class="oi-list"
          ></div>
        </article>

      </section>

      <section class="oi-panel oi-coach">

        <div class="oi-panel-head oi-coach-head">
          <div>
            <span class="oi-eyebrow">
              OPENAI · OWNER ONLY
            </span>
            <h2>AI Strategy Coach</h2>
            <p>
              Reviews aggregated MEMEFLOW results.
              Does not trade automatically.
            </p>
          </div>

          <button
            class="oi-btn primary"
            id="analyzeBtn"
            type="button"
          >
            ANALYZE PERFORMANCE
          </button>
        </div>

        <div class="oi-focus">
          <input
            id="focusInput"
            type="text"
            maxlength="1200"
            placeholder="Optional: What should OpenAI focus on? Example: Why are we missing winners?"
          >
        </div>

        <div
          id="coachEmpty"
          class="oi-empty"
        >
          No AI report yet. Press ANALYZE PERFORMANCE when
          you want the owner coach to review the engine.
        </div>

        <div
          id="coachReport"
          hidden
        >
          <div class="oi-report-summary">
            <div>
              <span>EXECUTIVE SUMMARY</span>
              <p id="executiveSummary"></p>
            </div>

            <div>
              <span>PERFORMANCE</span>
              <p id="performanceAssessment"></p>
            </div>

            <div>
              <span>SYSTEM HEALTH</span>
              <p id="healthAssessment"></p>
            </div>
          </div>

          <h3>Findings</h3>
          <div
            id="findingsList"
            class="oi-findings"
          ></div>

          <h3>Recommended changes</h3>
          <div
            id="proposalList"
            class="oi-proposals"
          ></div>
        </div>
      </section>

      <section class="oi-grid oi-grid-2">

        <article class="oi-panel">
          <div class="oi-panel-head">
            <div>
              <span class="oi-eyebrow">
                SETTINGS SAFETY
              </span>
              <h2>Owner audit log</h2>
            </div>
          </div>

          <div
            id="auditList"
            class="oi-list"
          ></div>
        </article>

        <article class="oi-panel">
          <div class="oi-panel-head">
            <div>
              <span class="oi-eyebrow">
                OWNER · OPENAI
              </span>
              <h2>Strategy Chat</h2>
            </div>
          </div>

          <div
            id="ownerChat"
            class="oi-chat"
          >
            <div class="oi-chat-message assistant">
              Ask about engine performance, bad entries,
              missed opportunities, filters, scoring logic
              or a new function you should add.
            </div>
          </div>

          <div class="oi-chat-compose">
            <textarea
              id="chatInput"
              rows="3"
              placeholder="Example: Which filter should I investigate first and why?"
            ></textarea>

            <button
              class="oi-btn primary"
              id="chatSendBtn"
              type="button"
            >
              SEND
            </button>
          </div>
        </article>

      </section>

    </main>
  </div>

  <script
    type="module"
    src="/owner-intelligence.js?v=1"
  ></script>
</body>
</html>
HTML

# ------------------------------------------------------------
# CSS
# ------------------------------------------------------------
cat > "$CSS" <<'CSS'
:root{
  --bg:#05080c;
  --surface:#0c1218;
  --surface2:#101820;
  --line:#1d2a34;
  --line2:#263845;
  --text:#eef5f8;
  --muted:#7e8d99;
  --cyan:#57dcff;
  --green:#51e7a8;
  --red:#ff6878;
  --amber:#efc86a;
  --radius:16px;
}

*{box-sizing:border-box}

html{
  background:var(--bg);
  color:var(--text);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body{
  margin:0;
  min-height:100vh;
  background:
    radial-gradient(
      circle at 80% -10%,
      rgba(87,220,255,.07),
      transparent 33%
    ),
    var(--bg);
}

button,
input,
textarea{
  font:inherit;
}

.oi-shell{
  width:min(1500px,100%);
  margin:0 auto;
  padding:
    22px
    22px
    calc(60px + env(safe-area-inset-bottom,0px));
}

.oi-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  margin-bottom:18px;
}

.oi-kicker,
.oi-eyebrow{
  color:var(--cyan);
  font-size:9px;
  font-weight:900;
  letter-spacing:.16em;
}

.oi-top h1{
  margin:5px 0 4px;
  font-size:26px;
  letter-spacing:-.035em;
}

.oi-top p,
.oi-panel-head p{
  margin:0;
  color:var(--muted);
  font-size:11px;
}

.oi-top-actions{
  display:flex;
  gap:8px;
}

.oi-btn{
  min-height:38px;
  padding:8px 12px;
  border:1px solid var(--line2);
  border-radius:10px;
  background:var(--surface2);
  color:var(--text);
  text-decoration:none;
  cursor:pointer;
  font-size:10px;
  font-weight:850;
  letter-spacing:.04em;
}

.oi-btn:hover{
  border-color:rgba(87,220,255,.55);
}

.oi-btn.primary{
  background:var(--cyan);
  border-color:var(--cyan);
  color:#031016;
}

.oi-btn.ghost{
  background:transparent;
}

.oi-btn.danger{
  color:#ffabb4;
  border-color:rgba(255,104,120,.30);
}

.oi-btn:disabled{
  opacity:.42;
  cursor:default;
}

.oi-access{
  margin-top:30px;
  border:1px solid rgba(255,104,120,.3);
  background:rgba(255,104,120,.05);
  color:#ff9daa;
  border-radius:14px;
  padding:30px;
  text-align:center;
  font-weight:900;
}

.oi-notice{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  padding:12px 14px;
  border:1px solid rgba(87,220,255,.15);
  background:rgba(87,220,255,.035);
  border-radius:14px;
  margin-bottom:12px;
}

.oi-notice strong{
  display:block;
  font-size:11px;
}

.oi-notice span{
  display:block;
  margin-top:3px;
  color:var(--muted);
  font-size:9px;
}

.oi-ai-status{
  flex:none;
  padding:7px 10px;
  border:1px solid var(--line);
  border-radius:999px;
  color:var(--muted);
  font-size:9px;
  font-weight:850;
}

.oi-ai-status.online{
  color:var(--green);
  border-color:rgba(81,231,168,.25);
}

.oi-ai-status.offline{
  color:var(--amber);
  border-color:rgba(239,200,106,.25);
}

.oi-grid{
  display:grid;
  gap:12px;
  margin-bottom:12px;
}

.oi-grid-4{
  grid-template-columns:repeat(4,1fr);
}

.oi-grid-2{
  grid-template-columns:repeat(2,minmax(0,1fr));
}

.oi-stat,
.oi-panel{
  border:1px solid rgba(38,56,69,.85);
  background:
    linear-gradient(
      180deg,
      rgba(15,22,30,.95),
      rgba(8,13,18,.97)
    );
  border-radius:var(--radius);
}

.oi-stat{
  padding:14px;
}

.oi-stat span{
  display:block;
  color:var(--muted);
  font-size:8px;
  letter-spacing:.12em;
}

.oi-stat strong{
  display:block;
  margin-top:7px;
  font-size:23px;
}

.oi-stat small{
  display:block;
  color:var(--muted);
  font-size:9px;
  margin-top:4px;
}

.oi-panel{
  padding:15px;
  margin-bottom:12px;
}

.oi-panel-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  margin-bottom:14px;
}

.oi-panel-head h2{
  margin:4px 0 0;
  font-size:14px;
}

.oi-panel h3{
  margin:15px 0 8px;
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:#a8b5be;
}

.oi-decision-stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:7px;
}

.oi-decision{
  padding:10px;
  border:1px solid var(--line);
  border-radius:10px;
  background:rgba(255,255,255,.012);
}

.oi-decision span{
  display:block;
  color:var(--muted);
  font-size:7px;
}

.oi-decision strong{
  display:block;
  margin-top:5px;
  font-size:17px;
}

.oi-list{
  display:grid;
  gap:6px;
}

.oi-row{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  padding:8px 9px;
  border:1px solid rgba(38,56,69,.65);
  border-radius:9px;
  background:rgba(255,255,255,.012);
  font-size:9px;
}

.oi-row span{
  color:var(--muted);
}

.oi-row strong{
  text-align:right;
  overflow-wrap:anywhere;
}

.oi-divider{
  height:1px;
  background:var(--line);
  margin:14px 0;
}

.oi-coach-head{
  align-items:center;
}

.oi-focus{
  margin-bottom:14px;
}

.oi-focus input,
.oi-chat-compose textarea{
  width:100%;
  border:1px solid var(--line);
  border-radius:11px;
  outline:none;
  background:#0b1218;
  color:var(--text);
}

.oi-focus input{
  min-height:42px;
  padding:9px 11px;
  font-size:10px;
}

.oi-chat-compose textarea{
  resize:vertical;
  min-height:82px;
  padding:10px;
  font-size:11px;
}

.oi-focus input:focus,
.oi-chat-compose textarea:focus{
  border-color:rgba(87,220,255,.42);
}

.oi-empty{
  padding:28px 15px;
  border:1px dashed var(--line);
  border-radius:12px;
  text-align:center;
  color:var(--muted);
  font-size:10px;
}

.oi-report-summary{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
}

.oi-report-summary>div{
  border:1px solid var(--line);
  border-radius:11px;
  padding:11px;
}

.oi-report-summary span{
  color:var(--cyan);
  font-size:7px;
  font-weight:900;
  letter-spacing:.12em;
}

.oi-report-summary p{
  margin:7px 0 0;
  color:#bbc6cd;
  font-size:10px;
  line-height:1.55;
}

.oi-findings{
  display:grid;
  gap:7px;
}

.oi-finding{
  padding:10px;
  border:1px solid var(--line);
  border-radius:10px;
}

.oi-finding-head{
  display:flex;
  justify-content:space-between;
  gap:10px;
  font-size:10px;
  font-weight:800;
}

.oi-finding p{
  margin:6px 0 0;
  color:var(--muted);
  font-size:9px;
  line-height:1.5;
}

.oi-severity{
  font-size:7px;
  color:var(--amber);
}

.oi-proposals{
  display:grid;
  gap:9px;
}

.oi-proposal{
  border:1px solid var(--line);
  border-radius:12px;
  padding:12px;
  background:rgba(255,255,255,.012);
}

.oi-proposal-top{
  display:flex;
  justify-content:space-between;
  gap:12px;
}

.oi-proposal-title{
  font-size:11px;
  font-weight:850;
}

.oi-proposal-type{
  font-size:7px;
  font-weight:850;
  color:var(--cyan);
}

.oi-proposal p{
  margin:7px 0 0;
  color:var(--muted);
  line-height:1.5;
  font-size:9px;
}

.oi-setting-diff{
  display:flex;
  gap:7px;
  align-items:center;
  margin-top:10px;
  font-size:9px;
}

.oi-setting-diff code{
  border:1px solid var(--line);
  padding:5px 7px;
  border-radius:7px;
  color:#cbd7dd;
}

.oi-proposal-actions{
  display:flex;
  gap:7px;
  flex-wrap:wrap;
  margin-top:10px;
}

.oi-shadow{
  margin-top:9px;
  border-left:2px solid var(--cyan);
  padding:8px 10px;
  background:rgba(87,220,255,.035);
  color:#9eb0bb;
  font-size:8px;
  line-height:1.5;
}

.oi-chat{
  height:300px;
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:9px;
  border:1px solid var(--line);
  border-radius:11px;
  background:#080e13;
}

.oi-chat-message{
  max-width:90%;
  padding:9px 10px;
  border-radius:10px;
  font-size:10px;
  line-height:1.55;
  white-space:pre-wrap;
}

.oi-chat-message.assistant{
  align-self:flex-start;
  border:1px solid var(--line);
  background:var(--surface2);
}

.oi-chat-message.user{
  align-self:flex-end;
  border:1px solid rgba(87,220,255,.18);
  background:rgba(87,220,255,.07);
}

.oi-chat-message.error{
  color:#ffabb4;
  border-color:rgba(255,104,120,.25);
}

.oi-chat-compose{
  display:grid;
  gap:8px;
  margin-top:8px;
}

@media(max-width:900px){
  .oi-grid-4{
    grid-template-columns:repeat(2,1fr);
  }

  .oi-grid-2,
  .oi-report-summary{
    grid-template-columns:1fr;
  }
}

@media(max-width:650px){
  .oi-shell{
    padding:
      14px
      10px
      calc(35px + env(safe-area-inset-bottom,0px));
  }

  .oi-top{
    align-items:flex-start;
    flex-direction:column;
  }

  .oi-top-actions{
    width:100%;
  }

  .oi-top-actions .oi-btn{
    flex:1;
    text-align:center;
  }

  .oi-grid-4{
    grid-template-columns:repeat(2,1fr);
  }

  .oi-decision-stats{
    grid-template-columns:repeat(2,1fr);
  }

  .oi-notice{
    align-items:flex-start;
    flex-direction:column;
  }

  .oi-coach-head{
    align-items:flex-start;
    flex-direction:column;
  }

  .oi-coach-head .oi-btn{
    width:100%;
  }
}
CSS

# ------------------------------------------------------------
# OWNER PAGE JS
# ------------------------------------------------------------
cat > "$JS" <<'JS'
const $=id=>document.getElementById(id);

let ownerData=null;
let activeReport=null;
let busy=false;

function esc(value){
  return String(value??'')
    .replace(
      /[&<>"']/g,
      ch=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[ch]
    );
}

function num(value,digits=2){
  const n=Number(value);
  if(!Number.isFinite(n))return '—';

  return n.toLocaleString(
    undefined,
    {
      maximumFractionDigits:digits
    }
  );
}

function pct(value){
  return Number.isFinite(Number(value))
    ? `${num(value,2)}%`
    : '—';
}

async function api(
  path,
  options={}
){
  const response=await fetch(
    path,
    {
      credentials:'same-origin',
      cache:'no-store',
      ...options
    }
  );

  let payload={};

  try{
    payload=await response.json();
  }catch{}

  if(!response.ok){
    const error=new Error(
      payload?.message||
      payload?.error||
      `HTTP ${response.status}`
    );

    error.status=response.status;
    error.payload=payload;
    throw error;
  }

  return payload;
}

function renderAiStatus(ai={}){
  const node=$('aiStatus');

  const status=
    ai.configured!==true
      ? 'offline'
      : String(ai.lastStatus||'unknown');

  node.className=
    `oi-ai-status ${
      status==='online'
        ? 'online'
        : status==='offline'
          ? 'offline'
          : ''
    }`;

  if(ai.configured!==true){
    node.textContent='AI · NOT CONFIGURED';
    return;
  }

  if(status==='offline'){
    node.textContent='AI · OFFLINE';
    return;
  }

  if(status==='online'){
    node.textContent='AI · ONLINE';
    return;
  }

  node.textContent='AI · READY';
}

function renderOverview(data){
  ownerData=data;

  const digest=data?.digest||{};
  const perf=digest?.performance||{};
  const system=digest?.system||{};
  const decisions=digest?.decisions||{};

  $('pnlValue').textContent=
    `${num(perf.realizedPnlSol,6)} SOL`;

  $('pnlSub').textContent=
    `Today ${num(perf.dailyRealizedPnlSol,6)} SOL`;

  $('winRateValue').textContent=
    pct(perf.winRatePct);

  $('winRateSub').textContent=
    `${num(perf.wins,0)} wins · ${num(perf.losses,0)} losses`;

  $('positionsValue').textContent=
    num(perf.openPositions,0);

  $('positionsSub').textContent=
    `${num(perf.closedPositions,0)} closed`;

  $('engineValue').textContent=
    system?.scanner?.connected
      ? 'ONLINE'
      : 'DEGRADED';

  $('engineSub').textContent=
    `${String(system?.execution?.mode||'—').toUpperCase()} · ${String(system?.execution?.environment||'—').toUpperCase()}`;

  const states=decisions.states||{};

  $('decisionStats').innerHTML=[
    ['BUY READY',states['BUY READY']||0],
    ['WATCH',states.WATCH||0],
    ['WAITING',states.WAITING||0],
    ['BLOCKED',states.BLOCKED||0]
  ].map(([name,count])=>`
    <div class="oi-decision">
      <span>${esc(name)}</span>
      <strong>${esc(count)}</strong>
    </div>
  `).join('');

  const reasons=
    Array.isArray(decisions.topReasons)
      ? decisions.topReasons
      : [];

  $('reasonList').innerHTML=
    reasons.length
      ? reasons.map(r=>`
          <div class="oi-row">
            <span>${esc(r.name)}</span>
            <strong>${esc(r.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No current reasons</span>
            <strong>—</strong>
          </div>
        `;

  const scanner=system.scanner||{};
  const execution=system.execution||{};

  $('healthList').innerHTML=[
    [
      'Pump WebSocket',
      scanner.connected
        ? 'CONNECTED'
        : 'DISCONNECTED'
    ],
    [
      'Subscription',
      scanner.subscribed
        ? 'ACTIVE'
        : 'PENDING'
    ],
    [
      'Hot tokens',
      scanner.hotTokens??'—'
    ],
    [
      'Scanner errors',
      scanner.errors??'—'
    ],
    [
      'Pre-open RPC',
      execution.preOpenRpcConfigured
        ? 'CONFIGURED'
        : 'NOT CONFIGURED'
    ],
    [
      'Kill switch',
      execution.killSwitch
        ? 'ACTIVE'
        : 'CLEAR'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  renderAiStatus(data.ai);

  renderAudit(data.audit||[]);

  const reports=
    Array.isArray(data.reports)
      ? data.reports
      : [];

  if(reports.length){
    renderReport(reports[0]);
  }
}

function renderAudit(rows){
  $('auditList').innerHTML=
    rows.length
      ? rows.slice(0,15).map(row=>{
          const when=row?.at
            ? new Date(row.at).toLocaleString()
            : '—';

          let detail=row?.type||'EVENT';

          if(row?.setting){
            detail+=
              ` · ${row.setting}: `+
              `${String(row.from)} → ${String(row.to)}`;
          }

          return `
            <div class="oi-row">
              <span>${esc(when)}</span>
              <strong>${esc(detail)}</strong>
            </div>
          `;
        }).join('')
      : `
          <div class="oi-row">
            <span>No owner AI changes yet</span>
            <strong>—</strong>
          </div>
        `;
}

function renderReport(report){
  if(!report?.result)return;

  activeReport=report;

  $('coachEmpty').hidden=true;
  $('coachReport').hidden=false;

  const r=report.result;

  $('executiveSummary').textContent=
    r.executiveSummary||'—';

  $('performanceAssessment').textContent=
    r.performanceAssessment||'—';

  $('healthAssessment').textContent=
    r.healthAssessment||'—';

  const findings=
    Array.isArray(r.findings)
      ? r.findings
      : [];

  $('findingsList').innerHTML=
    findings.length
      ? findings.map(f=>`
          <div class="oi-finding">
            <div class="oi-finding-head">
              <span>${esc(f.title)}</span>
              <span class="oi-severity">
                ${esc(f.severity)}
              </span>
            </div>
            <p>${esc(f.evidence)}</p>
          </div>
        `).join('')
      : '<div class="oi-empty">No findings.</div>';

  const proposals=
    Array.isArray(r.proposals)
      ? r.proposals
      : [];

  $('proposalList').innerHTML=
    proposals.length
      ? proposals
          .map(
            (p,index)=>
              proposalHtml(
                report,
                p,
                index
              )
          )
          .join('')
      : `
          <div class="oi-empty">
            AI recommends no changes yet.
          </div>
        `;

  bindProposalButtons();
}

function proposalHtml(
  report,
  p,
  index
){
  const settingChange=
    p.type==='SETTING_CHANGE';

  const diff=
    settingChange
      ? `
          <div class="oi-setting-diff">
            <code>
              ${esc(p.setting||'SETTING')}
            </code>
            <code>
              ${esc(p.current)}
            </code>
            <span>→</span>
            <code>
              ${esc(p.proposed)}
            </code>
          </div>
        `
      : '';

  const buttons=
    p.applyEligible===true
      ? `
          <button
            class="oi-btn"
            data-shadow="${index}"
            data-report="${esc(report.id)}"
            type="button"
          >
            SHADOW TEST
          </button>

          <button
            class="oi-btn primary"
            data-apply="${index}"
            data-report="${esc(report.id)}"
            type="button"
          >
            APPLY
          </button>
        `
      : `
          <button
            class="oi-btn"
            data-discuss="${index}"
            type="button"
          >
            DISCUSS WITH AI
          </button>
        `;

  return `
    <article
      class="oi-proposal"
      data-proposal-row="${index}"
    >
      <div class="oi-proposal-top">
        <div>
          <div class="oi-proposal-title">
            ${esc(p.title)}
          </div>

          <div class="oi-proposal-type">
            ${esc(p.type)}
            · ${esc(p.priority)}
            · ${esc(p.confidence)}%
          </div>
        </div>
      </div>

      ${diff}

      <p>
        <strong>Why:</strong>
        ${esc(p.reason)}
      </p>

      <p>
        <strong>Evidence:</strong>
        ${esc(p.evidence)}
      </p>

      <p>
        <strong>Expected:</strong>
        ${esc(p.expectedEffect)}
      </p>

      <p>
        <strong>Risk:</strong>
        ${esc(p.risk)}
      </p>

      <p>
        <strong>Test:</strong>
        ${esc(p.testPlan)}
      </p>

      <div class="oi-proposal-actions">
        ${buttons}
      </div>

      <div
        class="oi-shadow"
        data-shadow-output="${index}"
        hidden
      ></div>
    </article>
  `;
}

function bindProposalButtons(){
  document
    .querySelectorAll('[data-shadow]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>runShadow(button)
      );
    });

  document
    .querySelectorAll('[data-apply]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>applyProposal(button)
      );
    });

  document
    .querySelectorAll('[data-discuss]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>{
          const index=
            Number(button.dataset.discuss);

          const p=
            activeReport
              ?.result
              ?.proposals
              ?.[index];

          if(!p)return;

          $('chatInput').value=
            `Let's discuss this recommendation before changing anything:\n${p.title}\n\nWhy do you recommend it, what evidence is missing, and how should I test it safely?`;

          $('chatInput').focus();
        }
      );
    });
}

async function runShadow(button){
  if(busy)return;

  const index=
    Number(button.dataset.shadow);

  const reportId=
    String(button.dataset.report||'');

  const output=
    document.querySelector(
      `[data-shadow-output="${index}"]`
    );

  busy=true;
  button.disabled=true;
  button.textContent='TESTING…';

  try{
    const result=await api(
      '/api/owner/intelligence/shadow',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          reportId,
          proposalIndex:index
        })
      }
    );

    const before=
      result?.currentShadow?.counts||{};

    const after=
      result?.proposedShadow?.counts||{};

    if(output){
      output.hidden=false;
      output.textContent=
        `LIVE FEED SHADOW · `+
        `${result.setting}: `+
        `${String(result.current)} → ${String(result.proposed)}\n`+
        `BUY READY ${before['BUY READY']||0} → ${after['BUY READY']||0} · `+
        `WATCH ${before.WATCH||0} → ${after.WATCH||0} · `+
        `BLOCKED ${before.BLOCKED||0} → ${after.BLOCKED||0}\n`+
        `No settings were changed.`;
    }

  }catch(error){
    if(output){
      output.hidden=false;
      output.textContent=
        error?.payload?.validationErrors?.join('\n')||
        error.message;
    }

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='SHADOW TEST';
  }
}

async function applyProposal(button){
  if(busy)return;

  const index=
    Number(button.dataset.apply);

  const reportId=
    String(button.dataset.report||'');

  const proposal=
    activeReport
      ?.result
      ?.proposals
      ?.[index];

  if(!proposal)return;

  const confirmed=window.confirm(
    `Apply owner-approved setting change?\n\n`+
    `${proposal.setting}: `+
    `${String(proposal.current)} → `+
    `${String(proposal.proposed)}\n\n`+
    `MEMEFLOW will re-evaluate current candidates after application.`
  );

  if(!confirmed)return;

  busy=true;
  button.disabled=true;
  button.textContent='APPLYING…';

  try{
    const result=await api(
      '/api/owner/intelligence/apply',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          reportId,
          proposalIndex:index,
          confirm:'APPLY'
        })
      }
    );

    alert(
      `Applied:\n`+
      `${result.setting}: `+
      `${String(result.from)} → `+
      `${String(result.to)}`
    );

    await load();

  }catch(error){
    alert(
      error?.payload?.validationErrors?.join('\n')||
      error.message
    );

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='APPLY';
  }
}

async function analyze(){
  if(busy)return;

  const button=$('analyzeBtn');
  busy=true;

  button.disabled=true;
  button.textContent='OPENAI ANALYZING…';

  try{
    const result=await api(
      '/api/owner/intelligence/analyze',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          focus:
            $('focusInput').value.trim()
        })
      }
    );

    renderReport(result.report);

    await load({
      preserveReport:true
    });

  }catch(error){
    const message=
      error?.payload?.message||
      error.message;

    addChat(
      'assistant',
      message,
      true
    );

    await load({
      preserveReport:true
    });

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='ANALYZE PERFORMANCE';
  }
}

function addChat(
  role,
  text,
  error=false
){
  const node=document.createElement('div');

  node.className=
    `oi-chat-message ${role}`+
    (error?' error':'');

  node.textContent=String(text||'');

  $('ownerChat').appendChild(node);
  $('ownerChat').scrollTop=
    $('ownerChat').scrollHeight;
}

async function sendChat(){
  if(busy)return;

  const input=$('chatInput');
  const message=input.value.trim();

  if(!message)return;

  addChat('user',message);
  input.value='';

  const button=$('chatSendBtn');

  busy=true;
  button.disabled=true;
  button.textContent='THINKING…';

  try{
    const result=await api(
      '/api/owner/intelligence/chat',
      {
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify({
          message
        })
      }
    );

    addChat(
      'assistant',
      result.text
    );

  }catch(error){
    addChat(
      'assistant',
      error?.payload?.message||
      error.message,
      true
    );

  }finally{
    busy=false;
    button.disabled=false;
    button.textContent='SEND';
  }
}

async function load(
  {
    preserveReport=false
  }={}
){
  try{
    const data=await api(
      '/api/owner/intelligence'
    );

    $('accessError').hidden=true;
    $('ownerApp').hidden=false;

    const previous=
      preserveReport
        ? activeReport
        : null;

    renderOverview(data);

    if(previous){
      renderReport(previous);
    }

  }catch(error){
    if(
      error.status===401 ||
      error.status===403
    ){
      $('ownerApp').hidden=true;
      $('accessError').hidden=false;
      return;
    }

    $('ownerApp').hidden=true;
    $('accessError').hidden=false;
    $('accessError').textContent=
      `OWNER INTELLIGENCE ERROR: ${error.message}`;
  }
}

$('refreshBtn')
  .addEventListener(
    'click',
    ()=>load()
  );

$('analyzeBtn')
  .addEventListener(
    'click',
    analyze
  );

$('chatSendBtn')
  .addEventListener(
    'click',
    sendChat
  );

$('chatInput')
  .addEventListener(
    'keydown',
    event=>{
      if(
        event.key==='Enter' &&
        !event.shiftKey &&
        !event.isComposing
      ){
        event.preventDefault();
        sendChat();
      }
    }
  );

load();
JS

# ------------------------------------------------------------
# OWNER LINK INSIDE TRADING TERMINAL
# Only appears if /api/owner/intelligence confirms isOwner=true
# ------------------------------------------------------------
cat > "$LINKJS" <<'JS'
(() => {
  'use strict';

  if(window.__mfOwnerIntelligenceLinkV1)return;
  window.__mfOwnerIntelligenceLinkV1=true;

  async function mount(){
    try{
      const response=await fetch(
        '/api/owner/intelligence',
        {
          credentials:'same-origin',
          cache:'no-store'
        }
      );

      if(!response.ok)return;

      const data=await response.json();

      if(data?.owner!==true)return;

      if(
        document.getElementById(
          'ownerIntelligenceBtn'
        )
      ){
        return;
      }

      const host=
        document.querySelector(
          '.topbar .top-actions'
        );

      if(!host)return;

      const link=document.createElement('a');

      link.id='ownerIntelligenceBtn';
      link.href='/owner-intelligence.html';
      link.textContent='OWNER AI';

      const wallet=
        document.getElementById('walletBtn');

      if(wallet?.className){
        link.className=wallet.className;
      }else{
        link.className='wallet-btn';
      }

      link.style.textDecoration='none';
      link.style.display='inline-flex';
      link.style.alignItems='center';
      link.style.justifyContent='center';

      host.insertBefore(
        link,
        host.firstChild
      );

    }catch{}
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      {once:true}
    );
  }else{
    mount();
  }
})();
JS

# ------------------------------------------------------------
# Inject owner link into Trading Terminal
# ------------------------------------------------------------
if [ -f "$TRADING" ]; then
python3 - "$TRADING" "$STAMP" <<'PY'
from pathlib import Path
import sys
import re

path=Path(sys.argv[1])
stamp=sys.argv[2]
text=path.read_text(encoding="utf-8")

marker="MEMEFLOW_OWNER_INTELLIGENCE_LINK_V1"

if marker not in text:
    script=f'''
  <!-- {marker} -->
  <script src="/owner-intelligence-link.js?v={stamp}"></script>
'''

    if "</body>" not in text:
        raise SystemExit(
            "[patch] ERROR: </body> missing in trading.html"
        )

    text=text.replace(
        "</body>",
        script+"</body>",
        1
    )

path.write_text(
    text,
    encoding="utf-8"
)
PY
fi

# ------------------------------------------------------------
# CACHE BUST OWNER PAGE
# ------------------------------------------------------------
python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import sys,re

path=Path(sys.argv[1])
stamp=sys.argv[2]
text=path.read_text(encoding="utf-8")

text=re.sub(
    r'/owner-intelligence\.css\?v=[^"\']+',
    f'/owner-intelligence.css?v={stamp}',
    text
)

text=re.sub(
    r'/owner-intelligence\.js\?v=[^"\']+',
    f'/owner-intelligence.js?v={stamp}',
    text
)

path.write_text(text,encoding="utf-8")
PY

# ------------------------------------------------------------
# VALIDATION / SAFE ROLLBACK
# ------------------------------------------------------------
echo "[patch] validating JavaScript..."

if ! node --check "$SERVER"; then
  echo "[patch] ERROR: app-server syntax check failed"
  cp "$BACKUP/app-server.mjs" "$SERVER"
  echo "[patch] app-server automatically rolled back"
  exit 1
fi

if ! node --check "$JS"; then
  echo "[patch] ERROR: owner-intelligence.js syntax check failed"
  cp "$BACKUP/app-server.mjs" "$SERVER"
  echo "[patch] app-server automatically rolled back"
  exit 1
fi

if ! node --check "$LINKJS"; then
  echo "[patch] ERROR: owner-intelligence-link.js syntax check failed"
  cp "$BACKUP/app-server.mjs" "$SERVER"
  echo "[patch] app-server automatically rolled back"
  exit 1
fi

grep -q "MEMEFLOW_OWNER_INTELLIGENCE_V1_HELPERS" "$SERVER"
grep -q "MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES" "$SERVER"
grep -q "/api/owner/intelligence/analyze" "$SERVER"
grep -q "owner-intelligence.js" "$HTML"

echo
echo "============================================================"
echo "[patch] SUCCESS — OWNER INTELLIGENCE V1 INSTALLED"
echo "============================================================"
echo
echo "OPENAI:"
echo "  - OWNER ONLY"
echo "  - NO background OpenAI calls"
echo "  - NO per-token realtime OpenAI calls"
echo "  - NO per-user trading OpenAI calls"
echo "  - API used only when owner presses ANALYZE or sends chat"
echo
echo "AI COACH:"
echo "  - reads aggregated engine performance"
echo "  - reads current settings"
echo "  - reads decision-state statistics"
echo "  - reads wins / losses / close reasons"
echo "  - can suggest setting changes"
echo "  - can suggest logic changes"
echo "  - can suggest NEW FUNCTIONS"
echo
echo "SAFETY:"
echo "  - AI cannot directly modify settings"
echo "  - AI cannot execute trades"
echo "  - SHADOW TEST is local and free"
echo "  - APPLY requires explicit OWNER confirmation"
echo "  - settings are validated before APPLY"
echo "  - stale proposals are rejected"
echo "  - every applied proposal is audited"
echo
echo "PAGE:"
echo "  /owner-intelligence.html"
echo
echo "Trading Terminal:"
echo "  OWNER AI button appears only for verified owner"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Open Trading Terminal"
echo "  3. Press OWNER AI"
echo "============================================================"
