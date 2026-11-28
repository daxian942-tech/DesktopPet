/**
 * 跳跃状态机：鼠标按住桌宠往下拖 = 蓄力，松手 = 起跳。
 *
 * 这里只负责物理与姿态，输出与渲染引擎无关的归一化数值，由 2D / 3D 引擎
 * 各自换算成逻辑像素 / 世界单位。猫咪、大肥鱼皮肤和 12 只独立动物共用
 * 同一套状态机，因此切物种、切 2D/3D 模式时跳跃行为完全一致。
 *
 * 相位流转：idle -> charging -> rising -> falling -> landing -> idle
 *
 * 2026-11-28 修正「跳跃不好触发」：
 *  - 允许在任意相位重新蓄力（空中再往下拖也能接上下一跳），不再吞掉手势；
 *  - 从空中打断时用残余高度快速衰减，避免角色瞬间掉地显得抽搐；
 *  - 蓄力影响跳跃高度，但设 0.72 下限，保证「轻拖一下」也有明显起跳。
 */

export type JumpPhase = 'idle' | 'charging' | 'rising' | 'falling' | 'landing';

export interface JumpPose {
  /** 当前相位 */
  phase: JumpPhase;
  /** 非 idle 即为 true，引擎可据此跳过多余的变换计算 */
  active: boolean;
  /** 平滑后的蓄力值 0..1 */
  charge: number;
  /** 归一化离地高度 0..1，1 = 抛物线顶点 */
  lift: number;
  /** 蓄力下蹲量 0..1 */
  crouch: number;
  /** 水平 / 垂直挤压拉伸倍数（以脚底为轴心） */
  squashX: number;
  squashY: number;
  /** 轻微前后倾，弧度 */
  tilt: number;
  /** 地面影子随高度缩小 / 变淡 */
  shadowScale: number;
  shadowAlpha: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const IDLE_POSE: JumpPose = {
  phase: 'idle',
  active: false,
  charge: 0,
  lift: 0,
  crouch: 0,
  squashX: 1,
  squashY: 1,
  tilt: 0,
  shadowScale: 1,
  shadowAlpha: 1,
};

export class JumpMotion {
  private phase: JumpPhase = 'idle';
  private chargeTarget = 0;
  private chargeSmooth = 0;
  private power = 0;
  private phaseT = 0;
  private duration = 0.55;
  private clock = 0;
  /** 截图定格用：冻结相位推进，但仍输出当前姿态 */
  private frozen = false;
  /** 从空中打断进入蓄力时的残余离地高度，按指数快速衰减，避免瞬间掉地抽搐 */
  private entryLift = 0;
  /** 复用同一个对象，避免每帧分配 */
  private readonly pose: JumpPose = { ...IDLE_POSE };

  get isCharging(): boolean {
    return this.phase === 'charging';
  }

