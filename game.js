// script.js (simpan sebagai module, type="module" di index.html)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';

/* -------------------------
   DOM refs & game state
   ------------------------- */
const container = document.getElementById('container');
const startBtn = document.getElementById('startBtn');
const howBtn = document.getElementById('howBtn');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const dropdown = document.getElementById('dropdown');
const menuBtn = document.getElementById('menuBtn');
const retryBtn = document.getElementById('retryBtn');
const backBtn = document.getElementById('backBtn');
const questionModal = document.getElementById('questionModal');
const qText = document.getElementById('qText');
const qOptions = document.getElementById('qOptions');
const endModal = document.getElementById('endModal');
const endTitle = document.getElementById('endTitle');
const endMsg = document.getElementById('endMsg');
const nextBtn = document.getElementById('nextBtn');
const retryEndBtn = document.getElementById('retryEndBtn');
const toMenuBtn = document.getElementById('toMenuBtn');
const howPanel = document.getElementById('howPanel');
const closeHow = document.getElementById('closeHow');

const livesEl = document.getElementById('lives');
const timeDisplay = document.getElementById('timeDisplay');
const scoreEl = document.getElementById('score');
const targetEl = document.getElementById('target');

/* Game variables */
let scene, camera, renderer, clock;
let hookMesh;
let fishes = [];
let fishGroup;
let running = false;
let currentLevel = 1;
let unlockedLevel = 1;
let lives = 3;
let timeLeft = 120;
let timerId = null;
let score = 0;
let targetCount = 6;
let answering = false;

/* Input */
let leftHeld = false;
let rightHeld = false;
let dropRequest = false;

/* -------------------------
   initialize three
   ------------------------- */
function initThree() {
  scene = new THREE.Scene();

  // camera (perspective)
  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(0, 40, 120);
  camera.lookAt(0, 20, 0);

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // light
  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x404040, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(50, 100, 50);
  scene.add(dir);

  // sea plane
  const waterGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.95 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  // subtle waves via vertex displacement (animated)
  clock = new THREE.Clock();

  // fish group
  fishGroup = new THREE.Group();
  scene.add(fishGroup);

  // hook
  const hookGeom = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12);
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.8, roughness: 0.3 });
  const hookHead = new THREE.Mesh(hookGeom, hookMat);
  const hookHolder = new THREE.Object3D();
  hookHead.rotation.z = Math.PI / 2;
  hookHead.scale.set(1,1.2,1);
  hookHolder.add(hookHead);
  hookHolder.position.set(0, 60, 0);
  hookHolder.userData = { isHookRoot: true };
  scene.add(hookHolder);
  hookMesh = hookHolder;

  // line (visual) - using Line
  const lineMat = new THREE.LineBasicMaterial({ color: 0x111111 });
  const points = [ new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0) ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(lineGeo, lineMat);
  line.name = 'line';
  hookMesh.add(line);

  window.addEventListener('resize', onResize);
}

/* -------------------------
   spawn fishes
   ------------------------- */
function spawnFishes(level) {
  // clear
  fishes.forEach(f => {
    fishGroup.remove(f.mesh);
  });
  fishes = [];
  targetCount = 6 + (level - 1) * 2;
  targetEl.textContent = targetCount;

  for (let i = 0; i < targetCount; i++) {
    const body = new THREE.SphereGeometry(3 + Math.random() * 2, 12, 10);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5), roughness: 0.6 });
    const mesh = new THREE.Mesh(body, mat);

    // simple tail using cone
    const tailGeom = new THREE.ConeGeometry(2, 3, 8);
    const tail = new THREE.Mesh(tailGeom, mat);
    tail.rotation.z = Math.PI;
    tail.position.set(-5, 0, 0);
    mesh.add(tail);

    // position
    mesh.position.set((Math.random() - 0.5) * 60, 6 + Math.random() * 10, (Math.random() - 0.5) * 30);
    mesh.userData = {
      speed: 0.2 + Math.random() * 0.6,
      dir: Math.random() < 0.5 ? 1 : -1,
      bob: Math.random() * 2 * Math.PI,
      caught: false,
      id: i
    };
    fishGroup.add(mesh);
    fishes.push({ mesh });
  }
}

/* -------------------------
   UI / game control
   ------------------------- */
startBtn.addEventListener('click', () => {
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  initGame();
});

howBtn.addEventListener('click', () => howPanel.classList.remove('hidden'));
closeHow && closeHow.addEventListener('click', () => howPanel.classList.add('hidden'));

