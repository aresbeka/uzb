import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function tryLoadGLB(filename) {
  const url = `./models/${filename}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return null;
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        gltf.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        resolve(gltf);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export function normalizeModel(root, targetMaxDimension) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetMaxDimension / maxDim;
  root.scale.multiplyScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaledBox.min.y;

  return root;
}
