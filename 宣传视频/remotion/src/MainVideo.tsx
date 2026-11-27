import React from 'react';
import {
  AbsoluteFill, Img, Audio, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Sequence,
} from 'remotion';
import { C, FONT } from './theme';
import { ASSETS } from './assets';
import { SENTS, SHOTS, FPS } from './data';

const W = 1080;

/* ---------- 通用：极缓相机推进 ---------- */
function useCam(from = 1.0, to = 1.045) {
  const f = useCurrentFrame();
  return interpolate(f, [0, 240], [from, to], { extrapolateRight: 'clamp' });
}

/* ---------- 幕底：暖纸 mesh ---------- */
function Backdrop() {
  const cam = useCam(1.0, 1.03);
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{
        background: `radial-gradient(120% 70% at 20% 8%, ${C.paper2} 0%, transparent 60%),
                     radial-gradient(90% 60% at 90% 92%, #f6e9dd 0%, transparent 55%)`,
        transform: `scale(${cam})`,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: '100%', height: 10,
        background: C.accent, opacity: 0.9,
      }} />
    </AbsoluteFill>
  );
}

/* ---------- 字幕：整句硬现、无标点 ---------- */
function Subtitle({ idx }: { idx: number }) {
  const s = SENTS[idx];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!s) return null;
  const local = f - s.start * fps;
  const op = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const clean = s.text.replace(/[，。：、,.!?！？]/g, '').trim();
  return (
    <div style={{
      position: 'absolute', left: 60, right: 60, bottom: 150,
      textAlign: 'center', opacity: op,
    }}>
      <span style={{
        display: 'inline-block',
        background: 'rgba(251,247,239,0.93)',
        borderRadius: 18,
        padding: '18px 30px',
        fontFamily: FONT, fontSize: 44, fontWeight: 600,
        color: C.ink, lineHeight: 1.45,
        boxShadow: '0 8px 30px rgba(42,37,33,0.08)',
      }}>{clean}</span>
    </div>
  );
}

/* ---------- 素材图：带极缓推拉 ---------- */
function Pet({ id, style, cam = 1.04 }: { id: string; style?: React.CSSProperties; cam?: number }) {
  const s = useCam(1, cam);
  return (
    <Img src={ASSETS[`stills/${id}-pet.png`]}
      style={{ width: '100%', height: '100%', objectFit: 'contain',
               transform: `scale(${s})`, ...style }} />
  );
}