menuBtn.addEventListener('click', () => {
  dropdown.classList.toggle('hidden');
  if (!dropdown.classList.contains('hidden')) {
    // pause
    running = false;
    stopTimer();
  } else {
    // resume
    if (!answering) { running = true; startTimer(); animate(); }
  }
});
retryBtn.addEventListener('click', () => startLevel(currentLevel));
backBtn.addEventListener('click', () => returnToMenu());

nextBtn && nextBtn.addEventListener('click', () => {
  endModal.classList.add('hidden');
  startLevel(currentLevel + 1);
});
retryEndBtn && retryEndBtn.addEventListener('click', () => {
  endModal.classList.add('hidden');
  startLevel(currentLevel);
});
toMenuBtn && toMenuBtn.addEventListener('click', () => returnToMenu());

function returnToMenu(){
  running = false;
  stopTimer();
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
  endModal.classList.add('hidden');
  dropdown.classList.add('hidden');
}

/* -------------------------
   start / reset / timers
   ------------------------- */
function initGame() {
  if (!scene) initThree();
  spawnFishes(currentLevel);
  resetHook();
  lives = 3;
  score = 0;
  timeLeft = 120;
  updateHUD();
  running = true;
  startTimer();
  animate();
}

function startLevel(lv){
  currentLevel = Math.min(Math.max(1, lv), 10);
  spawnFishes(currentLevel);
  resetHook();
  score = 0;
  lives = 3;
  timeLeft = 120;
  updateHUD();
  running = true;
  answering = false;
  startTimer();
  animate();
}

function startTimer(){
  clearInterval(timerId);
  timerId = setInterval(()=>{
    if(!running) return;
    timeLeft--;
    updateHUD();
    if(timeLeft <= 0){
      clearInterval(timerId);
      endGame(false, false);
    }
  }, 1000);
}

function stopTimer(){ clearInterval(timerId); }

function updateHUD(){
  livesEl.textContent = lives;
  timeDisplay.textContent = formatMMSS(timeLeft);
  scoreEl.textContent = score;
}

/* -------------------------
   hook control & collision
   ------------------------- */
let hookState = { x: 0, y: 60, z: 0, isFalling: false, depth: 0, maxDepth: 50 };

function resetHook(){
  hookState.x = 0;
  hookState.y = 60;
  hookState.depth = 0;
  hookState.isFalling = false;
  hookMesh.position.set(0, hookState.y, 0);
  updateLine();
}

function updateLine(){
  const line = hookMesh.getObjectByName('line');
  if(line){
    const points = [ new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -hookState.depth/1.0, 0) ];
    line.geometry.setFromPoints(points);
  }
}

function dropHook(){
  if(answering) return;
  if(!hookState.isFalling){
    hookState.isFalling = true;
  } else {
    // if already falling, do nothing
  }
}

/* -------------------------
   question generation & UI
   ------------------------- */
function makeQuestion(){
  const max = Math.max(3, 4 + currentLevel * 2);
  let a = rand(1, Math.min(6, max));
  let b = rand(1, Math.min(6, max));
  let op = Math.random() < 0.5 ? '+' : '-';
  if(op === '-' && b > a) [a,b] = [b,a];
  const ans = op === '+' ? a + b : a - b;
  let opts = [ans];
  if(!opts.includes(ans+1)) opts.push(ans+1);
  if(!opts.includes(Math.max(0, ans-1))) opts.push(Math.max(0, ans-1));
  // shuffle
  for(let i=opts.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
  return { q: `${a} ${op} ${b} = ?`, ans, opts };
}

function showQuestionForFish(fishObj){
  answering = true;
  const Q = makeQuestion();
  qText.textContent = Q.q;
  qOptions.innerHTML = '';
  Q.opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      submitAnswer(opt, Q.ans, fishObj);
    });
    qOptions.appendChild(btn);
  });
  questionModal.classList.remove('hidden');
}

function submitAnswer(selected, correct, fishObj){
  questionModal.classList.add('hidden');
  if(selected === correct){
    // capture fish: hide it and increase score
    fishObj.mesh.visible = false;
    fishObj.mesh.userData.caught = true;
    score++;
    updateHUD();
    // if captured all -> win
    if(score >= targetCount){
      endGame(true, false);
    }
  } else {
    lives = Math.max(0, lives - 1);
    updateHUD();
    // animate fish fleeing: give it speed and new dir
    fishObj.mesh.userData.speed *= 2.5;
    fishObj.mesh.userData.dir = (Math.random()<0.5?1:-1);
    setTimeout(()=> { fishObj.mesh.userData.speed /= 2.5; }, 800);
    if(lives <= 0){
      endGame(false, true);
    }
  }
  answering = false;
}

