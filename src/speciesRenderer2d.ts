/**
 * Species-specific 2D drawing. Cats keep the original sitting silhouette;
 * every other species uses its own anatomy and pose rather than a cat template.
 */
import {
  resolveCustomSkin,
  resolveSpecies,
  type AnimalSpecies,
  type CatSkinConfig,
  type ResolvedSkin,
} from './catSkins';
import { drawChibiSpecies } from './chibi2d';

export type PetMood = 'idle' | 'happy' | 'eat' | 'drink' | 'play' | 'bath' | 'sleep';

export interface SpeciesRenderOptions {
  skin: ResolvedSkin;
  w: number;
  h: number;
  time: number;
  breath: number;
  blink: number;
  sleep: number;
  squint: number;
  mood: PetMood;
  moodAmt: number;
  /** 0..1 typing intensity; drives alternating paw taps. */
  typing?: number;
  /** 0..1 手伸到键盘的进度；不传时按 typing 状态机自动推进（预览/截图可固定）。 */
  handReach?: number;
}

interface Palette {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  s: ResolvedSkin;
  fur: string;
  outline: string;
  blink: number;
  squint: number;
  t: number;
  mood: PetMood;
  moodAmt: number;
  expression: FaceExpression2d;
  tapLeft: number;
  tapRight: number;
  /** 手伸到键盘的进度：0 收起/抱胸，1 按到键盘 */
  reach: number;
  eye: (x: number, y: number, rx: number, ry: number, color?: string) => void;
}

type FaceExpression2d = 'idle' | 'happy' | 'love' | 'surprised' | 'angry' | 'worried';

// 2D 打字手伸缩状态机，语义与 3D speciesModel3d.ts 的 handReach 一致：
// 打字时伸出、停手 0.5s 后柔和收回；伸出快、收回慢。
// 模块级是因为 renderSpecies2d 每帧只画一次，进度必须跨帧保留。
let chibiReach = 0;
let chibiLastTyping = -100;
let chibiPrevTime = 0;
let chibiTimeInit = false;

function pickExpression2d(t: number, mood: PetMood, moodAmt: number, sleep: number): FaceExpression2d {
  if (sleep > 0.5) return 'idle';
  if (moodAmt > 0.02 && (mood === 'happy' || mood === 'eat' || mood === 'drink' || mood === 'play' || mood === 'bath')) {
    return 'happy';
  }
  const slice = Math.floor(t / 6.5) % 4;
  const within = ((t % 6.5) + 6.5) % 6.5;
  if (within > 4.6) return (['happy', 'love', 'surprised', 'worried'] as FaceExpression2d[])[slice];
  return 'idle';
}

/** Smooth 0..1 pulse with zero velocity at both ends (no mechanical snap). */
function beat(t: number, period: number, start: number, end: number): number {
  const c = ((t % period) + period) % period;
  if (c <= start || c >= end) return 0;
  const x = (c - start) / (end - start);
  const s = Math.sin(Math.PI * x);
  return s * s;
}

/** Delayed envelope so elbow/wrist follow the shoulder instead of moving together. */
function followBeat2d(t: number, period: number, start: number, end: number, lag: number): number {
  return beat(t - lag, period, start, end);
}

function normHex(c: string | null | undefined, fallback = '#cccccc'): string {
  if (!c) return fallback;
  const v = String(c).trim();
  const m3 = v.match(/^#([0-9a-f]{3})$/i);
  if (m3) return '#' + m3[1].split('').map((x) => x + x).join('');
  if (/^#[0-9a-f]{6}$/i.test(v) || /^rgba?\(/i.test(v)) return v;
  return fallback;
}

function shade(hex: string, amt: number): string {
  const rgb = normHex(hex).match(/^#([0-9a-f]{6})$/i);
  if (!rgb) return hex;
  const h = rgb[1];
  const channel = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) + amt)));
  return `rgb(${channel(0)},${channel(2)},${channel(4)})`;
}

function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke?: string,
  lw = 5,
  rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, fill: string, stroke?: string, lw = 5): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function strokePath(ctx: CanvasRenderingContext2D, color: string, width: number, draw: () => void): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

function limb(ctx: CanvasRenderingContext2D, x: number, y: number, bend: number, foot: number, color: string, outline: string, width: number): void {
  strokePath(ctx, outline, width + 8, () => {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend, y + 48, foot, 342);
  });
  strokePath(ctx, color, width, () => {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend, y + 48, foot, 342);
  });
}

interface SoftLimb2dOptions {
  length: number;
  width: number;
  shoulder: number;
  elbow: number;
  pawRx: number;
  pawRy: number;
  fur: string;
  pawColor: string;
  outline: string;
  clawColor?: string;
  clawCount?: number;
  side: -1 | 1;
  /** 0..1 key-tap amount; lifts the shoulder and folds the elbow smoothly. */
  tap?: number;
}

/**
 * Two-segment limb with a rounded shoulder, a knuckled elbow and a paw sunk
 * into the tip. Drawing it as two tapered strokes plus joint balls keeps it
 * from reading as a single straight stick.
 */
