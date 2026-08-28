import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFile, writeFile } from "node:fs/promises";

const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const DEVNET_SMART_VAULT_PROGRAM =
  "47tctW8xjfXo3FXZass23k3oaQ8G2AkTUnGCJtzVEpYV";

const RPC_ENV = "MEMEFLOW_SMART_VAULT_MAINNET_RPC";
const PROGRAM_ENV = "MEMEFLOW_SMART_VAULT_MAINNET_PROGRAM_ID";
const SIGNER_ENV = "MEMEFLOW_SMART_VAULT_EXECUTOR_KEYPAIR_JSON";

const EXECUTE_GATE = "MEMEFLOW_SMART_VAULT_MAINNET_EXECUTE";
const AUTO_LIVE_GATE = "MEMEFLOW_SMART_VAULT_AUTO_LIVE_UNLOCK";

const report = {
  ok: true,
  phase: "D6.1",
  mode: "production-signer-mainnet-read-only-preflight",

  transactionSent: false,
  transactionSigned: false,
  deploymentPerformed: false,

  rpcConfigured: false,
  rpcHttps: false,
  mainnetGenesisVerified: false,

  mainnetProgramConfigured: false,
  mainnetProgramIdValid: false,
  mainnetProgramDistinctFromDevnet: false,
  mainnetProgramAccountExists: false,
  mainnetProgramExecutable: false,

  executorSignerConfigured: false,
  executorSignerValid: false,
  executorSignerFingerprint: null,
  executorHasFeeBalance: false,

  productionExecutionLocked: true,
  autoLiveLocked: true,
  anchorProviderStillDevnet: false,

  readyForMainnetDeployPreparation: false,
  readyForMainnetExecution: false,

  errors: [],
  warnings: []
};

const enabled = value =>
  /^(1|true|yes|on)$/i.test(String(value ?? "").trim());

const configured = name =>
  typeof process.env[name] === "string" &&
  process.env[name].trim().length > 0;

const timeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      )
    )
  ]);

report.productionExecutionLocked = !enabled(process.env[EXECUTE_GATE]);
report.autoLiveLocked = !enabled(process.env[AUTO_LIVE_GATE]);

if (!report.productionExecutionLocked) {
  report.errors.push(
    `${EXECUTE_GATE} is ENABLED. D6.1 requires production execution OFF.`
  );
}

if (!report.autoLiveLocked) {
  report.errors.push(
    `${AUTO_LIVE_GATE} is ENABLED. D6.1 requires AUTO LIVE LOCKED.`
  );
}

try {
  const anchor = await readFile(
    new URL("../Anchor.toml", import.meta.url),
    "utf8"
  );

  report.anchorProviderStillDevnet =
    /\[provider\][\s\S]*?cluster\s*=\s*"devnet"/m.test(anchor);

  if (!report.anchorProviderStillDevnet) {
    report.errors.push(
      "Anchor provider is no longer explicitly Devnet. Stop before Mainnet work."
    );
  }
} catch (error) {
  report.errors.push(`Cannot verify Anchor.toml: ${error.message}`);
}

let connection = null;

/* -----------------------------------------------------------
   MAINNET RPC — READ ONLY
   ----------------------------------------------------------- */

if (configured(RPC_ENV)) {
  report.rpcConfigured = true;

  try {
    const rpc = process.env[RPC_ENV].trim();
    const parsed = new URL(rpc);

    report.rpcHttps = parsed.protocol === "https:";

    if (!report.rpcHttps) {
      report.errors.push(
        `${RPC_ENV} must use HTTPS.`
      );
    } else {
      connection = new Connection(rpc, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 15000
      });

      const genesis = await timeout(
        connection.getGenesisHash(),
        15000,
        "Mainnet genesis check"
      );

      report.mainnetGenesisVerified =
        genesis === MAINNET_GENESIS;

      if (!report.mainnetGenesisVerified) {
        report.errors.push(
          "Configured MAINNET RPC does not report Solana Mainnet genesis."
        );
      }
    }
  } catch (error) {
    report.errors.push(
      `Mainnet RPC preflight failed: ${error.message}`
    );
  }
} else {
  report.warnings.push(
    `${RPC_ENV} is not configured yet.`
  );
}

/* -----------------------------------------------------------
   MAINNET SMART VAULT PROGRAM — READ ONLY
   ----------------------------------------------------------- */

if (configured(PROGRAM_ENV)) {
  report.mainnetProgramConfigured = true;

  try {
    const programId = new PublicKey(
      process.env[PROGRAM_ENV].trim()
    );

    report.mainnetProgramIdValid = true;
    report.mainnetProgramDistinctFromDevnet =
      programId.toBase58() !== DEVNET_SMART_VAULT_PROGRAM;

    if (!report.mainnetProgramDistinctFromDevnet) {
      report.errors.push(
        "Mainnet Smart Vault program ID equals the DEVNET-only program ID."
      );
    }

    if (connection && report.mainnetGenesisVerified) {
      const info = await timeout(
        connection.getAccountInfo(programId, "confirmed"),
        15000,
        "Mainnet program account check"
      );

      report.mainnetProgramAccountExists = Boolean(info);
      report.mainnetProgramExecutable =
        Boolean(info?.executable);

      if (!info) {
        report.warnings.push(
          "Mainnet Smart Vault program account does not exist yet. This is expected before Mainnet deployment."
        );
      } else if (!info.executable) {
        report.errors.push(
          "Configured Mainnet Smart Vault account exists but is not executable."
        );
      }
    }
  } catch (error) {
    report.errors.push(
      `Invalid ${PROGRAM_ENV}: ${error.message}`
    );
  }
} else {
  report.warnings.push(
    `${PROGRAM_ENV} is not configured yet.`
  );
}

