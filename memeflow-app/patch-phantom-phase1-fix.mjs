import fs from 'node:fs';

function insertBeforeLineContaining(text,needle,insert,label){
  if(text.includes(insert.trim().slice(0,40)))return text;
  const i=text.indexOf(needle);
  if(i<0)throw new Error(`Anchor not found: ${label}`);
  const lineStart=text.lastIndexOf('\n',i)+1;
  return text.slice(0,lineStart)+insert+text.slice(lineStart);
}
function insertAfter(text,needle,insert,label){
  if(text.includes(insert.trim()))return text;
  const i=text.indexOf(needle);
  if(i<0)throw new Error(`Anchor not found: ${label}`);
  const at=i+needle.length;
  return text.slice(0,at)+insert+text.slice(at);
}

// live-bootstrap: robustly insert immediately before whatever line contains
// the existing /api/live/status branch. No formatting assumption.
{
  const file='live-bootstrap.mjs';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes("pathname==='/api/phantom/config'")){
    const route=`    if(req.method==='GET'&&pathname==='/api/phantom/config'){
      return json(res,200,{
        appId:String(process.env.PHANTOM_APP_ID||''),
        network:'mainnet-beta',
        nonCustodial:true,
        auto24x7Ready:false,
        smartVaultProgramId:String(process.env.MEMEFLOW_SMART_VAULT_PROGRAM_ID||'')
      });
    }

`;
    s=insertBeforeLineContaining(
      s,
      "pathname==='/api/live/status'",
      route,
      'live-bootstrap /api/live/status'
    );
  }
  fs.writeFileSync(file,s);
}

// Existing LIVE bridge: Phantom Connect wins when present; old injected
// Phantom/Solflare path remains as fallback.
{
  const file='live-wallet-execution.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('const pcAddress=window.MEMEFLOW_PHANTOM?.address?.()')){
    const needle='  async function connectedWallet({interactive=false}={}) {';
    s=insertAfter(
      s,needle,
      `\n    const pcAddress=window.MEMEFLOW_PHANTOM?.address?.();\n    if(pcAddress)return {provider:null,address:String(pcAddress)};`,
      'connectedWallet'
    );
  }

  if(!s.includes('window.MEMEFLOW_PHANTOM?.signAndSend')){
    const needle='  async function signAndSend(transactionBase64) {';
    s=insertAfter(
      s,needle,
      `\n    if(window.MEMEFLOW_PHANTOM?.address?.()&&window.MEMEFLOW_PHANTOM?.signAndSend){\n      return await window.MEMEFLOW_PHANTOM.signAndSend(transactionBase64);\n    }`,
      'signAndSend'
    );
  }
  fs.writeFileSync(file,s);
}

// System Settings existing button routes through Phantom Connect when loaded.
{
  const file='account-wallet-settings.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('window.MEMEFLOW_PHANTOM?.connectBest')){
    const needle='  async function connectWallet() {';
    s=insertAfter(
      s,needle,
      `\n    if (window.MEMEFLOW_PHANTOM?.connectBest) {\n      try { await window.MEMEFLOW_PHANTOM.connectBest(); return; }\n      catch (error) { message(error.message || 'Wallet connection failed.', true); return; }\n    }`,
      'connectWallet'
    );
  }

  if(!s.includes('MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER')){
    s+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
(() => {
  if (window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__) return;
  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER__=true;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='/phantom-connect.css?v=phase1-fix-20260827';
  document.head.appendChild(css);
  const js=document.createElement('script');
  js.src='/phantom-connect-client.bundle.js?v=phase1-fix-20260827';
  js.defer=true;
  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_LOADER */
`;
  }
  fs.writeFileSync(file,s);
}

// Environment example.
{
  const file='.env.example';
  let s=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(!s.includes('# Phantom Connect')){
    s+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the audited on-chain AUTO LIVE Smart Vault.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }
  fs.writeFileSync(file,s);
}

// Reproducible browser build.
{
  const file='package.json';
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  p.scripts||={};
  p.scripts['build:phantom-connect']='esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';
  fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
}
