import fs from 'node:fs';

function addConfigRoute(){
  const file=
    'live-bootstrap.mjs';

  let text=
    fs.readFileSync(
      file,
      'utf8'
    );

  if(
    text.includes(
      "pathname==='/api/phantom/config'"
    )
  ){
    return;
  }

  const needle=
    "pathname==='/api/live/status'";

  const pos=
    text.indexOf(needle);

  if(pos<0){
    throw new Error(
      'Cannot find existing /api/live/status route in live-bootstrap.mjs'
    );
  }

  const lineStart=
    text.lastIndexOf(
      '\n',
      pos
    )+1;

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

  text=
    text.slice(
      0,
      lineStart
    )+
    route+
    text.slice(
      lineStart
    );

  fs.writeFileSync(
    file,
    text
  );
}

function addLoader(){
  const file=
    'account-wallet-settings.js';

  let text=
    fs.readFileSync(
      file,
      'utf8'
    );

  if(
    text.includes(
      'MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER'
    )
  ){
    return;
  }

  text+=`

/* MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER */
(() => {
  if (
    window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER__
  ) return;

  window.__MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER__=true;

  const css=
    document.createElement('link');

  css.rel='stylesheet';
  css.href=
    '/phantom-connect.css?v=phase1-fix2-20260827';

  document.head.appendChild(css);

  const js=
    document.createElement('script');

  js.src=
    '/phantom-connect-client.bundle.js?v=phase1-fix2-20260827';

  js.defer=true;

  document.head.appendChild(js);
})();
/* /MEMEFLOW_PHANTOM_CONNECT_PHASE1_FIX2_LOADER */
`;

  fs.writeFileSync(
    file,
    text
  );
}

function addEnv(){
  const file='.env.example';

  let text=
    fs.existsSync(file)
      ?fs.readFileSync(
        file,
        'utf8'
      )
      :'';

  if(
    !text.includes(
      '# Phantom Connect'
    )
  ){
    text+=`
# Phantom Connect — public application identifier from Phantom Portal
PHANTOM_APP_ID=

# Reserved for the audited on-chain AUTO LIVE Smart Vault.
MEMEFLOW_SMART_VAULT_PROGRAM_ID=
`;
  }

  fs.writeFileSync(
    file,
    text
  );
}

function addBuildScript(){
  const file=
    'package.json';

  const pkg=
    JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );

  pkg.scripts||={};

  pkg.scripts[
    'build:phantom-connect'
  ]=
    'esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';

  fs.writeFileSync(
    file,
    JSON.stringify(
      pkg,
      null,
      2
    )+'\n'
  );
}

addConfigRoute();
addLoader();
addEnv();
addBuildScript();

console.log(
  'Patch files updated successfully.'
);
