import * as THREE from 'three';
import { buildUzbekCity } from './city.js';
import { CarController } from './vehicle.js';
import { PedestrianManager, createProceduralPerson } from './pedestrians.js';
import { tryLoadGLB, normalizeModel } from './modelLoader.js';

const container = document.getElementById('game-container');
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const progressFill = document.getElementById('progress-fill');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.0028);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x444e44, 0.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff6e5, 1.4);
sunLight.position.set(80, 120, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 320;
const d = 110;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

let colliders = [];
let car;
let pedManager;
let playerMesh;
let playerMixer = null;
let inCar = false;
let cameraMode = 0;
let playerVelY = 0;
let playerGrounded = true;

const joy = { x: 0, y: 0 };
const keys = {};
const touchPedals = { gas: false, brake: false };
let musicAudio = null;
let musicPlaying = false;

function setProgress(pct, text) {
  progressFill.style.width = `${pct}%`;
  loadingStatus.textContent = text;
}

async function initGame() {
  setProgress(20, 'Shahar va tog\'lar yuklanmoqda...');
  const cityRes = await buildUzbekCity(scene, (msg) => setProgress(45, msg));
  colliders = cityRes.colliders;

  setProgress(65, 'Gentra, Cobalt, Nexia 2 va Damas tayyorlanmoqda...');
  car = new CarController(scene);
  await car.init();
  car.root.position.set(0, 0, -12);

  setProgress(85, 'Odamlar shaharga chiqmoqda...');
  pedManager = new PedestrianManager(scene);
  await pedManager.init(22);

  const playerGltf = await tryLoadGLB('cyberpunk_women.glb');
  if (playerGltf) {
    playerMesh = normalizeModel(playerGltf.scene, 1.75);
    if (playerGltf.animations && playerGltf.animations.length > 0) {
      playerMixer = new THREE.AnimationMixer(playerMesh);
      playerMixer.clipAction(playerGltf.animations[0]).play();
    }
  } else {
    playerMesh = createProceduralPerson(0);
  }
  playerMesh.position.set(4, 0, -12);
  scene.add(playerMesh);

  setupControls();
  setProgress(100, 'Tayyor!');
  setTimeout(() => loadingScreen.classList.add('hidden'), 300);
  animate();
}

function setupControls() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyF') toggleEnterExitCar();
    if (e.code === 'Space' && !inCar && playerGrounded) jumpPlayer();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const zone = document.getElementById('joystick-zone');
  const stick = document.getElementById('joystick-stick');
  let activeTouchId = null;

  const updateStick = (clientX, clientY) => {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.x = dx / maxR;
    joy.y = dy / maxR;
  };

  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    activeTouchId = e.changedTouches[0].identifier;
    updateStick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === activeTouchId) updateStick(t.clientX, t.clientY);
  });
  const resetStick = () => {
    activeTouchId = null;
    stick.style.transform = 'translate(-50%, -50%)';
    joy.x = 0; joy.y = 0;
  };
  zone.addEventListener('touchend', resetStick);
  zone.addEventListener('touchcancel', resetStick);

  const bindHold = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); touchPedals[key] = true; });
    el.addEventListener('touchend', () => { touchPedals[key] = false; });
    el.addEventListener('mousedown', () => { touchPedals[key] = true; });
    el.addEventListener('mouseup', () => { touchPedals[key] = false; });
  };
  bindHold('btn-gas', 'gas');
  bindHold('btn-brake', 'brake');

  document.getElementById('btn-enter-car').addEventListener('click', toggleEnterExitCar);
  document.getElementById('btn-jump').addEventListener('click', () => { if (!inCar && playerGrounded) jumpPlayer(); });
  document.getElementById('btn-camera').addEventListener('click', () => { cameraMode = (cameraMode + 1) % 3; });
  document.getElementById('btn-repair').addEventListener('click', () => car.repair());
  document.getElementById('btn-repair-modal').addEventListener('click', () => car.repair());
  document.getElementById('btn-music').addEventListener('click', toggleMusic);

  const modal = document.getElementById('tuning-modal');
  document.getElementById('btn-tuning').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('btn-close-tuning').addEventListener('click', () => modal.classList.add('hidden'));

  document.querySelectorAll('[data-car]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-car]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      car.switchCar(btn.dataset.car);
    });
  });

  document.querySelectorAll('.color-dot').forEach((dot) => {
    dot.addEventListener('click', () => car.setColor(dot.dataset.color));
  });

  document.getElementById('btn-apply-plate').addEventListener('click', () => {
    car.setLicensePlate(
      document.getElementById('plate-region').value,
      document.getElementById('plate-code').value
    );
  });
}

function jumpPlayer() { playerVelY = 6.5; playerGrounded = false; }

