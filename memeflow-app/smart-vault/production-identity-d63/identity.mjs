import { Connection, Keypair } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const MAINNET_GENESIS =
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

const RPC_ENV =
  "MEMEFLOW_SMART_VAULT_MAINNET_RPC";

const SIGNER_ENV =
  "MEMEFLOW_SMART_VAULT_EXECUTOR_KEYPAIR_JSON";

const PROGRAM_ENV =
  "MEMEFLOW_SMART_VAULT_MAINNET_PROGRAM_ID";

const EXECUTE_GATE =
  "MEMEFLOW_SMART_VAULT_MAINNET_EXECUTE";

const AUTO_LIVE_GATE =
  "MEMEFLOW_SMART_VAULT_AUTO_LIVE_UNLOCK";

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

const report = {
  ok: false,
  phase: "D6.3",
  mode: "mainnet-executor-identity-freeze-read-only",

  transactionCreated: false,
  transactionSigned: false,
  transactionSent: false,
  deploymentPerformed: false,

  productionExecutionLocked: true,
  autoLiveLocked: true,
  anchorProviderStillDevnet: false,

  rpcConfigured: false,
  mainnetGenesisVerified: false,

  executorConfigured: false,
  executorValid: false,
  executorPublicKey: null,
  executorFingerprint: null,
  executorBalanceLamports: null,

  mainnetProgramConfigured: configured(PROGRAM_ENV),

  readyForD64ProgramPreparation: false,

  errors: [],
  warnings: []
};

report.productionExecutionLocked =
  !enabled(process.env[EXECUTE_GATE]);

report.autoLiveLocked =
  !enabled(process.env[AUTO_LIVE_GATE]);

if (!report.productionExecutionLocked) {
  report.errors.push(
    `${EXECUTE_GATE} must remain OFF during D6.3`
  );
}

if (!report.autoLiveLocked) {
  report.errors.push(
    `${AUTO_LIVE_GATE} must remain OFF during D6.3`
  );
}

/* ---------------------------------------------------------
   VERIFY ANCHOR STILL DEVNET
   --------------------------------------------------------- */

try {
  const anchor = await readFile(
    new URL("../Anchor.toml", import.meta.url),
    "utf8"
  );

  report.anchorProviderStillDevnet =
    /\[provider\][\s\S]*?cluster\s*=\s*"devnet"/m.test(anchor);

  if (!report.anchorProviderStillDevnet) {
    report.errors.push(
      "Anchor provider is not explicitly Devnet."
    );
  }
} catch (e) {
  report.errors.push(
    `Unable to verify Anchor.toml: ${e.message}`
  );
}

/* ---------------------------------------------------------
   MAINNET RPC — READ ONLY
   --------------------------------------------------------- */

let connection = null;

if (!configured(RPC_ENV)) {
  report.errors.push(
    `${RPC_ENV} is not configured`
  );
} else {
  report.rpcConfigured = true;

  try {
    const rpc = process.env[RPC_ENV].trim();
    const parsed = new URL(rpc);

    if (parsed.protocol !== "https:") {
      throw new Error("Mainnet RPC must use HTTPS");
    }

    connection = new Connection(rpc, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 15000
    });

    const genesis = await timeout(
      connection.getGenesisHash(),
      15000,
      "Mainnet genesis verification"
    );

    report.mainnetGenesisVerified =
      genesis === MAINNET_GENESIS;

    if (!report.mainnetGenesisVerified) {
      report.errors.push(
        "RPC does not report Solana Mainnet genesis"
      );
    }
  } catch (e) {
    report.errors.push(
      `Mainnet RPC verification failed: ${e.message}`
    );
  }
}

/* ---------------------------------------------------------
   EXECUTOR IDENTITY
   Secret is NEVER printed or written to report.
   --------------------------------------------------------- */

