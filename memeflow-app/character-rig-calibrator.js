import * as THREE from '/vendor/three.module.js';

import {
  createPepeRealRigV16
} from '/character-real-rig-v16.js?v=32800';


const stage =
  document.getElementById('stage');

const controls =
  document.getElementById('controls');

const status =
  document.getElementById('status');


/* =========================================================
   THREE
   ========================================================= */

const scene =
  new THREE.Scene();


const camera =
  new THREE.OrthographicCamera(
    -2,
    2,
    2,
    -2,
    0.1,
    100
  );


camera.position.set(
  0,
  0,
  10
);


const renderer =
  new THREE.WebGLRenderer({
    alpha:true,
    antialias:true,
    powerPreference:'high-performance'
  });


renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio || 1,
    2
  )
);


renderer.setClearColor(
  0x000000,
  0
);


stage.appendChild(
  renderer.domElement
);


const fitGroup =
  new THREE.Group();


scene.add(
  fitGroup
);


const pepe =
  createPepeRealRigV16({
    parent:fitGroup
  });



/* =========================================================
   VALUES
   ========================================================= */

function defaults(){

  return {

    x:0,

    y:0,

    /*
      Z is a visual depth control.

      -1 = farther
       0 = normal
      +1 = closer
    */
    z:0,

    seat:0,

    rotation:0,

    layer:0,

    scale:1,

    width:1

  };

}


const values = {

  handLeft:
    defaults(),

  handRight:
    defaults()

};


const base = {};


let selectedHand =
  'handLeft';



/* =========================================================
   ALL 8 CONTROLS
   ========================================================= */

const defs = [

  {
    key:'x',
    label:'X · LEFT / RIGHT',

    min:-0.60,
    max:0.60,

    step:0.005,
    digits:3
  },

  {
    key:'y',
    label:'Y · UP / DOWN',

    min:-0.60,
    max:0.60,

    step:0.005,
    digits:3
  },

  {
    key:'z',
    label:'Z · FAR / NEAR',

    min:-1.00,
    max:1.00,

    step:0.01,
    digits:2
  },

  {
    key:'seat',
    label:'IN / OUT',

    min:-0.50,
    max:0.50,

    step:0.005,
    digits:3
  },

  {
    key:'rotation',
    label:'ROTATE',

    min:-180,
    max:180,

    step:1,
    digits:0
  },

  {
    key:'layer',
    label:'LAYER · BACK / FRONT',

    min:-30,
    max:30,

    step:1,
    digits:0
  },

  {
    key:'scale',
    label:'SCALE',

    min:0.40,
    max:1.60,

    step:0.01,
    digits:2
  },

  {
    key:'width',
    label:'WIDTH',

    min:0.40,
    max:1.60,

    step:0.01,
    digits:2
  }

];



/* =========================================================
   UI
   ========================================================= */

function format(
  value,
  def
){

  return Number(
    value
  ).toFixed(
    def.digits
  );

}


function buildControls(){

  controls.innerHTML =
    '';


  const current =
    values[selectedHand];


  for(
    const def of defs
  ){

    const box =
      document.createElement(
        'div'
      );

    box.className =
      'control';


    const top =
      document.createElement(
        'div'
      );

    top.className =
      'control-top';


    const name =
      document.createElement(
        'div'
      );

    name.className =
      'control-name';

    name.textContent =
      def.label;


    const value =
      document.createElement(
        'div'
      );

    value.className =
      'control-value';

    value.textContent =
      format(
        current[def.key],
        def
      );


    top.append(
      name,
      value
    );


    const main =
      document.createElement(
        'div'
      );

    main.className =
      'control-main';


    const minus =
      document.createElement(
        'button'
      );

    minus.className =
      'nudge';

    minus.textContent =
      '−';


    const slider =
      document.createElement(
        'input'
      );

    slider.type =
      'range';

    slider.min =
      def.min;

    slider.max =
      def.max;

    slider.step =
      def.step;

    slider.value =
      current[def.key];


    const plus =
      document.createElement(
        'button'
      );

    plus.className =
      'nudge';

    plus.textContent =
      '+';


    function setValue(
      next
    ){

      next =
        THREE.MathUtils.clamp(

          Number(next),

          Number(def.min),

          Number(def.max)

        );


      values[selectedHand][def.key] =
        next;


      slider.value =
        next;


      value.textContent =
        format(
          next,
          def
        );


      applyHand(
        selectedHand
      );

    }


    slider.oninput =
      () =>
        setValue(
          slider.value
        );


    minus.onclick =
      () =>
        setValue(

          values[selectedHand][def.key] -

          Number(def.step)

        );


    plus.onclick =
      () =>
        setValue(

          values[selectedHand][def.key] +

          Number(def.step)

        );


    main.append(
      minus,
      slider,
      plus
    );


    box.append(
      top,
      main
    );


    controls.appendChild(
      box
    );

  }

}



