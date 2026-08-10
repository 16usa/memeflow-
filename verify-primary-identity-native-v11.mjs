import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');

const start=s.indexOf('/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_START */');
const end=s.indexOf('/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_END */',start);
const block=start>=0&&end>start?s.slice(start,end):'';

const checks={
 V11:s.includes('data-mf-primary-layout="native-v11"'),
 avatar:s.includes('id="primaryAvatar"'),
 primaryName:s.includes('id="primaryName"'),
 primaryMeta:s.includes('id="primaryMeta"'),
 primaryScore:s.includes('id="primaryScore"'),
 coreRenderInjection:start>=0,
 imageFields:block.includes('c.imageUrl')&&block.includes('c.image')&&block.includes('c.logoUrl'),
 scoreDrivenAvatar:block.includes('getBoundingClientRect'),
 noV11MutationObserver:!block.includes('MutationObserver'),
 noV11Interval:!block.includes('setInterval'),
 noV11CandidateListener:!block.includes("addEventListener('memeflow:candidatechange'")&&!block.includes('addEventListener("memeflow:candidatechange"'),
 noV11StateListener:!block.includes("addEventListener('memeflow:statechange'"),
 V10Gone:!s.includes('MF_PRIMARY_IDENTITY_STABLE_V10_')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
 console.log(k+'='+(v?'YES':'NO'));
 if(!v)ok=false;
}
process.exit(ok?0:2);
