import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const D2_DIR = path.join(ROOT, "devnet-executor-d2");
const D2_ENTRY = path.join(D2_DIR, "roundtrip.mjs");
const D2_REPORT = path.join(
  D2_DIR,
  ".state",
  "d2-roundtrip-report.json"
);

const DEVNET_GENESIS =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

const PUMP_PROGRAM =
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const DEVNET_RPC =
  process.env.DEVNET_RPC_URL ||
  "https://api.devnet.solana.com";

const BUY_LAMPORTS = BigInt(
  process.env.D3_BUY_LAMPORTS || "1000000"
);

if (BUY_LAMPORTS <= 0n || BUY_LAMPORTS > 2000000n) {
  throw new Error(
    "HARD STOP: D3 buy must be <= 0.002 DEVNET SOL"
  );
}

function reply(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > 16384) {
      throw new Error("Request too large");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(
    Buffer.concat(chunks).toString("utf8")
  );
}

function verify(report) {
  const errors = [];

  if (report?.ok !== true)
    errors.push("D2 report is not OK");

  if (report?.environment !== "devnet")
    errors.push("environment is not devnet");

  if (report?.genesis !== DEVNET_GENESIS)
    errors.push("wrong genesis");

  if (report?.pumpProgramId !== PUMP_PROGRAM)
    errors.push("wrong Pump program");

  if (report?.ownerSignedTrade !== false)
    errors.push("owner signed trade");

  if (report?.executorSignedOuterTransactions !== true)
    errors.push("executor did not sign outer transaction");

  if (report?.vaultPdaSignedPumpCpi !== true)
    errors.push("Vault PDA did not sign Pump CPI");

  if (report?.productionAutoLiveUnlocked !== false)
    errors.push("AUTO LIVE unexpectedly unlocked");

  if (report?.mainnetDeployment !== false)
    errors.push("Mainnet deployment flag changed");

  if (
    String(report?.tokensBefore) !==
    String(report?.tokensAfterSell)
  ) {
    errors.push(
      "token balance was not restored after SELL"
    );
  }

  if (!report?.buySignature)
    errors.push("BUY signature missing");

  if (!report?.sellSignature)
    errors.push("SELL signature missing");

  if (errors.length) {
    throw new Error(
      "D3 VERIFICATION FAILED: " +
      errors.join("; ")
    );
  }

  return report;
}

let running = false;

async function executeDevnetRoundTrip() {
  if (running) {
    throw new Error("D3 executor already busy");
  }

  running = true;

  try {
    console.log("");
    console.log("D3 server accepted DEVNET execution request.");
    console.log(
      "Path: server -> executor -> Smart Vault -> Pump V2"
    );
    console.log("");

    let result;

    try {
      result = await execFileAsync(
        process.execPath,
        [D2_ENTRY],
        {
          cwd: D2_DIR,
          env: {
            ...process.env,
            DEVNET_RPC_URL: DEVNET_RPC,
            D2_BUY_LAMPORTS:
              BUY_LAMPORTS.toString(),
          },
          timeout: 180000,
          maxBuffer: 8 * 1024 * 1024,
        }
      );
    } catch (error) {
      if (error.stdout)
        process.stdout.write(error.stdout);

      if (error.stderr)
        process.stderr.write(error.stderr);

      throw error;
    }

    if (result.stdout)
      process.stdout.write(result.stdout);

    if (result.stderr)
      process.stderr.write(result.stderr);

    const report = JSON.parse(
      await readFile(D2_REPORT, "utf8")
    );

    return verify(report);
  } finally {
    running = false;
  }
}

const server = http.createServer(
  async (req, res) => {
    const url = new URL(
      req.url || "/",
      "http://127.0.0.1"
    );

    if (
      req.method === "GET" &&
      url.pathname === "/health"
    ) {
      return reply(res, 200, {
        ok: true,
        phase: "D3",
        environment: "devnet",
        bind: "127.0.0.1",
        productionAutoLiveUnlocked: false,
        mainnetDeployment: false,
      });
    }

    if (
      req.method !== "POST" ||
      url.pathname !== "/execute"
    ) {
      return reply(res, 404, {
        error: "NOT_FOUND",
      });
    }

    try {
      const data = await body(req);

      if (
        data.confirm !== "RUN DEVNET D3"
      ) {
        return reply(res, 400, {
          error: "CONFIRMATION_REQUIRED",
        });
      }

      const report =
        await executeDevnetRoundTrip();

      return reply(res, 200, {
        ok: true,
        phase: "D3",
        environment: "devnet",
        report,
        productionAutoLiveUnlocked: false,
        mainnetDeployment: false,
      });
    } catch (error) {
      return reply(res, 500, {
        ok: false,
        error: "D3_EXECUTION_FAILED",
        message:
          error?.message || String(error),
        productionAutoLiveUnlocked: false,
        mainnetDeployment: false,
      });
    }
  }
);

await new Promise((resolve, reject) => {
  server.once("error", reject);

  server.listen(
    0,
    "127.0.0.1",
    resolve
  );
});

try {
  const addr = server.address();

  if (!addr || typeof addr !== "object") {
    throw new Error(
      "D3 loopback server failed"
    );
  }

  console.log(
    "=============================================="
  );
  console.log(
    " MEMEFLOW SMART VAULT - PHASE D3"
  );
  console.log(
    " SERVER EXECUTOR / DEVNET ONLY"
  );
  console.log(
    "=============================================="
  );
  console.log(
    "Loopback server: 127.0.0.1:" +
      addr.port
  );
  console.log(
    "Mainnet: HARD BLOCKED"
  );
  console.log(
    "Production AUTO LIVE: LOCKED"
  );

  const healthResponse = await fetch(
    `http://127.0.0.1:${addr.port}/health`
  );

  const health =
    await healthResponse.json();

  if (
    health.environment !== "devnet" ||
    health.mainnetDeployment !== false ||
    health.productionAutoLiveUnlocked !==
      false
  ) {
    throw new Error(
      "D3 health safety gate failed"
    );
  }

  const response = await fetch(
    `http://127.0.0.1:${addr.port}/execute`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirm: "RUN DEVNET D3",
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    throw new Error(
      result.message ||
        `D3 HTTP ${response.status}`
    );
  }

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    " PHASE D3 DEVNET SERVER EXECUTOR PASSED"
  );
  console.log(
    "=============================================="
  );
  console.log(
    "PASS: HTTP server -> executor"
  );
  console.log(
    "PASS: executor -> Smart Vault -> Pump BUY_V2"
  );
  console.log(
    "PASS: executor -> Smart Vault -> Pump SELL_V2"
  );
  console.log(
    "PASS: Vault PDA signed Pump CPI"
  );
  console.log(
    "PASS: owner did NOT sign either trade"
  );
  console.log(
    "PASS: production AUTO LIVE remains LOCKED"
  );
  console.log(
    "PASS: Mainnet was NOT touched"
  );
  console.log("");
  console.log(
    "BUY:  " +
      result.report.buySignature
  );
  console.log(
    "SELL: " +
      result.report.sellSignature
  );
} finally {
  await new Promise((resolve) =>
    server.close(resolve)
  );
}
