import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTokenIntelligenceScorecardV23_15
} from '../src/token-intelligence-scorecard-v23_15.mjs';

const summary={
  mint:'MINT_A',
  stage:'DEEP',
  eventCount:30,
  lastObservedAt:1_800_000_000_000,
  anchorAt:1_799_999_900_000,
  labelsCompleted:[15_000,30_000],
  regime:'EXPANSION',
  dataCompletenessPct:100,
  canonicalScore:72,
  opportunityEvidenceReady:true,
  wallet:{
    uniqueBuyerWallets:14,
    topBuyerSolSharePct:18
  },
  coordination:{
    suspected:false,
    sameSlotBuySharePct:8
  },
  smartMoneyMemory:{
    reputationReady:true,
    knownWallets:9,
    readyWallets:7,
    strongWallets:4,
    strongWalletSharePct:36,
    weightedPositiveProbabilityPct:71,
    historicalConfidencePct:68
  },
  shadowDriftRegime:{
    status:'REGIME_READY',
    driftStatus:'STABLE',
    currentRegime:'EXPANSION',
    regimeModelReady:true,
    probabilityPositivePct:69,
    modelConfidencePct:66
  },
  shadowConfidenceGovernor:{
    status:'CONFIDENCE_READY',
    ready:true,
    consensusProbabilityPositivePct:73,
    ensembleConfidencePct:72,
    disagreementPct:14,
    agreementPct:86,
    sourceCount:4,
    validatedSourceCount:3
  },
  shadowTokenTrajectory:{
    trajectoryState:'RISING',
    stateStreak:3,
    turningPoint:false,
    probabilityDeltaWindow:8,
    confidenceDeltaWindow:4
  },
  shadowTokenPattern:{
    status:'PATTERN_READY',
    ready:true,
    historicalExamples:80,
    neighbourCount:12,
    patternProbabilityPositivePct:75,
    matchConfidencePct:70,
    meanSimilarityPct:82
  },
  shadowEvidenceSynthesis:{
    status:'SYNTHESIS_STRONG',
    ready:true,
    direction:'BULLISH',
    synthesisProbabilityPositivePct:76,
    synthesisConfidencePct:74,
    crossSourceDisagreementPct:13,
    blockers:[]
  },
  shadowOutcomeCalibration:{
    status:'CALIBRATION_HEALTHY',
    ready:true,
    rawProbabilityPositivePct:76,
    calibratedProbabilityPositivePct:72,
    calibratedConfidencePct:69,
    reliabilitySampleCount:120,
    globalEcePct:6,
    globalBrier:0.16
  },
  shadowModelArena:{
    status:'ARENA_READY',
    modelReady:true,
    validated:true,
    champion:'FULL_LOGISTIC',
    calibratedProbabilityPositivePct:74,
    modelConfidencePct:67
  },
  shadowMathBrain:{
    status:'BRAIN_READY',
    modelReady:true,
    validated:true,
    probabilityPositivePct:73,
    modelConfidencePct:65
  }
};

const fakeInspect=mint=>{
  if(mint!=='MINT_A')return null;

  return {
    mint:'MINT_A',
    stage:'DEEP',
    eventCount:30,
    labelsCompleted:[15_000,30_000],
    anchor:{at:1_799_999_900_000},
    snapshot:{
      observedAt:1_800_000_000_000,
      evidence:{
        regime:'EXPANSION',
        dataQuality:{
          completenessPct:100
        },
        sourceSignals:{
          canonicalScore:72,
          opportunityEvidenceReady:true
        }
      },
      specialists:{
        wallet:{
          uniqueBuyerWallets:14,
          topBuyerSolSharePct:18
        },
        coordination:{
          suspectedCoordination:false,
          sameSlotBuySharePct:8
        },
        smartMoneyMemory:summary.smartMoneyMemory
      },
      shadowDriftRegime:summary.shadowDriftRegime,
      shadowConfidenceGovernor:summary.shadowConfidenceGovernor,
      shadowTokenTrajectory:summary.shadowTokenTrajectory,
      shadowTokenPattern:summary.shadowTokenPattern,
      shadowEvidenceSynthesis:summary.shadowEvidenceSynthesis,
      shadowOutcomeCalibration:summary.shadowOutcomeCalibration,
      shadowModelArena:summary.shadowModelArena,
      shadowMathBrain:summary.shadowMathBrain
    }
  };
};

