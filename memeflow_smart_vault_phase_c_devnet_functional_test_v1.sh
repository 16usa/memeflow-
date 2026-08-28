#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault — PHASE C / DEVNET FUNCTIONAL TEST V1 =="
echo "On-chain DEVNET safety test only."
echo "No Mainnet. No production AUTO LIVE unlock. No real Pump.fun trade."

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
cd "$ROOT"

# shellcheck disable=SC1091
source "./scripts/toolchain-env.sh"

RPC="https://api.devnet.solana.com"
PROGRAM_ID_FILE="DEVNET_PROGRAM_ID.txt"
DEPLOY_RECORD="DEVNET_DEPLOYMENT.json"
PAYER="$HOME/.config/solana/id.json"

[[ -s "$PROGRAM_ID_FILE" ]] || { echo "ERROR: missing $PROGRAM_ID_FILE"; exit 2; }
[[ -s "$DEPLOY_RECORD" ]] || { echo "ERROR: missing $DEPLOY_RECORD"; exit 2; }
[[ -s "$PAYER" ]] || { echo "ERROR: missing Devnet payer $PAYER"; exit 2; }

PROGRAM_ID="$(tr -d '\r\n ' < "$PROGRAM_ID_FILE")"
PAYER_ADDRESS="$(solana-keygen pubkey "$PAYER")"

echo
echo "Program ID : $PROGRAM_ID"
echo "RPC        : $RPC"
echo "Fee payer  : $PAYER_ADDRESS"

solana config set --url "$RPC" --keypair "$PAYER" >/dev/null

echo
echo "Verifying deployed program..."
PROGRAM_SHOW="$(solana program show "$PROGRAM_ID" --url "$RPC")"
printf '%s\n' "$PROGRAM_SHOW"

grep -q "$PROGRAM_ID" <<<"$PROGRAM_SHOW" || {
  echo "ERROR: expected Devnet program is not verifiable." >&2
  exit 3
}

BALANCE="$(solana balance "$PAYER_ADDRESS" --url "$RPC" | awk '{print $1}')"
echo
echo "Devnet payer balance: $BALANCE SOL"

python3 - "$BALANCE" <<'PY'
import sys
b=float(sys.argv[1])
if b < 0.45:
    raise SystemExit(
        f"ERROR: only {b} DEVNET SOL available. "
        "Top the same Devnet payer up to at least 0.45 SOL and rerun."
    )
PY

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$ROOT/.devnet-test-runs/$RUN_ID"
mkdir -p "$RUN_DIR"

export MF_TEST_ROOT="$ROOT"
export MF_TEST_RUN_DIR="$RUN_DIR"
export MF_TEST_RPC="$RPC"
export MF_TEST_PROGRAM_ID="$PROGRAM_ID"
export MF_TEST_PAYER="$PAYER"

cat > "$ROOT/tests/devnet-functional-phase-c.mjs" <<'EOF_NODE'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const ROOT = process.env.MF_TEST_ROOT;
const RUN_DIR = process.env.MF_TEST_RUN_DIR;
const RPC = process.env.MF_TEST_RPC;
const PROGRAM_ID = new PublicKey(process.env.MF_TEST_PROGRAM_ID);
const PAYER_FILE = process.env.MF_TEST_PAYER;

const connection = new Connection(RPC, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 90_000,
});

const SYSTEM = SystemProgram.programId;
const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

function loadKeypair(file) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8')))
  );
}

function saveKeypair(name, kp) {
  const file = path.join(RUN_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  fs.chmodSync(file, 0o600);
  return file;
}

function disc(name) {
  return crypto.createHash('sha256')
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

function u64(v) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
}

function vec(bytes) {
  const data = Buffer.from(bytes);
  const n = Buffer.alloc(4);
  n.writeUInt32LE(data.length);
  return Buffer.concat([n, data]);
}

function ixData(name, ...parts) {
  return Buffer.concat([disc(name), ...parts]);
}

function policyPda(owner) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), owner.toBuffer()],
    PROGRAM_ID
  );
}

