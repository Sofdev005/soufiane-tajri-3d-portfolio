import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {
  ANIMALS,
  ASSETS,
  CAMP_PLACEMENTS,
  CDN,
  CROPS,
  FARM_PROPS,
  FENCES,
  FLOWER_PATCHES,
  HAY_BALES,
  STATIONS,
  TREES,
  WORLD_EDGE,
} from '../models.js';
import { LINKS, PORTFOLIO, PROJECTS } from '../content.js';

const $ = (selector) => document.querySelector(selector);
const world = $('#world');
const intro = $('#intro');
const startButton = $('#start');
const startLabel = $('#startLabel');
const loadStatus = $('#load-status');
const stationCard = $('#station');
const visitedLabel = $('#visited');
const nearbyText = $('#nearbyText');
const interactPrompt = $('#interact-prompt');
const interactLabel = $('#interact-label');
const interactProgress = $('#interact-progress');
const toast = $('#toast');
const fatal = $('#fatal');
const loadProgress = $('#load-progress');
const timeOfDayToggle = $('#time-of-day-toggle');
const soundToggle = $('#sound-toggle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTERACTION_HOLD_DURATION = 900;
const projectImagePreloads = new Map();

function preloadProjectImages() {
  const preload = () => {
    for (const project of PROJECTS) {
      if (!project.image || project.image.startsWith('data:') || projectImagePreloads.has(project.image)) continue;
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.src = project.image;
      projectImagePreloads.set(project.image, image);
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 1500 });
  else window.setTimeout(preload, 500);
}

const scene = new THREE.Scene();
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512;
skyCanvas.height = 256;
const skyContext = skyCanvas.getContext('2d');
const skyGradient = skyContext.createLinearGradient(0, 0, 0, skyCanvas.height);
skyGradient.addColorStop(0, '#493b65');
skyGradient.addColorStop(0.55, '#c76f72');
skyGradient.addColorStop(1, '#f5ae69');
skyContext.fillStyle = skyGradient;
skyContext.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.background = skyTexture;
scene.fog = new THREE.Fog(0xa66f72, 170, 260);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 48, 42);
const CAM_OFFSET = new THREE.Vector3(0, 34, 13);
const SUN_OFFSET = new THREE.Vector3(-20, 13, 14);
const instanceDummy = new THREE.Object3D();
const cameraDesired = new THREE.Vector3();
const cameraLookAt = new THREE.Vector3();
const occlusionTarget = new THREE.Vector3();
const occlusionRay = new THREE.Vector3();
let cameraDistance = 104;
let baseCameraFov = 42;

function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1
    ? Math.min(70, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) / aspect)))
    : 42;
  baseCameraFov = camera.fov;
  camera.updateProjectionMatrix();
}

fitCamera();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (error) {
  fatal.hidden = false;
  fatal.textContent = 'This browser could not start the 3D scene. Try a browser with WebGL enabled.';
  loadStatus.textContent = '3D is unavailable';
  console.error('Unable to create the Three.js renderer:', error);
}

if (renderer) {
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-label', 'Interactive campground world. Use WASD, ZQSD, arrow keys, or the touch joystick to move.');
  renderer.domElement.tabIndex = 0;
  world.appendChild(renderer.domElement);
}

const hemisphere = new THREE.HemisphereLight(0xffdfc4, 0x514550, 1.18);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xffa05f, 3.1);
sun.position.set(-20, 13, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.02;
sun.shadow.bias = -0.00015;
scene.add(sun);
scene.add(sun.target);
const fillLight = new THREE.DirectionalLight(0x9bb7ed, 0.72);
fillLight.position.set(18, 15, -16);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xff84a3, 0.42);
rimLight.position.set(0, 10, 22);
scene.add(rimLight);
let sunSpriteMaterial;
let timeOfDay = 'golden-hour';

const TIME_OF_DAY_PALETTES = {
  morning: {
    sky: ['#9cc9d0', '#d7e6d5', '#f4e8c7'],
    fog: '#c8dfd8',
    hemisphereSky: '#fff9e9',
    hemisphereGround: '#6a8a62',
    hemisphereIntensity: 1.45,
    sun: '#ffedc4',
    sunIntensity: 2.8,
    fill: '#c8dcf0',
    fillIntensity: 0.45,
    rim: '#d3b9ff',
    rimIntensity: 0.28,
    sprite: '#ffffff',
  },
  'golden-hour': {
    sky: ['#493b65', '#c76f72', '#f5ae69'],
    fog: '#a66f72',
    hemisphereSky: '#ffc28d',
    hemisphereGround: '#51404c',
    hemisphereIntensity: 1.2,
    sun: '#ff9854',
    sunIntensity: 3.1,
    fill: '#94a9e3',
    fillIntensity: 0.72,
    rim: '#ff789a',
    rimIntensity: 0.42,
    sprite: '#ffd27e',
  },
};

const groundGeometry = new THREE.PlaneGeometry(110, 110, 80, 80);
const groundPositions = groundGeometry.attributes.position;
const groundColors = [];
for (let index = 0; index < groundPositions.count; index += 1) {
  const x = groundPositions.getX(index);
  const y = groundPositions.getY(index);
  const elevation = Math.sin(x * 0.16) * Math.cos(y * 0.13) * 0.12 + Math.sin((x + y) * 0.08) * 0.08;
  groundPositions.setZ(index, elevation);
  const shade = THREE.MathUtils.clamp(0.9 + elevation * 0.7 + Math.sin(x * 0.3 + y * 0.2) * 0.035, 0.78, 1.04);
  groundColors.push(0.39 * shade, 0.56 * shade, 0.31 * shade);
}
groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
groundGeometry.computeVertexNormals();
const floor = new THREE.Mesh(
  groundGeometry,
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.14;
floor.receiveShadow = true;
scene.add(floor);

const groundDecor = new THREE.Group();
scene.add(groundDecor);
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const campEnvironment = new THREE.Group();
scene.add(campEnvironment);
let terrainRoot = null;
let terrainGround = null;
let terrainWater = null;
const warnedCampPlacements = new Set();

const assetCache = new Map();
const assetClips = new Map();
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.180.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);
loader.setMeshoptDecoder(MeshoptDecoder);
const assetErrors = [];
const assetControllers = new Map();
let assetCount = 0;
const assetKeys = Object.keys(ASSETS);
const totalAssets = assetKeys.length;
loadProgress.max = totalAssets;
let goatVisual;
let goatIsMoving = false;
let started = false;
let jumpVelocity = 0;
let jumpHeight = 0;
let activeStation = null;
let nearbyStation = null;
let toastTimeout;
let projectIndex = 0;
const visited = new Set(readVisitedStations());
const heldKeys = new Set();
const clock = new THREE.Clock();
const colliders = [];
const materialCache = new Map();
const geometryCache = new Map();
const MODEL_OFFSET = [3.3, 0, -1.7];
const ENTER_STATION_RADIUS = 4.2;
const EXIT_STATION_RADIUS = 5.8;
const requiredAssetKeys = new Set(['backpacker', 'terrain']);
const movementVelocity = new THREE.Vector2();
const touchMovement = new THREE.Vector2();
let touchSprinting = false;
let jumpBuffer = 0;
let coyoteTime = 0;
let cameraIntro = 1;
let cameraIntroActive = false;
let soundEnabled = false;
let audioContext;
let audioMasterGain;
let ambientMusicBus;
let ambientPadVoices = [];
let ambientMusicTimer = 0;
let ambientMusicStep = 0;
let interactionHoldStationId = null;
let interactionHoldSource = null;
let interactionHoldStartedAt = 0;
let interactionHoldProgress = 0;
let interactionShakeKick = 0;
let lastFootstep = 0;
let dustTimer = 0;
let confettiShown = false;
const fadingMaterials = new Map();
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const dynamicAnimations = [];
let animationFrame = 0;
let lastRenderCallsLogged = false;

const player = new THREE.Group();
player.position.set(0, 0, 0);
player.rotation.y = Math.PI;
scene.add(player);

