import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const FILE=path.join(ROOT,'memeflow-app','app-server.mjs');

if(!fs.existsSync(FILE)){
  console.error('[MEMEFLOW CREATE V4] Missing '+FILE);
  process.exit(1);
}

const src0=fs.readFileSync(FILE,'utf8');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(ROOT,'memeflow-app','.create-v4-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});
const backupFile=path.join(backupDir,'app-server.mjs');
fs.copyFileSync(FILE,backupFile);

function restore(){
  try{fs.copyFileSync(backupFile,FILE)}catch{}
}

function findMatchingBrace(text,openIndex){
  let depth=0, quote=null, esc=false, lineComment=false, blockComment=false;
  for(let i=openIndex;i<text.length;i++){
    const c=text[i], n=text[i+1];

    if(lineComment){
      if(c==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(c==='*'&&n==='/'){blockComment=false;i++}
      continue;
    }
    if(quote){
      if(esc){esc=false;continue}
      if(c==='\\'){esc=true;continue}
      if(c===quote)quote=null;
      continue;
    }

    if(c==='/'&&n==='/'){lineComment=true;i++;continue}
    if(c==='/'&&n==='*'){blockComment=true;i++;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}

    if(c==='{')depth++;
    else if(c==='}'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}

try{
  let src=src0;
  let changes=[];

  // -----------------------------------------------------------------------
  // 1) Mayhem must be excluded 100%, independent of env mistakes.
  // -----------------------------------------------------------------------
  const mayhemRe=/const\s+EXCLUDE_MAYHEM_MODE\s*=\s*process\.env\.EXCLUDE_MAYHEM_MODE\s*!==\s*['"]false['"]\s*;/;
  if(mayhemRe.test(src)){
    src=src.replace(mayhemRe,'const EXCLUDE_MAYHEM_MODE=true; // MEMEFLOW: Mayhem permanently excluded');
    changes.push('Mayhem hard-excluded');
  }else if(/const\s+EXCLUDE_MAYHEM_MODE\s*=\s*true\s*;/.test(src)){
    console.log('[MEMEFLOW CREATE V4] Mayhem already hard-excluded.');
  }else{
    throw new Error('EXCLUDE_MAYHEM_MODE declaration not recognized; refusing blind edit');
  }

  // -----------------------------------------------------------------------
  // 2) Locate the actual Pump create decode call dynamically.
  //    Supports: const result=decodePumpCreate(...), let decoded=...
  // -----------------------------------------------------------------------
  const callRe=/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*decodePumpCreate\s*\(/g;
  let call=null;
  for(const m of src.matchAll(callRe)){
    // Ignore a function definition body; we need a call followed by ".ok".
    const v=m[1];
    const look=src.slice(m.index,m.index+2500);
    if(new RegExp(`if\\s*\\(\\s*${v.replace(/[$]/g,'\\$&')}\\.ok\\s*\\)\\s*\\{`).test(look)){
      call={index:m.index,varName:v};
      break;
    }
  }

  if(!call){
    throw new Error('Pump decode call not found. Current app-server uses an unknown CREATE layout.');
  }

  const v=call.varName.replace(/[$]/g,'\\$&');
  const tail=src.slice(call.index,call.index+5000);
  const okRe=new RegExp(`if\\s*\\(\\s*${v}\\.ok\\s*\\)\\s*\\{`);
  const ok=okRe.exec(tail);
  if(!ok)throw new Error('Pump decode success block not found');

  const okAbs=call.index+ok.index;
  const open=src.indexOf('{',okAbs);
  const close=findMatchingBrace(src,open);
  if(open<0||close<0)throw new Error('Could not safely delimit Pump CREATE success block');

  const varName=call.varName;
  let block=src.slice(open+1,close);
  const beforeBlock=block;

  // Fix only bare "mint" references tied to the creator-link code in this
  // CREATE block. If current code already uses the decoded mint, these are no-ops.
  block=block.replace(
    /__v1224LinkCreator\(\s*mint\s*,\s*__v1223Token\(\s*mint\s*\)\s*\)/g,
    `__v1224LinkCreator(${varName}.mint,__v1223Token(${varName}.mint))`
  );
  block=block.replace(
    /store\.state\?\.tokens\?\.\[\s*mint\s*\]/g,
    `store.state?.tokens?.[${varName}.mint]`
  );
  block=block.replace(
    /eventHolderLedger\.setCreator\(\s*mint\s*,\s*(__creator|creator)\s*\)/g,
    `eventHolderLedger.setCreator(${varName}.mint,$1)`
  );

  // Remove duplicate bootstrap only when the same CREATE block explicitly
  // calls fastPhaseAStart(decoded.mint, ...) and later calls enrich(decoded.mint,...).
  const duplicateRe=new RegExp(
    `\\n\\s*(?:\\/\\/[^\\n]*\\n\\s*)?fastPhaseAStart\\(\\s*${v}\\.mint\\s*,\\s*${v}\\.curve\\s*\\);\\s*\\n(?=[\\s\\S]{0,500}?\\b(?:void\\s+)?enrich\\(\\s*${v}\\.mint\\s*,\\s*${v}\\.curve\\s*\\))`
  );
  if(duplicateRe.test(block)){
    block=block.replace(
      duplicateRe,
      `\n      // enrich() performs the immediate fast bootstrap itself.\n`
    );
    changes.push('duplicate CREATE bootstrap removed');
  }

  if(block!==beforeBlock){
    const creatorBugWasPresent=
      beforeBlock.includes('__v1224LinkCreator(mint,__v1223Token(mint))') ||
      /tokens\?\.\[\s*mint\s*\]/.test(beforeBlock) ||
      /eventHolderLedger\.setCreator\(\s*mint\s*,/.test(beforeBlock);

    if(creatorBugWasPresent)changes.push('CREATE creator mint binding fixed');
    src=src.slice(0,open+1)+block+src.slice(close);
  }else{
    console.log('[MEMEFLOW CREATE V4] CREATE creator/bootstrap path already clean in current Replit build.');
  }

  // -----------------------------------------------------------------------
  // 3) Safety assertions.
  // -----------------------------------------------------------------------
  const postTail=src.slice(call.index,call.index+7000);
  const suspicious=[
    '__v1224LinkCreator(mint,__v1223Token(mint))',
    'eventHolderLedger.setCreator(mint,__creator)'
  ].filter(x=>postTail.includes(x));

  if(suspicious.length){
    throw new Error('unsafe bare mint still present in CREATE region: '+suspicious.join(', '));
  }

  fs.writeFileSync(FILE,src,'utf8');
  execFileSync(process.execPath,['--check',FILE],{stdio:'pipe'});

  console.log('');
  console.log('[MEMEFLOW CREATE V4] INSTALLED OK');
  if(changes.length){
    for(const c of changes)console.log('[MEMEFLOW CREATE V4] '+c+'.');
  }else{
    console.log('[MEMEFLOW CREATE V4] No CREATE bug remained; only verified current path.');
  }
  console.log('[MEMEFLOW CREATE V4] app-server syntax OK.');
  console.log('[MEMEFLOW CREATE V4] Backup: '+backupDir);
  console.log('[MEMEFLOW CREATE V4] UI/settings untouched. Mayhem is permanently excluded.');
  console.log('');
}catch(e){
  restore();
  console.error('');
  console.error('[MEMEFLOW CREATE V4] FAILED — app-server restored.');
  console.error('[MEMEFLOW CREATE V4] '+String(e?.message||e));
  console.error('[MEMEFLOW CREATE V4] Backup: '+backupDir);
  process.exit(1);
}
