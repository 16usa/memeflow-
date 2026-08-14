import * as THREE from '/vendor/three.module.js';
import { createMotionController } from '/motion-controller.js?v=34021';
import { createRocketRideV34 } from '/rocket-ride-v34.js?v=34021';
const stage=document.getElementById('stage'),label=document.getElementById('state'),debug=document.getElementById('debug');
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.set(0,0,10);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);
Object.assign(renderer.domElement.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block'});stage.appendChild(renderer.domElement);
const fitGroup=new THREE.Group();scene.add(fitGroup);const motion=createMotionController({response:5.5});const ride=createRocketRideV34({scene,parent:fitGroup});
const labels={up:'UP · BOOST / HAPPY',idle:'IDLE · CRUISING / LIVE FACE',down:'DOWN · DESCENT / WORRIED'};
function set(mode){const resolved=motion.setMode(mode);label.textContent=labels[resolved];}
document.getElementById('up').onclick=()=>set('up');document.getElementById('idle').onclick=()=>set('idle');document.getElementById('down').onclick=()=>set('down');
let ready=false,lastW=0,lastH=0;
function fitModel(){if(!ready)return;fitGroup.position.set(0,0,0);fitGroup.scale.setScalar(1);ride.resetPoseForFit();const fv=ride.flameRoot.visible;ride.flameRoot.visible=false;fitGroup.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(ride.rocketRoot);ride.flameRoot.visible=fv;if(box.isEmpty())return;const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);const worldW=camera.right-camera.left,worldH=camera.top-camera.bottom;const maxW=worldW*.91,maxH=worldH*.75;let s=Math.min(maxW/Math.max(size.x,.001),maxH/Math.max(size.y,.001));s=THREE.MathUtils.clamp(s,.20,1.18);fitGroup.scale.setScalar(s);fitGroup.position.x=-center.x*s;fitGroup.position.y=-center.y*s+.04;}
function resizeCanvas(){const rect=stage.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));if(w===lastW&&h===lastH)return;lastW=w;lastH=h;renderer.setSize(w,h,false);const aspect=w/h,halfH=2.2;camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();fitModel();debug.textContent=`ROCKET V34 · ${w}×${h}`;}
new ResizeObserver(resizeCanvas).observe(stage);window.addEventListener('resize',resizeCanvas);window.visualViewport?.addEventListener('resize',resizeCanvas);window.visualViewport?.addEventListener('scroll',resizeCanvas);
const clock=new THREE.Clock();let t=0;function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);t+=dt;const state=motion.update(dt);ride.update(t,dt,state);renderer.render(scene,camera);}
ride.ready.then(()=>{ready=true;set('idle');requestAnimationFrame(()=>{resizeCanvas();fitModel();frame();});}).catch(err=>{console.error('[PEPE ROCKET V34]',err);label.textContent='LOAD ERROR';document.body.dataset.error='1';});
