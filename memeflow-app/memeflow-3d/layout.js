export const NODES = [
  {
    id: 'discovery',
    label: 'DISCOVERY',
    color: 0x159dff,
    pos: [-3.55, 0.34, -3.15],
    size: [2.30, 1.60],
    icon: 'discovery'
  },
  {
    id: 'risk',
    label: 'RISK ENGINE',
    color: 0x268dff,
    pos: [-0.35, 0.34, -3.30],
    size: [2.38, 1.62],
    icon: 'risk'
  },
  {
    id: 'core',
    label: 'MEMEFLOW CORE',
    color: 0x39ef88,
    pos: [3.25, 0.40, -3.15],
    size: [2.58, 1.76],
    icon: 'core',
    emphasis: 1.26
  },

  {
    id: 'bootstrap',
    label: 'FAST BOOTSTRAP',
    color: 0x23c8ff,
    pos: [-3.80, 0.34, -0.20],
    size: [2.42, 1.62],
    icon: 'bootstrap'
  },
  {
    id: 'openai',
    label: 'OPENAI ASSISTANT',
    color: 0x9b4fff,
    pos: [-0.10, 0.46, -0.05],
    size: [2.72, 1.86],
    icon: 'openai',
    emphasis: 1.22
  },
  {
    id: 'decision',
    label: 'DECISION',
    color: 0x45ed8e,
    pos: [3.45, 0.38, -0.10],
    size: [2.34, 1.62],
    icon: 'decision'
  },

  {
    id: 'market',
    label: 'MARKET LEDGER',
    color: 0x20bfff,
    pos: [-3.62, 0.34, 2.95],
    size: [2.42, 1.62],
    icon: 'market'
  },
  {
    id: 'paper',
    label: 'PAPER ENGINE',
    color: 0x43e99a,
    pos: [-0.12, 0.38, 3.16],
    size: [2.42, 1.66],
    icon: 'paper'
  },
  {
    id: 'execution',
    label: 'LIVE EXECUTION',
    color: 0x30ed82,
    pos: [3.62, 0.42, 2.88],
    size: [2.52, 1.70],
    icon: 'execution',
    emphasis: 1.18
  },

  {
    id: 'holders',
    label: 'HOLDER LEDGER',
    color: 0x2bbdff,
    pos: [2.20, 0.32, 1.34],
    size: [2.05, 1.48],
    icon: 'holders',
    compact: true
  }
];

export const ROUTES = [
  ['discovery', 'risk', 0x32bfff],
  ['discovery', 'bootstrap', 0x1ca9ff],
  ['bootstrap', 'risk', 0x28c8ff],
  ['bootstrap', 'market', 0x23bfff],

  ['risk', 'core', 0x3bd3ff],
  ['risk', 'openai', 0x6f72ff],
  ['market', 'openai', 0x7657ff],

  ['market', 'holders', 0x28bfff],
  ['holders', 'decision', 0x45dbb2],

  ['core', 'decision', 0x43ef91],
  ['openai', 'decision', 0xa65aff],
  ['openai', 'paper', 0x9a5cff],

  ['paper', 'execution', 0x42eda0],
  ['decision', 'execution', 0x4bed94]
];