function PetFull({ id }: { id: string }) {
  const s = useCam(1, 1.06);
  return (
    <Img src={ASSETS[`stills/${id}-full.png`]}
      style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${s})` }} />
  );
}

function Page({ name }: { name: string }) {
  const s = useCam(1, 1.035);
  return (
    <div style={{ width: '100%', height: '100%', background: C.card,
                  borderRadius: 24, overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(42,37,33,0.16)',
                  border: `2px solid ${C.line}` }}>
      <Img src={ASSETS[`pages/${name}`]} style={{ width: '100%', height: '100%',
        objectFit: 'contain', transform: `scale(${s})` }} />
    </div>
  );
}

/* ---------- 标题组件 ---------- */
function H1({ children, color = C.ink, size = 92 }: { children: React.ReactNode; color?: string; size?: number }) {
  const f = useCurrentFrame();
  const op = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(f, [0, 14], [40, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, color,
                  lineHeight: 1.15, letterSpacing: -1, opacity: op, transform: `translateY(${y}px)` }}>
      {children}
    </div>
  );
}

function Pill({ children, bg = C.accent, fg = '#fffaf2' }: { children: React.ReactNode; bg?: string; fg?: string }) {
  const f = useCurrentFrame();
  const sc = spring({ frame: f, fps: FPS, config: { damping: 14, stiffness: 120 } });
  return (
    <span style={{ display: 'inline-block', background: bg, color: fg,
      fontFamily: FONT, fontSize: 40, fontWeight: 700,
      padding: '12px 28px', borderRadius: 999,
      transform: `scale(${sc})`, margin: 8 }}>
      {children}
    </span>
  );
}

/* ---------- 各镜头场景 ---------- */
function S01() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 300, width: '100%', textAlign: 'center' }}>
        <H1 size={104}>我的第一款</H1>
        <H1 size={104} color={C.accent}>Vibe Project</H1>
      </div>
      <div style={{ position: 'absolute', top: 700, width: 620, height: 620 }}>
        <Pet id="milkdragon" />
      </div>
      <div style={{ position: 'absolute', bottom: 380, fontFamily: FONT,
        fontSize: 52, fontWeight: 700, color: C.ink }}>DesktopPet</div>
    </AbsoluteFill>
  );
}

function S02() {
  return (
    <AbsoluteFill style={{ padding: 70, paddingTop: 180 }}>
      <H1 size={82}>基于开源项目</H1>
      <H1 size={92} color={C.accent}>二次开发</H1>
      <div style={{ height: 40 }} />
      <div style={{ height: 900 }}>
        <Page name="gh-repo.png" />
      </div>
    </AbsoluteFill>
  );
}

function S03() {
  const items = ['透明置顶', '打字互动', 'OBS 直播源'];
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <H1 size={80}>原项目：KuroCat</H1>
      <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 30 }}>
        {items.map((t, i) => {
          const op = interpolate(f, [10 + i * 30, 24 + i * 30], [0, 1], { extrapolateRight: 'clamp' });
          return (
            <div key={t} style={{ opacity: op, background: C.card, borderRadius: 22,
              padding: '24px 60px', fontFamily: FONT, fontSize: 56, fontWeight: 700,
              color: C.sage, boxShadow: `0 6px 24px rgba(42,37,33,0.08)` }}>
              {t}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 420, fontFamily: FONT,
        fontSize: 38, color: C.inkSoft }}>Rust + Tauri · MIT 开源</div>
    </AbsoluteFill>
  );
}

function S04() {
  const f = useCurrentFrame();
  const sc = spring({ frame: f, fps: FPS, config: { damping: 12, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${sc})`, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontSize: 120, fontWeight: 900, color: C.accent }}>DesktopPet</div>
        <div style={{ fontFamily: FONT, fontSize: 48, color: C.inkSoft, marginTop: 20 }}>
          我自己的桌面宠物版本
        </div>
      </div>
      <div style={{ position: 'absolute', top: 1050, width: 500, height: 500 }}>
        <Pet id="shiba" />
      </div>
    </AbsoluteFill>
  );
}

