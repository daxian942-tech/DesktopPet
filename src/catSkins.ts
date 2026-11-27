/** Species drives structural body/head/muzzle geometry — not just colors. */
export type AnimalSpecies =
  | 'cat'
  | 'dog'
  | 'fox'
  | 'panda'
  | 'bunny'
  | 'penguin'
  | 'frog'
  | 'chiikawa'
  | 'grasscow'
  | 'milkdragon'
  | 'capybara'
  | 'loopy'
  | 'bubu';

export interface CatSpot {
  part: 'head' | 'body' | 'leftArm' | 'rightArm';
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation?: number;
  color: string;
  opacity?: number;
}

export type CatPattern = 'solid' | 'bicolor' | 'tuxedo' | 'tabby' | 'calico' | 'siamese';
export type CatFaceShape = 'round' | 'square' | 'wide' | 'fox' | 'oval';
export type CatEarShape = 'cat' | 'round' | 'tall' | 'small' | 'wide' | 'folded' | 'floppy' | 'horn';
export type CatPupilShape = 'oval' | 'round' | 'slit' | 'dot' | 'star';
export type CatNoseShape = 'cat' | 'round' | 'wide' | 'small' | 'none';
export type CatMouthShape = 'w' | 'smile' | 'flat' | 'open' | 'blep' | 'none';
export type CatEyebrowStyle = 'none' | 'soft' | 'thick' | 'angry' | 'worried';

export interface CatContourResolved {
  faceShape: CatFaceShape;
  headWidth: number;
  jawSquareness: number;
  earShape: CatEarShape;
  earScale: number;
  earSpacing: number;
  earTilt: number;
  eyeSquint: number;
  eyeScale: number;
  eyeAspect: number;
  eyeSpacing: number;
  eyeOffsetY: number;
  eyeTilt: number;
  pupilShape: CatPupilShape;
  pupilScale: number;
  noseShape: CatNoseShape;
  noseScale: number;
  noseOffsetY: number;
  mouthShape: CatMouthShape;
  mouthScale: number;
  mouthOffsetY: number;
  whiskerLength: number;
  eyebrowStyle: CatEyebrowStyle;
  blushAlways: boolean;
  blushScale: number;
  bodyChubbiness: number;
}

export interface CatSkinConfig {
  id: string;
  name: string;
  emoji?: string;
  builtin?: boolean;

  furColor: string;
  furSecondaryColor?: string;
  outlineColor?: string;
  legLineColor?: string;

  pattern?: CatPattern;
  maskColor?: string;
  foreheadBridgeColor?: string;
  flankColor?: string;
  bellyBibColor?: string;
  stripeColor?: string;
  calicoPatchColor?: string;

  earOuterColor?: string;
  earTipColor?: string;
  earInnerColor?: string;
  earTuftColor?: string;

  tailColor?: string;
  tailTipColor?: string;
  tailFluffy?: boolean;
  tailStripes?: boolean;

  eyeColorTop: string;
  eyeColorBottom?: string;
  pupilColor?: string;
  eyeCatchlight?: boolean;
  eyeRimColor?: string;
  squintColor?: string;
  squintGlowColor?: string;
  noseColor?: string;
  mouthColor?: string;
  blushColor?: string;
  whiskerColor?: string;

  armColor?: string;
  pawColor?: string;
  pawOutlineColor?: string;
  armCreaseColor?: string;

  accentColor?: string;
  accentSideColor?: string;

  // Optional contour & full facial sculpting overrides (v1.0.0+)
  faceShape?: CatFaceShape;
  headWidth?: number;
  jawSquareness?: number;
  earShape?: CatEarShape;
  earScale?: number;
  earSpacing?: number;
  earTilt?: number;
  eyeSquint?: number;
  eyeScale?: number;
  eyeAspect?: number;
  eyeSpacing?: number;
  eyeOffsetY?: number;
  eyeTilt?: number;
  pupilShape?: CatPupilShape;
  pupilScale?: number;
  rightEyeColorTop?: string;
  rightEyeColorBottom?: string;
  noseShape?: CatNoseShape;
  noseScale?: number;
  noseOffsetY?: number;
  mouthShape?: CatMouthShape;
  mouthScale?: number;
  mouthOffsetY?: number;
  whiskerLength?: number;
  eyebrowStyle?: CatEyebrowStyle;
  eyebrowColor?: string;
  blushAlways?: boolean;
  blushScale?: number;
  bodyChubbiness?: number;