function softLimb2d(ctx: CanvasRenderingContext2D, x: number, y: number, opts: SoftLimb2dOptions): void {
  const { width: w, fur, outline, side } = opts;
  const tap = Math.max(0, Math.min(1, opts.tap ?? 0));
  const upperLen = opts.length * 0.56;
  const lowerLen = opts.length * 0.44;
  const lowerW = w * 0.82;
  ctx.save();
  ctx.translate(x, y - tap * 16);
  ctx.rotate(opts.shoulder - side * tap * 0.26);
  // Shoulder ball grows out of the torso.
  blob(ctx, 0, 0, w * 0.62, w * 0.62, fur, outline, 4);
  // Upper arm with a slight taper toward the elbow.
  strokePath(ctx, outline, w + 9, () => {
    ctx.moveTo(0, 0);
    ctx.lineTo(side * w * 0.12, upperLen);
  });
  strokePath(ctx, fur, w, () => {
    ctx.moveTo(0, 0);
    ctx.lineTo(side * w * 0.12, upperLen);
  });
  ctx.translate(side * w * 0.12, upperLen);
  ctx.rotate(opts.elbow + side * tap * 0.34);
  // Elbow ball hides the seam and gives the limb a joint.
  blob(ctx, 0, 0, lowerW * 0.60, lowerW * 0.60, fur, outline, 3.5);
  strokePath(ctx, outline, lowerW + 8, () => { ctx.moveTo(0, 0); ctx.lineTo(0, lowerLen); });
  strokePath(ctx, fur, lowerW, () => { ctx.moveTo(0, 0); ctx.lineTo(0, lowerLen); });
  // Paw sunk into the forearm tip.
  ctx.translate(0, lowerLen);
  blob(ctx, 0, opts.pawRy * 0.28, opts.pawRx, opts.pawRy, opts.pawColor, outline, 3.5);
  if (opts.clawColor && opts.clawCount) {
    for (let i = 0; i < opts.clawCount; i++) {
      const dx = (i - (opts.clawCount - 1) / 2) * (opts.pawRx * 0.72);
      blob(ctx, dx, opts.pawRy * 0.62, opts.pawRx * 0.20, opts.pawRy * 0.24, opts.clawColor);
    }
  }
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.55, y - r * 0.15, x - r * 0.72, y - r * 1.3, x, y - r * 0.42);
  ctx.bezierCurveTo(x + r * 0.72, y - r * 1.3, x + r * 1.55, y - r * 0.15, x, y + r * 0.9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawEye(P: Palette, x: number, y: number, rx: number, ry: number, color = '#24232a'): void {
  const { ctx, outline } = P;
  const side: -1 | 1 = x < P.cx ? -1 : 1;
  // Expression overlays replace the baseline eye, so every species can show
  // more than the same neutral dot/mouth pair without duplicating artwork.
  if (P.expression === 'happy' || P.expression === 'love') {
    if (P.expression === 'love') {
      drawHeart(ctx, x, y, Math.max(rx, ry) * 1.05, '#e56f7f');
    } else {
      strokePath(ctx, outline, Math.max(4, rx * 0.3), () => {
        ctx.moveTo(x - rx * 1.05, y + ry * 0.16);
        ctx.quadraticCurveTo(x, y - ry * 1.18, x + rx * 1.05, y + ry * 0.16);
      });
    }
    return;
  }
  if (P.blink > 0.45 || P.squint > 0.55) {
    strokePath(ctx, outline, 5, () => {
      ctx.moveTo(x - rx, y);
      ctx.quadraticCurveTo(x, y + ry * 0.8, x + rx, y);
    });
    return;
  }
  if (P.expression === 'surprised') {
    blob(ctx, x, y, rx * 1.2, ry * 1.28, normHex(color), outline, 2.5);
    blob(ctx, x - rx * 0.34, y - ry * 0.42, Math.max(3, rx * 0.28), Math.max(3, ry * 0.28), '#fff');
    return;
  }
  blob(ctx, x, y, rx, ry, normHex(color), outline, 2.5);
  if (P.s.eyeCatchlight) blob(ctx, x - rx * 0.28, y - ry * 0.3, Math.max(3, rx * 0.23), Math.max(3, ry * 0.23), '#fff');
  if (P.expression === 'angry') {
    strokePath(ctx, outline, Math.max(4, rx * 0.28), () => {
      ctx.moveTo(x + side * rx * 1.14, y - ry * 1.05);
      ctx.lineTo(x - side * rx * 0.90, y - ry * 0.34);
    });
  } else if (P.expression === 'worried') {
    strokePath(ctx, outline, Math.max(4, rx * 0.26), () => {
      ctx.moveTo(x + side * rx * 1.02, y - ry * 0.72);
      ctx.lineTo(x - side * rx * 0.90, y - ry * 1.14);
    });
    blob(ctx, x + side * rx * 0.92, y + ry * 0.82, Math.max(3, rx * 0.22), Math.max(4, ry * 0.34), '#7fc6e8');
  }
}

function mouth(P: Palette, x: number, y: number, w: number, smile = true): void {
  strokePath(P.ctx, P.s.mouthColor || P.outline, 4, () => {
    P.ctx.moveTo(x - w, y);
    P.ctx.quadraticCurveTo(x, y + (smile ? 22 : 3), x + w, y);
  });
}

/** Mouth with adjustable corners: negative = downtrodden, positive = grin. */
function mouthArc(P: Palette, x: number, y: number, w: number, cornerY: number, depth = 14): void {
  strokePath(P.ctx, P.s.mouthColor || P.outline, 4, () => {
    P.ctx.moveTo(x - w, y + cornerY);
    P.ctx.quadraticCurveTo(x, y + depth, x + w, y + cornerY);
  });
}

/** Sleepy / deadpan eye: a filled slit plus a heavy upper lid. */
function halfLid(P: Palette, x: number, y: number, rx: number, ry: number, color = '#24232a'): void {
  blob(P.ctx, x, y, rx, ry * 0.52, color, undefined, 0);
  strokePath(P.ctx, P.outline, 5, () => {
    P.ctx.moveTo(x - rx, y - ry * 0.18);
    P.ctx.quadraticCurveTo(x, y - ry * 0.62, x + rx, y - ry * 0.18);
  });
}

function drawCat(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const hw = s.contour.headWidth * 150;
  const hy = cy - 40;
  strokePath(ctx, fur, 34, () => {
    ctx.moveTo(cx + 115, cy + 300);
    ctx.quadraticCurveTo(cx + 250, cy + 280, cx + 220, cy + 90);
  });
  blob(ctx, cx, cy + 215, s.contour.bodyChubbiness * 118, 150, fur, outline);
  if (s.bellyBibColor) blob(ctx, cx, cy + 235, 74, 110, s.bellyBibColor);
  [-1, 1].forEach((side) => {
    const ex = cx + side * hw * 0.6;
    poly(ctx, [[ex - 38, hy - 40], [ex + 38, hy - 40], [ex + side * 6, hy - 136 * s.contour.earScale]], fur, outline);
  });
  blob(ctx, cx, hy + 20, hw, 150, fur, outline, 6);
  [-1, 1].forEach((side) => P.eye(cx + side * hw * 0.4, hy + 8, 40, 46, s.eyeColorTop));
  if (s.noseColor) poly(ctx, [[cx - 14, hy + 80], [cx + 14, hy + 80], [cx, hy + 98]], s.noseColor);
  mouth(P, cx, hy + 118, 28);
}

function drawDog(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const cream = s.bellyBibColor || '#f6e8d2';
  const ear = s.earOuterColor || shade(fur, -30);
  strokePath(ctx, outline, 45, () => {
    ctx.moveTo(cx + 155, cy + 185);
    ctx.quadraticCurveTo(cx + 265, cy + 115, cx + 220, cy + 20);
  });
  strokePath(ctx, fur, 35, () => {
    ctx.moveTo(cx + 155, cy + 185);
    ctx.quadraticCurveTo(cx + 265, cy + 115, cx + 220, cy + 20);
  });
  [-90, -25, 85, 145].forEach((x, i) => limb(ctx, cx + x, cy + 205, i % 2 ? -8 : 8, cx + x + (i < 2 ? -8 : 8), i < 2 ? cream : fur, outline, 38));
  blob(ctx, cx + 30, cy + 180, 190, 105, fur, outline, 6, -0.04);
  blob(ctx, cx - 48, cy + 205, 65, 82, cream, undefined, 5, -0.25);
  blob(ctx, cx - 122, cy + 25, 124, 112, fur, outline, 6);
  [-1, 1].forEach((side) => {
    const ex = cx - 122 + side * 105;
    blob(ctx, ex, cy + 40, 42, 98, ear, outline, 5, side * 0.24);
  });
  blob(ctx, cx - 122, cy + 83, 70, 52, cream, outline, 4);
  blob(ctx, cx - 122, cy + 52, 29, 20, s.noseColor || '#26211f');
  [-1, 1].forEach((side) => P.eye(cx - 122 + side * 52, cy + 5, 20, 25, s.eyeColorTop));
  mouth(P, cx - 122, cy + 91, 34);
  blob(ctx, cx - 122, cy + 119, 18, 25, '#ef8e9e');
}

function drawFox(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const pale = s.bellyBibColor || '#fdf6e8';
  const dark = s.earTipColor || '#3a261c';
  ctx.save();
  ctx.translate(cx + 170, cy + 160);
  ctx.rotate(-0.3);
  blob(ctx, 85, 0, 155, 82, fur, outline, 6);
  poly(ctx, [[170, -60], [245, -5], [175, 52], [195, 0]], pale, outline, 4);
  ctx.restore();
  [-95, -35, 80, 140].forEach((x) => limb(ctx, cx + x, cy + 220, 4, cx + x, dark, outline, 27));
  blob(ctx, cx + 30, cy + 195, 185, 78, fur, outline, 6, -0.05);
  poly(ctx, [[cx - 218, cy - 42], [cx - 188, cy - 175], [cx - 108, cy - 70]], fur, outline, 6);
  poly(ctx, [[cx - 100, cy - 70], [cx - 30, cy - 176], [cx - 20, cy - 35]], fur, outline, 6);
  poly(ctx, [[cx - 200, cy - 72], [cx - 184, cy - 146], [cx - 140, cy - 79]], dark);
  poly(ctx, [[cx - 83, cy - 80], [cx - 39, cy - 146], [cx - 35, cy - 60]], dark);
  poly(ctx, [[cx - 226, cy - 52], [cx - 122, cy - 92], [cx - 18, cy - 48], [cx - 52, cy + 80], [cx - 122, cy + 142], [cx - 193, cy + 75]], fur, outline, 6);
  poly(ctx, [[cx - 207, cy + 28], [cx - 122, cy + 72], [cx - 37, cy + 28], [cx - 70, cy + 105], [cx - 122, cy + 142], [cx - 174, cy + 103]], pale);
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(cx - 122 + side * 54, cy - 12);
    ctx.rotate(-side * 0.28);
    if (P.blink > 0.45) strokePath(ctx, outline, 5, () => { ctx.moveTo(-24, 0); ctx.lineTo(24, 0); });
    else {
      blob(ctx, 0, 0, 28, 13, s.eyeColorTop, outline, 3);
      blob(ctx, 0, 0, 7, 11, '#19181b');
    }
    ctx.restore();
  });
  blob(ctx, cx - 122, cy + 119, 20, 13, s.noseColor || '#2b211c');
}

