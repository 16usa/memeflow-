#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW — PHASE D0 / DEVNET EXECUTOR INTEGRATION SCAN V1 =="
echo "READ-ONLY. No file modifications. No transactions. No secrets printed."
echo

APP="/home/runner/workspace/memeflow-app"
SV="$APP/smart-vault"
OUT="/home/runner/workspace/memeflow_phase_d0_scan_report.txt"

[[ -d "$APP" ]] || { echo "ERROR: $APP not found"; exit 2; }
[[ -d "$SV" ]] || { echo "ERROR: $SV not found"; exit 2; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

{
  echo "MEMEFLOW PHASE D0 SCAN REPORT"
  echo "Generated UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "App: $APP"
  echo

  echo "== 1) PROJECT ROOT =="
  find "$APP" -maxdepth 2 -type f \
    \( -name 'package.json' -o -name 'live-bootstrap.mjs' -o -name 'server.*' -o -name 'index.*' -o -name 'app.*' -o -name 'main.*' -o -name 'vite.config.*' -o -name 'replit.nix' -o -name '.replit' \) \
    -print 2>/dev/null | sort
  echo

  echo "== 2) PACKAGE.JSON (scripts + relevant dependencies only) =="
  node - "$APP/package.json" <<'NODE'
const fs = require('fs');
const p = process.argv[2];
if (!fs.existsSync(p)) {
  console.log("package.json missing");
  process.exit(0);
}
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log("name:", j.name || "");
console.log("type:", j.type || "");
console.log("scripts:", JSON.stringify(j.scripts || {}, null, 2));
const deps = {...(j.dependencies||{}), ...(j.devDependencies||{})};
const keep = Object.fromEntries(Object.entries(deps).filter(([k]) =>
  /solana|anchor|express|fastify|hono|ws|websocket|pump|phantom|jupiter|bs58|tweetnacl|zod|drizzle|pg|sqlite/i.test(k)
));
console.log("relevantDependencies:", JSON.stringify(keep, null, 2));
NODE
  echo

  echo "== 3) SERVER ENTRYPOINT CANDIDATES =="
  find "$APP" -maxdepth 3 -type f \
    \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.ts' \) \
    -not -path '*/node_modules/*' \
    -not -path '*/smart-vault/target/*' \
    -print0 2>/dev/null \
    | xargs -0 grep -IlE 'listen\(|createServer\(|express\(|fastify\(|Bun\.serve|Deno\.serve' 2>/dev/null \
    | head -80
  echo

  echo "== 4) LIVE / EXECUTION ROUTES AND MODULES =="
  grep -RInE --exclude-dir=node_modules --exclude-dir=target \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' \
    '(/api/live|live/status|LIVE_TRADING|LIVE execution|live execution|wallet approval|signTransaction|sendTransaction|pump\.fun|Pump\.fun|PumpSwap|execute_pump|smart.?vault|AUTO LIVE|auto live)' \
    "$APP" 2>/dev/null | head -260
  echo

  echo "== 5) CURRENT LIVE BOOTSTRAP =="
  if [[ -f "$APP/live-bootstrap.mjs" ]]; then
    sed -n '1,260p' "$APP/live-bootstrap.mjs"
  else
    echo "live-bootstrap.mjs not found"
  fi
  echo

  echo "== 6) EXECUTOR / SIGNER / KEYPAIR REFERENCES =="
  grep -RInE --exclude-dir=node_modules --exclude-dir=target \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' \
    '(Keypair|fromSecretKey|secretKey|executor|EXECUTOR|signer|SIGNER|sendAndConfirmTransaction|VersionedTransaction|TransactionInstruction)' \
    "$APP" 2>/dev/null \
    | sed -E 's/(=|:)[[:space:]]*["'\''][^"'\'']{12,}["'\'']/\1 <REDACTED>/g' \
    | head -260
  echo

  echo "== 7) SESSION / OWNER / PRO ENTITLEMENT ROUTES =="
  grep -RInE --exclude-dir=node_modules --exclude-dir=target \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' \
    '(isOwner|liveEntitled|entitlementSource|owner/claim|session/status|Pro subscription|entitled)' \
    "$APP" 2>/dev/null | head -220
  echo

  echo "== 8) PUMP TRADE BUILDER / QUOTE REFERENCES =="
  grep -RInE --exclude-dir=node_modules --exclude-dir=target \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' \
    '(buy_v2|sell_v2|PumpFun|pumpfun|pump_fun|pumpProgram|bondingCurve|associatedBondingCurve|creatorVault|globalVolumeAccumulator|feeRecipient|quote.*buy|quote.*sell)' \
    "$APP" 2>/dev/null | head -300
  echo

  echo "== 9) SMART VAULT DEPLOY RECORD =="
  if [[ -f "$SV/DEVNET_DEPLOYMENT.json" ]]; then
    cat "$SV/DEVNET_DEPLOYMENT.json"
  else
    echo "DEVNET_DEPLOYMENT.json missing"
  fi
  echo

  echo "== 10) SMART VAULT IDL SUMMARY =="
  IDL="$SV/target/idl/memeflow_smart_vault.json"
  if [[ -f "$IDL" ]]; then
    node - "$IDL" <<'NODE'
const fs=require('fs');
const p=process.argv[2];
const j=JSON.parse(fs.readFileSync(p,'utf8'));
console.log("address:", j.address || j.metadata?.address || "");
for (const ix of (j.instructions||[])) {
  console.log("\nINSTRUCTION", ix.name);
  console.log(" accounts:", (ix.accounts||[]).map(a => ({
    name:a.name,
    writable:!!(a.writable ?? a.isMut),
    signer:!!(a.signer ?? a.isSigner),
    address:a.address || null
  })));
  console.log(" args:", ix.args||[]);
}
NODE
  else
    echo "IDL missing: $IDL"
  fi
  echo

  echo "== 11) SMART VAULT PROGRAM POLICY ERROR NAMES =="
  grep -RInE --include='*.rs' \
    '(error_code|Unauthorized|Paused|Daily|Trade|Max|Invalid|Pump|Slippage|Vault|Insufficient)' \
    "$SV/programs" 2>/dev/null | head -220
  echo

  echo "== 12) ENVIRONMENT VARIABLE NAMES ONLY =="
  {
    grep -RhoE --exclude-dir=node_modules --exclude-dir=target \
      'process\.env\.[A-Z0-9_]+' "$APP" 2>/dev/null \
      | sed 's/process\.env\.//' || true
    grep -RhoE --exclude-dir=node_modules --exclude-dir=target \
      'process\.env\[[^]]+\]' "$APP" 2>/dev/null \
      | sed -E 's/process\.env\[["'\'']([^"'\'']+)["'\'']\]/\1/' || true
  } | sort -u
  echo

  echo "== 13) REPLIT LAUNCH CONFIG =="
  if [[ -f "/home/runner/workspace/.replit" ]]; then
    sed -n '1,220p' "/home/runner/workspace/.replit"
  elif [[ -f "$APP/.replit" ]]; then
    sed -n '1,220p' "$APP/.replit"
  else
    echo ".replit not found"
  fi
  echo

  echo "== 14) PHASE C LATEST REPORT SUMMARY =="
  latest="$(find "$SV/.devnet-test-runs" -type f -name 'phase-c-report.json' 2>/dev/null | sort | tail -1 || true)"
  if [[ -n "$latest" ]]; then
    echo "file: $latest"
    node - "$latest" <<'NODE'
const fs=require('fs');
const j=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
console.log(JSON.stringify({
  environment:j.environment,
  programId:j.programId,
  payer:j.payer,
  policy:j.policy,
  vault:j.vault,
  pumpProgramPresentOnDevnet:j.pumpProgramPresentOnDevnet,
  pumpProgramExecutableOnDevnet:j.pumpProgramExecutableOnDevnet,
  finalPolicy:j.finalPolicy,
  finalVaultLamports:j.finalVaultLamports,
  passCount:(j.results||[]).filter(x=>x.status==="PASS").length,
  failed:(j.results||[]).filter(x=>x.status!=="PASS"),
  productionAutoLiveUnlocked:j.productionAutoLiveUnlocked,
  mainnetTouched:j.mainnetTouched,
  realMoneyUsed:j.realMoneyUsed,
  note:j.note
}, null, 2));
NODE
  else
    echo "No Phase C report found"
  fi
  echo

  echo "== END REPORT =="
} > "$tmp"

mv "$tmp" "$OUT"

echo "SCAN COMPLETE."
echo "Report written to:"
echo "  $OUT"
echo
echo "No files were modified."
echo "No transactions were sent."
echo "No secret values were printed intentionally."
echo
echo "Print the report with:"
echo "  cat $OUT"
echo
echo "If the report is long, show the last 350 lines with:"
echo "  tail -350 $OUT"
