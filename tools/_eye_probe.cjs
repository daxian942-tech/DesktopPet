/* 眼睛动态探针：读三次瞳孔缩放与视线旋转，确认每帧都在动 */
const { chromium } = require('playwright');

(async () => {
  const pet = process.argv[2] || 'shiba';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on('pageerror', (e) => console.log('[err]', e.message));
  await page.goto(`http://127.0.0.1:8123/model-preview.html?pet=${pet}`);
  await page.waitForTimeout(2500);

  const read = () => {
    const m = window.petEngine.speciesModels;
    return {
      pupilScale: m.pupils.map((p) => Number((p.node.scale.x / p.base.x).toFixed(4))),
      eyeRotY: m.eyes.slice(0, 2).map((e) => Number(e.node.rotation.y.toFixed(4))),
      eyeCount: m.eyes.length,
      pupilCount: m.pupils.length,
    };
  };

  const a = await page.evaluate(read);
  await page.waitForTimeout(1400);
  const b = await page.evaluate(read);
  await page.waitForTimeout(1400);
  const c = await page.evaluate(read);
  console.log(JSON.stringify({ pet, a, b, c }, null, 2));
  await browser.close();
})();
