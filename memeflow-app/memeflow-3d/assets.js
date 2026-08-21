import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      gltf => resolve(gltf.scene),
      undefined,
      reject
    );
  });
}

export async function loadHardwareAssets() {
  const [standard, core, terminal] = await Promise.all([
    loadGLB('/memeflow-3d/assets/module-standard.glb?v=true-3d-glb-v5'),
    loadGLB('/memeflow-3d/assets/module-core.glb?v=true-3d-glb-v5'),
    loadGLB('/memeflow-3d/assets/module-terminal.glb?v=true-3d-glb-v5')
  ]);

  return {
    standard,
    core,
    terminal
  };
}

export function cloneHardwareAsset(assets, node) {
  const source =
    node.core
      ? assets.core
      : node.decision || node.execution
        ? assets.terminal
        : assets.standard;

  return source.clone(true);
}
