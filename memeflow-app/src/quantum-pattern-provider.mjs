// Adapter for existing V23 historical pattern snapshots. No trade execution.
const finite = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function resolveQuantumPattern(cell, {now=Date.now(), maxAgeMs=120000}={}) {
  const snapshot=cell?.snapshot;
  const pattern=snapshot?.shadowTokenPattern;
  const timestamp=finite(snapshot?.observedAt ?? snapshot?.at ?? cell?.lastObservedAt);
  if (!pattern || pattern.ready !== true) return {shadowTokenPattern:{ready:false,status:pattern?.status||'PATTERN_UNAVAILABLE'}};
  // Staleness is enforced only when a reliable timestamp exists; otherwise
  // explicitly reject, rather than silently treat unknown freshness as fresh.
  if (timestamp === null || timestamp<=0 || now-timestamp>maxAgeMs || timestamp>now+5000) {
    return {shadowTokenPattern:{ready:false,status:'PATTERN_STALE_OR_UNTIMED'}};
  }
  const probability=finite(pattern.patternProbabilityPositivePct);
  const confidence=finite(pattern.matchConfidencePct);
  if (probability===null || confidence===null || probability<0 || probability>100 || confidence<0 || confidence>100) {
    return {shadowTokenPattern:{ready:false,status:'PATTERN_INVALID'}};
  }
  return {shadowTokenPattern:{ready:true,status:pattern.status||'PATTERN_MATCH',patternProbabilityPositivePct:probability,matchConfidencePct:confidence}};
}