/* -------------------------
   end game
   ------------------------- */
function endGame(success, outOfLives){
  running = false;
  stopTimer();
  endModal.classList.remove('hidden');
  if(success){
    endTitle.textContent = '🎉 Hebat! Level Selesai!';
    endMsg.textContent = `Kamu menangkap semua ikan di level ${currentLevel}!`;
  } else {
    if(outOfLives){
      endTitle.textContent = '😢 Nyawa Habis';
      endMsg.textContent = 'Nyawamu habis — coba lagi!';
    } else {
      endTitle.textContent = '⏱️ Waktu Habis';
      endMsg.textContent = 'Waktu habis — coba lagi!';
    }
  }
}

/* -------------------------
   animation loop
   ------------------------- */
function animate() {
  if (!running) { renderer.render(scene, camera); return; }
  const t = clock.getElapsedTime();

  // simple water wiggle (vertex move)
  scene.traverse(obj=>{
    if(obj.geometry && obj.geometry.type === 'PlaneGeometry'){
      const geo = obj.geometry;
      const pos = geo.attributes.position;
      for(let i=0;i<pos.count;i++){
        const y = 0.5 * Math.sin(i*0.02 + t*1.0);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  });

  // fishes movement
  fishes.forEach(fObj => {
    const m = fObj.mesh;
    if(!m.visible) return;
    m.userData.bob += 0.02;
    m.position.y = 6 + Math.sin(m.userData.bob) * 1.2;
    m.position.x += m.userData.speed * m.userData.dir;
    // bounds
    if (m.position.x > 70) m.userData.dir = -1;
    if (m.position.x < -70) m.userData.dir = 1;
    // rotate to direction
    m.rotation.y = m.userData.dir === 1 ? 0 : Math.PI;
  });

  // hook movement horizontal from input flags
  const moveSpeed = 0.9 + currentLevel*0.1;
  if(leftHeld) hookState.x = Math.max(-80, hookState.x - 1.6*moveSpeed);
  if(rightHeld) hookState.x = Math.min(80, hookState.x + 1.6*moveSpeed);

  // falling/raising logic
  if(hookState.isFalling){
    // increase depth
    if(hookState.depth < hookState.maxDepth) hookState.depth += 1.6 + currentLevel*0.2;
    else {
      // reached bottom -> reset
      hookState.isFalling = false;
      hookState.depth = 0;
    }
  } else {
    if(hookState.depth > 0) hookState.depth = Math.max(0, hookState.depth - 2.6);
  }

  // update hook mesh position
  hookMesh.position.set(hookState.x, hookState.y - hookState.depth, hookState.z);
  updateLine();

  // check collisions hook tip vs fishes
  if(!answering){
    const tipWorld = new THREE.Vector3();
    hookMesh.getWorldPosition(tipWorld);
    // adjust tip slightly lower to simulate tip
    tipWorld.y -= 1.8;
    fishes.forEach(fObj => {
      if(!fObj.mesh.visible) return;
      const d = tipWorld.distanceTo(fObj.mesh.position);
      if(d < 4.5 && hookState.depth > 3){
        // collision detected
        hookState.isFalling = false;
        // pause motion and show question
        showQuestionForFish(fObj);
      }
    });
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

/* -------------------------
   input listeners
   ------------------------- */
window.addEventListener('keydown', (e) => {
  if(e.key === 'ArrowLeft') leftHeld = true;
  if(e.key === 'ArrowRight') rightHeld = true;
  if(e.code === 'Space') dropHook();
});
window.addEventListener('keyup', (e) => {
  if(e.key === 'ArrowLeft') leftHeld = false;
  if(e.key === 'ArrowRight') rightHeld = false;
});

/* -------------------------
   helpers
   ------------------------- */
function onResize(){
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function formatMMSS(s){ const m = Math.floor(s/60); const sec = s%60; return (m<10?'0'+m:m)+':'+(sec<10?'0'+sec:sec); }

/* -------------------------
   boot & utility
   ------------------------- */
function boot(){
  initThree();
  // initial UI states
  hud.classList.add('hidden');
  dropdown.classList.add('hidden');
  questionModal.classList.add('hidden');
  endModal.classList.add('hidden');
  howPanel.classList.add('hidden');
}
boot();
