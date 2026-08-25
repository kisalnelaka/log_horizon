import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation';
import { AUTH_CONFIG } from './config';

// --- 1. AUTHENTICATION CONTROLLER ---
const loginOverlay = document.getElementById('login-overlay') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const errorMsg = document.getElementById('error-msg') as HTMLDivElement;

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const enteredUser = usernameInput.value.trim();
  const enteredPass = passwordInput.value.trim();

  if (enteredUser === AUTH_CONFIG.username && enteredPass === AUTH_CONFIG.password) {
    loginOverlay.style.display = 'none';
    errorMsg.style.display = 'none';

    // Initialize 3D Engine on successful login
    initGame();
  } else {
    errorMsg.style.display = 'block';
  }
});

// --- 2. GAME ENGINE INITIALIZATION ---
function initGame() {
  const container = document.querySelector<HTMLDivElement>('#app') || document.body;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a20);
  scene.fog = new THREE.FogExp2(0x1a1a20, 0.025);

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

  // Lighting
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
  mainLight.position.set(10.0, 20.0, 10.0);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  scene.add(mainLight);

  const ambientLight = new THREE.AmbientLight(0xddeeff, 0.6);
  scene.add(ambientLight);

  // Procedural Terrain Height Function
  function getTerrainHeight(x: number, z: number): number {
    const h1 = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.8;
    const h2 = Math.sin(x * 0.05) * 1.5;
    return h1 + h2;
  }

  const terrainGeometry = new THREE.PlaneGeometry(60, 60, 60, 60);
  terrainGeometry.rotateX(-Math.PI / 2);

  const posAttribute = terrainGeometry.attributes.position;
  for (let i = 0; i < posAttribute.count; i++) {
    const x = posAttribute.getX(i);
    const z = posAttribute.getZ(i);
    posAttribute.setY(i, getTerrainHeight(x, z));
  }
  terrainGeometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4a3f,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
  });

  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Lake Feature
  const waterGeometry = new THREE.PlaneGeometry(12, 12);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2277aa,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  const lakeMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  const lakeX = 10;
  const lakeZ = -10;
  lakeMesh.position.set(lakeX, getTerrainHeight(lakeX, lakeZ) - 0.2, lakeZ);
  scene.add(lakeMesh);

  // Collision Array
  const colliders: { x: number; z: number; radius: number }[] = [];
  colliders.push({ x: lakeX, z: lakeZ, radius: 5.5 });

  // Load FBX Environment Assets
  const fbxLoader = new FBXLoader();
  fbxLoader.load(
    '/models/environment_pack.fbx',
    (fbx) => {
      const sourceMeshes: THREE.Object3D[] = [];
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          sourceMeshes.push(child);
        }
      });

      if (sourceMeshes.length === 0) return;

      for (let i = 0; i < 20; i++) {
        const rx = (Math.random() - 0.5) * 45;
        const rz = (Math.random() - 0.5) * 45;

        if (Math.hypot(rx, rz) > 5 && Math.hypot(rx - lakeX, rz - lakeZ) > 7) {
          const randomSource = sourceMeshes[Math.floor(Math.random() * sourceMeshes.length)];
          const clone = randomSource.clone(true);
          
          // Environment prop scaling
          const scale = 0.5 + Math.random() * 0.1;
          clone.scale.set(scale, scale, scale);

          const y = getTerrainHeight(rx, rz);
          clone.position.set(rx, y, rz);

          clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          scene.add(clone);
          colliders.push({ x: rx, z: rz, radius: 0.8 });
        }
      }
      console.log('Environment pack loaded and scattered successfully!');
    },
    undefined,
    (err) => console.error('Error loading environment FBX pack:', err)
  );

  // Camera & Movement Controls State
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
      const isSprinting = keysPressed['ShiftLeft'] || keysPressed['ShiftRight'];
      const isMoving =
        keysPressed['KeyW'] || keysPressed['KeyS'] ||
        keysPressed['KeyD'] || keysPressed['KeyA'];

      if (!isMoving) jumpMovementState = 'idle';
      else if (isSprinting) jumpMovementState = 'run';
      else jumpMovementState = 'walk';

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

  // VRM Model & Animation Loading
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
          console.warn(`Optional animation skipped (${key}):`, err);
        }
      }

      if (actions['idle']) {
        actions['idle'].play();
        currentActionName = 'idle';
      }

      currentVrm.scene.position.y = getTerrainHeight(0, 0);
      charPosY = currentVrm.scene.position.y;
      console.log('Character & Environment Loaded Successfully!');
    },
    undefined,
    (error) => console.error('Error loading VRM model:', error)
  );

  // Render & Physics Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (currentVrm && mixer) {
      const charPos = currentVrm.scene.position;

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

        const nextX = charPos.x + moveVector.x * speed * deltaTime;
        const nextZ = charPos.z + moveVector.z * speed * deltaTime;

        let collides = false;
        for (const col of colliders) {
          const dist = Math.hypot(nextX - col.x, nextZ - col.z);
          if (dist < col.radius + 0.3) {
            collides = true;
            break;
          }
        }

        if (!collides) {
          charPos.x = nextX;
          charPos.z = nextZ;
        }

        currentVrm.scene.rotation.y = Math.atan2(-moveVector.x, -moveVector.z);
      }

      const groundHeight = getTerrainHeight(charPos.x, charPos.z);

      if (!isGrounded) {
        velocityY += gravity * deltaTime;
        charPosY += velocityY * deltaTime;

        if (charPosY <= groundHeight) {
          charPosY = groundHeight;
          velocityY = 0;
          isGrounded = true;
          jumpMovementState = 'idle';
        }
      } else {
        charPosY = groundHeight;
      }
      charPos.y = charPosY;

      const cameraTargetHeight = isCrouching ? 0.8 : 1.3;
      camera.position.x = charPos.x + cameraDistance * Math.sin(yaw) * Math.cos(pitch);
      camera.position.y = charPosY + cameraTargetHeight + cameraDistance * Math.sin(pitch);
      camera.position.z = charPos.z + cameraDistance * Math.cos(yaw) * Math.cos(pitch);
      camera.lookAt(charPos.x, charPosY + cameraTargetHeight, charPos.z);

      if (!isGrounded) {
        if (jumpMovementState === 'run' && actions['runJump']) fadeToAction('runJump', 0.1);
        else if (jumpMovementState === 'walk' && actions['walkJump']) fadeToAction('walkJump', 0.1);
        else fadeToAction('jump', 0.1);
      } else if (isCrouching) {
        if (isMoving && actions['crouchWalk']) fadeToAction('crouchWalk', 0.2);
        else fadeToAction('crouch', 0.2);
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

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}