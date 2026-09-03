MEMEFLOW AGENT PERFORMANCE COMPACT V2

Purpose:
Make the public Agent Performance page significantly shorter on mobile without
removing statistics.

Changes:
- merges the headline metrics + donut + outcome bars + secondary metrics into one snapshot;
- merges Score/Holders/Top10/Buy Pressure into one Performance Drivers panel;
- merges Exit Reasons + Strategy Sources into one Trade Breakdown panel;
- collapses Methodology and Privacy into details disclosures;
- keeps all existing element IDs, so the current agent-performance.js continues to work;
- preserves Light/Dark theme support.

Install:
unzip -o MEMEFLOW_AGENT_PERFORMANCE_COMPACT_V2.zip && node MEMEFLOW_AGENT_PERFORMANCE_COMPACT_V2/install.mjs

Rollback:
node MEMEFLOW_AGENT_PERFORMANCE_COMPACT_V2/rollback.mjs
