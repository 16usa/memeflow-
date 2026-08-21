export const NODES = [
  {
    id: 'discovery',
    label: 'DISCOVERY',
    color: 0x35a8ff,
    pos: [-4.10, 1.55, 0.70],
    size: [1.72, 3.35, 0.54],
    lane: 'left'
  },
  {
    id: 'bootstrap',
    label: 'FAST BOOTSTRAP',
    color: 0x3c8dff,
    pos: [-3.45, 1.50, -2.10],
    size: [1.58, 3.10, 0.50],
    lane: 'left'
  },
  {
    id: 'risk',
    label: 'RISK ENGINE',
    color: 0x42d5ff,
    pos: [-2.70, 1.42, -4.45],
    size: [1.44, 2.85, 0.46],
    lane: 'left',
    overhead: true
  },
  {
    id: 'market',
    label: 'MARKET LEDGER',
    color: 0x5e8fff,
    pos: [-1.45, 1.34, -6.10],
    size: [1.34, 2.58, 0.42],
    lane: 'center',
    overhead: true
  },
  {
    id: 'holders',
    label: 'HOLDER LEDGER',
    color: 0x6aa8ff,
    pos: [-0.40, 1.30, -7.15],
    size: [1.22, 2.40, 0.40],
    lane: 'center',
    overhead: true
  },
  {
    id: 'openai',
    label: 'OPENAI ASSISTANT',
    color: 0xa46dff,
    pos: [0.72, 1.30, -7.25],
    size: [1.22, 2.40, 0.40],
    lane: 'center',
    overhead: true
  },
  {
    id: 'decision',
    label: 'DECISION',
    color: 0xb16cff,
    pos: [1.72, 1.34, -6.05],
    size: [1.34, 2.58, 0.42],
    lane: 'center',
    overhead: true
  },
  {
    id: 'paper',
    label: 'PAPER ENGINE',
    color: 0x4bc6ff,
    pos: [3.35, 1.50, -2.05],
    size: [1.58, 3.10, 0.50],
    lane: 'right'
  },
  {
    id: 'execution',
    label: 'LIVE EXECUTION',
    color: 0x5fe8a4,
    pos: [4.15, 1.58, 0.62],
    size: [1.72, 3.40, 0.54],
    lane: 'right',
    execution: true
  },
  {
    id: 'core',
    label: 'MEMEFLOW CORE',
    color: 0x65efa9,
    pos: [0.18, 1.25, -9.45],
    size: [1.16, 2.15, 0.38],
    lane: 'core',
    core: true
  }
];

export const ROUTES = [
  ['discovery', 'bootstrap'],
  ['bootstrap', 'risk'],
  ['risk', 'market'],
  ['market', 'holders'],
  ['holders', 'openai'],
  ['openai', 'decision'],
  ['decision', 'paper'],
  ['paper', 'execution'],
  ['holders', 'core'],
  ['openai', 'core']
];
