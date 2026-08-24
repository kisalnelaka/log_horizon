import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation';

// 1. Scene & Canvas Initialization
const container = document.querySelector<HTMLDivElement>('#app') || document.body;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a20);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100.0
);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

// 2. Lighting & Environment Setup
const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(10.0, 20.0, 10.0);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
scene.add(mainLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// --- PROCEDURAL TERRAIN GENERATION ---
// A mathematical height function for rolling hills
function getTerrainHeight(x: number, z: number): number {
  const h1 = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.8;
  const h2 = Math.sin(x * 0.05) * 1.5;
  return h1 + h2; // Returns world Y height at any (x, z) coordinate
}

const terrainGeometry = new THREE.PlaneGeometry(60, 60, 60, 60);
terrainGeometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

const posAttribute = terrainGeometry.attributes.position;
for (let i = 0; i < posAttribute.count; i++) {
  const x = posAttribute.getX(i);
  const z = posAttribute.getZ(i);
  posAttribute.setY(i, getTerrainHeight(x, z));
}
terrainGeometry.computeVertexNormals();

const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0x333b42,
  roughness: 0.8,
  metalness: 0.2,
  flatShading: true, // Gives a clean low-poly aesthetic
});

const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

// Subtle grid overlay to keep spatial awareness
const gridHelper = new THREE.GridHelper(60, 60, 0x555555, 0x333333);
gridHelper.position.y = 0.01; // Slightly above terrain to avoid z-fighting
scene.add(gridHelper);

// 3. Camera & Mouse Look Controls
let yaw = 0;
let pitch = 0.2;
const sensitivity = 0.0025;
const cameraDistance = 3.5;

renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    yaw -= e.movementX * sensitivity;
    pitch += e.movementY * sensitivity;
    pitch = Math.max(-0.3, Math.min(0.8, pitch));
  }
});

// 4. Inputs & Physics Variables
const keysPressed: { [code: string]: boolean } = {};
let charPosY = 0;
let velocityY = 0;
const gravity = -20.0;
const jumpStrength = 7.5;
let isGrounded = true;
let isCrouching = false;
let jumpMovementState = 'idle';

window.addEventListener('keydown', (e) => {
  keysPressed[e.code] = true;

  if (e.code === 'Space' && isGrounded && !isCrouching) {
    const isSprinting = (keysPressed['ShiftLeft'] || keysPressed['ShiftRight']);
    const isMoving = 
      keysPressed['KeyW'] || keysPressed['KeyS'] || 
      keysPressed['KeyD'] || keysPressed['KeyA'];

    if (!isMoving) {
      jumpMovementState = 'idle';
    } else if (isSprinting) {
      jumpMovementState = 'run';
    } else {
      jumpMovementState = 'walk';
    }

    velocityY = jumpStrength;
    isGrounded = false;
  }

  if (e.code === 'KeyC' && isGrounded) {
    isCrouching = !isCrouching;
  }
});

window.addEventListener('keyup', (e) => {
  keysPressed[e.code] = false;
});

window.addEventListener('blur', () => {
  Object.keys(keysPressed).forEach((k) => (keysPressed[k] = false));
});

// 5. VRM & Animation State Machine
let currentVrm: VRM | null = null;
let mixer: THREE.AnimationMixer | null = null;
const actions: { [key: string]: THREE.AnimationAction } = {};
let currentActionName: string | null = null;

function fadeToAction(name: string, duration = 0.2) {
  if (currentActionName === name) return; 
  
  const nextAction = actions[name];
  if (nextAction) {
    nextAction.reset().fadeIn(duration).play();
    const prevAction = currentActionName ? actions[currentActionName] : null;
    if (prevAction) prevAction.fadeOut(duration);
    currentActionName = name;
  }
}

// 6. Model & Animation Loader
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const animationFiles: Record<string, string> = {
  idle: '/animations/idle.fbx',
  walk: '/animations/walk.fbx',
  run: '/animations/run.fbx',
  jump: '/animations/jump.fbx',
  walkJump: '/animations/walkJump.fbx',
  runJump: '/animations/runJump.fbx',
  crouch: '/animations/crouch.fbx',
  crouchWalk: '/animations/crouchWalk.fbx',
};