function drawPanda(P: Palette): void {
  const { ctx, cx, cy, fur, outline } = P;
  const black = '#1c1c1e';
  blob(ctx, cx + 202, cy + 170, 28, 28, fur, outline, 4);
  [-100, -32, 82, 145].forEach((x) => limb(ctx, cx + x, cy + 205, 0, cx + x, black, outline, 48));
  blob(ctx, cx + 30, cy + 180, 188, 115, fur, outline, 6);
  blob(ctx, cx - 65, cy + 190, 65, 112, black, undefined, 5, 0.1);
  [-1, 1].forEach((side) => blob(ctx, cx - 122 + side * 91, cy - 63, 43, 43, black, outline, 5));
  blob(ctx, cx - 122, cy + 18, 125, 112, fur, outline, 6);
  [-1, 1].forEach((side) => {
    blob(ctx, cx - 122 + side * 51, cy + 5, 37, 47, black, undefined, 5, side * 0.35);
    P.eye(cx - 122 + side * 51, cy + 4, 12, 15, '#f7f7f2');
  });
  blob(ctx, cx - 122, cy + 62, 23, 16, black);
  mouth(P, cx - 122, cy + 82, 24, false);
}

function drawBunny(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const inner = s.earInnerColor || '#f2b8c6';
  blob(ctx, cx + 205, cy + 190, 45, 45, s.tailTipColor || '#fff', outline, 5);
  blob(ctx, cx + 50, cy + 195, 155, 130, fur, outline, 6, -0.12);
  blob(ctx, cx + 125, cy + 260, 100, 92, fur, outline, 5);
  blob(ctx, cx + 135, cy + 333, 105, 32, fur, outline, 5, -0.08);
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(cx - 105 + side * 48, cy - 38);
    ctx.rotate(side * 0.1);
    blob(ctx, 0, -115, 34, 150, fur, outline, 5);
    blob(ctx, 0, -120, 15, 120, inner);
    ctx.restore();
  });
  blob(ctx, cx - 95, cy + 38, 105, 100, fur, outline, 6);
  blob(ctx, cx - 62, cy + 180, 55, 118, fur, outline, 5, -0.15);
  limb(ctx, cx - 75, cy + 220, -12, cx - 88, fur, outline, 26);
  limb(ctx, cx - 25, cy + 220, -10, cx - 40, fur, outline, 26);
  [-1, 1].forEach((side) => P.eye(cx - 95 + side * 43, cy + 20, 19, 24, s.eyeColorTop));
  poly(ctx, [[cx - 110, cy + 62], [cx - 80, cy + 62], [cx - 95, cy + 77]], s.noseColor || '#f08a9e');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.fillRect(cx - 109, cy + 82, 28, 28);
  ctx.strokeRect(cx - 109, cy + 82, 28, 28);
  strokePath(ctx, outline, 2, () => { ctx.moveTo(cx - 95, cy + 82); ctx.lineTo(cx - 95, cy + 110); });
}

