import fs from 'node:fs';
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
    const cmd=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').replace(/\\0/g,' ');
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
        })+'\n',
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
