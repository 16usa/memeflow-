#!/usr/bin/env node
import fs from'node:fs';import path from'node:path';import{execFileSync}from'node:child_process';
const project=process.cwd(),app=path.join(project,'memeflow-app'),pkg=path.dirname(new URL(import.meta.url).pathname),src=path.join(pkg,'files');
const serverPath=path.join(app,'app-server.mjs'),navPath=path.join(app,'memeflow-nav.js'),pageFiles=['agent-performance.html','agent-performance.css','agent-performance.js'];
for(const p of[serverPath,navPath,...pageFiles.map(x=>path.join(src,x))])if(!fs.existsSync(p)){console.error('Missing '+p);process.exit(1)}
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=path.join(project,'.memeflow-backups','public-agent-performance-v1-'+stamp);fs.mkdirSync(backup,{recursive:true});
const manifest={files:{}};for(const[name,p]of[['app-server.mjs',serverPath],['memeflow-nav.js',navPath],...pageFiles.map(n=>[n,path.join(app,n)])]){const existed=fs.existsSync(p);manifest.files[name]={existed};if(existed)fs.copyFileSync(p,path.join(backup,name))}
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
function restore(){for(const[name,m]of Object.entries(manifest.files)){const dst=name==='app-server.mjs'?serverPath:name==='memeflow-nav.js'?navPath:path.join(app,name),bak=path.join(backup,name);if(m.existed&&fs.existsSync(bak))fs.copyFileSync(bak,dst);else if(!m.existed)fs.rmSync(dst,{force:true})}}
function fail(m,c=2){restore();console.error(m);console.error('Original files restored automatically.');process.exit(c)}
let server=fs.readFileSync(serverPath,'utf8'),nav=fs.readFileSync(navPath,'utf8');
if(!server.includes('MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_ROUTE')){const anchor=' /* MEMEFLOW_PAGE_ACCESS_GATE_V1 */';if(!server.includes(anchor))fail('Public API anchor not found.',3);const route=`
 /* MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_ROUTE */
 if(url.pathname==='/api/platform/performance'&&req.method==='GET'){
   const requested=Number(url.searchParams.get('days')||30);
   const days=[7,30,90].includes(requested)?requested:30;
   const cache=globalThis.__mfPublicAgentPerformanceCacheV1||=new Map();
   const key=String(days),now=Date.now(),cached=cache.get(key);
   if(cached&&now-Number(cached.at||0)<15000)return json(res,200,cached.payload);
   try{
     const dataset=platformAnalytics.summary(days);
     const payload={ok:true,public:true,aggregateOnly:true,dataset,engine:{connected:discovery?.connected===true,subscribed:discovery?.subscribed===true}};
     cache.set(key,{at:now,payload});
     return json(res,200,payload);
   }catch(error){
     return json(res,503,{ok:false,error:'PLATFORM_PERFORMANCE_UNAVAILABLE',message:'Aggregated performance data is temporarily unavailable.'});
   }
 }
`;server=server.replace(anchor,route+anchor)}
if(!nav.includes('MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_NAV')){const old=`    {
      href: '/system-tokens.html',
      title: 'Real-Time Pipeline',
      sub: 'Live token states and decision flow'
    }
  ];`,neu=`    {
      href: '/system-tokens.html',
      title: 'Real-Time Pipeline',
      sub: 'Live token states and decision flow'
    },
    // MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_NAV
    {
      href: '/agent-performance.html',
      title: 'Agent Performance',
      sub: 'Public platform results and outcome analytics'
    }
  ];`;if(!nav.includes(old))fail('Navigation anchor not found.',4);nav=nav.replace(old,neu)}
fs.writeFileSync(serverPath,server);fs.writeFileSync(navPath,nav);for(const n of pageFiles)fs.copyFileSync(path.join(src,n),path.join(app,n));
try{for(const p of[serverPath,navPath,path.join(app,'agent-performance.js')])execFileSync(process.execPath,['--check',p],{stdio:'inherit'})}catch{fail('Syntax verification failed.',5)}
for(const[p,m]of[[serverPath,'MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_ROUTE'],[navPath,'MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1_NAV'],[path.join(app,'agent-performance.html'),'MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1']])if(!fs.readFileSync(p,'utf8').includes(m))fail('Verification failed: '+m,6);
console.log('\\nMEMEFLOW PUBLIC AGENT PERFORMANCE V1 installed successfully.');console.log('Backup: '+backup);console.log('Public page: /agent-performance.html');console.log('Public API: /api/platform/performance?days=30');console.log('Trading logic/settings/risk/execution were not modified.');console.log('\\nNext: Stop -> Run -> test page -> Redeploy.');
