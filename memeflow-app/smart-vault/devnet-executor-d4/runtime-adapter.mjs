import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SMART_VAULT_ROOT = path.resolve(HERE, "..");
const D3_ENTRY = path.join(SMART_VAULT_ROOT, "devnet-executor-d3", "server-gate.mjs");
const D2_REPORT = path.join(SMART_VAULT_ROOT, "devnet-executor-d2", ".state", "d2-roundtrip-report.json");
const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MAX_PROBE_LAMPORTS = 2_000_000n;

function asLamports(amountSol) {
  const n = Number(amountSol);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error("D4 amountSol must be positive"), { code: "D4_BAD_AMOUNT" });
  const lamports = BigInt(Math.max(1, Math.round(n * 1e9)));
  if (lamports > MAX_PROBE_LAMPORTS) throw Object.assign(new Error("D4 DEVNET probe is capped at 0.002 SOL"), { code: "D4_AMOUNT_CAP" });
  return lamports;
}

function enabled() {
  return process.env.MEMEFLOW_SMART_VAULT_D4_DEVNET === "1" && process.env.MEMEFLOW_SMART_VAULT_D4_CONFIRM === "RUN DEVNET D4";
}

function blocked(args = {}, code = "LIVE_EXECUTION_NOT_READY", message = "Smart Vault D4 is installed but DEVNET probe mode is not enabled.") {
  return { executed:false, devnetExecuted:false, phase:"D4", environment:"devnet", error:code, message, uid:args.uid??null, mint:args.mint??null, side:args.side??null, amountSol:args.amountSol??null, productionAutoLiveUnlocked:false, mainnetDeployment:false };
}

function verifyReport(report, expectedLamports) {
  const errors=[];
  if(report?.ok!==true)errors.push("D2 report not OK");
  if(report?.environment!=="devnet")errors.push("environment is not devnet");
  if(report?.genesis!==DEVNET_GENESIS)errors.push("wrong devnet genesis");
  if(report?.pumpProgramId!==PUMP_PROGRAM)errors.push("wrong Pump program");
  if(report?.ownerSignedTrade!==false)errors.push("owner signed trade");
  if(report?.executorSignedOuterTransactions!==true)errors.push("executor did not sign outer transaction");
  if(report?.vaultPdaSignedPumpCpi!==true)errors.push("Vault PDA did not sign Pump CPI");
  if(report?.productionAutoLiveUnlocked!==false)errors.push("production AUTO LIVE unlocked");
  if(report?.mainnetDeployment!==false)errors.push("mainnet deployment flag changed");
  if(String(report?.tokensBefore)!==String(report?.tokensAfterSell))errors.push("fixture token balance not restored");
  if(!report?.buySignature)errors.push("BUY signature missing");
  if(!report?.sellSignature)errors.push("SELL signature missing");
  if(String(report?.buyTargetLamports)!==String(expectedLamports))errors.push("buy target mismatch");
  if(errors.length)throw Object.assign(new Error("D4 verification failed: "+errors.join("; ")),{code:"D4_VERIFY_FAILED"});
  return report;
}

export function createSmartVaultD4Adapter({logger=console}={}) {
  let running=false;
  return {
    status(){return {phase:"D4",installed:true,enabled:enabled(),environment:"devnet",probeOnly:true,productionAutoLiveUnlocked:false,mainnetDeployment:false};},
    async executeTrade(args={}){
      const uid=String(args.uid??"").trim();
      const mint=String(args.mint??"").trim();
      const side=String(args.side??"").trim().toUpperCase();
      const requestId=crypto.randomUUID();
      if(!enabled())return blocked(args);
      if(args.d4Probe!==true)return blocked(args,"D4_DEVNET_PROBE_ONLY","D4 is wired into executeTrade(), but automatic production execution remains blocked.");
      if(!uid)throw Object.assign(new Error("D4 uid is required"),{code:"D4_UID_REQUIRED"});
      if(!mint)throw Object.assign(new Error("D4 mint is required"),{code:"D4_MINT_REQUIRED"});
      if(side!=="BUY")throw Object.assign(new Error("D4 boundary probe starts with BUY and verifies the complete DEVNET BUY->SELL round-trip"),{code:"D4_BUY_PROBE_ONLY"});
      if(running)return blocked(args,"D4_BUSY","A D4 DEVNET probe is already running.");
      const lamports=asLamports(args.amountSol);
      running=true;
      try{
        logger.log(`[D4 ${requestId}] MEMEFLOW executeTrade boundary accepted (DEVNET probe only)`);
        logger.log(`[D4 ${requestId}] uid=${uid} requestedMint=${mint} side=${side} lamports=${lamports}`);
        let result;
        try{
          result=await execFileAsync(process.execPath,[D3_ENTRY],{cwd:SMART_VAULT_ROOT,env:{...process.env,D3_BUY_LAMPORTS:lamports.toString(),MEMEFLOW_D4_REQUEST_ID:requestId,MEMEFLOW_D4_UID:uid,MEMEFLOW_D4_REQUESTED_MINT:mint,MEMEFLOW_D4_SIDE:side},timeout:240000,maxBuffer:12*1024*1024});
        }catch(error){if(error.stdout)process.stdout.write(error.stdout);if(error.stderr)process.stderr.write(error.stderr);throw error;}
        if(result.stdout)process.stdout.write(result.stdout);
        if(result.stderr)process.stderr.write(result.stderr);
        const report=verifyReport(JSON.parse(await readFile(D2_REPORT,"utf8")),lamports);
        return {executed:false,devnetExecuted:true,phase:"D4",environment:"devnet",mode:"runtime-boundary-roundtrip-probe",requestId,requested:{uid,mint,side,amountSol:Number(args.amountSol),lamports:lamports.toString()},fixture:{executedMint:report.testMint||null,buySignature:report.buySignature,sellSignature:report.sellSignature,tokensBefore:String(report.tokensBefore),tokensAfterBuy:String(report.tokensAfterBuy),tokensAfterSell:String(report.tokensAfterSell)},executorSignedOuterTransactions:true,vaultPdaSignedPumpCpi:true,ownerSignedTrade:false,productionAutoLiveUnlocked:false,mainnetDeployment:false};
      }finally{running=false;}
    }
  };
}
