/**
 * 统一 Q 版 2D 绘制（11-28 16:00 全面优化）
 *
 * 视觉语言和 3D 完全对齐：MeshBasicMaterial 那种**纯色块、无黑描边、无渐变高光**，
 * Q 版团子比例（大圆头 + 小圆身 + 短粗半埋腿），大亮眼（白圈 + 虹膜 + 瞳孔 + 高光）。
 * 奶龙按用户提供的官方参考图单独定制：宽圆亮黄头 / 橙身 / 白圈墨绿眼 /
 * 粉白大肚皮 / 短粗双臂环抱胸前 / 灰褐脚趾。
 *
 * 打字手伸缩和 3D 共用同一语义：reach=0 手收在身前（奶龙是抱胸），
 * reach=1 手伸到键盘位置按下；停手后由上层状态机柔和收回。
 */
import type { AnimalSpecies, ResolvedSkin } from './catSkins';

export interface ChibiP {
  ctx: CanvasRenderingContext2D;
  s: ResolvedSkin;
  fur: string;
  secondary: string;
  belly: string;
  ink: string;
  t: number;
  expression: string;
  blink: number;
  squint: number;
  tapLeft: number;
  tapRight: number;
  /** 0 = 待机收手 / 抱胸，1 = 打字伸手 */
  reach: number;
}

interface ChibiCfg {
  headColor?: string;
  bodyColor?: string;
  headRx: number;
  headRy: number;
  headY: number;
  bodyRx: number;
  bodyRy: number;
  bodyY: number;
  bellyColor?: string;
  bellyRx?: number;
  bellyRy?: number;
  bellyY?: number;
  eyeX: number;
  eyeY: number;
  eyeRx: number;
  eyeRy: number;
  iris?: string;
  sclera?: boolean;
  pupil?: number;
  legX?: number;
  legY?: number;
  legR?: number;
  armX?: number;
  armY?: number;
  armR?: number;
  /** 待机时双臂环抱胸前（奶龙招牌姿势） */
  hug?: boolean;
  pawColor?: string;
  claw?: string;
  /** 脚掌前缘的小趾点（奶龙参考图的灰褐脚趾） */
  footClaw?: string;
  mouthY?: number;
  mouthW?: number;
  /** 微笑弧度倍数，默认 0.34；奶龙参考图是更明显的上扬弧 */
  smileCurve?: number;
  blush?: string;
  ears?: (p: ChibiP) => void;
  tail?: (p: ChibiP) => void;
  /** 头部色块之后、眼睛之前绘制的面部底色（熊猫黑眼圈这类） */
  markings?: (p: ChibiP) => void;
  crown?: (p: ChibiP) => void;
  face?: (p: ChibiP) => void;
}

function hex(c: string | null | undefined, fallback: string): string {
  if (!c) return fallback;
  const v = String(c).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  if (/^rgba?\(/i.test(v)) return v;
  return fallback;
}

function shift(c: string, amt: number): string {
  const m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const h = m[1];
    const ch = (i: number) => Math.max(0, Math.min(255, parseInt(h.slice(i, i + 2), 16) + amt));
    return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
  }
  // 也支持 rgb(r,g,b)（shift 自身或蛋形头 tint 会产出这种格式）
  const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) {
    const ch = (v: string) => Math.max(0, Math.min(255, parseInt(v, 10) + amt));
    return `rgb(${ch(rgb[1])},${ch(rgb[2])},${ch(rgb[3])})`;
  }
  return c;
}

/** 无描边色块：和 3D 的 MeshBasicMaterial 一样，颜色本身就是轮廓。 */
function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * 软陶质感填充：和猫咪 2D 的径向渐变同理，左上偏亮、底部略沉，
 * 让纯色块有体积感。幅度刻意做小，保持干净不发脏。
 */
function plushFill(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(
    x - rx * 0.28, y - ry * 0.42, rx * 0.08,
    x + rx * 0.10, y + ry * 0.18, Math.max(rx, ry) * 1.12,
  );
  g.addColorStop(0, shift(color, 16));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shift(color, -18));
  ctx.fillStyle = g;
  ctx.fill();
}

