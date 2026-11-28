import { KuroCatEngine } from '../src/catEngine';

const canvas = document.getElementById('pet') as HTMLCanvasElement;
const engine = new KuroCatEngine(canvas, { embedded: true });
engine.resize();
engine.start();

(window as unknown as { careEngine: KuroCatEngine }).careEngine = engine;