  get isActive(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * 进入蓄力。允许在任意相位重新开始：空中再次往下拖也能接上下一跳，
   * 不再把「还在空中」的手势直接丢掉。从空中打断时保留一点残余高度并
   * 快速衰减，避免角色瞬间掉地显得抽搐。
   */
  public beginCharge(): void {
    const u = clamp01(this.phaseT / this.duration);
    this.entryLift =
      this.phase === 'rising' || this.phase === 'falling'
        ? Math.max(0, 4 * u * (1 - u))
        : 0;
    this.frozen = false;
    this.phase = 'charging';
    this.chargeTarget = 0;
    this.chargeSmooth = 0;
    this.phaseT = 0;
  }

  /** 由主窗口根据「往下拖的距离 + 按住时长」设置蓄力 0..1 */
  public setCharge(amt: number): void {
    if (this.phase !== 'charging') return;
    this.chargeTarget = clamp01(amt);
  }

  /** 松手起跳：蓄得越满，跳得越高、滞空越久 */
  public release(): void {
    if (this.phase !== 'charging') return;
    const c = Math.max(this.chargeSmooth, this.chargeTarget * 0.9);
    this.power = clamp01(0.3 + c * 0.7);
    this.duration = 0.4 + this.power * 0.28;
    this.phaseT = 0;
    this.entryLift = 0;
    this.phase = 'rising';
    this.chargeTarget = 0;
    this.frozen = false;
  }

  /** 手势被改判（例如右键菜单、切窗口）时柔和收势，不做突兀回位 */
  public cancel(): void {
    if (this.phase === 'idle') return;
    this.frozen = false;
    this.chargeTarget = 0;
    this.entryLift = 0;
    this.phaseT = 0;
    this.phase = 'landing';
  }

  public update(dt: number): JumpPose {
    const d = Math.min(0.05, Math.max(0, dt));
    if (!this.frozen) this.clock += d;

    switch (this.phase) {
      case 'idle':
        this.chargeSmooth = 0;
        this.entryLift = 0;
        return IDLE_POSE;
      case 'charging':
        if (!this.frozen) {
          this.phaseT += d;
          this.entryLift *= Math.exp(-14 * d);
          if (this.entryLift < 0.002) this.entryLift = 0;
          this.chargeSmooth +=
            (this.chargeTarget - this.chargeSmooth) * (1 - Math.exp(-16 * d));
        }
        break;
      case 'rising':
      case 'falling':
        if (!this.frozen) {
          this.phaseT += d;
          const u = this.phaseT / this.duration;
          if (u >= 1) {
            this.phase = 'landing';
            this.phaseT = 0;
          } else {
            this.phase = u < 0.5 ? 'rising' : 'falling';
          }
        }
        break;
      case 'landing':
        if (!this.frozen) {
          this.phaseT += d;
          if (this.phaseT >= 0.26) {
            this.phase = 'idle';
            this.phaseT = 0;
            this.chargeSmooth = 0;
            this.entryLift = 0;
            return IDLE_POSE;
          }
        }
        break;
    }

    return this.compose();
  }

  /** 预览 / 无头截图定格：charge | air | land，amt 为力度 0..1 */
  public preview(kind: 'charge' | 'air' | 'land', amt = 1): void {
    const a = clamp01(amt);
    this.frozen = true;
    this.entryLift = 0;
    if (kind === 'charge') {
      this.phase = 'charging';
      this.chargeTarget = a;
      this.chargeSmooth = a;
      this.phaseT = 0;
    } else if (kind === 'air') {
      this.phase = 'rising';
      this.power = 0.35 + a * 0.65;
      this.duration = 0.4 + this.power * 0.28;
      this.phaseT = this.duration * 0.42;
      this.chargeTarget = 0;
      this.chargeSmooth = 0;
    } else {
      this.phase = 'landing';
      this.phaseT = 0.045;
      this.chargeTarget = 0;
      this.chargeSmooth = 0;
    }
  }

  private compose(): JumpPose {
    const p = this.pose;
    p.phase = this.phase;
    p.active = true;
    p.charge = this.chargeSmooth;
    p.shadowScale = 1;
    p.shadowAlpha = 1;
    p.tilt = 0;

    if (this.phase === 'charging') {
      const c = this.chargeSmooth;
      p.lift = this.entryLift;
      p.crouch = c;
      p.squashY = 1 - 0.2 * c;
      p.squashX = 1 + 0.11 * c;
      // 蓄满时有极轻微的发力抖动，避免像静态压扁
      p.tilt = 0.018 * c + Math.sin(this.clock * 26) * 0.008 * c;
      p.shadowScale = 1 - 0.08 * c - 0.32 * p.lift;
      p.shadowAlpha = 1 - 0.12 * c - 0.4 * p.lift;
      return p;
    }

    if (this.phase === 'rising' || this.phase === 'falling') {
      const u = clamp01(this.phaseT / this.duration);
      // 蓄力越满跳得越高；0.72 下限保证「轻拖一下」也有明显起跳
      const height = 0.72 + 0.28 * this.power;
      p.lift = Math.max(0, 4 * u * (1 - u)) * height;
      p.crouch = 0;
      // 起跳瞬间纵向拉伸，快落地时预压扁
      const stretch = Math.exp(-u * 9);
      const preLand = u > 0.82 ? (u - 0.82) / 0.18 : 0;
      p.squashY = 1 + 0.17 * stretch - 0.07 * preLand;
      p.squashX = 1 - 0.085 * stretch + 0.035 * preLand;
      p.tilt = Math.sin(u * Math.PI) * 0.055 * (0.4 + this.power * 0.6);
      p.shadowScale = 1 - 0.42 * p.lift;
      p.shadowAlpha = 1 - 0.55 * p.lift;
      return p;
    }

    // landing：脚底着地后的阻尼回弹
    const u = clamp01(this.phaseT / 0.26);
    const bounce = Math.exp(-9 * u) * Math.sin(u * 20);
    p.lift = 0;
    p.crouch = 0;
    p.squashY = 1 - 0.17 * bounce;
    p.squashX = 1 + 0.085 * bounce;
    return p;
  }
}
