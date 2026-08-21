export const NODES = [
  { id: 'discovery',  label: 'DISCOVERY',        color: 0x2b59ff, pos: [-4.2,  0.0, -3.8], size: [2.15, 1.45] },
  { id: 'bootstrap',  label: 'FAST BOOTSTRAP',  color: 0x2b59ff, pos: [ 0.0,  0.0, -3.8], size: [2.40, 1.45] },
  { id: 'core',       label: 'MEMEFLOW CORE',   color: 0x65f0a5, pos: [ 4.2,  0.0, -3.8], size: [3.15, 2.05], core: true },
  { id: 'risk',       label: 'RISK ENGINE',     color: 0x53cfff, pos: [-4.2,  0.0, -0.6], size: [2.20, 1.45] },
  { id: 'market',     label: 'MARKET LEDGER',   color: 0x3579ff, pos: [ 0.0,  0.0, -0.6], size: [2.25, 1.45] },
  { id: 'holders',    label: 'HOLDER LEDGER',   color: 0x53cfff, pos: [ 4.2,  0.0, -0.6], size: [2.20, 1.45] },
  { id: 'openai',     label: 'OPENAI ASSISTANT',color: 0x53cfff, pos: [-4.2,  0.0,  2.5], size: [2.35, 1.45] },
  { id: 'decision',   label: 'DECISION',        color: 0x8c52ff, pos: [ 0.0,  0.0,  2.5], size: [2.05, 1.45], decision: true },
  { id: 'paper',      label: 'PAPER ENGINE',    color: 0x2b59ff, pos: [ 4.2,  0.0,  2.5], size: [2.20, 1.45] },
  { id: 'execution',  label: 'LIVE EXECUTION',  color: 0x47e28c, pos: [ 0.0,  0.0,  5.6], size: [2.25, 1.45], execution: true }
];

export const ROUTES = [
  ['discovery', 'bootstrap', 0x7bdfff],
  ['bootstrap', 'core', 0x7bdfff],
  ['core', 'risk', 0x7bdfff],
  ['risk', 'market', 0x7bdfff],
  ['market', 'holders', 0x7bdfff],
  ['risk', 'openai', 0xc486ff],
  ['openai', 'decision', 0x7bdfff],
  ['market', 'decision', 0x7bdfff],
  ['holders', 'core', 0x7bdfff],
  ['decision', 'paper', 0xb48cff],
  ['paper', 'execution', 0x7affaa],
];
