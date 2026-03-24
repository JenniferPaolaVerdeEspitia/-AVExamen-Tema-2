import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

// ======================================================
// CONFIG GENERAL
// ======================================================
const COURT_PATH = './models/scene.gltf';

const PLAYER_MODEL_PATH = './player/Jugador.fbx';
const PLAYER_KICK_PATH = './player/Disparo.fbx';
const PLAYER_CELEBRATE_PATH = './player/Celebracion.fbx';

const GOALKEEPER_MODEL_PATH = './goalkeeper/Portero.fbx';
const GOALKEEPER_CATCH_1_PATH = './goalkeeper/Catch1.fbx';
const GOALKEEPER_CATCH_2_PATH = './goalkeeper/Catch2.fbx';
const GOALKEEPER_DIVE_PATH = './goalkeeper/Dive.fbx';

const PLAYER_VISUAL_ROT_Y = Math.PI;
const PLAYER_VISUAL_ROT_X = 0;
const GOALKEEPER_VISUAL_ROT_Y = 0;

const PLAYER_SCALE = 0.0125;
const GOALKEEPER_SCALE = 0.0125;

// Posiciones base
const PLAYER_START = new THREE.Vector3(0, 0.35, 10.5);
const GOALKEEPER_HOME = new THREE.Vector3(0, 0.0, -18.2);

// Caja de gol
const GOAL_MIN_X = -1.45;
const GOAL_MAX_X = 1.45;
const GOAL_MIN_Y = 0.10;
const GOAL_MAX_Y = 2.45;
const GOAL_LINE_Z = -18.75;
const GOAL_PLANE_Z = -18.60;

// Física
const GRAVITY = 24;
const PLAYER_SPEED = 7.5;
const PLAYER_RUN_SPEED = 15.5;
const PLAYER_AIR_SPEED = 4.5;
const PLAYER_JUMP_SPEED = 10.5;
const STEPS_PER_FRAME = 5;

const BALL_RADIUS = 0.16;
const BALL_BASE_POWER = 21;
const BALL_POWER_PER_LEVEL = 0.9;

// Cámara
const CAMERA_DISTANCE = 6.5;
const CAMERA_HEIGHT = 2.4;
const CAMERA_LERP = 0.12;
const LOOK_HEIGHT = 1.4;
const MIN_PITCH = -0.45;
const MAX_PITCH = 0.35;

// Movimiento permitido del jugador
const PLAYER_MIN_X = -9.0;
const PLAYER_MAX_X = 9.0;
const PLAYER_MIN_Z = -8.0;
const PLAYER_MAX_Z = 13.5;

// Juego
const MAX_LEVEL = 10;
const LEVEL_TIME = 60;
const SHOTS_PER_LEVEL = 15;
const LEVEL_START_TARGET = 2;

// ======================================================
// UI
// ======================================================
const ui = {
  level: document.getElementById('level'),
  time: document.getElementById('time'),
  shots: document.getElementById('shots'),
  goals: document.getElementById('goals'),
  goalTarget: document.getElementById('goalTarget'),
  message: document.getElementById('message')
};

// ======================================================
// ESCENA
// ======================================================
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 18, 90);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0px';
document.body.appendChild(stats.dom);

// ======================================================
// LUCES
// ======================================================
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4b5b6b, 1.25);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(14, 24, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const playerLight = new THREE.PointLight(0xffffff, 1.2, 18);
playerLight.position.set(0, 6, 8);
scene.add(playerLight);

// ======================================================
// CARGADORES
// ======================================================
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

// ======================================================
// MUNDO Y FÍSICA
// ======================================================
const worldOctree = new Octree();

const playerCollider = new Capsule(
  new THREE.Vector3(PLAYER_START.x, PLAYER_START.y, PLAYER_START.z),
  new THREE.Vector3(PLAYER_START.x, PLAYER_START.y + 1.0, PLAYER_START.z),
  0.35
);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;

const ball = {
  mesh: null,
  collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), BALL_RADIUS),
  velocity: new THREE.Vector3(),
  active: false,
  visible: false,
  kicked: false,
  timeSinceShot: 0
};

// ======================================================
// OBJETOS PRINCIPALES
// ======================================================
let courtModel = null;

