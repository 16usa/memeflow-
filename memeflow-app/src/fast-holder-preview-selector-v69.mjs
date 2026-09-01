// MEMEFLOW_FAST_HOLDER_PREVIEW_HOTPATH_V69
//
// Exact stable top-K selector for the display-only fast holder preview.
//
// Old visible comparator:
//   lane ASC, score DESC, visible meta.order ASC, stable input tie.
//
// Old fallback comparator:
//   lane ASC, score DESC, activity DESC, stable input tie.
//
// Since the 500ms consumer can use at most K free slots, rows after exact top-K
// are observationally irrelevant to this timer pass.

function compareV69(a,b,visible){
  const ar=a?.rank||{};
  const br=b?.rank||{};

  if(ar.lane!==br.lane){
    return Number(ar.lane||0)-Number(br.lane||0);
  }

  if(ar.score!==br.score){
    return Number(br.score||0)-Number(ar.score||0);
  }

  if(visible){
    if(a.visibleOrder!==b.visibleOrder){
      return a.visibleOrder-b.visibleOrder;
    }
  }else{
    if(a.activityAt!==b.activityAt){
      return b.activityAt-a.activityAt;
    }
  }

  // Native Array#sort is stable. Explicit source order reproduces exact ties.
  return a.order-b.order;
}

function worseV69(a,b,visible){
  return compareV69(a,b,visible)>0;
}

function heapUpV69(heap,index,visible){
  let i=index;

  while(i>0){
    const p=(i-1)>>1;
    if(!worseV69(heap[i],heap[p],visible))break;
    [heap[i],heap[p]]=[heap[p],heap[i]];
    i=p;
  }
}

function heapDownV69(heap,index,visible){
  let i=index;

  for(;;){
    const l=i*2+1;
    const r=l+1;
    let worst=i;

    if(
      l<heap.length &&
      worseV69(heap[l],heap[worst],visible)
    ){
      worst=l;
    }

    if(
      r<heap.length &&
      worseV69(heap[r],heap[worst],visible)
    ){
      worst=r;
    }

    if(worst===i)break;

    [heap[i],heap[worst]]=[heap[worst],heap[i]];
    i=worst;
  }
}

export function selectFastHolderPreviewPrefixV69({
  rows=[],
  limit=3,
  visible=false
}={}){
  const source=Array.isArray(rows)?rows:[];
  const k=Math.max(
    0,
    Math.min(
      source.length,
      Math.floor(Number(limit)||0)
    )
  );

  if(k<=0)return [];

  const heap=[];

  for(const row of source){
    if(heap.length<k){
      heap.push(row);
      heapUpV69(heap,heap.length-1,visible);
      continue;
    }

    if(compareV69(row,heap[0],visible)<0){
      heap[0]=row;
      heapDownV69(heap,0,visible);
    }
  }

  heap.sort((a,b)=>compareV69(a,b,visible));
  return heap;
}
