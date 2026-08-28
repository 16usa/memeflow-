import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const src=fs.readFileSync(path.join(root,'app-server.mjs'),'utf8');

assert.match(src,/MEMEFLOW_SETTINGS_FIRST_V34/);
assert.match(src,/holderAdmissionSettingsPrecheck\(token,s\)/);
assert.match(src,/const s = __holderAdmissionSettings;/);
assert.doesNotMatch(
  src,
  /return \{allow:true,reason:'fresh_pump_canonical_holder_scan'/
);
assert.doesNotMatch(
  src,
  /const s = \{\.\.\.__holderAdmissionSettings,\s*minBuyPressure:\s*null\}/
);

// Bridge and queue must continue to share the same admission function.
assert.match(src,/admissionFn:holderAdmissionForActiveUsers/);
assert.match(
  src,
  /MEMEFLOW_V12_9_PRE_QUEUE_ADMISSION_BRIDGE[\s\S]{0,500}holderAdmissionForActiveUsers\(mint\)/
);

console.log('settings admission v34 ok');