let playerRoot = null;
let playerModel = null;
let playerMixer = null;
let playerActions = {
  kick: null,
  celebrate: null
};
let playerCurrentAction = null;

let goalkeeperRoot = null;
let goalkeeperModel = null;
let goalkeeperMixer = null;
let goalkeeperActions = {
  catch1: null,
  catch2: null,
  dive: null
};
let goalkeeperCurrentAction = null;

// Estado visual simulado del jugador
let playerMoveBlend = 0;
let playerRunBlend = 0;
let playerFacing = 0;

// ======================================================
// CÁMARA / INPUT
// ======================================================
const keys = {};
let yaw = 0;
let pitch = -0.12;

let gameStarted = false;
let gamePaused = true;

// ======================================================
// ESTADO DEL JUEGO
// ======================================================
let level = 1;
let goals = 0;
let shotsLeft = SHOTS_PER_LEVEL;
let timeLeft = LEVEL_TIME;
let targetGoals = LEVEL_START_TARGET;

let levelTransition = false;
let resetShotTimer = -1;
let shotResolved = false;
let currentShotWasGoal = false;
let currentShotTarget = new THREE.Vector3();
let playerCanShoot = true;

let pendingShot = false;
let pendingShotTimer = 0;
let pendingShotDirection = new THREE.Vector3();
let pendingShotPower = 0;
let kickLockTimer = 0;

// IA del portero
const keeperState = {
  reacting: false,
  returnHome: false,
  guessedRight: false,
  targetX: 0,
  moveSpeed: 5.0,
  reachX: 0.85,
  reachY: 2.25,
  isDive: false,
  cooldown: 0
};

// ======================================================
// HELPERS
// ======================================================
function setMessage(text) {
  if (ui.message) ui.message.textContent = text;
}

function updateHUD() {
  if (ui.level) ui.level.textContent = String(level);
  if (ui.time) ui.time.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  if (ui.shots) ui.shots.textContent = String(shotsLeft);
  if (ui.goals) ui.goals.textContent = String(goals);
  if (ui.goalTarget) ui.goalTarget.textContent = String(targetGoals);
}

function getTargetGoalsForLevel(currentLevel) {
  return LEVEL_START_TARGET + (currentLevel - 1);
}

function clampPlayerArea() {
  playerCollider.start.x = THREE.MathUtils.clamp(playerCollider.start.x, PLAYER_MIN_X, PLAYER_MAX_X);
  playerCollider.end.x = THREE.MathUtils.clamp(playerCollider.end.x, PLAYER_MIN_X, PLAYER_MAX_X);

  playerCollider.start.z = THREE.MathUtils.clamp(playerCollider.start.z, PLAYER_MIN_Z, PLAYER_MAX_Z);
  playerCollider.end.z = THREE.MathUtils.clamp(playerCollider.end.z, PLAYER_MIN_Z, PLAYER_MAX_Z);
}

function getForwardVector() {
  playerDirection.set(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  return playerDirection;
}

function getSideVector() {
  playerDirection.set(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
  return playerDirection;
}

function isInsideGoal(position) {
  return (
    position.x >= GOAL_MIN_X &&
    position.x <= GOAL_MAX_X &&
    position.y >= GOAL_MIN_Y &&
    position.y <= GOAL_MAX_Y &&
    position.z <= GOAL_LINE_Z
  );
}

function createSoccerBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function drawPentagon(cx, cy, r, color = '#111') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const rows = 6;
  const cols = 12;
  const stepX = canvas.width / cols;
  const stepY = canvas.height / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * stepX + stepX * 0.5 + (y % 2 === 0 ? 0 : stepX * 0.25);
      const py = y * stepY + stepY * 0.5;

      if ((x + y) % 2 === 0) {
        drawPentagon(px, py, Math.min(stepX, stepY) * 0.22, '#111');
      }
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.2;

  for (let y = 0; y < rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * stepY + stepY * 0.5);
    ctx.lineTo(canvas.width, y * stepY + stepY * 0.5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function createBallMesh() {
  const texture = createSoccerBallTexture();

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 36, 28),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0.0
    })
  );

  sphere.castShadow = true;
  sphere.receiveShadow = true;

  const group = new THREE.Group();
  group.add(sphere);
  group.visible = false;

  scene.add(group);
  ball.mesh = group;
}