function toggleEnterExitCar() {
  const speedo = document.getElementById('hud-speedo');
  const pedals = document.getElementById('driving-pedals');
  const footActions = document.getElementById('foot-actions');

  if (!inCar) {
    if (playerMesh.position.distanceTo(car.root.position) < 6.5) {
      inCar = true;
      playerMesh.visible = false;
      speedo.classList.remove('hidden');
      pedals.classList.remove('hidden');
      footActions.classList.add('hidden');
    }
  } else {
    inCar = false;
    const side = new THREE.Vector3(-2.4, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.root.rotation.y);
    playerMesh.position.copy(car.root.position).add(side);
    playerMesh.position.y = 0;
    playerMesh.visible = true;
    speedo.classList.add('hidden');
    pedals.classList.add('hidden');
    footActions.classList.remove('hidden');
  }
}

async function toggleMusic() {
  const btn = document.getElementById('btn-music');
  if (!musicAudio) { musicAudio = new Audio('./models/music.mp3'); musicAudio.loop = true; }
  if (musicPlaying) {
    musicAudio.pause();
    musicPlaying = false;
    btn.classList.remove('active');
  } else {
    try { await musicAudio.play(); musicPlaying = true; btn.classList.add('active'); }
    catch { btn.classList.toggle('active'); musicPlaying = !musicPlaying; }
  }
}

let walkPhase = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (inCar) {
    const steerInput = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + joy.x;
    const gasInput = touchPedals.gas || keys['KeyW'] || keys['ArrowUp'];
    const brakeInput = touchPedals.brake || keys['KeyS'] || keys['ArrowDown'];

    car.update(dt, { steer: Math.max(-1, Math.min(1, steerInput)), gas: gasInput, brake: brakeInput }, colliders);
    document.getElementById('speed-num').textContent = Math.round(Math.abs(car.speed) * 4.2);
    const fill = document.getElementById('car-health-fill');
    fill.style.width = `${car.health}%`;
    fill.style.background = car.health > 50 ? '#38d37c' : car.health > 25 ? '#f39c12' : '#e74c3c';
  } else {
    const moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + joy.x;
    const moveZ = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) + joy.y;
    const len = Math.hypot(moveX, moveZ);

    if (len > 0.1) {
      const nx = moveX / Math.max(1, len);
      const nz = moveZ / Math.max(1, len);
      const nextX = playerMesh.position.x + nx * 7.5 * dt;
      const nextZ = playerMesh.position.z + nz * 7.5 * dt;

      let blocked = Math.hypot(nextX, nextZ) > 205;
      for (const c of colliders) {
        if (nextX > c.minX - 0.5 && nextX < c.maxX + 0.5 && nextZ > c.minZ - 0.5 && nextZ < c.maxZ + 0.5) {
          blocked = true; break;
        }
      }
      if (!blocked) { playerMesh.position.x = nextX; playerMesh.position.z = nextZ; }
      playerMesh.rotation.y = Math.atan2(nx, nz);

      if (playerMixer) {
        playerMixer.update(dt);
      } else if (playerMesh.userData.legL) {
        walkPhase += dt * 10;
        const s = Math.sin(walkPhase) * 0.55;
        playerMesh.userData.legL.rotation.x = s;
        playerMesh.userData.legR.rotation.x = -s;
        playerMesh.userData.armL.rotation.x = -s * 0.7;
        playerMesh.userData.armR.rotation.x = s * 0.7;
      }
    }

    if (!playerGrounded) {
      playerVelY -= 18 * dt;
      playerMesh.position.y += playerVelY * dt;
      if (playerMesh.position.y <= 0) { playerMesh.position.y = 0; playerVelY = 0; playerGrounded = true; }
    }
    document.getElementById('btn-enter-car').style.opacity = playerMesh.position.distanceTo(car.root.position) < 6.5 ? '1' : '0.45';
  }

  pedManager.update(dt, inCar ? car.root.position : null);

  const activePos = inCar ? car.root.position : playerMesh.position;
  const locEl = document.getElementById('hud-location');
  if (activePos.distanceTo(new THREE.Vector3(0, 0, -68)) < 38) locEl.textContent = 'Samarqand — Registon Maydoni';
  else if (activePos.distanceTo(new THREE.Vector3(70, 0, 62)) < 38) locEl.textContent = 'Toshkent — Teleminora';
  else locEl.textContent = 'O\'zbekiston Shahri';

  updateCamera(activePos, dt);
  renderer.render(scene, camera);
}

function updateCamera(targetPos, dt) {
  let desiredOffset;
  if (inCar) {
    const dist = cameraMode === 0 ? -9.5 : cameraMode === 1 ? -4.2 : -15;
    const height = cameraMode === 0 ? 4.2 : cameraMode === 1 ? 2.4 : 7.0;
    desiredOffset = new THREE.Vector3(0, height, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.root.rotation.y);
  } else {
    desiredOffset = cameraMode === 2 ? new THREE.Vector3(0, 8, -12) : new THREE.Vector3(0, 4.2, -7.2);
  }
  const desiredPos = targetPos.clone().add(desiredOffset);
  camera.position.lerp(desiredPos, Math.min(1, dt * 6));
  camera.lookAt(targetPos.x, targetPos.y + 1.5, targetPos.z);
}

initGame();
