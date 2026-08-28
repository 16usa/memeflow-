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