loader.load(
  '/MyCharacter.vrm',
  async (gltf) => {
    const vrm = gltf.userData.vrm as VRM;
    if (!vrm) return;

    VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);

    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    scene.add(vrm.scene);
    currentVrm = vrm;

    mixer = new THREE.AnimationMixer(vrm.scene);

    for (const [key, filePath] of Object.entries(animationFiles)) {
      try {
        const clip = await loadMixamoAnimation(filePath, vrm);
        actions[key] = mixer.clipAction(clip);
      } catch (err) {
        console.warn(`Optional or missing animation skipped (${key}):`, err);
      }
    }

    if (actions['idle']) {
      actions['idle'].play();
      currentActionName = 'idle';
    }

    // Set initial character position on top of the terrain height at origin
    currentVrm.scene.position.y = getTerrainHeight(0, 0);
    charPosY = currentVrm.scene.position.y;

    console.log('Terrain & Character Initialized Successfully!');
  },
  undefined,
  (error) => console.error('Error loading VRM model:', error)
);

// 7. Game Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  if (currentVrm && mixer) {
    const charPos = currentVrm.scene.position;

    // --- Movement Vector Math ---
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const moveVector = new THREE.Vector3(0, 0, 0);

    if (keysPressed['KeyW']) { moveVector.x += forwardX; moveVector.z += forwardZ; }
    if (keysPressed['KeyS']) { moveVector.x -= forwardX; moveVector.z -= forwardZ; }
    if (keysPressed['KeyD']) { moveVector.x += rightX; moveVector.z += rightZ; }
    if (keysPressed['KeyA']) { moveVector.x -= rightX; moveVector.z -= rightZ; }

    const isMoving = moveVector.lengthSq() > 0;
    const isSprinting = (keysPressed['ShiftLeft'] || keysPressed['ShiftRight']) && isMoving && !isCrouching && isGrounded;

    if (isMoving) {
      moveVector.normalize();
      const speed = isCrouching ? 1.5 : isSprinting ? 6.5 : 3.0;
      charPos.addScaledVector(moveVector, speed * deltaTime);
      currentVrm.scene.rotation.y = Math.atan2(-moveVector.x, -moveVector.z);
    }

    // --- Surface Collision & Terrain Height Sampling ---
    const groundHeight = getTerrainHeight(charPos.x, charPos.z);

    if (!isGrounded) {
      velocityY += gravity * deltaTime;
      charPosY += velocityY * deltaTime;

      // Check if character has landed back down onto the rolling terrain surface
      if (charPosY <= groundHeight) {
        charPosY = groundHeight;
        velocityY = 0;
        isGrounded = true;
        jumpMovementState = 'idle';
      }
    } else {
      // Snuggly lock character height to the rolling hills as they walk/crouch
      charPosY = groundHeight;
    }
    charPos.y = charPosY;

    // --- Dynamic Camera Position ---
    const cameraTargetHeight = isCrouching ? 0.8 : 1.3;
    camera.position.x = charPos.x + cameraDistance * Math.sin(yaw) * Math.cos(pitch);
    camera.position.y = charPosY + cameraTargetHeight + cameraDistance * Math.sin(pitch);
    camera.position.z = charPos.z + cameraDistance * Math.cos(yaw) * Math.cos(pitch);
    camera.lookAt(charPos.x, charPosY + cameraTargetHeight, charPos.z);

    // --- Animation State Switching ---
    if (!isGrounded) {
      if (jumpMovementState === 'run' && actions['runJump']) {
        fadeToAction('runJump', 0.1);
      } else if (jumpMovementState === 'walk' && actions['walkJump']) {
        fadeToAction('walkJump', 0.1);
      } else {
        fadeToAction('jump', 0.1);
      }
    } else if (isCrouching) {
      if (isMoving && actions['crouchWalk']) {
        fadeToAction('crouchWalk', 0.2);
      } else {
        fadeToAction('crouch', 0.2);
      }
    } else if (isMoving) {
      fadeToAction(isSprinting ? 'run' : 'walk', 0.2);
    } else {
      fadeToAction('idle', 0.2);
    }

    mixer.update(deltaTime);
    currentVrm.update(deltaTime);
  }

  renderer.render(scene, camera);
}

animate();

// 8. Handle Window Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});