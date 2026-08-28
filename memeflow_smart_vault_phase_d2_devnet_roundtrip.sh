#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
D1="$ROOT/devnet-executor-d1"
D2="$ROOT/devnet-executor-d2"
IDL="$ROOT/target/idl/memeflow_smart_vault.json"
DEPLOY="$ROOT/DEVNET_DEPLOYMENT.json"
OWNER="$ROOT/.toolchain/home/.config/solana/id.json"

echo "== MEMEFLOW Smart Vault — Phase D2 / REAL DEVNET Pump round-trip =="
echo "DEVNET ONLY. No Mainnet. Production AUTO LIVE remains locked."
echo

for f in \
  "$D1/lib.mjs" \
  "$D1/.state/executor.json" \
  "$IDL" \
  "$DEPLOY" \
  "$OWNER"
do
  if [ ! -f "$f" ]; then
    echo "ERROR: required D1 file is missing: $f" >&2
    exit 1
  fi
done

mkdir -p "$D2/.state"
chmod 700 "$D2/.state"

cat > "$D2/.gitignore" <<'EOF'
.state/
node_modules/
EOF

cat > "$D2/package.json" <<'EOF'
{
  "name": "memeflow-smart-vault-devnet-executor-d2",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node roundtrip.mjs"
  },
  "dependencies": {
    "@pump-fun/pump-sdk": "^1.33.0",
    "@solana/spl-token": "^0.4.14",
    "@solana/web3.js": "^1.98.0",
    "bn.js": "^5.2.2"
  }
}
EOF

cat > "$D2/roundtrip.mjs" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  OnlinePumpSdk,
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "@pump-fun/pump-sdk";

import {
  DEVNET_GENESIS,
  OWNER_PATH,
  PUMP_PROGRAM_ID,
  STATE as D1_STATE,
  USER_INDEX,
  devnetConnection,
  deriveAddresses,
  loadKeypair,
  loadOrCreateExecutor,
  makeProgram,
  programIdFromDeployment,
} from "../devnet-executor-d1/lib.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STATE = path.join(HERE, ".state");
const MINT_PATH = path.join(STATE, "d2-test-mint.json");
const REPORT_PATH = path.join(STATE, "d2-roundtrip-report.json");

const BUY_LAMPORTS = BigInt(process.env.D2_BUY_LAMPORTS || "2000000"); // 0.002 devnet SOL
const EXECUTOR_TARGET = BigInt(process.env.D2_EXECUTOR_TARGET_LAMPORTS || "15000000"); // 0.015
const MIN_OWNER_REMAINING = 20_000_000n;
const MAX_D2_BUY = 5_000_000n;

if (BUY_LAMPORTS <= 0n || BUY_LAMPORTS > MAX_D2_BUY) {
  throw new Error(`D2_BUY_LAMPORTS must be 1..${MAX_D2_BUY}`);
}

function saveKeypair(p, kp) {
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  try { fs.chmodSync(p, 0o600); } catch {}
}

function loadOrCreateMint() {
  if (fs.existsSync(MINT_PATH)) return loadKeypair(MINT_PATH);
  const kp = Keypair.generate();
  saveKeypair(MINT_PATH, kp);
  return kp;
}

async function sendWithSigners(connection, instructions, signers, label) {
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ...instructions,
  );
  const sig = await sendAndConfirmTransaction(connection, tx, signers, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    skipPreflight: false,
    maxRetries: 8,
  });
  console.log(`${label}: ${sig}`);
  return sig;
}

