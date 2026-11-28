/* 打字动作探针：触发左手按下，读取手的实际位移，并截「静止 / 按下」两帧对比 */
const { chromium } = require('playwright');

(async () => {
  const pet = process.argv[2] || 'shiba';
  const dir = '_species_shots/typing';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on('pageerror', (e) => console.log('[err]', e.message));
  // 不带 t 参数 => 保持动画运行，这样 speciesModels.update 每帧都在跑
  await page.goto(`http://127.0.0.1:8123/model-preview.html?pet=${pet}`);
  await page.waitForTimeout(2600);

  const readHand = () => {
    const m = window.petEngine.speciesModels;
    const arm = m.limbs.find((x) => x.arm === true && x.side < 0);
    if (!arm) return { error: 'no arm limb' };
    const body = m.body;
    const head = m.head;
    return {
      press: Number(m.typingPress.left.toFixed(4)),
      y: Number(arm.node.position.y.toFixed(4)),
      z: Number(arm.node.position.z.toFixed(4)),
      rx: Number(arm.node.rotation.x.toFixed(4)),
      bodyZ: body ? Number(body.node.position.z.toFixed(4)) : null,
      bodyY: body ? Number(body.node.position.y.toFixed(4)) : null,
      headRx: head ? Number(head.node.rotation.x.toFixed(4)) : null,
    };
  };

  const before = await page.evaluate(readHand);
  await page.screenshot({ path: `${dir}/${pet}_idle.png` });

  await page.evaluate(() => { window.petEngine.paws.L.down = true; });
  await page.waitForTimeout(450);
  const during = await page.evaluate(readHand);
  await page.screenshot({ path: `${dir}/${pet}_press.png` });

  await page.evaluate(() => { window.petEngine.paws.L.down = false; });
  await page.waitForTimeout(400);

  console.log(JSON.stringify({ pet, before, during }, null, 2));
  await browser.close();
})();