function Grid({ ids, labels }: { ids: string[]; labels: string[] }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 200 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'repeat(3, 1fr)', gap: 16, height: 1150 }}>
        {ids.map((id, i) => {
          const op = interpolate(f, [i * 8, i * 8 + 14], [0, 1], { extrapolateRight: 'clamp' });
          const y = interpolate(f, [i * 8, i * 8 + 14], [50, 0], { extrapolateRight: 'clamp' });
          return (
            <div key={id} style={{ opacity: op, transform: `translateY(${y}px)`,
              background: C.card, borderRadius: 20, border: `2px solid ${C.line}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <Pet id={id} cam={1.02} />
              </div>
              <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700,
                color: C.ink, padding: '10px 0 16px' }}>{labels[i]}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function S05() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <H1 size={88}>原本只有猫</H1>
      <H1 size={88} color={C.accent}>我加了新动物</H1>
      <div style={{ position: 'absolute', top: 760, width: '100%', display: 'flex',
        justifyContent: 'center', gap: 20 }}>
        {['shiba', 'grasscow', 'milkdragon', 'loopy', 'bubu'].map((id, i) => (
          <div key={id} style={{ width: 180, height: 180, opacity: interpolate(
            useCurrentFrame(), [i * 6, i * 6 + 12], [0, 1], { extrapolateRight: 'clamp' }) }}>
            <Pet id={id} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

const S06 = () => <Grid ids={['shiba','fox','panda','bunny','penguin','frog']}
  labels={['柴犬','小狐狸','熊猫','兔子','企鹅','青蛙']} />;

const S07 = () => <Grid ids={['chiikawa','grasscow','milkdragon','capybara','loopy','bubu']}
  labels={['吉伊卡哇','草地牛','奶龙','水豚噜噜','露比','一二布布']} />;

function S08() {
  const f = useCurrentFrame();
  const drop = interpolate(f % 150, [60, 100], [0, 40], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 180, left: 60, right: 60, height: 1000 }}>
        <Pet id="grasscow" cam={1.06} />
      </div>
      <div style={{ position: 'absolute', top: 300, right: 70, fontFamily: FONT,
        fontSize: 52, fontWeight: 800, color: C.accent, writingMode: 'vertical-rl' }}>
        草叶掉下来
      </div>
      <div style={{ position: 'absolute', top: 760, left: 120, width: 120, height: 8,
        background: C.sage, borderRadius: 8, transform: `translateY(${drop}px) rotate(-20deg)` }} />
      <div style={{ position: 'absolute', top: 210, left: 70, fontFamily: FONT,
        fontSize: 60, fontWeight: 800, color: C.ink }}>草地牛</div>
    </AbsoluteFill>
  );
}

function S09() {
  const f = useCurrentFrame();
  const bounce = Math.sin(f / 6) * 14;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 180, left: 40, right: 40, height: 1000,
        transform: `translateY(${bounce}px)` }}>
        <Pet id="milkdragon" cam={1.05} />
      </div>
      <div style={{ position: 'absolute', top: 210, left: 70, fontFamily: FONT,
        fontSize: 60, fontWeight: 800, color: C.accent }}>奶龙</div>
      <div style={{ position: 'absolute', bottom: 400, left: 70, fontFamily: FONT,
        fontSize: 44, fontWeight: 700, color: C.ink }}>大脑袋 · 弹肚腩 · 喷火苗</div>
    </AbsoluteFill>
  );
}

function S10() {
  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 200 }}>
      <H1 size={84}>Blender 专属网格</H1>
      <div style={{ height: 36 }} />
      <div style={{ height: 950, background: C.card, borderRadius: 24,
        border: `2px solid ${C.line}`, overflow: 'hidden' }}>
        <Img src={ASSETS['stills/milkdragon-full.png']}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 330, left: 70, fontFamily: FONT,
        fontSize: 40, fontWeight: 700, color: C.sage }}>
        镰刀 · 呆毛 · 纽扣眼，都是单独建的
      </div>
    </AbsoluteFill>
  );
}

function S11() {
  const f = useCurrentFrame();
  const items = ['喂食', '喝水', '玩耍', '洗澡'];
  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 180 }}>
      <H1 size={80} color={C.accent}>不只好看</H1>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
        {items.map((t, i) => (
          <div key={t} style={{ opacity: interpolate(f, [i * 8, i * 8 + 12], [0, 1], { extrapolateRight: 'clamp' }) }}>
            <Pill>{t}</Pill>
          </div>
        ))}
      </div>
      <div style={{ height: 40 }} />
      <div style={{ height: 900, display: 'flex', gap: 20 }}>
        <div style={{ flex: 1, background: C.card, borderRadius: 22, border: `2px solid ${C.line}`, overflow: 'hidden' }}>
          <Img src={ASSETS['pages/gh-repo.png']} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 330, left: 70, fontFamily: FONT,
        fontSize: 42, fontWeight: 700, color: C.ink }}>五维状态 · 饿了渴了会提醒</div>
    </AbsoluteFill>
  );
}

function S12() {
  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 200 }}>
      <H1 size={80}>3 款配色键盘</H1>
      <H1 size={80} color={C.sage}>自动更新</H1>
      <div style={{ height: 40 }} />
      <div style={{ height: 850, background: C.card, borderRadius: 24,
        border: `2px solid ${C.line}`, padding: 20 }}>
        <Img src={ASSETS['stills/shiba-full.png']}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    </AbsoluteFill>
  );
}

function S13() {
  return (
    <AbsoluteFill style={{ padding: 60, paddingTop: 180 }}>
      <H1 size={84}>下载很简单</H1>
      <H1 size={76} color={C.accent}>GitHub 链接直接下</H1>
      <div style={{ height: 36 }} />
      <div style={{ height: 900, position: 'relative' }}>
        <Page name="gh-release.png" />
        <div style={{ position: 'absolute', bottom: 60, left: 40, right: 40,
          background: C.accent, color: '#fffaf2', fontFamily: FONT,
          fontSize: 40, fontWeight: 800, textAlign: 'center',
          padding: '20px 24px', borderRadius: 18 }}>
          绿色版 · 免安装
        </div>
      </div>
    </AbsoluteFill>
  );
}

function S14() {
  const f = useCurrentFrame();
  const prompt = '帮我下载 DesktopPet 的绿色版';
  const shown = prompt.slice(0, Math.floor(interpolate(f, [10, 80], [0, prompt.length], { extrapolateRight: 'clamp' })));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <H1 size={80}>或者发给 AI 一句话</H1>
      <div style={{ marginTop: 60, background: C.ink, borderRadius: 24,
        padding: '50px 46px', width: '100%', minHeight: 300 }}>
        <div style={{ fontFamily: FONT, fontSize: 46, color: '#fffaf2', lineHeight: 1.6 }}>
          {shown}<span style={{ opacity: f % 20 < 10 ? 1 : 0 }}>|</span>
        </div>
      </div>
      <div style={{ marginTop: 50, fontFamily: FONT, fontSize: 46,
        fontWeight: 700, color: C.sage }}>它自己去仓库取</div>
    </AbsoluteFill>
  );
}

function S15() {
  const f = useCurrentFrame();
  const items = ['第一款 Vibe 项目', '照大家的意见更新', '更多动物与新玩法'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <H1 size={84}>功能还不完美</H1>
      <H1 size={84} color={C.accent}>我会一直更新</H1>
      <div style={{ marginTop: 70, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {items.map((t, i) => (
          <div key={t} style={{ opacity: interpolate(f, [i * 26, i * 26 + 16], [0, 1], { extrapolateRight: 'clamp' }),
            fontFamily: FONT, fontSize: 50, fontWeight: 700, color: C.ink,
            background: C.card, borderRadius: 18, padding: '20px 44px',
            borderLeft: `8px solid ${C.sage}` }}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function S16() {
  const f = useCurrentFrame();
  const sc = spring({ frame: f, fps: FPS, config: { damping: 14, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${sc})`, fontFamily: FONT,
        fontSize: 120, fontWeight: 900, color: C.accent }}>DesktopPet</div>
      <div style={{ marginTop: 30, fontFamily: FONT, fontSize: 66,
        fontWeight: 800, color: C.ink }}>想养一只？评论区见</div>
      <div style={{ position: 'absolute', bottom: 340, width: '100%', height: 560,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginLeft: -30 }}>
        {['grasscow','milkdragon','chiikawa','loopy','bubu'].map((id, i) => (
          <div key={id} style={{ width: 230, height: 560,
            transform: `translateY(${Math.abs(i - 2) * 28}px)` }}>
            <Pet id={id} cam={1.0} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

const SCENES: Record<number, React.FC> = {
  0: S01, 1: S02, 2: S03, 3: S04, 4: S05, 5: S06, 6: S07, 7: S08,
  8: S09, 9: S10, 10: S11, 11: S12, 12: S13, 13: S14, 14: S15, 15: S16,
};

export const MainVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const idx = SHOTS.findIndex((s) => t >= s.start && t < s.end);
  const shot = idx >= 0 ? idx : SHOTS.length - 1;
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Audio src={ASSETS['narration.mp3']} />
      <Backdrop />
      {SHOTS.map((s, i) => {
        const Scene = SCENES[i] ?? S01;
        const from = Math.round(s.start * fps);
        const dur = Math.round((s.end - s.start) * fps);
        return (
          <Sequence key={s.id} from={from} durationInFrames={dur} layout="none">
            <Scene />
          </Sequence>
        );
      })}
      <Subtitle idx={shot} />
    </AbsoluteFill>
  );
};