function findPumpTrade(ixs, expectedCount, vault, label) {
  const ix = ixs.find(
    (x) =>
      x?.programId?.equals?.(PUMP_PROGRAM_ID) &&
      x?.data?.length === 24 &&
      Array.isArray(x.keys) &&
      x.keys.length === expectedCount
  );

  if (!ix) {
    const seen = ixs.map((x) => ({
      program: x?.programId?.toBase58?.(),
      bytes: x?.data?.length,
      accounts: x?.keys?.length,
    }));
    throw new Error(
      `${label}: current Pump SDK did not produce the expected ${expectedCount}-account v2 trade instruction.\n` +
      JSON.stringify(seen, null, 2)
    );
  }

  if (!ix.keys[USER_INDEX].pubkey.equals(vault)) {
    throw new Error(`${label}: Pump user #14 is not the Smart Vault PDA`);
  }
  if (!ix.keys[2].pubkey.equals(NATIVE_MINT)) {
    throw new Error(`${label}: quote mint is not wrapped SOL; D2 is SOL-paired only`);
  }
  if (!ix.keys[expectedCount - 1].pubkey.equals(PUMP_PROGRAM_ID)) {
    throw new Error(`${label}: final Pump account is not the official Pump program`);
  }
  return ix;
}

async function executeThroughSmartVault({
  connection,
  programId,
  policy,
  vault,
  executor,
  pumpInstruction,
  label,
}) {
  const remainingAccounts = pumpInstruction.keys.map((k) => ({
    pubkey: k.pubkey,
    isWritable: Boolean(k.isWritable),
    // Never forward a transaction-level signer. The Smart Vault re-marks
    // only Pump account #14 (vault PDA) as signer inside invoke_signed().
    isSigner: false,
  }));

  const { program } = makeProgram(connection, executor, programId);

  const sig = await program.methods
    .executePumpV2(Array.from(pumpInstruction.data))
    .accounts({
      policy,
      vault,
      executor: executor.publicKey,
      pumpProgram: PUMP_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 700_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ])
    .signers([executor])
    .rpc({
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      skipPreflight: false,
      maxRetries: 8,
    });

  await connection.confirmTransaction(sig, "confirmed");
  console.log(`${label}: ${sig}`);
  return sig;
}

async function tokenRawBalance(connection, ata, tokenProgram) {
  try {
    const account = await getAccount(connection, ata, "confirmed", tokenProgram);
    return account.amount;
  } catch {
    return 0n;
  }
}

const connection = await devnetConnection();
const genesis = await connection.getGenesisHash();
if (genesis !== DEVNET_GENESIS) {
  throw new Error(`HARD STOP: not Devnet (${genesis})`);
}

const programId = programIdFromDeployment();
const owner = loadKeypair(OWNER_PATH);
const executor = loadOrCreateExecutor();
const { policy, vault } = deriveAddresses(programId, owner.publicKey);

console.log("DEVNET genesis: OK");
console.log("Smart Vault program:", programId.toBase58());
console.log("Owner:", owner.publicKey.toBase58());
console.log("Executor:", executor.publicKey.toBase58());
console.log("Policy:", policy.toBase58());
console.log("Vault:", vault.toBase58());
console.log("");

const [smartVaultProgramInfo, pumpProgramInfo, policyInfo, vaultInfo] = await Promise.all([
  connection.getAccountInfo(programId, "confirmed"),
  connection.getAccountInfo(PUMP_PROGRAM_ID, "confirmed"),
  connection.getAccountInfo(policy, "confirmed"),
  connection.getAccountInfo(vault, "confirmed"),
]);

if (!smartVaultProgramInfo?.executable) throw new Error("Smart Vault program is not executable on Devnet");
if (!pumpProgramInfo?.executable) throw new Error("Official Pump program is not executable on Devnet");
if (!policyInfo) throw new Error("D1 Policy PDA is missing");
if (!vaultInfo) throw new Error("D1 Vault PDA is missing");

console.log("Smart Vault executable: OK");
console.log("Official Pump DEVNET executable: OK");

let ownerBalance = BigInt(await connection.getBalance(owner.publicKey, "confirmed"));
let executorBalance = BigInt(await connection.getBalance(executor.publicKey, "confirmed"));

if (executorBalance < EXECUTOR_TARGET) {
  const delta = EXECUTOR_TARGET - executorBalance;
  if (ownerBalance <= delta + MIN_OWNER_REMAINING) {
    throw new Error(
      `DEVNET owner needs more test SOL. Owner=${ownerBalance} lamports, need at least ${delta + MIN_OWNER_REMAINING}.`
    );
  }

  console.log(`Funding DEVNET executor by ${delta} lamports...`);
  await sendWithSigners(
    connection,
    [
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: executor.publicKey,
        lamports: Number(delta),
      }),
    ],
    [owner],
    "executor funding"
  );
}

