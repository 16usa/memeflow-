#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
D1="$ROOT/devnet-executor-d1"
IDL="$ROOT/target/idl/memeflow_smart_vault.json"
DEPLOY="$ROOT/DEVNET_DEPLOYMENT.json"
PAYER="$ROOT/.toolchain/home/.config/solana/id.json"

echo "== MEMEFLOW Smart Vault — Phase D1 / DEVNET Executor =="
echo "DEVNET ONLY. This patch does not touch production AUTO LIVE or Mainnet."

for f in "$IDL" "$DEPLOY" "$PAYER"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

mkdir -p "$D1/.state"
chmod 700 "$D1/.state"

cat > "$D1/.gitignore" <<'EOF'
.state/
node_modules/
EOF

cat > "$D1/package.json" <<'EOF'
{
  "name": "memeflow-smart-vault-devnet-executor-d1",
  "private": true,
  "type": "module",
  "scripts": {
    "bootstrap": "node bootstrap.mjs",
    "verify": "node verify.mjs"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.0",
    "@solana/web3.js": "^1.98.0",
    "bn.js": "^5.2.2"
  }
}
EOF

cat > "$D1/lib.mjs" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const STATE = path.join(HERE, ".state");
export const IDL_PATH = path.join(ROOT, "target", "idl", "memeflow_smart_vault.json");
export const DEPLOY_PATH = path.join(ROOT, "DEVNET_DEPLOYMENT.json");
export const OWNER_PATH = path.join(ROOT, ".toolchain", "home", ".config", "solana", "id.json");

export const DEVNET_RPC = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USER_INDEX = 13;

export const MAX_BUY_DEBIT = BigInt(process.env.D1_MAX_BUY_LAMPORTS || "25000000");       // 0.025 devnet SOL
export const DAILY_DEBIT_LIMIT = BigInt(process.env.D1_DAILY_LIMIT_LAMPORTS || "100000000"); // 0.10 devnet SOL
export const MAX_EXIT_OVERHEAD = BigInt(process.env.D1_MAX_EXIT_OVERHEAD_LAMPORTS || "5000000"); // 0.005
export const TARGET_VAULT_BALANCE = BigInt(process.env.D1_VAULT_TARGET_LAMPORTS || "50000000"); // 0.05

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function loadKeypair(p) {
  const raw = readJson(p);
  if (!Array.isArray(raw)) throw new Error(`Keypair file is not an array: ${p}`);
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadOrCreateExecutor() {
  fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
  const p = path.join(STATE, "executor.json");

  if (fs.existsSync(p)) return loadKeypair(p);

  const kp = Keypair.generate();
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  try { fs.chmodSync(p, 0o600); } catch {}
  return kp;
}

export async function devnetConnection() {
  const connection = new Connection(DEVNET_RPC, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });

  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error(
      `HARD STOP: RPC is not Solana Devnet. genesis=${genesis}. Mainnet execution is forbidden in Phase D1.`
    );
  }
  return connection;
}

export function programIdFromDeployment() {
  const dep = readJson(DEPLOY_PATH);
  const value = dep.programId || dep.program_id;
  if (!value) throw new Error("DEVNET_DEPLOYMENT.json has no programId");
  return new PublicKey(value);
}

export function deriveAddresses(programId, owner) {
  const [policy] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.toBuffer()],
    programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    programId
  );
  return { policy, vault };
}

export function makeProgram(connection, payer, programId) {
  const idl = readJson(IDL_PATH);
  idl.address = programId.toBase58();
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return {
    provider,
    program: new anchor.Program(idl, provider),
  };
}

export function bn(v) {
  return new BN(v.toString());
}

export function publicState({ programId, owner, executor, policy, vault, vaultBalance, genesis }) {
  return {
    phase: "D1",
    environment: "devnet",
    genesis,
    rpc: DEVNET_RPC,
    programId: programId.toBase58(),
    owner: owner.toBase58(),
    executor: executor.toBase58(),
    policy: policy.toBase58(),
    vault: vault.toBase58(),
    vaultBalanceLamports: String(vaultBalance),
    productionAutoLiveUnlocked: false,
    mainnetDeployment: false
  };
}
EOF

