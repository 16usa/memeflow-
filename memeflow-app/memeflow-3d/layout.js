export const NODES = [
  { id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.30, 0.00, -2.48], size: [2.58, 1.68] },
  { id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0.00, -2.48], size: [2.72, 1.68] },
  { id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.30, 0.14, -2.48], size: [3.44, 2.16], core: true },

  { id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.30, 0.02, -0.42], size: [2.58, 1.68] },
  { id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0.02, -0.42], size: [2.64, 1.68] },
  { id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.30, 0.02, -0.42], size: [2.58, 1.68] },

  { id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.30, 0.04, 1.64], size: [2.72, 1.68] },
  { id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0.10, 1.64], size: [2.48, 1.68], decision: true },
  { id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.30, 0.04, 1.64], size: [2.58, 1.68] },

  { id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0.12, 3.72], size: [2.84, 1.76], execution: true }
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
