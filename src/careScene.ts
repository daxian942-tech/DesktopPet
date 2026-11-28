/**
 * 照顾动作的场景道具（喂食的碗 / 喝水的水碗 / 玩耍的球 / 洗澡的水）。
 *
 * 这层刻意放在「引擎级」而不是物种模型里：
 *  - 2D：非猫由 speciesRenderer2d 在同一坐标系里调用，猫（含大肥鱼皮肤）
 *    由 catEngine 在逻辑坐标里调用；
 *  - 3D：直接挂到 catEngine3d 的 scene 上，跟随 catRoot 平移。
 * 因此猫和 12 只独立物种、2D 和 3D 看到的是同一套场景语义。
 *
 * 纯色扁平画法，和 11:45 定稿的角色风格一致：不吃灯光、无硬黑描边，
 * 只用同色系深浅两层做自然收边。
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export type CareSceneMood = 'idle' | 'happy' | 'eat' | 'drink' | 'play' | 'bath' | 'sleep';

/* ============================== 2D ============================== */

export interface CareScene2DOptions {
  /** 角色脚部中心的 x（当前 ctx 坐标系）。 */
  cx: number;
  /** 角色脚部附近的地面 y（当前 ctx 坐标系）。 */
  cy: number;
  /** 整体尺寸系数：物种绘制器内部已 scale(k)，传 1；引擎逻辑坐标传 logicalW/420。 */
  s: number;
  time: number;
  mood: CareSceneMood | string;
  /** 0..1 动作包络，结束前会自然淡出。 */
  amt: number;
}

/** 淡色同色系收边：底层略大的深色椭圆 + 上层本色，避免硬黑描边。 */
function softEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  edge: string,
  rotation = 0,
): void {
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 2.2, ry + 2.2, rotation, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fill();
}

