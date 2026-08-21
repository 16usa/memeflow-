export const NODES = [
  { id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.00, 0, -3.00], size: [2.36, 1.60] },
  { id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.00], size: [2.52, 1.60] },
  { id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.00, 0, -3.00], size: [3.12, 2.02], core: true },

  { id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.00, 0, -0.42], size: [2.36, 1.60] },
  { id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.42], size: [2.42, 1.60] },
  { id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.00, 0, -0.42], size: [2.36, 1.60] },

  { id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.00, 0, 2.16], size: [2.48, 1.60] },
  { id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.16], size: [2.28, 1.60], decision: true },
  { id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.00, 0, 2.16], size: [2.36, 1.60] },

  { id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 4.70], size: [2.58, 1.66], execution: true }
];

export const ROUTES = [
  ['discovery', 'bootstrap', 0x74dcff],
  ['bootstrap', 'core', 0x74dcff],

  ['core', 'risk', 0x6cdfff],
  ['core', 'market', 0x59e99c],
  ['core', 'holders', 0x59e99c],

  ['risk', 'market', 0x74dcff],
  ['market', 'holders', 0x74dcff],

  ['risk', 'openai', 0x9a70ff],
  ['openai', 'decision', 0x74dcff],
  ['market', 'decision', 0x74dcff],

  ['decision', 'paper', 0xa977ff],
  ['paper', 'execution', 0x61eda0]
];
