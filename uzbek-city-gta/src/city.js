import * as THREE from 'three';
import { tryLoadGLB, normalizeModel } from './modelLoader.js';

export async function buildUzbekCity(scene, onProgress) {
  const colliders = []; // { minX, maxX, minZ, maxZ }

  // 1. Ground & Asphalt Base
  const groundGeo = new THREE.PlaneGeometry(700, 700);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3b4d3b, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 2. Streets (.glb or Procedural Road Grid)
  onProgress('Ko\'chalar yuklanmoqda...');
  const streetsGltf = await tryLoadGLB('streets.glb');
  if (streetsGltf) {
    const streets = normalizeModel(streetsGltf.scene, 240);
    streets.position.y = 0.02;
    scene.add(streets);
  } else {
    buildProceduralStreets(scene);
  }

  // 3. Registan Landmark (.glb or Procedural)
  onProgress('Registon maydoni qo\'shilmoqda...');
  const registanGltf = await tryLoadGLB('registan.glb');
  if (registanGltf) {
    const registan = normalizeModel(registanGltf.scene, 55);
    registan.position.set(0, 0, -68);
    scene.add(registan);
    colliders.push({ minX: -26, maxX: 26, minZ: -92, maxZ: -48 });
  } else {
    buildProceduralRegistan(scene, 0, -68, colliders);
  }

  // 4. Tashkent TV Tower (.glb or Procedural)
  onProgress('Toshkent Teleminorasi o\'rnatilmoqda...');
  const towerGltf = await tryLoadGLB('tv_tower.glb');
  if (towerGltf) {
    const tower = normalizeModel(towerGltf.scene, 110);
    tower.position.set(70, 0, 62);
    scene.add(tower);
    colliders.push({ minX: 60, maxX: 80, minZ: 52, maxZ: 72 });
  } else {
    buildProceduralTVTower(scene, 70, 62, colliders);
  }

  // 5. City Buildings & Trees
  onProgress('Shahardagi binolar qurilmoqda...');
  buildCityBlocks(scene, colliders);

  // 6. Surrounding Mountains (.glb or 360-degree Mountain Ring)
  onProgress('Tog\'lar bilan o\'ralmoqda...');
  const mountainsGltf = await tryLoadGLB('mountains.glb');
  if (mountainsGltf) {
    const mountains = normalizeModel(mountainsGltf.scene, 560);
    scene.add(mountains);
  } else {
    buildProceduralMountains(scene);
  }

  return { colliders };
}

function buildProceduralStreets(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.85 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1f2f6 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 });

  const roadPositions = [-80, -40, 0, 40, 80];
  const roadLength = 340;
  const roadWidth = 12;

  // Horizontal & vertical roads
  for (const pos of roadPositions) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.03, pos);
    hRoad.receiveShadow = true;
    scene.add(hRoad);

    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadLength), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(pos, 0.035, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);

    // Dashed center lines
    for (let d = -roadLength / 2 + 8; d < roadLength / 2; d += 12) {
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.35), lineMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d, 0.045, pos);
      scene.add(dashH);

      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(pos, 0.045, d);
      scene.add(dashV);
    }
  }

  // Sidewalk pads inside blocks
  for (let bx = -60; bx <= 60; bx += 40) {
    for (let bz = -60; bz <= 60; bz += 40) {
      if (bx === 0 && bz === -60) continue; // Registan plaza
      const pad = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 26), sidewalkMat);
      pad.position.set(bx, 0.08, bz);
      pad.receiveShadow = true;
      scene.add(pad);
    }
  }
}