cat > "$D1/bootstrap.mjs" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { SystemProgram } from "@solana/web3.js";
import {
  STATE,
  OWNER_PATH,
  MAX_BUY_DEBIT,
  DAILY_DEBIT_LIMIT,
  MAX_EXIT_OVERHEAD,
  TARGET_VAULT_BALANCE,
  bn,
  devnetConnection,
  deriveAddresses,
  loadKeypair,
  loadOrCreateExecutor,
  makeProgram,
  programIdFromDeployment,
  publicState,
} from "./lib.mjs";

const connection = await devnetConnection();
const genesis = await connection.getGenesisHash();
const programId = programIdFromDeployment();
const owner = loadKeypair(OWNER_PATH);
const executor = loadOrCreateExecutor();
const { policy, vault } = deriveAddresses(programId, owner.publicKey);

console.log("DEVNET gate: OK");
console.log("Program:", programId.toBase58());
console.log("Owner:", owner.publicKey.toBase58());
console.log("Executor:", executor.publicKey.toBase58());
console.log("Policy PDA:", policy.toBase58());
console.log("Vault PDA:", vault.toBase58());

const { program } = makeProgram(connection, owner, programId);

for (const method of ["initializePolicy", "updatePolicy", "deposit", "setEntriesPaused", "executePumpV2"]) {
  if (typeof program.methods?.[method] !== "function") {
    throw new Error(`IDL method missing: ${method}`);
  }
}

const policyInfo = await connection.getAccountInfo(policy, "confirmed");

if (!policyInfo) {
  console.log("Creating DEVNET policy...");
  const sig = await program.methods
    .initializePolicy(
      executor.publicKey,
      bn(MAX_BUY_DEBIT),
      bn(DAILY_DEBIT_LIMIT),
      bn(MAX_EXIT_OVERHEAD)
    )
    .accounts({
      owner: owner.publicKey,
      policy,
      systemProgram: SystemProgram.programId,
    })
    .signers([owner])
    .rpc();
  console.log("initialize_policy:", sig);
} else {
  console.log("Policy exists; refreshing executor + limits...");
  const sig = await program.methods
    .updatePolicy(
      executor.publicKey,
      bn(MAX_BUY_DEBIT),
      bn(DAILY_DEBIT_LIMIT),
      bn(MAX_EXIT_OVERHEAD)
    )
    .accounts({
      owner: owner.publicKey,
      policy,
    })
    .signers([owner])
    .rpc();
  console.log("update_policy:", sig);
}

console.log("Ensuring entries are enabled...");
const unpauseSig = await program.methods
  .setEntriesPaused(false)
  .accounts({
    owner: owner.publicKey,
    policy,
  })
  .signers([owner])
  .rpc();
console.log("set_entries_paused(false):", unpauseSig);

let balance = BigInt(await connection.getBalance(vault, "confirmed"));
if (balance < TARGET_VAULT_BALANCE) {
  const delta = TARGET_VAULT_BALANCE - balance;
  console.log(`Funding DEVNET vault by ${delta} lamports...`);
  const sig = await program.methods
    .deposit(bn(delta))
    .accounts({
      owner: owner.publicKey,
      policy,
      vault,
      systemProgram: SystemProgram.programId,
    })
    .signers([owner])
    .rpc();
  console.log("deposit:", sig);
  balance = BigInt(await connection.getBalance(vault, "confirmed"));
} else {
  console.log("Vault already meets D1 target; no deposit needed.");
}

const state = publicState({
  programId,
  owner: owner.publicKey,
  executor: executor.publicKey,
  policy,
  vault,
  vaultBalance: balance,
  genesis,
});

fs.writeFileSync(
  path.join(STATE, "d1-public-state.json"),
  JSON.stringify(state, null, 2)
);

console.log("");
console.log("== PHASE D1 BOOTSTRAP PASSED ==");
console.log(JSON.stringify(state, null, 2));
console.log("");
console.log("No Mainnet deployment occurred.");
console.log("Production AUTO LIVE remains locked.");
console.log("Executor private key was NOT printed.");
EOF

cat > "$D1/executor-adapter.mjs" <<'EOF'
import {
  PUMP_PROGRAM_ID,
  USER_INDEX,
  OWNER_PATH,
  devnetConnection,
  deriveAddresses,
  loadKeypair,
  loadOrCreateExecutor,
  makeProgram,
  programIdFromDeployment,
} from "./lib.mjs";

/**
 * DEVNET-only Smart Vault executor.
 *
 * Pass a CURRENT official Pump buy_v2/sell_v2 TransactionInstruction that was
 * built with `user = vault PDA`. The outer transaction is paid and signed by
 * the server executor; the Smart Vault program re-marks only the vault PDA as
 * the Pump CPI signer via invoke_signed().
 */
