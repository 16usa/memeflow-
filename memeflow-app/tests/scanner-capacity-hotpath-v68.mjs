import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectOldestScannerEvictionsV68} from '../src/scanner-capacity-selector-v68.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

const start=app.indexOf('async function __mfPruneScannerRuntimeState');
const end=app.indexOf('const __mfScannerPruneTimer=',start);
assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(block,/MEMEFLOW_SCANNER_CAPACITY_HOTPATH_V68/);
assert.match(block,/selectOldestScannerEvictionsV68\(\{/);

// Capacity eviction block must no longer globally sort candidates.
const capStart=block.indexOf('if(scannerRows.length>__mfScannerCacheMaxTokens)');
const liveStart=block.indexOf('// Do NOT invoke the store',capStart);
const capBlock=block.slice(capStart,liveStart);
assert.doesNotMatch(capBlock,/\.sort\(/);

function legacy(rows,open,limit){
  return rows
    .filter(token=>!open.has(String(token?.mint||'')))
    .sort((a,b)=>{
      const at=Number(
        a?.lastMarketActivityAt ??
        a?.lastPriceAt ??
        a?.updatedAt ??
        a?.discoveredAt ??
        0
      );
      const bt=Number(
        b?.lastMarketActivityAt ??
        b?.lastPriceAt ??
        b?.updatedAt ??
        b?.discoveredAt ??
        0
      );
      return at-bt;
    })
    .slice(0,limit);
}

// 20k deterministic equivalence including nullish fallback fields and ties.
{
  const rows=Array.from({length:20_000},(_,i)=>{
    const base=(i*7919)%997;
    const token={mint:'mint-'+i};

    switch(i%4){
      case 0: token.lastMarketActivityAt=base; break;
      case 1: token.lastPriceAt=base; break;
      case 2: token.updatedAt=base; break;
      default: token.discoveredAt=base; break;
    }
    return token;
  });

  const open=new Set(
    rows.filter((_,i)=>i%113===0).map(x=>x.mint)
  );

  for(const limit of [1,3,50,777,5000]){
    const old=legacy(rows,open,limit);
    const next=selectOldestScannerEvictionsV68({
      scannerRows:rows,
      openMints:open,
      limit
    });
    assert.deepEqual(
      next.map(x=>x.mint),
      old.map(x=>x.mint),
      'limit '+limit
    );
  }
}

// Stable equal-time ordering.
{
  const rows=[
    {mint:'a',discoveredAt:5},
    {mint:'b',discoveredAt:5},
    {mint:'c',discoveredAt:5},
    {mint:'d',discoveredAt:4}
  ];
  const next=selectOldestScannerEvictionsV68({
    scannerRows:rows,
    openMints:new Set(),
    limit:3
  });
  assert.deepEqual(next.map(x=>x.mint),['d','a','b']);
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/scanner-capacity-hotpath-v68\.mjs/
);

console.log('scanner capacity hotpath v68 ok');
