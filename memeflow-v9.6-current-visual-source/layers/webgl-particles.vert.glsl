attribute vec2 a;attribute float s;attribute vec4 c;varying vec4 v;void main(){v=c;gl_Position=vec4(a,0.,1.);gl_PointSize=s;}
