// 竹知了 3D 模型 —— 纯代码程序化 Three.js 重建（无外部网格/贴图资源）。
// 依据实物三视图逐像素测量比例：以筒身高度为 1 个单位，
// 竹筒 r=0.334、红漆顶圈 r=0.344 h=0.107、翅膀 0.30x1.02（梢部到 y=-0.25）、
// 甩杆在 x=+0.63（r≈0.037，y -0.62..1.50）、杆头珠串 红球r0.091 / 琥珀珠 / 红球r0.101，
// 松香线系在顶球与琥珀珠之间，近垂直落入鼓面右缘 x≈0.24 处。
import * as THREE from 'three';

// ---------------------------------------------------------------- 程序化贴图
function bambooTexture({ size = 1024, seed = 7, base = '#d8b060', dark = '#b1863a', streak = '#946b28' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const lines = 170;
  for (let i = 0; i < lines; i++) {
    const x = (i / lines) * size + (rnd() - 0.5) * 4;
    const w = 0.6 + rnd() * 1.8;
    const alpha = 0.09 + rnd() * 0.15;
    g.strokeStyle = dark;
    g.globalAlpha = alpha;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x + (rnd() - 0.5) * 2, 0);
    for (let y = 0; y <= size; y += size / 8) g.lineTo(x + (rnd() - 0.5) * 3, y);
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = rnd() * size;
    g.strokeStyle = streak;
    g.globalAlpha = 0.16 + rnd() * 0.12;
    g.lineWidth = 3 + rnd() * 6;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= size; y += size / 6) g.lineTo(x + (rnd() - 0.5) * 5, y);
    g.stroke();
  }
  const grad = g.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, 'rgba(255,244,214,0.10)');
  grad.addColorStop(0.5, 'rgba(160,130,80,0.06)');
  grad.addColorStop(1, 'rgba(255,244,214,0.08)');
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function bambooRoughnessTexture({ size = 512, seed = 11 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8c8c8c';
  g.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 120; i++) {
    const x = rnd() * size;
    g.strokeStyle = rnd() > 0.5 ? '#9e9e9e' : '#7a7a7a';
    g.globalAlpha = 0.35;
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (rnd() - 0.5) * 4, size);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------- 材质
function makeMaterials() {
  const grain = bambooTexture();
  const grainRough = bambooRoughnessTexture();

  const bamboo = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: grain, roughnessMap: grainRough, roughness: 1.0,
    metalness: 0, sheen: 0.15, sheenRoughness: 0.6, envMapIntensity: 0.55,
  });
  const bambooWing = bamboo.clone();
  bambooWing.map = grain;
  const grainMembrane = bambooTexture({ seed: 23, base: '#d8ae5c', dark: '#a67c34', streak: '#8c6526' });
  grainMembrane.repeat.set(1.15, 1.15);
  const bambooMembrane = new THREE.MeshPhysicalMaterial({
    color: 0xf3e2b4, map: grainMembrane, roughnessMap: grainRough, roughness: 1.0,
    metalness: 0, envMapIntensity: 0.5,
    emissive: 0xffcf8e, emissiveIntensity: 0.0, // 发声时透光（由 setSing 驱动）
  });
  const red = new THREE.MeshPhysicalMaterial({
    color: 0x9d150b, roughness: 0.24, metalness: 0,
    clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.32,
  });
  const black = new THREE.MeshPhysicalMaterial({
    color: 0x17130f, roughness: 0.14, metalness: 0,
    clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.9,
  });
  const amber = new THREE.MeshPhysicalMaterial({
    color: 0xa8721e, roughness: 0.3, metalness: 0,
    clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 0.5,
  });
  const string = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.85, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8a6f4a, roughness: 0.9, metalness: 0 });
  return { bamboo, bambooWing, bambooMembrane, red, black, amber, string, dark };
}

// ---------------------------------------------------------------- 几何
// 翅膀：椭圆薄片挤出 + 轻微拱面
function wingGeometry({ halfW = 0.15, halfL = 0.51, thick = 0.024, camber = 0.04 } = {}) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, halfW, halfL, 0, Math.PI * 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, steps: 1, curveSegments: 48 });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const acrossN = x / halfW, alongN = y / halfL;
    pos.setZ(i, pos.getZ(i) + camber * (1 - acrossN * acrossN) * 0.4 + camber * 0.3 * (1 - alongN * alongN));
  }
  geo.computeVertexNormals();
  return geo;
}