  /** Species-level structural shape. Defaults to 'cat' (original silhouette untouched). */
  species?: AnimalSpecies;

  /** Muzzle (snout) protrusion 0..1. Non-cat species render a real 3D snout. */
  muzzleLength?: number;
  muzzleWidth?: number;
  muzzleColor?: string;

  spots?: CatSpot[];
}

export interface ResolvedSkin {
  id: string;
  name: string;
  isDarkBase: boolean;
  furColor: string;
  furSecondaryColor: string;
  outlineColor: string | null;
  legLineColor: string;
  pattern: CatPattern;
  maskColor: string | null;
  foreheadBridgeColor: string | null;
  flankColor: string | null;
  bellyBibColor: string | null;
  stripeColor: string | null;
  calicoPatchColor: string | null;
  earOuterColor: string;
  earTipColor: string | null;
  earInnerColor: string | null;
  earTuftColor: string | null;
  tailColor: string;
  tailTipColor: string;
  tailFluffy: boolean;
  tailStripes: boolean;
  eyeColorTop: string;
  eyeColorBottom: string;
  rightEyeColorTop: string;
  rightEyeColorBottom: string;
  pupilColor: string;
  eyeCatchlight: boolean;
  eyeRimColor: string | null;
  squintColor: string;
  squintGlowColor: string | null;
  noseColor: string | null;
  mouthColor: string | null;
  blushColor: string | null;
  whiskerColor: string;
  eyebrowColor: string;
  armColor: string;
  pawColor: string;
  pawOutlineColor: string | null;
  armCreaseColor: string | null;
  accentColor: string;
  accentSideColor: string;
  contour: CatContourResolved;
  species: AnimalSpecies;
  muzzleLength: number;
  muzzleWidth: number;
  muzzleColor: string | null;
  spots: CatSpot[];
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function resolveCatContour(raw?: Partial<CatSkinConfig> | null): CatContourResolved {
  const fsRaw = (raw?.faceShape || 'round').toLowerCase();
  const faceShape: CatFaceShape =
    fsRaw === 'square' || fsRaw === 'wide' || fsRaw === 'fox' || fsRaw === 'oval'
      ? fsRaw
      : 'round';

  const esRaw = (raw?.earShape || 'cat').toLowerCase();
  const earShape: CatEarShape =
    esRaw === 'round' ||
    esRaw === 'tall' ||
    esRaw === 'small' ||
    esRaw === 'wide' ||
    esRaw === 'folded' ||
    esRaw === 'floppy'
      ? esRaw
      : 'cat';

  const psRaw = (raw?.pupilShape || 'oval').toLowerCase();
  const pupilShape: CatPupilShape =
    psRaw === 'round' || psRaw === 'slit' || psRaw === 'dot' || psRaw === 'star'
      ? psRaw
      : 'oval';

  const nsRaw = (raw?.noseShape || 'cat').toLowerCase();
  const noseShape: CatNoseShape =
    nsRaw === 'round' || nsRaw === 'wide' || nsRaw === 'small' || nsRaw === 'none'
      ? nsRaw
      : 'cat';

  const msRaw = (raw?.mouthShape || 'w').toLowerCase();
  const mouthShape: CatMouthShape =
    msRaw === 'smile' || msRaw === 'flat' || msRaw === 'open' || msRaw === 'blep' || msRaw === 'none'
      ? msRaw
      : 'w';

  const ebRaw = (raw?.eyebrowStyle || 'none').toLowerCase();
  const eyebrowStyle: CatEyebrowStyle =
    ebRaw === 'soft' || ebRaw === 'thick' || ebRaw === 'angry' || ebRaw === 'worried'
      ? ebRaw
      : 'none';

  const numOr = (val: number | undefined, lo: number, hi: number, fallback: number): number =>
    typeof val === 'number' && Number.isFinite(val) ? clampNum(val, lo, hi) : fallback;

  const defaultHeadWidth =
    faceShape === 'square'
      ? 1.14
      : faceShape === 'wide'
        ? 1.12
        : faceShape === 'fox'
          ? 0.98
          : faceShape === 'oval'
            ? 0.93
            : 1.0;

  const defaultJawSquareness =
    faceShape === 'square' ? 0.88 : faceShape === 'wide' ? 0.36 : 0.0;

  return {
    faceShape,
    headWidth: numOr(raw?.headWidth, 0.78, 1.32, defaultHeadWidth),
    jawSquareness: numOr(raw?.jawSquareness, 0.0, 1.0, defaultJawSquareness),
    earShape,
    earScale: numOr(raw?.earScale, 0.55, 1.55, 1.0),
    earSpacing: numOr(raw?.earSpacing, 0.70, 1.35, 1.0),
    earTilt: numOr(raw?.earTilt, -0.45, 0.65, 0.0),
    eyeSquint: numOr(raw?.eyeSquint, 0.0, 0.75, 0.0),
    eyeScale: numOr(raw?.eyeScale, 0.55, 1.45, 1.0),
    eyeAspect: numOr(raw?.eyeAspect, 0.60, 1.40, 1.0),
    eyeSpacing: numOr(raw?.eyeSpacing, 0.72, 1.35, 1.0),
    eyeOffsetY: numOr(raw?.eyeOffsetY, -1.0, 1.0, 0.0),
    eyeTilt: numOr(raw?.eyeTilt, -0.50, 0.50, 0.0),
    pupilShape,
    pupilScale: numOr(raw?.pupilScale, 0.40, 1.45, 1.0),
    noseShape,
    noseScale: numOr(raw?.noseScale, 0.50, 1.80, 1.0),
    noseOffsetY: numOr(raw?.noseOffsetY, -1.0, 1.0, 0.0),
    mouthShape,
    mouthScale: numOr(raw?.mouthScale, 0.55, 1.70, 1.0),
    mouthOffsetY: numOr(raw?.mouthOffsetY, -1.0, 1.0, 0.0),
    whiskerLength: numOr(raw?.whiskerLength, 0.0, 1.60, 1.0),
    eyebrowStyle,
    blushAlways: Boolean(raw?.blushAlways),
    blushScale: numOr(raw?.blushScale, 0.50, 1.60, 1.0),
    bodyChubbiness: numOr(raw?.bodyChubbiness, 0.80, 1.25, 1.0),
  };
}

function parseHexLuminance(hex: string): number {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return 0.5;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isLightColor(hex: string): boolean {
  return parseHexLuminance(hex) > 0.48;
}

export function resolveCustomSkin(raw: CatSkinConfig): ResolvedSkin {
  const fur = raw.furColor || '#f2a452';
  const darkBase = !isLightColor(fur);
  const pattern: CatPattern = raw.pattern || 'solid';
  const defaultOutline = darkBase ? null : '#524840';
  const outlineColor = raw.outlineColor !== undefined ? (raw.outlineColor || null) : defaultOutline;
  const pawColor = raw.pawColor || (pattern === 'tuxedo' ? '#faf9f5' : fur);
  const armColor = raw.armColor || fur;
  const pawIsLight = isLightColor(pawColor);

  return {
    id: raw.id,
    name: raw.name || raw.id,
    isDarkBase: darkBase,
    furColor: fur,
    furSecondaryColor: raw.furSecondaryColor || fur,
    outlineColor,
    legLineColor:
      raw.legLineColor || (darkBase ? 'rgba(214, 218, 224, 0.62)' : 'rgba(82, 72, 64, 0.62)'),
    pattern,
    maskColor: raw.maskColor || (pattern === 'siamese' ? '#4a382c' : pattern === 'bicolor' ? '#9e8e7f' : null),
    foreheadBridgeColor: raw.foreheadBridgeColor || null,
    flankColor: raw.flankColor || null,
    bellyBibColor:
      raw.bellyBibColor || (pattern === 'tuxedo' ? '#faf9f5' : null),
    stripeColor:
      raw.stripeColor || (pattern === 'tabby' ? '#9e5318' : null),
    calicoPatchColor:
      raw.calicoPatchColor || (pattern === 'calico' ? '#3a3533' : null),
    earOuterColor: raw.earOuterColor || raw.maskColor || fur,
    earTipColor: raw.earTipColor || null,
    earInnerColor: raw.earInnerColor || (darkBase ? null : '#efc4c8'),
    earTuftColor: raw.earTuftColor || null,
    tailColor: raw.tailColor || raw.earOuterColor || raw.maskColor || fur,
    tailTipColor: raw.tailTipColor || raw.earTipColor || raw.tailColor || fur,
    tailFluffy: Boolean(raw.tailFluffy),
    tailStripes: Boolean(raw.tailStripes || pattern === 'tabby'),
    eyeColorTop: raw.eyeColorTop || '#5a94d6',
    eyeColorBottom: raw.eyeColorBottom || raw.eyeColorTop || '#a3d2f2',
    rightEyeColorTop: raw.rightEyeColorTop || raw.eyeColorTop || '#5a94d6',
    rightEyeColorBottom:
      raw.rightEyeColorBottom ||
      raw.rightEyeColorTop ||
      raw.eyeColorBottom ||
      raw.eyeColorTop ||
      '#a3d2f2',
    pupilColor: raw.pupilColor || '#10141e',
    eyeCatchlight: raw.eyeCatchlight ?? !darkBase,
    eyeRimColor: raw.eyeRimColor || (darkBase ? null : 'rgba(42, 46, 58, 0.78)'),
    squintColor: raw.squintColor || (darkBase ? raw.eyeColorTop || '#d4f044' : '#2c2928'),
    squintGlowColor: raw.squintGlowColor || null,
    noseColor: raw.noseColor !== undefined ? (raw.noseColor || null) : (darkBase ? null : '#ee8e9e'),
    mouthColor: raw.mouthColor || (darkBase ? null : 'rgba(72, 68, 76, 0.78)'),
    blushColor: raw.blushColor || (darkBase ? null : '#f492a6'),
    whiskerColor:
      raw.whiskerColor || (darkBase ? 'rgba(210, 214, 220, 0.56)' : 'rgba(84, 76, 70, 0.56)'),
    eyebrowColor: raw.eyebrowColor || (darkBase ? '#e8e2d4' : outlineColor || '#4a3d35'),
    armColor,
    pawColor,
    pawOutlineColor:
      raw.pawOutlineColor !== undefined
        ? (raw.pawOutlineColor || null)
        : (pawIsLight ? outlineColor || '#524840' : null),
    armCreaseColor:
      raw.armCreaseColor !== undefined
        ? (raw.armCreaseColor || null)
        : (!pawIsLight ? 'rgba(216, 218, 222, 0.62)' : null),
    accentColor: raw.accentColor || '#d2f244',
    accentSideColor: raw.accentSideColor || '#8cb014',
    contour: resolveCatContour(raw),
    species: resolveSpecies(raw.species),
    muzzleLength: clampNum(raw.muzzleLength ?? defaultMuzzleLength(raw.species), 0, 1),
    muzzleWidth: clampNum(raw.muzzleWidth ?? 0.62, 0.3, 1.2),
    muzzleColor: raw.muzzleColor || null,
    spots: Array.isArray(raw.spots) ? raw.spots : [],
  };
}

const SPECIES_SET = new Set<string>([
  'dog',
  'fox',
  'panda',
  'bunny',
  'penguin',
  'frog',
  'chiikawa',
  'grasscow',
  'milkdragon',
  'capybara',
  'loopy',
  'bubu',
]);

export function resolveSpecies(raw?: AnimalSpecies | string | null): AnimalSpecies {
  const s = String(raw || 'cat').toLowerCase();
  return SPECIES_SET.has(s) ? (s as AnimalSpecies) : 'cat';
}

export function defaultMuzzleLength(raw?: AnimalSpecies | string | null): number {
  switch (String(raw || 'cat').toLowerCase()) {
    case 'dog': return 0.78;
    case 'fox': return 0.9;
    case 'panda': return 0.5;
    case 'bunny': return 0.4;
    case 'penguin': return 0.66; // beak
    case 'frog': return 0.0;
    case 'grasscow': return 0.42; // broad bovine muzzle
    case 'capybara': return 0.34; // blocky capybara snout
    case 'milkdragon': return 0.22; // small round dragon snout
    case 'chiikawa': return 0.0; // flat chubby face
    case 'loopy': return 0.0; // flat pink face
    case 'bubu': return 0.12;
    default: return 0.0; // cat: flat face, no protruding snout
  }
}

export const DEFAULT_BUILTIN_CATS: CatSkinConfig[] = [
  {
    id: 'black',
    name: '小黑猫',
    emoji: '🐈‍⬛',
    builtin: true,
    furColor: '#141314',
    eyeColorTop: '#d4f044',
    accentColor: '#d2f244',
    accentSideColor: '#8cb014',
  },
  {
    id: 'ragdoll',
    name: '布偶猫',
    emoji: '🐱',
    builtin: true,
    furColor: '#fbf9f3',
    eyeColorTop: '#2c5594',
    accentColor: '#7ac7ff',
    accentSideColor: '#4690d8',
  },
  {
    id: 'dafeiyu',
    name: '大肥鱼',
    emoji: '🐳',
    builtin: true,
    furColor: '#2957a4',
    eyeColorTop: '#2563eb',
    accentColor: '#5cc8ff',
    accentSideColor: '#2563eb',
  },
  // ---- Non-cat animals (whiskerLength: 0 hides whiskers) ----
  {
    id: 'shiba',
    species: 'dog',
    name: '柴犬',
    emoji: '🐕',
    builtin: true,
    furColor: '#d98b3f',
    eyeColorTop: '#5a3a1e',
    pattern: 'solid',
    bellyBibColor: '#f6e8d2',
    pawColor: '#f6e8d2',
    earOuterColor: '#b25e22',
    faceShape: 'wide',
    jawSquareness: 0.45,
    earShape: 'tall',
    earScale: 1.08,
    pupilShape: 'round',
    eyeTilt: -0.16,
    noseShape: 'round',
    noseColor: '#26211f',
    mouthShape: 'smile',
    whiskerLength: 0,
    tailFluffy: true,
    tailTipColor: '#f6e8d2',
    accentColor: '#ffb347',
    accentSideColor: '#cc7a16',
  },
  {
    id: 'fox',
    species: 'fox',
    name: '小狐狸',
    emoji: '🦊',
    builtin: true,
    furColor: '#e07b39',
    eyeColorTop: '#c8912a',
    pattern: 'solid',
    bellyBibColor: '#fdf6e8',
    pawColor: '#3a261c',
    faceShape: 'fox',
    jawSquareness: 0.88,
    earShape: 'tall',
    earScale: 1.22,
    earTilt: 0.12,
    earTipColor: '#3a261c',
    pupilShape: 'slit',
    eyeSquint: 0.42,
    eyeTilt: 0.28,
    noseShape: 'wide',
    noseColor: '#2b211c',
    mouthShape: 'flat',
    whiskerLength: 0,
    tailFluffy: true,
    tailTipColor: '#fdf6e8',
    accentColor: '#ff9d4d',
    accentSideColor: '#c96a2b',
  },
  {
    id: 'panda',
    species: 'panda',
    name: '熊猫',
    emoji: '🐼',
    builtin: true,
    furColor: '#f7f7f2',
    eyeColorTop: '#f7f7f2',
    pupilColor: '#111113',
    pupilShape: 'round',
    earOuterColor: '#1c1c1e',
    earScale: 0.78,
    noseShape: 'round',
    noseColor: '#1c1c1e',
    mouthShape: 'flat',
    whiskerLength: 0,
    armColor: '#1c1c1e',
    pawColor: '#1c1c1e',
    outlineColor: '#2c2c30',
    spots: [
      { part: 'head', x: -0.34, y: -0.12, rx: 21, ry: 26, rotation: -0.2, color: '#1c1c1e', opacity: 0.92 },
      { part: 'head', x: 0.34, y: -0.12, rx: 21, ry: 26, rotation: 0.2, color: '#1c1c1e', opacity: 0.92 },
    ],
    accentColor: '#7ec850',
    accentSideColor: '#3f8a2a',
  },
  {
    id: 'bunny',
    species: 'bunny',
    name: '兔子',
    emoji: '🐰',
    builtin: true,
    furColor: '#f4ece6',
    eyeColorTop: '#6b4a3a',
    earOuterColor: '#f4ece6',
    earInnerColor: '#f2b8c6',
    earTipColor: '#f2b8c6',
    earShape: 'tall',
    earScale: 1.55,
    earSpacing: 0.86,
    faceShape: 'oval',
    pupilShape: 'round',
    noseShape: 'small',
    noseColor: '#f08a9e',
    mouthShape: 'w',
    whiskerLength: 0,
    blushColor: '#f4b0bc',
    tailFluffy: true,
    tailTipColor: '#ffffff',
    accentColor: '#f4a9c0',
    accentSideColor: '#d97a9c',
  },
  {
    id: 'penguin',
    species: 'penguin',
    name: '企鹅',
    emoji: '🐧',
    builtin: true,
    furColor: '#25292f',
    eyeColorTop: '#f5f5f0',
    pupilColor: '#111318',
    pupilShape: 'dot',
    pattern: 'tuxedo',
    bellyBibColor: '#fbfbf7',
    earShape: 'small',
    earScale: 0.55,
    faceShape: 'oval',
    noseShape: 'wide',
    noseColor: '#f0a020',
    mouthShape: 'flat',
    whiskerLength: 0,
    armColor: '#25292f',
    pawColor: '#f0a020',
    accentColor: '#5cc8ff',
    accentSideColor: '#2a86c4',
  },
  {
    id: 'frog',
    species: 'frog',
    name: '青蛙',
    emoji: '🐸',
    builtin: true,
    furColor: '#6fbf4a',
    eyeColorTop: '#f5f5e8',
    pupilColor: '#16210f',
    pupilShape: 'round',
    bellyBibColor: '#d8efb4',
    earScale: 0.55,
    faceShape: 'wide',
    headWidth: 1.2,
    eyeScale: 1.28,
    eyeSpacing: 1.28,
    noseShape: 'none',
    mouthShape: 'smile',
    mouthScale: 1.45,
    whiskerLength: 0,
    armColor: '#6fbf4a',
    pawColor: '#d8efb4',
    accentColor: '#a8e063',
    accentSideColor: '#5aa83a',
  },
  {
    id: 'chiikawa',
    species: 'chiikawa',
    name: '吉伊卡哇',
    emoji: '🐹',
    builtin: true,
    furColor: '#fdfbf7',
    furSecondaryColor: '#efe9df',
    eyeColorTop: '#3a3a44',
    eyeColorBottom: '#5a5a68',
    pupilShape: 'round',
    pupilColor: '#2a2a32',
    noseShape: 'small',
    noseColor: '#e8a0a8',
    mouthShape: 'w',
    mouthColor: '#5a5a62',
    blushColor: '#ffb3bf',
    blushAlways: true,
    blushScale: 1.25,
    faceShape: 'round',
    headWidth: 1.18,
    bodyChubbiness: 1.12,
    earShape: 'round',
    earScale: 0.6,
    earSpacing: 0.92,
    eyeScale: 1.05,
    whiskerLength: 0,
    pawColor: '#fdfbf7',
    accentColor: '#ffd166',
    accentSideColor: '#e8a94a',
  },
  {
    id: 'grasscow',
    species: 'grasscow',
    name: '草地牛',
    emoji: '🐮',
    builtin: true,
    furColor: '#f7f4ee',
    furSecondaryColor: '#1b1b1e',
    pattern: 'solid',
    bellyBibColor: '#fdfcf8',
    eyeColorTop: '#26262c',
    pupilShape: 'round',
    pupilColor: '#15151a',
    noseShape: 'wide',
    noseColor: '#e8a0a8',
    mouthShape: 'flat',
    mouthColor: '#3a3a42',
    faceShape: 'wide',
    headWidth: 1.1,
    jawSquareness: 0.5,
    bodyChubbiness: 1.18,
    earShape: 'small',
    earScale: 0.82,
    earTilt: 0.42,
    earOuterColor: '#1b1b1e',
    eyeTilt: -0.46,
    eyeSquint: 0.3,
    eyebrowStyle: 'worried',
    whiskerLength: 0,
    armColor: '#f7f4ee',
    pawColor: '#1b1b1e',
    spots: [
      // radius is in 2D head pixels (55 ~ head radius); negative y = upper head
      { part: 'head', x: 0, y: -0.6, rx: 6, ry: 24, color: '#1b1b1e' },
      { part: 'head', x: -0.58, y: -0.22, rx: 30, ry: 26, color: '#1b1b1e', rotation: 0.4 },
      { part: 'head', x: 0.78, y: -0.5, rx: 22, ry: 20, color: '#1b1b1e', rotation: -0.3 },
      { part: 'body', x: -0.35, y: 0.15, rx: 26, ry: 24, color: '#1b1b1e', rotation: 0.2 },
      { part: 'body', x: 0.45, y: 0.42, rx: 22, ry: 20, color: '#1b1b1e', rotation: -0.5 },
    ],
    accentColor: '#9ad35a',
    accentSideColor: '#5a9b32',
  },
  {
    id: 'milkdragon',
    species: 'milkdragon',
    name: '奶龙',
    emoji: '🐲',
    builtin: true,
    furColor: '#ffc233',
    furSecondaryColor: '#f5a623',
    eyeColorTop: '#151515',
    eyeColorBottom: '#151515',
    pupilShape: 'round',
    pupilColor: '#151515',
    noseShape: 'small',
    noseColor: '#e06a3a',
    mouthShape: 'smile',
    faceShape: 'round',
    headWidth: 1.14,
    bodyChubbiness: 1.24,
    earShape: 'horn',
    earScale: 0.72,
    earOuterColor: '#f5a623',
    bellyBibColor: '#fff0c2',
    eyeScale: 1.1,
    whiskerLength: 0,
    pawColor: '#ffd34d',
    tailFluffy: true,
    tailTipColor: '#ffbf2e',
    accentColor: '#ffe08a',
    accentSideColor: '#e8b03a',
  },
  {
    id: 'capybara',
    species: 'capybara',
    name: '水豚噜噜',
    emoji: '🦫',
    builtin: true,
    furColor: '#f2b843',
    furSecondaryColor: '#d99a2b',
    eyeColorTop: '#151515',
    pupilShape: 'dot',
    pupilColor: '#151515',
    noseShape: 'wide',
    noseColor: '#9c6b34',
    mouthShape: 'flat',
    mouthColor: '#6f4a26',
    faceShape: 'oval',
    headWidth: 1.12,
    jawSquareness: 0.15,
    bodyChubbiness: 1.22,
    earShape: 'small',
    earScale: 0.55,
    earOuterColor: '#d99a2b',
    whiskerLength: 0.4,
    whiskerColor: '#9c6b34',
    pawColor: '#d99a2b',
    spots: [{ part: 'head', x: 0.08, y: -0.84, rx: 18, ry: 15, color: '#f5883a', opacity: 0.95 }],
    accentColor: '#f0a04a',
    accentSideColor: '#c47a2a',
  },
  {
    id: 'loopy',
    species: 'loopy',
    name: '露比',
    emoji: '🩷',
    builtin: true,
    furColor: '#ff9fb5',
    furSecondaryColor: '#f08aa3',
    eyeColorTop: '#151515',
    eyeColorBottom: '#151515',
    pupilShape: 'dot',
    pupilColor: '#151515',
    noseShape: 'small',
    noseColor: '#6d1d53',
    mouthShape: 'open',
    mouthColor: '#c0506a',
    blushColor: '#ff8fa8',
    blushAlways: true,
    blushScale: 1.1,
    faceShape: 'round',
    headWidth: 1.16,
    bodyChubbiness: 1.18,
    earShape: 'small',
    earScale: 0.48,
    earSpacing: 1.18,
    earOuterColor: '#f08aa3',
    whiskerLength: 0,
    pawColor: '#ff9fb5',
    tailFluffy: true,
    tailTipColor: '#f08aa3',
    accentColor: '#ffd1dc',
    accentSideColor: '#f0a0b4',
  },
  {
    id: 'bubu',
    species: 'bubu',
    name: '一二布布',
    emoji: '🧸',
    builtin: true,
    furColor: '#b98a63',
    furSecondaryColor: '#8a5a3c',
    eyeColorTop: '#151515',
    eyeColorBottom: '#151515',
    pupilShape: 'round',
    pupilColor: '#151515',
    noseShape: 'small',
    noseColor: '#4a3324',
    mouthShape: 'smile',
    mouthColor: '#3a2a1e',
    faceShape: 'round',
    headWidth: 1.1,
    bodyChubbiness: 1.14,
    earShape: 'round',
    earScale: 0.94,
    earSpacing: 1.04,
    earInnerColor: '#5b3a24',
    whiskerLength: 0,
    bellyBibColor: '#f0d8bc',
    pawColor: '#8a5a3c',
    accentColor: '#d9a066',
    accentSideColor: '#a9744f',
  },
];