function drawPenguin(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const white = s.bellyBibColor || '#fbfbf7';
  const orange = s.noseColor || '#f0a020';
  [-1, 1].forEach((side) => {
    poly(ctx, [[cx + side * 115, cy - 15], [cx + side * 190, cy + 175], [cx + side * 112, cy + 125]], fur, outline, 5);
    blob(ctx, cx + side * 62, cy + 342, 78, 25, orange, outline, 4, side * 0.1);
  });
  ctx.beginPath();
  ctx.moveTo(cx, cy - 220);
  ctx.bezierCurveTo(cx + 145, cy - 205, cx + 160, cy + 175, cx + 92, cy + 325);
  ctx.quadraticCurveTo(cx, cy + 360, cx - 92, cy + 325);
  ctx.bezierCurveTo(cx - 160, cy + 175, cx - 145, cy - 205, cx, cy - 220);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.stroke();
  blob(ctx, cx, cy + 100, 100, 205, white);
  [-1, 1].forEach((side) => {
    blob(ctx, cx + side * 48, cy - 115, 28, 33, white);
    P.eye(cx + side * 48, cy - 116, 11, 14, '#111318');
  });
  poly(ctx, [[cx - 34, cy - 67], [cx + 34, cy - 67], [cx, cy - 10]], orange, outline, 3);
}

function drawFrog(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const pale = s.bellyBibColor || '#d8efb4';
  [-1, 1].forEach((side) => {
    blob(ctx, cx + side * 155, cy + 240, 105, 78, fur, outline, 6, side * 0.35);
    strokePath(ctx, outline, 39, () => { ctx.moveTo(cx + side * 130, cy + 245); ctx.quadraticCurveTo(cx + side * 220, cy + 260, cx + side * 235, cy + 330); });
    strokePath(ctx, fur, 29, () => { ctx.moveTo(cx + side * 130, cy + 245); ctx.quadraticCurveTo(cx + side * 220, cy + 260, cx + side * 235, cy + 330); });
    for (let i = -1; i <= 1; i++) blob(ctx, cx + side * (235 + i * 18), cy + 338, 24, 12, fur, outline, 3);
    limb(ctx, cx + side * 90, cy + 170, side * 20, cx + side * 115, fur, outline, 24);
  });
  blob(ctx, cx, cy + 205, 175, 110, fur, outline, 6);
  blob(ctx, cx, cy + 220, 120, 78, pale);
  blob(ctx, cx, cy + 65, 180, 92, fur, outline, 6);
  [-1, 1].forEach((side) => {
    const ex = cx + side * 105;
    blob(ctx, ex, cy - 30, 58, 62, fur, outline, 5);
    blob(ctx, ex, cy - 28, 34, 38, '#f5f5e8', outline, 3);
    P.eye(ex, cy - 24, 14, 20, '#16210f');
  });
  strokePath(ctx, outline, 7, () => { ctx.moveTo(cx - 130, cy + 82); ctx.quadraticCurveTo(cx, cy + 150, cx + 130, cy + 82); });
  blob(ctx, cx - 25, cy + 45, 6, 4, outline);
  blob(ctx, cx + 25, cy + 45, 6, 4, outline);
}

function drawChiikawa(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const blue = '#8fb3cc';
  const cower = beat(P.t, 7.8, 3.6, 5.8) * 0.7;
  ctx.save();
  ctx.translate(0, cower * 12);
  ctx.rotate(cower * 0.02);
  blob(ctx, cx + 118, cy + 190, 36, 36, blue, outline, 4); // blue tail
  blob(ctx, cx, cy + 215, 110, 120, fur, outline, 5);
  [-1, 1].forEach((rawSide) => {
    const side = rawSide as -1 | 1;
    const elbow = followBeat2d(P.t, 7.8, 3.6, 5.8, 0.12) * 0.7;
    const wrist = followBeat2d(P.t, 7.8, 3.6, 5.8, 0.24) * 0.7;
    softLimb2d(ctx, cx + side * 98, cy + 152, {
      length: 96, width: 38,
      shoulder: side * (0.12 + cower * 0.42),
      elbow: side * (0.10 + elbow * 0.24 + wrist * 0.08),
      pawRx: 27, pawRy: 20, fur, pawColor: fur, outline, side,
      tap: side < 0 ? P.tapLeft : P.tapRight,
    });
    softLimb2d(ctx, cx + side * 46, cy + 278, {
      length: 48, width: 42, shoulder: 0, elbow: 0,
      pawRx: 40, pawRy: 22, fur, pawColor: shade(fur, -8), outline, side,
    });
    blob(ctx, cx + side * 103, cy - 155, 38, 37, fur, outline, 5);
  });
  blob(ctx, cx, cy - 40, 160, 145, fur, outline, 6);
  // Blue bow / headscarf across the top of the head.
  blob(ctx, cx - 66, cy - 158, 62, 43, blue, outline, 5, -0.22);
  blob(ctx, cx + 66, cy - 158, 62, 43, blue, outline, 5, 0.22);
  blob(ctx, cx, cy - 150, 22, 20, blue, outline, 4);
  strokePath(ctx, blue, 18, () => {
    ctx.moveTo(cx - 108, cy - 130);
    ctx.quadraticCurveTo(cx, cy - 92, cx + 108, cy - 130);
  });
  [-1, 1].forEach((side) => {
    P.eye(cx + side * 60, cy - 50, 17, 23, s.eyeColorTop);
    if (s.blushColor) {
      blob(ctx, cx + side * 106, cy + 10, 27, 14, s.blushColor || '#ffb3bf');
      for (let i = 0; i < 3; i++) {
        strokePath(ctx, '#e0708c', 3, () => {
          ctx.moveTo(cx + side * (94 + i * 11), cy + 2);
          ctx.lineTo(cx + side * (97 + i * 11), cy + 18);
        });
      }
    }
  });
  // Tiny w mouth and the small dot below it.
  strokePath(ctx, s.mouthColor || outline, 4, () => {
    ctx.moveTo(cx - 19, cy + 26);
    ctx.quadraticCurveTo(cx - 9, cy + 39, cx, cy + 28);
    ctx.quadraticCurveTo(cx + 9, cy + 39, cx + 19, cy + 26);
  });
  blob(ctx, cx, cy + 48, 5, 5, s.mouthColor || outline);
  ctx.restore();
}

