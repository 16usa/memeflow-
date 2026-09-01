// MEMEFLOW_AI_DECISIONS_INVENTORY_HOTPATH_V60
//
// Build full admitted membership without globally sorting the scanner cache.
// Recovery still needs the newest admitted prefix, so keep only a bounded
// candidate set during the scan and sort that small set.
//
// This module deliberately does NOT cache admission results. Admission may
// change solely because wall-clock token age crosses a settings threshold.

const finiteNumber=(value,fallback=0)=>{
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
};

const recoveryOrder=(a,b)=>{
  const timeDiff=
    finiteNumber(b?.discoveredAt)-
    finiteNumber(a?.discoveredAt);

  if(timeDiff!==0)return timeDiff;

  // Native stable Array.sort historically preserves Object.values insertion
  // order when discoveredAt ties. Preserve that exact behavior explicitly.
  return (
    finiteNumber(a?.__mfOrdinalV60)-
    finiteNumber(b?.__mfOrdinalV60)
  );
};

function compactRecoveryRows(rows,limit){
  if(rows.length<=limit*2)return rows;

  rows.sort(recoveryOrder);
  rows.length=limit;
  return rows;
}

export function buildAdmittedScannerInventoryV60({
  tokens=[],
  recoveryLimit=200,
  isCurrent=()=>true,
  evaluateAdmission=()=>({admitted:false})
}={}){
  const limit=Math.max(
    1,
    Math.floor(
      finiteNumber(
        recoveryLimit,
        200
      )
    )
  );

  const admittedMints=new Set();
  const recoveryRows=[];

  let liveCount=0;
  let admittedCount=0;
  let ordinal=0;

  for(const token of Array.isArray(tokens)?tokens:[]){
    const rowOrdinal=ordinal++;

    if(!isCurrent(token))continue;

    liveCount++;

    const admission=evaluateAdmission(token);

    if(admission?.admitted!==true)continue;

    const mint=String(token?.mint||'').trim();
    if(!mint)continue;

    admittedMints.add(mint);
    admittedCount++;

    recoveryRows.push({
      ...token,
      __mfOrdinalV60:rowOrdinal
    });

    compactRecoveryRows(
      recoveryRows,
      limit
    );
  }

  recoveryRows.sort(recoveryOrder);

  if(recoveryRows.length>limit){
    recoveryRows.length=limit;
  }

  const recoveryTokens=
    recoveryRows.map(row=>{
      const {
        __mfOrdinalV60:_ordinal,
        ...token
      }=row;

      return token;
    });

  return {
    admittedMints,
    recoveryTokens,
    liveCount,
    admittedCount
  };
}