function makeMaterial(color, roughness = 0.85) {
  const key = `${color}:${roughness}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materialCache.get(key);
}

function makeGeometry(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
}

function addCollider(x, z, radius) {
  colliders.push({ x, z, radius });
}

function resolveCollisions(position, radius = 0.45) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const collider of colliders) {
      const dx = position.x - collider.x;
      const dz = position.z - collider.z;
      const distance = Math.hypot(dx, dz);
      const minimum = collider.radius + radius;
      if (distance < minimum) {
        const safeDistance = Math.max(distance, 1e-4);
        const nx = distance > 1e-4 ? dx / safeDistance : 1;
        const nz = distance > 1e-4 ? dz / safeDistance : 0;
        position.x = collider.x + nx * minimum;
        position.z = collider.z + nz * minimum;
      }
    }
  }
}

function lerpAngle(start, end, amount) {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * amount;
}

function readVisitedStations() {
  try {
    const stored = JSON.parse(localStorage.getItem('cozy-farm-visited') || '[]');
    return Array.isArray(stored) ? stored.filter((id) => STATIONS.some((station) => station.id === id)) : [];
  } catch (error) {
    console.warn('Could not restore visited stations from local storage.', error);
    return [];
  }
}

function persistVisitedStations() {
  try {
    localStorage.setItem('cozy-farm-visited', JSON.stringify([...visited]));
  } catch (error) {
    console.warn('Could not save visited stations to local storage.', error);
  }
}

function makeBox(parent, size, color, position, rotation = [0, 0, 0], materialOptions = {}) {
  const geometryKey = `box:${size.join(',')}`;
  const materialKey = `${color}:${JSON.stringify(materialOptions)}`;
  let material = materialCache.get(materialKey);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...materialOptions });
    materialCache.set(materialKey, material);
  }
  const mesh = new THREE.Mesh(
    makeGeometry(geometryKey, () => new THREE.BoxGeometry(...size)),
    material,
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeGoat() {
  const goat = new THREE.Group();
  const wool = makeMaterial(0xf0e6cd);
  const face = makeMaterial(0x9a775e);
  const hoof = makeMaterial(0x554b41);
  const horn = makeMaterial(0xd7bd88);
  const body = new THREE.Group();
  goat.add(body);
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.63, 1), wool);
  torso.scale.set(0.82, 0.72, 1.1);
  torso.position.set(0, 0.87, -0.08);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), face);
  head.scale.set(0.78, 0.95, 0.9);
  head.position.set(0, 1.12, 0.62);
  head.castShadow = true;
  body.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), makeMaterial(0xe4cdb0));
  muzzle.position.set(0, 0.99, 0.87);
  body.add(muzzle);

  for (const side of [-1, 1]) {
    const ear = makeBox(body, [0.13, 0.13, 0.38], 0x92725c, [side * 0.31, 1.34, 0.58], [side * -0.24, 0, side * 0.66]);
    ear.castShadow = true;
    const hornMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), horn);
    hornMesh.position.set(side * 0.18, 1.52, 0.48);
    hornMesh.rotation.z = side * -0.2;
    hornMesh.castShadow = true;
    body.add(hornMesh);

    const leg = makeBox(body, [0.16, 0.54, 0.17], 0xe7d9bd, [side * 0.36, 0.34, 0.26]);
    leg.castShadow = true;
    makeBox(body, [0.18, 0.12, 0.22], 0x554b41, [side * 0.36, 0.08, 0.29]);
    const backLeg = makeBox(body, [0.16, 0.54, 0.17], 0xe7d9bd, [side * 0.36, 0.34, -0.43]);
    backLeg.castShadow = true;
    makeBox(body, [0.18, 0.12, 0.22], 0x554b41, [side * 0.36, 0.08, -0.4]);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 5), wool);
  tail.position.set(0, 1.12, -0.7);
  tail.rotation.x = -Math.PI / 3;
  body.add(tail);
  goat.userData.body = body;
  return goat;
}

function makeBackpackerFallback() {
  const character = new THREE.Group();
  const body = new THREE.Group();
  const jacket = makeMaterial(0x356750);
  const pack = makeMaterial(0x8c5635);
  const skin = makeMaterial(0xd8a879);
  const trousers = makeMaterial(0x374151);
  body.position.y = 0.9;
  character.add(body);
  makeBox(body, [0.62, 0.72, 0.36], 0x356750, [0, 0.15, 0]);
  makeBox(body, [0.38, 0.48, 0.24], 0x8c5635, [0, 0.2, -0.3]);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), skin);
  head.position.set(0, 0.7, 0.03);
  head.castShadow = true;
  body.add(head);
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = makeBox(body, [0.16, 0.55, 0.17], 0x356750, [side * 0.42, 0.12, 0.02]);
    arm.userData.baseRotation = side * -0.12;
    limbs.push({ object: arm, phase: side * Math.PI });
    const leg = makeBox(body, [0.2, 0.6, 0.22], 0x374151, [side * 0.17, -0.48, 0]);
    leg.userData.baseRotation = 0;
    limbs.push({ object: leg, phase: side * Math.PI });
  }
  character.userData.body = body;
  character.userData.bodyRestY = body.position.y;
  character.userData.limbs = limbs;
  character.userData.packMaterials = { jacket, pack, skin, trousers };
  return character;
}

goatVisual = makeBackpackerFallback();
player.add(goatVisual);

function addRoad(a, b, width = 3.2) {
  const start = new THREE.Vector3(a[0], 0, a[1]);
  const end = new THREE.Vector3(b[0], 0, b[1]);
  const distance = start.distanceTo(end);
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, distance + 1.1),
    makeMaterial(0xc6a06b),
  );
  road.position.set((start.x + end.x) / 2, -0.045, (start.z + end.z) / 2);
  road.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
  road.receiveShadow = true;
  worldGroup.add(road);

  const edgeMaterial = makeMaterial(0xd4b988);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.035, distance + 0.7),
      edgeMaterial,
    );
    edge.position.set((start.x + end.x) / 2 + Math.cos(road.rotation.y) * side * (width / 2 - 0.08), 0.006, (start.z + end.z) / 2 - Math.sin(road.rotation.y) * side * (width / 2 - 0.08));
    edge.rotation.y = road.rotation.y;
    worldGroup.add(edge);
  }
}

const route = [];

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const treePlacements = [];
const flowerPlacements = [];
const flowerPatchIndices = new Map();
const treeInstanceSets = new Map();
let flowerStems;
let flowerBlooms;
let cropInstances;
let grassInstances;
let pollenInstances;
let dustInstances;
const animalVisuals = [];
const hayVisuals = [];
const fencePosts = [];
const fenceRails = [];

function addTree(tree) {
  treePlacements.push(tree);
  addCollider(tree.x, tree.z, 0.62 * tree.scale);
}

function distanceToRoute(x, z) {
  let minimum = Infinity;
  for (let index = 0; index < route.length - 1; index += 1) {
    const [ax, az] = route[index];
    const [bx, bz] = route[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / lengthSquared, 0, 1) : 0;
    minimum = Math.min(minimum, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return minimum;
}

function addFlowerPatch(x, z, spread = 2, patchId = null) {
  const colors = [0xe8a95d, 0xd98279, 0xf1d982, 0xf5ebd6];
  const random = seededRandom(Math.round((x + 47) * 991 + (z + 32) * 173));
  const indices = [];
  for (let attempt = 0; indices.length < 13 && attempt < 80; attempt += 1) {
    const flowerX = x + (random() - 0.5) * spread;
    const flowerZ = z + (random() - 0.5) * spread;
    if (distanceToRoute(flowerX, flowerZ) < 2.15) continue;
    indices.push(flowerPlacements.length);
    flowerPlacements.push({
      x: flowerX,
      z: flowerZ,
      color: colors[Math.floor(random() * colors.length)],
      patchId,
    });
  }
  if (patchId !== null) flowerPatchIndices.set(patchId, indices);
}

function addHay(x, z, rotation = 0) {
  const bale = new THREE.Group();
  bale.position.set(x, 0, z);
  bale.rotation.y = rotation;
  const body = new THREE.Mesh(makeGeometry('hay-cylinder', () => new THREE.CylinderGeometry(0.62, 0.62, 0.9, 7)), makeMaterial(0xc9a45c));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.61;
  body.castShadow = true;
  bale.add(body);
  const straw = makeMaterial(0xd6b76f);
  const end = new THREE.Mesh(makeGeometry('hay-end', () => new THREE.CircleGeometry(0.58, 7)), straw);
  end.rotation.y = Math.PI / 2;
  end.position.set(0.46, 0.61, 0);
  bale.add(end);
  groundDecor.add(bale);
  addCollider(x, z, 0.78);
  hayVisuals.push({ group: bale, x, z, rotation });
}

function addFence(x1, z1, x2, z2, segments = 5) {
  const dx = (x2 - x1) / segments;
  const dz = (z2 - z1) / segments;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  for (let i = 0; i <= segments; i += 1) {
    const x = x1 + dx * i;
    const z = z1 + dz * i;
    fencePosts.push({ x, z, angle });
    addCollider(x, z, 0.2);
  }
  for (const y of [0.38, 0.72]) {
    fenceRails.push({ x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, angle, length: length + 0.05 });
  }
  const samples = Math.ceil(length / 0.65);
  for (let index = 1; index < samples; index += 1) {
    addCollider(x1 + (x2 - x1) * index / samples, z1 + (z2 - z1) * index / samples, 0.18);
  }
}

function createFallbackBuilding(kind) {
  const building = new THREE.Group();
  const walls = kind === 'barn' ? 0xb95041 : kind === 'farmhouse' ? 0xe3d7b8 : kind === 'windmill' ? 0xdfd2b2 : 0xd7bc78;
  const width = kind === 'barn' ? 6.4 : kind === 'farmhouse' ? 6 : kind === 'windmill' ? 3.6 : 5;
  const depth = kind === 'windmill' ? 3.6 : 4.7;
  const height = kind === 'windmill' ? 5 : 3.8;
  makeBox(building, [width, height, depth], walls, [0, height / 2, 0]);

  if (kind === 'windmill') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 4), makeMaterial(0x765540));
    roof.position.y = height + 0.8;
    roof.rotation.y = Math.PI / 4;
    building.add(roof);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), makeMaterial(0x795b3f));
    hub.position.set(0, 4.1, depth / 2 + 0.15);
    building.add(hub);
    const blades = new THREE.Group();
    blades.position.set(0, 4.1, depth / 2 + 0.2);
    for (let i = 0; i < 4; i += 1) {
      makeBox(blades, [0.22, 2.65, 0.1], 0xf4eedb, [0, 1.3, 0], [0, 0, i * Math.PI / 2]);
    }
    building.add(blades);
    building.userData.blades = blades;
  } else {
    const roofColor = kind === 'barn' ? 0x713b36 : 0x855b49;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, 2.25, 4), makeMaterial(roofColor));
    roof.position.set(0, height + 0.9, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = depth / width;
    roof.castShadow = true;
    building.add(roof);
    makeBox(building, [kind === 'barn' ? 1.7 : 1, 2.2, 0.14], kind === 'barn' ? 0x7d332e : 0x846548, [0, 1.1, depth / 2 + 0.08]);
    if (kind === 'barn') makeBox(building, [0.18, 2.2, 0.1], 0xf0d4b8, [0, 1.1, depth / 2 + 0.17]);
  }
  return building;
}

function createBuildingWindowGlow(kind) {
  const positions = {
    farmhouse: { x: [-1.8, 1.8], y: 2.05 },
    barn: { x: [-2.05, 2.05], y: 2.45 },
    farmstand: { x: [-1.4, 1.4], y: 1.65 },
  }[kind];
  if (!positions) return null;

  const windows = new THREE.Group();
  windows.position.set(...MODEL_OFFSET);
  windows.userData.fadable = true;
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc15e,
    emissive: 0xff762e,
    emissiveIntensity: 2.1,
    roughness: 0.38,
  });
  const front = 2.43;
  for (const x of positions.x) {
    makeBox(windows, [0.9, 1.02, 0.12], 0x49332f, [x, positions.y, front]);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.05), glowMaterial);
    pane.position.set(x, positions.y, front + 0.08);
    pane.castShadow = false;
    windows.add(pane);
    makeBox(windows, [0.055, 0.82, 0.06], 0x49332f, [x, positions.y, front + 0.12]);
    makeBox(windows, [0.7, 0.055, 0.06], 0x49332f, [x, positions.y, front + 0.12]);
  }
  const interiorLight = new THREE.PointLight(0xffa05a, 1.35, 7, 2);
  interiorLight.position.set(0, positions.y, 0.7);
  windows.add(interiorLight);
  return windows;
}

function makeTextSprite(title, detail, color, icon) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f2efe4';
  context.beginPath();
  context.roundRect(5, 5, 502, 134, 12);
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = '#09090a';
  context.stroke();
  context.fillStyle = '#17161b';
  context.font = '700 42px "DM Sans", sans-serif';
  context.fillText(`${icon}  ${title}`, 28, 83);
  context.fillStyle = '#62605a';
  context.font = '600 17px "DM Sans", sans-serif';
  context.fillText(detail.toUpperCase(), 30, 112);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(4.7, 1.32, 1);
  sprite.userData = { canvas, context, title, detail, color, icon };
  return sprite;
}

const stationVisuals = new Map();
function addStation(station) {
  const [x, z] = station.position;
  const marker = new THREE.Group();
  marker.position.set(x, 0, z);
  worldGroup.add(marker);

  const sprite = makeTextSprite(station.label, station.subtitle, station.color, station.icon);
  sprite.position.set(0, station.labelHeight, 0);
  marker.add(sprite);
  stationVisuals.set(station.id, { marker, sprite });
}

for (const station of STATIONS) addStation(station);
document.fonts?.ready.then(() => {
  for (const { sprite } of stationVisuals.values()) {
    const { context, canvas, title, detail, icon } = sprite.userData;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f2efe4';
    context.beginPath();
    context.roundRect(5, 5, 502, 134, 12);
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = '#09090a';
    context.stroke();
    context.fillStyle = '#17161b';
    context.font = '700 43px "DM Sans", sans-serif';
    context.fillText(`${icon}  ${title}`, 28, 83);
    context.fillStyle = '#62605a';
    context.font = '600 20px "DM Sans", sans-serif';
    context.fillText(detail.toUpperCase(), 30, 112);
    sprite.material.map.needsUpdate = true;
  }
});

function getTerrainHeight(x, z, surface = 'land') {
  const target = surface === 'water' ? terrainWater : terrainGround;
  if (!target) return terrainRoot ? null : 0;
  terrainRoot?.updateMatrixWorld(true);
  raycaster.set(new THREE.Vector3(x, 45, z), new THREE.Vector3(0, -1, 0));
  raycaster.far = 80;
  const hit = raycaster.intersectObject(target, true)[0];
  return hit ? hit.point.y : null;
}

function findNearestTerrainPoint(x, z, surface, radius = 5) {
  let nearest = null;
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared > radius * radius || (nearest && distanceSquared >= nearest.distanceSquared)) continue;
      const y = getTerrainHeight(x + dx, z + dz, surface);
      if (y !== null) nearest = { x: x + dx, z: z + dz, y, distanceSquared };
    }
  }
  return nearest;
}

function addCampPlacement(placement) {
  const source = assetCache.get(placement.asset);
  if (!source) return;
  const model = cloneSkeleton(source);
  const surface = placement.surface || 'land';
  let x = placement.x;
  let z = placement.z;
  let y = getTerrainHeight(placement.x, placement.z, surface);
  if (y === null && surface === 'water') y = getTerrainHeight(placement.x, placement.z, 'land');
  if (y === null) {
    const nearest = findNearestTerrainPoint(x, z, surface);
    if (nearest) {
      ({ x, z, y } = nearest);
      console.warn(`[placement] "${placement.asset}" at (${placement.x}, ${placement.z}) snapped to ${surface} at (${x}, ${z})`);
    } else if (surface === 'water') {
      const nearestLand = findNearestTerrainPoint(x, z, 'land');
      if (nearestLand) {
        ({ x, z, y } = nearestLand);
        console.warn(`[placement] "${placement.asset}" at (${placement.x}, ${placement.z}) snapped to land at (${x}, ${z})`);
      }
    }
  }
  if (y === null) {
    const warningKey = `${placement.asset}:${placement.x}:${placement.z}`;
    if (!warnedCampPlacements.has(warningKey)) {
      console.warn(`[placement] "${placement.asset}" at (${placement.x}, ${placement.z}) is off the ${surface} mesh – skipped`);
      warnedCampPlacements.add(warningKey);
    }
    return;
  }
  model.position.set(x, y + (placement.lift || 0), z);
  model.rotation.y = placement.rotation || 0;
  model.scale.multiplyScalar(placement.scale || 1);
  if (placement.align) {
    const dx = Math.sin(placement.rotation || 0) * placement.align;
    const dz = Math.cos(placement.rotation || 0) * placement.align;
    const a = getTerrainHeight(x - dx, z - dz, surface);
    const b = getTerrainHeight(x + dx, z + dz, surface);
    if (a !== null && b !== null) model.rotation.x = Math.atan2(a - b, placement.align * 2) * 0.8;
  }
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
  campEnvironment.add(model);
  if (placement.collider) addCollider(x, z, placement.collider);
}

function rebuildCampground() {
  campEnvironment.clear();
  colliders.length = 0;
  terrainRoot = null;
  terrainGround = null;
  terrainWater = null;

  const terrain = assetCache.get('terrain');
  if (terrain) {
    terrainRoot = cloneSkeleton(terrain);
    terrainRoot.name = 'campground-island';
    terrainRoot.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = true;
      const materialNames = (Array.isArray(node.material) ? node.material : [node.material])
        .map((material) => material?.name || '')
        .join(' ');
      const name = `${node.name} ${materialNames}`.toLowerCase();
      if (/water|lake|pond|river|creek/.test(name)) terrainWater = terrainWater || node;
      else if (/ground|land|terrain|grass|island|earth/.test(name)) terrainGround = terrainGround || node;
    });
    if (!terrainGround) {
      let largestArea = 0;
      terrainRoot.traverse((node) => {
        if (!node.isMesh || node === terrainWater) return;
        const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
        const area = size.x * size.z;
        if (area > largestArea) {
          largestArea = area;
          terrainGround = node;
        }
      });
    }
    console.info(`[terrain] ground found: ${Boolean(terrainGround)}, water found: ${Boolean(terrainWater)}`);
    campEnvironment.add(terrainRoot);
    floor.visible = false;
    const spawnHeight = getTerrainHeight(player.position.x, player.position.z);
    if (spawnHeight !== null) player.position.y = spawnHeight;
  } else {
    floor.visible = true;
  }

  for (const placement of CAMP_PLACEMENTS) addCampPlacement(placement);
  for (const station of STATIONS) {
    const marker = stationVisuals.get(station.id)?.marker;
    if (!marker) continue;
    const height = getTerrainHeight(station.position[0], station.position[1]);
    if (height !== null) marker.position.y = height;
  }
}

function buildCampground() {
  buildSkyDecorations();
  rebuildCampground();
}

function buildInstancedFoliage() {
  const tree = new THREE.Object3D();
  for (const type of ['oak', 'apple']) {
    const placements = treePlacements.filter((entry) => entry.type === type);
    if (!placements.length) continue;
    const leavesColor = type === 'apple' ? 0x688d56 : 0x72965d;
    const meshes = [];
    const trunk = new THREE.InstancedMesh(
      makeGeometry('tree-trunk', () => new THREE.CylinderGeometry(0.18, 0.28, 1.45, 6)),
      makeMaterial(0x906442),
      placements.length,
    );
    const crowns = [[1.45, 1.04], [2.05, 0.78], [2.54, 0.5]].map(([y, radius], crownIndex) => {
      const mesh = new THREE.InstancedMesh(
        makeGeometry(`tree-crown-${crownIndex}`, () => new THREE.IcosahedronGeometry(radius, 1)),
        makeMaterial(leavesColor),
        placements.length,
      );
      meshes.push(mesh);
      return mesh;
    });
    meshes.unshift(trunk);
    const fruit = type === 'apple'
      ? new THREE.InstancedMesh(
        makeGeometry('tree-fruit', () => new THREE.SphereGeometry(0.12, 7, 5)),
        makeMaterial(0xd97550),
        placements.length * 3,
      )
      : null;
    if (fruit) meshes.push(fruit);

    placements.forEach((placement, index) => {
      tree.position.set(placement.x, 0.68 * placement.scale, placement.z);
      tree.rotation.set(0, 0, 0);
      tree.scale.setScalar(placement.scale);
      tree.updateMatrix();
      trunk.setMatrixAt(index, tree.matrix);
      crowns.forEach((mesh, crownIndex) => {
        const [y] = [[1.45, 1.04], [2.05, 0.78], [2.54, 0.5]][crownIndex];
        tree.position.set(placement.x, y * placement.scale, placement.z);
        tree.updateMatrix();
        mesh.setMatrixAt(index, tree.matrix);
      });
      if (fruit) {
        [[-0.58, 1.83, 0.34], [0.53, 2.13, 0.17], [0.09, 1.54, -0.58]].forEach(([x, y, z], fruitIndex) => {
          tree.position.set(placement.x + x * placement.scale, y * placement.scale, placement.z + z * placement.scale);
          tree.scale.setScalar(placement.scale);
          tree.updateMatrix();
          fruit.setMatrixAt(index * 3 + fruitIndex, tree.matrix);
        });
      }
    });
    for (const mesh of meshes) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groundDecor.add(mesh);
    }
    treeInstanceSets.set(type, { meshes, count: placements.length });
  }

  if (!flowerPlacements.length) return;
  const stemGeometry = makeGeometry('flower-stem', () => new THREE.CylinderGeometry(0.018, 0.025, 0.27, 4));
  const bloomGeometry = makeGeometry('flower-bloom', () => new THREE.IcosahedronGeometry(0.09, 0));
  flowerStems = new THREE.InstancedMesh(stemGeometry, makeMaterial(0x71915d), flowerPlacements.length);
  flowerBlooms = new THREE.InstancedMesh(bloomGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), flowerPlacements.length);
  flowerPlacements.forEach((flower, index) => {
    tree.position.set(flower.x, 0.13, flower.z);
    tree.scale.set(1, 1, 1);
    tree.rotation.set(0, 0, 0);
    tree.updateMatrix();
    flowerStems.setMatrixAt(index, tree.matrix);
    tree.position.y = 0.3;
    tree.updateMatrix();
    flowerBlooms.setMatrixAt(index, tree.matrix);
    flowerBlooms.setColorAt(index, new THREE.Color(flower.color));
  });
  groundDecor.add(flowerStems, flowerBlooms);
}

function hideTreePlaceholders(type) {
  const set = treeInstanceSets.get(type);
  if (!set) return;
  const zero = new THREE.Object3D();
  zero.scale.setScalar(0);
  zero.updateMatrix();
  for (const mesh of set.meshes) {
    const count = mesh === set.meshes[set.meshes.length - 1] && type === 'apple' ? set.count * 3 : set.count;
    for (let index = 0; index < count; index += 1) mesh.setMatrixAt(index, zero.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function hideFlowerPlaceholder(patchId) {
  const indices = flowerPatchIndices.get(patchId) || [];
  const zero = new THREE.Object3D();
  zero.scale.setScalar(0);
  zero.updateMatrix();
  for (const index of indices) {
    flowerStems.setMatrixAt(index, zero.matrix);
    flowerBlooms.setMatrixAt(index, zero.matrix);
  }
  flowerStems.instanceMatrix.needsUpdate = true;
  flowerBlooms.instanceMatrix.needsUpdate = true;
}

function buildFenceInstances() {
  if (fencePosts.length) {
    const posts = new THREE.InstancedMesh(
      makeGeometry('fence-post', () => new THREE.BoxGeometry(0.16, 0.92, 0.16)),
      makeMaterial(0x60443b),
      fencePosts.length,
    );
    const object = new THREE.Object3D();
    fencePosts.forEach(({ x, z, angle }, index) => {
      object.position.set(x, 0.46, z);
      object.rotation.set(0, angle, 0);
      object.updateMatrix();
      posts.setMatrixAt(index, object.matrix);
    });
    posts.castShadow = true;
    groundDecor.add(posts);
  }
  if (fenceRails.length) {
    const rails = new THREE.InstancedMesh(
      makeGeometry('fence-rail', () => new THREE.BoxGeometry(0.1, 0.12, 1)),
      makeMaterial(0x9a6d4d),
      fenceRails.length,
    );
    const object = new THREE.Object3D();
    fenceRails.forEach(({ x, y, z, angle, length }, index) => {
      object.position.set(x, y, z);
      object.rotation.set(0, angle, 0);
      object.scale.set(1, 1, length);
      object.updateMatrix();
      rails.setMatrixAt(index, object.matrix);
    });
    rails.castShadow = true;
    groundDecor.add(rails);
  }
}

function buildCropInstances() {
  const geometry = makeGeometry('crop', () => new THREE.ConeGeometry(0.24, 1, 4));
  cropInstances = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    CROPS.length,
  );
  const object = new THREE.Object3D();
  CROPS.forEach((crop, index) => {
    object.position.set(crop.x, crop.height / 2, crop.z);
    object.scale.set(1, crop.height, 1);
    object.updateMatrix();
    cropInstances.setMatrixAt(index, object.matrix);
    cropInstances.setColorAt(index, new THREE.Color(crop.color));
  });
  cropInstances.castShadow = true;
  groundDecor.add(cropInstances);
}

function buildPond() {
  const { x, z, radius } = FARM_PROPS.pond;
  const shore = new THREE.Mesh(
    makeGeometry('pond-shore', () => new THREE.CircleGeometry(radius + 0.42, 40)),
    makeMaterial(0xb99f6b),
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(x, -0.025, z);
  const water = new THREE.Mesh(
    makeGeometry('pond-water', () => new THREE.CircleGeometry(radius, 40)),
    new THREE.MeshStandardMaterial({ color: 0x78b8c5, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.015, z);
  water.receiveShadow = true;
  groundDecor.add(shore, water);
}

function buildWorldEdge() {
  const positions = [];
  for (let step = -WORLD_EDGE; step <= WORLD_EDGE; step += 5.5) {
    positions.push([step, -WORLD_EDGE], [step, WORLD_EDGE], [-WORLD_EDGE, step], [WORLD_EDGE, step]);
  }
  const rocks = new THREE.InstancedMesh(
    makeGeometry('edge-rock', () => new THREE.DodecahedronGeometry(0.82, 0)),
    makeMaterial(0x87927c),
    positions.length,
  );
  const object = new THREE.Object3D();
  positions.forEach(([x, z], index) => {
    object.position.set(x, 0.35, z);
    object.scale.set(0.9 + (index % 4) * 0.13, 0.75 + (index % 3) * 0.12, 0.9 + (index % 5) * 0.1);
    object.rotation.set(0, index * 0.47, 0);
    object.updateMatrix();
    rocks.setMatrixAt(index, object.matrix);
  });
  rocks.castShadow = true;
  groundDecor.add(rocks);
}

function buildFarmProps() {
  const { x, z, rotation } = FARM_PROPS.coop;
  const coop = new THREE.Group();
  coop.position.set(x, 0, z);
  coop.rotation.y = rotation;
  makeBox(coop, [2.8, 1.8, 2.3], 0xc98e5d, [0, 0.9, 0]);
  makeBox(coop, [3.1, 0.25, 2.6], 0x804d3b, [0, 1.95, 0]);
  makeBox(coop, [0.8, 1.1, 0.08], 0x684d39, [0, 0.55, 1.18]);
  groundDecor.add(coop);
  addCollider(x, z, 1.55);

  for (const crate of FARM_PROPS.crates) {
    const group = new THREE.Group();
    group.position.set(crate.x, 0, crate.z);
    group.rotation.y = crate.rotation;
    makeBox(group, [1.05, 0.85, 0.85], 0x9b7148, [0, 0.43, 0]);
    makeBox(group, [1.12, 0.09, 0.1], 0xc3a16f, [0, 0.43, 0.44]);
    makeBox(group, [0.1, 0.09, 0.9], 0xc3a16f, [0, 0.43, 0]);
    groundDecor.add(group);
    addCollider(crate.x, crate.z, 0.72);
  }
  for (const rock of FARM_PROPS.rocks) {
    const mesh = new THREE.Mesh(
      makeGeometry('prop-rock', () => new THREE.DodecahedronGeometry(0.7, 0)),
      makeMaterial(0x92907a),
    );
    mesh.position.set(rock.x, 0.34 * rock.scale, rock.z);
    mesh.scale.set(rock.scale, rock.scale * 0.7, rock.scale);
    mesh.castShadow = true;
    groundDecor.add(mesh);
    addCollider(rock.x, rock.z, 0.55 * rock.scale);
  }
  const bushes = new THREE.InstancedMesh(
    makeGeometry('bush', () => new THREE.IcosahedronGeometry(0.72, 1)),
    makeMaterial(0x648357),
    FARM_PROPS.bushes.length,
  );
  const object = new THREE.Object3D();
  FARM_PROPS.bushes.forEach((bush, index) => {
    object.position.set(bush.x, 0.55 * bush.scale, bush.z);
    object.scale.set(bush.scale * 1.3, bush.scale * 0.78, bush.scale);
    object.updateMatrix();
    bushes.setMatrixAt(index, object.matrix);
    addCollider(bush.x, bush.z, 0.68 * bush.scale);
  });
  bushes.castShadow = true;
  groundDecor.add(bushes);
}

function createSpriteTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSkyDecorations() {
  scene.add(camera);
  const sunTexture = createSpriteTexture((context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 16, width / 2, height / 2, 60);
    gradient.addColorStop(0, '#fff3bb');
    gradient.addColorStop(0.45, '#f4bf72');
    gradient.addColorStop(1, '#f4bf7200');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
  sunSpriteMaterial = new THREE.SpriteMaterial({ map: sunTexture, transparent: true, depthWrite: false });
  const sunSprite = new THREE.Sprite(sunSpriteMaterial);
  sunSprite.position.set(-29, 19, -66);
  sunSprite.scale.set(16, 8, 1);
  camera.add(sunSprite);

  const cloudTexture = createSpriteTexture((context, width, height) => {
    context.fillStyle = '#ffffffc9';
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.58, width * 0.34, height * 0.22, 0, 0, Math.PI * 2);
    context.ellipse(width * 0.37, height * 0.48, width * 0.2, height * 0.27, 0, 0, Math.PI * 2);
    context.ellipse(width * 0.62, height * 0.47, width * 0.22, height * 0.29, 0, 0, Math.PI * 2);
    context.fill();
  });
  for (const [x, y, scale] of [[-12, 12, 10], [14, 17, 12], [30, 8, 8]]) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, depthWrite: false, opacity: 0.75 }));
    cloud.position.set(x, y, -65);
    cloud.scale.set(scale, scale * 0.55, 1);
    camera.add(cloud);
    dynamicAnimations.push({ type: 'cloud', object: cloud, startX: x, speed: 0.18 + scale * 0.006 });
  }
}

const grassBlades = [];
function buildGrass() {
  const random = seededRandom(4092);
  const placements = [];
  while (placements.length < 1300) {
    const x = (random() - 0.5) * 60;
    const z = (random() - 0.5) * 60;
    if (distanceToRoute(x, z) < 2.3) continue;
    if (STATIONS.some((station) => Math.hypot(x - station.position[0], z - station.position[1]) < 4.5)) continue;
    if (STATIONS.some((station) => Math.hypot(x - station.position[0] - MODEL_OFFSET[0], z - station.position[1] - MODEL_OFFSET[2]) < 3.8)) continue;
    placements.push({ x, z, phase: random() * Math.PI * 2, scale: 0.7 + random() * 0.55 });
  }
  grassInstances = new THREE.InstancedMesh(
    makeGeometry('grass-blade', () => new THREE.ConeGeometry(0.055, 0.38, 3)),
    makeMaterial(0xffffff),
    placements.length,
  );
  const object = new THREE.Object3D();
  placements.forEach((grass, index) => {
    grassBlades.push(grass);
    object.position.set(grass.x, 0.18 * grass.scale, grass.z);
    object.scale.set(grass.scale, grass.scale, grass.scale);
    object.rotation.y = random() * Math.PI;
    object.updateMatrix();
    grassInstances.setMatrixAt(index, object.matrix);
    const greens = [0x496a42, 0x5d7d49, 0x789354];
    grassInstances.setColorAt(index, new THREE.Color(greens[Math.floor(random() * greens.length)]));
  });
  grassInstances.instanceMatrix.needsUpdate = true;
  if (grassInstances.instanceColor) grassInstances.instanceColor.needsUpdate = true;
  grassInstances.castShadow = true;
  groundDecor.add(grassInstances);
}

function buildPollen() {
  const count = 14;
  pollenInstances = new THREE.InstancedMesh(
    makeGeometry('pollen', () => new THREE.SphereGeometry(0.045, 6, 5)),
    new THREE.MeshBasicMaterial({ color: 0xffe6a1 }),
    count,
  );
  dynamicAnimations.push({ type: 'pollen', object: pollenInstances, count, phase: 0 });
  groundDecor.add(pollenInstances);
}

const dustParticles = [];
function buildDust() {
  dustInstances = new THREE.InstancedMesh(
    makeGeometry('dust', () => new THREE.SphereGeometry(0.12, 6, 5)),
    new THREE.MeshBasicMaterial({ color: 0xd8c49b, transparent: true, opacity: 0.65, depthWrite: false }),
    12,
  );
  const zero = new THREE.Object3D();
  zero.scale.setScalar(0);
  zero.updateMatrix();
  for (let index = 0; index < 12; index += 1) {
    dustParticles.push({ life: 0, x: 0, z: 0, phase: index });
    dustInstances.setMatrixAt(index, zero.matrix);
  }
  groundDecor.add(dustInstances);
}

buildCampground();

function normalizeAsset(gltf, targetSize) {
  const root = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) throw new Error('Model has no measurable geometry');

  root.position.set(-center.x, -bounds.min.y, -center.z);
  root.scale.setScalar(targetSize / maxDimension);
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material && 'roughness' in material) material.roughness = Math.max(material.roughness, 0.72);
      }
    }
  });
  const normalized = new THREE.Group();
  normalized.add(root);
  return normalized;
}

function addAsset(key, parent, position, rotationY = 0, scale = 1) {
  const source = assetCache.get(key);
  if (!source) return null;
  const model = cloneSkeleton(source);
  model.position.set(...position);
  model.rotation.y = rotationY;
  model.scale.multiplyScalar(scale);
  model.userData.assetKey = key;
  const isBuilding = STATIONS.some((station) => station.model === key);
  model.userData.fadable = isBuilding;
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (isBuilding && node.material) {
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => material.clone())
        : node.material.clone();
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (isBuilding && /window|glass/i.test(`${node.name} ${material?.name || ''}`) && material && 'emissive' in material) {
        material.emissive.set(0xff762e);
        material.emissiveIntensity = 2.1;
      }
      if (material && 'roughness' in material) material.roughness = Math.max(material.roughness, 0.72);
    }
  });
  parent.add(model);
  if (key === 'windmill') {
    model.traverse((node) => {
      if (/blade|rotor/i.test(node.name)) dynamicAnimations.push({ type: 'windmill', object: node });
    });
  }
  return model;
}

function addFarmAnimals() {
  ANIMALS.forEach((animal, index) => {
    const root = new THREE.Group();
    root.position.set(animal.x, 0, animal.z);
    root.rotation.y = animal.rotation;
    groundDecor.add(root);
    if (!addAsset(animal.type, root, [0, 0, 0])) {
      const geometry = animal.type === 'sheep'
        ? makeGeometry('fallback-sheep', () => new THREE.IcosahedronGeometry(0.6, 1))
        : makeGeometry('fallback-chicken', () => new THREE.DodecahedronGeometry(0.32, 0));
      const body = new THREE.Mesh(geometry, makeMaterial(animal.type === 'sheep' ? 0xf0e6cd : 0xf2e5c4));
      body.position.y = animal.type === 'sheep' ? 0.57 : 0.32;
      if (animal.type === 'sheep') body.scale.set(1.1, 0.88, 0.9);
      body.castShadow = true;
      root.add(body);
    }
    addCollider(animal.x, animal.z, animal.type === 'cow' ? 0.95 : 0.55);
    animalVisuals.push({ ...animal, root, phase: index * 1.7 });
  });
}

function useLoadedAsset(key) {
  const source = assetCache.get(key);
  if (!source) return;
  if (key === 'backpacker') {
    disposeObjectResources(goatVisual);
    player.remove(goatVisual);
    goatVisual = cloneSkeleton(source);
    player.add(goatVisual);
    setupGoatMixer();
    return;
  }
  if (key === 'terrain') {
    rebuildCampground();
    return;
  }
  for (const placement of CAMP_PLACEMENTS) {
    if (placement.asset === key) addCampPlacement(placement);
  }
}

function disposeObjectResources(root) {
  const cachedGeometries = new Set(geometryCache.values());
  const cachedMaterials = new Set(materialCache.values());
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (node.geometry && !cachedGeometries.has(node.geometry)) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material && !cachedMaterials.has(material)) material.dispose();
    }
  });
}

let goatMixer = null;
let goatActions = {};
let currentGoatAction = null;
function setupGoatMixer() {
  goatMixer = null;
  goatActions = {};
  currentGoatAction = null;
  const clips = assetClips.get('backpacker') || [];
  if (!clips.length) return;
  goatMixer = new THREE.AnimationMixer(goatVisual);
  const findClip = (pattern) => clips.find((clip) => pattern.test(clip.name));
  const idleClip = findClip(/idle|stand/i);
  const walkClip = findClip(/walk/i);
  const runClip = findClip(/run/i);
  if (!idleClip || !walkClip || !runClip) {
    console.warn('The backpacker model does not include its expected idle, walk, and run animations.');
    return;
  }
  goatActions.idle = goatMixer.clipAction(idleClip);
  goatActions.walk = goatMixer.clipAction(walkClip);
  goatActions.run = goatMixer.clipAction(runClip);
  goatActions.run.timeScale = 1.12;
  goatActions.idle.play();
  currentGoatAction = goatActions.idle;
}

function fadeGoatTo(action) {
  if (!action || action === currentGoatAction) return;
  action.reset().play();
  currentGoatAction?.crossFadeTo(action, 0.2, false);
  currentGoatAction = action;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderProject(index) {
  const project = PROJECTS[index];
  const projectUrl = project.url || `${LINKS.portfolio}#/project/${project.slug}`;
  const initials = escapeHtml(project.title.split(/\s+/).map((word) => word[0]).join('').slice(0, 3));
  const imageAlt = escapeHtml(project.imageAlt || `${project.title} artwork`);
  return `<div class="project-card" data-project-card>
    <span class="project-count">PROJECT ${String(index + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}</span>
    <div class="project-thumbnail">
      <span class="project-thumbnail-placeholder" aria-hidden="true">${initials}</span>
      ${project.image ? `<img src="${escapeHtml(project.image)}" alt="${imageAlt}" loading="eager" decoding="async" fetchpriority="high">` : ''}
    </div>
    <h3 class="project-title">${escapeHtml(project.title)}</h3>
    <p class="project-description">${escapeHtml(project.description)}</p>
    <span class="project-status">${escapeHtml(project.status)}</span>
    <div class="project-tags">${(project.tags || []).map((tag) => `<span class="project-tag">${escapeHtml(tag)}</span>`).join('')}</div>
  </div>
  <div class="project-actions">
    <div class="project-links">
      <a class="project-link" href="${escapeHtml(projectUrl)}" target="_blank" rel="noopener">Project details ↗</a>
      ${project.playUrl ? `<a class="project-link" href="${escapeHtml(project.playUrl)}" target="_blank" rel="noopener">Play ↗</a>` : ''}
      ${project.repo ? `<a class="project-link" href="${escapeHtml(project.repo)}" target="_blank" rel="noopener">Source ↗</a>` : ''}
    </div>
    <div class="carousel-controls" aria-label="Project navigation">
      <button type="button" data-project-step="-1" aria-label="Previous project">←</button>
      <button type="button" data-project-step="1" aria-label="Next project">→</button>
    </div>
  </div>`;
}

