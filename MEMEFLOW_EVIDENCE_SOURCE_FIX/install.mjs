import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'index.html');

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

const backup = `${target}.before-evidence-source-fix`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

const oldLine = ` const ev=$('#pane-evidence');if(ev)ev.innerHTML=has&&c.evidence?\`<div class="data-list">\${Object.entries(c.evidence).map(([k,v])=>\`<div class="data-row"><span>\${k}</span><b>\${v??'—'}</b></div>\`).join('')}</div>\`:'<div class="empty-state production-empty">No evidence available.</div>';`;

if (!html.includes(oldLine)) {
  console.error('INSTALL ABORTED: exact Evidence renderer was not found.');
  console.error('No files were changed.');
  process.exit(1);
}

const newBlock = ` const ev=$('#pane-evidence');if(ev){
  if(has&&c.evidence){
    const evidence={...c.evidence};
    const mint=first(c.mint,c.tokenMint,c.tokenAddress,c.address,evidence.Mint,evidence.mint);
    const source=first(c.source,c.launchSource,c.protocol,evidence.Source,evidence.source,'Unknown');
    const updatedRaw=first(c.updatedAt,c.updated_at,c.evaluatedAt,c.evaluated_at,c.timestamp,evidence['Last updated'],evidence.updatedAt);
    const updatedNum=Number(updatedRaw);
    const updatedDate=updatedRaw?(Number.isFinite(updatedNum)?new Date(updatedNum<1e12?updatedNum*1000:updatedNum):new Date(updatedRaw)):null;
    const validUpdated=updatedDate&&!Number.isNaN(updatedDate.getTime())?updatedDate:null;
    const explicitCompleteness=Number(first(c.dataCompleteness,c.dataPct,c.completeness,evidence['Data completeness']));
    const headerCompleteness=Number(String($('#decisionData')?.textContent||'').match(/\\d{1,3}/)?.[0]);
    const completeness=Number.isFinite(explicitCompleteness)?Math.max(0,Math.min(100,Math.round(explicitCompleteness))):(Number.isFinite(headerCompleteness)?Math.max(0,Math.min(100,headerCompleteness)):null);
    const quality=first(c.dataQuality,c.quality,evidence['Data quality'],Number.isFinite(completeness)?(completeness>=90?'High':completeness>=60?'Partial':'Low'):'Unknown');
    const freshness=validUpdated?(()=>{const sec=Math.max(0,Math.floor((Date.now()-validUpdated.getTime())/1000));return sec<60?\`\${sec}s ago\`:sec<3600?\`\${Math.floor(sec/60)}m ago\`:sec<86400?\`\${Math.floor(sec/3600)}h ago\`:\`\${Math.floor(sec/86400)}d ago\`;})():'Unknown';
    const duplicateLabels=new Set(['price','price (sol)','market cap','market cap (sol)','liquidity','liquidity (sol)','holders','top 10','top-10','top10','developer','developer share','buy pressure','momentum','token age','market activity']);
    const rows=Object.entries(evidence).filter(([k])=>!duplicateLabels.has(String(k).trim().toLowerCase().replace(/\\s+/g,' ')));
    const upsert=(label,value)=>{const i=rows.findIndex(([k])=>String(k).trim().toLowerCase()===label.toLowerCase());if(i>=0)rows[i]=[label,value];else rows.push([label,value]);};
    upsert('Mint',mint||'—');
    upsert('Source',source);
    upsert('Last updated',validUpdated?validUpdated.toLocaleString():'Not provided');
    upsert('Data freshness',freshness);
    upsert('Data quality',quality);
    upsert('Data completeness',Number.isFinite(completeness)?\`\${completeness}%\`:'Unknown');
    if(mint){
      const encoded=encodeURIComponent(mint);
      upsert('Pump.fun',\`<a href="https://pump.fun/coin/\${encoded}" target="_blank" rel="noopener noreferrer">Open</a>\`);
      upsert('DexScreener',\`<a href="https://dexscreener.com/solana/\${encoded}" target="_blank" rel="noopener noreferrer">Open</a>\`);
      upsert('Bubble map',\`<a href="https://app.bubblemaps.io/sol/token/\${encoded}" target="_blank" rel="noopener noreferrer">Open</a>\`);
    }else{
      upsert('Pump.fun','Unavailable');upsert('DexScreener','Unavailable');upsert('Bubble map','Unavailable');
    }
    ev.innerHTML=\`<div class="data-list">\${rows.map(([k,v])=>\`<div class="data-row"><span>\${k}</span><b>\${v??'—'}</b></div>\`).join('')}</div>\`;
  }else{
    ev.innerHTML='<div class="empty-state production-empty">No evidence available.</div>';
  }
}`;

html = html.replace(oldLine, newBlock);
fs.writeFileSync(target, html, 'utf8');

console.log('Installed MEMEFLOW Evidence source fix.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);
console.log('Only the Evidence renderer in index.html was changed.');