export async function executePumpV2Devnet(pumpInstruction) {
  const connection = await devnetConnection();
  const programId = programIdFromDeployment();

  if (!pumpInstruction || !pumpInstruction.programId || !pumpInstruction.data || !pumpInstruction.keys) {
    throw new Error("Invalid Pump TransactionInstruction");
  }
  if (!pumpInstruction.programId.equals(PUMP_PROGRAM_ID)) {
    throw new Error("Rejected: instruction is not the official Pump program");
  }
  if (pumpInstruction.data.length !== 24) {
    throw new Error(`Rejected: Pump v2 instruction data must be 24 bytes, got ${pumpInstruction.data.length}`);
  }
  if (pumpInstruction.keys.length <= USER_INDEX) {
    throw new Error("Rejected: Pump account list is too short");
  }

  const owner = loadKeypair(OWNER_PATH);
  const executor = loadOrCreateExecutor();
  const { policy, vault } = deriveAddresses(programId, owner.publicKey);

  if (!pumpInstruction.keys[USER_INDEX].pubkey.equals(vault)) {
    throw new Error(
      `Rejected: Pump user account at zero-based index ${USER_INDEX} must be Smart Vault ${vault.toBase58()}`
    );
  }

  // Important: the vault is NOT a transaction-level signer. The Smart Vault
  // program turns it into the sole Pump CPI signer with PDA seeds.
  const remainingAccounts = pumpInstruction.keys.map((k) => ({
    pubkey: k.pubkey,
    isWritable: Boolean(k.isWritable),
    isSigner: false,
  }));

  // In AUTO LIVE the server executor, not the owner, is the transaction payer.
  const { program } = makeProgram(connection, executor, programId);

  const signature = await program.methods
    .executePumpV2(Array.from(pumpInstruction.data))
    .accounts({
      policy,
      vault,
      executor: executor.publicKey,
    })
    .remainingAccounts(remainingAccounts)
    .signers([executor])
    .rpc();

  return {
    signature,
    programId: programId.toBase58(),
    policy: policy.toBase58(),
    vault: vault.toBase58(),
    executor: executor.publicKey.toBase58(),
  };
}
EOF

cat > "$D1/verify.mjs" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import {
  STATE,
  OWNER_PATH,
  devnetConnection,
  deriveAddresses,
  loadKeypair,
  loadOrCreateExecutor,
  programIdFromDeployment,
} from "./lib.mjs";

const connection = await devnetConnection();
const programId = programIdFromDeployment();
const owner = loadKeypair(OWNER_PATH);
const executor = loadOrCreateExecutor();
const { policy, vault } = deriveAddresses(programId, owner.publicKey);

const [programInfo, policyInfo, vaultInfo] = await Promise.all([
  connection.getAccountInfo(programId, "confirmed"),
  connection.getAccountInfo(policy, "confirmed"),
  connection.getAccountInfo(vault, "confirmed"),
]);

if (!programInfo?.executable) throw new Error("Smart Vault DEVNET program is not executable");
if (!policyInfo) throw new Error("Policy PDA is missing");
if (!vaultInfo) throw new Error("Vault PDA is missing");

const result = {
  ok: true,
  environment: "devnet",
  programExecutable: true,
  programId: programId.toBase58(),
  owner: owner.publicKey.toBase58(),
  executor: executor.publicKey.toBase58(),
  policy: policy.toBase58(),
  vault: vault.toBase58(),
  vaultOwnerProgram: vaultInfo.owner.toBase58(),
  vaultLamports: String(vaultInfo.lamports),
  productionAutoLiveUnlocked: false,
  mainnetDeployment: false,
};

fs.writeFileSync(path.join(STATE, "d1-verify.json"), JSON.stringify(result, null, 2));
console.log("== PHASE D1 VERIFY PASSED ==");
console.log(JSON.stringify(result, null, 2));
EOF

echo "Installing isolated D1 Node dependencies..."
cd "$D1"
npm install --no-audit --no-fund

echo
echo "Running DEVNET bootstrap..."
node bootstrap.mjs

echo
echo "Running DEVNET verification..."
node verify.mjs

echo
echo "== D1 INSTALLER COMPLETE =="
echo "Created: $D1"
echo "Mainnet untouched. Production AUTO LIVE unchanged."