function setShadows(object, tint = null, forceSolid = false) {
  object.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;

    const applyMaterialFix = (mat) => {
      if (!mat) return;

      mat.side = THREE.FrontSide;
      mat.transparent = false;
      mat.opacity = 1;
      mat.alphaTest = 0;
      mat.depthWrite = true;
      mat.depthTest = true;

      if (tint && mat.color) {
        mat.color.multiply(tint);
      }

      if (forceSolid) {
        const solidMat = new THREE.MeshStandardMaterial({
          map: mat.map || null,
          color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
          roughness: 0.85,
          metalness: 0.0
        });

        solidMat.transparent = false;
        solidMat.opacity = 1;
        solidMat.side = THREE.FrontSide;
        solidMat.depthWrite = true;
        child.material = solidMat;
      } else {
        mat.needsUpdate = true;
      }
    };

    if (Array.isArray(child.material)) {
      child.material.forEach(applyMaterialFix);
    } else {
      applyMaterialFix(child.material);
    }
  });
}

function applyStandingPose() {
  if (!playerModel) return;

  playerModel.rotation.x = PLAYER_VISUAL_ROT_X;
  playerModel.rotation.z = 0;

  playerModel.traverse((child) => {
    if (!child.isBone) return;

    const name = child.name.toLowerCase();

    if (name.includes('leftarm') && !name.includes('forearm')) {
      child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, 0.05, 0.12);
      child.rotation.y = THREE.MathUtils.lerp(child.rotation.y, 0.0, 0.12);
      child.rotation.z = THREE.MathUtils.lerp(child.rotation.z, 0.18, 0.12);
    }

    if (name.includes('rightarm') && !name.includes('forearm')) {
      child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, 0.05, 0.12);
      child.rotation.y = THREE.MathUtils.lerp(child.rotation.y, 0.0, 0.12);
      child.rotation.z = THREE.MathUtils.lerp(child.rotation.z, -0.18, 0.12);
    }

    if (name.includes('leftforearm')) {
      child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, -0.12, 0.12);
      child.rotation.z = THREE.MathUtils.lerp(child.rotation.z, 0.03, 0.12);
    }

    if (name.includes('rightforearm')) {
      child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, -0.12, 0.12);
      child.rotation.z = THREE.MathUtils.lerp(child.rotation.z, -0.03, 0.12);
    }
  });
}

function loadGLTF(path) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(path, resolve, undefined, reject);
  });
}

function loadFBX(path) {
  return new Promise((resolve, reject) => {
    fbxLoader.load(path, resolve, undefined, reject);
  });
}

function makeOneShot(action) {
  if (!action) return;
  action.reset();
  action.enabled = true;
  action.clampWhenFinished = true;
  action.setLoop(THREE.LoopOnce, 1);
}

function stopCurrentPlayerAction() {
  if (playerCurrentAction) {
    playerCurrentAction.stop();
    playerCurrentAction = null;
  }
}

function playPlayerAction(name) {
  if (!playerActions[name]) return;
  stopCurrentPlayerAction();
  playerCurrentAction = playerActions[name];
  makeOneShot(playerCurrentAction);
  playerCurrentAction.play();
}

function stopCurrentGoalkeeperAction() {
  if (goalkeeperCurrentAction) {
    goalkeeperCurrentAction.stop();
    goalkeeperCurrentAction = null;
  }
}

function playGoalkeeperAction(name) {
  if (!goalkeeperActions[name]) return;
  stopCurrentGoalkeeperAction();
  goalkeeperCurrentAction = goalkeeperActions[name];
  makeOneShot(goalkeeperCurrentAction);
  goalkeeperCurrentAction.play();
}

function resetPlayerPosition() {
  playerCollider.start.set(PLAYER_START.x, PLAYER_START.y, PLAYER_START.z);
  playerCollider.end.set(PLAYER_START.x, PLAYER_START.y + 1.0, PLAYER_START.z);
  playerVelocity.set(0, 0, 0);
}

