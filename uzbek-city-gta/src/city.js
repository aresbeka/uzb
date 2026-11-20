import * as THREE from 'three';
import { tryLoadGLB, normalizeModel } from './modelLoader.js';

export async function buildUzbekCity(scene, onProgress) {
  const colliders = [];
  const driveableMeshes = [];

  const groundGeo = new THREE.PlaneGeometry(750, 750);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3b4d3b, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  driveableMeshes.push(ground);

  onProgress('Shahar yo\'llari va binolar yuklanmoqda...');
  const buildingSetGltf = await tryLoadGLB('ccity_building_set_1.glb');
  if (buildingSetGltf) {
    const bSet = normalizeModel(buildingSetGltf.scene, 220);
    bSet.position.set(0, 0, 0);
    scene.add(bSet);
    bSet.updateMatrixWorld(true);

    bSet.traverse((obj) => {
      if (!obj.isMesh) return;
      driveableMeshes.push(obj);

      const box = new THREE.Box3().setFromObject(obj);
      const height = box.max.y - box.min.y;
      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;

      if (height > 2.2 && width < 80 && depth < 80) {
        colliders.push({
          minX: box.min.x,
          maxX: box.max.x,
          minZ: box.min.z,
          maxZ: box.max.z
        });
      }
    });
  } else {
    buildProceduralStreets(scene);
    buildCityBlocks(scene, colliders);
  }

  onProgress('Registon maydoni qo\'shilmoqda...');
  const registanGltf =
    (await tryLoadGLB('registan_complex_samarkand_uzbekistan-_drone.glb')) ||
    (await tryLoadGLB('registan.glb'));
  if (registanGltf) {
    const registan = normalizeModel(registanGltf.scene, 55);
    registan.position.set(-115, 0, -40);
    scene.add(registan);
    colliders.push({ minX: -140, maxX: -90, minZ: -65, maxZ: -15 });
  } else {
    buildProceduralRegistan(scene, -115, -40, colliders);
  }

  onProgress('Toshkent Teleminorasi o\'rnatilmoqda...');
  const towerGltf =
    (await tryLoadGLB('tashkent_tv_tower.glb')) ||
    (await tryLoadGLB('tv_tower.glb'));
  if (towerGltf) {
    const tower = normalizeModel(towerGltf.scene, 110);
    tower.position.set(115, 0, 35);
    scene.add(tower);
    colliders.push({ minX: 105, maxX: 125, minZ: 25, maxZ: 45 });
  } else {
    buildProceduralTVTower(scene, 115, 35, colliders);
  }

  onProgress('Tog\'lar bilan o\'ralmoqda...');
  const mountainsGltf = await tryLoadGLB('mountains.glb');
  if (mountainsGltf) {
    const mountains = normalizeModel(mountainsGltf.scene, 580);
    scene.add(mountains);
  } else {
    buildProceduralMountains(scene);
  }

  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();

  function getGroundHeight(x, z) {
    origin.set(x, 12, z);
    raycaster.set(origin, down);
    const hits = raycaster.intersectObjects(driveableMeshes, true);
    for (const h of hits) {
      if (h.point.y <= 2.2) return h.point.y;
    }
    return 0;
  }

  return { colliders, getGroundHeight };
}

function buildProceduralStreets(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.85 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1f2f6 });
  for (const pos of [-80, -40, 0, 40, 80]) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(340, 12), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.03, pos);
    scene.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 340), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(pos, 0.035, 0);
    scene.add(vRoad);
    for (let d = -162; d < 170; d += 12) {
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.35), lineMat);
      dashH.rotation.x = -Math.PI / 2; dashH.position.set(d, 0.045, pos); scene.add(dashH);
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5), lineMat);
      dashV.rotation.x = -Math.PI / 2; dashV.position.set(pos, 0.045, d); scene.add(dashV);
    }
  }
}

function buildProceduralRegistan(scene, cx, cz, colliders) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c39e, roughness: 0.85 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x168aad, roughness: 0.35 });
  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 10), sandMat);
  mainWall.position.set(0, 7, -14); group.add(mainWall);
  const portal = new THREE.Mesh(new THREE.BoxGeometry(12, 17, 11), sandMat);
  portal.position.set(0, 8.5, -13.5); group.add(portal);
  for (const x of [-11, 11]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), domeMat);
    dome.position.set(x, 15.5, -14); group.add(dome);
  }
  scene.add(group);
  colliders.push({ minX: cx - 18, maxX: cx + 18, minZ: cz - 20, maxZ: cz - 8 });
}

function buildProceduralTVTower(scene, cx, cz, colliders) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdbe2e8, metalness: 0.5 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.2, 85, 12), steelMat);
  shaft.position.y = 42.5; group.add(shaft);
  scene.add(group);
  colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 6, maxZ: cz + 6 });
}

function buildCityBlocks(scene, colliders) {
  const colors = [0x95a5a6, 0x7f8c8d, 0xbdc3c7, 0xd4ac0d];
  let idx = 0;
  for (let x = -60; x <= 60; x += 40) {
    for (let z = -60; z <= 60; z += 40) {
      if (x === 0 && z === 0) continue;
      const h = 14 + (idx % 4) * 6;
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), new THREE.MeshStandardMaterial({ color: colors[idx % 4] }));
      bldg.position.set(x, h / 2, z); scene.add(bldg);
      colliders.push({ minX: x - 8, maxX: x + 8, minZ: z - 8, maxZ: z + 8 });
      idx++;
    }
  }
}

function buildProceduralMountains(scene) {
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c6b73, roughness: 0.95, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef5f9, roughness: 0.8, flatShading: true });
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const radius = 250 + (i % 3) * 25;
    const height = 48 + (i % 4) * 18;
    const baseR = 34 + (i % 3) * 10;
    const m = new THREE.Mesh(new THREE.ConeGeometry(baseR, height, 6), rockMat);
    m.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius);
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(baseR * 0.36, height * 0.36, 6), snowMat);
    cap.position.set(m.position.x, height * 0.82 - 1, m.position.z);
    scene.add(cap);
  }
}
