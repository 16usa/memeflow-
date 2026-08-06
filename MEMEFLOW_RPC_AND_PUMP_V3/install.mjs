import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

for(const p of [solanaPath,serverPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-rpc-pump-v3';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

function mustReplace(s,a,b,label){
  if(s.includes(b)) return s;
  if(!s.includes(a)) throw new Error('ABORT: anchor not found: '+label);
  return s.replace(a,b);
}

// 1) Recognize Pump V2 buy discriminator as a normal non-create instruction.
// Verified current discriminator:
// buy_v2 = [184,23,238,97,103,197,211,61]
{
  let s=fs.readFileSync(solanaPath,'utf8');

  const exactQuote=`export const PUMP_DISC_BUY_EXACT_QUOTE_V2 = [194,171,28,70,104,77,91,47];`;
  const withBuyV2=`export const PUMP_DISC_BUY_EXACT_QUOTE_V2 = [194,171,28,70,104,77,91,47];
export const PUMP_DISC_BUY_V2             = [184,23,238,97,103,197,211,61];`;

  if(s.includes(exactQuote) && !s.includes('PUMP_DISC_BUY_V2')){
    s=s.replace(exactQuote,withBuyV2);
  }

  const setAnchor=`  PUMP_DISC_BUY_EXACT_QUOTE_V2.join(','),
]);`;
  const setNew=`  PUMP_DISC_BUY_EXACT_QUOTE_V2.join(','),
  PUMP_DISC_BUY_V2.join(','),
]);`;
  if(s.includes(setAnchor) && !s.includes(`PUMP_DISC_BUY_V2.join(',')`)){
    s=s.replace(setAnchor,setNew);
  }

  // 2) Method-aware pacing. Public RPC is especially sensitive to getProgramAccounts.
  // Keep discovery fast while serializing heavy holder scans.
  if(s.includes(`this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||200));`)
     && !s.includes('this.methodMinIntervalMs=')){
    s=s.replace(
      `this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||200));`,
      `this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||300));
    this.methodMinIntervalMs={
      getProgramAccounts:Math.max(750,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||2500)),
      getTransaction:Math.max(250,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||450)),
      getTokenSupply:Math.max(350,Number(process.env.RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS||800)),
      getAccountInfo:Math.max(150,Number(process.env.RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||300)),
      default:this.minIntervalMs
    };
    this._methodNextAllowedAt=new Map();`
    );
  }

  const oldPace=`  async _pace(){
    const previous=this._paceTail;
    let release;
    this._paceTail=new Promise(r=>{release=r});
    await previous;
    const wait=Math.max(0,this._nextAllowedAt-Date.now());
    if(wait)await sleep(wait);
    this._nextAllowedAt=Date.now()+this.minIntervalMs;
    release();
  }`;

  const newPace=`  async _pace(method='default'){
    const previous=this._paceTail;
    let release;
    this._paceTail=new Promise(r=>{release=r});
    await previous;
    try{
      const now=Date.now();
      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;
      const methodNext=this._methodNextAllowedAt?.get(method)||0;
      const wait=Math.max(0,this._nextAllowedAt-now,methodNext-now);
      if(wait)await sleep(wait);
      const started=Date.now();
      this._nextAllowedAt=started+this.minIntervalMs;
      if(this._methodNextAllowedAt)this._methodNextAllowedAt.set(method,started+methodInterval);
    }finally{
      release();
    }
  }`;

  if(s.includes(oldPace)){
    s=s.replace(oldPace,newPace);
  } else if(!s.includes(`async _pace(method='default')`)){
    throw new Error('ABORT: V1 _pace() block not found');
  }

  s=s.replaceAll('await this._pace();','await this._pace(method);');

  fs.writeFileSync(solanaPath,s);
  console.log('Changed:',solanaPath);
}

// 3) Make holder scans less bursty regardless of old Replit Secrets.
// V2 already caps the internal scheduler; this additionally forces the server
// config to one heavy holder RPC at a time.
{
  let s=fs.readFileSync(serverPath,'utf8');

  // Known current config style from MEMEFLOW.
  s=s.replace(
    /HOLDER_MAX_CONCURRENT=Number\(process\.env\.HOLDER_MAX_CONCURRENT\|\|1\)/g,
    `HOLDER_MAX_CONCURRENT=1`
  );

  // If config is passed inline to makeHolderQueue, force one worker there too.
  s=s.replace(
    /maxConcurrent:HOLDER_MAX_CONCURRENT/g,
    `maxConcurrent:1`
  );

  fs.writeFileSync(serverPath,s);
  console.log('Changed:',serverPath);
}

console.log('');
console.log('Installed MEMEFLOW RPC + Pump V3.');
console.log('Run self-test.mjs. Do not restart until it passes.');