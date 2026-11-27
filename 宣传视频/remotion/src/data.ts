import timing from './timing.json';

export type Sent = { i: number; text: string; start: number; end: number };

export const SENTS: Sent[] = (timing as any).scenes.map((s: any, i: number) => ({
  i,
  text: s.text ?? '',
  start: s.startSec,
  end: s.startSec + s.durationSec,
}));

export const FPS = 30;
export const DURATION = Math.ceil(((timing as any).totalSec ?? 107.5) * FPS);

// 镜头边界（秒），与 SHOTBOOK §1 一致
export const SHOTS: { id: string; start: number; end: number }[] = [
  { id: 's01', start: 0, end: 5.21 },
  { id: 's02', start: 5.21, end: 11.14 },
  { id: 's03', start: 11.14, end: 21.12 },
  { id: 's04', start: 21.12, end: 26.71 },
  { id: 's05', start: 26.71, end: 30.31 },
  { id: 's06', start: 30.31, end: 38.83 },
  { id: 's07', start: 38.83, end: 46.82 },
  { id: 's08', start: 46.82, end: 52.15 },
  { id: 's09', start: 52.15, end: 58.01 },
  { id: 's10', start: 58.01, end: 65.43 },
  { id: 's11', start: 65.43, end: 73.83 },
  { id: 's12', start: 73.83, end: 80.74 },
  { id: 's13', start: 80.74, end: 88.37 },
  { id: 's14', start: 88.37, end: 95.04 },
  { id: 's15', start: 95.04, end: 101.21 },
  { id: 's16', start: 101.21, end: 107.5 },
];

export const at = (t: number) => SHOTS.findIndex((s) => t >= s.start && t < s.end);