function drawBowl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
  alpha: number,
  isDrink: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const shell = isDrink ? '#6db6dd' : '#e6a15c';
  const shellEdge = isDrink ? '#4e93bd' : '#c47c3c';
  const inner = isDrink ? '#a9dcf3' : '#f6d6a4';

  // 地面投影
  ctx.globalAlpha = alpha * 0.14;
  ctx.fillStyle = '#3a2c22';
  ctx.beginPath();
  ctx.ellipse(0, 15, 66, 12, 0, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = alpha;
  // 碗身（倒圆台，用二次曲线收底）
  ctx.fillStyle = shellEdge;
  ctx.beginPath();
  ctx.moveTo(-61, -5);
  ctx.lineTo(61, -5);
  ctx.quadraticCurveTo(54, 27, 0, 29);
  ctx.quadraticCurveTo(-54, 27, -61, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.moveTo(-57, -4);
  ctx.lineTo(57, -4);
  ctx.quadraticCurveTo(50, 24, 0, 26);
  ctx.quadraticCurveTo(-50, 24, -57, -4);
  ctx.closePath();
  ctx.fill();

  // 碗口 + 内容物
  softEllipse(ctx, 0, -5, 59, 15, inner, shellEdge);
  if (isDrink) {
    // 水面波纹
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const wob = Math.sin(time * 3.2 + i * 1.7) * 3;
      ctx.beginPath();
      ctx.ellipse(-4 + wob, -6 + i * 4, 30 - i * 8, 5.5 - i, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
  } else {
    // 几颗食物 + 一片菜叶，随咀嚼节拍轻跳
    const chew = Math.sin(time * 9.5) * 2.2;
    const bits: Array<[number, number, number, string]> = [
      [-24, -7, 11, '#c9703f'],
      [1, -9, 12, '#e9b563'],
      [24, -6, 10, '#b96138'],
      [-8, -14, 8.5, '#f0c987'],
      [14, -15, 7.5, '#d98b4a'],
    ];
    for (const [bx, by, br, c] of bits) {
      softEllipse(ctx, bx, by + chew * 0.4, br, br * 0.72, c, 'rgba(90,55,30,0.35)');
    }
    ctx.fillStyle = '#7fb563';
    ctx.beginPath();
    ctx.ellipse(34, -12 + chew * 0.5, 10, 5.5, -0.5, 0, TAU);
    ctx.fill();
  }

  // 碗口高光
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, -5, 54, 12.5, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  softEllipse(ctx, 0, 0, r, r, color, 'rgba(70,50,40,0.30)');
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffd45e';
  ctx.strokeStyle = 'rgba(214,142,38,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** 绘制当前照顾动作的场景道具；由 2D 引擎 / 物种绘制器在角色之后调用。 */
export function drawCareScene2D(ctx: CanvasRenderingContext2D, o: CareScene2DOptions): void {
  const amt = clamp01(o.amt);
  if (amt < 0.012) return;
  const mood = o.mood;
  if (mood !== 'eat' && mood !== 'drink' && mood !== 'play' && mood !== 'bath') return;

  const { cx, cy, s, time } = o;
  const alpha = Math.min(1, amt * 1.5);
  const rise = (1 - amt) * 22 * s; // 从下方滑入
  const bowlX = cx - 96 * s;
  const bowlY = cy + 8 * s + rise;

  ctx.save();
  if (mood === 'eat' || mood === 'drink') {
    drawBowl(ctx, bowlX, bowlY, s, time, alpha, mood === 'drink');
    // 香气 / 水气小泡
    const n = mood === 'drink' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const ph = (time * 0.85 + i * 0.29) % 1;
      const bx = bowlX + Math.sin(time * 2.6 + i * 1.9) * 17 * s + (i - (n - 1) / 2) * 13 * s;
      const by = bowlY - 26 * s - ph * 62 * s;
      ctx.globalAlpha = alpha * (1 - ph) * 0.78;
      ctx.fillStyle = mood === 'drink' ? '#c8ecff' : '#fff0cd';
      ctx.beginPath();
      ctx.arc(bx, by, (5 + ph * 3.4) * s, 0, TAU);
      ctx.fill();
    }
  } else if (mood === 'play') {
    // 两颗弹跳的小球 + 闪星
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 2; i++) {
      const ph = (time * 1.45 + i * 0.5) % 1;
      const hop = Math.abs(Math.sin(ph * Math.PI)) * 58 * s;
      const bx = cx + (i === 0 ? -104 : 104) * s + Math.sin(time * 2.1 + i) * 13 * s;
      const by = cy + 14 * s - hop;
      drawBall(ctx, bx, by, s, i === 0 ? 19 : 15, i === 0 ? '#f2837f' : '#8fc7e8');
    }
    for (let i = 0; i < 4; i++) {
      const ph = (time * 1.1 + i * 0.25) % 1;
      const sx = cx + Math.sin(i * 2.4 + time * 1.2) * 128 * s;
      const sy = cy - 20 * s - ph * 130 * s;
      drawStar(ctx, sx, sy, (7 + 4 * Math.sin(ph * Math.PI)) * s, alpha * (1 - ph) * 0.95);
    }
  } else {
    // bath：脚下水洼 + 落下的水滴 + 上升的肥皂泡
    ctx.globalAlpha = alpha * 0.24;
    ctx.fillStyle = '#8fd0f0';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18 * s, 122 * s, 20 * s, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#bfe8fb';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18 * s, 122 * s, 20 * s, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // 水滴（拉长的椭圆，带轻微倾斜）
    for (let i = 0; i < 11; i++) {
      const ph = (time * 0.95 + i * 0.113) % 1;
      const dx = Math.sin(i * 2.31 + time * 0.7) * 128 * s;
      const dy = cy - 180 * s + ph * 214 * s;
      ctx.globalAlpha = alpha * (1 - Math.abs(ph - 0.5) * 0.9) * 0.86;
      ctx.fillStyle = i % 3 === 0 ? '#bfe6ff' : '#79c3ec';
      ctx.beginPath();
      ctx.ellipse(cx + dx, dy, 4.6 * s, 9.5 * s, 0.22, 0, TAU);
      ctx.fill();
    }
    // 肥皂泡：空心圆 + 小高光
    for (let i = 0; i < 6; i++) {
      const ph = (time * 0.52 + i * 0.19) % 1;
      const bx = cx + Math.sin(i * 1.83 + time * 1.15) * 112 * s;
      const by = cy - 6 * s - ph * 168 * s;
      const r = (7 + (i % 3) * 3.5) * s;
      ctx.globalAlpha = alpha * (1 - ph) * 0.82;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.36)';
      ctx.beginPath();
      ctx.arc(bx - r * 0.32, by - r * 0.34, r * 0.26, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ============================== 3D ============================== */

interface CareMesh {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  kind: 'drop' | 'bubble' | 'food' | 'ball';
  baseX?: number;
  baseZ?: number;
}

export interface CareScene3DHandle {
  /** 每帧更新：t=引擎时间，mood/amt=照顾情绪包络，rootPos=角色根节点世界坐标。 */
  update(t: number, mood: CareSceneMood | string, amt: number, rootPos: THREE.Vector3): void;
  dispose(): void;
}

/**
 * 在场景层创建照顾道具。不挂到 catRoot / speciesModels.root 下，
 * 这样切物种、切 2D/3D 都不需要重建，猫和非猫共用同一组道具。
 */
export function createCareScene3D(scene: THREE.Scene): CareScene3DHandle {
  const root = new THREE.Group();
  root.name = 'care-scene-root';
  root.visible = false;
  scene.add(root);

  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (color: number, opacity = 1): THREE.MeshBasicMaterial => {
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      side: THREE.FrontSide,
    });
    mats.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const mesh = (
    parent: THREE.Object3D,
    g: THREE.BufferGeometry,
    m: THREE.Material,
    pos: [number, number, number],
  ): THREE.Mesh => {
    const o = new THREE.Mesh(g, m);
    o.position.set(pos[0], pos[1], pos[2]);
    parent.add(o);
    return o;
  };

  /* ---- 碗（feed / drink 共用外形，内盘颜色与内容物不同） ---- */
  const makeBowl = (isDrink: boolean): THREE.Group => {
    const g = new THREE.Group();
    const shell = isDrink ? 0x6db6dd : 0xe6a15c;
    const shellEdge = isDrink ? 0x4e93bd : 0xc47c3c;
    const inner = isDrink ? 0xa9dcf3 : 0xf6d6a4;

    // 碗身：略大的深色外壳 + 本色内壳 = 同色系淡边
    const outer = mesh(g, geo(new THREE.CylinderGeometry(0.63, 0.41, 0.27, 28)), mat(shellEdge), [0, 0.135, 0]);
    outer.name = 'bowl-outer';
    mesh(g, geo(new THREE.CylinderGeometry(0.595, 0.385, 0.255, 28)), mat(shell), [0, 0.137, 0]);
    // 内盘
    mesh(g, geo(new THREE.CylinderGeometry(0.565, 0.565, 0.022, 28)), mat(inner), [0, 0.272, 0]);
    // 碗口圈
    const rim = mesh(g, geo(new THREE.TorusGeometry(0.60, 0.032, 8, 30)), mat(shellEdge), [0, 0.278, 0]);
    rim.rotation.x = Math.PI / 2;

    if (isDrink) {
      // 水面 + 两圈波纹
      mesh(g, geo(new THREE.CylinderGeometry(0.55, 0.55, 0.012, 28)), mat(0x8fd2f2), [0, 0.288, 0]);
      for (let i = 0; i < 2; i++) {
        const ring = mesh(g, geo(new THREE.TorusGeometry(0.20 + i * 0.14, 0.014, 6, 28)), mat(0xdff4ff, 0.82), [0, 0.297, 0]);
        ring.rotation.x = Math.PI / 2;
      }
    } else {
      // 食物颗粒
      const bits: Array<[number, number, number, number, number]> = [
        [-0.25, 0.31, 0.02, 0.11, 0xc9703f],
        [0.02, 0.32, -0.04, 0.12, 0xe9b563],
        [0.26, 0.31, 0.05, 0.105, 0xb96138],
        [-0.08, 0.34, -0.18, 0.085, 0xf0c987],
        [0.14, 0.335, 0.20, 0.08, 0xd98b4a],
      ];
      for (const [x, y, z, r, c] of bits) {
        mesh(g, geo(new THREE.SphereGeometry(r, 10, 8)), mat(c), [x, y, z]);
      }
      const leaf = mesh(g, geo(new THREE.SphereGeometry(0.10, 10, 8)), mat(0x7fb563), [0.38, 0.30, -0.06]);
      leaf.scale.set(1, 0.32, 0.62);
    }
    // 稍微往左、缩小一档，避免压住键盘左上角
    g.position.set(-0.88, 0.012, 0.46);
    g.userData.baseScale = 0.82;
    root.add(g);
    return g;
  };
  const eatBowl = makeBowl(false);
  const drinkBowl = makeBowl(true);

  /* ---- 玩耍：两颗小球 ---- */
  const playGroup = new THREE.Group();
  const playBalls: CareMesh[] = [];
  const ballColors = [0xf2837f, 0x8fc7e8];
  for (let i = 0; i < 2; i++) {
    const b = mesh(playGroup, geo(new THREE.SphereGeometry(i === 0 ? 0.17 : 0.13, 16, 12)), mat(ballColors[i]), [
      -0.75 + i * 1.5, 0.18, 0.55,
    ]);
    playBalls.push({ mesh: b, baseY: 0.18, phase: i * 0.5, kind: 'ball', baseX: b.position.x, baseZ: 0.55 });
  }
  // 几颗小星星用八面体代替，保持扁平色块感
  for (let i = 0; i < 4; i++) {
    const st = mesh(playGroup, geo(new THREE.OctahedronGeometry(0.075, 0)), mat(0xffe28a), [
      Math.sin(i * 2.4) * 0.85, 0.7 + i * 0.22, 0.42,
    ]);
    st.name = 'play-star';
  }
  root.add(playGroup);

  /* ---- 洗澡：水洼 + 水滴 + 肥皂泡 ---- */
  const bathGroup = new THREE.Group();
  const puddle = mesh(
    bathGroup,
    geo(new THREE.CircleGeometry(0.86, 32)),
    mat(0x8fd0f0, 0.55),
    [0, 0.010, 0.34],
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(1, 0.30, 1);

  const waterBits: CareMesh[] = [];
  for (let i = 0; i < 12; i++) {
    const d = mesh(
      bathGroup,
      geo(new THREE.SphereGeometry(0.062, 10, 8)),
      mat(i % 3 === 0 ? 0xbfe6ff : 0x79c3ec, 0.88),
      [Math.sin(i * 2.31) * 0.82, 0.4, 0.32 + (i % 4) * 0.11],
    );
    d.scale.set(0.72, 1.5, 0.72);
    (d.material as THREE.MeshBasicMaterial).userData.dynamicOpacity = true;
    waterBits.push({ mesh: d, baseY: 0.4, phase: i * 0.113, kind: 'drop', baseX: d.position.x, baseZ: d.position.z });
  }
  for (let i = 0; i < 7; i++) {
    const b = mesh(
      bathGroup,
      geo(new THREE.SphereGeometry(0.095 + (i % 3) * 0.025, 14, 10)),
      mat(0xe8f8ff, 0.78),
      [Math.sin(i * 1.83) * 0.72, 0.3, 0.36 + (i % 3) * 0.1],
    );
    (b.material as THREE.MeshBasicMaterial).userData.dynamicOpacity = true;
    waterBits.push({ mesh: b, baseY: 0.3, phase: i * 0.19, kind: 'bubble', baseX: b.position.x, baseZ: b.position.z });
  }
  root.add(bathGroup);

  const groups = [eatBowl, drinkBowl, playGroup, bathGroup];
  const setOpacity = (g: THREE.Object3D, a: number): void => {
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.MeshBasicMaterial;
      // 水滴 / 泡泡的透明度由相位逐帧计算，别被整体包络覆盖掉
      if (!m || !m.transparent || m.userData.dynamicOpacity) return;
      m.opacity = (m.userData.baseOpacity ?? m.opacity) * a;
    });
  };
  // 记录初始透明度，淡出时按比例缩放
  for (const m of mats) {
    const mm = m as THREE.MeshBasicMaterial;
    mm.userData.baseOpacity = mm.opacity;
  }

  return {
    update(t, mood, amt, rootPos) {
      const a = clamp01(amt);
      root.position.copy(rootPos);
      if (a < 0.012 || (mood !== 'eat' && mood !== 'drink' && mood !== 'play' && mood !== 'bath')) {
        root.visible = false;
        return;
      }
      root.visible = true;
      const isEat = mood === 'eat';
      const isDrink = mood === 'drink';
      const isPlay = mood === 'play';
      const isBath = mood === 'bath';
      eatBowl.visible = isEat;
      drinkBowl.visible = isDrink;
      playGroup.visible = isPlay;
      bathGroup.visible = isBath;

      // 入场：从下方升起 + 轻微放大
      const rise = (1 - a) * 0.32;
      for (const g of groups) {
        g.position.y = 0.012 - rise;
        const sc = 0.86 + 0.14 * a;
        g.scale.setScalar((g.userData.baseScale ?? 1) * sc);
      }

      // 碗里食物/水面轻微呼吸
      if (isEat || isDrink) {
        const g = isEat ? eatBowl : drinkBowl;
        g.children.forEach((c, i) => {
          if (c.name === 'bowl-outer') return;
          const w = Math.sin(t * 6 + i * 0.8) * 0.012;
          c.position.y = (c.userData.baseY ??= c.position.y) + w;
        });
      }

      // 玩耍：小球抛物线弹跳 + 星星自转
      if (isPlay) {
        for (const b of playBalls) {
          const ph = (t * 1.45 + b.phase) % 1;
          b.mesh.position.y = b.baseY + Math.abs(Math.sin(ph * Math.PI)) * 0.46;
          b.mesh.position.x = (b.baseX ?? 0) + Math.sin(t * 2.1 + b.phase * 4) * 0.10;
        }
        playGroup.children.forEach((c, i) => {
          if (c.name === 'play-star') {
            c.rotation.y = t * 1.6 + i;
            c.position.y = 0.7 + i * 0.22 + Math.sin(t * 2.4 + i) * 0.06;
          }
        });
      }

      // 洗澡：水滴下落 / 泡泡上升，透明度随相位淡出
      if (isBath) {
        puddle.scale.set(1 + Math.sin(t * 3.1) * 0.035, 0.30, 1 + Math.cos(t * 2.7) * 0.035);
        for (const b of waterBits) {
          const ph = (t * (b.kind === 'drop' ? 0.95 : 0.52) + b.phase) % 1;
          if (b.kind === 'drop') {
            b.mesh.position.y = 1.62 - ph * 1.55;
            b.mesh.position.x = (b.baseX ?? 0) + Math.sin(t * 0.7 + b.phase * 20) * 0.06;
          } else {
            b.mesh.position.y = 0.14 + ph * 1.35;
            b.mesh.position.x = (b.baseX ?? 0) + Math.sin(t * 1.15 + b.phase * 18) * 0.09;
          }
          const m = b.mesh.material as THREE.MeshBasicMaterial;
          const base = m.userData.baseOpacity ?? 0.8;
          m.opacity = base * Math.min(1, a * 1.4) * (1 - Math.abs(ph - 0.5) * 0.85);
        }
        // 非粒子材质也跟着整体包络淡出
        setOpacity(bathGroup, Math.min(1, a * 1.4));
      }
      // 碗/球组同样按包络淡出（只影响半透明材质）
      if (isEat || isDrink || isPlay) {
        const g = isEat ? eatBowl : isDrink ? drinkBowl : playGroup;
        setOpacity(g, Math.min(1, a * 1.4));
      }
    },
    dispose() {
      scene.remove(root);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
