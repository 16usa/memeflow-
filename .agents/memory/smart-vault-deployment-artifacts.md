---
name: Smart Vault deployment artifacts
description: Generated Smart Vault toolchains and dependency/build directories can be included in publish layers despite ignore rules.
---

Replit publishing can encounter generated files under Smart Vault even when they are ignored by Git; large Rust `target`, Solana toolchain caches, and nested `node_modules` directories can make the publish layer several gigabytes and fail while pushing.

**Why:** A recent Cloud Run publish failed in the layer-upload phase with a closed pipe while reading a Rust `target/debug/build` file; the workspace contained about 4.8 GB of generated Smart Vault artifacts.

**How to apply:** Before republishing, inspect and clean only regenerable ignored artifacts in `memeflow-app/smart-vault` (toolchain caches, `target`, nested `node_modules`), preserving source, manifests, deployment metadata, and runtime code.