/* -----------------------------------------------------------
   SERVER EXECUTOR SIGNER
   Secret is parsed in memory and NEVER printed.
   No transaction is created or signed.
   ----------------------------------------------------------- */

if (configured(SIGNER_ENV)) {
  report.executorSignerConfigured = true;

  try {
    const raw = JSON.parse(process.env[SIGNER_ENV]);

    if (
      !Array.isArray(raw) ||
      raw.length !== 64 ||
      raw.some(
        n =>
          !Number.isInteger(n) ||
          n < 0 ||
          n > 255
      )
    ) {
      throw new Error(
        "executor keypair must be a JSON array containing exactly 64 bytes"
      );
    }

    const secretBytes = Uint8Array.from(raw);

    const signer = Keypair.fromSecretKey(secretBytes);

    report.executorSignerValid = true;

    const pub = signer.publicKey.toBase58();
    report.executorSignerFingerprint =
      `${pub.slice(0, 4)}...${pub.slice(-4)}`;

    if (
      connection &&
      report.mainnetGenesisVerified
    ) {
      const balance = await timeout(
        connection.getBalance(
          signer.publicKey,
          "confirmed"
        ),
        15000,
        "Executor fee balance check"
      );

      report.executorHasFeeBalance =
        balance > 0;

      if (!report.executorHasFeeBalance) {
        report.warnings.push(
          "Executor signer is valid but currently has no Mainnet SOL for transaction fees."
        );
      }
    }

    secretBytes.fill(0);
    raw.fill?.(0);

  } catch (error) {
    report.errors.push(
      `Executor signer validation failed: ${error.message}`
    );
  }
} else {
  report.warnings.push(
    `${SIGNER_ENV} is not configured yet.`
  );
}

/* -----------------------------------------------------------
   READINESS
   ----------------------------------------------------------- */

report.readyForMainnetDeployPreparation =
  report.rpcConfigured &&
  report.rpcHttps &&
  report.mainnetGenesisVerified &&
  report.mainnetProgramConfigured &&
  report.mainnetProgramIdValid &&
  report.mainnetProgramDistinctFromDevnet &&
  report.executorSignerConfigured &&
  report.executorSignerValid &&
  report.productionExecutionLocked &&
  report.autoLiveLocked &&
  report.anchorProviderStillDevnet &&
  report.errors.length === 0;

report.readyForMainnetExecution =
  report.readyForMainnetDeployPreparation &&
  report.mainnetProgramAccountExists &&
  report.mainnetProgramExecutable &&
  report.executorHasFeeBalance &&
  false; // deliberately impossible in D6.1

report.ok = report.errors.length === 0;

await writeFile(
  "/tmp/memeflow-d61-preflight.json",
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("");
console.log("====================================================");
console.log(" MEMEFLOW SMART VAULT — D6.1");
console.log(" PRODUCTION SIGNER / MAINNET READ-ONLY PREFLIGHT");
console.log("====================================================");
console.log("");

console.log(
  "RPC configured:",
  report.rpcConfigured ? "YES" : "NO"
);
console.log(
  "Mainnet genesis:",
  report.mainnetGenesisVerified ? "PASS" : "NOT VERIFIED"
);
console.log(
  "Mainnet program configured:",
  report.mainnetProgramConfigured ? "YES" : "NO"
);
console.log(
  "Program executable:",
  report.mainnetProgramExecutable ? "YES" : "NO / NOT DEPLOYED"
);
console.log(
  "Executor signer configured:",
  report.executorSignerConfigured ? "YES" : "NO"
);
console.log(
  "Executor signer valid:",
  report.executorSignerValid ? "YES" : "NO"
);

if (report.executorSignerFingerprint) {
  console.log(
    "Executor fingerprint:",
    report.executorSignerFingerprint
  );
}

console.log(
  "Production execution:",
  report.productionExecutionLocked
    ? "LOCKED"
    : "UNSAFE / ENABLED"
);
console.log(
  "AUTO LIVE:",
  report.autoLiveLocked
    ? "LOCKED"
    : "UNSAFE / ENABLED"
);
console.log(
  "Anchor provider:",
  report.anchorProviderStillDevnet
    ? "DEVNET"
    : "CHECK REQUIRED"
);

console.log("");

if (report.errors.length) {
  console.log("ERRORS:");
  for (const x of report.errors) {
    console.log(" -", x);
  }
}

if (report.warnings.length) {
  console.log("WARNINGS:");
  for (const x of report.warnings) {
    console.log(" -", x);
  }
}

console.log("");
console.log(
  "READY FOR MAINNET DEPLOY PREPARATION:",
  report.readyForMainnetDeployPreparation
    ? "YES"
    : "NO"
);

console.log(
  "READY FOR MAINNET EXECUTION: NO — HARD LOCKED BY D6.1"
);

console.log("");
console.log("NO TRANSACTION WAS CREATED");
console.log("NO TRANSACTION WAS SIGNED");
console.log("NO TRANSACTION WAS SENT");
console.log("NO MAINNET DEPLOYMENT WAS PERFORMED");
console.log("");
console.log(
  "Report: /tmp/memeflow-d61-preflight.json"
);
console.log("====================================================");
