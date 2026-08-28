#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/runner/workspace/memeflow-app/smart-vault"
D2="$ROOT/devnet-executor-d2"
SDK="$D2/node_modules/@pump-fun/pump-sdk"

echo "== MEMEFLOW Smart Vault — D2 FIX 1 / Pump SDK native-ESM BN import =="
echo "DEVNET TEST HARNESS ONLY. No Mainnet. No production AUTO LIVE changes."
echo

if [ ! -d "$D2" ]; then
  echo "ERROR: D2 folder does not exist: $D2" >&2
  exit 1
fi

if [ ! -d "$SDK" ]; then
  echo "ERROR: @pump-fun/pump-sdk is not installed in D2." >&2
  echo "Run the original D2 installer once first." >&2
  exit 1
fi

BACKUP="$D2/.state/pump-sdk-before-bn-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$D2/.state"
cp -a "$SDK" "$BACKUP"
echo "Backup: $BACKUP"

cat > "$D2/.state/patch-anchor-bn-imports.mjs" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) throw new Error("node_modules path missing");

const exts = new Set([".js", ".mjs"]);
let filesSeen = 0;
let importsPatched = 0;
const patchedFiles = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Never rewrite Anchor itself.
      if (p.includes(`${path.sep}@coral-xyz${path.sep}anchor`)) continue;
      walk(p);
    } else if (ent.isFile() && exts.has(path.extname(ent.name))) {
      patchFile(p);
    }
  }
}

function patchFile(file) {
  filesSeen++;
  let src = fs.readFileSync(file, "utf8");
  let changed = false;

  // Native Node ESM resolves @coral-xyz/anchor through its CommonJS main.
  // Some bundled SDK files use a named ESM import of BN from Anchor. Node
  // cannot reliably synthesize that named re-export from Anchor's CJS entry.
  // Move only BN to its real package (bn.js); leave all other Anchor imports.
  const re = /import\s*\{([^{}]*?\bBN\b[^{}]*?)\}\s*from\s*(["'])@coral-xyz\/anchor\2\s*;?/g;

  src = src.replace(re, (full, inside) => {
    const specs = inside.split(",").map((x) => x.trim()).filter(Boolean);

    const bnSpecs = [];
    const rest = [];

    for (const spec of specs) {
      if (/^BN(?:\s+as\s+[A-Za-z_$][\w$]*)?$/.test(spec)) bnSpecs.push(spec);
      else rest.push(spec);
    }

    if (bnSpecs.length !== 1) return full;

    const bnSpec = bnSpecs[0];
    const m = bnSpec.match(/^BN(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    const local = m?.[1] || "BN";

    importsPatched++;
    changed = true;

    const anchorImport = rest.length
      ? `import{${rest.join(",")}}from"@coral-xyz/anchor";`
      : "";

    return `${anchorImport}import ${local} from"bn.js";`;
  });

  if (changed) {
    fs.writeFileSync(file, src);
    patchedFiles.push(file);
  }
}

walk(root);

console.log(`JS files scanned: ${filesSeen}`);
console.log(`BN imports patched: ${importsPatched}`);
for (const f of patchedFiles) console.log(`patched: ${f}`);

if (importsPatched === 0) {
  console.error("ERROR: no named BN import from @coral-xyz/anchor was found.");
  process.exit(2);
}
NODE

echo
echo "Patching isolated D2 node_modules..."
node "$D2/.state/patch-anchor-bn-imports.mjs" "$D2/node_modules"

echo
echo "Verifying Pump SDK can load under native Node ESM..."
cd "$D2"
node --input-type=module <<'NODE'
const mod = await import("@pump-fun/pump-sdk");
if (typeof mod.OnlinePumpSdk !== "function") {
  throw new Error("OnlinePumpSdk export is missing after import");
}
if (!mod.PUMP_SDK) {
  throw new Error("PUMP_SDK export is missing after import");
}
console.log("Pump SDK native ESM import: OK");
NODE

echo
echo "Re-running D2 REAL DEVNET round-trip..."
echo "No npm install is performed here, so the compatibility patch is preserved."
node roundtrip.mjs

echo
echo "== D2 FIX 1 COMPLETE =="
echo "If you see PHASE D2 REAL DEVNET ROUND-TRIP PASSED, send me that final screen."
