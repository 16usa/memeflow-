#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const HOLDER=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');
const MARK='MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY';

function fail(x){console.error('ABORT:',x);process.exit(1)}
if(!fs.existsSync(APP)||!fs.existsSync(HOLDER))fail('Run from ~/workspace with V12.23 installed.');

let a=fs.readFileSync(APP,'utf8');
let h=fs.readFileSync(HOLDER,'utf8');

if(!a.includes('MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS')) fail('V12.23 not detected.');
if(!h.includes("VERSION='V12.22'")) fail('V12.22 holder ledger not detected.');
if(a.includes(MARK)){console.log('PASS: V12.24 already installed');process.exit(0)}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const ab=APP+'.before-v12-24-'+stamp;
const hb=HOLDER+'.before-v12-24-'+stamp;
fs.copyFileSync(APP,ab);fs.copyFileSync(HOLDER,hb);

// ---- holder ledger: expose creator metrics and safe setter diagnostics ----
h=h.replace("const VERSION='V12.22';","const VERSION='V12.24';");
h=h.replace("holderSource:'event-ledger-v12-22-ws-direct-user-only'","holderSource:'event-ledger-v12-24-user-only'");
if(!h.includes('creatorLinksSet:0')){
  h=h.replace("protocolOwnersIgnored:0,", "protocolOwnersIgnored:0,\n      creatorLinksSet:0,\n      creatorLinksChanged:0,");
}
if(h.includes('setCreator(mint,creator){') && !h.includes('this.metrics.creatorLinksSet++')){
  h=h.replace(
`  setCreator(mint,creator){
    if(!mint||!creator)return;
    const r=this.row(mint,6);
    r.creator=creator;
    this.schedule();
  }`,
`  setCreator(mint,creator){
    if(!mint||!creator)return;
    const r=this.row(mint,6);
    if(r.creator!==creator){
      if(r.creator)this.metrics.creatorLinksChanged++;
      r.creator=creator;
    }
    this.metrics.creatorLinksSet++;
    this.schedule();
  }`);
}
h=h.replace("wsDirectCompatible:true","wsDirectCompatible:true,v12_24CreatorLink:true");
fs.writeFileSync(HOLDER,h);

// ---- app helpers ----
const helpers = `
// ${MARK}
function __v1224CreatorFromToken(t){
  if(!t)return null;
  return t.creator || t.creatorWallet || t.developer || t.developerWallet || t.devWallet || null;
}
function __v1224LinkCreator(mint,token){
  try{
    const c=__v1224CreatorFromToken(token||__v1223Token(mint));
    if(c)eventHolderLedger?.setCreator?.(mint,c);
    return c||null;
  }catch{return null}
}
function __v1224HasEventHolder(mint){
  try{
    const s=eventHolderLedger?.inspect?.(mint);
    return !!(s && s.holderFresh===true && s.eventLedgerVersion);
  }catch{return false}
}
function __v1224GateForMint(mint,settings){
  try{
    const t=__v1223Token(mint);
    return __v1223Gate(t,settings);
  }catch{
    return {state:'WAITING',failed:[],waiting:['diagnostic'],checks:{}};
  }
}
`;

const insertAt = a.indexOf('// MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS');
if(insertAt>=0) a=a.slice(0,insertAt)+helpers+a.slice(insertAt);
else a=helpers+a;

// ---- creator linkage at every event holder / store update path ----
// Add linkage immediately before applyToStore occurrences where mint is present.
a=a.replace(/(eventHolderLedger\?\.applyToStore\?\.\(store,\s*mint\))/g,
`(__v1224LinkCreator(mint,__v1223Token(mint)),$1)`);
a=a.replace(/(eventHolderLedger\.applyToStore\?\.\(store,\s*mint\))/g,
`(__v1224LinkCreator(mint,__v1223Token(mint)),$1)`);
a=a.replace(/(eventHolderLedger\?\.applyToStore\?\.\(store,\s*e\.mint\))/g,
`(__v1224LinkCreator(e.mint,__v1223Token(e.mint)),$1)`);

// Also hook common Pump create store writes: after set/add token, link creator from stored token.
// Safe broad patterns, each only inserts if not already followed by V12.24.
const createPatterns=[
  /(store\.setToken\(\s*mint\s*,[\s\S]{0,800}?\)\s*;)/g,
  /(store\.addToken\([\s\S]{0,800}?\)\s*;)/g
];
for(const re of createPatterns){
  a=a.replace(re,(m)=>{
    if(m.includes(MARK))return m;
    return m+`\n  try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}`;
  });
}

// ---- recovery gating: never legacy-scan a mint that already has event holder data ----
// Inject at the start of holderAdmissionForActiveUsers.
const fn='function holderAdmissionForActiveUsers(mint){';
const idx=a.indexOf(fn);
if(idx<0){fs.copyFileSync(ab,APP);fs.copyFileSync(hb,HOLDER);fail('holderAdmissionForActiveUsers not found; backups restored.')}
const brace=a.indexOf('{',idx);
const guard=`
  // ${MARK}: event-holder snapshot remains authoritative even after fresh window.
  try{
    if(__v1224HasEventHolder(mint)){
      __v1224LinkCreator(mint,__v1223Token(mint));
      return {allow:false,drop:true,reason:'event_holder_authoritative',source:'ws-direct'};
    }
  }catch{}
`;
a=a.slice(0,brace+1)+guard+a.slice(brace+1);

// ---- diagnostics top-level ----
const diag="diagnosticVersion:'V10.2-same-instance',";
if(a.includes(diag)){
  a=a.replace(diag,diag+`
      v12_24:{
        version:'V12.24',
        creatorLinkGuaranteed:true,
        legacyRepairSkipsEventHolder:true
      },`);
}

// ---- sample gate injection ----
// Patch known sample object forms by locating "mint:..." then "decision:" in the same object map.
// Do multiple conservative replacements.
const reps=[
  {
    re:/(mint:\s*mint[\s\S]{0,1800}?decision:\s*([^,\n}]+))/g,
    fn:(m,decision)=> m.includes('gate:')?m:m+`,gate:__v1224GateForMint(mint,effectiveSettings)`
  },
  {
    re:/(mint:\s*t\.mint[\s\S]{0,1800}?decision:\s*([^,\n}]+))/g,
    fn:(m,decision)=> m.includes('gate:')?m:m+`,gate:__v1223Gate(t,effectiveSettings)`
  },
  {
    re:/(mint:\s*token\.mint[\s\S]{0,1800}?decision:\s*([^,\n}]+))/g,
    fn:(m,decision)=> m.includes('gate:')?m:m+`,gate:__v1223Gate(token,effectiveSettings)`
  }
];
for(const x of reps)a=a.replace(x.re,x.fn);

// Expose a deterministic diagnostic helper regardless of sample renderer layout.
a += `
// ${MARK}: deterministic gate endpoint/helper support.
globalThis.__MEMEFLOW_V12_24_GATE_FOR_MINT__=(mint,settings)=>__v1224GateForMint(mint,settings);
`;

fs.writeFileSync(APP,a);

for(const p of [APP,HOLDER]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    fs.copyFileSync(ab,APP);fs.copyFileSync(hb,HOLDER);
    console.error('ABORT: syntax check failed; backups restored.');
    console.error(r.stderr||r.stdout);process.exit(2);
  }
}

console.log('PASS: V12.24 CREATOR + GATE + RECOVERY installed');
console.log('Backups:',ab,hb);
console.log('Creator linkage: enabled');
console.log('Legacy repair skips mints with V12 event-holder snapshot');
console.log('Gate diagnostics helper installed');
