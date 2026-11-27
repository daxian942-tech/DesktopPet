import { KuroCatEngine3D } from '../src/catEngine3d';
import { DEFAULT_BUILTIN_CATS, type CatSkinConfig } from '../src/catSkins';

const canvas = document.getElementById('pet') as HTMLCanvasElement;
const engine = new KuroCatEngine3D(canvas, { embedded: true });
engine.resize();
engine.start();

(window as unknown as {
  showPet: (id: string) => void;
  petEngine: KuroCatEngine3D;
}).showPet = (id: string) => {
  const skin = DEFAULT_BUILTIN_CATS.find((item) => item.id === id) as CatSkinConfig;
  if (!skin) throw new Error(`Unknown pet: ${id}`);
  engine.setCatSkin(skin);
  engine.resize();
};
(window as unknown as { petEngine: KuroCatEngine3D }).petEngine = engine;
