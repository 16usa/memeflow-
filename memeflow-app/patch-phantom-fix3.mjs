import fs from 'node:fs';

const settingsFile=
  'settings.html';

let html=
  fs.readFileSync(
    settingsFile,
    'utf8'
  );

/*
 * Direct-load the Phantom assets from settings.html.
 * This bypasses the old memeflow-nav -> account-wallet-settings cache chain,
 * which is why FIX 2 was installed on disk but did not appear in Safari.
 */
if(
  !html.includes(
    'MEMEFLOW_PHANTOM_CONNECT_DIRECT_LOAD_FIX3'
  )
){
  const marker=
    '</head>';

  if(
    !html.includes(marker)
  ){
    throw new Error(
      'settings.html has no </head>'
    );
  }

  html=
    html.replace(
      marker,
      `  <!-- MEMEFLOW_PHANTOM_CONNECT_DIRECT_LOAD_FIX3 -->
  <link rel="stylesheet" href="/phantom-connect.css?v=phase1-fix3-20260827">
  <script src="/phantom-connect-client.bundle.js?v=phase1-fix3-20260827" defer></script>
  <!-- /MEMEFLOW_PHANTOM_CONNECT_DIRECT_LOAD_FIX3 -->
</head>`
    );
}

fs.writeFileSync(
  settingsFile,
  html
);

const packageFile=
  'package.json';

const pkg=
  JSON.parse(
    fs.readFileSync(
      packageFile,
      'utf8'
    )
  );

pkg.scripts||={};

pkg.scripts[
  'build:phantom-connect'
]=
  'esbuild phantom-connect-client.mjs --bundle --minify --platform=browser --format=iife --target=es2020 --outfile=phantom-connect-client.bundle.js';

fs.writeFileSync(
  packageFile,
  JSON.stringify(
    pkg,
    null,
    2
  )+'\n'
);

console.log(
  'FIX 3 direct-load patch applied.'
);
