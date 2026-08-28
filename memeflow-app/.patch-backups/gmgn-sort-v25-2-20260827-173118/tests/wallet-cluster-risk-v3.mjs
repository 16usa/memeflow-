import assert from 'node:assert/strict';
import {scanWalletClusterRisk,walletRiskPenalty} from '../src/wallet-cluster-risk.mjs';
import {defaultSettings,normalizeSettings,validateSettings} from '../src/settings.mjs';
import {evaluateSettingsGate} from '../src/settings-gate.mjs';
import {evaluate} from '../src/evaluate.mjs';

const NOW=Date.now();

function transferTx(source,destination,lamports,at){
  return {
    blockTime:Math.floor(at/1000),
    transaction:{
      message:{
        instructions:[
          {program:'system',parsed:{type:'transfer',info:{source,destination,lamports}}}
        ]
      }
    },
    meta:{innerInstructions:[]}
  };
}

function fakeRpc(plan){
  return {
    async callOnce(method,args){
      if(method==='getSignaturesForAddress'){
        const wallet=args[0];
        const row=plan[wallet];
        return row?[{signature:`sig-${wallet}`,blockTime:Math.floor(row.at/1000),err:null}]:[];
      }
      if(method==='getTransaction'){
        const wallet=String(args[0]).replace(/^sig-/,'');
        const row=plan[wallet];
        return row?transferTx(row.funder,wallet,row.lamports,row.at):null;
      }
      throw new Error(`unexpected RPC method ${method}`);
    }
  };
}

const baseToken={
  mint:'RiskMint111111111111111111111111111pump',
  launchPlatform:'pump',
  discoveredAt:NOW-60_000,
  pumpCreatedAt:NOW-60_000,
  creator:'CREATOR',
  developerPct:2,
  holderRiskWallets:[
    {wallet:'A',pct:18},
    {wallet:'B',pct:14},
    {wallet:'C',pct:12},
    {wallet:'D',pct:8},
    {wallet:'E',pct:5}
  ]
};

{
  const at=NOW-70_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'FUNDER-X',lamports:1_000_000_000,at},
      B:{funder:'FUNDER-X',lamports:1_100_000_000,at:at+8_000},
      C:{funder:'FUNDER-X',lamports:950_000_000,at:at+15_000},
      D:{funder:'OTHER',lamports:800_000_000,at:at+3_000}
    }),
    token:baseToken,
    options:{maxWallets:7,signatureLimit:3,txPerWallet:2,concurrency:2}
  });

  assert.equal(result.ok,true);
  assert.equal(result.commonFunders,1);
  assert.equal(result.linkedWallets,3);
  assert.equal(result.suspectedRiskyWalletsPct,44);
  assert.equal(result.insidersPct,0);
}

{
  const at=NOW-70_000;
  const result=await scanWalletClusterRisk({
    rpc:fakeRpc({
      A:{funder:'CREATOR',lamports:1_000_000_000,at},
      B:{funder:'CREATOR',lamports:1_050_000_000,at:at+8_000}
    }),
    token:baseToken,
    options:{maxWallets:7,signatureLimit:3,txPerWallet:2,concurrency:2}
  });

  assert.equal(result.ok,true);
  assert.equal(result.linkedWallets,3); // creator + A + B
  assert.equal(result.suspectedRiskyWalletsPct,34); // 18 + 14 + 2
  assert.equal(result.insidersPct,34);
}

{
  const d=defaultSettings();
  assert.equal(d.maxSuspectedRiskyWalletsPct,35);
  assert.equal(d.maxInsidersPct,25);

  const n=normalizeSettings({...d,maxSuspectedRiskyWalletsPct:22,maxInsidersPct:11});
  assert.equal(n.maxSuspectedRiskyWalletsPct,22);
  assert.equal(n.maxInsidersPct,11);

  assert.equal(validateSettings({...d,maxSuspectedRiskyWalletsPct:101}).ok,false);
}

{
  const settings={
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  };

  let gate=evaluateSettingsGate({},settings);
  assert.equal(gate.state,'WAITING');

  gate=evaluateSettingsGate({suspectedRiskyWalletsPct:40,insidersPct:5},settings);
  assert.equal(gate.state,'BLOCKED');

  gate=evaluateSettingsGate({suspectedRiskyWalletsPct:12,insidersPct:5},settings);
  assert.equal(gate.state,'PASS');
}

{
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:8,insidersPct:3}),0);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:17,insidersPct:3}),10);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:22,insidersPct:12}),15);
  assert.equal(walletRiskPenalty({suspectedRiskyWalletsPct:40,insidersPct:40}),20);

  const token={
    holderCount:100,
    top10Pct:10,
    developerPct:2,
    buyPressure:3,
    priceSol:1,
    holderFresh:true,
    suspectedRiskyWalletsPct:22,
    insidersPct:0
  };

  const ready=evaluate(token,{
    minScore:0,
    minConfidence:0,
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  });
  assert.equal(ready.scoreBeforeWalletRisk,100);
  assert.equal(ready.walletRiskPenalty,15);
  assert.equal(ready.score,85);
  assert.equal(ready.state,'BUY READY');

  const watch=evaluate(token,{
    minScore:90,
    minConfidence:0,
    maxSuspectedRiskyWalletsPct:35,
    maxInsidersPct:25
  });
  assert.equal(watch.state,'WATCH');
}

console.log('wallet cluster risk v3: PASS');