function drawGrassCow(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const dark = s.furSecondaryColor || '#1b1b1e';
  const shock = beat(P.t, 8.4, 2.8, 4.8); // 牛惊
  ctx.save();
  ctx.translate(0, shock * 12);
  // Compact body and four stubby legs behind the face.
  blob(ctx, cx, cy + 195, 150, 100, fur, outline, 6);
  blob(ctx, cx - 125, cy + 175, 45, 45, dark, undefined, 4, 0.3);
  [-95, -35, 40, 100].forEach((x, i) => {
    const side = (i < 2 ? -1 : 1) as -1 | 1;
    const delayed = followBeat2d(P.t, 8.4, 2.8, 4.8, i % 2 === 0 ? 0.10 : 0.22);
    softLimb2d(ctx, cx + x, cy + 258, {
      length: 70, width: 34, shoulder: 0, elbow: side * delayed * 0.10,
      pawRx: 24, pawRy: 14, fur, pawColor: dark, outline, side,
    });
  });
  // Big front-facing head.
  blob(ctx, cx - 158, cy - 55, 52, 26, '#6d6d70', outline, 5, -0.25);
  blob(ctx, cx + 158, cy - 55, 52, 26, '#6d6d70', outline, 5, 0.25);
  blob(ctx, cx, cy + 10, 152, 128, fur, outline, 6);
  blob(ctx, cx - 95, cy - 78, 62, 35, dark, undefined, 5, -0.25);
  blob(ctx, cx + 100, cy - 74, 45, 30, dark, undefined, 5, 0.22);
  ctx.save();
  ctx.translate(cx, cy - 103);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.restore();
  strokePath(ctx, dark, 10, () => { ctx.moveTo(cx, cy - 92); ctx.lineTo(cx, cy - 38); });
  [-1, 1].forEach((side) => {
    P.eye(cx + side * 58, cy - 10 + shock * 4, 13, 17 + shock * 5, s.eyeColorTop);
    // Thick angry brows: inner end low, outer end high.
    strokePath(ctx, dark, 13, () => {
      ctx.moveTo(cx + side * 22, cy - 55);
      ctx.lineTo(cx + side * 108, cy - 82);
    });
  });
  blob(ctx, cx, cy + 66, 78, 44, s.noseColor || '#e8a0a8', outline, 4);
  [-1, 1].forEach((side) => blob(ctx, cx + side * 30, cy + 58, 9, 7, '#9d5d68'));
  // Shocked open O mouth with a pink lip ring.
  blob(ctx, cx, cy + 116, 32, 39, '#2b1f22', '#d98fa0', 7);
  blob(ctx, cx, cy + 153, 9, 5, '#2b1f22');
  ctx.restore();
}

function drawMilkDragon(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const pale = s.bellyBibColor || '#fff0b8';
  const wobble = Math.sin(P.t * 2.5) * 0.04;
  const duang = beat(P.t, 8.6, 3.2, 5.4);
  // No horns, no brows: just a round head, raised paws and a huge belly.
  blob(ctx, cx, cy + 200, 158, 156, fur, outline, 6);
  ctx.save();
  ctx.translate(cx, cy + 224);
  ctx.scale(1 + wobble + duang * 0.08, 1 - wobble * 0.7 - duang * 0.06);
  blob(ctx, 0, 0, 100, 116, pale);
  ctx.restore();
  [-1, 1].forEach((rawSide) => {
    const side = rawSide as -1 | 1;
    const wave = duang * 10 + Math.sin(P.t * 2.6 + side) * 5;
    const elbow = followBeat2d(P.t, 8.6, 3.2, 5.4, 0.12);
    const wrist = followBeat2d(P.t, 8.6, 3.2, 5.4, 0.24);
    softLimb2d(ctx, cx + side * 116, cy + 158 - wave, {
      length: 96, width: 46,
      shoulder: -side * (0.42 + duang * 0.16),
      elbow: -side * (0.10 + elbow * 0.26 + wrist * 0.10),
      pawRx: 30, pawRy: 22, fur, pawColor: fur, outline,
      clawColor: '#6b3a1f', clawCount: 3, side,
      tap: side < 0 ? P.tapLeft : P.tapRight,
    });
    softLimb2d(ctx, cx + side * 70, cy + 272, {
      length: 56, width: 52, shoulder: 0, elbow: 0,
      pawRx: 46, pawRy: 24, fur, pawColor: fur, outline,
      clawColor: '#6b3a1f', clawCount: 3, side,
    });
  });
  blob(ctx, cx, cy - 42, 154, 132, fur, outline, 6);
  [-1, 1].forEach((side) => {
    P.eye(cx + side * 60, cy - 54, 23, 27, '#151515');
  });
  mouthArc(P, cx, cy + 42, 30, 3, 12);
}