function syncPlayerVisual() {
  if (!playerRoot || !playerModel) return;

  playerRoot.position.set(
    playerCollider.start.x,
    playerCollider.start.y - 0.35,
    playerCollider.start.z
  );

  const targetRot = playerFacing + PLAYER_VISUAL_ROT_Y;
  playerRoot.rotation.y = THREE.MathUtils.lerp(playerRoot.rotation.y, targetRot, 0.15);

  const moving = playerMoveBlend;
  const running = playerRunBlend;

  const bob = Math.sin(performance.now() * 0.012 * (running > 0.5 ? 2.6 : 1.5)) * 0.012 * moving;
  playerModel.position.y = bob;
  playerModel.rotation.z = Math.sin(performance.now() * 0.010) * 0.006 * moving;
  playerModel.rotation.x = PLAYER_VISUAL_ROT_X;
}

function syncGoalkeeperVisual() {
  if (!goalkeeperRoot) return;
  goalkeeperRoot.position.y = 0;
  goalkeeperRoot.rotation.y = GOALKEEPER_VISUAL_ROT_Y;
}

function updateCamera() {
  if (!playerRoot) return;

  const lookTarget = new THREE.Vector3(
    playerRoot.position.x,
    playerRoot.position.y + LOOK_HEIGHT,
    playerRoot.position.z
  );

  const offset = new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  offset.applyQuaternion(quat);

  const desiredPos = lookTarget.clone().add(offset);
  camera.position.lerp(desiredPos, CAMERA_LERP);

  const lookForward = new THREE.Vector3(0, 0.15, -8).applyQuaternion(quat);
  camera.lookAt(lookTarget.clone().add(lookForward));

  playerLight.position.set(
    playerRoot.position.x,
    playerRoot.position.y + 5,
    playerRoot.position.z + 4
  );
}

function getBallStartPosition() {
  const forward = new THREE.Vector3(
    Math.sin(playerFacing),
    0,
    -Math.cos(playerFacing)
  ).normalize();

  const base = new THREE.Vector3(
    playerCollider.start.x,
    0,
    playerCollider.start.z
  );

  return new THREE.Vector3(
    base.x + forward.x * 0.10,
    BALL_RADIUS - 0.01,
    base.z + forward.z * 0.10
  );
}

function resetBallForNextShot() {
  const pos = getBallStartPosition();

  ball.collider.center.copy(pos);
  ball.velocity.set(0, 0, 0);
  ball.active = true;
  ball.visible = true;
  ball.kicked = false;
  ball.timeSinceShot = 0;

  if (ball.mesh) {
    ball.mesh.visible = true;
    ball.mesh.position.copy(ball.collider.center);
    ball.mesh.rotation.set(0, 0, 0);
  }

  shotResolved = false;
  currentShotWasGoal = false;
  resetShotTimer = -1;
  playerCanShoot = true;

  keeperState.reacting = false;
  keeperState.returnHome = true;
  keeperState.targetX = 0;
  keeperState.cooldown = 0;

  pendingShot = false;
  pendingShotTimer = 0;
  pendingShotDirection.set(0, 0, 0);
  pendingShotPower = 0;
  kickLockTimer = 0;
}

function hideBall() {
  ball.active = false;
  ball.visible = false;
  ball.kicked = false;
  ball.velocity.set(0, 0, 0);

  if (ball.mesh) {
    ball.mesh.visible = false;
  }
}

function getShotTargetPoint() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  const origin = camera.position.clone();
  const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_PLANE_Z);

  const ray = new THREE.Ray(origin, direction);
  const hit = new THREE.Vector3();

  if (ray.intersectPlane(goalPlane, hit)) {
    hit.x = THREE.MathUtils.clamp(hit.x, GOAL_MIN_X - 1.0, GOAL_MAX_X + 1.0);
    hit.y = THREE.MathUtils.clamp(hit.y, GOAL_MIN_Y, GOAL_MAX_Y + 0.8);
    return hit;
  }

  return new THREE.Vector3(0, 1.2, GOAL_PLANE_Z);
}

// ======================================================
// COLISIONES JUGADOR
// ======================================================
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

  clampPlayerArea();
}

function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.12;
  }

  playerVelocity.addScaledVector(playerVelocity, damping);

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  playerCollider.translate(deltaPosition);

  playerCollisions();
}