function buildProceduralRegistan(scene, cx, cz, colliders) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c39e, roughness: 0.85 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x168aad, roughness: 0.35, metalness: 0.2 });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.9 });

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(52, 0.2, 40), plazaMat);
  plaza.position.y = 0.1;
  plaza.receiveShadow = true;
  group.add(plaza);

  // Main Madrasah facade
  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 10), sandMat);
  mainWall.position.set(0, 7, -14);
  mainWall.castShadow = true;
  group.add(mainWall);

  const portal = new THREE.Mesh(new THREE.BoxGeometry(12, 17, 11), sandMat);
  portal.position.set(0, 8.5, -13.5);
  portal.castShadow = true;
  group.add(portal);

  // Blue domes & minarets
  for (const x of [-11, 11]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), domeMat);
    dome.position.set(x, 15.5, -14);
    group.add(dome);

    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 22, 12), sandMat);
    minaret.position.set(x * 1.45, 11, -10);
    minaret.castShadow = true;
    group.add(minaret);
  }

  scene.add(group);
  colliders.push({ minX: cx - 18, maxX: cx + 18, minZ: cz - 20, maxZ: cz - 8 });
}

function buildProceduralTVTower(scene, cx, cz, colliders) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdbe2e8, metalness: 0.5, roughness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.4 });

  // Tripod legs
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 42, 8), steelMat);
    leg.position.set(Math.cos(angle) * 4.5, 20, Math.sin(angle) * 4.5);
    leg.rotation.z = Math.cos(angle) * 0.16;
    leg.rotation.x = -Math.sin(angle) * 0.16;
    leg.castShadow = true;
    group.add(leg);
  }

  // Main shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.2, 85, 12), steelMat);
  shaft.position.y = 42.5;
  shaft.castShadow = true;
  group.add(shaft);

  // Observation deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.2, 6, 16), accentMat);
  deck.position.y = 58;
  group.add(deck);

  // Spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.9, 32, 8), steelMat);
  spire.position.y = 98;
  group.add(spire);

  scene.add(group);
  colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 6, maxZ: cz + 6 });
}

function buildCityBlocks(scene, colliders) {
  const buildingColors = [0x95a5a6, 0x7f8c8d, 0xbdc3c7, 0xd4ac0d, 0x546e7a, 0x8d6e63];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });

  const blockCenters = [];
  for (let x = -60; x <= 60; x += 40) {
    for (let z = -60; z <= 60; z += 40) {
      if ((x === 0 && z === -60) || (x === 60 && z === 60) || (x === 0 && z === 0)) continue;
      blockCenters.push([x, z]);
    }
  }

  blockCenters.forEach(([bx, bz], idx) => {
    const w = 14 + (idx % 3) * 2;
    const d = 14 + ((idx + 1) % 3) * 2;
    const h = 12 + (idx % 5) * 6;
    const color = buildingColors[idx % buildingColors.length];

    const bldg = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );
    bldg.position.set(bx, h / 2, bz);
    bldg.castShadow = true;
    bldg.receiveShadow = true;
    scene.add(bldg);

    colliders.push({
      minX: bx - w / 2,
      maxX: bx + w / 2,
      minZ: bz - d / 2,
      maxZ: bz + d / 2
    });

    // Add a corner tree
    const tx = bx + w / 2 + 2.5;
    const tz = bz + d / 2 + 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 6), trunkMat);
    trunk.position.set(tx, 1.25, tz);
    scene.add(trunk);

    const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7), leafMat);
    leaves.position.set(tx, 3.4, tz);
    leaves.castShadow = true;
    scene.add(leaves);
  });
}

function buildProceduralMountains(scene) {
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c6b73, roughness: 0.95, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef5f9, roughness: 0.8, flatShading: true });

  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 235 + (i % 3) * 25;
    const height = 48 + (i % 4) * 18;
    const baseR = 34 + (i % 3) * 10;

    const mountain = new THREE.Mesh(new THREE.ConeGeometry(baseR, height, 6), rockMat);
    mountain.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius);
    mountain.rotation.y = i * 0.7;
    scene.add(mountain);

    // Snow cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(baseR * 0.36, height * 0.36, 6), snowMat);
    cap.position.set(
      mountain.position.x,
      height * 0.82 - 1,
      mountain.position.z
    );
    cap.rotation.y = mountain.rotation.y;
    scene.add(cap);
  }
}