/**
 * 淡淡的同色系轮廓：比底色略深一点的椭圆垫在底层，露出一圈干净收边。
 * 用填充叠加而不是 stroke，避免头/身色块交接处出现难看的交叉横线。
 * 不是黑描边（用户明确不要黑边），只是同色压暗的版本。
 */
function fillSoftEdge(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  fillEllipse(ctx, x, y, rx + 5, ry + 5, shift(color, -20));
  plushFill(ctx, x, y, rx, ry, color);
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function roundLine(ctx: CanvasRenderingContext2D, color: string, w: number, pts: Array<[number, number]>): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

function curve(ctx: CanvasRenderingContext2D, color: string, w: number, draw: () => void): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

/** 大亮眼：白圈（可选）+ 虹膜 + 大瞳孔 + 双高光，和 3D eye() 同一套结构。 */
function chibiEye(p: ChibiP, x: number, y: number, rx: number, ry: number, iris: string, sclera: boolean, pupilScale = 0.5): void {
  const { ctx, ink } = p;
  if (p.blink > 0.45 || p.squint > 0.55) {
    curve(ctx, ink, Math.max(5, rx * 0.28), () => {
      ctx.moveTo(x - rx, y);
      ctx.quadraticCurveTo(x, y + ry * 0.75, x + rx, y);
    });
    return;
  }
  if (p.expression === 'happy') {
    curve(ctx, ink, Math.max(5, rx * 0.30), () => {
      ctx.moveTo(x - rx, y + ry * 0.18);
      ctx.quadraticCurveTo(x, y - ry * 1.15, x + rx, y + ry * 0.18);
    });
    return;
  }
  if (p.expression === 'love') {
    const r = Math.max(rx, ry) * 0.95;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.5, y - r * 0.15, x - r * 0.7, y - r * 1.3, x, y - r * 0.42);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.5, y - r * 0.15, x, y + r * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#e56f7f';
    ctx.fill();
    return;
  }
  if (p.expression === 'surprised') {
    fillEllipse(ctx, x, y, rx * 1.18, ry * 1.24, sclera ? '#ffffff' : iris);
    fillEllipse(ctx, x, y, rx, ry, iris);
    fillEllipse(ctx, x, y, rx * pupilScale, ry * pupilScale * 1.12, ink);
    fillEllipse(ctx, x - rx * 0.3, y - ry * 0.32, rx * 0.32, ry * 0.32, '#ffffff');
    return;
  }
  if (sclera) fillEllipse(ctx, x, y, rx * 1.24, ry * 1.24, '#ffffff');
  fillEllipse(ctx, x, y, rx, ry, iris);
  fillEllipse(ctx, x, y, rx * pupilScale, ry * pupilScale * 1.12, ink);
  if (p.s.eyeCatchlight !== false) {
    fillEllipse(ctx, x - rx * 0.30, y - ry * 0.32, rx * 0.31, ry * 0.31, '#ffffff');
    fillEllipse(ctx, x + rx * 0.34, y + ry * 0.30, rx * 0.15, ry * 0.15, '#ffffff');
  }
  if (p.expression === 'worried') {
    const side = x < 0 ? -1 : 1;
    roundLine(ctx, ink, Math.max(4, rx * 0.24), [[x + side * rx, y - ry * 0.7], [x - side * rx * 0.85, y - ry * 1.1]]);
  }
}

function chibiMouth(p: ChibiP, y: number, w: number, grin = true, arc = 0.34): void {
  curve(p.ctx, p.ink, Math.max(4, w * 0.14), () => {
    p.ctx.moveTo(-w, y);
    p.ctx.quadraticCurveTo(0, y + (grin ? w * arc : 3), w, y);
  });
}

