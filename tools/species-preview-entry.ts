import { renderSpecies2d, renderSpeciesPreview2d, type PetMood } from '../src/speciesRenderer2d';
import { resolveCustomSkin, type CatSkinConfig } from '../src/catSkins';

interface PreviewApi {
  render: (ctx: CanvasRenderingContext2D, skin: CatSkinConfig, w: number, h: number) => void;
  renderWith: (
    ctx: CanvasRenderingContext2D,
    skin: CatSkinConfig,
    w: number,
    h: number,
    time: number,
    mood: PetMood,
    typing: number,
  ) => void;
}

(window as unknown as { KuroSpecies2D: PreviewApi }).KuroSpecies2D = {
  render: renderSpeciesPreview2d,
  renderWith: (ctx, skin, w, h, time, mood, typing) => renderSpecies2d(ctx, {
    skin: resolveCustomSkin(skin),
    w,
    h,
    time,
    breath: 0,
    blink: 0,
    sleep: 0,
    squint: 0,
    mood,
    moodAmt: mood === 'idle' ? 0 : 1,
    typing,
  }),
};
