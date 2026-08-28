#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Smart Vault — Replit Toolchain FIX 2 =="
echo "Project-local Rust + Solana 3.1.10 + Anchor 1.0.2"
echo "This does NOT write /home/runner/.bashrc."
echo "This does NOT deploy anything."

if [[ -d "memeflow-app/smart-vault" ]]; then
  cd memeflow-app/smart-vault
elif [[ -d "smart-vault" && -f "smart-vault/Anchor.toml" ]]; then
  cd smart-vault
elif [[ -f "Anchor.toml" && -d "programs/memeflow_smart_vault" ]]; then
  :
else
  echo "ERROR: smart-vault project not found. Run from ~/workspace or ~/workspace/memeflow-app." >&2
  exit 1
fi

VAULT_ROOT="$PWD"
TOOL_ROOT="$VAULT_ROOT/.toolchain"
TOOL_HOME="$TOOL_ROOT/home"
CARGO_HOME_LOCAL="$TOOL_ROOT/cargo"
RUSTUP_HOME_LOCAL="$TOOL_ROOT/rustup"
SOLANA_BIN="$TOOL_HOME/.local/share/solana/install/active_release/bin"

mkdir -p \
  "$TOOL_HOME" \
  "$CARGO_HOME_LOCAL" \
  "$RUSTUP_HOME_LOCAL" \
  "$VAULT_ROOT/scripts"

# The upstream installers try to edit shell profile files. Replit's real
# /home/runner/.bashrc is read-only, so give installers an isolated writable HOME.
touch \
  "$TOOL_HOME/.bashrc" \
  "$TOOL_HOME/.profile" \
  "$TOOL_HOME/.bash_profile"

cat > "$VAULT_ROOT/scripts/toolchain-env.sh" <<'EOF_ENV'
#!/usr/bin/env bash

_MF_VAULT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export MEMEFLOW_SMART_VAULT_TOOLCHAIN="$_MF_VAULT_ROOT/.toolchain"

# Isolate all blockchain development credentials/config from the Replit account
# and from the production MEMEFLOW runtime.
export HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/home"
export CARGO_HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/cargo"
export RUSTUP_HOME="$MEMEFLOW_SMART_VAULT_TOOLCHAIN/rustup"

export PATH="$CARGO_HOME/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

unset _MF_VAULT_ROOT
EOF_ENV
chmod +x "$VAULT_ROOT/scripts/toolchain-env.sh"

# Patch the existing build script so every future build automatically gets the
# isolated toolchain, even in a brand-new Replit Shell.
python3 - <<'PY'
from pathlib import Path

p=Path("scripts/build-devnet.sh")
if not p.exists():
    raise SystemExit("ERROR: scripts/build-devnet.sh not found")

s=p.read_text()

needle='cd "$(dirname "$0")/.."\n'
insert='cd "$(dirname "$0")/.."\nsource "./scripts/toolchain-env.sh"\n'

if 'source "./scripts/toolchain-env.sh"' not in s:
    if needle not in s:
        raise SystemExit("ERROR: build-devnet.sh anchor changed; refusing blind patch")
    s=s.replace(needle,insert,1)

p.write_text(s)
PY

# Use the isolated toolchain in this installer too.
# shellcheck disable=SC1091
source "$VAULT_ROOT/scripts/toolchain-env.sh"

echo
echo "Writable isolated HOME: $HOME"
echo "Toolchain root: $MEMEFLOW_SMART_VAULT_TOOLCHAIN"

for cmd in curl git tar; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: required system command missing: $cmd" >&2
    exit 2
  }
done

if ! command -v cc >/dev/null 2>&1 && \
   ! command -v gcc >/dev/null 2>&1 && \
   ! command -v clang >/dev/null 2>&1; then
  echo "ERROR: no C linker/compiler (cc/gcc/clang) is available in this Replit image." >&2
  echo "Anchor CLI must be compiled once. Stop here and send this output." >&2
  exit 3
fi

echo
echo "== 1/3 Rust =="
if [[ -x "$CARGO_HOME/bin/rustc" ]] && "$CARGO_HOME/bin/rustc" --version >/dev/null 2>&1; then
  echo "Rust already installed in project toolchain."
else
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- \
      -y \
      --no-modify-path \
      --default-toolchain stable \
      --profile minimal
fi

export PATH="$CARGO_HOME/bin:$PATH"
rustup default stable >/dev/null
rustc --version
cargo --version

echo
echo "== 2/3 Solana CLI / Agave v3.1.10 =="
NEED_SOLANA=1
if [[ -x "$SOLANA_BIN/solana" ]]; then
  CURRENT_SOLANA="$("$SOLANA_BIN/solana" --version 2>/dev/null || true)"
  echo "Existing: ${CURRENT_SOLANA:-unknown}"
  if grep -qE '3\.1\.10' <<<"$CURRENT_SOLANA"; then
    NEED_SOLANA=0
  fi
fi

if [[ "$NEED_SOLANA" -eq 1 ]]; then
  # Official Anza version-pinned installer. HOME points to our writable
  # project-local directory, so any profile edits happen there, not ~/.bashrc.
  HOME="$TOOL_HOME" \
    sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.10/install)"
fi

export PATH="$SOLANA_BIN:$PATH"
solana --version

if ! solana --version | grep -qE '3\.1\.10'; then
  echo "ERROR: expected Solana CLI 3.1.10." >&2
  exit 4
fi

echo
echo "== 3/3 Anchor CLI v1.0.2 =="
NEED_ANCHOR=1
if command -v anchor >/dev/null 2>&1; then
  CURRENT_ANCHOR="$(anchor --version 2>/dev/null || true)"
  echo "Existing: ${CURRENT_ANCHOR:-unknown}"
  if grep -qE '1\.0\.2' <<<"$CURRENT_ANCHOR"; then
    NEED_ANCHOR=0
  fi
fi

if [[ "$NEED_ANCHOR" -eq 1 ]]; then
  echo "Compiling Anchor CLI once into the isolated project toolchain."
  echo "This is the slowest step."
  cargo install \
    --git https://github.com/solana-foundation/anchor \
    --tag v1.0.2 \
    anchor-cli \
    --locked \
    --force
fi

anchor --version

if ! anchor --version | grep -qE '1\.0\.2'; then
  echo "ERROR: expected Anchor CLI 1.0.2." >&2
  exit 5
fi

echo
echo "== Toolchain verification =="
printf 'rustc:  '; rustc --version
printf 'cargo:  '; cargo --version
printf 'solana: '; solana --version
printf 'anchor: '; anchor --version
printf 'node:   '; node --version

echo
echo "Checking Smart Vault workspace metadata..."
cargo metadata --no-deps --format-version 1 >/dev/null
echo "cargo metadata: OK"

echo
echo "Running no-funds policy model again..."
node tests/policy-model.mjs

echo
echo "== REPLIT TOOLCHAIN FIX 2 COMPLETE =="
echo
echo "Important:"
echo "  - /home/runner/.bashrc was NOT modified."
echo "  - Surfpool is NOT required for our current Devnet build gate."
echo "  - Solana dev-skill install is NOT required."
echo "  - Mainnet is still blocked."
echo "  - No deploy was performed."
echo "  - No transaction was sent."
echo
echo "Next command:"
echo "  cd ~/workspace/memeflow-app/smart-vault"
echo "  ./scripts/build-devnet.sh"