function sectionBody(id) {
  const section = PORTFOLIO[id];
  if (id === 'about') return section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  if (id === 'skills') return `<div class="skill-list">${section.skills.map((skill) => `<span class="skill-chip">${escapeHtml(skill)}</span>`).join('')}</div>`;
  if (id === 'projects') return renderProject(projectIndex);
  if (id === 'education') {
    return `<ul>${section.entries.map((entry) => `<li><b>${escapeHtml(entry.title)}</b><br>${escapeHtml(entry.detail)}<br><small>${escapeHtml(entry.date)}</small></li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(section.paragraph)}</p>
    <div class="contact-links">
      <a href="${LINKS.email}">Email ↗</a>
      <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub ↗</a>
      <a href="${LINKS.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
      <a href="${LINKS.cv}" target="_blank" rel="noopener">Résumé ↗</a>
    </div>`;
}

function renderStation(id) {
  const section = PORTFOLIO[id];
  stationCard.innerHTML = `<div class="station-head">
      <div><span class="station-kicker">${escapeHtml(section.kicker)}</span><h2>${escapeHtml(section.title)}</h2><p class="station-subtitle">${escapeHtml(section.subtitle)}</p></div>
      <button class="station-close" type="button" aria-label="Close station">×</button>
    </div>
    <div class="station-body">${sectionBody(id)}</div>
    ${visited.size === STATIONS.length ? `<div class="celebration-links">All places found ✨ <a href="${LINKS.cv}" target="_blank" rel="noopener">Résumé</a> · <a href="${LINKS.email}">Say hello</a></div>` : ''}
    <div class="station-foot"><span>✿ A little world of work</span><span>${visited.size} / ${STATIONS.length} discovered</span></div>`;
  stationCard.classList.add('is-open');
  stationCard.inert = false;
  stationCard.setAttribute('aria-hidden', 'false');
  stationCard.querySelector('.station-close').addEventListener('click', closeStation);
  stationCard.querySelectorAll('[data-project-step]').forEach((button) => {
    button.addEventListener('click', () => {
      projectIndex = (projectIndex + Number(button.dataset.projectStep) + PROJECTS.length) % PROJECTS.length;
      renderStation('projects');
    });
  });
  const projectCard = stationCard.querySelector('[data-project-card]');
  if (projectCard) {
    const thumbnailImage = projectCard.querySelector('.project-thumbnail img');
    const revealThumbnail = () => thumbnailImage?.previousElementSibling.classList.add('is-hidden');
    if (thumbnailImage?.complete && thumbnailImage.naturalWidth > 0) revealThumbnail();
    else thumbnailImage?.addEventListener('load', revealThumbnail, { once: true });
    thumbnailImage?.addEventListener('error', () => thumbnailImage.remove(), { once: true });
    let startX = null;
    projectCard.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    projectCard.addEventListener('pointerup', (event) => {
      if (startX === null || Math.abs(event.clientX - startX) < 45) return;
      projectIndex = (projectIndex + (event.clientX < startX ? 1 : -1) + PROJECTS.length) % PROJECTS.length;
      renderStation('projects');
      startX = null;
    });
    projectCard.addEventListener('pointercancel', () => { startX = null; });
  }
}

function closeStation() {
  if (!activeStation) return;
  stationCard.classList.remove('is-open');
  stationCard.inert = true;
  stationCard.setAttribute('aria-hidden', 'true');
  if (stationCard.contains(document.activeElement)) renderer?.domElement.focus();
}

function updateVisitedLabel() {
  visitedLabel.innerHTML = `${visited.size} <em>/ ${STATIONS.length} places</em>`;
}

function showCelebration() {
  if (confettiShown) return;
  confettiShown = true;
  if (reduceMotion) {
    showToast('You found every place! Your next adventure awaits ✿');
    return;
  }
  const celebration = document.createElement('div');
  celebration.className = 'celebration';
  celebration.setAttribute('aria-hidden', 'true');
  const colors = ['#e68a48', '#83a86c', '#f4c879', '#93bad2', '#d98279'];
  for (let index = 0; index < 56; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
    celebration.appendChild(piece);
  }
  document.body.appendChild(celebration);
  setTimeout(() => celebration.remove(), 3200);
  showToast('You found every place! Your next adventure awaits ✿');
}

function enterStation(station) {
  cancelInteractionHold();
  activeStation = station.id;
  if (!visited.has(station.id)) {
    visited.add(station.id);
    persistVisitedStations();
    updateVisitedLabel();
    showToast(`${station.label} discovered ✳`);
    if (visited.size === STATIONS.length) showCelebration();
  }
  renderStation(station.id);
}

function updateProximity() {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const station of STATIONS) {
    const distance = Math.hypot(player.position.x - station.position[0], player.position.z - station.position[1]);
    if (distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }

  if (activeStation) {
    const active = STATIONS.find((station) => station.id === activeStation);
    const activeDistance = Math.hypot(player.position.x - active.position[0], player.position.z - active.position[1]);
    if (activeDistance < EXIT_STATION_RADIUS) {
      nearest = active;
      nearestDistance = activeDistance;
    } else {
      activeStation = null;
      stationCard.classList.remove('is-open');
      stationCard.inert = true;
      stationCard.setAttribute('aria-hidden', 'true');
      if (stationCard.contains(document.activeElement)) renderer?.domElement.focus();
    }
  }

  const isRetainingNearby = nearbyStation
    && nearest?.id === nearbyStation.id
    && nearestDistance < EXIT_STATION_RADIUS;
  nearbyStation = nearestDistance < (isRetainingNearby ? EXIT_STATION_RADIUS : ENTER_STATION_RADIUS)
    ? nearest
    : null;
  if (interactionHoldStationId && (
    !nearbyStation
    || nearbyStation.id !== interactionHoldStationId
    || stationCard.classList.contains('is-open')
  )) cancelInteractionHold();
  nearbyText.textContent = nearbyStation ? `${nearbyStation.label} · nearby` : 'Find a place to explore';
  interactPrompt.hidden = !nearbyStation || stationCard.classList.contains('is-open');
  const promptLabel = nearbyStation
    ? `${interactionHoldStationId ? 'Keep holding' : 'Hold E'} to explore ${nearbyStation.label}`
    : 'No section nearby';
  if (interactPrompt.getAttribute('aria-label') !== promptLabel) interactPrompt.setAttribute('aria-label', promptLabel);
  const promptText = nearbyStation ? promptLabel : '';
  if (interactLabel.textContent !== promptText) interactLabel.textContent = promptText;
}

function beginInteractionHold(source) {
  if (!started || !nearbyStation || interactPrompt.hidden || stationCard.classList.contains('is-open')) return;
  if (interactionHoldStationId) return;
  interactionHoldStationId = nearbyStation.id;
  interactionHoldSource = source;
  interactionHoldStartedAt = performance.now();
  interactionHoldProgress = 0;
  interactPrompt.classList.add('is-holding');
}

function cancelInteractionHold() {
  interactionHoldStationId = null;
  interactionHoldSource = null;
  interactionHoldStartedAt = 0;
  interactionHoldProgress = 0;
  interactPrompt.classList.remove('is-holding');
  interactProgress.style.transform = '';
  interactProgress.setAttribute('aria-valuenow', '0');
}

function updateInteractionHold() {
  if (!interactionHoldStationId) return;
  interactionHoldProgress = Math.min(1, (performance.now() - interactionHoldStartedAt) / INTERACTION_HOLD_DURATION);
  interactProgress.style.transform = `scaleY(${interactionHoldProgress})`;
  interactProgress.setAttribute('aria-valuenow', String(Math.round(interactionHoldProgress * 100)));
  if (interactionHoldProgress < 1) return;

  const station = STATIONS.find((entry) => entry.id === interactionHoldStationId);
  cancelInteractionHold();
  if (station) {
    interactionShakeKick = 0.18;
    enterStation(station);
  }
}

function jump() {
  if (!started) return;
  jumpBuffer = 0.12;
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest('#station, button, a, input, textarea, select, [contenteditable="true"]'));
}

function onKeyDown(event) {
  const key = event.code;
  if (key === 'Escape') {
    if (!isInteractiveTarget(event.target) || stationCard.contains(event.target)) closeStation();
    return;
  }
  if (key === 'KeyE' && started && nearbyStation
    && (!isInteractiveTarget(event.target) || interactPrompt.contains(event.target))) {
    event.preventDefault();
    if (!event.repeat) beginInteractionHold('keyboard');
    return;
  }
  if (['Enter', 'Space'].includes(key) && interactPrompt.contains(event.target) && nearbyStation) {
    event.preventDefault();
    if (!event.repeat) beginInteractionHold('keyboard');
    return;
  }
  if (isInteractiveTarget(event.target)) return;
  if (started && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(key)) event.preventDefault();
  if (key === 'Space') {
    if (!event.repeat) jump();
    return;
  }
  heldKeys.add(key);
  if (event.key.length === 1 && /[a-z]/i.test(event.key)) heldKeys.add(`Key${event.key.toUpperCase()}`);
}

function onKeyUp(event) {
  if (interactionHoldSource === 'keyboard' && ['KeyE', 'Enter', 'Space'].includes(event.code)) {
    cancelInteractionHold();
  }
  heldKeys.delete(event.code);
  if (event.key.length === 1 && /[a-z]/i.test(event.key)) heldKeys.delete(`Key${event.key.toUpperCase()}`);
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => {
  heldKeys.clear();
  cancelInteractionHold();
});
interactPrompt.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  beginInteractionHold('pointer');
  if (interactionHoldSource === 'pointer') interactPrompt.setPointerCapture(event.pointerId);
});
interactPrompt.addEventListener('pointerup', () => {
  if (interactionHoldSource === 'pointer') cancelInteractionHold();
});
interactPrompt.addEventListener('pointercancel', cancelInteractionHold);
interactPrompt.addEventListener('lostpointercapture', () => {
  if (interactionHoldSource === 'pointer') cancelInteractionHold();
});
interactPrompt.addEventListener('click', (event) => {
  if (event.detail !== 0 || !nearbyStation) return;
  beginInteractionHold('assistive');
  if (interactionHoldSource === 'assistive') {
    window.setTimeout(() => {
      if (interactionHoldSource !== 'assistive') return;
      interactionHoldStartedAt -= INTERACTION_HOLD_DURATION;
      updateInteractionHold();
    }, INTERACTION_HOLD_DURATION);
  }
});

const joystick = $('#joystick');
const joystickKnob = joystick.querySelector('.joystick-knob');
function updateJoystick(event) {
  const bounds = joystick.getBoundingClientRect();
  const maxRadius = bounds.width * 0.31;
  const dx = event.clientX - (bounds.left + bounds.width / 2);
  const dy = event.clientY - (bounds.top + bounds.height / 2);
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxRadius ? maxRadius / distance : 1;
  const offsetX = dx * scale;
  const offsetY = dy * scale;
  joystickKnob.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  touchMovement.set(offsetX / maxRadius, offsetY / maxRadius);
}
function releaseJoystick() {
  touchMovement.set(0, 0);
  joystickKnob.style.transform = '';
}
joystick.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener('pointermove', (event) => {
  if (joystick.hasPointerCapture(event.pointerId)) updateJoystick(event);
});
joystick.addEventListener('pointerup', releaseJoystick);
joystick.addEventListener('pointercancel', releaseJoystick);
joystick.addEventListener('lostpointercapture', releaseJoystick);

$('#jump').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  jump();
});
$('#sprint').addEventListener('click', (event) => {
  touchSprinting = !touchSprinting;
  event.currentTarget.setAttribute('aria-pressed', String(touchSprinting));
});

for (const button of document.querySelectorAll('[data-station]')) {
  button.addEventListener('click', () => {
    const station = STATIONS.find((entry) => entry.id === button.dataset.station);
    if (!station) return;
    player.position.set(
      station.position[0],
      getTerrainHeight(station.position[0], station.position[1]) ?? 0,
      station.position[1],
    );
    movementVelocity.set(0, 0);
    enterStation(station);
    stationCard.querySelector('.station-close')?.focus();
  });
}

function readSoundPreference() {
  try {
    const stored = localStorage.getItem('cozy-farm-sound');
    if (stored === 'on') return true;
    if (stored === 'off') return false;
    if (stored !== null) console.warn('Ignoring an invalid sound preference.');
    return true;
  } catch (error) {
    console.warn('Could not read the sound preference from local storage.', error);
    return false;
  }
}

function readTimeOfDayPreference() {
  try {
    const stored = localStorage.getItem('cozy-farm-lighting');
    if (stored === 'morning' || stored === 'golden-hour') return stored;
    if (stored !== null) console.warn('Ignoring an invalid time-of-day preference.');
    return 'golden-hour';
  } catch (error) {
    console.warn('Could not read the time-of-day preference from local storage.', error);
    return 'golden-hour';
  }
}

function persistTimeOfDayPreference() {
  try {
    localStorage.setItem('cozy-farm-lighting', timeOfDay);
  } catch (error) {
    console.warn('Could not save the time-of-day preference to local storage.', error);
  }
}

function applyTimeOfDay(mode) {
  const palette = TIME_OF_DAY_PALETTES[mode];
  if (!palette) throw new RangeError(`Unsupported time of day: ${mode}`);
  timeOfDay = mode;

  skyContext.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
  const gradient = skyContext.createLinearGradient(0, 0, 0, skyCanvas.height);
  gradient.addColorStop(0, palette.sky[0]);
  gradient.addColorStop(0.55, palette.sky[1]);
  gradient.addColorStop(1, palette.sky[2]);
  skyContext.fillStyle = gradient;
  skyContext.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
  skyTexture.needsUpdate = true;
  scene.fog.color.set(palette.fog);
  hemisphere.color.set(palette.hemisphereSky);
  hemisphere.groundColor.set(palette.hemisphereGround);
  hemisphere.intensity = palette.hemisphereIntensity;
  sun.color.set(palette.sun);
  sun.intensity = palette.sunIntensity;
  fillLight.color.set(palette.fill);
  fillLight.intensity = palette.fillIntensity;
  rimLight.color.set(palette.rim);
  rimLight.intensity = palette.rimIntensity;
  if (sunSpriteMaterial) sunSpriteMaterial.color.set(palette.sprite);

  const label = mode === 'morning' ? 'sunset' : 'morning';
  timeOfDayToggle.textContent = mode === 'morning' ? '☀' : '☼';
  timeOfDayToggle.setAttribute('aria-pressed', String(mode === 'golden-hour'));
  timeOfDayToggle.setAttribute('aria-label', `Switch to ${label}`);
  timeOfDayToggle.title = `Switch to ${label}`;
}

function persistSoundPreference() {
  try {
    localStorage.setItem('cozy-farm-sound', soundEnabled ? 'on' : 'off');
  } catch (error) {
    console.warn('Could not save the sound preference to local storage.', error);
  }
}

const AMBIENT_CHORDS = [
  [130.81, 164.81, 196, 261.63],
  [110, 164.81, 220, 261.63],
  [87.31, 130.81, 174.61, 220],
  [98, 146.83, 196, 246.94],
];
const AMBIENT_MELODY = [392, 523.25, 440, 587.33, 523.25, 440, 392, 329.63, 440, 587.33, 523.25, 659.25, 587.33, 523.25, 440, 392];

function scheduleAmbientMusicNote() {
  if (!soundEnabled || !audioContext || !ambientMusicBus) {
    ambientMusicTimer = 0;
    return;
  }
  const step = ambientMusicStep++;
  const now = audioContext.currentTime;
  if (step % 4 === 0) {
    const chord = AMBIENT_CHORDS[Math.floor(step / 4) % AMBIENT_CHORDS.length];
    ambientPadVoices.forEach((voice, index) => {
      voice.frequency.setTargetAtTime(chord[index], now, 2.2);
    });
  }

  const oscillator = audioContext.createOscillator();
  const noteGain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = AMBIENT_MELODY[step % AMBIENT_MELODY.length];
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(0.055, now + 0.7);
  noteGain.gain.setValueAtTime(0.055, now + 1.4);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
  oscillator.connect(noteGain);
  noteGain.connect(ambientMusicBus);
  oscillator.start(now);
  oscillator.stop(now + 3.9);
  ambientMusicTimer = window.setTimeout(scheduleAmbientMusicNote, 4200 + (step % 3) * 350);
}

function startAmbientMusic() {
  if (!ambientMusicBus) {
    ambientMusicBus = audioContext.createGain();
    ambientMusicBus.gain.value = 0.28;
    ambientMusicBus.connect(audioMasterGain);
    for (const frequency of AMBIENT_CHORDS[0]) {
      const oscillator = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = 0.045;
      oscillator.connect(voiceGain);
      voiceGain.connect(ambientMusicBus);
      oscillator.start();
      ambientPadVoices.push(oscillator);
    }
  }
  if (!ambientMusicTimer) scheduleAmbientMusicNote();
}

function initializeAudio() {
  if (!soundEnabled) return;
  if (audioContext) {
    audioMasterGain.gain.setTargetAtTime(0.35, audioContext.currentTime, 0.04);
    audioContext.resume().catch((error) => console.warn('Could not resume the audio context.', error));
    startAmbientMusic();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    soundEnabled = false;
    soundToggle.setAttribute('aria-pressed', 'false');
    soundToggle.setAttribute('aria-label', 'Relaxing music and sound are unavailable in this browser');
    soundToggle.title = 'Relaxing music and sound are unavailable in this browser';
    console.warn('Web Audio is unavailable; relaxing music and farm sounds are disabled.');
    return;
  }
  audioContext = new AudioContext();
  audioMasterGain = audioContext.createGain();
  audioMasterGain.gain.value = 0;
  audioMasterGain.connect(audioContext.destination);
  audioMasterGain.gain.setTargetAtTime(0.35, audioContext.currentTime, 0.6);
  audioContext.resume().catch((error) => console.warn('Could not resume the audio context.', error));
  startAmbientMusic();
}

function playTone(frequency, duration = 0.08, volume = 0.15) {
  if (!soundEnabled) return;
  initializeAudio();
  if (!audioContext || !audioMasterGain) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.72), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioMasterGain);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

soundEnabled = readSoundPreference();
soundToggle.setAttribute('aria-pressed', String(soundEnabled));
soundToggle.setAttribute('aria-label', soundEnabled ? 'Turn relaxing music and sound off' : 'Turn relaxing music and sound on');
soundToggle.title = soundEnabled ? 'Turn relaxing music and sound off' : 'Turn relaxing music and sound on';
timeOfDay = readTimeOfDayPreference();
applyTimeOfDay(timeOfDay);
timeOfDayToggle.addEventListener('click', () => {
  applyTimeOfDay(timeOfDay === 'morning' ? 'golden-hour' : 'morning');
  persistTimeOfDayPreference();
});
soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Turn relaxing music and sound off' : 'Turn relaxing music and sound on');
  soundToggle.title = soundEnabled ? 'Turn relaxing music and sound off' : 'Turn relaxing music and sound on';
  persistSoundPreference();
  if (soundEnabled) initializeAudio();
  if (!soundEnabled && audioMasterGain && audioContext) {
    audioMasterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.04);
    window.clearTimeout(ambientMusicTimer);
    ambientMusicTimer = 0;
  }
});
updateVisitedLabel();
preloadProjectImages();

const waypointArrow = new THREE.Group();
const waypointHead = new THREE.Mesh(
  makeGeometry('waypoint-arrow', () => new THREE.ConeGeometry(0.19, 0.62, 3)),
  makeMaterial(0xe68a48, 0.45),
);
waypointHead.rotation.x = Math.PI / 2;
waypointArrow.add(waypointHead);
waypointArrow.position.y = 2.8;
scene.add(waypointArrow);
let occludedBuilding = null;
let occlusionTimer = 0;
let dustParticleIndex = 0;
let landingPulse = 0;

function setBuildingOpacity(building, opacity) {
  building.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (opacity < 1) {
        if (!fadingMaterials.has(material)) {
          fadingMaterials.set(material, {
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
          });
        }
        material.transparent = true;
        material.opacity = opacity;
        material.depthWrite = false;
        material.needsUpdate = true;
      } else {
        const original = fadingMaterials.get(material);
        if (!original) continue;
        material.opacity = original.opacity;
        material.transparent = original.transparent;
        material.depthWrite = original.depthWrite;
        material.needsUpdate = true;
        fadingMaterials.delete(material);
      }
    }
  });
}

function updateOcclusion(delta) {
  occlusionTimer -= delta;
  if (occlusionTimer > 0) return;
  occlusionTimer = 0.12;
  occlusionTarget.set(player.position.x, 1.1 + jumpHeight, player.position.z);
  occlusionRay.subVectors(occlusionTarget, camera.position);
  const distance = occlusionRay.length();
  raycaster.set(camera.position, occlusionRay.normalize());
  raycaster.far = distance;
  const hit = raycaster.intersectObjects(worldGroup.children, true)
    .map(({ object }) => {
      let candidate = object;
      while (candidate && !candidate.userData.fadable) candidate = candidate.parent;
      return candidate;
    })
    .find(Boolean) || null;
  if (hit === occludedBuilding) return;
  if (occludedBuilding) setBuildingOpacity(occludedBuilding, 1);
  occludedBuilding = hit;
  if (occludedBuilding) setBuildingOpacity(occludedBuilding, 0.35);
}

function updateWorldAnimations(delta, elapsed) {
  for (const animation of dynamicAnimations) {
    if (animation.type === 'windmill') {
      animation.object.rotation.z += delta * 0.55;
    } else if (animation.type === 'cloud') {
      animation.object.position.x += animation.speed * delta;
      if (animation.object.position.x > 40) animation.object.position.x = -40;
    }
  }
  if (grassInstances) {
    for (const [index, grass] of grassBlades.entries()) {
      instanceDummy.position.set(grass.x, 0.18 * grass.scale, grass.z);
      instanceDummy.rotation.set(0, 0, reduceMotion ? 0 : Math.sin(elapsed * 1.8 + grass.phase) * 0.16);
      instanceDummy.scale.set(grass.scale, grass.scale, grass.scale);
      instanceDummy.updateMatrix();
      grassInstances.setMatrixAt(index, instanceDummy.matrix);
    }
    grassInstances.instanceMatrix.needsUpdate = true;
  }

  const pollen = dynamicAnimations.find((animation) => animation.type === 'pollen');
  if (pollen) {
    for (let index = 0; index < pollen.count; index += 1) {
      const phase = elapsed * 0.35 + index * 1.7;
      instanceDummy.position.set(
        player.position.x + Math.sin(phase) * (4 + index % 4),
        1.2 + (index % 5) * 0.42 + Math.sin(phase * 1.4) * 0.3,
        player.position.z + Math.cos(phase * 0.8) * (4 + index % 3),
      );
      instanceDummy.scale.setScalar(0.7 + (index % 3) * 0.2);
      instanceDummy.updateMatrix();
      pollen.object.setMatrixAt(index, instanceDummy.matrix);
    }
    pollen.object.instanceMatrix.needsUpdate = true;
  }
  for (const animal of animalVisuals) {
    const phase = elapsed * (animal.type === 'chicken' ? 0.55 : 0.25) + animal.phase;
    animal.root.position.x = animal.x + (animal.type === 'cow' ? 0 : Math.sin(phase) * 0.32);
    animal.root.position.z = animal.z + (animal.type === 'cow' ? 0 : Math.cos(phase) * 0.24);
    animal.root.rotation.y = animal.rotation + (animal.type === 'cow' ? 0 : Math.sin(phase * 0.6) * 0.18);
    if (animal.type === 'chicken') animal.root.rotation.x = Math.sin(elapsed * 3 + animal.phase) * 0.08;
  }
}

function updateDust(delta, sprinting) {
  if (sprinting && goatIsMoving && !reduceMotion) {
    dustTimer -= delta;
    if (dustTimer <= 0) {
      dustTimer = 0.18;
      const particle = dustParticles[dustParticleIndex];
      particle.life = 0.55;
      particle.x = player.position.x - movementVelocity.x * 0.12;
      particle.z = player.position.z - movementVelocity.y * 0.12;
      dustParticleIndex = (dustParticleIndex + 1) % dustParticles.length;
    }
  }
  dustParticles.forEach((particle, index) => {
    particle.life = Math.max(0, particle.life - delta);
    if (particle.life <= 0) {
      instanceDummy.scale.setScalar(0);
    } else {
      const age = 0.55 - particle.life;
      instanceDummy.position.set(particle.x, 0.08 + age * 0.7, particle.z);
      instanceDummy.scale.setScalar(Math.min(1, particle.life * 2) * 0.7);
    }
    instanceDummy.updateMatrix();
    dustInstances.setMatrixAt(index, instanceDummy.matrix);
  });
  dustInstances.instanceMatrix.needsUpdate = true;
}

function animate() {
  if (!renderer || document.hidden) return;
  animationFrame = requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  let moveX = touchMovement.x;
  let moveZ = touchMovement.y;
  if (heldKeys.has('KeyA') || heldKeys.has('KeyQ') || heldKeys.has('ArrowLeft')) moveX -= 1;
  if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;
  if (heldKeys.has('KeyW') || heldKeys.has('KeyZ') || heldKeys.has('ArrowUp')) moveZ -= 1;
  if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveZ += 1;
  const magnitude = Math.hypot(moveX, moveZ);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }
  const sprinting = started && (touchSprinting || heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight'));
  const speed = sprinting ? 9 : 6.1;
  const targetVelocityX = started ? moveX * speed : 0;
  const targetVelocityZ = started ? moveZ * speed : 0;
  const acceleration = 1 - Math.exp(-delta * (magnitude > 0 ? 11 : 14));
  movementVelocity.x += (targetVelocityX - movementVelocity.x) * acceleration;
  movementVelocity.y += (targetVelocityZ - movementVelocity.y) * acceleration;
  const previousX = player.position.x;
  const previousZ = player.position.z;
  player.position.x += movementVelocity.x * delta;
  player.position.z += movementVelocity.y * delta;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_EDGE + 1, WORLD_EDGE - 1);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_EDGE + 1, WORLD_EDGE - 1);
  resolveCollisions(player.position);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_EDGE + 1, WORLD_EDGE - 1);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_EDGE + 1, WORLD_EDGE - 1);
  if (terrainGround) {
    const terrainHeight = getTerrainHeight(player.position.x, player.position.z);
    if (terrainHeight === null) {
      player.position.x = previousX;
      player.position.z = previousZ;
      movementVelocity.set(0, 0);
    } else {
      player.position.y = terrainHeight;
    }
  }
  goatIsMoving = started && Math.hypot(movementVelocity.x, movementVelocity.y) > 0.25;
  if (goatIsMoving) {
    const targetYaw = Math.atan2(movementVelocity.x, movementVelocity.y);
    player.rotation.y = lerpAngle(player.rotation.y, targetYaw, reduceMotion ? 1 : 1 - Math.exp(-delta * 14));
  }

  if (jumpHeight <= 0.001) coyoteTime = 0.1;
  else coyoteTime = Math.max(0, coyoteTime - delta);
  jumpBuffer = Math.max(0, jumpBuffer - delta);
  if (jumpBuffer > 0 && coyoteTime > 0 && started) {
    jumpVelocity = 7.2;
    jumpBuffer = 0;
    coyoteTime = 0;
    playTone(440, 0.18, 0.22);
  }
  if (jumpHeight > 0 || jumpVelocity > 0) {
    jumpHeight += jumpVelocity * delta;
    jumpVelocity -= 18 * delta;
    if (jumpHeight <= 0) {
      jumpHeight = 0;
      jumpVelocity = 0;
      landingPulse = 0.12;
    }
  }
  landingPulse = Math.max(0, landingPulse - delta);
  if (!goatMixer && goatVisual.userData.body) {
    const restY = goatVisual.userData.bodyRestY || 0;
    goatVisual.userData.body.position.y = restY + (!started || reduceMotion
      ? 0
      : goatIsMoving ? Math.sin(elapsed * (sprinting ? 19 : 14)) * 0.055 : Math.sin(elapsed * 2.5) * 0.018);
    for (const limb of goatVisual.userData.limbs || []) {
      limb.object.rotation.x = limb.object.userData.baseRotation
        + (goatIsMoving && !reduceMotion ? Math.sin(elapsed * (sprinting ? 19 : 13) + limb.phase) * 0.42 : 0);
    }
  }
  if (goatMixer) {
    const action = !goatIsMoving
      ? goatActions.idle
      : sprinting ? goatActions.run : goatActions.walk;
    fadeGoatTo(action);
    goatMixer.update(delta);
  }
  goatVisual.position.y = jumpHeight;
  const takeoffStretch = Math.max(0, jumpVelocity / 7.2) * 0.08;
  goatVisual.scale.set(
    1 - takeoffStretch + landingPulse * 0.25,
    1 + takeoffStretch - landingPulse * 0.35,
    1 - takeoffStretch + landingPulse * 0.25,
  );
  if (goatIsMoving && elapsed - lastFootstep > (sprinting ? 0.28 : 0.46)) {
    playTone(sprinting ? 115 : 145, 0.055, 0.09);
    lastFootstep = elapsed;
  }

  updateWorldAnimations(delta, elapsed);
  sun.target.position.copy(player.position);
  sun.position.copy(player.position).add(SUN_OFFSET);
  sun.target.updateMatrixWorld();

  if (started) {
    updateProximity();
    updateInteractionHold();
  }
  const unvisited = STATIONS.filter((station) => !visited.has(station.id));
  if (unvisited.length) {
    const nearest = unvisited.reduce((best, station) => {
      const distance = Math.hypot(player.position.x - station.position[0], player.position.z - station.position[1]);
      return distance < best.distance ? { station, distance } : best;
    }, { station: unvisited[0], distance: Infinity }).station;
    waypointArrow.visible = started;
    waypointArrow.position.x = player.position.x;
    waypointArrow.position.z = player.position.z;
    waypointArrow.rotation.y = Math.atan2(nearest.position[0] - player.position.x, nearest.position[1] - player.position.z);
  } else waypointArrow.visible = false;

  const cameraScale = cameraDistance / 36;
  const introLift = cameraIntroActive ? Math.max(0, 1 - cameraIntro) * 18 : 0;
  cameraDesired.set(
    player.position.x + CAM_OFFSET.x * cameraScale,
    player.position.y + CAM_OFFSET.y * cameraScale + introLift + jumpHeight * 0.2,
    player.position.z + cameraDistance,
  );
  if (cameraIntroActive) {
    cameraIntro = Math.min(1, cameraIntro + delta * 0.55);
    if (cameraIntro >= 1) cameraIntroActive = false;
  }
  if (reduceMotion) camera.position.copy(cameraDesired);
  else camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 4));
  if (!reduceMotion) {
    const holdShake = interactionHoldStationId ? interactionHoldProgress * 0.075 : 0;
    const shake = Math.max(holdShake, interactionShakeKick);
    if (shake > 0.001) {
      camera.position.x += Math.sin(elapsed * 43) * shake;
      camera.position.y += Math.cos(elapsed * 57) * shake * 0.45;
      camera.position.z += Math.sin(elapsed * 31) * shake * 0.35;
    }
    interactionShakeKick *= Math.exp(-delta * 5.5);
  } else {
    interactionShakeKick = 0;
  }
  const stationFocus = activeStation ? STATIONS.find((station) => station.id === activeStation) : null;
  const focusX = stationFocus ? (stationFocus.position[0] - player.position.x) * 0.12 : 0;
  const desktopCardOffset = stationFocus && innerWidth > 620 ? -1.3 : 0;
  cameraLookAt.set(
    player.position.x + focusX + desktopCardOffset,
    player.position.y + 1.1 + jumpHeight * 0.2,
    player.position.z - 1,
  );
  camera.lookAt(cameraLookAt);
  const targetFov = baseCameraFov + (sprinting && goatIsMoving ? 2 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * (reduceMotion ? 1 : 1 - Math.exp(-delta * 5));
    camera.updateProjectionMatrix();
  }
  updateOcclusion(delta);
  renderer.render(scene, camera);
  if (assetCount === totalAssets && !lastRenderCallsLogged) {
    console.info(`Campground scene ready: ${renderer.info.render.calls} draw calls.`);
    lastRenderCallsLogged = true;
  }
}

function startGame() {
  if (started) return;
  started = true;
  intro.classList.add('is-hidden');
  cameraIntro = reduceMotion ? 1 : 0;
  cameraIntroActive = !reduceMotion;
  if (cameraIntroActive) camera.position.set(player.position.x, player.position.y + 38, player.position.z + 27);
  initializeAudio();
  showToast('Follow the trail and explore the campground ✿');
  renderer?.domElement.focus();
}

startButton.addEventListener('click', startGame);
world.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(event.deltaY) * 2.4, 30, 120);
}, { passive: false });
window.addEventListener('resize', () => {
  if (!renderer) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelInteractionHold();
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clock.stop();
  } else if (renderer && !animationFrame) {
    clock.start();
    animate();
  }
});

async function loadAsset(key) {
  const { id, size } = ASSETS[key];
  const controller = new AbortController();
  assetControllers.set(key, controller);
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out loading ${id}`)), 12000);
  try {
    const response = await fetch(`${CDN}${id}.glb`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request for ${id} failed with HTTP ${response.status}`);
    const gltf = await loader.parseAsync(await response.arrayBuffer(), CDN);
    assetClips.set(key, gltf.animations || []);
    assetCache.set(key, normalizeAsset(gltf, size));
    useLoadedAsset(key);
  } finally {
    clearTimeout(timeout);
    assetControllers.delete(key);
  }
}

function updateLoadingStatus() {
  assetCount += 1;
  loadProgress.value = assetCount;
  loadStatus.textContent = `Loading campground assets ${assetCount}/${totalAssets}`;
}

async function prepareAssets() {
  const promises = new Map(assetKeys.map((key) => [key, (async () => {
    try {
      await loadAsset(key);
    } catch (error) {
      assetErrors.push(`${key}: ${error.message}`);
      console.warn(`Could not load ${key} from the Polyfork CDN. Using local fallback scenery.`, error);
    } finally {
      updateLoadingStatus();
    }
  })()]));

  let capTimer;
  const capPromise = new Promise((resolve) => {
    capTimer = setTimeout(() => resolve(false), 6000);
  });
  const requiredPromise = Promise.allSettled([...requiredAssetKeys].map((key) => promises.get(key))).then(() => true);
  const requiredReady = await Promise.race([requiredPromise, capPromise]);
  clearTimeout(capTimer);
  if (!requiredReady) {
    for (const key of requiredAssetKeys) assetControllers.get(key)?.abort(new Error('Stopped at the required-asset loading limit'));
  }
  startButton.disabled = false;
  startLabel.textContent = 'Come explore';
  loadStatus.textContent = 'The campground is ready to explore';

  await Promise.allSettled([...promises.values()]);
  if (assetErrors.length) {
    loadStatus.textContent = `${assetErrors.length} asset${assetErrors.length === 1 ? '' : 's'} unavailable · fallback scenery ready`;
  } else {
    loadStatus.textContent = 'The campground is ready';
  }
}

if (renderer) {
  animate();
  prepareAssets().catch((error) => {
    console.error('Unexpected error while preparing the campground:', error);
    startButton.disabled = false;
    startLabel.textContent = 'Come explore';
    loadStatus.textContent = 'Using fallback campground scenery';
  });
} else {
  startButton.disabled = true;
}
