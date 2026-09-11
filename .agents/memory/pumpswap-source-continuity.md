---
name: PumpSwap source continuity
description: Runtime constraints for preserving live market updates when Pump tokens migrate to PumpSwap.
---

PumpSwap pools may place wrapped SOL on either the base or quote side. Normalize reserves, amounts, and buy/sell direction around the tracked token rather than assuming one orientation.

**Why:** Live PumpSwap events demonstrated both orientations, and MEMEFLOW intentionally disables ordinary HTTP Solana RPC outside pre-open verification. Runtime pool-account lookups would violate that boundary and repeatedly fail.

**How to apply:** Use CreatePool metadata when observed live. After a restart with only a stored pool address, infer orientation from the first pool reserve update against the token's final Pump price, then keep PumpSwap authoritative for that mint.