function drawCapybara(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const dark = shade(fur, -22);
  const wave = beat(P.t, 6.4, 2.0, 4.6);
  const lean = Math.sin(P.t * 0.48) * 0.03;
  ctx.save();
  ctx.rotate(lean);
  [-90, -30, 55, 115].forEach((x, i) => {
    const side = (i < 2 ? -1 : 1) as -1 | 1;
    softLimb2d(ctx, cx + x, cy + 272, {
      length: 64, width: 38, shoulder: 0, elbow: 0,
      pawRx: 24, pawRy: 16, fur: dark, pawColor: dark, outline, side,
    });
  });
  blob(ctx, cx + 15, cy + 205, 190, 105, fur, outline, 6);
  // Brown shorts with a couple of wrinkles.
  blob(ctx, cx + 15, cy + 258, 145, 42, '#a9602e', outline, 5);
  strokePath(ctx, shade('#a9602e', -22), 4, () => {
    ctx.moveTo(cx - 55, cy + 275); ctx.quadraticCurveTo(cx - 20, cy + 248, cx + 5, cy + 272);
    ctx.moveTo(cx + 55, cy + 275); ctx.quadraticCurveTo(cx + 88, cy + 250, cx + 110, cy + 270);
  });
  // Raised paw with an elbow that follows the shoulder.
  const capyElbow = followBeat2d(P.t, 6.4, 2.0, 4.6, 0.12);
  const capyWrist = followBeat2d(P.t, 6.4, 2.0, 4.6, 0.24);
  softLimb2d(ctx, cx + 155, cy + 205, {
    length: 88, width: 42,
    shoulder: -0.95 - wave * 0.35,
    elbow: -(capyElbow * 0.28 + capyWrist * 0.12),
    pawRx: 24, pawRy: 18, fur, pawColor: fur, outline, side: 1,
    tap: P.tapRight,
  });
  ctx.save();
  ctx.translate(cx - 20, cy + 55);
  ctx.rotate(lean + wave * 0.02);
  blob(ctx, 0, -8, 106, 110, fur, outline, 6);
  // Enormous orange muzzle dominating the face.
  blob(ctx, 0, 40, 100, 80, '#f59b1f', outline, 6);
  [-1, 1].forEach((side) => {
    blob(ctx, side * 73, -82, 24, 22, dark, outline, 4);
    blob(ctx, side * 71, -86, 11, 10, shade(fur, -34));
    P.eye(side * 47, -14, 12, 15, '#151515');
  });
  mouthArc(P, 0, 68, 22, 4, 14);
  ctx.restore();
  const ox = cx - 20 + Math.sin(P.t * 0.9) * 7;
  ctx.save();
  ctx.translate(ox, cy - 82);
  ctx.rotate(Math.sin(P.t * 1.35) * 0.12 + lean);
  blob(ctx, 0, 0, 34, 31, '#f5883a', outline, 4);
  blob(ctx, -10, -8, 12, 8, '#ffd06b');
  strokePath(ctx, '#5a8f32', 5, () => { ctx.moveTo(2, -26); ctx.lineTo(12, -40); });
  blob(ctx, 19, -38, 12, 6, '#68a541', undefined, 0, -0.5);
  ctx.restore();
  ctx.restore();
}

function drawLoopy(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const darkPaw = '#51283c';
  const wave = beat(P.t, 9.2, 3.8, 6.6);
  ctx.save();
  ctx.translate(cx + 165, cy + 270);
  ctx.rotate(-0.45 + Math.sin(P.t * 1.8) * 0.05);
  blob(ctx, 60, 25, 105, 55, shade(fur, -20), outline, 5);
  for (let i = -2; i <= 2; i++) {
    strokePath(ctx, shade(fur, -38), 3, () => { ctx.moveTo(i * 32 + 60, -12); ctx.lineTo(i * 32 + 92, 62); });
    strokePath(ctx, shade(fur, -38), 3, () => { ctx.moveTo(i * 32 + 60, 62); ctx.lineTo(i * 32 + 92, -12); });
  }
  ctx.restore();
  blob(ctx, cx, cy + 205, 135, 140, fur, outline, 5);
  blob(ctx, cx, cy + 240, 82, 92, '#f3e3e6'); // white belly
  [-1, 1].forEach((rawSide) => {
    const side = rawSide as -1 | 1;
    const raised = side < 0;
    const elbow = followBeat2d(P.t, 9.2, 3.8, 6.6, 0.12);
    const wrist = followBeat2d(P.t, 9.2, 3.8, 6.6, 0.24);
    softLimb2d(ctx, cx + side * 122, cy + 158, {
      length: 96, width: 42,
      shoulder: raised ? 0.85 + wave * 0.30 : -side * 0.15,
      elbow: raised ? elbow * 0.28 + wrist * 0.12 : -side * (0.08 + elbow * 0.10),
      pawRx: 24, pawRy: 18, fur, pawColor: darkPaw, outline,
      clawColor: darkPaw, clawCount: 3, side,
      tap: side < 0 ? P.tapLeft : P.tapRight,
    });
    softLimb2d(ctx, cx + side * 62, cy + 280, {
      length: 52, width: 46, shoulder: 0, elbow: 0,
      pawRx: 42, pawRy: 22, fur, pawColor: darkPaw, outline, side,
    });
    blob(ctx, cx + side * 140, cy - 80, 31, 33, fur, outline, 4);
    blob(ctx, cx + side * 140, cy - 80, 15, 16, '#f7d9df', outline, 2);
  });
  blob(ctx, cx, cy - 35, 155, 135, fur, outline, 6);
  // Two soft tapered orange tufts instead of thin straight lines.
  [-1, 1].forEach((side) => {
    const sway = Math.sin(P.t * 2.1 + side) * 8;
    poly(ctx, [
      [cx + side * 18, cy - 156],
      [cx + side * 50, cy - 214],
      [cx + side * 40 + sway, cy - 252],
      [cx + side * 30 + sway, cy - 210],
    ], '#e8752f', outline, 3);
    blob(ctx, cx + side * 40 + sway, cy - 250, 11, 13, '#e8752f');
  });
  [-1, 1].forEach((side) => {
    P.eye(cx + side * 60, cy - 45, 17, 22, '#151515');
  });
  blob(ctx, cx, cy + 12, 26, 21, '#6d1d53', outline, 3); // big purple nose
  // Open smile with two teeth.
  blob(ctx, cx, cy + 58, 36, 26, '#7a2a48', outline, 3);
  ctx.fillStyle = '#fffdf5';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.fillRect(cx - 20, cy + 46, 17, 18);
  ctx.strokeRect(cx - 20, cy + 46, 17, 18);
  ctx.fillRect(cx + 3, cy + 46, 17, 18);
  ctx.strokeRect(cx + 3, cy + 46, 17, 18);
}

