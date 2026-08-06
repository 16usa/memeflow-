import fs from 'node:fs';
import path from 'node:path';

const workspace = process.cwd();
const appDir = fs.existsSync(path.join(workspace, 'memeflow-app')) ? path.join(workspace, 'memeflow-app') : workspace;
const files = {
  solana: path.join(appDir, 'src', 'solana.mjs'),
  queue: path.join(appDir, 'src', 'discqueue.mjs'),
  server: path.join(appDir, 'app-server.mjs'),
};
for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) { console.error(`INSTALL ABORTED: missing ${file}`); process.exit(1); }
}
const backups = Object.fromEntries(Object.entries(files).map(([k,f])=>[k,`${f}.before-exclude-mayhem-mode`]));
for (const [k,f] of Object.entries(files)) if (!fs.existsSync(backups[k])) fs.copyFileSync(f,backups[k]);

function replaceExactly(text,before,after,label){
  if(text.includes(after)) return text;
  if(!text.includes(before)) throw new Error(`INSTALL ABORTED: ${label} anchor not found. No partial installation allowed.`);
  return text.replace(before,after);
}

let solana=fs.readFileSync(files.solana,'utf8');
const oldParse=`  // Parse string fields
  let name, symbol, uri;
  try {
    let o = 8;
    const str = () => {const n=b.readUInt32LE(o);o+=4;const s=b.subarray(o,o+n).toString('utf8');o+=n;return s};
    name=str(); symbol=str(); uri=str();
  } catch {
    return {ok:false, reason:'invalidAccountLayout', discBytes, dataLen};
  }
  const ac = (ix.accounts || []).map(a => typeof a === 'number' ? keys[a] : a);`;
const newParse=`  // Parse official Pump create/create_v2 instruction data.
  // create_v2: name, symbol, uri, creator Pubkey, is_mayhem_mode bool.
  let name, symbol, uri, creatorFromData=null, isMayhemMode=false;
  try {
    let o = 8;
    const str = () => {
      if (o + 4 > b.length) throw new Error('string length missing');
      const n=b.readUInt32LE(o);o+=4;
      if (o+n>b.length) throw new Error('string out of range');
      const s=b.subarray(o,o+n).toString('utf8');o+=n;return s;
    };
    name=str(); symbol=str(); uri=str();
    if (discKey === DISC_CREATE_V2) {
      if (o + 33 > b.length) return {ok:false, reason:'invalidAccountLayout', discBytes, dataLen};
      creatorFromData=b58encode(b.subarray(o,o+32));o+=32;
      const mayhemByte=b[o];
      if (mayhemByte!==0 && mayhemByte!==1) return {ok:false, reason:'invalidAccountLayout', discBytes, dataLen};
      isMayhemMode=mayhemByte===1;
    }
  } catch {
    return {ok:false, reason:'invalidAccountLayout', discBytes, dataLen};
  }
  const ac = (ix.accounts || []).map(a => typeof a === 'number' ? keys[a] : a);`;
solana=replaceExactly(solana,oldParse,newParse,'solana create_v2 parser');
const oldReturn=`  return {ok:true, mint, curve, creator:ac[7]||null, name, symbol, uri, kind:discKey===DISC_CREATE?'create':'create_v2'};`;
const newReturn=`  const kind=discKey===DISC_CREATE?'create':'create_v2';
  const creator=creatorFromData || ac[5] || ac[7] || null;
  return {ok:true,mint,curve,creator,name,symbol,uri,kind,isMayhemMode:kind==='create_v2'&&isMayhemMode,launchMode:kind==='create_v2'&&isMayhemMode?'mayhem':'standard'};`;
solana=replaceExactly(solana,oldReturn,newReturn,'solana decoder return');
const helperAnchor=`export function decodePumpCreate(ix, keys) {`;
const helper=`export function shouldExcludeMayhemCreate(result, enabled=true) {
  return Boolean(enabled && result?.ok && result?.kind==='create_v2' && result?.isMayhemMode===true);
}

`;
if(!solana.includes('export function shouldExcludeMayhemCreate')){
  if(!solana.includes(helperAnchor)) throw new Error('INSTALL ABORTED: decoder anchor not found.');
  solana=solana.replace(helperAnchor,helper+helperAnchor);
}

let queue=fs.readFileSync(files.queue,'utf8');
queue=replaceExactly(queue,`    createInstructionDecoded: 0,
    knownNonCreateIgnored: 0,`,`    createInstructionDecoded: 0,
    mayhemCreatesIgnored: 0,
    knownNonCreateIgnored: 0,`,'Mayhem discovery metric');

let server=fs.readFileSync(files.server,'utf8');
server=replaceExactly(server,
`import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate} from './src/solana.mjs';`,
`import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,shouldExcludeMayhemCreate} from './src/solana.mjs';`,
'server decoder import');
server=replaceExactly(server,
`const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',ALLOW_ANON=process.env.ALLOW_ANONYMOUS_PAPER!=='false';`,
`const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',ALLOW_ANON=process.env.ALLOW_ANONYMOUS_PAPER!=='false';
const EXCLUDE_MAYHEM_MODE=process.env.EXCLUDE_MAYHEM_MODE!=='false';`,
'Mayhem exclusion config');
const okBefore=`    if(result.ok){
      if(seenMints.has(result.mint))continue; // same mint in top-level and inner — add once
      seenMints.add(result.mint);
      discMetrics.createInstructionDecoded++;
      discMetrics.createsDecoded++;
      store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
      await enrich(result.mint,result.curve);`;
const okAfter=`    if(result.ok){
      // Mayhem launches are rejected before storage, enrichment, AI, candidates and chart.
      if(shouldExcludeMayhemCreate(result,EXCLUDE_MAYHEM_MODE)){
        discMetrics.mayhemCreatesIgnored++;
        continue;
      }
      if(seenMints.has(result.mint))continue; // same mint in top-level and inner — add once
      seenMints.add(result.mint);
      discMetrics.createInstructionDecoded++;
      discMetrics.createsDecoded++;
      store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
      await enrich(result.mint,result.curve);`;
server=replaceExactly(server,okBefore,okAfter,'pre-storage Mayhem exclusion');

fs.writeFileSync(files.solana,solana,'utf8');
fs.writeFileSync(files.queue,queue,'utf8');
fs.writeFileSync(files.server,server,'utf8');
console.log('Installed MEMEFLOW Mayhem Mode exclusion.');
console.log('Mayhem launches are now rejected before storage and AI processing.');
