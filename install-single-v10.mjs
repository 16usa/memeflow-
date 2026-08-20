import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app');
const SERVER=path.join(APP,'app-server.mjs');
const LOCKMOD=path.join(APP,'src','single-instance-lock.mjs');

if(!fs.existsSync(SERVER)){
  console.error('[MEMEFLOW SINGLE V10] Missing '+SERVER);
  process.exit(1);
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(APP,'.single-v10-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});
fs.copyFileSync(SERVER,path.join(backupDir,'app-server.mjs'));
if(fs.existsSync(LOCKMOD)){
  fs.mkdirSync(path.join(backupDir,'src'),{recursive:true});
  fs.copyFileSync(LOCKMOD,path.join(backupDir,'src','single-instance-lock.mjs'));
}

function restore(){
  try{fs.copyFileSync(path.join(backupDir,'app-server.mjs'),SERVER)}catch{}
  try{
    const b=path.join(backupDir,'src','single-instance-lock.mjs');
    if(fs.existsSync(b)){
      fs.copyFileSync(b,LOCKMOD);
    }else if(fs.existsSync(LOCKMOD)){
      fs.unlinkSync(LOCKMOD);
    }
  }catch{}
}

try{
  const lockModule = `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const APP=path.resolve(HERE,'..');
const DATA=path.join(APP,'data');
const LOCK=path.join(DATA,'.app-server-single-instance.lock');

fs.mkdirSync(DATA,{recursive:true});

function processLooksAlive(pid){
  if(!Number.isInteger(pid)||pid<=1)return false;
  try{
    process.kill(pid,0);
    const cmd=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').replace(/\\\\0/g,' ');
    const cwd=fs.readlinkSync('/proc/'+pid+'/cwd');
    return cmd.includes('app-server.mjs') && path.resolve(cwd)===APP;
  }catch{
    return false;
  }
}

function readOwner(){
  try{
    const row=JSON.parse(fs.readFileSync(LOCK,'utf8'));
    return Number(row?.pid)||0;
  }catch{
    return 0;
  }
}

function acquire(){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const fd=fs.openSync(LOCK,'wx',0o600);
      fs.writeFileSync(
        fd,
        JSON.stringify({
          pid:process.pid,
          startedAt:Date.now(),
          cwd:APP
        })+'\\n',
        'utf8'
      );
      fs.closeSync(fd);
      return true;
    }catch(e){
      if(e?.code!=='EEXIST')throw e;

      const owner=readOwner();
      if(processLooksAlive(owner)){
        console.error(
          '[MEMEFLOW SINGLE V10] Duplicate app-server blocked. '+
          'Active PID='+owner+', duplicate PID='+process.pid
        );
        return false;
      }

      try{fs.unlinkSync(LOCK)}catch{}
    }
  }
  throw new Error('could not acquire single-instance lock');
}

const mine=acquire();

if(!mine){
  process.exit(73);
}

function release(){
  try{
    const owner=readOwner();
    if(owner===process.pid)fs.unlinkSync(LOCK);
  }catch{}
}

process.once('exit',release);
process.once('SIGINT',()=>{release();process.exit(130)});
process.once('SIGTERM',()=>{release();process.exit(143)});

console.log('[MEMEFLOW SINGLE V10] Primary app-server PID '+process.pid);
`;

  fs.writeFileSync(LOCKMOD,lockModule,'utf8');

  let server=fs.readFileSync(SERVER,'utf8');
  const importLine=`import './src/single-instance-lock.mjs'; // MEMEFLOW_SINGLE_V10\n`;

  if(!server.includes('MEMEFLOW_SINGLE_V10')){
    server=importLine+server;
    fs.writeFileSync(SERVER,server,'utf8');
  }

  execFileSync(process.execPath,['--check',LOCKMOD],{stdio:'pipe'});
  execFileSync(process.execPath,['--check',SERVER],{stdio:'pipe'});

  const check=fs.readFileSync(SERVER,'utf8');
  if(!check.includes("import './src/single-instance-lock.mjs'; // MEMEFLOW_SINGLE_V10")){
    throw new Error('single-instance import missing after install');
  }

  console.log('');
  console.log('[MEMEFLOW SINGLE V10] INSTALLED OK');
  console.log('[MEMEFLOW SINGLE V10] Only one app-server can initialize scanner/state logic.');
  console.log('[MEMEFLOW SINGLE V10] A simultaneous duplicate exits before MEMEFLOW starts.');
  console.log('[MEMEFLOW SINGLE V10] Stale lock recovery is automatic.');
  console.log('[MEMEFLOW SINGLE V10] Holder/scanner/settings logic was not changed.');
  console.log('[MEMEFLOW SINGLE V10] Backup: '+backupDir);
  console.log('');
}catch(e){
  restore();
  console.error('');
  console.error('[MEMEFLOW SINGLE V10] FAILED — files restored.');
  console.error('[MEMEFLOW SINGLE V10] '+String(e?.message||e));
  console.error('[MEMEFLOW SINGLE V10] Backup: '+backupDir);
  process.exit(1);
}