function drawBubu(P: Palette): void {
  const { ctx, cx, cy, s, fur, outline } = P;
  const nod = Math.sin(P.t * 0.85) * 5;
  const wave = beat(P.t, 7.6, 3.4, 5.8);
  blob(ctx, cx, cy + 205, 140, 145, fur, outline, 5);
  // Yellow bow tie at the neck.
  blob(ctx, cx - 34, cy + 118, 38, 24, '#f2c14e', outline, 4, -0.18);
  blob(ctx, cx + 34, cy + 118, 38, 24, '#f2c14e', outline, 4, 0.18);
  blob(ctx, cx, cy + 118, 15, 15, '#f2c14e', outline, 3);
  [-1, 1].forEach((rawSide) => {
    const side = rawSide as -1 | 1;
    const elbow = followBeat2d(P.t, 7.6, 3.4, 5.8, 0.12);
    const wrist = followBeat2d(P.t, 7.6, 3.4, 5.8, 0.24);
    softLimb2d(ctx, cx + side * 118, cy + 158 - (side > 0 ? wave * 28 : 0), {
      length: 104, width: 46,
      shoulder: -side * (0.15 + (side > 0 ? wave * 0.72 : 0)),
      elbow: -side * (0.10 + elbow * 0.22 + wrist * 0.10),
      pawRx: 30, pawRy: 22, fur, pawColor: shade(fur, -12), outline, side,
      tap: side < 0 ? P.tapLeft : P.tapRight,
    });
    softLimb2d(ctx, cx + side * 62, cy + 275, {
      length: 56, width: 48, shoulder: 0, elbow: 0,
      pawRx: 42, pawRy: 22, fur, pawColor: shade(fur, -20), outline, side,
    });
    blob(ctx, cx + side * 108, cy - 150, 50, 50, fur, outline, 5);
    blob(ctx, cx + side * 108, cy - 150, 25, 25, s.earInnerColor || '#5b3a24');
  });
  // Red rose held in the left paw - bigger and clearer.
  strokePath(ctx, '#6b9a4a', 7, () => { ctx.moveTo(cx - 150, cy + 200); ctx.lineTo(cx - 176, cy + 118); });
  blob(ctx, cx - 162, cy + 165, 24, 11, '#6b9a4a', undefined, 0, -0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    blob(ctx, cx - 176 + Math.cos(a) * 20, cy + 100 + Math.sin(a) * 20, 20, 20, '#e05260', outline, 2);
  }
  blob(ctx, cx - 176, cy + 100, 14, 14, '#e05260', outline, 2);
  ctx.save();
  ctx.translate(0, nod + wave * 3);
  blob(ctx, cx, cy - 35, 150, 135, fur, outline, 6);
  [-1, 1].forEach((side) => {
    P.eye(cx + side * 58, cy - 45, 12, 15, '#151515');
    blob(ctx, cx + side * 112, cy + 8, 33, 21, '#e6a96f');
    for (let i = 0; i < 2; i++) {
      strokePath(ctx, '#c9864f', 3, () => {
        ctx.moveTo(cx + side * (99 + i * 14), cy + 1);
        ctx.lineTo(cx + side * (103 + i * 14), cy + 16);
      });
    }
  });
  strokePath(ctx, s.mouthColor || outline, 3.5, () => {
    ctx.moveTo(cx - 16, cy + 30);
    ctx.quadraticCurveTo(cx - 8, cy + 40, cx, cy + 30);
    ctx.quadraticCurveTo(cx + 8, cy + 40, cx + 16, cy + 30);
  });
  ctx.restore();
}

/**
 * 全部物种迁到统一 Q 版纯色无描边绘制（和 3D 同视觉语言）。
 * 旧版 drawXxx 函数保留在文件里作演进参考，不再被调用。
 */
function chibi(species: AnimalSpecies): (p: Palette) => void {
  return (p) => drawChibiSpecies(
    p.ctx, p.s, species, p.t, p.expression,
    p.blink, p.squint, p.tapLeft, p.tapRight, p.reach,
  );
}
const RENDERERS: Record<AnimalSpecies, (p: Palette) => void> = {
  cat: chibi('cat'),
  dog: chibi('dog'),
  fox: chibi('fox'),
  panda: chibi('panda'),
  bunny: chibi('bunny'),
  penguin: chibi('penguin'),
  frog: chibi('frog'),
  chiikawa: chibi('chiikawa'),
  grasscow: chibi('grasscow'),
  milkdragon: chibi('milkdragon'),
  capybara: chibi('capybara'),
  loopy: chibi('loopy'),
  bubu: chibi('bubu'),
};

export function isIndependentSpecies(skin: ResolvedSkin | null): skin is ResolvedSkin {
  return Boolean(skin && resolveSpecies(skin.species) !== 'cat');
}