function controls(deltaTime) {
  if (kickLockTimer > 0) {
    playerMoveBlend = THREE.MathUtils.lerp(playerMoveBlend, 0, 0.2);
    playerRunBlend = THREE.MathUtils.lerp(playerRunBlend, 0, 0.2);
    return;
  }

  let moveX = 0;
  let moveZ = 0;

  if (keys['KeyW']) moveZ += 1;
  if (keys['KeyS']) moveZ -= 1;
  if (keys['KeyA']) moveX -= 1;
  if (keys['KeyD']) moveX += 1;

  const moving = moveX !== 0 || moveZ !== 0;
  const isRunning = moving && (keys['ShiftLeft'] || keys['ShiftRight']);

  const speed = playerOnFloor
    ? (isRunning ? PLAYER_RUN_SPEED : PLAYER_SPEED)
    : PLAYER_AIR_SPEED;

  if (moving) {
    const forward = getForwardVector().clone().multiplyScalar(moveZ);
    const side = getSideVector().clone().multiplyScalar(moveX);
    const moveDir = forward.add(side);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      playerVelocity.add(moveDir.multiplyScalar(speed * deltaTime));
      playerFacing = Math.atan2(moveDir.x, -moveDir.z);
    }
  } else {
    playerFacing = yaw;
  }

  playerMoveBlend = THREE.MathUtils.lerp(playerMoveBlend, moving ? 1 : 0, 0.12);
  playerRunBlend = THREE.MathUtils.lerp(playerRunBlend, isRunning ? 1 : 0, 0.12);

  if (playerOnFloor && keys['Space']) {
    playerVelocity.y = PLAYER_JUMP_SPEED;
  }
}

// ======================================================
// PORTERO
// ======================================================
function triggerGoalkeeperReaction(targetPoint) {
  const skill = THREE.MathUtils.clamp(0.28 + (level - 1) * 0.06, 0.28, 0.82);
  const guessRight = Math.random() < skill;

  keeperState.reacting = true;
  keeperState.returnHome = false;
  keeperState.guessedRight = guessRight;

  const targetX = targetPoint.x;
  const targetY = targetPoint.y;

  let guessedX;

  if (guessRight) {
    const error = THREE.MathUtils.randFloatSpread(0.6 * (1.0 - skill));
    guessedX = THREE.MathUtils.clamp(targetX + error, -1.2, 1.2);
  } else {
    const wrongSide = targetX >= 0 ? -1 : 1;
    guessedX = THREE.MathUtils.clamp(wrongSide * THREE.MathUtils.randFloat(0.35, 1.15), -1.2, 1.2);
  }

  keeperState.targetX = guessedX;
  keeperState.moveSpeed = 4.5 + level * 0.28;

  const centerShot = Math.abs(targetX) < 0.45;
  const highShot = targetY > 1.7;
  const extremeShot = Math.abs(targetX) > 0.85;

  keeperState.isDive = extremeShot || highShot;
  keeperState.reachX = keeperState.isDive ? 1.05 + level * 0.03 : 0.72 + level * 0.02;
  keeperState.reachY = highShot ? 2.55 : 2.15;

  if (extremeShot) {
    playGoalkeeperAction('dive');
  } else if (centerShot) {
    playGoalkeeperAction(Math.random() < 0.5 ? 'catch1' : 'catch2');
  } else {
    playGoalkeeperAction(Math.random() < 0.5 ? 'catch1' : 'catch2');
  }
}

function updateGoalkeeper(deltaTime) {
  if (!goalkeeperRoot) return;

  if (keeperState.reacting) {
    const targetPosX = keeperState.targetX;
    goalkeeperRoot.position.x = THREE.MathUtils.lerp(
      goalkeeperRoot.position.x,
      targetPosX,
      deltaTime * keeperState.moveSpeed
    );

    keeperState.cooldown += deltaTime;

    if (keeperState.cooldown > 1.25) {
      keeperState.reacting = false;
      keeperState.returnHome = true;
      keeperState.cooldown = 0;
    }
  }

  if (keeperState.returnHome) {
    goalkeeperRoot.position.x = THREE.MathUtils.lerp(
      goalkeeperRoot.position.x,
      GOALKEEPER_HOME.x,
      deltaTime * 2.5
    );
  }

  syncGoalkeeperVisual();
}

