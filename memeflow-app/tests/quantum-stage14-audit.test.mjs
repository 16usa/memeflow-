import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'scripts/quantum-stage14-execution-audit.mjs'),'utf8');
assert.match(source,/mode:'READ_ONLY'/);
assert.match(source,/liveReady:false/);
assert.match(source,/quantumGateProven:false/);
assert.doesNotMatch(source,/\bexecuteTrade\s*\(/); // audit must never call execution
assert.doesNotMatch(source,/writeFileSync|appendFileSync|unlinkSync/);
console.log('Stage 14 audit safety assertions passed; not live trading validation');
