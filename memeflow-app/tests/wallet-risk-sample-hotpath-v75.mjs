import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const pkg=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

const start=app.indexOf(
  'function __mfWalletRiskSampleKey(token={}){'
);
const end=app.indexOf(
  'function __mfWalletRiskCacheFresh(',
  start
);

assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_WALLET_RISK_SAMPLE_HOTPATH_V75/
);

assert.match(
  block,
  /const holderParts=\[\]/
);

assert.match(
  block,
  /for\(const row of holderRiskRows\)/
);

assert.match(
  block,
  /if\(holderParts\.length>=10\)\{\s*break;\s*\}/
);

// Structural check only the executable legacy holderRows chain. Do not scan
// arbitrary comments for those words.
assert.doesNotMatch(
  block,
  /const holderRows=\s*\([\s\S]*?Array\.isArray\(token\.holderRiskWallets\)[\s\S]*?\.map\(row=>\{/
);

function pctKey(value){
  if(
    value===null ||
    value===undefined ||
    value===''
  )return '?';

  const n=Number(value);
  if(!Number.isFinite(n))return '?';

  const clamped=Math.max(0,Math.min(100,n));

  return (
    Math.round(clamped*1000)/1000
  ).toFixed(3);
}

function oldHolderRows(rows){
  return (
    Array.isArray(rows)
      ? rows
      : []
  )
    .map(row=>{
      let wallet='';
      let pct;

      if(typeof row==='string'){
        wallet=row.trim();
        pct=undefined;
      }else if(Array.isArray(row)){
        wallet=String(row[0]||'').trim();
        pct=row[1];
      }else{
        wallet=String(
          row?.wallet ||
          row?.address ||
          row?.owner ||
          ''
        ).trim();

        pct=
          row?.pct ??
          row?.percentage ??
          row?.sharePct;
      }

      if(!wallet)return '';

      return wallet+'@'+pctKey(pct);
    })
    .filter(Boolean)
    .slice(0,10)
    .join('|');
}

function newHolderRows(rows){
  const parts=[];
  const source=Array.isArray(rows)?rows:[];

  for(const row of source){
    let wallet='';
    let pct;

    if(typeof row==='string'){
      wallet=row.trim();
      pct=undefined;
    }else if(Array.isArray(row)){
      wallet=String(row[0]||'').trim();
      pct=row[1];
    }else{
      wallet=String(
        row?.wallet ||
        row?.address ||
        row?.owner ||
        ''
      ).trim();

      pct=
        row?.pct ??
        row?.percentage ??
        row?.sharePct;
    }

    if(!wallet)continue;

    parts.push(wallet+'@'+pctKey(pct));

    if(parts.length>=10)break;
  }

  return parts.join('|');
}

{
  const rows=[];

  for(let i=0;i<100_000;i++){
    if(i%4===0){
      rows.push(null);
    }else if(i%4===1){
      rows.push({wallet:'',pct:i});
    }else if(i%4===2){
      rows.push(['wallet-'+i,(i%137)-20]);
    }else{
      rows.push({
        address:'wallet-'+i,
        percentage:(i%113)+0.123456
      });
    }
  }

  assert.equal(
    newHolderRows(rows),
    oldHolderRows(rows)
  );
}

{
  const rows=[
    '   ',
    null,
    ['a',1.23456],
    {wallet:'b',pct:5},
    {address:'c',percentage:6.7777},
    {owner:'d',sharePct:101},
    {wallet:'e',pct:-9},
    ['f',null],
    'g',
    {wallet:''},
    {address:'h',pct:'12.3456'},
    {owner:'i',percentage:'bad'},
    ['j',50],
    ['k',60],
    ['l',70]
  ];

  assert.equal(
    newHolderRows(rows),
    oldHolderRows(rows)
  );
}

assert.equal(newHolderRows(null),oldHolderRows(null));
assert.equal(newHolderRows({}),oldHolderRows({}));

assert.match(
  block,
  /V48:V3_ONE_HOP_COMMON_FUNDER/
);

assert.match(
  block,
  /process\.env\.WALLET_CLUSTER_MAX_WALLETS \?\? '5'/
);

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/wallet-risk-sample-hotpath-v75\.mjs/
);

console.log('wallet risk sample hotpath v75 ok');
