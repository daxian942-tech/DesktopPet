import * as THREE from 'three';
import { resolveSpecies, type AnimalSpecies, type CatSkinConfig } from './catSkins';
import { blenderGeometry, type BlenderPart } from './blenderMeshes';

type Vec3 = readonly [number, number, number];
type NonCatSpecies = Exclude<AnimalSpecies, 'cat'>;

interface Palette {
  fur: THREE.Color;
  secondary: THREE.Color;
  belly: THREE.Color;
  ear: THREE.Color;
  innerEar: THREE.Color;
  paw: THREE.Color;
  nose: THREE.Color;
  eye: THREE.Color;
  pupil: THREE.Color;
  mouth: THREE.Color;
  blush: THREE.Color;
  accent: THREE.Color;
  cream: THREE.Color;
  catchlight: boolean;
}

interface PartRef {
  node: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

interface EarRef extends PartRef {
  side: -1 | 1;
}

interface LimbRef extends PartRef {
  side: -1 | 1;
  front: boolean;
  phase: number;
  soft?: SoftLimbRef;
  /** 真正用来敲键盘的"手"。打字动画优先驱动 arm，没有 arm 的物种才退回前腿。 */
  arm?: boolean;
  /** 手掌节点：打字时沿手臂方向把掌压向键帽，而不是整臂乱转导致脱键。 */
  paw?: THREE.Object3D;
  pawBaseY?: number;
}

/** The same motion inputs the generic animation loop receives. */
interface MotionState {
  sleep: number;
  excited: number;
  petting: boolean;
  typingLeft: boolean;
  typingRight: boolean;
  mood: string;
  moodAmt: number;
}

type MotionFn = (time: number, state: MotionState) => void;

/** Face overlays swapped in on top of a species' baseline eyes. */
type FaceExpression = 'idle' | 'happy' | 'love' | 'surprised' | 'angry' | 'worried';

interface ExpressionSet {
  root: THREE.Group;
  faces: THREE.Group[];
}

interface SoftLimbOptions {
  upper: number;
  lower: number;
  radius: number;
  fur: THREE.Material;
  pawMat: THREE.Material;
  /** 对比色掌垫：手和身体同色时靠它把手读出来 */
  pad?: THREE.Material;
  hang?: number;
  bend?: number;
  wristBend?: number;
  /** 手臂前后倾角：负值往前伸（朝键盘），0 是垂直下垂 */
  tiltX?: number;
  pawScale?: Vec3;
  claws?: { color: THREE.Color; count: number; spread: number; size: number; depth: number };
}

interface SoftLimbRef {
  root: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  side: -1 | 1;
  front: boolean;
}

const WHITE = new THREE.Color('#ffffff');
const BLACK = new THREE.Color('#111318');

// The quadrupeds are modelled along their own forward axis. A fixed 3/4 yaw
// exposes the long horizontal torso and all four legs instead of collapsing
// them into a front-facing, cat-like silhouette.
const QUADRUPED_YAW: Partial<Record<NonCatSpecies, number>> = {
  // 偏航收小：桌宠是面对键盘的，之前 0.7~0.8（约 45°）会把新加的小手转到侧面，
  // 正对镜头时两只手都看不见。保留一点点侧身，只为了让肚子和尾巴有立体感。
  dog: 0.26,
  fox: 0.24,
  panda: 0.20,
  // 兔子已改为正面坐墩造型，不再需要 3/4 偏航
  // The reference is a front-facing shocked face, not a side profile.
  grasscow: 0.10,
  // Lulu's huge orange muzzle is the whole character - keep it facing forward.
  capybara: 0.18,
};

/**
 * 扁平卡通渲染基准（对标 BongoCat / Shimeji 那类桌宠：纯色块 + 深色轮廓线，
 * 没有 PBR 高光、没有塑料渐变）。数值来自 keyboard3d.ts 实测：
 *   boardGroup.y 0.015 + boardH 0.112 + capH 0.056 = 0.183 世界高度
 * species root 由 syncFrom 同步 catRoot，scale 恒为 0.9。
 */
const KEYCAP_TOP_WORLD_Y = 0.183;
const SPECIES_ROOT_SCALE = 0.9;
/** 手掌落点（model 局部坐标）：落在键帽阵列中部，左右对称 */
const PALM_TARGET_Z = 1.22;
const PALM_TARGET_X = 0.34;
/**
 * 正面坐姿 / 趴姿类物种的「肩膀」高度：统一补的打字手从这里起算。
 * 太低会从肚子下方伸出来、看着像多两条腿；抬到肩线才读得懂是手臂。
 */
const TYPING_HAND_SHOULDER_Y: Partial<Record<NonCatSpecies, number>> = {
  bunny: 0.84,
  penguin: 1.02,
  frog: 0.54,
  chiikawa: 0.78,
  milkdragon: 0.80,
  loopy: 0.82,
  bubu: 0.82,
};
/** 轮廓线：只给构成剪影的大件加，避免小零件被黑圈糊住、也控制 draw call */
const OUTLINE_MIN_SIZE = 0.30;
const OUTLINE_WIDTH = 0.024;
const OUTLINE_COLOR = '#332a30';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Smooth 0 -> 1 -> 0 envelope. A plain sine has non-zero velocity at both
 * ends, which makes a limb snap into the gesture; smoothstep rests at zero
 * speed on both ends so the motion eases in and out.
 */
function beatMotion(time: number, period: number, start: number, end: number): number {
  const c = ((time % period) + period) % period;
  if (c <= start || c >= end) return 0;
  const x = (c - start) / (end - start);
  // sin^2(PI*x) peaks at 1 like the old sine, but its derivative is zero at
  // both ends, so the gesture eases in/out instead of snapping.
  const s = Math.sin(Math.PI * x);
  return s * s;
}

/** Same envelope delayed by `lag` seconds, so joints follow the shoulder. */
function followBeat(time: number, period: number, start: number, end: number, lag: number): number {
  return beatMotion(time - lag, period, start, end);
}

function tint(color: THREE.Color, amount: number): THREE.Color {
  return color.clone().lerp(amount >= 0 ? WHITE : BLACK, Math.abs(amount));
}

export class IndependentSpecies3D {
  readonly root = new THREE.Group();

  private model: THREE.Group | null = null;
  private currentSpecies: AnimalSpecies = 'cat';
  private skinKey = '';
  private palette: Palette | null = null;
  /** 赛璐璐材质：按颜色缓存，全物种共用，换皮肤时统一释放 */
  private readonly materials = new Map<string, THREE.MeshToonMaterial>();
  /** 几何按参数缓存并标记 shared，避免每只动物重复上传同一份顶点数据 */
  private readonly geoCache = new Map<string, THREE.BufferGeometry>();
  private readonly gradientMap: THREE.DataTexture;
  private outlineMat: THREE.MeshBasicMaterial | null = null;
  private groundMat: THREE.MeshBasicMaterial | null = null;
  /** 本只动物是否已经建了伸向键盘的打字手（没有的统一补一对） */
  private hasTypingHands = false;

  private body: PartRef | null = null;
  private head: PartRef | null = null;
  private tail: PartRef | null = null;
  private readonly ears: EarRef[] = [];
  private readonly eyes: PartRef[] = [];
  /** 瞳孔网格引用：用来做呼吸般的缩放，让眼睛一直是"活"的 */
  private readonly pupils: Array<{ node: THREE.Mesh; base: THREE.Vector3; phase: number }> = [];
  private readonly limbs: LimbRef[] = [];
  private readonly customMotions: MotionFn[] = [];
  private readonly expressionGroups = new Map<FaceExpression, ExpressionSet>();
  private readonly expressionEyes: THREE.Object3D[] = [];
  private activeExpression: FaceExpression = 'idle';
  private readonly typingPress: Record<'left' | 'right', number> = { left: 0, right: 0 };
  private readonly typingPhase: Record<'left' | 'right', number> = { left: 0, right: 0 };
  private lastUpdateTime = 0;

  constructor(scene: THREE.Scene) {
    this.root.name = 'independent-species-root';
    this.root.scale.setScalar(0.9);
    scene.add(this.root);

    // 三阶赛璐璐明暗：亮面 / 中间调 / 暗面。NearestFilter 才有干净的色块边界，
    // 这正是扁平插画感的来源，也省掉了 PBR 的逐像素高光计算。
    // 亮面为主、暗面只轻轻压一点：白色 / 浅色动物才不会被压成灰团子，
    // 更接近 BongoCat 那种「纯色填充 + 黑线」的干净插画。
    const steps = new Uint8Array([168, 214, 255]);
    this.gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    this.gradientMap.minFilter = THREE.NearestFilter;
    this.gradientMap.magFilter = THREE.NearestFilter;
    this.gradientMap.generateMipmaps = false;
    this.gradientMap.needsUpdate = true;

    // 灯光只负责提供明暗方向，不再靠强度堆出体积感（否则 toon 会全糊成最亮阶）
    const sky = new THREE.HemisphereLight('#fff6ec', '#6d6070', 0.78);
    sky.name = 'independent-species-fill';
    scene.add(sky);

    const key = new THREE.DirectionalLight('#ffffff', 0.92);
    key.name = 'independent-species-key';
    key.position.set(-3.2, 5.4, 4.6);
    scene.add(key);
  }

  get species(): AnimalSpecies {
    return this.currentSpecies;
  }

