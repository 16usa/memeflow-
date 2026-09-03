#!/usr/bin/env node
import fs from'node:fs';import path from'node:path';import{execFileSync}from'node:child_process';
const project=process.cwd(),app=path.join(project,'memeflow-app'),jsPath=path.join(app,'system.js'),htmlPath=path.join(app,'system.html'),galleryDir=path.join(app,'memeflow-gallery'),pkg=path.dirname(new URL(import.meta.url).pathname),svgSrc=path.join(pkg,'agent-performance.svg'),svgDst=path.join(galleryDir,'agent-performance.svg');
for(const p of[jsPath,htmlPath,svgSrc])if(!fs.existsSync(p)){console.error('Missing '+p);process.exit(1)}
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=path.join(project,'.memeflow-backups','system-overview-agent-performance-v1-'+stamp);fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(jsPath,path.join(backup,'system.js'));fs.copyFileSync(htmlPath,path.join(backup,'system.html'));if(fs.existsSync(svgDst))fs.copyFileSync(svgDst,path.join(backup,'agent-performance.svg'));
let js=fs.readFileSync(jsPath,'utf8'),html=fs.readFileSync(htmlPath,'utf8');
function restore(){fs.copyFileSync(path.join(backup,'system.js'),jsPath);fs.copyFileSync(path.join(backup,'system.html'),htmlPath);const b=path.join(backup,'agent-performance.svg');if(fs.existsSync(b))fs.copyFileSync(b,svgDst);else fs.rmSync(svgDst,{force:true})}
function fail(m,c=2){restore();console.error(m);console.error('Original files restored automatically.');process.exit(c)}
if(!js.includes("title: 'Agent Performance'")){
 const a=`    { title: 'How It Works', image: '/memeflow-gallery/how-it-works.svg?v=how-it-works-carousel-v1', href: '/how-it-works.html', slot: 'hidden' }\n  ];`;
 const b=`    { title: 'How It Works', image: '/memeflow-gallery/how-it-works.svg?v=how-it-works-carousel-v1', href: '/how-it-works.html', slot: 'hidden' },\n    // MEMEFLOW_SYSTEM_OVERVIEW_AGENT_PERFORMANCE_V1\n    { title: 'Agent Performance', image: '/memeflow-gallery/agent-performance.svg?v=agent-performance-gallery-v1', href: '/agent-performance.html', slot: 'hidden' }\n  ];`;
 if(!js.includes(a))fail('Gallery destination anchor not found.',3);js=js.replace(a,b);
}
if(!js.includes("'Agent Performance': {")){
 const a=`    'How It Works': {\n      index: '05 / 05',\n      title: 'HOW IT WORKS',\n      text: 'See how your wallet, Smart Vault and executor work together — from deposit to automated trading and withdrawal.'\n    }\n  };`;
 const b=`    'How It Works': {\n      index: '05 / 06',\n      title: 'HOW IT WORKS',\n      text: 'See how your wallet, Smart Vault and executor work together — from deposit to automated trading and withdrawal.'\n    },\n    'Agent Performance': {\n      index: '06 / 06',\n      title: 'AGENT PERFORMANCE',\n      text: 'Review aggregated platform outcomes, win rate, P&L and the factors that correlate with trading results.'\n    }\n  };`;
 if(!js.includes(a))fail('Caption metadata anchor not found.',4);js=js.replace(a,b);js=js.replace("index: '01 / 05'","index: '01 / 06'").replace("index: '02 / 05'","index: '02 / 06'").replace("index: '03 / 05'","index: '03 / 06'").replace("index: '04 / 05'","index: '04 / 06'");
}
if(!js.includes("href.includes('/agent-performance.html')")){
 const a=`    if (href.includes('/system-tokens.html')) return 'Real-Time Pipeline';\n\n    return title;`;
 const b=`    if (href.includes('/system-tokens.html')) return 'Real-Time Pipeline';\n    if (href.includes('/agent-performance.html')) return 'Agent Performance';\n\n    return title;`;
 if(!js.includes(a))fail('Caption href resolver anchor not found.',5);js=js.replace(a,b);
}
if(!js.includes("'Agent Performance': '/agent-performance.html'")){
 const a=`    'Smart Vault': '/smart-vault.html',\n    'How It Works': '/how-it-works.html'\n  };`;
 const b=`    'Smart Vault': '/smart-vault.html',\n    'How It Works': '/how-it-works.html',\n    'Agent Performance': '/agent-performance.html'\n  };`;
 if(!js.includes(a))fail('Live preview anchor not found.',6);js=js.replace(a,b);
}
html=html.replace('/system.js?v=hover-fix-1788107248','/system.js?v=agent-performance-gallery-v1-20260902');
fs.mkdirSync(galleryDir,{recursive:true});fs.copyFileSync(svgSrc,svgDst);fs.writeFileSync(jsPath,js);fs.writeFileSync(htmlPath,html);
try{execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'})}catch{fail('system.js syntax check failed.',7)}
for(const m of["title: 'Agent Performance'","'Agent Performance': {","'Agent Performance': '/agent-performance.html'","index: '01 / 06'","index: '06 / 06'"])if(!js.includes(m))fail('Verification failed: '+m,8);
console.log('\nMEMEFLOW SYSTEM OVERVIEW AGENT PERFORMANCE V1 installed successfully.');console.log('Backup: '+backup);console.log('Changed: system.js, system.html, memeflow-gallery/agent-performance.svg');console.log('Agent Performance is now slide 06 / 06 and opens /agent-performance.html.');
