# MEMEFLOW Unified Candidate System

This integration patch makes one selected candidate drive:

- Primary Candidate
- AI Decision Studio
- decision checks
- chart mint/source
- Pre-trade execution checks
- readiness count
- Mission/top context

It removes static success wording and replaces the fake 2/9 readiness with nine real gates.

Install from the Replit project root:

```bash
unzip -o MEMEFLOW_UNIFIED_CANDIDATE_SYSTEM.zip
node memeflow_unified_candidate_system/apply_unified_candidate_system.mjs
node --test memeflow-app/src/unified-candidate-system.test.mjs
node --test memeflow-app/src/*.test.mjs
```

Then restart Project and hard-refresh Preview.
