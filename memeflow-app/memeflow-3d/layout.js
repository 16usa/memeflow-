export const NODES = [
  { id: 'discovery', label: 'DISCOVERY', color: 0x315cff, pos: [-3.25, 0, -3.25], size: [2.15, 1.48] },
  { id: 'bootstrap', label: 'FAST BOOTSTRAP', color: 0x315cff, pos: [0, 0, -3.25], size: [2.32, 1.48] },
  { id: 'core', label: 'MEMEFLOW CORE', color: 0x56e79a, pos: [3.25, 0, -3.25], size: [2.78, 1.78], core: true },

  { id: 'risk', label: 'RISK ENGINE', color: 0x43c8ee, pos: [-3.25, 0, -0.35], size: [2.15, 1.48] },
  { id: 'market', label: 'MARKET LEDGER', color: 0x3a7dff, pos: [0, 0, -0.35], size: [2.20, 1.48] },
  { id: 'holders', label: 'HOLDER LEDGER', color: 0x43c8ee, pos: [3.25, 0, -0.35], size: [2.15, 1.48] },

  { id: 'openai', label: 'OPENAI ASSISTANT', color: 0x43c8ee, pos: [-3.25, 0, 2.55], size: [2.28, 1.48] },
  { id: 'decision', label: 'DECISION', color: 0x8d58ff, pos: [0, 0, 2.55], size: [2.05, 1.48], decision: true },
  { id: 'paper', label: 'PAPER ENGINE', color: 0x315cff, pos: [3.25, 0, 2.55], size: [2.15, 1.48] },

  { id: 'execution', label: 'LIVE EXECUTION', color: 0x48df8b, pos: [0, 0, 5.30], size: [2.28, 1.48], execution: true }
];

export const ROUTES = [
  ['discovery', 'bootstrap', 0x74dcff],
  ['bootstrap', 'core', 0x74dcff],

  ['core', 'risk', 0x74dcff],
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