function goalkeeperCanSaveBall() {
  if (!goalkeeperRoot || !keeperState.reacting) return false;

  const bx = ball.collider.center.x;
  const by = ball.collider.center.y;
  const bz = ball.collider.center.z;

  const zNearGoal = bz <= GOAL_LINE_Z + 1.0 && bz >= GOAL_LINE_Z - 0.8;
  if (!zNearGoal) return false;

  const withinX = Math.abs(bx - goalkeeperRoot.position.x) <= keeperState.reachX;
  const withinY = by >= 0.15 && by <= keeperState.reachY;

  return withinX && withinY;
}

function saveBall() {
  if (shotResolved) return;

  shotResolved = true;
  currentShotWasGoal = false;
  setMessage('¡ATAJADA!');

  const awayDir = new THREE.Vector3(
    ball.collider.center.x - goalkeeperRoot.position.x,
    0.35,
    1.0
  ).normalize();

  ball.velocity.copy(awayDir.multiplyScalar(11 + level * 0.6));
  resetShotTimer = 1.5;
}

// ======================================================
// GOL / FALLO / NIVELES
// ======================================================
function registerGoal() {
  if (shotResolved) return;

  shotResolved = true;
  currentShotWasGoal = true;
  goals += 1;
  updateHUD();
  setMessage('¡GOOOOL!');

  playPlayerAction('celebrate');
  resetShotTimer = 1.8;

  if (goals >= targetGoals) {
    levelTransition = true;
  }
}

function registerMiss(text = '¡FALLASTE!') {
  if (shotResolved) return;

  shotResolved = true;
  currentShotWasGoal = false;
  setMessage(text);
  resetShotTimer = 1.4;
}

function startLevel(levelNumber) {
  level = levelNumber;
  goals = 0;
  shotsLeft = SHOTS_PER_LEVEL;
  timeLeft = LEVEL_TIME;
  targetGoals = getTargetGoalsForLevel(level);

  levelTransition = false;
  gamePaused = false;
  playerCanShoot = true;

  setMessage(`Nivel ${level}`);
  updateHUD();

  resetPlayerPosition();

  if (goalkeeperRoot) {
    goalkeeperRoot.position.copy(GOALKEEPER_HOME);
  }

  resetBallForNextShot();
}

function failLevel() {
  gamePaused = true;
  setMessage(`Perdiste el nivel ${level}. Reiniciando...`);
  hideBall();

  setTimeout(() => {
    startLevel(level);
  }, 2200);
}

function advanceLevel() {
  gamePaused = true;
  hideBall();

  if (level >= MAX_LEVEL) {
    setMessage('¡GANASTE TODOS LOS NIVELES!');
    return;
  }

  setMessage(`¡Nivel ${level} completado!`);
  setTimeout(() => {
    startLevel(level + 1);
  }, 2200);
}

// ======================================================
// DISPARO
// ======================================================
function shootBall() {
  if (!ball.mesh) return;
  if (!gameStarted || gamePaused || !playerCanShoot || !ball.active || ball.kicked) return;
  if (shotsLeft <= 0 || timeLeft <= 0) return;

  playerCanShoot = false;
  shotsLeft -= 1;
  updateHUD();

  const startPos = getBallStartPosition();
  ball.collider.center.copy(startPos);
  ball.mesh.position.copy(startPos);

  currentShotTarget.copy(getShotTargetPoint());

  const dir = currentShotTarget.clone().sub(startPos).normalize();
  const power = BALL_BASE_POWER + level * BALL_POWER_PER_LEVEL;

  kickLockTimer = 0.34;

  playPlayerAction('kick');
  triggerGoalkeeperReaction(currentShotTarget);

  pendingShot = true;
  pendingShotTimer = 0.24;
  pendingShotDirection.copy(dir);
  pendingShotPower = power;

  setMessage('¡Disparo!');
}

function updatePendingShot(deltaTime) {
  if (!pendingShot || !ball.mesh) return;

  const holdPos = getBallStartPosition();
  ball.collider.center.copy(holdPos);
  ball.mesh.position.copy(holdPos);

  pendingShotTimer -= deltaTime;

  if (pendingShotTimer <= 0) {
    ball.velocity.copy(pendingShotDirection).multiplyScalar(pendingShotPower);
    ball.kicked = true;
    ball.timeSinceShot = 0;
    pendingShot = false;
  }
}