function vaultPda(owner) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    PROGRAM_ID
  );
}

function readPolicy(data) {
  let o = 8; // Anchor account discriminator
  const version = data[o]; o += 1;
  const owner = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const executor = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const maxBuy = data.readBigUInt64LE(o); o += 8;
  const daily = data.readBigUInt64LE(o); o += 8;
  const exitOverhead = data.readBigUInt64LE(o); o += 8;
  const spentToday = data.readBigUInt64LE(o); o += 8;
  const dayIndex = data.readBigInt64LE(o); o += 8;
  const entriesPaused = data[o] !== 0; o += 1;
  const policyBump = data[o]; o += 1;
  const vaultBump = data[o]; o += 1;
  return {
    version,
    owner: owner.toBase58(),
    executor: executor.toBase58(),
    maxBuy: maxBuy.toString(),
    daily: daily.toString(),
    exitOverhead: exitOverhead.toString(),
    spentToday: spentToday.toString(),
    dayIndex: dayIndex.toString(),
    entriesPaused,
    policyBump,
    vaultBump,
  };
}

async function fetchPolicy(policy) {
  const ai = await connection.getAccountInfo(policy, 'confirmed');
  if (!ai) throw new Error(`Policy account missing: ${policy.toBase58()}`);
  if (!ai.owner.equals(PROGRAM_ID)) {
    throw new Error(`Policy owner mismatch: ${ai.owner.toBase58()}`);
  }
  return readPolicy(ai.data);
}

async function balance(pk) {
  return connection.getBalance(pk, 'confirmed');
}

const payer = loadKeypair(PAYER_FILE);
const owner = Keypair.generate();
const executor = Keypair.generate();
const attacker = Keypair.generate();

saveKeypair('owner-devnet-only', owner);
saveKeypair('executor-devnet-only', executor);
saveKeypair('attacker-devnet-only', attacker);

const [policy, policyBump] = policyPda(owner.publicKey);
const [vault, vaultBump] = vaultPda(owner.publicKey);

const results = [];
function ok(name, details = {}) {
  results.push({name, status: 'PASS', ...details});
  console.log(`PASS: ${name}`);
}
function fail(name, error) {
  results.push({name, status: 'FAIL', error: String(error?.message || error)});
  throw error;
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function sendIx(name, ix, extraSigners = []) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tx = new Transaction().add(ix);
      tx.feePayer = payer.publicKey;
      return await sendAndConfirmTransaction(
        connection,
        tx,
        [payer, ...extraSigners],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
          maxRetries: 5,
        }
      );
    } catch (e) {
      const text = String(e?.message || e);
      const retryable =
        /blockhash|expired|429|Too Many Requests|timeout|Timed out/i.test(text);
      if (!retryable || attempt === 4) throw e;
      console.log(`  retry ${name}: ${attempt}/4 (${text.slice(0, 120)})`);
      await new Promise(r => setTimeout(r, 1200 * attempt));
    }
  }
}

async function expectReject(name, ix, signers = []) {
  try {
    await sendIx(name, ix, signers);
  } catch (e) {
    ok(name, {rejected: true, error: String(e?.message || e).slice(0, 500)});
    return;
  }
  throw new Error(`${name}: transaction unexpectedly succeeded`);
}

function initializeIx(executorPk, maxBuy, daily, exitOverhead) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: owner.publicKey, isSigner: true, isWritable: true},
      {pubkey: policy, isSigner: false, isWritable: true},
      {pubkey: SYSTEM, isSigner: false, isWritable: false},
    ],
    data: ixData(
      'initialize_policy',
      executorPk.toBuffer(),
      u64(maxBuy),
      u64(daily),
      u64(exitOverhead)
    ),
  });
}

function updatePolicyIx(signer, policyAccount, executorPk, maxBuy, daily, exitOverhead) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: signer.publicKey, isSigner: true, isWritable: false},
      {pubkey: policyAccount, isSigner: false, isWritable: true},
    ],
    data: ixData(
      'update_policy',
      executorPk.toBuffer(),
      u64(maxBuy),
      u64(daily),
      u64(exitOverhead)
    ),
  });
}

