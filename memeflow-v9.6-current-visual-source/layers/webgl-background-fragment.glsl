precision highp float;
uniform vec2 R;uniform float T,S,E,Q,L,D;uniform vec2 P;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} 
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);} 
float fb(vec2 p){float v=0.;v+=.52*n(p);p=p*2.03+13.1;v+=.26*n(p);p=p*2.01+7.7;v+=.13*n(p);p=p*2.07+3.2;v+=.065*n(p);return v;}
float st(vec2 uv,float sc,float th,float r){vec2 p=uv*sc;vec2 id=floor(p),g=fract(p)-.5;float q=h(id);float z=smoothstep(r,0.,length(g));return z*step(th,q)*(.35+.65*q);} 
float disc(vec2 uv,vec2 c,float r){return 1.-smoothstep(r,r+.006,length(uv-c));}
void main(){vec2 uv=gl_FragCoord.xy/R;float asp=R.x/R.y;vec2 q=vec2((uv.x-.5)*asp,uv.y-.5);float space=smoothstep(1.45,3.1,S);float deep=smoothstep(3.6,5.2,S);
vec3 top=mix(vec3(.012,.032,.055),vec3(.0015,.003,.014),space);vec3 bot=mix(vec3(.16,.40,.53),vec3(.015,.036,.072),space);vec3 col=mix(bot,top,pow(uv.y,.82));
float neb=fb(q*2.35+vec2(T*.012,-T*.006)+P*.18);float nebMask=smoothstep(.48,.82,neb)*space;col+=nebMask*mix(vec3(.025,.12,.18),vec3(.16,.045,.22),deep)*(.35+.5*E);
vec2 su=uv+P*.018;float drift=T*(.004+.012*E);float a=st(su+vec2(drift*.15,drift),36.,.976,.055);float b=st(su*1.31+vec2(-drift*.35,drift*1.8),64.,.985,.045);float c=st(su*1.83+vec2(drift*.8,drift*3.),92.,.992,.035);float stars=(a*.55+b*.78+c)*(.25+.75*space+.20*Q);col+=stars*vec3(.78,.9,1.);
float ca=(1.-smoothstep(.7,1.7,S));vec2 cp=vec2(uv.x*3.5+T*.012+P.x*.11,uv.y*7.5-T*.008);float cv=fb(cp)+.28*fb(cp*1.7+8.);float band=exp(-pow((uv.y-.20)/.115,2.));float clouds=smoothstep(.64,1.02,cv)*band*ca;col=mix(col,vec3(.72,.84,.88),clouds*.72);
float ea=1.-smoothstep(1.55,3.05,S);vec2 ec=vec2((uv.x-.5)*asp,uv.y+.51);float em=1.-smoothstep(.71,.73,length(ec));vec3 earth=mix(vec3(.045,.11,.17),vec3(.20,.43,.54),smoothstep(.0,.7,uv.y));col=mix(col,earth,em*ea*.96);col+=vec3(.13,.36,.48)*exp(-pow((length(ec)-.72)/.025,2.))*ea*.38;
float moonOn=smoothstep(2.65,3.75,S)*(1.-smoothstep(5.6,6.2,S));vec2 mc=vec2(.78+P.x*.025,.72+P.y*.02);float md=disc(vec2((uv.x-mc.x)*asp*.78+mc.x,uv.y),mc,.095);float msh=disc(vec2((uv.x-(mc.x+.022))*asp*.78+(mc.x+.022),uv.y),vec2(mc.x+.022,mc.y-.014),.092);col=mix(col,vec3(.58,.67,.72),md*moonOn*.72);col*=1.-msh*moonOn*.30;
float planetOn=smoothstep(4.2,5.0,S);vec2 pc=vec2(.10-P.x*.02,.66+P.y*.01);float pd=disc(vec2((uv.x-pc.x)*asp*.82+pc.x,uv.y),pc,.17);col=mix(col,vec3(.08,.22,.37)+vec3(.08,.04,.16)*fb(uv*8.),pd*planetOn*.58);
float horizon=exp(-pow((uv.y-.09)/.06,2.))*(.18+.22*(1.-space));col+=vec3(.10,.42,.58)*horizon;
float lineY=fract((uv.y+T*(.16+.72*E))*54.+uv.x*8.);float lane=step(.982,lineY)*step(.55,h(floor(vec2(uv.x*18.,(uv.y+T*.3)*28.))));col+=vec3(.50,.86,1.)*lane*E*L*.45;
float vign=smoothstep(.55,.98,length(q*vec2(.80,1.05)));col*=1.-vign*(.28+.08*D);col+=vec3(.03,.22,.17)*Q*.10;col=mix(col,vec3(.22,.02,.04),D*.12*vign);
col=pow(max(col,0.),vec3(.92));gl_FragColor=vec4(col,1.);}