// ======================================================
// BALÓN
// ======================================================
function updateBall(deltaTime) {
  if (!ball.active || !ball.mesh) return;

  if (!ball.kicked) {
    if (!pendingShot) {
      const followPos = getBallStartPosition();
      ball.collider.center.copy(followPos);
      ball.mesh.position.copy(ball.collider.center);
    }

    ball.mesh.rotation.y += deltaTime * 0.2;
    return;
  }

  ball.timeSinceShot += deltaTime;
  ball.collider.center.addScaledVector(ball.velocity, deltaTime);

  const speed = ball.velocity.length();
  if (speed > 0.001) {
    const axis = new THREE.Vector3(ball.velocity.z, 0, -ball.velocity.x).normalize();
    ball.mesh.rotateOnWorldAxis(axis, speed * deltaTime * 2.0);
  }

  const result = worldOctree.sphereIntersect(ball.collider);

  if (result) {
    ball.velocity.addScaledVector(
      result.normal,
      -result.normal.dot(ball.velocity) * 1.35
    );
    ball.collider.center.add(result.normal.multiplyScalar(result.depth));
  } else {
    ball.velocity.y -= GRAVITY * deltaTime;
  }

  const damping = Math.exp(-1.2 * deltaTime) - 1;
  ball.velocity.addScaledVector(ball.velocity, damping);
  ball.mesh.position.copy(ball.collider.center);

  if (!shotResolved && goalkeeperCanSaveBall()) {
    saveBall();
  }

  if (!shotResolved && isInsideGoal(ball.collider.center)) {
    registerGoal();
  }

  const tooFar =
    ball.collider.center.y < -4 ||
    ball.collider.center.z > 18 ||
    Math.abs(ball.collider.center.x) > 20;

  const almostStopped = ball.timeSinceShot > 1.2 && ball.velocity.length() < 1.2;

  if (!shotResolved && (tooFar || almostStopped || ball.timeSinceShot > 4.8)) {
    registerMiss();
  }
}

// ======================================================
// CARGA DE MODELOS
// ======================================================
async function loadCourt() {
  const gltf = await loadGLTF(COURT_PATH);
  courtModel = gltf.scene;

  setShadows(courtModel);
  courtModel.scale.set(1, 1, 1);
  courtModel.position.set(0, 0, 0);

  scene.add(courtModel);
  worldOctree.fromGraphNode(courtModel);
}

async function loadPlayer() {
  playerRoot = new THREE.Group();
  scene.add(playerRoot);

  playerModel = await loadFBX(PLAYER_MODEL_PATH);
  playerModel.scale.setScalar(PLAYER_SCALE);
  playerModel.position.set(0, 0, 0);
  playerModel.rotation.set(0, 0, 0);
  setShadows(playerModel, new THREE.Color(1.2, 1.2, 1.2), true);
  playerRoot.add(playerModel);

  playerMixer = new THREE.AnimationMixer(playerModel);

  const kickFBX = await loadFBX(PLAYER_KICK_PATH);
  const celebrateFBX = await loadFBX(PLAYER_CELEBRATE_PATH);

  if (kickFBX.animations?.length) {
    playerActions.kick = playerMixer.clipAction(kickFBX.animations[0]);
  }

  if (celebrateFBX.animations?.length) {
    playerActions.celebrate = playerMixer.clipAction(celebrateFBX.animations[0]);
  }

  resetPlayerPosition();
  syncPlayerVisual();
}

