// MEMEFLOW_SCANNER_CAPACITY_HOTPATH_V68

function evictionTimeV68(token){
  return Number(
    token?.lastMarketActivityAt ??
    token?.lastPriceAt ??
    token?.updatedAt ??
    token?.discoveredAt ??
    0
  );
}

// Old Array#sort is stable. Explicit source order reproduces equal-time ties.
function compareOldestV68(a,b){
  if(a.time!==b.time)return a.time-b.time;
  return a.order-b.order;
}

// Max-heap: root is the worst/newest member currently retained.
function worseV68(a,b){
  return compareOldestV68(a,b)>0;
}

function heapUpV68(heap,index){
  let i=index;
  while(i>0){
    const p=(i-1)>>1;
    if(!worseV68(heap[i],heap[p]))break;
    [heap[i],heap[p]]=[heap[p],heap[i]];
    i=p;
  }
}

function heapDownV68(heap,index){
  let i=index;
  for(;;){
    const l=i*2+1;
    const r=l+1;
    let worst=i;
    if(l<heap.length && worseV68(heap[l],heap[worst]))worst=l;
    if(r<heap.length && worseV68(heap[r],heap[worst]))worst=r;
    if(worst===i)break;
    [heap[i],heap[worst]]=[heap[worst],heap[i]];
    i=worst;
  }
}

export function selectOldestScannerEvictionsV68({
  scannerRows=[],
  openMints=new Set(),
  limit=0
}={}){
  const k=Math.max(0,Math.floor(Number(limit)||0));
  if(k===0)return [];

  const heap=[];
  let order=0;

  for(const token of Array.isArray(scannerRows)?scannerRows:[]){
    const sourceOrder=order++;
    const mint=String(token?.mint||'');
    if(openMints?.has?.(mint))continue;

    const row={
      token,
      time:evictionTimeV68(token),
      order:sourceOrder
    };

    if(heap.length<k){
      heap.push(row);
      heapUpV68(heap,heap.length-1);
      continue;
    }

    // Replace only when this row belongs ahead of the current worst retained
    // row. Equal timestamp/order behavior exactly matches stable old sort.
    if(compareOldestV68(row,heap[0])<0){
      heap[0]=row;
      heapDownV68(heap,0);
    }
  }

  heap.sort(compareOldestV68);
  return heap.map(row=>row.token);
}
