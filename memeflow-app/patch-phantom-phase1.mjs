import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error(`Patch anchor not found: ${label}`);
  return text.replace(from,to);
}

// 1) Expose the public Phantom App ID. AUTO 24/7 stays hard-false until the
// separate on-chain Smart Vault module exists and is verified.
{
  const file='live-bootstrap.mjs';
  let s=fs.readFileSync(file,'utf8');
  const anchor="    if(req.method==='GET'&&pathname==='/api/live/status'){";
  const route=`    if(req.method==='GET'&&pathname==='/api/phantom/config'){
      return json(res,200,{
        appId:String(process.env.PHANTOM_APP_ID||''),
        network:'mainnet-beta',
        nonCustodial:true,
        auto24x7Ready:false,
        smartVaultProgramId:String(process.env.MEMEFLOW_SMART_VAULT_PROGRAM_ID||'')
      });
    }

${anchor}`;
  s=replaceOnce(s,anchor,route,'live-bootstrap phantom config route');
  fs.writeFileSync(file,s);
}

// 2) Prefer Phantom Connect when available, while retaining the original
// injected Phantom/Solflare fallback.
{
  const file='live-wallet-execution.js';
  let s=fs.readFileSync(file,'utf8');

  const a=`  async function connectedWallet({interactive=false}={}) {
    const p=provider();`;
  const b=`  async function connectedWallet({interactive=false}={}) {
    const pcAddress=window.MEMEFLOW_PHANTOM?.address?.();
    if(pcAddress)return {provider:null,address:String(pcAddress)};
    const p=provider();`;
  s=replaceOnce(s,a,b,'live wallet address bridge');

  const c=`  async function signAndSend(transactionBase64) {
    const {provider:p}=await connectedWallet({interactive:true});`;
  const d=`  async function signAndSend(transactionBase64) {
    if(window.MEMEFLOW_PHANTOM?.address?.()&&window.MEMEFLOW_PHANTOM?.signAndSend){
      return await window.MEMEFLOW_PHANTOM.signAndSend(transactionBase64);
    }
    const {provider:p}=await connectedWallet({interactive:true});`;
  s=replaceOnce(s,c,d,'live wallet signing bridge');
  fs.writeFileSync(file,s);
}

// 3) Existing "Connect wallet" button uses the new connector when loaded.
{
  const file='account-wallet-settings.js';
  let s=fs.readFileSync(file,'utf8');
  const a=`  async function connectWallet() {
    message();
    const p = provider();`;
  const b=`  async function connectWallet() {
    if (window.MEMEFLOW_PHANTOM?.connectBest) {
      try { await window.MEMEFLOW_PHANTOM.connectBest(); return; }
      catch (error) { message(error.message || 'Wallet connection failed.', true); return; }
    }
    message();
    const p = provider();`;
  s=replaceOnce(s,a,b,'settings connect button bridge');

  if(!s.includes('MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER')){
    s+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
(() => {
  if (window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__) return;
  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__=true;
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='/phantom-connect.css?v=phase1-20260827';
  document.head.appendChild(css);
  const js=document.createElement('script');
  js.src='/phantom-connect-client.bundle.js?v=phase1-20260827';js.defer=true;
  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
`;
  }
  fs.writeFileSync(file,s);
}

// 4) Add public configuration placeholders only. PHANTOM_APP_ID is public;
// no seed phrase/private key belongs here.
{
  const file='.env.example';
  let s=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(!s.includes('# Phantom Connect')){
    s+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the next audited/on-chain AUTO LIVE module.
# Do not set this to a random address; AUTO 24/7 remains disabled in Phase 1.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }
  fs.writeFileSync(file,s);
}

// 5) Add reproducible bundle command.
{
  const file='package.json';
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  p.scripts||={};
  p.scripts['build:phantom-connect']='esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
}
