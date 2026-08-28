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
