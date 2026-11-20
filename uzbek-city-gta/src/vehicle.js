import * as THREE from 'three';
import { tryLoadGLB, normalizeModel } from './modelLoader.js';

export class CarController {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.currentType = 'gentra';
    this.models = {};
    this.paintMaterials = [];
    this.deformableMeshes = [];
    this.wheels = { fl: null, fr: null, rl: null, rr: null };
    this.steeringWheel = null;
    this.frontPlateMesh = null;
    this.rearPlateMesh = null;

    this.speed = 0;
    this.steerAngle = 0;
    this.health = 100;
    this.colorHex = '#ffffff';
    this.plateRegion = '01';
    this.plateCode = 'A 777 AA';
  }

  async init() {
    this.models.gentra = await this.loadOrBuildCar('gentra.glb', 'gentra');
    this.models.cobalt = await this.loadOrBuildCar('chevrolet_cobalt_ltz.glb', 'cobalt');
    this.models.nexia2 = await this.loadOrBuildCar('daewoo_nexia_2.glb', 'nexia2');
    this.models.damas = await this.loadOrBuildCar('chevrolet_damas.glb', 'damas');
    this.switchCar('gentra');
  }

  async loadOrBuildCar(filename, type) {
    const gltf = await tryLoadGLB(filename);
    if (gltf) return normalizeModel(gltf.scene, type === 'damas' ? 3.8 : 4.5);
    return this.buildProceduralCar(type);
  }

  buildProceduralCar(type) {
    const group = new THREE.Group();
    const isDamas = type === 'damas';
    const bodyMat = new THREE.MeshStandardMaterial({ name: 'Car_Body_Paint', color: 0xffffff, roughness: 0.3, metalness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ name: 'Glass', color: 0x1a2634, transparent: true, opacity: 0.78 });
    const wheelMat = new THREE.MeshStandardMaterial({ name: 'Tire', color: 0x1e1e1e, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ name: 'Rim', color: 0xcfd8dc, metalness: 0.7 });

    const bodyW = isDamas ? 1.55 : 1.85;
    const bodyH = isDamas ? 1.15 : 0.72;
    const bodyL = isDamas ? 3.55 : 4.4;

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL, 6, 4, 8), bodyMat);
    lowerBody.position.y = 0.65 + (isDamas ? 0.2 : 0);
    lowerBody.castShadow = true;
    group.add(lowerBody);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.88, isDamas ? 0.65 : 0.62, isDamas ? 2.9 : 2.15), glassMat);
    cabin.position.set(0, lowerBody.position.y + bodyH / 2 + 0.25, -0.1);
    group.add(cabin);

    const wheelRadius = isDamas ? 0.32 : 0.36;
    const wheelPos = [
      { name: 'Wheel_FL', x: -bodyW / 2 - 0.04, z: bodyL * 0.32 },
      { name: 'Wheel_FR', x: bodyW / 2 + 0.04, z: bodyL * 0.32 },
      { name: 'Wheel_RL', x: -bodyW / 2 - 0.04, z: -bodyL * 0.32 },
      { name: 'Wheel_RR', x: bodyW / 2 + 0.04, z: -bodyL * 0.32 }
    ];
    for (const wp of wheelPos) {
      const pivot = new THREE.Group();
      pivot.name = wp.name;
      pivot.position.set(wp.x, wheelRadius, wp.z);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 16), wheelMat);
      tire.rotation.z = Math.PI / 2; pivot.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, 0.25, 10), rimMat);
      rim.rotation.z = Math.PI / 2; pivot.add(rim);
      group.add(pivot);
    }
    return group;
  }

  switchCar(type) {
    if (!this.models[type]) return;
    this.currentType = type;
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]);
    const carModel = this.models[type];
    this.root.add(carModel);
    this.scanCarParts(carModel);
    this.attachLicensePlates(carModel);
    this.setColor(this.colorHex);
    this.setLicensePlate(this.plateRegion, this.plateCode);
  }

  scanCarParts(carModel) {
    this.paintMaterials = [];
    this.deformableMeshes = [];
    this.wheels = { fl: null, fr: null, rl: null, rr: null };
    this.steeringWheel = null;
    const seen = new Set();

    carModel.traverse((obj) => {
      const n = (obj.name || '').toLowerCase();
      if (n.includes('wheel_fl') || n.includes('front_left')) this.wheels.fl = obj;
      else if (n.includes('wheel_fr') || n.includes('front_right')) this.wheels.fr = obj;
      else if (n.includes('wheel_rl') || n.includes('rear_left')) this.wheels.rl = obj;
      else if (n.includes('wheel_rr') || n.includes('rear_right')) this.wheels.rr = obj;
      else if (n.includes('steering') || n.includes('rul')) this.steeringWheel = obj;

      if (obj.isMesh) {
        if (obj.geometry?.attributes?.position) {
          if (!obj.userData.origPos) obj.userData.origPos = obj.geometry.attributes.position.array.slice();
          if (!n.includes('wheel') && !n.includes('tire') && !n.includes('glass')) this.deformableMeshes.push(obj);
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m || seen.has(m)) continue;
          seen.add(m);
          const mn = (m.name || '').toLowerCase();
          if (!['glass', 'window', 'tire', 'wheel', 'rubber', 'light', 'chrome', 'rim', 'black'].some((k) => mn.includes(k)) && m.color) {
            this.paintMaterials.push(m);
          }
        }
      }
    });
  }

  attachLicensePlates(carModel) {
    if (this.frontPlateMesh) this.root.remove(this.frontPlateMesh);
    if (this.rearPlateMesh) this.root.remove(this.rearPlateMesh);
    const box = new THREE.Box3().setFromObject(carModel);
    const plateGeo = new THREE.PlaneGeometry(0.62, 0.15);
    const plateMat = new THREE.MeshBasicMaterial({ map: this.createPlateTexture(this.plateRegion, this.plateCode) });

    this.frontPlateMesh = new THREE.Mesh(plateGeo, plateMat);
    this.frontPlateMesh.position.set(0, 0.44, box.max.z - this.root.position.z + 0.03);
    this.root.add(this.frontPlateMesh);

    this.rearPlateMesh = new THREE.Mesh(plateGeo, plateMat);
    this.rearPlateMesh.position.set(0, 0.52, box.min.z - this.root.position.z - 0.03);
    this.rearPlateMesh.rotation.y = Math.PI;
    this.root.add(this.rearPlateMesh);
  }

  createPlateTexture(region, code) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 504, 120);
    ctx.fillStyle = '#111'; ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(region.toUpperCase(), 55, 66);
    ctx.font = 'bold 68px Arial'; ctx.fillText(code.toUpperCase(), 280, 66);
    ctx.fillStyle = '#0099b5'; ctx.fillRect(452, 14, 46, 26);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(452, 40, 46, 26);
    ctx.fillStyle = '#1eb53a'; ctx.fillRect(452, 66, 46, 26);
    ctx.fillStyle = '#111'; ctx.font = 'bold 22px Arial'; ctx.fillText('UZ', 475, 108);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setColor(hex) {
    this.colorHex = hex;
    for (const mat of this.paintMaterials) mat.color.set(hex);
  }

  setLicensePlate(region, code) {
    this.plateRegion = region || '01';
    this.plateCode = code || 'A 777 AA';
    const tex = this.createPlateTexture(this.plateRegion, this.plateCode);
    if (this.frontPlateMesh) { this.frontPlateMesh.material.map = tex; this.frontPlateMesh.material.needsUpdate = true; }
    if (this.rearPlateMesh) { this.rearPlateMesh.material.map = tex; this.rearPlateMesh.material.needsUpdate = true; }
  }

  deformAt(worldHitPoint, impactStrength) {
    this.health = Math.max(10, this.health - Math.round(impactStrength * 28));
    const localHit = new THREE.Vector3();
    for (const mesh of this.deformableMeshes) {
      const posAttr = mesh.geometry.attributes.position;
      localHit.copy(worldHitPoint);
      mesh.worldToLocal(localHit);
      let modified = false;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
        const dist = Math.hypot(vx - localHit.x, vy - localHit.y, vz - localHit.z);
        if (dist < 1.1) {
          const f = (1 - dist / 1.1) * Math.min(0.28, impactStrength * 0.25);
          posAttr.setXYZ(i, vx * (1 - f * 0.35), vy + (Math.random() - 0.4) * f * 0.3, vz * (1 - f * 0.35));
          modified = true;
        }
      }
      if (modified) { posAttr.needsUpdate = true; mesh.geometry.computeVertexNormals(); }
    }
  }

  repair() {
    this.health = 100;
    for (const mesh of this.deformableMeshes) {
      if (mesh.userData.origPos) {
        mesh.geometry.attributes.position.array.set(mesh.userData.origPos);
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
    }
  }

  update(dt, input, colliders, getGroundHeight) {
    const accel = 18, maxSpeed = 32;
    if (input.gas) this.speed = Math.min(maxSpeed, this.speed + accel * dt);
    else if (input.brake) this.speed = Math.max(-12, this.speed - accel * 1.3 * dt);
    else { this.speed *= Math.pow(0.25, dt); if (Math.abs(this.speed) < 0.05) this.speed = 0; }

    const targetSteer = -input.steer * 0.55;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 8);
    if (Math.abs(this.speed) > 0.2) {
      this.root.rotation.y += this.steerAngle * (Math.abs(this.speed) / 14) * (this.speed >= 0 ? 1 : -1) * dt * 2.1;
    }

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.root.rotation.y);
    const nextX = this.root.position.x + forward.x * this.speed * dt;
    const nextZ = this.root.position.z + forward.z * this.speed * dt;

    let hit = Math.hypot(nextX, nextZ) > 220;
    for (const c of colliders) {
      if (nextX + 1.9 > c.minX && nextX - 1.9 < c.maxX && nextZ + 1.9 > c.minZ && nextZ - 1.9 < c.maxZ) {
        hit = true; break;
      }
    }

    if (hit) {
      const impact = Math.abs(this.speed) / 25;
      if (impact > 0.22) this.deformAt(this.root.position.clone().addScaledVector(forward, 2.0), impact);
      this.speed = -this.speed * 0.35;
    } else {
      this.root.position.x = nextX;
      this.root.position.z = nextZ;
    }

    if (getGroundHeight) {
      const targetY = getGroundHeight(this.root.position.x, this.root.position.z);
      this.root.position.y += (targetY - this.root.position.y) * Math.min(1, dt * 15);
    }

    const wheelSpin = (this.speed * dt) / 0.35;
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      const w = this.wheels[key];
      if (!w) continue;
      if (key === 'fl' || key === 'fr') w.rotation.y = this.steerAngle;
      if (w.children?.length > 0) w.children.forEach((c) => { c.rotation.x += wheelSpin; });
      else w.rotation.x += wheelSpin;
    }
    if (this.steeringWheel) this.steeringWheel.rotation.z = -this.steerAngle * 2.8;
  }
}