export function renderSpecies2d(ctx: CanvasRenderingContext2D, o: SpeciesRenderOptions): void {
  const { skin, w, h, time, breath, blink, sleep, squint, mood, moodAmt } = o;
  // Typing arrives as an intensity; turn it into alternating, eased taps so
  // the paws keep moving instead of freezing in a pressed pose.
  const typing = Math.max(0, Math.min(1, o.typing ?? 0)) * (1 - sleep * 0.85);
  const tapPhase = time * (9.2 + typing * 4.5);
  const tapLeft = typing * Math.max(0, Math.sin(tapPhase));
  const tapRight = typing * Math.max(0, -Math.sin(tapPhase));

  // 手伸缩：预览 / 截图可用 handReach 固定关键帧；正式运行走时间状态机。
  let reach: number;
  if (o.handReach !== undefined) {
    reach = Math.max(0, Math.min(1, o.handReach));
  } else {
    if (!chibiTimeInit) { chibiTimeInit = true; chibiPrevTime = time; }
    const dt = Math.max(0, Math.min(0.05, time - chibiPrevTime));
    chibiPrevTime = time;
    if (typing > 0.01) chibiLastTyping = time;
    const want = time - chibiLastTyping < 0.5 ? 1 : 0;
    const rate = want > chibiReach ? 12 : 4.5;
    chibiReach += (want - chibiReach) * (1 - Math.exp(-rate * dt));
    reach = chibiReach;
  }

  const species = resolveSpecies(skin.species);
  const fur = normHex(skin.furColor);
  const outline = skin.outlineColor ? normHex(skin.outlineColor) : shade(fur, -55);
  const k = Math.min(w / 700, h / 720);
  const baseX = w / 2 - 15 * k;
  const baseY = h * 0.97 - 370 * k;
  const isEating = mood === 'eat' && moodAmt > 0.01;
  const isDrinking = mood === 'drink' && moodAmt > 0.01;
  const hopMood = mood === 'happy' || mood === 'play' || (isEating && (species === 'bunny' || species === 'penguin'));
  const hop = hopMood ? -Math.abs(Math.sin(time * 8.2)) * 26 * moodAmt : 0;
  const lean = mood === 'drink' ? 0.09 * moodAmt : mood === 'bath' ? Math.sin(time * 9) * 0.05 * moodAmt : 0;
  const bob = Math.sin(time * 1.7) * 3.2 * (1 - sleep * 0.7) + breath * 1.6 * (1 - sleep * 0.5);

  // 物种专属吃相：低头幅度 / 咀嚼节拍因动物而异
  const chewHz: Partial<Record<string, number>> = {
    grasscow: 2.6, dog: 5.2, fox: 4.6, panda: 3.0, bunny: 7.5,
    penguin: 5.5, frog: 3.4, milkdragon: 3.2, chiikawa: 5.0,
    capybara: 2.8, loopy: 4.0, bubu: 2.2,
  };
  const chew = (Math.sin(time * (chewHz[species] ?? 3.5) * Math.PI * 2) * 0.5 + 0.5) * moodAmt;

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.965, 175 * k, 19 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(baseX, baseY + bob + hop * k);
  ctx.scale(k, k);
  if (lean) ctx.rotate(lean);
  // 进食时整体低头：牛/狗/熊猫幅度大，直立小动物幅度小
  if (isEating || isDrinking) {
    const dip: Partial<Record<string, number>> = {
      grasscow: 0.075, dog: 0.055, fox: 0.05, panda: 0.045, capybara: 0.04,
      bunny: 0.035, penguin: 0.03, frog: 0.01, milkdragon: 0.03,
      chiikawa: 0.025, loopy: 0.025, bubu: 0.04,
    };
    ctx.rotate((isDrinking ? (dip[species] ?? 0.04) * 1.3 : (dip[species] ?? 0.04) + chew * 0.02) * moodAmt);
    ctx.translate(0, (isDrinking ? 10 : 6) * moodAmt);
  }
  if (sleep > 0.6) ctx.rotate(-0.03 * sleep);
  const P: Palette = {
    ctx,
    cx: 0,
    cy: 0,
    s: skin,
    fur,
    outline,
    blink: Math.max(blink, sleep),
    squint,
    t: time,
    mood,
    moodAmt,
    expression: pickExpression2d(time, mood, moodAmt, sleep),
    tapLeft,
    tapRight,
    reach,
    eye: (x, y, rx, ry, color) => drawEye(P, x, y, rx, ry, color),
  };
  (RENDERERS[species] || drawCat)(P);

  // 进食 / 喝水时，在脚边出现食物碗或水碗 + 咀嚼气泡。
  // 画在地面固定位置，避免依赖各物种不同的嘴部局部坐标。
  if ((isEating || isDrinking) && moodAmt > 0.01) {
    const bowlY = 300;
    ctx.save();
    ctx.globalAlpha = Math.min(1, moodAmt * 1.4);
    // 碗
    ctx.fillStyle = isDrinking ? '#7fc4e8' : '#e8a866';
    ctx.beginPath();
    ctx.ellipse(0, bowlY, 58, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isDrinking ? '#5aa9d6' : '#cf8a4a';
    ctx.beginPath();
    ctx.ellipse(0, bowlY + 5, 52, 13, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#5b4a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, bowlY, 58, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 咀嚼 / 喝水气泡
    const bubbles = isDrinking ? 2 : 3;
    for (let i = 0; i < bubbles; i++) {
      const ph = (time * 1.8 + i * 0.37) % 1;
      const bx = (i - (bubbles - 1) / 2) * 22 + Math.sin(time * 3 + i) * 6;
      const by = bowlY - 30 - ph * 45;
      ctx.globalAlpha = Math.min(1, moodAmt) * (1 - ph) * 0.8;
      ctx.fillStyle = isDrinking ? '#bfe8ff' : '#fff3d6';
      ctx.beginPath();
      ctx.arc(bx, by, isDrinking ? 6 + ph * 3 : 5 + ph * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Standalone preview entry used by the animal studio and screenshot checks. */
export function renderSpeciesPreview2d(ctx: CanvasRenderingContext2D, raw: CatSkinConfig, w: number, h: number): void {
  renderSpecies2d(ctx, {
    skin: resolveCustomSkin(raw),
    w,
    h,
    time: 0,
    breath: 0,
    blink: 0,
    sleep: 0,
    squint: 0,
    mood: 'idle',
    moodAmt: 0,
    typing: 0,
  });
}