if (!configured(SIGNER_ENV)) {
  report.errors.push(
    `${SIGNER_ENV} is not configured`
  );
} else {
  report.executorConfigured = true;

  let raw = null;
  let secretBytes = null;

  try {
    raw = JSON.parse(process.env[SIGNER_ENV]);

    if (
      !Array.isArray(raw) ||
      raw.length !== 64 ||
      raw.some(
        x =>
          !Number.isInteger(x) ||
          x < 0 ||
          x > 255
      )
    ) {
      throw new Error(
        "Executor keypair must contain exactly 64 bytes"
      );
    }

    secretBytes = Uint8Array.from(raw);

    const signer =
      Keypair.fromSecretKey(secretBytes);

    report.executorValid = true;

    const publicKey =
      signer.publicKey.toBase58();

    report.executorPublicKey = publicKey;

    report.executorFingerprint =
      createHash("sha256")
        .update(publicKey)
        .digest("hex")
        .slice(0, 16);

    if (
      connection &&
      report.mainnetGenesisVerified
    ) {
      report.executorBalanceLamports =
        await timeout(
          connection.getBalance(
            signer.publicKey,
            "confirmed"
          ),
          15000,
          "Executor Mainnet balance"
        );

      if (report.executorBalanceLamports === 0) {
        report.warnings.push(
          "Executor has 0 Mainnet SOL. This is OK for D6.3 because no transaction will be sent."
        );
      }
    }

  } catch (e) {
    report.errors.push(
      `Executor identity validation failed: ${e.message}`
    );
  } finally {
    secretBytes?.fill(0);
    raw?.fill?.(0);
  }
}

/* ---------------------------------------------------------
   FINAL D6.3 READINESS
   --------------------------------------------------------- */

report.readyForD64ProgramPreparation =
  report.rpcConfigured &&
  report.mainnetGenesisVerified &&
  report.executorConfigured &&
  report.executorValid &&
  report.productionExecutionLocked &&
  report.autoLiveLocked &&
  report.anchorProviderStillDevnet &&
  report.errors.length === 0;

report.ok =
  report.readyForD64ProgramPreparation;

await writeFile(
  "/tmp/memeflow-d63-identity.json",
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("");
console.log("====================================================");
console.log(" MEMEFLOW SMART VAULT — D6.3");
console.log(" MAINNET EXECUTOR IDENTITY / READ-ONLY");
console.log("====================================================");
console.log("");

console.log(
  "Mainnet genesis:",
  report.mainnetGenesisVerified ? "PASS" : "FAIL"
);

console.log(
  "Executor configured:",
  report.executorConfigured ? "YES" : "NO"
);

console.log(
  "Executor valid:",
  report.executorValid ? "YES" : "NO"
);

if (report.executorPublicKey) {
  console.log(
    "Executor PUBLIC KEY:",
    report.executorPublicKey
  );

  console.log(
    "Executor fingerprint:",
    report.executorFingerprint
  );
}

if (report.executorBalanceLamports !== null) {
  console.log(
    "Executor Mainnet balance:",
    report.executorBalanceLamports,
    "lamports"
  );
}

console.log(
  "Mainnet Smart Vault program:",
  report.mainnetProgramConfigured
    ? "CONFIGURED"
    : "INTENTIONALLY NOT CONFIGURED YET"
);

console.log(
  "Production execution:",
  report.productionExecutionLocked
    ? "LOCKED"
    : "UNSAFE"
);

console.log(
  "AUTO LIVE:",
  report.autoLiveLocked
    ? "LOCKED"
    : "UNSAFE"
);

console.log(
  "Anchor provider:",
  report.anchorProviderStillDevnet
    ? "DEVNET"
    : "FAIL"
);

if (report.errors.length) {
  console.log("");
  console.log("ERRORS:");
  for (const error of report.errors) {
    console.log(" -", error);
  }
}

if (report.warnings.length) {
  console.log("");
  console.log("WARNINGS:");
  for (const warning of report.warnings) {
    console.log(" -", warning);
  }
}

console.log("");
console.log(
  "READY FOR D6.4 PROGRAM PREPARATION:",
  report.readyForD64ProgramPreparation
    ? "YES"
    : "NO"
);

console.log("");
console.log("NO TRANSACTION WAS CREATED");
console.log("NO TRANSACTION WAS SIGNED");
console.log("NO TRANSACTION WAS SENT");
console.log("NO MAINNET DEPLOYMENT WAS PERFORMED");
console.log("");
console.log(
  "Report: /tmp/memeflow-d63-identity.json"
);
console.log("====================================================");
