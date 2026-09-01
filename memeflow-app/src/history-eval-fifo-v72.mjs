// MEMEFLOW_HISTORY_EVAL_QUEUE_HOTPATH_V72
//
// FIFO with the same push()/shift()/clear() surface needed by the historical
// evaluation worker. A head cursor avoids Array#shift() O(n) relocation.
// Compaction is occasional and bounded by consumed-prefix size.

export function createHistoryEvalFifoV72({
  compactMin=1024
}={}){
  let rows=[];
  let head=0;

  const min=Math.max(
    1,
    Math.floor(Number(compactMin)||1024)
  );

  const compactIfUseful=()=>{
    if(
      head>=min &&
      head*2>=rows.length
    ){
      rows=rows.slice(head);
      head=0;
    }
  };

  return {
    push(value){
      rows.push(value);
      return rows.length-head;
    },

    shift(){
      if(head>=rows.length){
        if(head!==0||rows.length!==0){
          rows=[];
          head=0;
        }
        return undefined;
      }

      const value=rows[head];
      rows[head]=undefined;
      head++;

      if(head>=rows.length){
        rows=[];
        head=0;
      }else{
        compactIfUseful();
      }

      return value;
    },

    clear(){
      rows=[];
      head=0;
    },

    get length(){
      return rows.length-head;
    }
  };
}