// 脚：圆头楔形，平底
function footGeometry({ len = 0.17, w = 0.10, h = 0.05 } = {}) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(-w / 2, len * 0.72, -w * 0.18, len);
  s.quadraticCurveTo(0, len * 1.08, w * 0.18, len);
  s.quadraticCurveTo(w / 2, len * 0.72, w / 2, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// 红漆顶圈：车削环 —— 外壁 + 倒角 + 顶面环带 + 内唇
function capGeometry({ rOut = 0.344, rIn = 0.318, height = 0.107, chamfer = 0.006 } = {}) {
  const pts = [
    new THREE.Vector2(rOut - chamfer, 0),
    new THREE.Vector2(rOut, chamfer),
    new THREE.Vector2(rOut, height - chamfer),
    new THREE.Vector2(rOut - chamfer, height),
    new THREE.Vector2(rIn + chamfer, height),
    new THREE.Vector2(rIn, height - chamfer),
    new THREE.Vector2(rIn, height - 0.03),
  ];
  return new THREE.LatheGeometry(pts, 64);
}

function catenaryPoints(a, b, sag = 0.06, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * Math.sin(Math.PI * t) * (1 - 0.25 * t);
    pts.push(p);
  }
  return pts;
}

// ---------------------------------------------------------------- 工厂
export function createZhuzhiliaoModel(options = {}) {
  const { castShadow = true, receiveShadow = true } = options;
  const M = makeMaterials();

  const nodes = {}, meshes = {}, sockets = {};
  const root = new THREE.Group();
  root.name = 'zhuzhiliao-3d';
  nodes.root = root;

  const addMesh = (id, geo, mat, parent, { pos, rot, explodeWithParent = false } = {}) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = id;
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.explodeWithParent = explodeWithParent;
    parent.add(mesh);
    meshes[id] = mesh;
    return mesh;
  };
  const addGroup = (id, parent, { pos, rot } = {}) => {
    const g = new THREE.Group();
    g.name = id;
    if (pos) g.position.set(...pos);
    if (rot) g.rotation.set(...rot);
    parent.add(g);
    nodes[id] = g;
    return g;
  };

  // ---- 蝉体（枢轴在鼓面绳孔处，甩动时绕其公转/摆动） ----
  const bodyPivot = addGroup('body-assembly', root, { pos: [0, 1.0, 0] });
  const body = addGroup('body-frame', bodyPivot, { pos: [0, -1.0, 0] });

  const tube = addMesh('tube-shell',
    new THREE.CylinderGeometry(0.334, 0.334, 0.90, 48, 1, true), M.bamboo, body,
    { pos: [0, 0.45, 0] });
  tube.material = tube.material.clone();
  tube.material.side = THREE.DoubleSide;
  addMesh('tube-underside', new THREE.CircleGeometry(0.334, 48), M.dark, body,
    { pos: [0, 0.012, 0], rot: [-Math.PI / 2, 0, 0], explodeWithParent: true });

  addMesh('rim-cap', capGeometry(), M.red, body, { pos: [0, 0.893, 0] });

  addMesh('membrane-top', new THREE.CylinderGeometry(0.318, 0.318, 0.02, 48), M.bambooMembrane, body,
    { pos: [0, 0.982, 0] });
  addMesh('string-knot', new THREE.SphereGeometry(0.014, 16, 12), M.string, body,
    { pos: [0.24, 0.998, 0.0], explodeWithParent: true });
  sockets['membrane-center'] = new THREE.Object3D();
  sockets['membrane-center'].position.set(0.24, 1.0, 0.0);
  body.add(sockets['membrane-center']);

  // 眼睛：半嵌在筒壁上的亮黑珠，方位角 ±30.5°，高度 y=0.80
  const eyeAz = (30.5 * Math.PI) / 180;
  for (const [id, sign] of [['eye-left', -1], ['eye-right', 1]]) {
    addMesh(id, new THREE.SphereGeometry(0.042, 24, 16), M.black, body,
      { pos: [sign * 0.334 * Math.sin(eyeAz), 0.80, 0.334 * Math.cos(eyeAz)] });
  }

  // 翅膀：以红销钉为铰点下垂，顶端内靠、梢部外八字张开
  for (const [id, sign] of [['wing-left', -1], ['wing-right', 1]]) {
    const pivot = addGroup(id + '-pivot', body, { pos: [sign * 0.14, 0.76, 0.29] });
    const wing = new THREE.Mesh(wingGeometry(), M.bambooWing);
    wing.name = id;
    wing.position.set(sign * 0.01, -0.51, 0.025 + (id === 'wing-left' ? 0.014 : 0.0));
    wing.castShadow = castShadow;
    wing.receiveShadow = receiveShadow;
    pivot.add(wing);
    meshes[id] = wing;
    pivot.rotation.set(0.17, sign * -0.04, sign * 0.085);
    addMesh('wing-pin-' + (sign < 0 ? 'left' : 'right'), new THREE.SphereGeometry(0.021, 16, 12), M.red,
      pivot, { pos: [sign * 0.04, -0.035, 0.005], explodeWithParent: true });
  }

  // 脚：底部前侧外八字小楔
  for (const [id, sign] of [['foot-left', -1], ['foot-right', 1]]) {
    addMesh(id, footGeometry(), M.bamboo, body,
      { pos: [sign * 0.155, 0.012, 0.19], rot: [0.06, sign * -0.42, 0] });
  }

  // ---- 甩杆（握持枢轴在下三分之一处） ----
  const handle = addGroup('handle-assembly', root, { pos: [0.63, 0, 0], rot: [0, 0, -0.008] });
  addMesh('stick-shaft', new THREE.CylinderGeometry(0.037, 0.038, 2.12, 20), M.bambooWing, handle,
    { pos: [0, 0.44, 0] });
  addMesh('knob-sphere-top', new THREE.SphereGeometry(0.101, 28, 20), M.red, handle,
    { pos: [0, 1.782, 0] });
  addMesh('spacer-rondelle', new THREE.SphereGeometry(0.055, 20, 14), M.amber, handle,
    { pos: [0, 1.625, 0] }).scale.set(1, 0.6, 1);
  addMesh('knob-sphere-lower', new THREE.SphereGeometry(0.091, 26, 18), M.red, handle,
    { pos: [0, 1.489, 0] });
  sockets['stick-waist'] = new THREE.Object3D();
  sockets['stick-waist'].position.set(-0.02, 1.70, 0);
  handle.add(sockets['stick-waist']);
  sockets['grip'] = new THREE.Object3D();
  sockets['grip'].position.set(0, 0.05, 0);
  handle.add(sockets['grip']);

  // ---- 松香线：每帧按两端插孔位置重建 ----
  let stringMesh = null;
  const rebuildString = () => {
    const a = sockets['membrane-center'].getWorldPosition(new THREE.Vector3());
    const b = sockets['stick-waist'].getWorldPosition(new THREE.Vector3());
    root.worldToLocal(a); root.worldToLocal(b);
    const state = root.userData._state;
    let curve;
    if (state && state.mode === 'driven') {
      // 外部物理驱动：松则垂、紧则直，垂度由主页面按绳长差传入
      curve = new THREE.CatmullRomCurve3(catenaryPoints(a, b, Math.max(0.01, state.sag || 0)));
    } else if (state && state.mode === 'whirl') {
      curve = new THREE.CatmullRomCurve3(catenaryPoints(a, b, 0.01));
    } else {
      // 依三视图走线：入鼓面处近垂直下坠，靠近珠串处向外弯出
      const p1 = new THREE.Vector3(a.x, a.y + 0.40, a.z);
      const p2 = new THREE.Vector3(b.x - 0.28, b.y - 0.10, b.z);
      curve = new THREE.CubicBezierCurve3(a, p1, p2, b);
    }
    const geo = new THREE.TubeGeometry(curve, 48, 0.0065, 6, false);
    if (stringMesh) {
      stringMesh.geometry.dispose();
      stringMesh.geometry = geo;
    } else {
      stringMesh = new THREE.Mesh(geo, M.string);
      stringMesh.name = 'string';
      stringMesh.castShadow = castShadow;
      stringMesh.userData.explodeWithParent = true;
      root.add(stringMesh);
      meshes['string'] = stringMesh;
    }
  };
  root.updateMatrixWorld(true);
  rebuildString();

  // ---- 运行时：动画模式 + 爆炸图 ----
  const state = { mode: 'idle', explode: 0, t: 0 };
  root.userData._state = state;
  const basePos = new Map();
  const explodables = [];
  const partUnits = ['tube-shell', 'rim-cap', 'membrane-top', 'eye-left', 'eye-right',
    'foot-left', 'foot-right', 'stick-shaft', 'knob-sphere-top', 'spacer-rondelle', 'knob-sphere-lower'];
  for (const id of partUnits) explodables.push(meshes[id]);
  explodables.push(nodes['wing-left-pivot'], nodes['wing-right-pivot']);
  for (const obj of explodables) basePos.set(obj, obj.position.clone());

  const center = new THREE.Vector3(0.31, 0.85, 0);
  root.userData.setExplode = (k) => {
    state.explode = k;
    for (const obj of explodables) {
      const base = basePos.get(obj);
      const world = obj.parent.localToWorld(base.clone());
      const dir = world.clone().sub(center); // 以模型中心缩放布局，而非同距平移
      const target = center.clone().addScaledVector(dir, 1 + k);
      obj.position.copy(obj.parent.worldToLocal(target));
    }
    root.updateMatrixWorld(true);
    rebuildString();
  };
  root.userData.setMode = (mode) => {
    state.mode = mode;
    if (mode !== 'whirl') {
      bodyPivot.position.set(0, 1.0, 0);
      bodyPivot.rotation.set(0, 0, 0);
    }
  };
  // —— 外部物理驱动（主站甩动模拟接管摆位；本函数只管翅膀/绳/位姿映射） ——
  // pose: { stick:{x,y}, tube:{x,y}, headAngle, spin, tilt, stickTilt, flutter, spread, sag }
  // 坐标为模型世界单位（主站负责像素→世界换算），z 恒为 0 平面。
  root.userData.drivePose = (pose, t) => {
    state.mode = 'driven';
    state.sag = pose.sag;
    // 甩杆：杆梢(线结处 stick-waist 插孔)钉在锚点，杆身固定倾角
    const waist = sockets['stick-waist'].position;
    handle.rotation.set(0, 0, pose.stickTilt);
    const c = Math.cos(pose.stickTilt), s = Math.sin(pose.stickTilt);
    handle.position.set(
      pose.stick.x - (waist.x * c - waist.y * s),
      pose.stick.y - (waist.x * s + waist.y * c),
      0);
    handle.rotation.x = 0;
    // 蝉体：枢轴(鼓面线结)在绳末端，头朝绳方向；绕绳轴自旋 + 少量出屏倾斜增加立体感
    bodyPivot.position.set(pose.tube.x, pose.tube.y, 0);
    bodyPivot.rotation.set(pose.tilt, pose.spin, pose.headAngle, 'ZYX');
    // 翅膀：左右各自的铰链角由外部动力学给出（跟随晃动、气流张开、高频振翅）
    nodes['wing-left-pivot'].rotation.x = pose.wingL;
    nodes['wing-right-pivot'].rotation.x = pose.wingR;
    root.updateMatrixWorld(true);
    rebuildString();
  };
  // 发声强度 → 鼓面透光
  root.userData.setSing = (v) => {
    meshes['membrane-top'].material.emissiveIntensity = v * 0.85;
  };

  root.userData.tick = (dt, t) => {
    if (state.mode === 'driven') return; // 外部驱动时主循环不再自演
    state.t = t;
    const flutterA = state.mode === 'whirl' ? 0.35 : 0.02;
    const flutterF = state.mode === 'whirl' ? 34 : 2.1;
    nodes['wing-left-pivot'].rotation.x = 0.17 + Math.sin(t * flutterF) * flutterA;
    nodes['wing-right-pivot'].rotation.x = 0.17 + Math.sin(t * flutterF + 0.7) * flutterA;
    if (state.mode === 'whirl') {
      // 蝉体被绷紧的线拉着绕杆头公转，身体外倾、面向行进方向
      const anchor = sockets['stick-waist'].getWorldPosition(new THREE.Vector3());
      root.worldToLocal(anchor);
      const w = 4.2, R = 0.92;
      const ang = t * w;
      bodyPivot.position.set(anchor.x + Math.cos(ang) * R, anchor.y - 0.32, anchor.z + Math.sin(ang) * R);
      bodyPivot.rotation.set(0, -ang, 0.5);
      handle.rotation.z = -0.008 + Math.sin(t * w) * 0.05;
      handle.rotation.x = Math.cos(t * w) * 0.05;
    } else {
      handle.rotation.z = -0.008 + Math.sin(t * 0.8) * 0.01;
      bodyPivot.rotation.z = Math.sin(t * 0.6) * 0.006;
    }
    root.updateMatrixWorld(true);
    rebuildString();
  };

  root.userData.runtime = { nodes, meshes, sockets };
  return root;
}
