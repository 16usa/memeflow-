import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');

if(!fs.existsSync(serverPath)){
  console.error('ABORT: missing '+serverPath);
  process.exit(1);
}

const backup=serverPath+'.before-v10-2-same-instance-lifecycle';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes("'/api/debug/filter-pipeline-lifecycle'")){
  const marker=" if(url.pathname==='/api/settings'&&req.method==='GET')";
  if(!s.includes(marker)){
    console.error('ABORT: route insertion marker missing');
    process.exit(1);
  }

  const route=` if(url.pathname==='/api/debug/filter-pipeline-lifecycle'){
    const now=Date.now();
    const limit=Math.max(1,Math.min(25,Number(url.searchParams.get('limit')||10)));

    const allTokens=Object.values(store?.state?.tokens||{});
    const pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const settings=store.settings(u.id);

    const sample=pumpTokens.map(token=>{
      const mint=String(token?.mint||token?.tokenMint||token?.tokenAddress||'');
      const holder=holderQueue.inspect?.(mint)||null;
      const price=priceLifecycleDiag.get(mint)||null;
      const decision=
        store?._uidDec?.get?.(u.id)?.get?.(mint) ??
        store?.state?.decisions?.[u.id]?.[mint] ??
        null;
      const discovered=Number(token?.discoveredAt||token?.createdAt||0);
      return {
        mint,
        ageMinutes:discovered>0?Math.max(0,(now-discovered)/60000):null,
        launchPlatform:token?.launchPlatform||null,
        protocol:token?.protocol||null,
        source:token?.source||null,
        holder:{
          fresh:Boolean(token?.holderFresh),
          count:token?.holderCount??token?.holders??null,
          top10Pct:token?.top10Pct??token?.top10??null,
          developerPct:token?.developerPct??token?.developerSharePct??token?.developer??null,
          scannedAt:token?.holderScannedAt||null
        },
        holderQueue:holder,
        pricePolling:price?{
          ...price,
          lastSnapshotAgeMs:price.lastSnapshotAt?now-price.lastSnapshotAt:null,
          lastPollAgeMs:price.lastPollAt?now-price.lastPollAt:null
        }:null,
        market:{
          priceSol:token?.priceSol??token?.price??null,
          liquiditySol:token?.liquiditySol??token?.liquidity??null,
          buyPressure:token?.buyPressure??token?.momentum??null,
          lastPriceAt:token?.lastPriceAt||null,
          scanError:token?.scanError||null
        },
        decision:decision?{
          state:decision.state??null,
          score:decision.score??null,
          confidence:decision.confidence??null,
          primaryReason:decision.primaryReason||null,
          reasons:decision.reasons||[],
          settingsVersion:decision.settingsVersion??null,
          reevaluatedAt:decision.reevaluatedAt??null
        }:null
      };
    });

    return json(res,200,{
      diagnosticVersion:'V10.2-same-instance',
      now,
      instance:{
        pid:process.pid,
        hostname:process.env.REPL_SLUG||process.env.HOSTNAME||'unknown'
      },
      counts:{
        tokensInThisInstance:allTokens.length,
        pumpTokensInThisInstance:pumpTokens.length,
        returned:sample.length
      },
      effectiveSettings:{
        minHolders:settings.minHolders,
        maxTop10Pct:settings.maxTop10Pct,
        maxDeveloperPct:settings.maxDeveloperPct,
        minBuyPressure:settings.minBuyPressure,
        minLiquidityUsd:settings.minLiquidityUsd,
        minMarketCapUsd:settings.minMarketCapUsd,
        launchPlatforms:settings.launchPlatforms
      },
      sample
    });
  }
`;

  s=s.replace(marker,route+marker);
}

fs.writeFileSync(serverPath,s,'utf8');

const r=spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
if(r.status!==0){
  console.error(r.stderr||r.stdout);
  process.exit(r.status||1);
}

console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: same-instance lifecycle endpoint installed');
console.log('V10.2 INSTALLED');
