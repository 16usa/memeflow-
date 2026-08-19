// MEMEFLOW_PER_USER_DISCOVERY_V34_1
const MODES = new Set(['pump','dex','hybrid']);

export function normalizeDiscoveryMode(value){
  const raw =
    typeof value === 'object' && value !== null
      ? value.discoverySourceMode
      : value;

  const mode = String(raw || 'pump').trim().toLowerCase();
  return MODES.has(mode) ? mode : 'pump';
}

export function isPumpOriginToken(token){
  if(!token)return false;

  const mint = String(
    token?.mint ||
    token?.tokenMint ||
    token?.tokenAddress ||
    ''
  ).toLowerCase();

  const launch = String(token?.launchPlatform || '').toLowerCase();
  const protocol = String(token?.protocol || '').toLowerCase();
  const source = String(token?.source || '').toLowerCase();

  return (
    launch === 'pump' ||
    protocol === 'pump' ||
    source.includes('pump create') ||
    mint.endsWith('pump')
  );
}

export function tokenAllowedForSettings(settings, token){
  if(!isPumpOriginToken(token))return false;

  const mode = normalizeDiscoveryMode(settings);

  if(mode === 'dex'){
    return (
      token?.dexConfirmed === true &&
      Boolean(token?.dexUrl || token?.dexPairAddress)
    );
  }

  // Pump and Hybrid both use the canonical Pump discovery stream.
  // Hybrid simply benefits from the DEX verification/enrichment tags too.
  return true;
}