/** 短粗半埋腿：一截胶囊 + 圆脚，几乎被身体盖住，只露一点。 */
function drawLegs(p: ChibiP, cfg: ChibiCfg): void {
  const { ctx } = p;
  const lx = cfg.legX ?? 60;
  const ly = cfg.legY ?? 248;
  const lr = cfg.legR ?? 46;
  [-1, 1].forEach((side) => {
    const x = side * lx;
    roundLine(ctx, cfg.bodyColor || p.secondary, lr * 1.15, [[x, ly - 24], [x, ly + 46]]);
    fillEllipse(ctx, x, ly + 46, lr * 0.86, lr * 0.44, cfg.pawColor || cfg.bodyColor || p.secondary);
    if (cfg.footClaw) {
      for (let i = -1; i <= 1; i++) {
        fillEllipse(ctx, x + i * lr * 0.40, ly + 46 + lr * 0.24, lr * 0.13, lr * 0.13, cfg.footClaw);
      }
    }
  });
}

/** 打字手：待机收在身前（奶龙抱胸），打字时伸到键盘位；带按键行程。 */
function drawArms(p: ChibiP, cfg: ChibiCfg): void {
  const { ctx } = p;
  const reach = Math.max(0, Math.min(1, p.reach));
  const ax = cfg.armX ?? 96;
  const ay = cfg.armY ?? 92;
  const aw = cfg.armR ?? 30;
  const body = cfg.bodyColor || p.secondary;
  [-1, 1].forEach((side) => {
    const sx = side * ax;
    const sy = ay;
    // 待机：抱胸臂横向靠拢，其余物种收在胸腹前
    const restX = side * (cfg.hug ? 26 : 50);
    const restY = ay + (cfg.hug ? 46 : 92);
    // 打字：伸到身体下方的键盘位置
    const typeX = side * (ax + 18);
    const typeY = 282;
    const px = restX + (typeX - restX) * reach;
    let py = restY + (typeY - restY) * reach;
    const tap = (side < 0 ? p.tapLeft : p.tapRight) * reach * 15;
    py -= tap;
    roundLine(ctx, body, aw * 1.05, [[sx, sy], [(sx + px) / 2, (sy + py) / 2 + 16], [px, py]]);
    fillEllipse(ctx, px, py, aw * 0.82, aw * 0.68, cfg.pawColor || body);
    if (cfg.claw) {
      for (let i = -1; i <= 1; i++) {
        fillEllipse(ctx, px + i * aw * 0.44, py + aw * 0.42, aw * 0.15, aw * 0.16, cfg.claw);
      }
    }
  });
}

function drawChibi(p: ChibiP, cfg: ChibiCfg): void {
  const { ctx } = p;
  const headColor = cfg.headColor || p.fur;
  const bodyColor = cfg.bodyColor || p.secondary;

  if (cfg.tail) cfg.tail(p);
  drawLegs(p, cfg);
  fillSoftEdge(ctx, 0, cfg.bodyY, cfg.bodyRx, cfg.bodyRy, bodyColor);
  if (cfg.bellyColor) {
    ctx.save();
    const wob = 1 + Math.sin(p.t * 2.5) * 0.012;
    ctx.translate(0, cfg.bellyY ?? cfg.bodyY + 20);
    ctx.scale(wob, 2 - wob);
    fillEllipse(ctx, 0, 0, cfg.bellyRx ?? cfg.bodyRx * 0.66, cfg.bellyRy ?? cfg.bodyRy * 0.74, cfg.bellyColor);
    ctx.restore();
  }
  drawArms(p, cfg);

  // 头部整体下移 26，让头身紧贴（旧版有明显「脖子」断层）。
  // 耳朵 / 眼睛 / 嘴的回调都在同一坐标系里，自动跟着偏移。
  ctx.save();
  ctx.translate(0, 26);
  if (cfg.ears) cfg.ears(p);
  fillSoftEdge(ctx, 0, cfg.headY, cfg.headRx, cfg.headRy, headColor);
  if (cfg.markings) cfg.markings(p);
  if (cfg.crown) cfg.crown(p);
  if (cfg.blush) {
    [-1, 1].forEach((side) => fillEllipse(ctx, side * cfg.eyeX * 1.45, cfg.eyeY + cfg.eyeRy * 1.55, cfg.eyeRx * 0.66, cfg.eyeRy * 0.3, cfg.blush!));
  }
  [-1, 1].forEach((side) => chibiEye(
    p,
    side * cfg.eyeX, cfg.eyeY, cfg.eyeRx, cfg.eyeRy,
    cfg.iris || p.s.eyeColorTop || '#2c2a30',
    cfg.sclera ?? false,
    cfg.pupil ?? 0.5,
  ));
  if (cfg.face) cfg.face(p);
  chibiMouth(p, cfg.mouthY ?? cfg.eyeY + cfg.eyeRy * 2.05, cfg.mouthW ?? cfg.eyeRx * 1.1, true, cfg.smileCurve ?? 0.34);
  ctx.restore();
}

