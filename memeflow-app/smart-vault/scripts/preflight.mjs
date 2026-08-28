import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const sh = cmd => {
  try { return execFileSync('bash',['-lc',cmd],{encoding:'utf8'}).trim(); }
  catch { return null; }
};

const programId=fs.readFileSync(new URL('../.dev-program-id',import.meta.url),'utf8').trim();

console.log('MEMEFLOW Smart Vault Phase A preflight');
console.log('programId(dev only):',programId);
console.log('cargo:',sh('cargo --version')||'MISSING');
console.log('rustc:',sh('rustc --version')||'MISSING');
console.log('solana:',sh('solana --version')||'MISSING');
console.log('anchor:',sh('anchor --version')||'MISSING');
console.log('cluster target: DEVNET ONLY');
console.log('mainnet auto unlock: BLOCKED');
console.log('Pump v2 CPI: scaffolded');
console.log('PumpSwap CPI: BLOCKED until Phase B');