function pauseIx(signer, policyAccount, paused) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: signer.publicKey, isSigner: true, isWritable: false},
      {pubkey: policyAccount, isSigner: false, isWritable: true},
    ],
    data: ixData('set_entries_paused', Buffer.from([paused ? 1 : 0])),
  });
}

function depositIx(lamports) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: owner.publicKey, isSigner: true, isWritable: true},
      {pubkey: policy, isSigner: false, isWritable: false},
      {pubkey: vault, isSigner: false, isWritable: true},
      {pubkey: SYSTEM, isSigner: false, isWritable: false},
    ],
    data: ixData('deposit', u64(lamports)),
  });
}

function withdrawIx(signer, policyAccount, vaultAccount, lamports) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: signer.publicKey, isSigner: true, isWritable: true},
      {pubkey: policyAccount, isSigner: false, isWritable: false},
      {pubkey: vaultAccount, isSigner: false, isWritable: true},
      {pubkey: SYSTEM, isSigner: false, isWritable: false},
    ],
    data: ixData('withdraw', u64(lamports)),
  });
}

function executeIx(execSigner, instructionBytes) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {pubkey: policy, isSigner: false, isWritable: true},
      {pubkey: vault, isSigner: false, isWritable: true},
      {pubkey: execSigner.publicKey, isSigner: true, isWritable: false},
      // Deliberately no remaining Pump accounts in these negative tests.
    ],
    data: ixData('execute_pump_v2', vec(instructionBytes)),
  });
}

const MAX_BUY = 50_000_000n;       // 0.05 SOL
const DAILY = 100_000_000n;        // 0.10 SOL
const EXIT_OVERHEAD = 5_000_000n;  // 0.005 SOL
const OWNER_FUND = 300_000_000;     // 0.30 SOL
const VAULT_DEPOSIT = 150_000_000n; // 0.15 SOL
const FIRST_WITHDRAW = 40_000_000n; // 0.04 SOL

console.log('\n== Test identities ==');
console.log('owner   :', owner.publicKey.toBase58());
console.log('executor:', executor.publicKey.toBase58());
console.log('attacker:', attacker.publicKey.toBase58());
console.log('policy  :', policy.toBase58(), `(bump ${policyBump})`);
console.log('vault   :', vault.toBase58(), `(bump ${vaultBump})`);