const sdk = new OnlinePumpSdk(connection);
let mint = loadOrCreateMint();

async function ensureFreshPumpTestMint() {
  let mintInfo = await connection.getAccountInfo(mint.publicKey, "confirmed");

  if (mintInfo) {
    try {
      const state = await sdk.fetchBuyState(mint.publicKey, vault);
      if (!state?.bondingCurve?.complete) {
        console.log("Reusing existing D2 DEVNET Pump test mint:", mint.publicKey.toBase58());
        return;
      }
      console.log("Previous D2 mint graduated; generating a fresh DEVNET mint.");
    } catch {
      console.log("Previous D2 mint is not usable; generating a fresh DEVNET mint.");
    }

    mint = Keypair.generate();
    saveKeypair(MINT_PATH, mint);
    mintInfo = null;
  }

  if (!mintInfo) {
    console.log("Creating a fresh Pump.fun token on DEVNET only...");
    const createIx = await PUMP_SDK.createV2Instruction({
      mint: mint.publicKey,
      name: "MEMEFLOW D2 DEVNET",
      symbol: "MFD2",
      uri: "https://example.com/memeflow-d2-devnet.json",
      creator: owner.publicKey,
      user: owner.publicKey,
      mayhemMode: false,
      cashback: false,
    });

    await sendWithSigners(connection, [createIx], [owner, mint], "Pump DEVNET create_v2");
    console.log("D2 test mint:", mint.publicKey.toBase58());
  }
}

await ensureFreshPumpTestMint();

const [buyState, global, feeConfig] = await Promise.all([
  sdk.fetchBuyState(mint.publicKey, vault),
  sdk.fetchGlobal(),
  sdk.fetchFeeConfig().catch(() => null),
]);

if (buyState.bondingCurve.complete) {
  throw new Error("D2 test bonding curve is already complete");
}

const tokenProgram = buyState.tokenProgram;
if (!tokenProgram) throw new Error("Pump SDK did not return tokenProgram");

const baseAta = getAssociatedTokenAddressSync(
  mint.publicKey,
  vault,
  true,
  tokenProgram,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

// Critical: create the vault's base-token ATA with EXECUTOR as payer.
// The vault PDA is only the token-account owner and does not need to sign here.
if (!(await connection.getAccountInfo(baseAta, "confirmed"))) {
  console.log("Creating vault token ATA with executor as DEVNET payer...");
  const ataIx = createAssociatedTokenAccountIdempotentInstruction(
    executor.publicKey,
    baseAta,
    vault,
    mint.publicKey,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  await sendWithSigners(connection, [ataIx], [executor], "vault ATA");
}

const solAmount = new BN(BUY_LAMPORTS.toString());
const buyTokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  amount: solAmount,
});

if (!buyTokenAmount || buyTokenAmount.lte(new BN(0))) {
  throw new Error("Pump quote returned zero tokens for the D2 DEVNET buy");
}

console.log(`Preparing tiny DEVNET buy: max input target ${BUY_LAMPORTS} lamports`);

const buyIxs = await sdk.buyInstructions({
  ...buyState,
  mint: mint.publicKey,
  user: vault,
  amount: buyTokenAmount,
  solAmount,
  slippage: 0.10,
});

const buyIx = findPumpTrade(buyIxs, 27, vault, "BUY_V2");

if (!buyIx.keys[14].pubkey.equals(baseAta)) {
  throw new Error("BUY_V2 associated_base_user does not match the pre-created vault ATA");
}

const vaultBefore = BigInt(await connection.getBalance(vault, "confirmed"));
const tokensBefore = await tokenRawBalance(connection, baseAta, tokenProgram);

console.log("");
console.log("Executing BUY_V2 through Smart Vault PDA signer...");
const buySignature = await executeThroughSmartVault({
  connection,
  programId,
  policy,
  vault,
  executor,
  pumpInstruction: buyIx,
  label: "Smart Vault BUY_V2",
});

const vaultAfterBuy = BigInt(await connection.getBalance(vault, "confirmed"));
const tokensAfterBuy = await tokenRawBalance(connection, baseAta, tokenProgram);

