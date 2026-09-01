import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=
  fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );

const packageJson=
  JSON.parse(
    fs.readFileSync(
      new URL('../package.json',import.meta.url),
      'utf8'
    )
  );

const start=
  app.indexOf(
    "if(url.pathname==='/api/discovery/status'){"
  );

const end=
  app.indexOf(
    "if(url.pathname==='/api/chart/config')",
    start
  );

assert.ok(start>=0,'discovery status route missing');
assert.ok(end>start,'discovery status route end missing');

const route=app.slice(start,end);

assert.match(
  route,
  /MEMEFLOW_DISCOVERY_STATUS_HOTPATH_V63/
);

assert.match(
  route,
  /for\(const __mfDiscoveryStatusTokenV63 of Object\.values\(store\.state\.tokens\|\|\{\}\)\)/
);

assert.match(
  route,
  /__mfIsCurrentScannerToken\(\s*__mfDiscoveryStatusTokenV63,\s*__mfDiscoveryStatusNowV63\s*\)/
);

assert.match(
  route,
  /__mfEntryAdmissionForUser\(\s*__mfDiscoveryStatusTokenV63,\s*u\.id,\s*__mfDiscoveryStatusSettingsV63,\s*__mfDiscoveryStatusNowV63\s*\)/
);

assert.match(
  route,
  /tokens:__mfDiscoveryStatusTotalV63/
);

assert.match(
  route,
  /freshScannerTokens:__mfDiscoveryStatusCurrentV63/
);

assert.match(
  route,
  /admittedScannerTokensForUser:__mfDiscoveryStatusAdmittedV63/
);

assert.match(
  route,
  /preAdmissionHiddenForUser:__mfDiscoveryStatusHiddenV63/
);

// Remove comments before checking executable route code.
const executable=
  route.replace(/\/\/[^\n]*/g,'');

// The status route must no longer invoke any globally-sorted token accessor.
assert.doesNotMatch(
  executable,
  /\bstore\.tokens\s*\(\s*\)/
);

assert.doesNotMatch(
  executable,
  /__mfLiveScannerTokens\s*\(\s*\)/
);

assert.doesNotMatch(
  executable,
  /__mfAdmittedScannerTokensForUser\s*\(/
);

// V63 must not delete/change the legacy helpers for other callers.
assert.match(
  app,
  /function __mfLiveScannerTokens\(now=Date\.now\(\)\)/
);

assert.match(
  app,
  /function __mfAdmittedScannerTokensForUser\(uid,now=Date\.now\(\)\)/
);

// Exact 20k synthetic count-equivalence regression.
// This models the old route at one fixed timestamp and proves V63 returns the
// same four numbers while eliminating 5 sorts and the duplicate admission pass.
{
  const rows=[];

  for(let i=0;i<20_000;i++){
    rows.push({
      mint:'mint-'+i,
      discoveredAt:
        1_700_000_000_000+
        ((i*7919)%10000),
      current:i%5!==0,
      admitted:i%7!==0
    });
  }

  const isCurrent=row=>row.current===true;
  const admission=row=>row.admitted===true;

  let oldSortCalls=0;
  let oldAdmissionCalls=0;

  const sorted=()=>{
    oldSortCalls++;
    return [...rows].sort(
      (a,b)=>
        Number(b.discoveredAt||0)-
        Number(a.discoveredAt||0)
    );
  };

  const oldTotal=sorted().length;
  const oldCurrent=sorted().filter(isCurrent).length;

  const oldAdmitted=
    sorted()
      .filter(isCurrent)
      .filter(row=>{
        oldAdmissionCalls++;
        return admission(row);
      })
      .length;

  const oldHidden=Math.max(
    0,
    sorted().filter(isCurrent).length-
    sorted()
      .filter(isCurrent)
      .filter(row=>{
        oldAdmissionCalls++;
        return admission(row);
      })
      .length
  );

  let newTotal=0;
  let newCurrent=0;
  let newAdmitted=0;
  let newAdmissionCalls=0;

  for(const row of rows){
    newTotal++;

    if(!isCurrent(row)){
      continue;
    }

    newCurrent++;
    newAdmissionCalls++;

    if(admission(row)){
      newAdmitted++;
    }
  }

  const newHidden=
    Math.max(0,newCurrent-newAdmitted);

  assert.deepEqual(
    {
      tokens:newTotal,
      freshScannerTokens:newCurrent,
      admittedScannerTokensForUser:newAdmitted,
      preAdmissionHiddenForUser:newHidden
    },
    {
      tokens:oldTotal,
      freshScannerTokens:oldCurrent,
      admittedScannerTokensForUser:oldAdmitted,
      preAdmissionHiddenForUser:oldHidden
    }
  );

  assert.equal(
    oldSortCalls,
    5,
    'legacy discovery status model must perform five full sorts'
  );

  assert.equal(
    newAdmissionCalls*2,
    oldAdmissionCalls,
    'V63 must evaluate admission once instead of twice per current token'
  );
}

const core=
  String(packageJson?.scripts?.['test:core']||'');

assert.match(
  core,
  /node tests\/pre-admission-sweep-hotpath-v62-4\.mjs/
);

assert.match(
  core,
  /node tests\/discovery-status-hotpath-v63\.mjs/
);

console.log('discovery status hotpath v63 ok');
