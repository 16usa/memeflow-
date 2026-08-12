precision mediump float;varying vec4 v;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float a=smoothstep(.5,.04,d)*v.a;gl_FragColor=vec4(v.rgb,a);}