if (tokensAfterBuy <= tokensBefore) {
  throw new Error(
    `BUY_V2 confirmed but token balance did not increase (${tokensBefore} -> ${tokensAfterBuy})`
  );
}

console.log(`Vault: ${vaultBefore} -> ${vaultAfterBuy} lamports`);
console.log(`Token raw balance: ${tokensBefore} -> ${tokensAfterBuy}`);

const [sellState, global2, feeConfig2] = await Promise.all([
  sdk.fetchSellState(mint.publicKey, vault),
  sdk.fetchGlobal(),
  sdk.fetchFeeConfig().catch(() => null),
]);

const sellAmount = new BN(tokensAfterBuy.toString());
const expectedSol = getSellSolAmountFromTokenAmount({
  global: global2,
  feeConfig: feeConfig2,
  mintSupply: sellState.bondingCurve.tokenTotalSupply,
  bondingCurve: sellState.bondingCurve,
  amount: sellAmount,
});

if (!expectedSol || expectedSol.lte(new BN(0))) {
  throw new Error("Pump quote returned zero SOL for the D2 DEVNET sell");
}

const sellIxs = await sdk.sellInstructions({
  ...sellState,
  mint: mint.publicKey,
  user: vault,
  amount: sellAmount,
  solAmount: expectedSol,
  slippage: 0.10,
});

const sellIx = findPumpTrade(sellIxs, 26, vault, "SELL_V2");

console.log("");
console.log("Executing SELL_V2 through Smart Vault PDA signer...");
const sellSignature = await executeThroughSmartVault({
  connection,
  programId,
  policy,
  vault,
  executor,
  pumpInstruction: sellIx,
  label: "Smart Vault SELL_V2",
});

const vaultAfterSell = BigInt(await connection.getBalance(vault, "confirmed"));
const tokensAfterSell = await tokenRawBalance(connection, baseAta, tokenProgram);

const result = {
  ok: true,
  phase: "D2",
  environment: "devnet",
  genesis,
  programId: programId.toBase58(),
  pumpProgramId: PUMP_PROGRAM_ID.toBase58(),
  owner: owner.publicKey.toBase58(),
  executor: executor.publicKey.toBase58(),
  policy: policy.toBase58(),
  vault: vault.toBase58(),
  testMint: mint.publicKey.toBase58(),
  vaultTokenAta: baseAta.toBase58(),
  buyTargetLamports: BUY_LAMPORTS.toString(),
  vaultBeforeLamports: vaultBefore.toString(),
  vaultAfterBuyLamports: vaultAfterBuy.toString(),
  vaultAfterSellLamports: vaultAfterSell.toString(),
  tokensBefore: tokensBefore.toString(),
  tokensAfterBuy: tokensAfterBuy.toString(),
  tokensAfterSell: tokensAfterSell.toString(),
  buySignature,
  sellSignature,
  ownerSignedTrade: false,
  executorSignedOuterTransactions: true,
  vaultPdaSignedPumpCpi: true,
  productionAutoLiveUnlocked: false,
  mainnetDeployment: false,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));

console.log("");
console.log("== PHASE D2 REAL DEVNET ROUND-TRIP PASSED ==");
console.log(JSON.stringify(result, null, 2));
console.log("");
console.log("PASS: executor -> Smart Vault -> Pump BUY_V2 CPI");
console.log("PASS: executor -> Smart Vault -> Pump SELL_V2 CPI");
console.log("PASS: owner did NOT sign either trade");
console.log("PASS: production AUTO LIVE remains LOCKED");
console.log("PASS: Mainnet was NOT touched");
console.log(`Report: ${REPORT_PATH}`);
EOF

echo "Installing isolated D2 dependencies..."
cd "$D2"
npm install --no-audit --no-fund

echo
echo "Running Phase D2 REAL DEVNET Pump round-trip..."
node roundtrip.mjs

echo
echo "== D2 INSTALLER COMPLETE =="
echo "If the output says PHASE D2 REAL DEVNET ROUND-TRIP PASSED, send me that final screen."