function configFor(p: ChibiP, species: AnimalSpecies): ChibiCfg {
  const s = p.s;
  const fur = p.fur;
  const pale = s.bellyBibColor || '#fff3e0';
  const ink = p.ink;
  switch (species) {
    case 'cat':
      return {
        headRx: 138, headRy: 126, headY: -96, bodyRx: 104, bodyRy: 108, bodyY: 132,
        bellyColor: pale, eyeX: 48, eyeY: -100, eyeRx: 26, eyeRy: 30,
        iris: s.eyeColorTop || '#c8e64a', pupil: 0.34,
        ears: (q) => [-1, 1].forEach((side) => fillPoly(q.ctx, [
          [side * 54, -182], [side * 112, -182], [side * 82, -268],
        ], fur)),
        tail: (q) => curve(q.ctx, fur, 34, () => {
          q.ctx.moveTo(96, 190); q.ctx.quadraticCurveTo(210, 150, 178, 30);
        }),
        face: (q) => {
          fillPoly(q.ctx, [[-12, -44], [12, -44], [0, -28]], q.s.noseColor || '#e08f9c');
        },
      };
    case 'dog':
      return {
        bodyColor: p.secondary, headColor: fur,
        headRx: 142, headRy: 130, headY: -94, bodyRx: 112, bodyRy: 106, bodyY: 134,
        bellyColor: pale, eyeX: 50, eyeY: -100, eyeRx: 26, eyeRy: 30, pupil: 0.46,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 118, -104, 38, 82, q.s.earOuterColor || q.secondary, side * 0.22)),
        tail: (q) => curve(q.ctx, q.secondary, 30, () => {
          q.ctx.moveTo(100, 176); q.ctx.quadraticCurveTo(196, 136, 168, 62);
        }),
        face: (q) => {
          fillEllipse(q.ctx, 0, -38, 46, 36, pale);
          fillEllipse(q.ctx, 0, -52, 20, 14, q.s.noseColor || '#2b211d');
          fillEllipse(q.ctx, 0, -14, 15, 20, '#ef8e9e');
        },
      };
    case 'fox':
      return {
        bodyColor: p.secondary, headColor: fur,
        headRx: 136, headRy: 118, headY: -98, bodyRx: 108, bodyRy: 100, bodyY: 140,
        bellyColor: pale, eyeX: 48, eyeY: -104, eyeRx: 25, eyeRy: 27,
        iris: s.eyeColorTop || '#d8a23c', pupil: 0.28,
        ears: (q) => [-1, 1].forEach((side) => fillPoly(q.ctx, [
          [side * 52, -172], [side * 122, -186], [side * 90, -272],
        ], fur)),
        tail: (q) => {
          q.ctx.save();
          q.ctx.translate(112, 168);
          q.ctx.rotate(0.35);
          fillEllipse(q.ctx, 62, 0, 92, 46, fur);
          fillEllipse(q.ctx, 136, -8, 34, 30, '#fff5e6');
          q.ctx.restore();
        },
        face: (q) => fillEllipse(q.ctx, 0, -34, 40, 25, pale),
      };
    case 'panda':
      return {
        headRx: 142, headRy: 128, headY: -96, bodyRx: 112, bodyRy: 110, bodyY: 132,
        eyeX: 52, eyeY: -104, eyeRx: 27, eyeRy: 31, pupil: 0.44,
        sclera: true, iris: '#3c3c44',
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 104, -192, 40, 42, '#202024')),
        markings: (q) => {
          [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 52, -104, 36, 38, '#202024'));
        },
        face: (q) => fillEllipse(q.ctx, 0, -40, 15, 11, '#202024'),
      };
    case 'bunny':
      return {
        headRx: 132, headRy: 126, headY: -100, bodyRx: 100, bodyRy: 108, bodyY: 136,
        bellyColor: pale, eyeX: 46, eyeY: -106, eyeRx: 24, eyeRy: 28,
        iris: '#8a6a67', pupil: 0.48,
        ears: (q) => [-1, 1].forEach((side) => {
          fillEllipse(q.ctx, side * 52, -264, 25, 92, fur, side * 0.1);
          fillEllipse(q.ctx, side * 52, -264, 11, 72, '#f3b8c4', side * 0.1);
        }),
        tail: (q) => fillEllipse(q.ctx, 92, 196, 32, 32, '#fffaf4'),
        blush: '#f3b8c4',
        face: (q) => fillEllipse(q.ctx, 0, -42, 11, 8, '#d98a9a'),
      };
    case 'penguin':
      return {
        headRx: 130, headRy: 122, headY: -96, bodyRx: 104, bodyRy: 120, bodyY: 136,
        bellyColor: '#ffffff', bellyRx: 70, bellyRy: 100, bellyY: 146,
        eyeX: 46, eyeY: -104, eyeRx: 23, eyeRy: 26, pupil: 0.5,
        face: (q) => fillPoly(q.ctx, [[-22, -48], [22, -48], [0, -16]], '#f5a623'),
        pawColor: '#f5a623',
      };
    case 'frog':
      return {
        headRx: 150, headRy: 112, headY: -92, bodyRx: 116, bodyRy: 100, bodyY: 140,
        bellyColor: '#c9e89b', bellyRx: 74, bellyRy: 72, eyeX: 62, eyeY: -156, eyeRx: 30, eyeRy: 32,
        iris: '#f5f5e8', pupil: 0.34,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 62, -156, 37, 39, fur)),
        blush: '#f3a8b6',
        face: (q) => {
          curve(q.ctx, '#3d7a35', 4, () => {
            q.ctx.moveTo(-34, -52); q.ctx.quadraticCurveTo(0, -38, 34, -52);
          });
        },
      };
    case 'chiikawa':
      return {
        headRx: 140, headRy: 128, headY: -96, bodyRx: 98, bodyRy: 100, bodyY: 136,
        eyeX: 44, eyeY: -100, eyeRx: 16, eyeRy: 18, iris: '#2c2a30', pupil: 0.62,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 100, -178, 24, 25, fur)),
        blush: '#f6b8c4',
        face: (q) => {
          fillEllipse(q.ctx, 0, -46, 9, 6, '#c48f9a');
          q.ctx.fillStyle = '#c48f9a';
          q.ctx.font = 'bold 14px sans-serif';
          q.ctx.fillText('ω', -8, -30);
        },
      };
    case 'grasscow':
      return {
        bodyColor: '#ffffff', headColor: '#ffffff',
        headRx: 140, headRy: 120, headY: -94, bodyRx: 116, bodyRy: 104, bodyY: 138,
        eyeX: 50, eyeY: -104, eyeRx: 24, eyeRy: 27, pupil: 0.46,
        ears: (q) => [-1, 1].forEach((side) => {
          fillEllipse(q.ctx, side * 130, -136, 34, 22, '#2c2c30', side * 0.3);
          fillEllipse(q.ctx, side * 84, -196, 16, 24, '#e8d6a8');
        }),
        face: (q) => {
          fillEllipse(q.ctx, 0, -38, 46, 34, '#f2a9b8');
          [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 17, -42, 7, 6, '#b86c7c'));
          fillEllipse(q.ctx, 0, -186, 34, 24, '#2c2c30');
        },
      };
    case 'milkdragon':
      return {
        // 按用户参考图：亮黄宽圆头 + 橙色身体 + 白圈墨绿眼 + 粉白大肚皮 + 抱胸臂
        headColor: s.furColor || '#ffc233',
        bodyColor: s.furSecondaryColor || '#f5a623',
        headRx: 168, headRy: 138, headY: -100,
        bodyRx: 112, bodyRy: 104, bodyY: 142,
        bellyColor: '#fff1ef', bellyRx: 80, bellyRy: 88, bellyY: 158,
        eyeX: 60, eyeY: -104, eyeRx: 25, eyeRy: 28,
        iris: '#2f6b46', sclera: true, pupil: 0.54,
        armX: 106, armY: 78, armR: 34, hug: true,
        pawColor: s.furSecondaryColor || '#f5a623', claw: '#8a7466',
        legX: 62, legY: 258, legR: 48, footClaw: '#8a7466',
        mouthY: -22, mouthW: 30, smileCurve: 0.62,
        // 参考图胸前的小灰褐爪尖由 drawArms 的 claw 画在掌上，不再在脸上叠一排点
      };
    case 'capybara':
      return {
        bodyColor: p.secondary, headColor: fur,
        headRx: 138, headRy: 118, headY: -92, bodyRx: 116, bodyRy: 104, bodyY: 140,
        bellyColor: pale, eyeX: 50, eyeY: -100, eyeRx: 23, eyeRy: 25, pupil: 0.48,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 112, -168, 26, 26, fur)),
        crown: (q) => {
          fillEllipse(q.ctx, 0, -238, 30, 28, '#f28c28');
          fillEllipse(q.ctx, 4, -258, 9, 16, '#6fa84a');
        },
        face: (q) => fillEllipse(q.ctx, 0, -34, 34, 26, '#f2a94a'),
      };
    case 'loopy':
      return {
        bodyColor: p.secondary, headColor: fur,
        headRx: 142, headRy: 128, headY: -96, bodyRx: 102, bodyRy: 106, bodyY: 138,
        bellyColor: '#ffd3e0', bellyRx: 68, bellyRy: 80,
        eyeX: 48, eyeY: -104, eyeRx: 25, eyeRy: 29, pupil: 0.46,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 116, -172, 30, 32, q.secondary)),
        crown: (q) => fillPoly(q.ctx, [[-38, -212], [0, -188], [-38, -164]], '#7fc4e8'),
        face: (q) => {
          fillEllipse(q.ctx, 0, -26, 18, 12, '#ffffff');
          q.ctx.fillStyle = '#c9527a';
          q.ctx.fillRect(-6, -34, 12, 12);
        },
        blush: '#f49ab6',
      };
    case 'bubu':
      return {
        bodyColor: p.secondary, headColor: fur,
        headRx: 138, headRy: 124, headY: -96, bodyRx: 106, bodyRy: 106, bodyY: 138,
        bellyColor: '#e9cba8', bellyRx: 66, bellyRy: 76,
        eyeX: 48, eyeY: -102, eyeRx: 25, eyeRy: 26, pupil: 0.46,
        ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 104, -182, 32, 34, q.secondary)),
        crown: (q) => {
          // 歪缝线
          curve(q.ctx, '#7a5844', 3.5, () => {
            q.ctx.moveTo(22, -214); q.ctx.lineTo(30, -178); q.ctx.lineTo(20, -150);
          });
        },
        face: (q) => {
          fillPoly(q.ctx, [[-42, -8], [0, 16], [42, -8], [0, 4]], '#f0b429');
          fillEllipse(q.ctx, 0, -36, 12, 9, '#4a3528');
        },
      };
  }
}

/**
 * 统一入口：画一只和 3D 同风格的 Q 版桌宠。
 * 调用方已把 ctx 平移/缩放到角色局部坐标系（cx=0, cy=0，地面 y≈320）。
 */
export function drawChibiSpecies(
  ctx: CanvasRenderingContext2D,
  skin: ResolvedSkin,
  species: AnimalSpecies,
  t: number,
  expression: string,
  blink: number,
  squint: number,
  tapLeft: number,
  tapRight: number,
  reach: number,
): void {
  const s = skin;
  const fur = hex(s.furColor, '#f4ece6');
  const p: ChibiP = {
    ctx, s, fur,
    secondary: hex(s.furSecondaryColor || s.armColor, shift(fur, -18)),
    belly: hex(s.bellyBibColor || s.muzzleColor, '#fff3e0'),
    ink: hex(s.mouthColor, '#3a302c'),
    t, expression, blink, squint, tapLeft, tapRight, reach,
  };
  drawChibi(p, configFor(p, species));
}
