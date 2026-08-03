// 3D 渲染层引导：在主站 2D 画布之上叠一层透明 WebGL，
// 每帧接收主站物理状态（甩杆锚点/竹筒质点/转速/发声强度），
// 把程序化 3D 模型摆到对应位姿。物理、声音、计数全部留在主站。
//
// 主站通过动态 import() 加载本模块：file:// 直开或 WebGL 不可用时
// import 失败/init 返回 null，主站自动回落 2D 手绘小蝉。
import * as THREE from 'three';
import { createZhuzhiliaoModel } from './model.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clampDt = (dt) => (dt > 0 && dt < 0.05 ? dt : 0);

export function init(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (_) {
    return null;
  }
  renderer.shadowMap.enabled = false;     // 夜景无承影面，省移动端开销
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // 夜景布光：月光自右上作主光，天光冷调补底，左后暖轮廓光勾边
  const hemi = new THREE.HemisphereLight(0xcdd6ff, 0x2a2237, 0.55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xfff0d2, 1.9);
  moon.position.set(2.4, 3.6, 2.6);
  scene.add(moon);
  const rim = new THREE.DirectionalLight(0xffb27a, 0.7);
  rim.position.set(-1.8, 1.0, -2.4);
  scene.add(rim);
  const front = new THREE.DirectionalLight(0xffe6c8, 0.5);
  front.position.set(-1.2, 0.6, 3.0);
  scene.add(front);

  const model = createZhuzhiliaoModel({ castShadow: false, receiveShadow: false });
  scene.add(model);

  // 相机：世界单位 == CSS 像素，z=0 平面与屏幕一一对应
  const camera = new THREE.PerspectiveCamera(35, 1, 10, 6000);
  let W = 1, H = 1, SCALE = 88;
  const applyCamera = () => {
    camera.aspect = W / H;
    const dist = (H / 2) / Math.tan((camera.fov / 2) * Math.PI / 180);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const px2wx = (x) => x - W / 2;
  const px2wy = (y) => H / 2 - y;

  let spin = 0, lastT = 0;
  // 翅膀铰链小动力学：弹簧-阻尼跟随（晃动时有滞后和过冲，慢晃也活）
  const wingL = { a: 0.15, v: 0 }, wingR = { a: 0.15, v: 0 };
  let prevOmega = 0;
  const WING_STIFF = 80, WING_DAMP = 9;

  return {
    // 主站 resize 时同步；SCALE = 一个模型单位(筒身高)对应的屏幕像素
    resize(w, h, dpr, scale) {
      W = Math.max(1, w); H = Math.max(1, h);
      SCALE = scale || SCALE;
      renderer.setPixelRatio(Math.min(2, dpr || 1));
      renderer.setSize(W, H);   // 同步 CSS 尺寸，与主画布逐像素对齐
      model.scale.setScalar(SCALE);
      applyCamera();
    },

    // 每帧驱动：state 直接取主站物理量（像素坐标；tube 自带 vx/vy）
    render(st) {
      const dt = clampDt(st.dt) || Math.min(0.05, st.now - lastT) || 0.016;
      lastT = st.now;

      const sx = px2wx(st.stick.x) / SCALE, sy = px2wy(st.stick.y) / SCALE;
      const tx = px2wx(st.tube.x) / SCALE, ty = px2wy(st.tube.y) / SCALE;

      // 头(鼓面)朝绳方向
      const headAngle = Math.atan2(sy - ty, sx - tx) - Math.PI / 2;
      // 甩得越快绕绳轴自旋越快，静止时缓慢回摆
      spin += (st.omega * 0.45 + Math.sin(st.now * 0.6) * 0.15) * dt;

      // —— 翅膀跟随晃动 ——
      // 气流吹开：随穿行速度张开；晃动跟随：绳向角加速度让左右翅一先一后甩尾；
      // 弹簧-阻尼积分产生滞后与过冲；高速时再叠高频振翅。
      const speed = Math.hypot(st.tube.vx || 0, st.tube.vy || 0) / SCALE;
      const alpha = clamp((st.omega - prevOmega) / dt, -60, 60);
      prevOmega = st.omega;
      const rest = 0.15 + Math.min(0.85, speed * 0.16)
                 + Math.sin(st.now * 2.1) * 0.02;          // 静置时轻微呼吸
      const kick = alpha * 0.016;                          // 甩尾激励（左右反相）
      const stepWing = (w, force) => {
        w.v += ((force - w.a) * WING_STIFF - w.v * WING_DAMP) * dt;
        w.a += w.v * dt;
        return w.a;
      };
      const flutter = Math.min(1, speed * 0.10 + st.active) * Math.sin(st.now * 46) * 0.22;
      const wl = stepWing(wingL, rest - kick) + flutter;
      const wr = stepWing(wingR, rest + kick) + flutter * 0.85;

      // 绳松弛量 → 垂度（换算成模型单位）
      const sag = Math.max(0, (st.ropeLen - st.ropeDist) * 0.55) / SCALE;

      model.userData.drivePose({
        stick: { x: sx, y: sy },
        tube: { x: tx, y: ty },
        headAngle,
        spin,
        tilt: 0.14 + st.active * 0.10,   // 轻微出屏倾斜，转快时更立体
        stickTilt: st.stickTilt,
        wingL: wl, wingR: wr, sag,
      }, st.now);
      model.userData.setSing(st.active);

      renderer.render(scene, camera);
    },

    clear() {
      renderer.clear(true, true, true);
    },

    dispose() {
      renderer.dispose();
    },
  };
}
