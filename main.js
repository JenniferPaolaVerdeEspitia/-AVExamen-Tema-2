import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

const clock = new THREE.Clock();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 0, 120);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.rotation.order = 'YXZ';

// ================== LUCES ==================
const fillLight1 = new THREE.HemisphereLight(0xffffff, 0x4b5b6b, 1.2);
scene.add(fillLight1);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(15, 25, 10);
directionalLight.castShadow = true;

directionalLight.shadow.camera.near = 0.01;
directionalLight.shadow.camera.far = 300;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;

scene.add(directionalLight);

// ================== RENDER ==================
const container = document.body;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0px';
container.appendChild(stats.dom);

// ================== MUNDO Y JUGADOR ==================
const worldOctree = new Octree();

const playerCollider = new Capsule(
  new THREE.Vector3(0, 0.35, 8),
  new THREE.Vector3(0, 1.35, 8),
  0.35
);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

const GRAVITY = 25;
const STEPS_PER_FRAME = 5;

// ================== PELOTAS ==================
const NUM_SPHERES = 60;
const SPHERE_RADIUS = 0.2;
const spheres = [];

const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);
const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

let sphereIdx = 0;

for (let i = 0; i < NUM_SPHERES; i++) {
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  scene.add(sphere);

  spheres.push({
    mesh: sphere,
    collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), SPHERE_RADIUS),
    velocity: new THREE.Vector3()
  });
}

// ================== INPUT ==================
document.addEventListener('keydown', (event) => {
  keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keyStates[event.code] = false;
});

container.addEventListener('mousedown', async () => {
  if (document.pointerLockElement !== document.body) {
    try {
      await document.body.requestPointerLock();
      mouseTime = performance.now();
    } catch (error) {
      console.warn('No se pudo activar el pointer lock:', error);
    }
  } else {
    throwBall();
  }
});

document.body.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === document.body) {
    camera.rotation.y -= event.movementX / 500;
    camera.rotation.x -= event.movementY / 500;

    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  }
});

// ================== CARGA DEL ESCENARIO ==================
const loader = new GLTFLoader();
const MODEL_PATH = './models/futsal_court/scene.gltf';

loader.load(
  MODEL_PATH,
  (gltf) => {
    const model = gltf.scene;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          child.material.side = THREE.FrontSide;
        }
      }
    });

    model.scale.set(1, 1, 1);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);

    scene.add(model);
    worldOctree.fromGraphNode(model);

    playerCollider.start.set(0, 0.35, 8);
    playerCollider.end.set(0, 1.35, 8);
    camera.position.copy(playerCollider.end);
  },
  undefined,
  (error) => {
    console.error('Error cargando el modelo Futsal Court:', error);
  }
);

// ================== FÍSICA JUGADOR ==================
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider);

  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;

    if (!playerOnFloor) {
      playerVelocity.addScaledVector(
        result.normal,
        -result.normal.dot(playerVelocity)
      );
    }

    playerCollider.translate(result.normal.multiplyScalar(result.depth));
  }
}

function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.1;
  }

  playerVelocity.addScaledVector(playerVelocity, damping);

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  playerCollider.translate(deltaPosition);

  playerCollisions();

  camera.position.copy(playerCollider.end);
}

function controls(deltaTime) {
  const speed = playerOnFloor ? 25 : 8;

  if (keyStates['KeyW']) {
    playerVelocity.add(getForwardVector().multiplyScalar(speed * deltaTime));
  }

  if (keyStates['KeyS']) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speed * deltaTime));
  }

  if (keyStates['KeyA']) {
    playerVelocity.add(getSideVector().multiplyScalar(-speed * deltaTime));
  }

  if (keyStates['KeyD']) {
    playerVelocity.add(getSideVector().multiplyScalar(speed * deltaTime));
  }

  if (playerOnFloor && keyStates['Space']) {
    playerVelocity.y = 15;
  }
}

function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  return playerDirection;
}

function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  playerDirection.cross(camera.up);
  return playerDirection;
}

// ================== LANZAR PELOTAS ==================
function throwBall() {
  const sphere = spheres[sphereIdx];

  camera.getWorldDirection(playerDirection);

  sphere.collider.center
    .copy(playerCollider.end)
    .addScaledVector(playerDirection, 1.5);

  const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));

  sphere.velocity.copy(playerDirection).multiplyScalar(impulse);
  sphere.velocity.addScaledVector(playerVelocity, 2);

  sphereIdx = (sphereIdx + 1) % spheres.length;
}

function spheresCollisions() {
  for (let i = 0, length = spheres.length; i < length; i++) {
    const s1 = spheres[i];

    for (let j = i + 1; j < length; j++) {
      const s2 = spheres[j];

      const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
      const r = s1.collider.radius + s2.collider.radius;
      const r2 = r * r;

      if (d2 < r2) {
        const normal = new THREE.Vector3()
          .subVectors(s1.collider.center, s2.collider.center)
          .normalize();

        const v1 = normal.clone().multiplyScalar(normal.dot(s1.velocity));
        const v2 = normal.clone().multiplyScalar(normal.dot(s2.velocity));

        s1.velocity.add(v2).sub(v1);
        s2.velocity.add(v1).sub(v2);

        const d = (r - Math.sqrt(d2)) / 2;

        s1.collider.center.addScaledVector(normal, d);
        s2.collider.center.addScaledVector(normal, -d);
      }
    }
  }
}

function updateSpheres(deltaTime) {
  spheres.forEach((sphere) => {
    sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

    const result = worldOctree.sphereIntersect(sphere.collider);

    if (result) {
      sphere.velocity.addScaledVector(
        result.normal,
        -result.normal.dot(sphere.velocity) * 1.5
      );
      sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
    } else {
      sphere.velocity.y -= GRAVITY * deltaTime;
    }

    const damping = Math.exp(-1.5 * deltaTime) - 1;
    sphere.velocity.addScaledVector(sphere.velocity, damping);

    sphere.mesh.position.copy(sphere.collider.center);
  });

  spheresCollisions();
}

// ================== RESET SI CAE FUERA ==================
function teleportPlayerIfOob() {
  if (camera.position.y <= -20) {
    playerCollider.start.set(0, 0.35, 8);
    playerCollider.end.set(0, 1.35, 8);
    playerCollider.radius = 0.35;

    camera.position.copy(playerCollider.end);
    camera.rotation.set(0, 0, 0);
    playerVelocity.set(0, 0, 0);
  }
}

// ================== ANIMACIÓN ==================
function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime);
    updatePlayer(deltaTime);
    updateSpheres(deltaTime);
    teleportPlayerIfOob();
  }

  renderer.render(scene, camera);
  stats.update();

  requestAnimationFrame(animate);
}

animate();

// ================== RESIZE ==================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});