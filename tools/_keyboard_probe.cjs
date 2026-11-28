/* 键盘位置侦探：读物种根节点的世界变换 + 键盘区域 mesh 的顶面高度 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on('pageerror', (e) => console.log('[err]', e.message));
  await page.goto('http://127.0.0.1:8123/model-preview.html?pet=shiba&t=2.0');
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const engine = window.petEngine;
    const scene = engine.scene;
    let root = null;
    scene.traverse((o) => { if (o.name === 'independent-species-root') root = o; });
    if (!root) return 'NO ROOT';
    scene.updateMatrixWorld(true);
    const V = root.position.constructor;
    const rp = new V();
    root.getWorldPosition(rp);

    const list = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      let p = o;
      while (p) { if (p === root) return; p = p.parent; }
      const wp = new V();
      o.getWorldPosition(wp);
      if (wp.z > 0.3 && wp.y < 0.9) {
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        list.push({
          geo: g.type,
          pos: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
          top: +(wp.y + bb.max.y * o.scale.y).toFixed(3),
          bottom: +(wp.y + bb.min.y * o.scale.y).toFixed(3),
          r: +(g.boundingSphere ? g.boundingSphere.radius : 0).toFixed(2),
        });
      }
    });
    // 只看"矮块"：高度 < 0.4 的，就是键帽/键盘底座
    const lowBlocks = list.filter((i) => i.top - i.bottom < 0.5);
    const tops = lowBlocks.map((i) => i.top);
    return {
      rootPos: [+rp.x.toFixed(3), +rp.y.toFixed(3), +rp.z.toFixed(3)],
      rootScale: +root.scale.x.toFixed(3),
      rootRot: [+root.rotation.x.toFixed(3), +root.rotation.y.toFixed(3), +root.rotation.z.toFixed(3)],
      totalOutside: list.length,
      lowBlockCount: lowBlocks.length,
      keyTopMax: tops.length ? +Math.max(...tops).toFixed(3) : null,
      keyTopMedian: tops.length ? +tops.sort((a, b) => a - b)[Math.floor(tops.length / 2)].toFixed(3) : null,
      lowestBottom: lowBlocks.length ? +Math.min(...lowBlocks.map((i) => i.bottom)).toFixed(3) : null,
      samples: lowBlocks.slice(0, 8),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
