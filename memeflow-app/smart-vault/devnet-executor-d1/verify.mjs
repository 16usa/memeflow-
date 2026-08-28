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