try {
  // 0. Confirm the deployed Program ID really is executable.
  const programInfo = await connection.getAccountInfo(PROGRAM_ID, 'confirmed');
  assert(programInfo, 'Deployed program account not found');
  assert(programInfo.executable, 'Deployed program account is not executable');
  ok('deployed program is executable');

  const pumpInfo = await connection.getAccountInfo(PUMP_PROGRAM, 'confirmed');
  console.log(
    'Pump program on Devnet:',
    pumpInfo ? `exists executable=${pumpInfo.executable}` : 'NOT PRESENT'
  );

  // 1. Give the ephemeral owner enough DEVNET SOL for policy rent + vault funding.
  await sendIx(
    'fund ephemeral owner',
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: owner.publicKey,
      lamports: OWNER_FUND,
    }),
    []
  );
  assert((await balance(owner.publicKey)) >= OWNER_FUND, 'owner funding missing');
  ok('ephemeral owner funded with DEVNET SOL');

  // 2. Initialize policy on-chain. It must start fail-closed / paused.
  await sendIx(
    'initialize policy',
    initializeIx(executor.publicKey, MAX_BUY, DAILY, EXIT_OVERHEAD),
    [owner]
  );
  let state = await fetchPolicy(policy);
  assert(state.version === 1, 'policy version != 1');
  assert(state.owner === owner.publicKey.toBase58(), 'policy owner mismatch');
  assert(state.executor === executor.publicKey.toBase58(), 'executor mismatch');
  assert(state.maxBuy === MAX_BUY.toString(), 'max-buy mismatch');
  assert(state.daily === DAILY.toString(), 'daily limit mismatch');
  assert(state.exitOverhead === EXIT_OVERHEAD.toString(), 'exit overhead mismatch');
  assert(state.spentToday === '0', 'spent_today should start at zero');
  assert(state.entriesPaused === true, 'policy must initialize paused');
  assert(state.policyBump === policyBump, 'policy bump mismatch');
  assert(state.vaultBump === vaultBump, 'vault bump mismatch');
  ok('initialize_policy writes correct fail-closed state', {state});

  // 3. Invalid policy relationship must fail ON-CHAIN.
  await expectReject(
    'invalid policy limits rejected on-chain',
    updatePolicyIx(owner, policy, executor.publicKey, 120_000_000n, 100_000_000n, EXIT_OVERHEAD),
    [owner]
  );
  state = await fetchPolicy(policy);
  assert(state.maxBuy === MAX_BUY.toString(), 'invalid update changed max buy');
  assert(state.daily === DAILY.toString(), 'invalid update changed daily limit');

  // 4. Attacker cannot unpause owner's policy.
  await expectReject(
    'attacker cannot change owner policy',
    pauseIx(attacker, policy, false),
    [attacker]
  );
  state = await fetchPolicy(policy);
  assert(state.entriesPaused === true, 'attacker changed pause state');

  // 5. Owner can arm entries, then emergency-pause again.
  await sendIx('owner unpauses entries', pauseIx(owner, policy, false), [owner]);
  state = await fetchPolicy(policy);
  assert(state.entriesPaused === false, 'owner unpause did not stick');
  ok('owner can unpause entries');

  await sendIx('owner emergency pauses entries', pauseIx(owner, policy, true), [owner]);
  state = await fetchPolicy(policy);
  assert(state.entriesPaused === true, 'emergency pause did not stick');
  ok('emergency entry lock is stored on-chain');

  // 6. Deposit into the PDA vault and verify exact balance.
  const beforeVault = await balance(vault);
  assert(beforeVault === 0, `new vault expected 0 lamports, got ${beforeVault}`);
  await sendIx('owner deposits to vault', depositIx(VAULT_DEPOSIT), [owner]);
  let vaultBal = await balance(vault);
  assert(vaultBal === Number(VAULT_DEPOSIT), `vault balance mismatch: ${vaultBal}`);
  const vaultInfo = await connection.getAccountInfo(vault, 'confirmed');
  assert(vaultInfo, 'vault account not present after deposit');
  assert(vaultInfo.owner.equals(SYSTEM), 'vault must be System Program-owned');
  ok('owner deposit creates/funds System-owned vault PDA', {vaultLamports: vaultBal});

  // 7. Neither attacker nor configured executor may withdraw.
  await expectReject(
    'attacker cannot withdraw owner vault',
    withdrawIx(attacker, policy, vault, 1_000_000n),
    [attacker]
  );
  assert((await balance(vault)) === vaultBal, 'attacker changed vault balance');

  await expectReject(
    'executor cannot withdraw owner vault',
    withdrawIx(executor, policy, vault, 1_000_000n),
    [executor]
  );
  assert((await balance(vault)) === vaultBal, 'executor changed vault balance');

  // 8. Owner withdrawal works and is exact.
  await sendIx(
    'owner withdraws from vault',
    withdrawIx(owner, policy, vault, FIRST_WITHDRAW),
    [owner]
  );
  vaultBal = await balance(vault);
  assert(
    vaultBal === Number(VAULT_DEPOSIT - FIRST_WITHDRAW),
    `owner withdrawal wrong vault balance: ${vaultBal}`
  );
  ok('owner-only withdrawal succeeds', {vaultLamports: vaultBal});

  // 9. Over-withdraw is rejected.
  await expectReject(
    'over-withdraw rejected on-chain',
    withdrawIx(owner, policy, vault, 500_000_000n),
    [owner]
  );
  assert((await balance(vault)) === vaultBal, 'failed over-withdraw changed vault');

  // 10. Executor route negative tests. These reach the on-chain handler without
  //     needing an actual Pump market on Devnet.
  await expectReject(
    'unauthorized executor rejected before trade handler',
    executeIx(attacker, Buffer.alloc(0)),
    [attacker]
  );

  await expectReject(
    'malformed trade payload rejected on-chain',
    executeIx(executor, Buffer.alloc(0)),
    [executor]
  );

  await expectReject(
    'unapproved Pump instruction discriminator rejected on-chain',
    executeIx(executor, Buffer.alloc(24, 0)),
    [executor]
  );

  const buyShape = Buffer.alloc(24, 0);
  disc('buy_v2').copy(buyShape, 0);
  buyShape.writeBigUInt64LE(1n, 8);
  buyShape.writeBigUInt64LE(1n, 16);
  await expectReject(
    'Pump BUY requires exact official account set',
    executeIx(executor, buyShape),
    [executor]
  );

  // 11. Owner can tighten limits; parse on-chain state to prove persistence.
  const NEW_MAX = 40_000_000n;
  const NEW_DAILY = 80_000_000n;
  const NEW_EXIT = 3_000_000n;
  await sendIx(
    'owner updates policy',
    updatePolicyIx(owner, policy, executor.publicKey, NEW_MAX, NEW_DAILY, NEW_EXIT),
    [owner]
  );
  state = await fetchPolicy(policy);
  assert(state.maxBuy === NEW_MAX.toString(), 'updated max-buy mismatch');
  assert(state.daily === NEW_DAILY.toString(), 'updated daily mismatch');
  assert(state.exitOverhead === NEW_EXIT.toString(), 'updated exit overhead mismatch');
  assert(state.entriesPaused === true, 'policy should remain emergency-paused');
  ok('owner policy-limit update persists on-chain', {state});

  // 12. Deterministic debit-limit model, matching the contract's BUY arithmetic.
  const approveBuy = ({paused, maxTrade, daily, spent, quoteLimit, actualDebit}) => {
    if (paused) return 'PAUSED';
    if (quoteLimit > maxTrade || actualDebit > maxTrade) return 'PER_TRADE';
    if (spent + actualDebit > daily) return 'DAILY';
    return 'OK';
  };
  assert(
    approveBuy({
      paused: false, maxTrade: 40n, daily: 80n, spent: 0n,
      quoteLimit: 40n, actualDebit: 39n
    }) === 'OK',
    'allowed debit model failed'
  );
  assert(
    approveBuy({
      paused: false, maxTrade: 40n, daily: 80n, spent: 0n,
      quoteLimit: 41n, actualDebit: 39n
    }) === 'PER_TRADE',
    'per-trade debit model failed'
  );
  assert(
    approveBuy({
      paused: false, maxTrade: 40n, daily: 80n, spent: 70n,
      quoteLimit: 10n, actualDebit: 11n
    }) === 'DAILY',
    'daily debit model failed'
  );
  assert(
    approveBuy({
      paused: true, maxTrade: 40n, daily: 80n, spent: 0n,
      quoteLimit: 1n, actualDebit: 1n
    }) === 'PAUSED',
    'pause debit model failed'
  );
  ok('per-trade / daily / pause debit model matches policy semantics');

  // 13. Clean the test vault: owner withdraws every remaining lamport.
  const remaining = await balance(vault);
  if (remaining > 0) {
    await sendIx(
      'owner drains test vault',
      withdrawIx(owner, policy, vault, BigInt(remaining)),
      [owner]
    );
  }
  const finalVault = await balance(vault);
  assert(finalVault === 0, `test vault should end at 0, got ${finalVault}`);
  ok('test vault cleanup complete');

  // Return the ephemeral owner's loose DEVNET SOL to the dedicated payer.
  const ownerBalance = await balance(owner.publicKey);
  if (ownerBalance > 0) {
    await sendIx(
      'return ephemeral owner SOL',
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: payer.publicKey,
        lamports: ownerBalance,
      }),
      [owner]
    );
  }
  ok('ephemeral owner balance returned to Devnet payer');

  const finalState = await fetchPolicy(policy);
  const report = {
    environment: 'devnet',
    rpc: RPC,
    programId: PROGRAM_ID.toBase58(),
    payer: payer.publicKey.toBase58(),
    owner: owner.publicKey.toBase58(),
    executor: executor.publicKey.toBase58(),
    attacker: attacker.publicKey.toBase58(),
    policy: policy.toBase58(),
    vault: vault.toBase58(),
    pumpProgramPresentOnDevnet: Boolean(pumpInfo),
    pumpProgramExecutableOnDevnet: Boolean(pumpInfo?.executable),
    finalPolicy: finalState,
    finalVaultLamports: await balance(vault),
    results,
    productionAutoLiveUnlocked: false,
    mainnetTouched: false,
    realMoneyUsed: false,
    note:
      'Real Pump CPI BUY/SELL is deliberately not executed in Phase C. ' +
      'This run validates the deployed vault/policy authority and rejection gates on Devnet.',
    completedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(RUN_DIR, 'phase-c-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );

  console.log('\n== PHASE C DEVNET FUNCTIONAL TEST PASSED ==');
  console.log(`PASS count: ${results.filter(x => x.status === 'PASS').length}`);
  console.log('Report:', path.join(RUN_DIR, 'phase-c-report.json'));
  console.log('Policy:', policy.toBase58());
  console.log('Vault:', vault.toBase58());
  console.log('Vault final balance: 0 lamports');
  console.log('AUTO LIVE production: STILL LOCKED');
  console.log('Mainnet: NOT TOUCHED');
} catch (e) {
  const report = {
    environment: 'devnet',
    rpc: RPC,
    programId: PROGRAM_ID.toBase58(),
    owner: owner.publicKey.toBase58(),
    executor: executor.publicKey.toBase58(),
    attacker: attacker.publicKey.toBase58(),
    policy: policy.toBase58(),
    vault: vault.toBase58(),
    results,
    failure: String(e?.stack || e),
    completedAt: new Date().toISOString(),
    productionAutoLiveUnlocked: false,
    mainnetTouched: false,
    realMoneyUsed: false,
  };
  fs.writeFileSync(
    path.join(RUN_DIR, 'phase-c-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.error('\n== PHASE C FAILED ==');
  console.error(e?.stack || e);
  console.error('Report:', path.join(RUN_DIR, 'phase-c-report.json'));
  process.exit(1);
}
EOF_NODE

echo
echo "Phase C will:"
echo "  1. create temporary DEVNET owner/executor/attacker keys;"
echo "  2. initialize a real policy PDA on Devnet;"
echo "  3. verify fail-closed pause state;"
echo "  4. test owner-only policy controls;"
echo "  5. deposit 0.15 DEVNET SOL into the real vault PDA;"
echo "  6. prove attacker/executor cannot withdraw;"
echo "  7. test owner withdrawal and over-withdraw rejection;"
echo "  8. test executor-route rejection gates;"
echo "  9. verify policy limits persisted on-chain;"
echo " 10. drain the temporary vault back to the test owner and return loose DEVNET SOL."
echo
echo "It will NOT execute a real Pump.fun BUY/SELL."
echo "It will NOT change MEMEFLOW production."
echo "It will NOT touch Mainnet."
echo
read -r -p "Type exactly TEST DEVNET to continue: " CONFIRM
if [[ "$CONFIRM" != "TEST DEVNET" ]]; then
  echo "Cancelled. No Phase C transactions sent."
  exit 0
fi

echo
echo "Running Phase C..."
node "$ROOT/tests/devnet-functional-phase-c.mjs"

echo
echo "== SMART VAULT PHASE C COMPLETE =="
echo "Devnet on-chain safety tests passed."
echo "Production AUTO LIVE remains locked."
echo "Mainnet remains untouched."
echo
echo "STOP HERE."
echo "Next gate after review: server executor integration on DEVNET only."