  setSkin(skin: CatSkinConfig): void {
    const species = resolveSpecies(skin.species);
    const key = JSON.stringify(skin);
    if (key === this.skinKey && species === this.currentSpecies) {
      this.root.visible = species !== 'cat';
      return;
    }

    this.skinKey = key;
    this.currentSpecies = species;
    this.root.visible = species !== 'cat';
    this.clearModel();
    if (species === 'cat') return;

    this.palette = this.createPalette(skin);
    this.model = new THREE.Group();
    this.model.name = `independent-${species}`;
    this.model.rotation.y = QUADRUPED_YAW[species] ?? 0;
    this.root.add(this.model);

    // 扁平贴纸式接地阴影（不是 3D 阴影贴图）：让 Q 版团子稳稳落在桌面上，
    // 也把「角色 + 键盘」在视觉上连成一个场景。
    const ground = new THREE.Mesh(
      this.cachedGeometry('ground', () => new THREE.CircleGeometry(1, 28)),
      this.getGroundMat(),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(0.70, 0.40, 1);
    ground.position.set(0, 0.005, 0.20);
    ground.renderOrder = -2;
    this.model.add(ground);

    this.buildSpecies(species);
    this.buildExpressions();
  }

  syncFrom(source: THREE.Group): void {
    this.root.position.copy(source.position);
    this.root.quaternion.copy(source.quaternion);
    this.root.scale.copy(source.scale);
  }

  update(
    time: number,
    options: {
      sleep: number;
      excited: number;
      petting: boolean;
      typingLeft: boolean;
      typingRight: boolean;
      mood: string;
      moodAmt: number;
    },
  ): void {
    if (!this.model || this.currentSpecies === 'cat') return;

    // The engine clamps its own frame delta; use the same ceiling here so a
    // time jump (e.g. a screenshot preset) never snaps a limb in one frame.
    const dt = this.lastUpdateTime === 0
      ? 1 / 60
      : Math.min(0.05, Math.max(0.001, time - this.lastUpdateTime));
    this.lastUpdateTime = time;

    const sleep = clamp01(options.sleep);
    const excited = clamp01(options.excited);
    const awake = 1 - sleep;
    const breath = Math.sin(time * (1.65 + excited * 1.25));
    const cycle = ((time % 4.8) + 4.8) % 4.8;
    const blinkPulse = cycle > 4.52 ? Math.sin(((cycle - 4.52) / 0.28) * Math.PI) : 0;
    const blink = Math.max(sleep, blinkPulse, options.petting ? 0.62 : 0);

    // Swap faces before the eye loop so the baseline eyes can be hidden when
    // an overlay is showing.
    this.applyExpression(this.pickExpression(time, options));
    const exprSet = this.expressionGroups.get(this.activeExpression) ?? null;
    const exprBlink = exprSet ? blink * 0.45 : blink;

    this.model.position.x = 0; // species motions add their own absolute-per-frame drift
    this.model.position.y = Math.abs(Math.sin(time * 5.4)) * 0.035 * excited * awake;
    this.model.rotation.z = Math.sin(time * 4.1) * 0.012 * excited * awake;

    if (this.body) {
      const { node, position, rotation, scale } = this.body;
      node.position.copy(position);
      node.position.y += breath * 0.008 * awake;
      node.rotation.copy(rotation);
      node.scale.set(
        scale.x * (1 + breath * 0.008 * awake),
        scale.y * (1 + breath * 0.018 * awake),
        scale.z * (1 + breath * 0.010 * awake),
      );
    }

    if (this.head) {
      const { node, position, rotation, scale } = this.head;
      node.position.copy(position);
      node.position.y += breath * 0.012 * awake - sleep * 0.045;
      node.rotation.copy(rotation);
      node.rotation.x += sleep * 0.16 + Math.sin(time * 1.1) * 0.018 * awake;
      node.rotation.y += Math.sin(time * 0.72) * 0.025 * awake;
      node.rotation.z += (options.petting ? Math.sin(time * 3.2) * 0.045 : 0) + sleep * 0.025;
      node.scale.copy(scale);
    }

    for (const eye of this.eyes) {
      eye.node.position.copy(eye.position);
      eye.node.rotation.copy(eye.rotation);
      // 视线游走：左右缓慢扫视 + 轻微上下，眼睛不会死盯一个点
      eye.node.rotation.y += Math.sin(time * 0.55 + eye.position.x * 3.1) * 0.055 * awake;
      eye.node.rotation.x += Math.sin(time * 0.83 + eye.position.x * 2.2) * 0.030 * awake;
      eye.node.scale.set(eye.scale.x, eye.scale.y * Math.max(0.07, 1 - exprBlink * 0.94), eye.scale.z);
      // Only the two eyes an overlay is drawn on get hidden; extra eyes
      // (some species have more than two) keep their normal behaviour.
      eye.node.visible = !(exprSet && this.expressionEyes.includes(eye.node));
    }
    // 瞳孔：呼吸般轻微缩放 + 兴奋 / 被摸时放大，眼神一直是"活"的
    if (this.pupils.length) {
      const glow = 1 + excited * 0.15 + (options.petting ? 0.07 : 0);
      for (const pupil of this.pupils) {
        const s = (1 + Math.sin(time * 1.7 + pupil.phase) * 0.05 * awake) * glow;
        pupil.node.scale.set(pupil.base.x * s, pupil.base.y * s, pupil.base.z);
      }
    }
    if (exprSet) {
      const squash = Math.max(0.08, 1 - exprBlink * 0.92);
      for (const face of exprSet.faces) face.scale.y = squash;
    }

    for (const ear of this.ears) {
      ear.node.position.copy(ear.position);
      ear.node.rotation.copy(ear.rotation);
      ear.node.rotation.x += sleep * 0.12;
      ear.node.rotation.z += ear.side * (
        Math.sin(time * 1.9 + ear.side) * 0.025 * awake
        + Math.sin(time * 7.2) * 0.055 * excited
        + (options.petting ? 0.10 : 0)
      );
      ear.node.scale.copy(ear.scale);
    }

    if (this.tail) {
      const { node, position, rotation, scale } = this.tail;
      node.position.copy(position);
      node.rotation.copy(rotation);
      const wag = Math.sin(time * (2.0 + excited * 5.2));
      node.rotation.y += wag * (0.055 + excited * 0.16) * awake;
      node.rotation.z += Math.sin(time * 1.35) * 0.035 * awake - sleep * 0.08;
      node.scale.copy(scale);
    }

    // Key presses arrive as booleans. Ease them with a fast attack and a
    // slower release, then add a small oscillation while held, so the paws
    // tap instead of snapping to a fixed pose and freezing there.
    const easePress = (target: boolean, current: number): number => {
      const rate = target ? 17 : 9;
      return current + ((target ? 1 : 0) - current) * (1 - Math.exp(-rate * dt));
    };
    this.typingPress.left = easePress(options.typingLeft, this.typingPress.left);
    this.typingPress.right = easePress(options.typingRight, this.typingPress.right);
    if (options.typingLeft) this.typingPhase.left += dt * 10.5;
    if (options.typingRight) this.typingPhase.right += dt * 10.5;
    const tapLeft = this.typingPress.left * (0.88 + 0.12 * Math.sin(this.typingPhase.left));
    const tapRight = this.typingPress.right * (0.88 + 0.12 * Math.sin(this.typingPhase.right));

    for (const limb of this.limbs) {
      limb.node.position.copy(limb.position);
      limb.node.rotation.copy(limb.rotation);
      limb.node.scale.copy(limb.scale);
      limb.node.rotation.x += Math.sin(time * 1.45 + limb.phase) * 0.018 * awake;
      if (options.petting && limb.front) limb.node.rotation.z += limb.side * 0.025;
      // 手掌每帧回到基准位，打字位移才不会累积
      if (limb.paw && limb.pawBaseY !== undefined) {
        limb.paw.position.y = limb.pawBaseY;
        limb.paw.scale.set(1, 1, 1);
      }
    }

    for (const motion of this.customMotions) motion(time, options);

    // 物种专属的进食 / 喝水动作：在各自常驻动作之上叠加，
    // 让牛低头嚼草、狗大口啃、兔子快速啄食……每台动物都不一样。
    this.applyCareGesture(time, options.mood, options.moodAmt, awake);

    // 打字只驱动「打字手」：贴身的装饰小手 / 鳍 / 蹼已经降级为静态，
    // 不再跟着一起乱动。手精确按在键帽上，整臂只留一点蓄力回旋
    // （旧版整臂旋转 + 整体下移会让掌飞离或穿进键盘），
    // 真正的按键行程由掌沿手臂方向压下去 + 轻微压扁完成。
    for (const limb of this.limbs) {
      if (!limb.arm) continue;
      const isLeft = limb.side < 0;
      const tap = (isLeft ? tapLeft : tapRight) * awake;
      if (tap < 0.002) continue;
      const phase = isLeft ? this.typingPhase.left : this.typingPhase.right;
      limb.node.rotation.x += 0.075 * tap;
      limb.node.rotation.z += limb.side * 0.022 * tap;
      if (limb.paw && limb.pawBaseY !== undefined) {
        const press = 0.044 * tap * (0.82 + 0.18 * Math.sin(phase + 0.4));
        limb.paw.position.y = limb.pawBaseY - press;
        limb.paw.scale.set(1 + 0.07 * tap, 1 - 0.14 * tap, 1 + 0.05 * tap);
      }
    }

    // 打字协调：手敲击时身体轻微前倾 + 起伏、头跟着点，整体节奏连成一体
    const typingAmt = Math.max(this.typingPress.left, this.typingPress.right) * awake;
    if (typingAmt > 0.01) {
      const beat = (Math.sin(this.typingPhase.left) + Math.sin(this.typingPhase.right)) * 0.25 + 0.5;
      if (this.body) {
        this.body.node.position.z += 0.016 * typingAmt;
        this.body.node.position.y -= 0.007 * typingAmt * beat;
      }
      if (this.head) {
        this.head.node.rotation.x += 0.022 * typingAmt * beat;
        this.head.node.position.y -= 0.005 * typingAmt * beat;
      }
    }
  }

  private createPalette(skin: CatSkinConfig): Palette {
    const fur = new THREE.Color(skin.furColor || '#f4ece6');
    const secondary = new THREE.Color(skin.furSecondaryColor || skin.earOuterColor || skin.armColor || fur);
    return {
      fur,
      secondary,
      belly: new THREE.Color(skin.bellyBibColor || skin.muzzleColor || tint(fur, 0.28)),
      ear: new THREE.Color(skin.earOuterColor || fur),
      innerEar: new THREE.Color(skin.earInnerColor || tint(fur, 0.25)),
      paw: new THREE.Color(skin.pawColor || skin.armColor || fur),
      nose: new THREE.Color(skin.noseColor || tint(fur, -0.55)),
      eye: new THREE.Color(skin.eyeColorTop || '#302820'),
      pupil: new THREE.Color(skin.pupilColor || '#151419'),
      mouth: new THREE.Color(skin.mouthColor || tint(fur, -0.60)),
      blush: new THREE.Color(skin.blushColor || '#f2a0ad'),
      accent: new THREE.Color(skin.accentColor || tint(fur, 0.20)),
      cream: new THREE.Color(skin.tailTipColor || skin.bellyBibColor || '#f6e8d2'),
      catchlight: skin.eyeCatchlight !== false,
    };
  }

  /**
   * 扁平赛璐璐材质。`roughness` 不再表示镜面粗糙度（toon 没有高光），而是
   * 借用来给眼睛 / 掌垫这类小件一点明度区分，保持原有调用点的语义不破。
   */
  private material(color: THREE.Color, roughness = 0.78): THREE.MeshToonMaterial {
    const key = `${color.getHexString()}:${roughness.toFixed(2)}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const shade = 0.90 + Math.min(1, Math.max(0, roughness)) * 0.10;
    const mat = new THREE.MeshToonMaterial({
      color: color.clone().multiplyScalar(shade),
      gradientMap: this.gradientMap,
    });
    this.materials.set(key, mat);
    return mat;
  }

  /** 共享几何：同一细分参数的球 / 胶囊只创建一次，并标记为 shared 防止被 dispose */
  private cachedGeometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.geoCache.get(key);
    if (!geometry) {
      geometry = make();
      geometry.userData.shared = true;
      this.geoCache.set(key, geometry);
    }
    return geometry;
  }

  /** 深色轮廓材质：inverted-hull 只渲染背面，被自身正面挡住后只剩外圈一条线 */
  private getOutlineMat(): THREE.MeshBasicMaterial {
    if (!this.outlineMat) {
      this.outlineMat = new THREE.MeshBasicMaterial({
        color: OUTLINE_COLOR,
        side: THREE.BackSide,
      });
      this.outlineMat.userData.shared = true;
    }
    return this.outlineMat;
  }

  /** 贴纸式接地阴影：一块淡色椭圆，替代 3D 阴影贴图，解决团子悬浮感 */
  private getGroundMat(): THREE.MeshBasicMaterial {
    if (!this.groundMat) {
      this.groundMat = new THREE.MeshBasicMaterial({
        color: '#4c4048',
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.groundMat.userData.shared = true;
    }
    return this.groundMat;
  }

  /**
   * 给构成剪影的大件加一圈深色轮廓线。小零件（眼睛、腮红、掌垫）不加，
   * 否则会出现一堆黑圈、把表情糊掉，也让 draw call 白白翻倍。
   */
  private addOutline(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    position: Vec3,
    scale: Vec3,
    rotation: Vec3,
  ): void {
    const size = Math.max(Math.abs(scale[0]), Math.abs(scale[1]), Math.abs(scale[2]));
    if (size < OUTLINE_MIN_SIZE) return;
    const outline = new THREE.Mesh(geometry, this.getOutlineMat());
    outline.position.set(...position);
    outline.rotation.set(...rotation);
    outline.scale.set(
      scale[0] + OUTLINE_WIDTH,
      scale[1] + OUTLINE_WIDTH,
      scale[2] + OUTLINE_WIDTH,
    );
    outline.renderOrder = -1;
    parent.add(outline);
  }

  private group(parent: THREE.Object3D, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0]): THREE.Group {
    const group = new THREE.Group();
    group.position.set(...position);
    group.rotation.set(...rotation);
    parent.add(group);
    return group;
  }

  private mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    position: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    // 桌宠窗口没有开 shadowMap，这两个标记本来就不产生效果，去掉减少无谓开销
    parent.add(mesh);
    return mesh;
  }

  private sphere(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    scale: Vec3,
    rotation: Vec3 = [0, 0, 0],
    detail = 24,
  ): THREE.Mesh {
    // 扁平赛璐璐不需要 1280 三角的均匀球：低面数 + 色块明暗反而更像插画。
    // 几何按细分参数缓存共享，12 只动物不再各自重复上传顶点数据。
    const seg = Math.max(8, Math.round(detail * 0.62));
    const rings = Math.max(6, Math.round(seg * 0.68));
    const geometry = this.cachedGeometry(
      `sphere:${seg}:${rings}`,
      () => new THREE.SphereGeometry(1, seg, rings),
    );
    const mesh = this.mesh(parent, geometry, mat, position, scale, rotation);
    this.addOutline(parent, geometry, position, scale, rotation);
    return mesh;
  }

  /**
   * Blender-authored organic limb. The prototype spans y in [-0.5, 0.5] with
   * its widest radius (0.5) at the +Y root, so scaling by [2r, len, 2r]
   * produces a limb of root radius r and length len. Because the surface is a
   * single metaball-fused mesh that tapers from a broad buried root to a soft
   * wrist, there is no elbow ball or seam where it meets the torso.
   */
  private organicLimb(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    length: number,
    radius: number,
    depthScale = 1,
    rotation: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    return this.mesh(
      parent,
      blenderGeometry('limb'),
      mat,
      position,
      [radius * 2, length, radius * 2 * depthScale],
      rotation,
    );
  }

  /**
   * Drop a Blender-authored character prototype straight into the scene.
   * Prototypes keep their own local geometry (unit-fit or raw depending on the
   * part), so `scale` is in the prototype's native units rather than the
   * radius-1 convention of sphere().
   */
  private proto(
    parent: THREE.Object3D,
    name: BlenderPart,
    mat: THREE.Material,
    position: Vec3,
    scale: Vec3,
    rotation: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    return this.mesh(parent, blenderGeometry(name), mat, position, scale, rotation);
  }

  private box(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    scale: Vec3,
    rotation: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    return this.mesh(
      parent,
      this.cachedGeometry('box', () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1)),
      mat, position, scale, rotation,
    );
  }

  private capsule(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    radius: number,
    length: number,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    const shaft = Math.max(0.01, length - radius * 2);
    const geometry = this.cachedGeometry(
      `capsule:${radius.toFixed(3)}:${shaft.toFixed(3)}`,
      () => new THREE.CapsuleGeometry(radius, shaft, 4, 10),
    );
    return this.mesh(parent, geometry, mat, position, scale, rotation);
  }

  private cone(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    radius: number,
    height: number,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
    sides = 20,
  ): THREE.Mesh {
    const sidesLow = Math.max(8, Math.min(12, sides));
    const geometry = this.cachedGeometry(
      `cone:${radius.toFixed(3)}:${height.toFixed(3)}:${sidesLow}`,
      () => new THREE.ConeGeometry(radius, height, sidesLow),
    );
    return this.mesh(parent, geometry, mat, position, scale, rotation);
  }

  private tube(
    parent: THREE.Object3D,
    mat: THREE.Material,
    points: Vec3[],
    radius: number,
    position: Vec3 = [0, 0, 0],
  ): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const key = `tube:${radius.toFixed(3)}:${points.map((p) => p.map((v) => v.toFixed(2)).join(',')).join('|')}`;
    const geometry = this.cachedGeometry(key, () => new THREE.TubeGeometry(curve, 12, radius, 6, false));
    return this.mesh(parent, geometry, mat, position);
  }

  private track(node: THREE.Object3D): PartRef {
    return {
      node,
      position: node.position.clone(),
      rotation: node.rotation.clone(),
      scale: node.scale.clone(),
    };
  }

  private trackBody(node: THREE.Object3D): void {
    this.body = this.track(node);
  }

  private trackHead(node: THREE.Object3D): void {
    this.head = this.track(node);
  }

  private trackTail(node: THREE.Object3D): void {
    this.tail = this.track(node);
  }

  private trackEar(node: THREE.Object3D, side: -1 | 1): void {
    this.ears.push({ ...this.track(node), side });
  }

  private trackLimb(
    node: THREE.Object3D,
    side: -1 | 1,
    front: boolean,
    phase: number,
    soft?: SoftLimbRef,
    arm?: boolean,
    paw?: THREE.Object3D,
  ): void {
    this.limbs.push({
      ...this.track(node), side, front, phase, soft, arm, paw,
      pawBaseY: paw ? paw.position.y : undefined,
    });
  }

  private eye(
    parent: THREE.Object3D,
    position: Vec3,
    radius: number,
    options: {
      iris?: THREE.Color;
      pupil?: THREE.Color;
      aspect?: number;
      tilt?: number;
      glint?: boolean;
      /** 眼型：round 圆眼 / dot 豆豆眼 / sparkle 星星眼 */
      style?: 'round' | 'dot' | 'sparkle';
      /** 瞳孔：round 圆瞳 / vertical 竖瞳 / horizontal 横瞳 */
      pupilShape?: 'round' | 'vertical' | 'horizontal';
      /** 加一圈眼白，眼球更像嵌在眼眶里 */
      sclera?: boolean;
      /** 眼球凸出程度（z 相对半径），越小越贴脸。白眼球物种要压扁，否则像爆眼 */
      depth?: number;
      /** 瞳孔相对半径的比例，越大瞳孔越圆润 */
      pupilScale?: number;
    } = {},
  ): THREE.Group {
    const p = this.palette!;
    const eye = this.group(parent, position, [0, 0, options.tilt || 0]);
    const aspect = options.aspect ?? 1;
    const style = options.style ?? 'round';
    const irisMat = this.material(options.iris || p.eye, 0.30);
    const pupilMat = this.material(options.pupil || p.pupil, 0.20);
    const phase = position[0] < 0 ? 0 : 1.7;

    // 1) 眼白：比虹膜略大的扁椭球垫在后面，像真正嵌在眼眶里的眼珠
    if (options.sclera) {
      this.sphere(
        eye,
        this.material(WHITE, 0.40),
        [0, 0, -radius * 0.10],
        [radius * 1.18, radius * aspect * 1.18, radius * 0.26],
        [0, 0, 0],
        20,
      );
    }

    // 2) 虹膜：加厚成凸起的眼球，不再是贴在脸上的扁片
    const depth = options.depth ?? (style === 'dot' ? 0.44 : 0.58);
    this.sphere(eye, irisMat, [0, 0, radius * 0.08], [radius, radius * aspect, radius * depth], [0, 0, 0], 24);

    // 3) 瞳孔（豆豆眼整颗就是黑豆，不再叠瞳孔）
    const pupilZ = radius * (depth * 0.60 + 0.05);
    let pupilMesh: THREE.Mesh | null = null;
    if (style !== 'dot') {
      if (options.pupilShape === 'vertical') {
        pupilMesh = this.sphere(eye, pupilMat, [0, 0, pupilZ], [radius * 0.24, radius * aspect * 0.76, radius * 0.18], [0, 0, 0], 18);
      } else if (options.pupilShape === 'horizontal') {
        pupilMesh = this.sphere(eye, pupilMat, [0, 0, pupilZ], [radius * 0.76, radius * aspect * 0.28, radius * 0.18], [0, 0, 0], 18);
      } else {
        const ps = options.pupilScale ?? (style === 'sparkle' ? 0.56 : 0.52);
        pupilMesh = this.sphere(eye, pupilMat, [0, 0, pupilZ], [radius * ps, radius * aspect * ps * 1.12, radius * 0.20], [0, 0, 0], 18);
      }
      this.pupils.push({ node: pupilMesh, base: pupilMesh.scale.clone(), phase });
    }

    // 4) 高光：主光 + 次光（星星眼再加四向小星芒）
    if (options.glint ?? p.catchlight) {
      const gz = radius * (depth * 0.86 + 0.10);
      this.sphere(eye, this.material(WHITE, 0.14), [-radius * 0.30, radius * aspect * 0.30, gz], [radius * 0.27, radius * 0.27, radius * 0.13], [0, 0, 0], 14);
      this.sphere(eye, this.material(WHITE, 0.16), [radius * 0.32, -radius * aspect * 0.28, gz], [radius * 0.13, radius * 0.13, radius * 0.08], [0, 0, 0], 12);
      if (style === 'sparkle') {
        for (const [dx, dy, sx, sy] of [
          [-1, 0, 0.078, 0.030],
          [1, 0, 0.078, 0.030],
          [0, 1, 0.030, 0.095],
          [0, -1, 0.030, 0.095],
        ] as Array<[number, number, number, number]>) {
          this.sphere(eye, this.material(WHITE, 0.16), [dx * radius * 0.56, dy * radius * aspect * 0.62, gz * 0.97], [radius * sx, radius * sy, radius * 0.03], [0, 0, 0], 8);
        }
      }
    }
    this.eyes.push(this.track(eye));
    return eye;
  }

  private smile(parent: THREE.Object3D, position: Vec3, width: number, mat: THREE.Material): void {
    this.tube(parent, mat, [
      [-width, 0.018, 0],
      [-width * 0.48, -0.025, 0],
      [0, -0.038, 0],
      [width * 0.48, -0.025, 0],
      [width, 0.018, 0],
    ], 0.012, position);
  }

  private blush(parent: THREE.Object3D, x: number, y: number, z: number, size = 0.10): void {
    for (const side of [-1, 1] as const) {
      this.sphere(parent, this.material(this.palette!.blush, 0.88), [side * x, y, z], [size, size * 0.43, size * 0.16], [0, 0, side * 0.10], 16);
    }
  }

  /** A short tapered brow. `tilt` > 0 makes the outer end droop (worried). */
  private brow(parent: THREE.Object3D, position: Vec3, width: number, tilt: number, mat: THREE.Material): THREE.Group {
    const brow = this.group(parent, position);
    this.tube(brow, mat, [
      [-width, tilt * width, 0],
      [0, 0, 0],
      [width, -tilt * width, 0],
    ], 0.026);
    return brow;
  }

  /** Curve with configurable corners: positive = smile, negative = downtrodden. */
  private mouthCurve(parent: THREE.Object3D, position: Vec3, width: number, cornerY: number, mat: THREE.Material, radius = 0.013): void {
    this.tube(parent, mat, [
      [-width, cornerY, 0],
      [-width * 0.52, -0.018, 0],
      [0, -0.036, 0],
      [width * 0.52, -0.018, 0],
      [width, cornerY, 0],
    ], radius, position);
  }

  private roundHorn(parent: THREE.Object3D, position: Vec3, mat: THREE.Material, radius = 0.10, height = 0.28): THREE.Group {
    const horn = this.group(parent, position);
    this.capsule(horn, mat, [0, height * 0.40, 0], radius, height, [1, 1, 0.78]);
    this.sphere(horn, mat, [0, height * 0.88, 0], [radius * 0.92, radius * 0.86, radius * 0.72], [0, 0, 0], 18);
    return horn;
  }

  private teeth(parent: THREE.Object3D, y: number, z: number, width: number, height: number): THREE.Group {
    const teeth = this.group(parent);
    const mat = this.material(new THREE.Color('#fffdf5'), 0.48);
    for (const side of [-1, 1] as const) {
      this.box(teeth, mat, [side * width * 0.53, y, z], [width, height, 0.035]);
    }
    return teeth;
  }

  private motion(fn: MotionFn): void {
    this.customMotions.push(fn);
  }

  /**
   * 物种专属的「进食 / 喝水」动作。
   *
   * 由养成系统的 mood = eat/drink 驱动，moodAmt 是 0..1 的动作包络。
   * 每种动物的吃相都不一样：
   *   牛     低头慢慢嚼草，喝水时头埋下去再仰起
   *   狗/狐   大口啃，头上下轻点
   *   熊猫   抱着啃，慢节奏
   *   兔子   高频快速啄食（三连点）
   *   企鹅   直头啄食，身体微前倾
   *   青蛙   鼓腮吞咽
   *   奶龙   捧着吃、满足地晃
   *   吉伊   胆怯地小口吃
   *   露比   抱着吃、耳朵抖
   *   布布   瘫着嚼、头一点一点
   *
   * 这里只叠加增量旋转/位移，不覆盖各物种自己的常驻动作。
   */
  private applyCareGesture(time: number, mood: string, moodAmt: number, awake: number): void {
    const amt = clamp01(moodAmt) * awake;
    if (amt < 0.01 || (mood !== 'eat' && mood !== 'drink')) return;
    const isDrink = mood === 'drink';
    const sp = this.currentSpecies;

    // 咀嚼 / 啄食节拍：不同物种频率不同
    const chewHz: Partial<Record<AnimalSpecies, number>> = {
      grasscow: 2.6, dog: 5.2, fox: 4.6, panda: 3.0, bunny: 7.5,
      penguin: 5.5, frog: 3.4, milkdragon: 3.2, chiikawa: 5.0,
      capybara: 2.8, loopy: 4.0, bubu: 2.2,
    };
    const hz = chewHz[sp] ?? 3.5;
    const chew = (Math.sin(time * hz * Math.PI * 2) * 0.5 + 0.5) * amt;

    if (this.head) {
      const h = this.head.node;
      switch (sp) {
        case 'grasscow':
          // 牛：吃草低头到草叶位置，喝水更低且仰头吞咽
          h.rotation.x += (isDrink ? 0.30 + chew * 0.10 : 0.22 + chew * 0.07) * amt;
          h.position.y -= (isDrink ? 0.10 : 0.07) * amt;
          h.rotation.z += Math.sin(time * 1.6) * 0.02 * amt;
          break;
        case 'dog':
        case 'fox':
          // 犬科：大口啃，头上下点，喝水时舌头够水
          h.rotation.x += (isDrink ? 0.26 : 0.16 + chew * 0.14) * amt;
          h.position.y -= (isDrink ? 0.08 : 0.03) * amt;
          break;
        case 'panda':
          // 熊猫：抱着慢慢啃，左右轻晃
          h.rotation.x += (0.18 + chew * 0.09) * amt;
          h.rotation.z += Math.sin(time * 1.9) * 0.05 * amt;
          break;
        case 'bunny':
          // 兔子：高频三连啄
          h.rotation.x += (0.20 + chew * 0.22) * amt;
          h.position.y -= 0.02 * amt;
          break;
        case 'penguin':
          // 企鹅：直头啄，身体前倾
          h.rotation.x += (isDrink ? 0.14 : 0.24 + chew * 0.18) * amt;
          break;
        case 'frog':
          // 青蛙：鼓腮吞咽，头微仰
          h.position.y += (isDrink ? 0.03 : 0.015) * amt + chew * 0.02;
          h.rotation.x -= 0.06 * amt;
          break;
        case 'milkdragon':
          // 奶龙：捧着吃，满足地左右晃
          h.rotation.z += Math.sin(time * 2.4) * 0.09 * amt;
          h.rotation.x += (0.10 + chew * 0.06) * amt;
          break;
        case 'chiikawa':
          // 吉伊：胆怯小口，缩着吃
          h.rotation.x += (0.14 + chew * 0.05) * amt;
          h.position.y -= 0.03 * amt;
          break;
        case 'capybara':
          // 水豚：慢悠悠地嚼
          h.rotation.x += (0.16 + chew * 0.08) * amt;
          break;
        case 'loopy':
          // 露比：抱着吃，耳朵会跟着抖
          h.rotation.z += Math.sin(time * 3.0) * 0.05 * amt;
          h.rotation.x += (0.12 + chew * 0.06) * amt;
          break;
        case 'bubu':
          // 布布：瘫着嚼，头一点一点
          h.rotation.x += (0.20 + chew * 0.12) * amt;
          h.rotation.z += 0.10 * amt;
          break;
        default:
          h.rotation.x += (0.14 + chew * 0.08) * amt;
      }
    }

    // 前肢：直立动物把爪子抬到嘴边（捧着吃），四足动物前腿微屈
    const upright = sp === 'milkdragon' || sp === 'chiikawa' || sp === 'loopy'
      || sp === 'bubu' || sp === 'penguin' || sp === 'bunny' || sp === 'cat';
    for (const limb of this.limbs) {
      if (!limb.front) continue;
      if (upright) {
        limb.node.rotation.x -= (isDrink ? 0.55 : 0.42 + chew * 0.10) * amt;
        limb.node.position.y += 0.06 * amt;
      } else {
        limb.node.rotation.x += (isDrink ? 0.14 : 0.08 + chew * 0.05) * amt;
      }
    }

    // 耳朵随咀嚼轻抖（露比 / 兔子 / 吉伊最明显）
    if (sp === 'loopy' || sp === 'bunny' || sp === 'chiikawa') {
      for (const ear of this.ears) {
        ear.node.rotation.z += ear.side * chew * 0.10;
      }
    }

    // 尾巴：吃东西时开心地小摇
    if (this.tail) {
      this.tail.node.rotation.y += Math.sin(time * (3 + hz * 0.4)) * 0.08 * amt;
    }
  }

  /**
   * Build swappable face overlays on top of the species' own eyes. The native
   * eyes stay as the 'idle' face; the other expressions render slightly in
   * front and the native eyes are squashed while one is active.
   */
  private buildExpressions(): void {
    const p = this.palette!;
    const eyeRefs = this.eyes.slice(0, 2);
    if (eyeRefs.length < 2 || !eyeRefs[0].node.parent) return;
    const head = eyeRefs[0].node.parent;
    const ink = this.material(tint(p.eye, -0.12), 0.42);
    const white = this.material(WHITE, 0.28);
    const rose = this.material(new THREE.Color('#e56f7f'), 0.55);
    const tear = this.material(new THREE.Color('#7fc6e8'), 0.35);

    // The eye group itself has unit scale; the actual radius lives on its
    // child meshes. Measure them so the overlays match each species' eyes.
    const measure = (ref: PartRef): [number, number] => {
      let rx = 0;
      let ry = 0;
      ref.node.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        rx = Math.max(rx, Math.abs(object.scale.x));
        ry = Math.max(ry, Math.abs(object.scale.y));
      });
      return [Math.max(0.035, rx), Math.max(0.035, ry)];
    };
    const sizes = eyeRefs.map(measure);
    for (const ref of eyeRefs) this.expressionEyes.push(ref.node);

    for (const kind of ['happy', 'love', 'surprised', 'angry', 'worried'] as FaceExpression[]) {
      const group = this.group(head);
      group.visible = false;
      const faces: THREE.Group[] = [];
      for (const side of [-1, 1] as const) {
        const index = side < 0 ? 0 : 1;
        const ref = eyeRefs[index];
        const [rx, ry] = sizes[index];
        const face = this.group(group, [ref.position.x, ref.position.y, ref.position.z + rx * 0.85]);
        faces.push(face);

        if (kind === 'happy') {
          // upturned closed smile-eye ^ ^
          this.tube(face, ink, [
            [-rx * 0.95, -rx * 0.06, 0],
            [-rx * 0.48, rx * 0.42, 0],
            [0, rx * 0.56, 0],
            [rx * 0.48, rx * 0.42, 0],
            [rx * 0.95, -rx * 0.06, 0],
          ], Math.max(0.012, rx * 0.16));
        } else if (kind === 'love') {
          // two lobes + an inverted cone make a heart
          this.sphere(face, rose, [-rx * 0.36, rx * 0.34, 0], [rx * 0.44, rx * 0.44, 0.045], [0, 0, 0], 16);
          this.sphere(face, rose, [rx * 0.36, rx * 0.34, 0], [rx * 0.44, rx * 0.44, 0.045], [0, 0, 0], 16);
          this.cone(face, rose, [0, -rx * 0.12, 0], rx * 0.86, rx * 1.15, [1, 1, 0.5], [Math.PI, 0, 0], 16);
        } else if (kind === 'surprised') {
          this.sphere(face, ink, [0, 0, 0], [rx * 1.22, ry * 1.32, 0.05], [0, 0, 0], 18);
          this.sphere(face, white, [-rx * 0.32, ry * 0.42, 0.06], [rx * 0.30, ry * 0.30, 0.03], [0, 0, 0], 12);
        } else if (kind === 'angry') {
          this.tube(face, ink, [
            [-rx * 0.85, rx * 0.10, 0], [-rx * 0.42, -rx * 0.22, 0],
            [0, -rx * 0.32, 0], [rx * 0.42, -rx * 0.22, 0], [rx * 0.85, rx * 0.10, 0],
          ], Math.max(0.011, rx * 0.14));
          // slanted brow, inner end low
          this.tube(face, ink, [
            [-rx * 1.05 * side, rx * 1.15, 0],
            [-rx * 0.15 * side, rx * 0.62, 0],
          ], Math.max(0.012, rx * 0.15));
        } else {
          // worried: droopy eye + a small tear
          this.tube(face, ink, [
            [-rx * 0.9, -rx * 0.10, 0], [-rx * 0.45, rx * 0.18, 0],
            [0, rx * 0.24, 0], [rx * 0.45, rx * 0.18, 0], [rx * 0.9, -rx * 0.10, 0],
          ], Math.max(0.011, rx * 0.14));
          this.tube(face, ink, [
            [-rx * 1.0 * side, rx * 0.70, 0],
            [-rx * 0.10 * side, rx * 1.18, 0],
          ], Math.max(0.012, rx * 0.15));
          this.sphere(face, tear, [rx * 0.72 * side, -rx * 0.55, 0.02], [rx * 0.20, rx * 0.30, 0.03], [0, 0, 0], 12);
        }
      }
      this.expressionGroups.set(kind, { root: group, faces });
    }
  }

  /** Pick the face to show from care mood, excitement and a slow idle loop. */
  private pickExpression(time: number, state: MotionState): FaceExpression {
    if (state.sleep > 0.5) return 'idle';
    if (state.petting) return 'love';
    if (state.moodAmt > 0.02 && (
      state.mood === 'happy' || state.mood === 'play' || state.mood === 'eat'
      || state.mood === 'drink' || state.mood === 'bath'
    )) {
      return 'happy';
    }
    if (state.excited > 0.72) return 'surprised';
    // Idle: cycle through soft micro-expressions so the face never looks static.
    const slice = Math.floor(time / 6.5) % 4;
    const within = ((time % 6.5) + 6.5) % 6.5;
    if (within > 4.6) {
      return (['happy', 'love', 'surprised', 'worried'] as FaceExpression[])[slice];
    }
    return 'idle';
  }

  private applyExpression(expr: FaceExpression): void {
    if (expr === this.activeExpression) return;
    this.activeExpression = expr;
    for (const [kind, set] of this.expressionGroups) set.root.visible = kind === expr;
  }

  private leg(
    parent: THREE.Object3D,
    x: number,
    z: number,
    length: number,
    radius: number,
    legMat: THREE.Material,
    pawMat: THREE.Material,
    side: -1 | 1,
    front: boolean,
    pawScale: Vec3 = [radius * 1.35, 0.07, radius * 1.75],
  ): THREE.Group {
    const leg = this.group(parent, [x, length + 0.035, z]);
    this.capsule(leg, legMat, [0, -length * 0.50, 0], radius, length);
    this.sphere(leg, pawMat, [0, -length + 0.035, 0.055], pawScale, [0, 0, 0], 18);
    this.trackLimb(leg, side, front, (front ? 0 : Math.PI) + side * 0.6);
    return leg;
  }

  /** A tapered cylinder: broad at the shoulder/hip, narrow at the joint. */
  private taper(
    parent: THREE.Object3D,
    mat: THREE.Material,
    position: Vec3,
    radiusTop: number,
    radiusBottom: number,
    length: number,
    sides = 16,
  ): THREE.Mesh {
    return this.mesh(
      parent,
      new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides, 1),
      mat,
      position,
    );
  }

  /**
   * Organic limb built from overlapping capsules rather than separate balls
   * and cones. The upper capsule's top is buried inside the torso (via an
   * inward offset + generous overlap), and the forearm capsule overlaps the
   * upper one, so there are no visible joint balls or seams - the limb reads
   * as one soft piece growing out of the body.
   */
  private softLimb(
    parent: THREE.Object3D,
    side: -1 | 1,
    position: Vec3,
    opts: SoftLimbOptions,
    front: boolean,
    phase: number,
  ): SoftLimbRef {
    const r = opts.radius;
    const u = opts.upper;
    const l = opts.lower;
    const lowerR = r * 0.88;

    // Pivot stays at the surface, but all geometry is pulled well inside the
    // torso so the capsule's rounded cap is completely hidden - only the
    // tapering shaft emerges, which reads as a limb growing out of the body.
    const root = this.group(parent, position, [opts.tiltX ?? 0, 0, opts.hang ?? 0]);
    // Only a shallow inward offset now that the Blender limb has its own
    // flared shoulder: the broad root sits on the torso surface as a soft,
    // continuous bulge instead of being a ball joint hidden inside it.
    const inner = this.group(root, [-side * r * 0.55, 0, r * 0.05]);

    // Blender-authored organic limb. Its +Y root flares into a broad shoulder
    // that is buried in the torso, the shaft is a single continuous surface,
    // and the wrist closes off softly - no joint balls, no capsule seam.
    const upperLen = u + r * 1.9;
    this.organicLimb(inner, opts.fur, [0, -u * 0.20 - r * 0.45, 0], upperLen, r, 0.94);

    // Forearm uses the same prototype; its root overlaps the upper limb so the
    // two read as one continuous arm.
    const elbow = this.group(inner, [0, -u * 0.86, 0], [0, 0, opts.bend ?? 0]);
    const lowerLen = l + lowerR * 1.6;
    this.organicLimb(elbow, opts.fur, [0, -l * 0.30, 0], lowerLen, lowerR, 0.90);

    const wrist = this.group(elbow, [0, -l, 0], [0, 0, opts.wristBend ?? 0]);
    const paw = opts.pawScale ?? [r * 1.36, r * 1.02, r * 1.16];
    // Paw sunk into the forearm tip; softly blended, same seam-free idea.
    this.sphere(wrist, opts.pawMat, [0, -paw[1] * 0.20, paw[2] * 0.14], paw, [0, 0, 0], 20);

    // 对比色掌垫：贴在手心朝前的一面
    if (opts.pad) {
      this.sphere(
        wrist,
        opts.pad,
        [0, -paw[1] * 0.10, paw[2] * 0.14 + paw[2] * 0.74],
        [paw[0] * 0.66, paw[1] * 0.58, paw[2] * 0.26],
        [0, 0, 0],
        16,
      );
    }

    if (opts.claws) {
      const c = opts.claws;
      for (let i = 0; i < c.count; i++) {
        const dx = (i - (c.count - 1) / 2) * c.spread;
        this.sphere(
          wrist,
          this.material(c.color, 0.6),
          [dx, -paw[1] * 0.40, paw[2] * 0.14 + c.depth],
          [c.size, c.size * 0.72, c.size * 0.82],
          [0, 0, 0],
          12,
        );
      }
    }

    const ref = { root, elbow, wrist, side, front };
    this.trackLimb(root, side, front, phase, ref, front);
    return ref;
  }

  private buildSpecies(species: NonCatSpecies): void {
    switch (species) {
      case 'dog': this.buildDog(); break;
      case 'fox': this.buildFox(); break;
      case 'panda': this.buildPanda(); break;
      case 'bunny': this.buildBunny(); break;
      case 'penguin': this.buildPenguin(); break;
      case 'frog': this.buildFrog(); break;
      case 'chiikawa': this.buildChiikawa(); break;
      case 'grasscow': this.buildGrassCow(); break;
      case 'milkdragon': this.buildMilkDragon(); break;
      case 'capybara': this.buildCapybara(); break;
      case 'loopy': this.buildLoopy(); break;
      case 'bubu': this.buildBubu(); break;
    }

    // 统一补齐打字手：四足类在各自 build 里已经用 frontHand 建了手；
    // 正面坐姿 / 趴姿类（兔子、企鹅、青蛙、吉伊卡哇、奶龙、露比、布布）
    // 原来只有贴身的小手 / 鳍 / 蹼，敲键盘时根本够不到键盘。
    // 这里把它们降级为静态装饰，再补一对伸向键帽的手，
    // 保证 12 只动物打字时手都实实在在按在键盘上。
    if (!this.hasTypingHands) {
      for (const limb of this.limbs) limb.arm = false;
      const p = this.palette!;
      const model = this.model!;
      const fur = this.material(p.fur);
      const paw = this.material(p.paw);
      const pad = this.material(p.blush, 0.92);
      const shoulderY = TYPING_HAND_SHOULDER_Y[species] ?? 0.72;
      for (const side of [-1, 1] as const) {
        this.frontHand(model, side, {
          x: side * 0.30,
          y: shoulderY,
          bodyZ: 0.62,
          radius: 0.098,
          fur,
          paw,
          pad,
          splay: 0.10,
        });
      }
    }
  }

  /**
   * 圆墩短腿：胖胶囊大半埋进身体，只露一小截 + 椭圆脚掌。
   * Q 版团子的标准腿——没有关节球、没有细棍感，落地像一坨年糕。
   */
  private stubLeg(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    radius: number,
    visible: number,
    legMat: THREE.Material,
    footMat: THREE.Material,
    side: -1 | 1,
    front: boolean,
    footScale: Vec3 = [radius * 1.05, radius * 0.5, radius * 1.4],
  ): THREE.Group {
    const leg = this.group(parent, [x, y, z]);
    this.capsule(leg, legMat, [0, -visible * 0.45, 0], radius, visible + radius * 1.1);
    this.sphere(leg, footMat, [0, -visible, 0.05], footScale, [0, 0, 0], 18);
    this.trackLimb(leg, side, front, (front ? 0 : Math.PI) + side * 0.6);
    return leg;
  }

  /**
   * Q 版小前爪手：竖直短圆臂 + 圆掌，从胸前伸出来搭在键盘上。
   * 四足动物原来把前腿做成半埋的 stubLeg（位置低、贴着身子），
   * 看着只是"腿"，没有能敲键盘的手。这里换成位置抬高、明显外露的小手，
   * 并标记 arm —— 打字动画只驱动手，动作才看得清。
   */
  private frontHand(
    parent: THREE.Object3D,
    side: -1 | 1,
    opts: {
      x: number;
      /** 臂根高度，落在身体中部偏下 */
      y: number;
      /** 身体前缘的 z 半径：臂根从这里起算 */
      bodyZ: number;
      radius: number;
      /** @deprecated 现在由键帽落点自动反算，保留仅为兼容旧调用点 */
      reach?: number;
      fur: THREE.Material;
      paw: THREE.Material;
      /** 对比色掌垫：手和身体同色时全靠它把"手"读出来 */
      pad?: THREE.Material;
      pawScale?: Vec3;
      /** 手往外撇的角度，让两只手呈八字形，不贴着身体。 */
      splay?: number;
      /** @deprecated 现在由键帽落点自动反算 */
      tilt?: number;
    },
  ): THREE.Group {
    this.hasTypingHands = true;
    const r = opts.radius;
    const ps = opts.pawScale ?? [r * 1.55, r * 1.16, r * 1.40];
    const rootPos: Vec3 = [opts.x, opts.y, opts.bodyZ * 0.58];

    // 核心：不再让每只动物各写一个「大概朝前」的 tilt/reach，而是按实测的
    // 键帽顶面高度反解。掌球下缘 = 键帽顶面，掌心落在键盘中部，
    // 因此 12 只动物的手都精确按在键帽上，打字时不会悬空也不会穿进键盘。
    const palmBottom = KEYCAP_TOP_WORLD_Y / SPECIES_ROOT_SCALE;
    const palmCenterY = palmBottom + ps[1] * 0.94;
    const dy = palmCenterY - rootPos[1];
    const dz = PALM_TARGET_Z - rootPos[2];
    // 手臂局部 -Y 轴经 rotX(tilt) 后为 (0, -cosθ, -sinθ)，令其与 (dy, dz) 同向：
    const tilt = Math.atan2(-dz, -dy);
    const reach = Math.hypot(dy, dz) / 0.84;

    const hand = this.group(parent, rootPos, [tilt, 0, side * (opts.splay ?? 0.14)]);
    // 短粗圆臂：Q 版肉感
    this.capsule(hand, opts.fur, [0, -reach * 0.40, 0], r * 1.22, reach + r * 1.1);
    // 大圆掌：压扁成卡通饼状
    const paw = this.group(hand, [0, -reach * 0.84, 0.02]);
    this.sphere(paw, opts.paw, [0, 0, 0], ps, [0, 0, 0], 20);
    // 掌垫：对比色扁椭圆，贴在手心朝前的一面
    if (opts.pad) {
      this.sphere(paw, opts.pad, [0, -ps[1] * 0.02, ps[2] * 0.86], [ps[0] * 0.66, ps[1] * 0.58, ps[2] * 0.26], [0, 0, 0], 16);
    }
    this.trackLimb(hand, side, true, side * 0.5, undefined, true, paw);
    return hand;
  }

  private buildDog(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const cream = this.material(p.cream);

    // Q 版柴犬：矮墩面包身 + 大圆头，短粗腿半埋进身体
    const body = this.group(model, [0, 0.72, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.62, 0.52, 0.84]);
    this.sphere(body, cream, [0, -0.10, 0.58], [0.36, 0.27, 0.30]);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      // 前爪手：抬到胸前、明显外露，能看清地敲键盘
      this.frontHand(model, side, {
        x: side * 0.29, y: 0.43, bodyZ: 0.84,
        radius: 0.095, reach: 0.68, tilt: -1.25, fur, paw: cream,
        pad: this.material(p.blush, 0.92), splay: 0.10,
      });
      this.stubLeg(model, side * 0.40, 0.36, -0.50, 0.165, 0.26, fur, cream, side, false);
    }

    const head = this.group(model, [0, 1.30, 0.56]);
    this.sphere(head, fur, [0, 0, 0], [0.55, 0.51, 0.51]);
    this.sphere(head, cream, [0, -0.16, 0.38], [0.30, 0.19, 0.26]);
    this.sphere(head, this.material(p.nose, 0.40), [0, -0.12, 0.62], [0.095, 0.065, 0.055], [0, 0, 0], 16);
    this.smile(head, [0, -0.26, 0.54], 0.10, this.material(p.mouth));
    for (const side of [-1, 1] as const) {
      this.eye(head, [side * 0.21, 0.08, 0.44], 0.108, { sclera: true });
      const ear = this.group(head, [side * 0.35, 0.24, -0.04], [0.05, 0, side * 0.18]);
      this.capsule(ear, this.material(p.ear), [0, 0.44, 0], 0.125, 0.42, [1, 1, 0.72], [0, 0, side * 0.10]);
      this.trackEar(ear, side);
    }
    this.trackHead(head);

    // 柴犬卷尾：环在背上的粗管 + 奶油尾尖
    const tail = this.group(model, [0, 1.02, -0.62], [0.05, 0, 0]);
    this.tube(tail, fur, [[0, 0, 0], [0.02, 0.26, -0.14], [0.05, 0.46, -0.02], [0.02, 0.36, 0.12]], 0.10);
    this.sphere(tail, cream, [0.02, 0.36, 0.12], [0.10, 0.11, 0.10], [0, 0, 0], 16);
    this.trackTail(tail);
  }

  private buildFox(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const pale = this.material(p.cream);
    const socks = this.material(p.paw);

    const body = this.group(model, [0, 0.70, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.58, 0.48, 0.82]);
    this.sphere(body, pale, [0, -0.12, 0.56], [0.34, 0.24, 0.28]);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      this.frontHand(model, side, {
        x: side * 0.28, y: 0.41, bodyZ: 0.82,
        radius: 0.090, reach: 0.66, tilt: -1.25, fur, paw: socks, pad: pale, splay: 0.10,
      });
      this.stubLeg(model, side * 0.38, 0.34, -0.48, 0.14, 0.24, socks, socks, side, false);
    }

    const head = this.group(model, [0, 1.24, 0.54]);
    this.sphere(head, fur, [0, 0, 0], [0.52, 0.48, 0.50]);
    this.cone(head, fur, [0, -0.10, 0.44], 0.19, 0.42, [1, 0.85, 1], [Math.PI / 2, 0, 0], 22);
    this.cone(head, pale, [0, -0.16, 0.44], 0.13, 0.32, [1, 0.70, 1], [Math.PI / 2, 0, 0], 18);
    this.sphere(head, this.material(p.nose, 0.38), [0, -0.14, 0.66], [0.065, 0.05, 0.045], [0, 0, 0], 16);
    for (const side of [-1, 1] as const) {
      this.eye(head, [side * 0.20, 0.07, 0.40], 0.105, { aspect: 0.80, tilt: -side * 0.22, pupilShape: 'vertical' });
      const ear = this.group(head, [side * 0.27, 0.26, -0.06], [0, 0, -side * 0.14]);
      this.cone(ear, this.material(p.ear), [0, 0.24, 0], 0.185, 0.46, [1, 1, 0.62], [0, 0, 0], 3);
      this.cone(ear, this.material(p.innerEar), [0, 0.21, 0.06], 0.105, 0.30, [1, 1, 0.34], [0, 0, 0], 3);
      this.trackEar(ear, side);
    }
    this.trackHead(head);

    // 蓬松大尾巴：垂在身后，末端从右后侧露出来一点（不往头上翘，避免像头饰）
    const tail = this.group(model, [0.30, 0.46, -0.50]);
    this.tube(tail, fur, [[0, 0, 0], [0.12, -0.02, -0.22], [0.20, 0.10, -0.40], [0.26, 0.26, -0.44]], 0.17);
    this.sphere(tail, pale, [0.30, 0.28, -0.44], [0.17, 0.19, 0.18], [0, 0, 0], 20);
    this.trackTail(tail);
  }

  private buildPanda(): void {
    const p = this.palette!;
    const model = this.model!;
    const white = this.material(p.fur);
    const black = this.material(p.secondary.getHex() === p.fur.getHex() ? new THREE.Color('#1c1c1e') : p.secondary);

    const body = this.group(model, [0, 0.74, 0]);
    this.sphere(body, white, [0, 0, 0], [0.64, 0.52, 0.80]);
    this.sphere(body, black, [0, 0.10, 0.28], [0.64, 0.38, 0.54]);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      this.frontHand(model, side, {
        x: side * 0.30, y: 0.45, bodyZ: 0.80,
        radius: 0.102, reach: 0.70, tilt: -1.25, fur: black, paw: black,
        pad: this.material(new THREE.Color('#d6d6dc'), 0.88), splay: 0.10,
      });
      this.stubLeg(model, side * 0.42, 0.36, -0.48, 0.18, 0.25, black, black, side, false);
    }

    const head = this.group(model, [0, 1.34, 0.52]);
    this.sphere(head, white, [0, 0, 0], [0.55, 0.51, 0.50]);
    for (const side of [-1, 1] as const) {
      const ear = this.group(head, [side * 0.38, 0.36, -0.04]);
      this.sphere(ear, black, [0, 0, 0], [0.155, 0.155, 0.12], [0, 0, 0], 18);
      this.trackEar(ear, side);
      this.sphere(head, black, [side * 0.20, 0.05, 0.44], [0.13, 0.17, 0.03], [0, 0, -side * 0.26], 20);
      this.eye(head, [side * 0.20, 0.04, 0.45], 0.082, { iris: WHITE, pupil: p.pupil, depth: 0.26, pupilScale: 0.84 });
    }
    this.sphere(head, black, [0, -0.12, 0.50], [0.075, 0.055, 0.04], [0, 0, 0], 16);
    this.smile(head, [0, -0.22, 0.48], 0.075, black);
    this.trackHead(head);
  }

  private buildBunny(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const pale = this.material(p.belly);

    // Q 版兔子：坐墩团子 + 长耳，小手搭在胸前
    const body = this.group(model, [0, 0.62, 0], [-0.10, 0, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.54, 0.52, 0.46]);
    this.sphere(body, pale, [0, -0.12, 0.32], [0.34, 0.30, 0.20]);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      const front = this.group(model, [side * 0.29, 0.74, 0.28], [-0.24, 0, side * 0.10]);
      this.capsule(front, fur, [0, -0.11, 0], 0.102, 0.28);
      this.sphere(front, pale, [0, -0.25, 0.035], [0.145, 0.095, 0.150], [0, 0, 0], 18);
      this.sphere(front, this.material(p.blush, 0.90), [0, -0.255, 0.158], [0.100, 0.066, 0.038], [0, 0, 0], 14);
      this.trackLimb(front, side, true, side * 0.5, undefined, true);
      const foot = this.group(model, [side * 0.24, 0.10, 0.28]);
      this.sphere(foot, fur, [0, 0, 0], [0.17, 0.09, 0.24], [0, 0, 0], 18);
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }

    const head = this.group(model, [0, 1.40, 0.02]);
    this.sphere(head, fur, [0, 0, 0], [0.58, 0.54, 0.52]);
    for (const side of [-1, 1] as const) {
      this.eye(head, [side * 0.20, 0.04, 0.44], 0.106, { sclera: true });
      const ear = this.group(head, [side * 0.20, 0.32, -0.06], [0.02, 0, -side * 0.08]);
      this.capsule(ear, fur, [0, 0.40, 0], 0.105, 0.72, [1, 1, 0.68]);
      this.capsule(ear, this.material(p.innerEar), [0, 0.41, 0.065], 0.055, 0.54, [1, 1, 0.30]);
      this.trackEar(ear, side);
    }
    this.sphere(head, this.material(p.nose), [0, -0.10, 0.50], [0.05, 0.038, 0.03], [0, 0, 0], 14);
    this.smile(head, [0, -0.18, 0.48], 0.06, this.material(p.mouth));
    this.blush(head, 0.36, -0.12, 0.36, 0.075);
    this.trackHead(head);

    const tail = this.group(model, [0, 0.56, -0.42]);
    this.sphere(tail, this.material(p.cream), [0, 0, 0], [0.16, 0.16, 0.16], [0, 0, 0], 18);
    this.trackTail(tail);
  }

  private buildPenguin(): void {
    const p = this.palette!;
    const model = this.model!;
    const dark = this.material(p.fur);
    const white = this.material(p.belly);
    const orange = this.material(p.nose);

    const body = this.group(model);
    const pear = new THREE.SphereGeometry(1, 32, 24);
    const positions = pear.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const width = 0.86 - y * 0.17;
      positions.setX(i, positions.getX(i) * width);
      positions.setZ(i, positions.getZ(i) * (0.90 - y * 0.10));
    }
    pear.computeVertexNormals();
    this.mesh(body, pear, dark, [0, 1.0, 0], [0.75, 0.95, 0.59]);
    this.sphere(body, white, [0, 0.91, 0.47], [0.49, 0.70, 0.105]);
    for (const side of [-1, 1] as const) {
      this.eye(body, [side * 0.19, 1.49, 0.47], 0.115, { iris: WHITE, pupil: p.pupil, depth: 0.34, pupilScale: 0.78 });
    }
    this.cone(body, orange, [0, 1.29, 0.62], 0.12, 0.34, [1, 0.72, 1], [Math.PI / 2, 0, 0], 20);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      // 鳍往身前挪一点，并在鳍尖加橙色掌垫 —— 黑色身体上的黑鳍靠这块亮色才读得出"手"
      const flipper = this.group(model, [side * 0.53, 1.06, 0.10], [0, 0, -side * 0.20]);
      this.capsule(flipper, dark, [side * 0.08, -0.19, 0.02], 0.135, 0.64, [0.80, 1, 1.08], [0, 0, side * 0.16]);
      this.sphere(flipper, orange, [side * 0.205, -0.47, 0.075], [0.105, 0.070, 0.085], [0, 0, 0], 14);
      this.trackLimb(flipper, side, true, side * 0.5, undefined, true);
      const foot = this.group(model, [side * 0.27, 0.08, 0.22]);
      this.sphere(foot, orange, [0, 0, 0], [0.28, 0.08, 0.37], [0, side * 0.08, 0], 20);
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }
  }

  private webFoot(parent: THREE.Object3D, position: Vec3, rotationY: number, mat: THREE.Material): THREE.Group {
    const foot = this.group(parent, position, [0, rotationY, 0]);
    const shape = new THREE.Shape();
    shape.moveTo(-0.11, 0.14);
    shape.lineTo(-0.30, -0.10);
    shape.lineTo(-0.22, -0.20);
    shape.lineTo(-0.08, -0.16);
    shape.lineTo(0, -0.34);
    shape.lineTo(0.08, -0.16);
    shape.lineTo(0.22, -0.20);
    shape.lineTo(0.30, -0.10);
    shape.lineTo(0.11, 0.14);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    this.mesh(foot, geometry, mat);
    return foot;
  }

  private buildFrog(): void {
    const p = this.palette!;
    const model = this.model!;
    const green = this.material(p.fur);
    const pale = this.material(p.belly);

    // Q 版青蛙：宽扁团子，眼睛顶着两个大圆包
    const body = this.group(model, [0, 0.50, -0.08]);
    this.sphere(body, green, [0, 0, 0], [0.72, 0.34, 0.58]);
    this.sphere(body, pale, [0, -0.08, 0.38], [0.46, 0.18, 0.22]);
    this.trackBody(body);

    const head = this.group(model, [0, 0.78, 0.20]);
    this.sphere(head, green, [0, 0, 0], [0.74, 0.34, 0.50]);
    this.smile(head, [0, -0.14, 0.46], 0.34, this.material(p.mouth));
    for (const side of [-1, 1] as const) {
      this.sphere(head, green, [side * 0.38, 0.28, 0.0], [0.24, 0.24, 0.22], [0, 0, 0], 24);
      this.eye(head, [side * 0.38, 0.30, 0.17], 0.165, { iris: p.eye, pupil: p.pupil, aspect: 1.05 });
      this.sphere(head, this.material(tint(p.fur, -0.12)), [side * 0.17, -0.06, 0.46], [0.03, 0.02, 0.016], [0, 0, 0], 12);
    }
    this.blush(head, 0.50, -0.16, 0.34, 0.10);
    this.trackHead(head);

    for (const side of [-1, 1] as const) {
      const rear = this.group(model, [side * 0.56, 0.34, -0.28]);
      this.sphere(rear, green, [0, 0, 0], [0.30, 0.24, 0.34]);
      this.trackLimb(rear, side, false, Math.PI + side * 0.5);
      const front = this.group(model, [side * 0.48, 0.36, 0.36]);
      this.capsule(front, green, [0, -0.10, 0], 0.094, 0.26);
      this.trackLimb(front, side, true, side * 0.5, undefined, true);
      const frontFoot = this.webFoot(model, [side * 0.48, 0.05, 0.54], side * 0.10, pale);
      this.trackLimb(frontFoot, side, true, side * 0.8, undefined, true);
      const rearFoot = this.webFoot(model, [side * 0.62, 0.05, 0.04], -side * 0.20, pale);
      this.trackLimb(rearFoot, side, false, Math.PI + side * 0.8);
    }
  }

  private buildChiikawa(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const cream = this.material(tint(p.fur, -0.035));
    const ink = this.material(p.mouth);
    const pink = this.material(p.nose, 0.6);

    // Two-head proportions: the body stays small and the head does the acting.
    const body = this.group(model, [0, 0.66, -0.05]);
    this.sphere(body, fur, [0, 0, 0], [0.48, 0.49, 0.40]);
    this.trackBody(body);

    const chiArms: SoftLimbRef[] = [];
    for (const side of [-1, 1] as const) {
      chiArms.push(this.softLimb(
        model, side,
        [side * 0.36, 0.68, 0.26],
        {
          upper: 0.13, lower: 0.12, radius: 0.13,
          fur, pawMat: fur,
          pad: this.material(p.blush, 0.90),
          hang: -side * 0.10, bend: -side * 0.12, tiltX: -0.62,
          pawScale: [0.17, 0.128, 0.155],
        },
        true, side * 0.5,
      ));
      const foot = this.group(model, [side * 0.21, 0.10, 0.16]);
      this.sphere(foot, fur, [0, 0, 0], [0.21, 0.115, 0.27], [0, 0, 0], 20);
      this.sphere(foot, cream, [0, -0.04, 0.19], [0.12, 0.055, 0.085], [0, 0, 0], 16);
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }

    const blue = this.material(new THREE.Color('#8fb3cc'), 0.74);
    const tail = this.group(model, [0, 0.54, -0.43]);
    this.sphere(tail, blue, [0, 0, 0], [0.15, 0.15, 0.15], [0, 0, 0], 18);
    this.trackTail(tail);

    const head = this.group(model, [0, 1.25, 0.03]);
    this.sphere(head, fur, [0, 0, 0], [0.58, 0.53, 0.47]);
    for (const side of [-1, 1] as const) {
      const ear = this.group(head, [side * 0.38, 0.37, -0.025]);
      this.sphere(ear, fur, [0, 0, 0], [0.135, 0.135, 0.10], [0, 0, 0], 18);
      this.trackEar(ear, side);
      this.eye(head, [side * 0.20, 0.005, 0.42], 0.076, { aspect: 0.92, style: 'dot' });
    }
    // Tiny w mouth plus the small dot below it, exactly as in the reference.
    for (const side of [-1, 1] as const) {
      this.tube(head, ink, [[-0.05, 0.014, 0], [-0.018, -0.028, 0], [0.028, -0.026, 0], [0.055, 0.010, 0]], 0.010, [side * 0.036, -0.145, 0.49]);
    }
    this.sphere(head, ink, [0, -0.205, 0.49], [0.022, 0.016, 0.014], [0, 0, 0], 12);
    this.blush(head, 0.39, -0.105, 0.36, 0.10);
    // Three little lines inside each blush oval.
    const blushLine = this.material(new THREE.Color('#e88fa6'));
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        this.tube(head, blushLine, [
          [side * 0.34 + i * 0.045, -0.085, 0.445],
          [side * 0.35 + i * 0.045, -0.125, 0.445],
        ], 0.008);
      }
    }
    // Blue bow / headscarf with a small knot in the middle.
    this.sphere(head, blue, [-0.21, 0.49, 0.02], [0.22, 0.15, 0.10], [0, 0, -0.16], 20);
    this.sphere(head, blue, [0.21, 0.49, 0.02], [0.22, 0.15, 0.10], [0, 0, 0.16], 20);
    this.sphere(head, blue, [0, 0.47, 0.09], [0.08, 0.075, 0.055], [0, 0, 0], 16);
    this.tube(head, blue, [[-0.36, 0.43, 0.28], [-0.18, 0.37, 0.40], [0, 0.35, 0.44], [0.18, 0.37, 0.40], [0.36, 0.43, 0.28]], 0.032);
    this.trackHead(head);

    // Mini weeding sickle held in the right paw, mounted on the wrist so it
    // follows the whole arm chain. Blender-authored curved blade.
    const grip = this.material(new THREE.Color('#8a5a3c'), 0.8);
    const sickle = this.group(model, [0.62, 0.52, 0.30], [0.2, -0.35, -0.55]);
    const bladeMat = this.material(new THREE.Color('#c8ced6'), 0.42);
    this.proto(sickle, 'sickle', bladeMat, [0, 0, 0], [1.25, 1.25, 1.25]);
    this.capsule(sickle, grip, [0.02, -0.02, 0.01], 0.032, 0.16, [1, 1, 1], [0, 0, Math.PI / 2]);

    this.motion((time, state) => {
      const awake = 1 - state.sleep;
      const cower = beatMotion(time, 7.8, 3.6, 5.8) * 0.7;
      model.position.x += Math.sin(time * 2.4) * 0.010 * awake;
      if (this.head) {
        this.head.node.rotation.x += cower * 0.18;
        this.head.node.rotation.z += Math.sin(time * 1.3) * 0.025 * awake + cower * 0.03;
      }
      for (const limb of this.limbs) {
        if (!limb.front) continue;
        limb.node.rotation.z += limb.side * cower * 0.35;
        limb.node.position.y += cower * 0.08;
      }
      // Sickle paw freezes mid-raise on the beat ("举镰刀愣住").
      const freeze = ((time % 7.8) + 7.8) % 7.8;
      const stuck = freeze > 3.6 && freeze < 5.8 ? Math.sin(((freeze - 3.6) / 2.2) * Math.PI) : 0;
      for (const arm of chiArms) {
        const elbow = followBeat(time, 7.8, 3.6, 5.8, 0.10) * 0.7;
        const wrist = followBeat(time, 7.8, 3.6, 5.8, 0.20) * 0.7;
        arm.elbow.rotation.z = -arm.side * 0.12 + arm.side * elbow * 0.20;
        arm.wrist.rotation.z = arm.side * wrist * 0.16;
        if (arm.side > 0) {
          arm.elbow.rotation.z -= stuck * 0.55;
          arm.wrist.rotation.z -= stuck * 0.30;
        }
      }
      sickle.rotation.z = -0.55 + stuck * 0.40;
      if (this.tail) {
        this.tail.node.rotation.z += Math.sin(time * 3.4) * 0.06 * awake;
        this.tail.node.rotation.y += followBeat(time, 7.8, 3.6, 5.8, 0.26) * 0.12;
      }
    });
  }

  private buildGrassCow(): void {
    const p = this.palette!;
    const model = this.model!;
    const white = this.material(p.fur);
    const patches = this.material(p.secondary);
    const pink = this.material(p.nose, 0.72);
    const ink = this.material(p.mouth);
    const hornMat = this.material(new THREE.Color('#e8ddc8'), 0.72);
    const earMat = this.material(new THREE.Color('#6d6d70'), 0.8);

    // Q 版表情包牛：矮墩白面包身 + 黑色碎斑 + 大圆脸，弃用旧原型头
    const body = this.group(model, [0, 0.72, 0]);
    this.sphere(body, white, [0, 0, 0], [0.62, 0.52, 0.82]);
    this.sphere(body, patches, [-0.50, 0.10, -0.20], [0.16, 0.26, 0.32], [0, 0, -0.14], 20);
    this.sphere(body, patches, [0.50, -0.06, 0.24], [0.15, 0.22, 0.28], [0, 0, 0.18], 20);
    this.sphere(body, patches, [0.12, 0.40, -0.26], [0.26, 0.09, 0.30], [0, 0, 0], 18);
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      this.frontHand(model, side, {
        x: side * 0.27, y: 0.43, bodyZ: 0.82,
        radius: 0.096, reach: 0.68, tilt: -1.25, fur: white, paw: patches, pad: pink, splay: 0.08,
      });
      this.stubLeg(model, side * 0.42, 0.36, -0.48, 0.17, 0.25, white, patches, side, false);
    }

    const head = this.group(model, [0, 1.30, 0.54]);
    this.sphere(head, white, [0, 0, 0], [0.56, 0.50, 0.50]);
    // 头顶碎斑 + 额头白色小菱形
    this.sphere(head, patches, [-0.28, 0.28, 0.26], [0.17, 0.12, 0.09], [0, 0, -0.20], 20);
    this.sphere(head, patches, [0.30, 0.26, 0.26], [0.14, 0.10, 0.08], [0, 0, 0.22], 20);
    this.box(head, white, [0, 0.40, 0.33], [0.085, 0.085, 0.02], [0, 0, Math.PI / 4]);

    for (const side of [-1, 1] as const) {
      // 圆润小角 + 横椭圆耳朵
      const horn = this.group(head, [side * 0.28, 0.42, -0.06], [0, 0, -side * 0.35]);
      this.roundHorn(horn, [0, 0.10, 0], hornMat, 0.065, 0.18);
      const ear = this.group(head, [side * 0.50, 0.10, -0.02], [0, 0, -side * 0.14]);
      this.sphere(ear, earMat, [side * 0.08, 0, 0], [0.20, 0.10, 0.13], [0, 0, side * 0.10], 18);
      this.trackEar(ear, side);
      // 表情包呆滞眼：黑色小豆豆眼 + 平直眉
      this.eye(head, [side * 0.24, 0.10, 0.43], 0.088, { iris: p.mouth, pupil: BLACK, sclera: true });
      const brow = this.brow(head, [side * 0.24, 0.24, 0.43], 0.12, 0, patches);
      brow.scale.y = 1.3;
    }
    // 粉色口鼻 + 两粒鼻孔 + 震惊的 O 嘴
    this.sphere(head, pink, [0, -0.22, 0.40], [0.28, 0.17, 0.14]);
    for (const side of [-1, 1] as const) {
      this.sphere(head, ink, [side * 0.11, -0.20, 0.50], [0.04, 0.03, 0.02], [0, 0, 0], 12);
    }
    const mouthDark = this.sphere(head, ink, [0, -0.34, 0.48], [0.085, 0.12, 0.024], [0, 0, 0], 20);
    this.mesh(head, new THREE.TorusGeometry(0.095, 0.024, 12, 24), pink, [0, -0.34, 0.485], [1, 1.25, 1]);

    // Straw dangling from the mouth; drops and gets chewed back on a cycle.
    const strawMat = this.material(new THREE.Color('#9fbf4a'), 0.82);
    const strawBase: Vec3 = [0.03, -0.36, 0.50];
    const straw = this.proto(head, 'straw', strawMat, strawBase, [1, 1, 1], [0, 0, Math.PI / 2 + 0.25]);
    this.trackHead(head);

    const tail = this.group(model, [0, 0.94, -0.72]);
    this.tube(tail, white, [[0, 0, 0], [0.06, -0.18, -0.15], [0.13, -0.38, -0.16], [0.18, -0.52, -0.08]], 0.038);
    this.sphere(tail, patches, [0.18, -0.52, -0.08], [0.08, 0.13, 0.07], [0, 0, -0.20], 16);
    this.trackTail(tail);

    // "牛惊": the head jerks back, eyes widen and the O-mouth pops open.
    this.motion((time, state) => {
      const shock = beatMotion(time, 8.4, 2.8, 4.8);
      const awake = 1 - state.sleep;
      if (this.head) {
        this.head.node.rotation.x -= shock * 0.16;
        this.head.node.position.y += shock * 0.035;
        this.head.node.rotation.y += Math.sin(time * 0.55) * 0.035 * awake;
      }
      for (const eye of this.eyes) eye.node.scale.y *= 1 + shock * 0.22;
      mouthDark.scale.y = 0.12 * (1 + shock * 0.30);
      if (this.tail) {
        this.tail.node.rotation.x += shock * 0.18;
        this.tail.node.rotation.z += followBeat(time, 8.4, 2.8, 4.8, 0.14) * 0.14;
      }
      // Straw slips out of the mouth on a slow cycle, then a sudden head turn.
      const dropout = ((time % 11.0) + 11.0) % 11.0;
      const drop = dropout > 6.5 && dropout < 8.6 ? Math.sin(((dropout - 6.5) / 2.1) * Math.PI) : 0;
      straw.position.set(strawBase[0] + drop * 0.22, strawBase[1] - drop * 0.30, strawBase[2]);
      straw.rotation.z = Math.PI / 2 + 0.25 - drop * 0.9;
      straw.rotation.x = drop * 0.5;
      const jerk = dropout > 8.6 && dropout < 9.1 ? Math.sin(((dropout - 8.6) / 0.5) * Math.PI) : 0;
      if (this.head) this.head.node.rotation.y += jerk * 0.28 * awake;
    });
  }

  private buildMilkDragon(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const belly = this.material(p.belly);
    const ink = this.material(p.mouth);
    const claw = this.material(new THREE.Color('#6b3a1f'));

    const body = this.group(model, [0, 0.62, 0]);
    // Blender barrel torso: a rounded, jiggly mass rather than a plain sphere.
    this.proto(body, 'dragon_belly', fur, [0, 0, 0], [0.62, 0.56, 0.50]);
    // The duang belly is a front-facing dome, not a flat bib.
    const duang = this.proto(body, 'dragon_belly', belly, [0, -0.06, 0.36], [0.46, 0.44, 0.32]);
    this.trackBody(body);

    const dragonArms: SoftLimbRef[] = [];
    for (const side of [-1, 1] as const) {
      dragonArms.push(this.softLimb(
        model, side,
        [side * 0.40, 0.72, 0.30],
        {
          upper: 0.13, lower: 0.12, radius: 0.145,
          fur, pawMat: fur,
          pad: this.material(new THREE.Color('#ffe7ae'), 0.92),
          hang: -side * 0.06, bend: -side * 0.10, tiltX: -0.70,
          pawScale: [0.19, 0.142, 0.178],
        },
        true, side * 0.5,
      ));
      const foot = this.group(model, [side * 0.28, 0.11, 0.28]);
      this.sphere(foot, fur, [0, 0, 0], [0.23, 0.11, 0.29], [0, 0, 0], 20);
      this.sphere(foot, belly, [0, -0.04, 0.22], [0.14, 0.05, 0.07], [0, 0, 0], 16);
      for (const dx of [-0.07, 0, 0.07]) {
        this.sphere(foot, claw, [dx, 0.01, 0.27], [0.035, 0.025, 0.025], [0, 0, 0], 12);
      }
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }

    // 上窄下宽的蛋形头：竖椭圆轮廓 + 头顶收窄，比正圆更有呆萌感
    const head = this.group(model, [0, 1.40, 0.02]);
    const headGeo = new THREE.SphereGeometry(1, 30, 22);
    const hp = headGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);                    // -1 ~ 1
      const taper = 1 - Math.max(0, y) * 0.26; // 只收窄上半球，下部保持圆润
      hp.setX(i, hp.getX(i) * taper);
      hp.setZ(i, hp.getZ(i) * taper);
    }
    headGeo.computeVertexNormals();
    this.mesh(head, headGeo, fur, [0, 0, 0], [0.60, 0.66, 0.54]);
    const greenIris = new THREE.Color('#57b34a');
    for (const side of [-1, 1] as const) {
      this.eye(head, [side * 0.19, 0.08, 0.44], 0.132, { iris: greenIris, pupil: BLACK, aspect: 1.0, style: 'sparkle' });
    }
    for (const side of [-1, 1] as const) {
      this.sphere(head, ink, [side * 0.05, -0.16, 0.53], [0.018, 0.014, 0.012], [0, 0, 0], 10);
    }
    this.mouthCurve(head, [0, -0.28, 0.49], 0.17, 0.01, ink, 0.016);
    this.trackHead(head);

    // Tiny fire puff: a small cone that pops on the duang beat ("喷小火苗").
    const flameMat = this.material(new THREE.Color('#ff9a3c'), 0.5);
    const flame = this.group(head, [0.20, -0.36, 0.42], [Math.PI / 2 - 0.35, 0, 0]);
    this.cone(flame, flameMat, [0, 0.06, 0], 0.055, 0.16, [1, 1, 1], [0, 0, 0], 10);
    flame.visible = false;

    const tail = this.group(model, [0, 0.52, -0.42]);
    this.sphere(tail, fur, [0, 0, 0], [0.155, 0.155, 0.155], [0, 0, 0], 18);
    this.trackTail(tail);

    // Lumbering walk plus the signature duang-duang bounce.
    this.motion((time, state) => {
      const awake = 1 - state.sleep;
      const wobble = Math.sin(time * 2.5) * 0.045 * awake;
      duang.scale.set(0.46 * (1 + wobble), 0.44 * (1 - wobble * 0.7), 0.32);
      const cycle = ((time % 8.6) + 8.6) % 8.6;
      const duangBeat = cycle > 3.2 && cycle < 5.4 ? Math.sin(((cycle - 3.2) / 2.2) * Math.PI) : 0;
      duang.scale.x *= 1 + duangBeat * 0.16;
      duang.scale.y *= 1 - duangBeat * 0.11;
      // Fire puff only on the crest of the duang beat and only while awake.
      flame.visible = awake > 0.4 && duangBeat > 0.45;
      if (flame.visible) {
        flame.scale.setScalar(0.7 + duangBeat * 0.6);
        flame.rotation.z = Math.sin(time * 18) * 0.18;
      }
      model.position.x += Math.sin(time * 1.35) * 0.018 * awake;
      if (this.body) this.body.node.rotation.z += Math.sin(time * 1.2) * 0.022 * awake;
      if (this.head) this.head.node.position.y += duangBeat * 0.025;
      const wave = beatMotion(time, 8.6, 3.2, 5.4);
      for (const limb of this.limbs) {
        if (!limb.front) continue;
        limb.node.rotation.x += Math.sin(time * 2.6 + limb.phase) * 0.10 * awake;
        limb.node.rotation.z += limb.side * wave * 0.22;
        limb.node.position.y += wave * 0.05;
      }
      for (const arm of dragonArms) {
        const elbow = followBeat(time, 8.6, 3.2, 5.4, 0.12);
        const wrist = followBeat(time, 8.6, 3.2, 5.4, 0.24);
        arm.elbow.rotation.z = -arm.side * 0.10 + arm.side * elbow * 0.26;
        arm.wrist.rotation.z = arm.side * wrist * 0.22;
      }
    });
  }

  private buildCapybara(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const dark = this.material(p.secondary);
    const ink = this.material(p.mouth);
    const muzzleMat = this.material(new THREE.Color('#f59b1f'), 0.74);
    const shorts = this.material(new THREE.Color('#a9602e'), 0.82);

    // Q 版水豚噜噜：矮墩芒果面包身 + 棕色短裤，橘子顶在头上
    const body = this.group(model, [0, 0.66, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.60, 0.48, 0.76]);
    this.sphere(body, shorts, [0, -0.26, -0.22], [0.52, 0.15, 0.28], [0, 0, 0], 20);
    for (const side of [-1, 1] as const) {
      this.tube(body, dark, [[side * 0.18, -0.36, 0.0], [side * 0.27, -0.28, 0.01], [side * 0.31, -0.17, 0.0]], 0.011);
    }
    this.trackBody(body);

    for (const side of [-1, 1] as const) {
      this.frontHand(model, side, {
        x: side * 0.26, y: 0.40, bodyZ: 0.76,
        radius: 0.086, reach: 0.62, tilt: -1.25, fur: dark, paw: dark, pad: muzzleMat, splay: 0.09,
      });
      this.stubLeg(model, side * 0.38, 0.32, -0.42, 0.15, 0.22, dark, dark, side, false);
    }

    const head = this.group(model, [0, 1.12, 0.50]);
    this.sphere(head, fur, [0, 0, 0], [0.50, 0.44, 0.44]);
    // 橘色大鼻吻（收小一号，不再是整张脸）
    this.sphere(head, muzzleMat, [0, -0.12, 0.30], [0.30, 0.20, 0.24], [0, 0, 0], 24);
    this.sphere(head, ink, [0, 0.02, 0.50], [0.08, 0.05, 0.03], [0, 0, 0], 14);
    for (const side of [-1, 1] as const) {
      this.eye(head, [side * 0.23, 0.14, 0.39], 0.076, { iris: BLACK, pupil: BLACK, style: 'dot', sclera: true });
      const ear = this.group(head, [side * 0.34, 0.30, -0.02]);
      this.sphere(ear, dark, [0, 0, 0], [0.09, 0.10, 0.07], [0, 0, 0], 16);
      this.trackEar(ear, side);
    }
    this.mouthCurve(head, [0, -0.24, 0.46], 0.09, 0.0, ink, 0.013);
    this.trackHead(head);

    const orangeBase: Vec3 = [0, 0.46, 0.0];
    const orange = this.group(head, orangeBase, [0, 0, -0.08]);
    this.sphere(orange, this.material(new THREE.Color('#f5883a'), 0.68), [0, 0, 0], [0.17, 0.15, 0.17], [0, 0, 0], 24);
    this.sphere(orange, this.material(new THREE.Color('#ffd06b')), [-0.05, 0.05, 0.13], [0.06, 0.04, 0.025], [0, 0, 0], 14);
    this.tube(orange, this.material(new THREE.Color('#56863a')), [[0, 0.13, 0], [0.02, 0.20, 0], [0.08, 0.22, 0.01]], 0.020);

    // Ultra chill lean, orange wobble and a slow wave.
    this.motion((time, state) => {
      const awake = 1 - state.sleep;
      const wave = beatMotion(time, 6.4, 2.0, 4.6);
      const lean = Math.sin(time * 0.48) * 0.04 * awake;
      if (this.head) {
        this.head.node.rotation.z += lean + wave * 0.03;
        this.head.node.rotation.x += wave * 0.04;
      }
      if (this.body) this.body.node.rotation.z += lean * 0.3;
      orange.position.set(orangeBase[0] + Math.sin(time * 0.9) * 0.018, orangeBase[1], orangeBase[2]);
      orange.rotation.z = -0.08 + Math.sin(time * 1.35) * 0.12 + wave * 0.10;
      for (const limb of this.limbs) {
        if (limb.front && limb.side > 0) {
          limb.node.rotation.z += wave * 0.45;
          limb.node.position.y += wave * 0.06;
        }
      }
    });
  }

  private buildLoopy(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const tailMat = this.material(tint(p.secondary, -0.10));
    const ink = this.material(p.mouth);
    const whiteBelly = this.material(new THREE.Color('#f3e3e6'), 0.86);
    const darkPaw = this.material(new THREE.Color('#51283c'), 0.72);
    const tuftMat = this.material(new THREE.Color('#e8752f'), 0.72);

    const body = this.group(model, [0, 0.62, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.56, 0.54, 0.46]);
    this.sphere(body, whiteBelly, [0, -0.12, 0.34], [0.34, 0.36, 0.10], [0, 0, 0], 24);
    this.trackBody(body);

    // Broad flat beaver tail with the cross-hatched texture.
    const tail = this.group(model, [0.16, 0.24, -0.40], [0.06, -0.30, 0]);
    this.proto(tail, 'beaver_tail', tailMat, [0, 0, -0.16], [0.58, 0.15, 0.66]);
    for (let i = -2; i <= 2; i++) {
      this.tube(tail, ink, [[i * 0.14, 0.075, -0.54], [i * 0.14, 0.09, -0.20], [i * 0.14, 0.065, 0.06]], 0.008);
    }
    this.trackTail(tail);

    const loopyArms: SoftLimbRef[] = [];
    for (const side of [-1, 1] as const) {
      const raised = side < 0; // the reference shows the left paw up
      loopyArms.push(this.softLimb(
        model, side,
        [side * 0.38, 0.70, 0.26],
        {
          upper: 0.12, lower: 0.11, radius: 0.125,
          fur, pawMat: darkPaw,
          pad: this.material(new THREE.Color('#f7c3d3'), 0.90),
          hang: raised ? 0.62 : -side * 0.12, bend: -side * 0.08, tiltX: raised ? -0.15 : -0.62,
          pawScale: [0.152, 0.114, 0.122],
        },
        true, side * 0.5,
      ));
      const foot = this.group(model, [side * 0.26, 0.10, 0.26]);
      this.sphere(foot, darkPaw, [0, 0, 0], [0.21, 0.10, 0.26], [0, 0, 0], 18);
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }

    const head = this.group(model, [0, 1.40, 0.02]);
    this.sphere(head, fur, [0, 0, 0], [0.60, 0.56, 0.52]);
    for (const side of [-1, 1] as const) {
      const ear = this.group(head, [side * 0.42, 0.30, -0.04]);
      this.sphere(ear, fur, [0, 0, 0], [0.14, 0.15, 0.11], [0, 0, 0], 18);
      this.sphere(ear, this.material(new THREE.Color('#f7d9df')), [0, 0, 0.075], [0.06, 0.065, 0.02], [0, 0, 0], 14);
      this.trackEar(ear, side);
      this.eye(head, [side * 0.20, 0.04, 0.43], 0.106, { iris: BLACK, pupil: BLACK, aspect: 1.05, style: 'dot', sclera: true });
    }
    // Big purple oval nose and open smile with two teeth.
    this.sphere(head, this.material(new THREE.Color('#6d1d53'), 0.42), [0, -0.10, 0.47], [0.095, 0.075, 0.045], [0, 0, 0], 22);
    this.sphere(head, ink, [0, -0.24, 0.45], [0.12, 0.085, 0.028], [0, 0, 0], 20);
    this.teeth(head, -0.25, 0.48, 0.075, 0.075);

    // Single Blender-authored ahoge (one soft tuft) instead of two thin spikes.
    const tufts: THREE.Group[] = [];
    const tuft = this.group(head, [-0.20, 0.44, 0.02], [0, 0, 0.42]);
    this.proto(tuft, 'ahoge', tuftMat, [0, 0, 0], [1.0, 1.0, 1.0]);
    this.trackEar(tuft, -1);
    tufts.push(tuft);

    // Pink bow hair clip on the other side of the head.
    const bowMat = this.material(new THREE.Color('#e86a93'), 0.66);
    const bow = this.group(head, [0.32, 0.40, 0.10], [0, 0, -0.20]);
    this.proto(bow, 'bow', bowMat, [0, 0, 0], [0.52, 0.52, 0.52]);
    this.trackEar(bow, 1);
    this.trackHead(head);

    // Friendly wave with the raised paw, tail slap and swaying tufts.
    this.motion((time, state) => {
      const awake = 1 - state.sleep;
      const wave = beatMotion(time, 9.2, 3.8, 6.6);
      if (this.head) {
        this.head.node.rotation.z += Math.sin(time * 1.1) * 0.025 * awake;
        this.head.node.rotation.x += wave * 0.05;
      }
      for (const limb of this.limbs) {
        if (limb.front && limb.side < 0) {
          limb.node.rotation.z += wave * 0.42;
          limb.node.position.y += wave * 0.06;
        }
      }
      // Shy face-covering: the raised paw occasionally hides the cheek.
      const shyCycle = ((time % 9.2) + 9.2) % 9.2;
      const shy = shyCycle > 6.6 && shyCycle < 8.4 ? Math.sin(((shyCycle - 6.6) / 1.8) * Math.PI) : 0;
      for (const arm of loopyArms) {
        if (arm.side >= 0) continue;
        const elbow = followBeat(time, 9.2, 3.8, 6.6, 0.12);
        const wrist = followBeat(time, 9.2, 3.8, 6.6, 0.24);
        arm.elbow.rotation.z = -arm.side * 0.08 + arm.side * elbow * 0.28 - shy * 0.80;
        arm.wrist.rotation.z = arm.side * wrist * 0.22 - shy * 0.35;
      }
      if (this.head) this.head.node.rotation.z += shy * 0.10;
      for (let i = 0; i < tufts.length; i++) {
        tufts[i].rotation.z += Math.sin(time * 2.1 + i * 1.4) * 0.06 * awake;
      }
      if (this.tail) {
        this.tail.node.rotation.y += Math.sin(time * 1.8) * 0.08 * awake;
        this.tail.node.rotation.z += Math.sin(time * 1.2) * 0.05 * awake;
      }
    });
  }

  private buildBubu(): void {
    const p = this.palette!;
    const model = this.model!;
    const fur = this.material(p.fur);
    const ink = this.material(p.mouth);
    const blushMat = this.material(new THREE.Color('#e6a96f'), 0.86);
    const rose = this.material(new THREE.Color('#e05260'), 0.62);
    const leaf = this.material(new THREE.Color('#6b9a4a'), 0.70);
    const bowYellow = this.material(new THREE.Color('#f2c14e'), 0.66);

    const body = this.group(model, [0, 0.62, 0]);
    this.sphere(body, fur, [0, 0, 0], [0.56, 0.54, 0.46]);
    // Yellow bow tie on the chest.
    this.sphere(body, bowYellow, [-0.14, 0.24, 0.40], [0.15, 0.095, 0.05], [0, 0, -0.12], 18);
    this.sphere(body, bowYellow, [0.14, 0.24, 0.40], [0.15, 0.095, 0.05], [0, 0, 0.12], 18);
    this.sphere(body, bowYellow, [0, 0.24, 0.44], [0.065, 0.065, 0.04], [0, 0, 0], 16);
    this.trackBody(body);

    const bubuArms: SoftLimbRef[] = [];
    for (const side of [-1, 1] as const) {
      const arm = this.softLimb(
        model, side,
        [side * 0.38, 0.68, 0.26],
        {
          upper: 0.12, lower: 0.11, radius: 0.13,
          fur, pawMat: this.material(p.paw),
          pad: this.material(new THREE.Color('#ecd8c0'), 0.92),
          hang: -side * 0.12, bend: -side * 0.10, tiltX: -0.62,
          pawScale: [0.17, 0.126, 0.155],
        },
        true, side * 0.5,
      );
      bubuArms.push(arm);
      if (side < 0) {
        // Red rose held in the left paw - mounted on the wrist so it follows
        // the whole arm chain instead of floating beside the shoulder.
        this.tube(arm.wrist, leaf, [[0, -0.04, 0.12], [-0.02, -0.14, 0.15], [-0.05, -0.22, 0.17]], 0.020);
        this.sphere(arm.wrist, leaf, [-0.05, -0.13, 0.18], [0.10, 0.04, 0.028], [0, 0, 0.5], 12);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.sphere(arm.wrist, rose, [Math.cos(a) * 0.075, 0.10 + Math.sin(a) * 0.075, 0.20], [0.075, 0.075, 0.05], [0, 0, 0], 14);
        }
        this.sphere(arm.wrist, rose, [0, 0.10, 0.25], [0.065, 0.065, 0.045], [0, 0, 0], 14);
      }
      const foot = this.group(model, [side * 0.26, 0.10, 0.26]);
      this.sphere(foot, this.material(p.paw), [0, 0, 0], [0.22, 0.11, 0.27], [0, 0, 0], 20);
      this.trackLimb(foot, side, false, Math.PI + side * 0.5);
    }

    const head = this.group(model, [0, 1.40, 0.02]);
    this.sphere(head, fur, [0, 0, 0], [0.58, 0.55, 0.52]);
    for (const side of [-1, 1] as const) {
      const ear = this.group(head, [side * 0.38, 0.38, -0.03]);
      if (side > 0) {
        // Right ear droops like a worn plush toy (Blender floppy-ear proto).
        this.proto(ear, 'floppy_ear', fur, [0.02, -0.12, 0], [0.95, 1.15, 0.75], [0, 0, 0.55]);
      } else {
        this.sphere(ear, fur, [0, 0, 0], [0.175, 0.175, 0.135], [0, 0, 0], 20);
      }
      this.sphere(ear, this.material(p.innerEar), [0, 0, 0.105], [0.095, 0.095, 0.03], [0, 0, 0], 16);
      this.trackEar(ear, side);
      // Mismatched button eyes: one higher, one lower, neither one blinks.
      const buttonMat = this.material(new THREE.Color(side < 0 ? '#3a2a22' : '#4a3529'), 0.55);
      const by = side < 0 ? 0.085 : 0.015;
      this.proto(head, 'button_eye', buttonMat, [side * 0.19, by, 0.46], side < 0 ? [1.36, 1.36, 1.36] : [1.12, 1.12, 1.36]);
      this.sphere(head, this.material(new THREE.Color('#d8c9b0')), [side * 0.19 - 0.026, by + 0.026, 0.492], [0.019, 0.019, 0.010], [0, 0, 0], 10);
      this.sphere(head, blushMat, [side * 0.34, -0.12, 0.38], [0.105, 0.07, 0.024], [0, 0, 0], 16);
      for (let i = 0; i < 2; i++) {
        this.tube(head, this.material(new THREE.Color('#c9864f')), [
          [side * 0.31 + i * 0.05, -0.10, 0.40],
          [side * 0.33 + i * 0.05, -0.15, 0.40],
        ], 0.006);
      }
    }
    // Crooked stitched mouth: a slightly slanted seam with vertical stitches.
    const threadMat = this.material(new THREE.Color('#8a6248'), 0.8);
    this.tube(head, ink, [[-0.09, -0.16, 0.46], [-0.03, -0.19, 0.47], [0.03, -0.17, 0.47], [0.09, -0.20, 0.46]], 0.008);
    for (let i = 0; i < 4; i++) {
      const sx = -0.075 + i * 0.05;
      this.tube(head, threadMat, [[sx, -0.175, 0.47], [sx + 0.008, -0.21, 0.47]], 0.006);
    }
    // A loose thread poking out at the corner of the seam.
    const looseThread = this.group(head, [0.10, -0.20, 0.46]);
    this.tube(looseThread, threadMat, [[0, 0, 0], [0.05, 0.04, 0], [0.08, 0.02, 0]], 0.005);
    this.trackHead(head);

    // Calm nod and an occasional soft wave - Bubu never panics.
    this.motion((time, state) => {
      const awake = 1 - state.sleep;
      const cycle = ((time % 7.6) + 7.6) % 7.6;
      const wave = cycle > 3.4 && cycle < 5.8 ? Math.sin(((cycle - 3.4) / 2.4) * Math.PI) : 0;
      // Slumped plush: occasionally collapses, head lolls to one side.
      const slumpCycle = ((time % 7.6) + 7.6) % 7.6;
      const slump = slumpCycle > 5.8 && slumpCycle < 7.2 ? Math.sin(((slumpCycle - 5.8) / 1.4) * Math.PI) : 0;
      model.position.y -= slump * 0.06 * awake;
      if (this.body) this.body.node.rotation.z += slump * 0.05;
      if (this.head) {
        this.head.node.rotation.x += Math.sin(time * 0.85) * 0.022 * awake + wave * 0.06 + slump * 0.12;
        this.head.node.rotation.z += Math.sin(time * 0.6) * 0.018 * awake - slump * 0.20;
      }
      looseThread.rotation.z = Math.sin(time * 2.4) * 0.25 * awake + slump * 0.5;
      for (const limb of this.limbs) {
        if (limb.front && limb.side > 0) {
          limb.node.rotation.z += wave * 0.85;
          limb.node.position.y += wave * 0.15;
        }
      }
      for (const arm of bubuArms) {
        if (arm.side <= 0) continue;
        const elbow = followBeat(time, 7.6, 3.4, 5.8, 0.12);
        const wrist = followBeat(time, 7.6, 3.4, 5.8, 0.24);
        arm.elbow.rotation.z = -arm.side * 0.10 + arm.side * elbow * 0.22;
        arm.wrist.rotation.z = arm.side * wrist * 0.18;
      }
    });
  }


  private clearModel(): void {
    if (this.model) {
      this.root.remove(this.model);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      this.model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        // Blender prototypes are shared across skins; keep them alive.
        if (!object.geometry.userData.shared) geometries.add(object.geometry);
        const addMat = (mat: THREE.Material) => {
          // 轮廓材质是全局共享的，换皮肤时不能 dispose
          if (!mat.userData.shared) materials.add(mat);
        };
        if (Array.isArray(object.material)) {
          for (const mat of object.material) addMat(mat);
        } else {
          addMat(object.material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      this.model.clear();
      this.model = null;
    }
    this.materials.clear();
    this.palette = null;
    this.body = null;
    this.head = null;
    this.tail = null;
    this.ears.length = 0;
    this.eyes.length = 0;
    this.pupils.length = 0;
    this.limbs.length = 0;
    this.customMotions.length = 0;
    this.expressionGroups.clear();
    this.expressionEyes.length = 0;
    this.activeExpression = 'idle';
    this.hasTypingHands = false;
    this.typingPress.left = 0;
    this.typingPress.right = 0;
    this.typingPhase.left = 0;
    this.typingPhase.right = 0;
    this.lastUpdateTime = 0;
  }
}
