// Central conservative defaults for the real-time scanner.
// Replit Secrets / explicit environment values always win.
const defaults={
  RPC_MIN_INTERVAL_MS:'150',
  RPC_GET_TRANSACTION_MIN_INTERVAL_MS:'200',
  RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS:'500',
  RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS:'500',
  DISCOVERY_MAX_CONCURRENT:'8',
  DISCOVERY_QUEUE_MAX:'1000',
  DISCOVERY_SIGNATURE_MAX_AGE_MS:'300000',
  STORE_MAX_TOKENS:'2000',
  STORE_PERSIST_MAX_TOKENS:'750',
  STORE_TOKEN_MAX_AGE_MS:String(6*60*60_000),
  STORE_TOKEN_SAVE_DELAY_MS:'5000',
  EVENT_HOLDER_MAX_MINTS:'1500',
  EVENT_HOLDER_MAX_AGE_MS:String(6*60*60_000),
  EVENT_HOLDER_SAVE_INTERVAL_MS:'5000',
  EVENT_MARKET_MAX_MINTS:'1500',
  EVENT_MARKET_MAX_AGE_MS:String(6*60*60_000)
};
for(const [key,value] of Object.entries(defaults)){
  if(process.env[key]===undefined||process.env[key]==='')process.env[key]=value;
}
export const runtimeTuning={...defaults};