async function loadGoalkeeper() {
  goalkeeperRoot = new THREE.Group();
  goalkeeperRoot.position.copy(GOALKEEPER_HOME);
  scene.add(goalkeeperRoot);

  goalkeeperModel = await loadFBX(GOALKEEPER_MODEL_PATH);
  goalkeeperModel.scale.setScalar(GOALKEEPER_SCALE);
  goalkeeperModel.position.set(0, 0, 0);
  setShadows(goalkeeperModel, new THREE.Color(1.2, 1.2, 1.2), false);
  goalkeeperRoot.add(goalkeeperModel);

  goalkeeperMixer = new THREE.AnimationMixer(goalkeeperModel);

  const catch1FBX = await loadFBX(GOALKEEPER_CATCH_1_PATH);
  const catch2FBX = await loadFBX(GOALKEEPER_CATCH_2_PATH);
  const diveFBX = await loadFBX(GOALKEEPER_DIVE_PATH);

  if (catch1FBX.animations?.length) {
    goalkeeperActions.catch1 = goalkeeperMixer.clipAction(catch1FBX.animations[0]);
  }

  if (catch2FBX.animations?.length) {
    goalkeeperActions.catch2 = goalkeeperMixer.clipAction(catch2FBX.animations[0]);
  }

  if (diveFBX.animations?.length) {
    goalkeeperActions.dive = goalkeeperMixer.clipAction(diveFBX.animations[0]);
  }

  syncGoalkeeperVisual();
}

async function loadGame() {
  setMessage('Cargando cancha, jugador y portero...');

  await loadCourt();
  await loadPlayer();
  await loadGoalkeeper();

  createBallMesh();
  updateHUD();
  resetBallForNextShot();
  updateCamera();

  setMessage('Haz clic para comenzar');
}

// ======================================================
// INPUT
// ======================================================
document.addEventListener('keydown', (event) => {
  keys[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === document.body) {
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0017;
    pitch = THREE.MathUtils.clamp(pitch, MIN_PITCH, MAX_PITCH);
  }
});

document.addEventListener('mousedown', async () => {
  if (document.pointerLockElement !== document.body) {
    try {
      await document.body.requestPointerLock();

      if (!gameStarted) {
        gameStarted = true;
        gamePaused = false;
        startLevel(1);
      }
    } catch (error) {
      console.warn('No se pudo activar el pointer lock:', error);
    }
    return;
  }

  if (gameStarted && !gamePaused) {
    shootBall();
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== document.body) {
    setMessage(gameStarted ? 'Haz clic para continuar' : 'Haz clic para comenzar');
  }
});

// ======================================================
// ANIMACIÓN GENERAL
// ======================================================
function teleportPlayerIfOob() {
  if (playerCollider.start.y < -8 || Number.isNaN(playerCollider.start.y)) {
    resetPlayerPosition();
  }
}

function updateTimers(deltaTime) {
  if (!gameStarted || gamePaused) return;

  timeLeft -= deltaTime;
  if (timeLeft < 0) timeLeft = 0;

  updateHUD();

  if (timeLeft <= 0 && !levelTransition) {
    if (goals >= targetGoals) {
      levelTransition = true;
    } else if (!ball.kicked || shotResolved) {
      failLevel();
    }
  }
}

function updateShotReset(deltaTime) {
  if (resetShotTimer < 0) return;

  resetShotTimer -= deltaTime;

  if (resetShotTimer <= 0) {
    if (levelTransition) {
      advanceLevel();
      return;
    }

    if (goals >= targetGoals) {
      levelTransition = true;
      advanceLevel();
      return;
    }

    if (shotsLeft <= 0) {
      failLevel();
      return;
    }

    if (timeLeft <= 0) {
      failLevel();
      return;
    }

    resetBallForNextShot();
    setMessage('Apunta y dispara');
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, clock.getDelta());

  if (playerMixer) playerMixer.update(dt);
  if (goalkeeperMixer) goalkeeperMixer.update(dt);

  if (playerModel && !pendingShot && kickLockTimer <= 0) {
    applyStandingPose();
  }

  if (kickLockTimer > 0) {
    kickLockTimer -= dt;
  }

  const subDt = dt / STEPS_PER_FRAME;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    if (!gamePaused) {
      controls(subDt);
      updatePlayer(subDt);
      teleportPlayerIfOob();
      updatePendingShot(subDt);
      updateBall(subDt);
      updateGoalkeeper(subDt);
    }
  }

  syncPlayerVisual();
  updateCamera();
  updateTimers(dt);
  updateShotReset(dt);

  renderer.render(scene, camera);
  stats.update();
}

// ======================================================
// RESIZE
// ======================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ======================================================
// INIT
// ======================================================
(async function init() {
  try {
    await loadGame();
    animate();
  } catch (error) {
    console.error('Error cargando el juego:', error);
    setMessage('Error cargando el juego. Revisa rutas y nombres exactos de archivos FBX.');
  }
})();