/* =========================================================
   APPLY HAND
   ========================================================= */

function applyHand(
  name
){

  const part =
    pepe.parts[name];


  const b =
    base[name];


  const v =
    values[name];


  if(
    !part ||
    !b
  ){
    return;
  }


  /* -------------------------------------------------------
     X / Y
     ------------------------------------------------------- */

  part.pivot.position.x =
    b.pivotPosition.x +
    v.x;


  part.pivot.position.y =
    b.pivotPosition.y +
    v.y;



  /* -------------------------------------------------------
     REAL Z VALUE
     ------------------------------------------------------- */

  part.pivot.position.z =
    b.pivotPosition.z +
    v.z * 0.40;



  /* -------------------------------------------------------
     VISUAL Z DEPTH

     Orthographic camera normally makes Z invisible.

     So V8 adds the correct visual depth behaviour:

       Z -1 = farther / smaller
       Z  0 = normal
       Z +1 = closer / larger
     ------------------------------------------------------- */

  const zScale =
    THREE.MathUtils.lerp(

      0.72,

      1.38,

      (v.z + 1) * 0.5

    );



  /* -------------------------------------------------------
     ROTATE
     ------------------------------------------------------- */

  part.pivot.rotation.set(

    0,

    0,

    b.rotation +

    THREE.MathUtils.degToRad(
      v.rotation
    )

  );



  /* -------------------------------------------------------
     SCALE + WIDTH + Z DEPTH
     ------------------------------------------------------- */

  part.pivot.scale.set(

    v.scale *
    v.width *
    zScale,

    v.scale *
    zScale,

    v.scale *
    zScale

  );



  /* -------------------------------------------------------
     RESTORE HAND PNG
     ------------------------------------------------------- */

  part.mesh.position.copy(
    b.meshPosition
  );



  /* -------------------------------------------------------
     IN / OUT OF SLEEVE
     ------------------------------------------------------- */

  part.mesh.position
    .addScaledVector(

      b.seatDirection,

      v.seat

    );



  /* -------------------------------------------------------
     LAYER

     Completely independent from Z.

     - = BACK
     + = FRONT
     ------------------------------------------------------- */

  part.mesh.renderOrder =

    b.renderOrder +

    Math.round(
      v.layer
    );


  if(
    part.mesh.material
  ){

    part.mesh.material.depthTest =
      false;


    part.mesh.material.depthWrite =
      false;


    part.mesh.material.needsUpdate =
      true;

  }


  part.pivot.updateMatrixWorld(
    true
  );

}



/* =========================================================
   SAVE BASE
   ========================================================= */

function saveBase(
  name
){

  const part =
    pepe.parts[name];


  const dir =
    part.mesh.position.clone();


  dir.z =
    0;


  if(
    dir.lengthSq() >
    1e-8
  ){

    dir.normalize();

  }else{

    dir.set(
      0,
      -1,
      0
    );

  }


  base[name] = {

    pivotPosition:
      part.pivot.position.clone(),

    rotation:
      part.pivot.rotation.z,

    meshPosition:
      part.mesh.position.clone(),

    renderOrder:
      part.mesh.renderOrder,

    seatDirection:
      dir

  };

}



/* =========================================================
   SELECT HAND
   ========================================================= */

function selectHand(
  name
){

  selectedHand =
    name;


  document
    .getElementById('left')
    .classList.toggle(
      'active',
      name === 'handLeft'
    );


  document
    .getElementById('right')
    .classList.toggle(
      'active',
      name === 'handRight'
    );


  buildControls();

}


document
  .getElementById('left')
  .onclick =
  () =>
    selectHand(
      'handLeft'
    );


document
  .getElementById('right')
  .onclick =
  () =>
    selectHand(
      'handRight'
    );



/* =========================================================
   RESET
   ========================================================= */

function restore(
  name
){

  values[name] =
    defaults();


  applyHand(
    name
  );

}


