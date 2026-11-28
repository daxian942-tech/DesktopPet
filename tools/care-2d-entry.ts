import { KuroCatEngine } from '../src/catEngine';
import { DEFAULT_BUILTIN_CATS, type CatSkinConfig } from '../src/catSkins';

const canvas = document.getElementById('pet') as HTMLCanvasElement;
const engine = new KuroCatEngine(canvas, { embedded: true });
engine.resize();
engine.start();

// ?pet=<id> 让真实 2D 引擎也能切到 12 只动物，用于跳跃 / 照顾场景验收
(window as unknown as {
  careEngine: KuroCatEngine;
  showPet: (id: string) => void;
}).showPet = (id: string) => {
  const skin = DEFAULT_BUILTIN_CATS.find((item) => item.id === id) as CatSkinConfig;
  if (!skin) throw new Error(`Unknown pet: ${id}`);
  engine.setCatAppearance(id, skin);
  engine.resize();
};
(window as unknown as { careEngine: KuroCatEngine }).careEngine = engine;