const scorecards=
  createTokenIntelligenceScorecardV23_15({
    inspectToken:fakeInspect,
    listTokenCells:()=>[
      summary,
      {
        ...summary,
        mint:'MINT_B',
        dataCompletenessPct:50,
        shadowOutcomeCalibration:{
          ...summary.shadowOutcomeCalibration,
          ready:false,
          calibratedProbabilityPositivePct:null
        },
        shadowEvidenceSynthesis:{
          ...summary.shadowEvidenceSynthesis,
          synthesisProbabilityPositivePct:61,
          synthesisConfidencePct:52,
          blockers:['LOW_DATA']
        }
      }
    ]
  });

const card=scorecards.build(summary);

assert.equal(card.secondScore,false);
assert.equal(card.authority,'DIAGNOSTIC_ONLY');
assert.equal(card.probabilitySource,'V23_11_CALIBRATED');
assert.equal(card.probabilityPositivePct,72);
assert.equal(card.confidencePct,69);
assert.equal(card.direction,'BULLISH');
assert.ok(card.evidenceReadinessPct>=75);
assert.equal(card.wallet.smartMoneyReady,true);
assert.equal(card.pattern.neighbours,12);
assert.equal(card.calibration.ready,true);
assert.equal(card.blockers.length,0);

const fallback=scorecards.build({
  ...summary,
  shadowOutcomeCalibration:{
    ...summary.shadowOutcomeCalibration,
    ready:false,
    calibratedProbabilityPositivePct:null
  },
  shadowEvidenceSynthesis:{
    ...summary.shadowEvidenceSynthesis,
    synthesisProbabilityPositivePct:64,
    synthesisConfidencePct:55
  }
});

assert.equal(
  fallback.probabilitySource,
  'V23_10_SYNTHESIS'
);

assert.equal(
  fallback.probabilityPositivePct,
  64
);

const inspected=
  scorecards.inspect('MINT_A');

assert.equal(
  inspected.mint,
  'MINT_A'
);

assert.equal(
  inspected.probabilityPositivePct,
  72
);

assert.equal(
  scorecards.inspect('MISSING'),
  null
);

const list=
  scorecards.list({
    limit:10
  });

assert.equal(
  list.length,
  2
);

assert.equal(
  list[0].mint,
  'MINT_A'
);

assert.ok(
  scorecards.status().tracked>=2
);

const source=fs.readFileSync(
  'src/token-intelligence-scorecard-v23_15.mjs',
  'utf8'
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);

assert.doesNotMatch(
  source,
  /openPosition\s*\(/
);

assert.doesNotMatch(
  source,
  /closePosition\s*\(/
);

assert.doesNotMatch(
  source,
  /setSettings\s*\(/
);

assert.doesNotMatch(
  source,
  /tradeEligible/
);

assert.doesNotMatch(
  source,
  /decisionScore/
);

assert.doesNotMatch(
  source,
  /tokenScore\s*:/
);

const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);

const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);

const html=fs.readFileSync(
  'owner-intelligence.html',
  'utf8'
);

const js=fs.readFileSync(
  'owner-intelligence.js',
  'utf8'
);

assert.match(
  shadow,
  /createTokenIntelligenceScorecardV23_15/
);

assert.match(
  shadow,
  /tokenScorecardStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/token-scorecards/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/token-scorecard/
);

assert.match(
  html,
  /id="tokenScorecardList"/
);

assert.match(
  html,
  /id="tokenScorecardDetail"/
);

assert.match(
  js,
  /loadTokenScorecards/
);

assert.match(
  js,
  /inspectTokenScorecard/
);

console.log(
  'token intelligence scorecard v23.15 ok'
);
