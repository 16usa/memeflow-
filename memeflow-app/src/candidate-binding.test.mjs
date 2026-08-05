import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Primary Candidate binding v2 is installed',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/MEMEFLOW_PRIMARY_BINDING_V2/);
 assert.match(html,/primaryMeta/);
 assert.match(html,/c\.mint,c\.tokenMint,c\.tokenAddress/);
 assert.match(html,/TOP 10/);
 assert.match(html,/LIQUIDITY/);
 assert.match(html,/MOMENTUM/);
 assert.match(html,/DEVELOPER/);
});