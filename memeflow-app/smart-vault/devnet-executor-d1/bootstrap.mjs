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