document
  .getElementById('resetHand')
  .onclick =
  () => {

    restore(
      selectedHand
    );

    buildControls();

  };


document
  .getElementById('resetAll')
  .onclick =
  () => {

    restore(
      'handLeft'
    );

    restore(
      'handRight'
    );

    buildControls();

  };



/* =========================================================
   COPY
   ========================================================= */

function makeExport(
  name
){

  return {

    x:
      values[name].x,

    y:
      values[name].y,

    z:
      values[name].z,

    inOut:
      values[name].seat,

    rotationDeg:
      values[name].rotation,

    layer:
      values[name].layer,

    finalRenderOrder:
      base[name]
        ? base[name].renderOrder +
          Math.round(
            values[name].layer
          )
        : null,

    scale:
      values[name].scale,

    width:
      values[name].width

  };

}


document
  .getElementById('copy')
  .onclick =
async () => {

  const text =
    JSON.stringify(

      {

        handLeft:
          makeExport(
            'handLeft'
          ),

        handRight:
          makeExport(
            'handRight'
          )

      },

      null,

      2

    );


  try{

    await navigator.clipboard
      .writeText(
        text
      );


    status.textContent =
      'COPIED';


  }catch{

    const ta =
      document.createElement(
        'textarea'
      );


    ta.value =
      text;


    document.body.appendChild(
      ta
    );


    ta.select();


    document.execCommand(
      'copy'
    );


    ta.remove();


    status.textContent =
      'VALUES READY';

  }

};



/* =========================================================
   FIT CHARACTER BIGGER
   ========================================================= */

function fitModel(){

  fitGroup.position.set(
    0,
    0,
    0
  );


  fitGroup.scale.setScalar(
    1
  );


  pepe.root.position.set(
    0,
    0,
    0
  );


  pepe.root.rotation.set(
    0,
    0,
    0
  );


  pepe.root.updateMatrixWorld(
    true
  );


  const box =
    new THREE.Box3()
      .setFromObject(
        fitGroup
      );


  if(
    box.isEmpty()
  ){
    return;
  }


  const size =
    new THREE.Vector3();


  const center =
    new THREE.Vector3();


  box.getSize(
    size
  );


  box.getCenter(
    center
  );


  const worldW =
    camera.right -
    camera.left;


  const worldH =
    camera.top -
    camera.bottom;


  /*
    V7 used approximately 68%.

    V8 makes Pepe much larger.
  */

  let scale =
    Math.min(

      worldW * 0.88 /
      Math.max(
        size.x,
        0.001
      ),

      worldH * 0.94 /
      Math.max(
        size.y,
        0.001
      )

    );


  scale =
    THREE.MathUtils.clamp(
      scale,
      0.20,
      1.45
    );


  fitGroup.scale.setScalar(
    scale
  );


  fitGroup.position.x =
    -center.x *
    scale;


  fitGroup.position.y =
    -center.y *
    scale;

}



/* =========================================================
   RESIZE
   ========================================================= */

function resize(){

  const rect =
    stage.getBoundingClientRect();


  const width =
    Math.max(
      1,
      Math.round(
        rect.width
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        rect.height
      )
    );


  renderer.setSize(
    width,
    height,
    false
  );


  const aspect =
    width /
    height;


  const halfH =
    2.2;


  camera.left =
    -halfH *
    aspect;


  camera.right =
    halfH *
    aspect;


  camera.top =
    halfH;


  camera.bottom =
    -halfH;


  camera.updateProjectionMatrix();


  fitModel();

}



/* =========================================================
   RENDER
   ========================================================= */

function render(){

  requestAnimationFrame(
    render
  );


  renderer.render(
    scene,
    camera
  );

}



/* =========================================================
   READY
   ========================================================= */

pepe.ready
.then(
  () => {

    saveBase(
      'handLeft'
    );


    saveBase(
      'handRight'
    );


    pepe.setMarket({

      direction:0,

      speed:0,

      thrust:0

    });


    selectHand(
      'handLeft'
    );


    resize();


    status.textContent =
      'READY';


    render();

  }
)
.catch(
  err => {

    console.error(
      err
    );


    status.textContent =
      'ERROR';

  }
);


new ResizeObserver(
  resize
).observe(
  stage
);


window.addEventListener(
  'resize',
  resize
);


window.visualViewport
  ?.addEventListener(
    'resize',
    resize
  );
