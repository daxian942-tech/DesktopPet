/* 场景侦探 v2：枚举整个 scene 的 mesh，标出「实际可见但不属于 species root」的残留猫部件 */
const { chromium } = require('playwright');

(async () => {
  const pet = process.argv[2] || 'capybara';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.log('[err]', err.message));
  await page.goto(`http://127.0.0.1:8123/model-preview.html?pet=${pet}&t=2.0`);
  await page.waitForTimeout(3000);

  const dump = await page.evaluate(() => {
    const engine = window.petEngine;
    const scene = engine.scene || engine._scene;
    if (!scene) return 'NO SCENE (scene=' + Object.keys(engine).filter((k) => /scene/i.test(k)).join(',') + ')';

    let speciesRoot = null;
    scene.traverse((o) => { if (o.name === 'independent-species-root') speciesRoot = o; });
    if (!speciesRoot) return 'NO SPECIES ROOT';
    scene.updateMatrixWorld(true);

    // 有效可见：自身及所有祖先 visible 都为 true
    const effVisible = (o) => {
      let p = o;
      while (p) { if (!p.visible) return false; p = p.parent; }
      return true;
    };
    const inSubtree = (o, root) => {
      let p = o;
      while (p) { if (p === root) return true; p = p.parent; }
      return false;
    };

    const rows = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const V3 = o.position.constructor;
      const wp = new V3();
      o.getWorldPosition(wp);
      const g = o.geometry;
      g.computeBoundingSphere();
      const bs = g.boundingSphere;
      let col = '-';
      try {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && m.color && m.color.getHexString) col = '#' + m.color.getHexString();
      } catch (e) { /* ignore */ }
      const inSpecies = inSubtree(o, speciesRoot);
      const vis = effVisible(o);
      const scale = Math.max(o.scale.x, o.scale.y, o.scale.z);
      rows.push({
        flag: (!inSpecies && vis) ? '!! OUTSIDE-VISIBLE' : (inSpecies ? '   species-root' : '   hidden-other'),
        name: (o.name || '<noname>'),
        parent: (o.parent && o.parent.name) || '?',
        geo: g.type,
        pos: `${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}`,
        r: (bs ? bs.radius * scale : 0).toFixed(2),
        col,
      });
    });

    // 嫌疑项排前面
    rows.sort((a, b) => (a.flag.startsWith('!!') ? -1 : 0) - (b.flag.startsWith('!!') ? -1 : 0));
    const head = `PET=${pet}  totalMesh=${rows.length}  speciesRootVisible=${speciesRoot.visible}`;
    const body = rows
      .map((r) => `${r.flag.padEnd(19)} ${r.name.padEnd(26)} p=${r.parent.padEnd(24)} geo=${r.geo.padEnd(16)} pos=(${r.pos.padEnd(16)}) r=${r.r.padStart(6)} col=${r.col}`)
      .join('\n');
    return head + '\n' + body;
  });

  console.log(dump);
  await browser.close();
})();
