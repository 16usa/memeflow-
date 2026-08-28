#!/usr/bin/env bash
set -euo pipefail

echo "This installs the current official Solana/Anchor development toolchain."
echo "It does NOT deploy a program and does NOT touch a wallet seed."
echo
echo "Official Anchor docs currently pair Anchor 1.0.2 with Solana CLI 3.1.10."
echo
read -r -p "Install development toolchain now? Type YES: " answer
[[ "$answer" == "YES" ]] || { echo "Cancelled."; exit 0; }

curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

echo
echo "Installation command finished."
echo "Restart/open a fresh Replit Shell, then run:"
echo "  cd ~/workspace/memeflow-app/smart-vault"
echo "  ./scripts/build-devnet.sh"
