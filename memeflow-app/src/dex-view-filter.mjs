const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function dexViewRequested(source) {
  const raw = source instanceof URLSearchParams
    ? (source.get('dexPaid') ?? source.get('dexPool'))
    : source;

  return TRUE_VALUES.has(String(raw ?? '').trim().toLowerCase());
}

export function dexViewMint(row) {
  return String(
    row?.mint ??
    row?.tokenMint ??
    row?.tokenAddress ??
    ''
  ).trim();
}

export function dexPresenceFromPairs(mints, pairs) {
  const targets = new Set(
    (Array.isArray(mints) ? mints : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );

  const presence = new Map(
    [...targets].map(mint => [
      mint,
      {
        hasPool: false,
        pairAddress: null,
        url: null
      }
    ])
  );

  for (const pair of Array.isArray(pairs) ? pairs : []) {
    // Pool existence is the ONLY DEX criterion.
    // Liquidity, volume, boosts, paid orders, score and token state are ignored.
    const pairAddress = String(pair?.pairAddress || '').trim();
    if (!pairAddress) continue;

    const addresses = [
      String(pair?.baseToken?.address || '').trim(),
      String(pair?.quoteToken?.address || '').trim()
    ];

    for (const address of addresses) {
      if (!targets.has(address)) continue;

      const current = presence.get(address);
      if (current?.hasPool === true) continue;

      presence.set(address, {
        hasPool: true,
        pairAddress,
        url: typeof pair?.url === 'string' ? pair.url : null
      });
    }
  }

  return presence;
}

export function filterRowsByDexPresence(rows, presence) {
  const source = Array.isArray(rows) ? rows : [];

  return source.filter(row => {
    const mint = dexViewMint(row);
    if (!mint) return false;

    const entry = presence?.get?.(mint);
    return entry === true || entry?.hasPool === true;
  });
}
