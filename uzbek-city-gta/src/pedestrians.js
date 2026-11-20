import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { tryLoadGLB, normalizeModel } from './modelLoader.js';

export class PedestrianManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = [];
    this.personTemplate = null;
    this.walkClip = null;
  }

  async init(count = 20) {
    const gltf = await tryLoadGLB('person.glb');
    if (gltf) {
      this.personTemplate = normalizeModel(gltf.scene, 1.75);
      if (gltf.animations && gltf.animations.length > 0) {
        this.walkClip = gltf.animations[0];
      }
    }

    const streetCoords = [-80, -40, 0, 40, 80];

    for (let i = 0; i < count; i++) {
      let mesh;
      let mixer = null;
      let isProcedural = false;

      if (this.personTemplate) {
        mesh = SkeletonUtils.clone(this.personTemplate);
        if (this.walkClip) {
          mixer = new THREE.AnimationMixer(mesh);
          mixer.clipAction(this.walkClip).play();
        }
      } else {
        mesh = createProceduralPerson(i);
        isProcedural = true;
      }

      // Place along sidewalks
      const roadLine = streetCoords[i % streetCoords.length];
      const sideOffset = (i % 2 === 0 ? 1 : -1) * 7.5;
      const along = -90 + ((i * 23) % 180);

      const horizontal = i % 2 === 0;
      mesh.position.set(
        horizontal ? along : roadLine + sideOffset,
        0,
        horizontal ? roadLine + sideOffset : along
      );

      this.scene.add(mesh);

      this.npcs.push({
        mesh,
        mixer,
        isProcedural,
        dir: i % 2 === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
        speed: 1.6 + (i % 4) * 0.35,
        phase: Math.random() * Math.PI * 2,
        turnTimer: 4 + Math.random() * 6
      });
    }
  }

  update(dt, carPos) {
    for (const npc of this.npcs) {
      npc.turnTimer -= dt;
      if (npc.turnTimer <= 0 || Math.abs(npc.mesh.position.x) > 105 || Math.abs(npc.mesh.position.z) > 105) {
        npc.dir.negate();
        npc.turnTimer = 5 + Math.random() * 7;
      }

      // Avoid getting run over too easily (step aside)
      if (carPos && npc.mesh.position.distanceTo(carPos) < 4.5) {
        const away = npc.mesh.position.clone().sub(carPos).setY(0).normalize();
        npc.mesh.position.addScaledVector(away, dt * 3.5);
      }

      npc.mesh.position.addScaledVector(npc.dir, npc.speed * dt);
      npc.mesh.rotation.y = Math.atan2(npc.dir.x, npc.dir.z);

      if (npc.mixer) {
        npc.mixer.update(dt);
      } else if (npc.isProcedural) {
        npc.phase += dt * 7;
        const swing = Math.sin(npc.phase) * 0.45;
        if (npc.mesh.userData.legL) npc.mesh.userData.legL.rotation.x = swing;
        if (npc.mesh.userData.legR) npc.mesh.userData.legR.rotation.x = -swing;
        if (npc.mesh.userData.armL) npc.mesh.userData.armL.rotation.x = -swing * 0.7;
        if (npc.mesh.userData.armR) npc.mesh.userData.armR.rotation.x = swing * 0.7;
      }
    }
  }
}

export function createProceduralPerson(seed = 0) {
  const colors = [0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad, 0xc0392b, 0x16a085];
  const shirtColor = colors[seed % colors.length];

  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
  head.position.y = 1.56;
  head.castShadow = true;
  group.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.24), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), pantsMat);
  legL.position.set(-0.12, 0.54, 0);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), pantsMat);
  legR.position.set(0.12, 0.54, 0);
  legR.castShadow = true;
  group.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), shirtMat);
  armL.position.set(-0.32, 1.12, 0);
  group.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), shirtMat);
  armR.position.set(0.32, 1.12, 0);
  group.add(armR);

  group.userData = { legL, legR, armL, armR };
  return group;
}
