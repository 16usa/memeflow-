import * as THREE from '/vendor/three.module.js';

import {
  createPepeRealRigV2
} from '/character-real-rig-v2.js?v=handslegs6';

export function createPepeSkeletonV7({
  parent,
  baseUrl = '/game-assets/character/'
} = {}) {

  if (!parent) {
    throw new Error('[PEPE V7] parent required');
  }

  const base = createPepeRealRigV2({
    parent,
    baseUrl
  });

  const root = base.root;
  const parts = base.parts;

  const UNIT = 4 / 1000;

  const X = px => (px - 500) * UNIT;
  const Y = py => (500 - py) * UNIT;

  const joints = {};

  const state = {
    direction: 0,
    speed: 0,
    thrust: 0,

    d: 0,
    s: 0,
    t: 0
  };


  function makeJoint(name, x, y) {

    const joint = new THREE.Group();

    joint.name = name;

    joint.position.set(
      X(x),
      Y(y),
      0
    );

    root.add(joint);

    joints[name] = joint;

    return joint;
  }


  function attachKeepWorld(parentObject, child) {

    root.updateMatrixWorld(true);
    parentObject.updateMatrixWorld(true);

    parentObject.attach(child);

    root.updateMatrixWorld(true);
  }


  const ready = base.ready.then(() => {

    /*
      Сначала фиксируем финальную
      статическую сборку V4.
    */

    parts.armLeft.mesh.position.x += 18 * UNIT;
    parts.armLeft.mesh.position.y += 5 * UNIT;

    parts.armRight.mesh.position.x -= 18 * UNIT;
    parts.armRight.mesh.position.y += 5 * UNIT;


    /*
      Чуть сильнее поднимаем кисти,
      чтобы закрыть чёрные wrist sockets.
    */

    parts.handLeft.mesh.position.x += 25 * UNIT;
    parts.handLeft.mesh.position.y += 138 * UNIT;
    parts.handLeft.mesh.scale.setScalar(1.22);

    parts.handRight.mesh.position.x -= 25 * UNIT;
    parts.handRight.mesh.position.y += 138 * UNIT;
    parts.handRight.mesh.scale.setScalar(1.22);


    /*
      Correct render order.
    */

    parts.legLeft.mesh.renderOrder = 1;
    parts.legRight.mesh.renderOrder = 2;

    parts.armLeft.mesh.renderOrder = 5;
    parts.armRight.mesh.renderOrder = 6;

    parts.body.mesh.renderOrder = 10;

    parts.handLeft.mesh.renderOrder = 20;
    parts.handRight.mesh.renderOrder = 21;

    parts.head.mesh.renderOrder = 40;


    /*
      ===== HEAD JOINT =====
    */

    const head =
      makeJoint(
        'headJoint',
        500,
        450
      );

    attachKeepWorld(
      head,
      parts.head.mesh
    );


    /*
      ===== SHOULDERS =====
    */

    const shoulderLeft =
      makeJoint(
        'shoulderLeft',
        410,
        478
      );

    const shoulderRight =
      makeJoint(
        'shoulderRight',
        590,
        478
      );

    attachKeepWorld(
      shoulderLeft,
      parts.armLeft.mesh
    );

    attachKeepWorld(
      shoulderRight,
      parts.armRight.mesh
    );


    /*
      ===== WRISTS =====

      Wrist становится дочерним
      объектом соответствующего плеча.

      Поэтому когда двигается рука,
      кисть автоматически следует за ней.
    */

    const wristLeft =
      makeJoint(
        'wristLeft',
        365,
        615
      );

    const wristRight =
      makeJoint(
        'wristRight',
        635,
        615
      );

    attachKeepWorld(
      wristLeft,
      parts.handLeft.mesh
    );

    attachKeepWorld(
      wristRight,
      parts.handRight.mesh
    );

    attachKeepWorld(
      shoulderLeft,
      wristLeft
    );

    attachKeepWorld(
      shoulderRight,
      wristRight
    );


    /*
      ===== HIPS =====
    */

    const hipLeft =
      makeJoint(
        'hipLeft',
        450,
        635
      );

    const hipRight =
      makeJoint(
        'hipRight',
        550,
        635
      );

    attachKeepWorld(
      hipLeft,
      parts.legLeft.mesh
    );

    attachKeepWorld(
      hipRight,
      parts.legRight.mesh
    );


    root.updateMatrixWorld(true);

    console.log(
      '[PEPE V7] SKELETON READY'
    );

    return true;
  });


  function setMarket({
    direction = 0,
    speed = 0,
    thrust = 0
  } = {}) {

    state.direction =
      THREE.MathUtils.clamp(
        direction,
        -1,
        1
      );

    state.speed =
      THREE.MathUtils.clamp(
        speed,
        0,
        1
      );

    state.thrust =
      THREE.MathUtils.clamp(
        thrust,
        0,
        1
      );
  }


  function update(t, dt = 1 / 60) {

    if (!joints.headJoint) return;

    const smoothing =
      1 - Math.exp(-dt * 5);

    state.d =
      THREE.MathUtils.lerp(
        state.d,
        state.direction,
        smoothing
      );

    state.s =
      THREE.MathUtils.lerp(
        state.s,
        state.speed,
        smoothing
      );

    state.t =
      THREE.MathUtils.lerp(
        state.t,
        state.thrust,
        smoothing
      );


    const dir = state.d;
    const speed = state.s;
    const thrust = state.t;


    /*
      ===== WHOLE BODY =====
    */

    root.position.y =
      -0.05 +
      Math.sin(
        t * (1.4 + speed * 1.4)
      ) *
      (
        0.010 +
        thrust * 0.026
      );


    root.rotation.z =
      Math.sin(t * 1.15) *
      (
        0.005 +
        speed * 0.012
      );


    /*
      ===== HEAD =====

      Пока это 2.5D tilt.
      Настоящий поворот лица
      подключим следующим этапом.
    */

    joints.headJoint.rotation.z =
      Math.sin(t * 1.25) *
      (
        0.018 +
        speed * 0.018
      )
      -
      dir * 0.016;

    joints.headJoint.position.x =
      Math.sin(t * 0.8) * 0.012;


    /*
      ===== SHOULDERS =====
    */

    const armWave =
      Math.sin(
        t *
        (
          1.7 +
          speed * 2.2
        )
      );

    const armAmount =
      0.025 +
      thrust * 0.070;


    joints.shoulderLeft.rotation.z =
      armWave *
      armAmount;

    joints.shoulderRight.rotation.z =
      -armWave *
      armAmount;


    /*
      ===== WRISTS =====

      Кисти чуть компенсируют
      движение рук.
    */

    joints.wristLeft.rotation.z =
      -armWave *
      armAmount *
      0.45;

    joints.wristRight.rotation.z =
      armWave *
      armAmount *
      0.45;


    /*
      ===== LEGS =====
    */

    const legWave =
      Math.sin(
        t *
        (
          1.9 +
          speed * 2.8
        ) +
        0.7
      );

    const legAmount =
      0.012 +
      thrust * 0.040;


    joints.hipLeft.rotation.z =
      legWave *
      legAmount;

    joints.hipRight.rotation.z =
      -legWave *
      legAmount;


    /*
      Небольшая реакция тела
      на ускорение.
    */

    parts.body.mesh.scale.y =
      1 +
      Math.sin(t * 2.1) *
      (
        0.002 +
        thrust * 0.005
      );
  }


  function destroy() {
    base.destroy();
  }


  return {
    root,
    parts,
    joints,
    state,

    ready,
    setMarket,
    update,
    destroy
  };
}
