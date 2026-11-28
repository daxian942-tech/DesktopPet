"use strict";
(() => {
  // src/catSkins.ts
  function clampNum(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function resolveCatContour(raw) {
    const fsRaw = (raw?.faceShape || "round").toLowerCase();
    const faceShape = fsRaw === "square" || fsRaw === "wide" || fsRaw === "fox" || fsRaw === "oval" ? fsRaw : "round";
    const esRaw = (raw?.earShape || "cat").toLowerCase();
    const earShape = esRaw === "round" || esRaw === "tall" || esRaw === "small" || esRaw === "wide" || esRaw === "folded" || esRaw === "floppy" ? esRaw : "cat";
    const psRaw = (raw?.pupilShape || "oval").toLowerCase();
    const pupilShape = psRaw === "round" || psRaw === "slit" || psRaw === "dot" || psRaw === "star" ? psRaw : "oval";
    const nsRaw = (raw?.noseShape || "cat").toLowerCase();
    const noseShape = nsRaw === "round" || nsRaw === "wide" || nsRaw === "small" || nsRaw === "none" ? nsRaw : "cat";
    const msRaw = (raw?.mouthShape || "w").toLowerCase();
    const mouthShape = msRaw === "smile" || msRaw === "flat" || msRaw === "open" || msRaw === "blep" || msRaw === "none" ? msRaw : "w";
    const ebRaw = (raw?.eyebrowStyle || "none").toLowerCase();
    const eyebrowStyle = ebRaw === "soft" || ebRaw === "thick" || ebRaw === "angry" || ebRaw === "worried" ? ebRaw : "none";
    const numOr = (val, lo, hi, fallback) => typeof val === "number" && Number.isFinite(val) ? clampNum(val, lo, hi) : fallback;
    const defaultHeadWidth = faceShape === "square" ? 1.14 : faceShape === "wide" ? 1.12 : faceShape === "fox" ? 0.98 : faceShape === "oval" ? 0.93 : 1;
    const defaultJawSquareness = faceShape === "square" ? 0.88 : faceShape === "wide" ? 0.36 : 0;
    return {
      faceShape,
      headWidth: numOr(raw?.headWidth, 0.78, 1.32, defaultHeadWidth),
      jawSquareness: numOr(raw?.jawSquareness, 0, 1, defaultJawSquareness),
      earShape,
      earScale: numOr(raw?.earScale, 0.55, 1.55, 1),
      earSpacing: numOr(raw?.earSpacing, 0.7, 1.35, 1),
      earTilt: numOr(raw?.earTilt, -0.45, 0.65, 0),
      eyeSquint: numOr(raw?.eyeSquint, 0, 0.75, 0),
      eyeScale: numOr(raw?.eyeScale, 0.55, 1.45, 1),
      eyeAspect: numOr(raw?.eyeAspect, 0.6, 1.4, 1),
      eyeSpacing: numOr(raw?.eyeSpacing, 0.72, 1.35, 1),
      eyeOffsetY: numOr(raw?.eyeOffsetY, -1, 1, 0),
      eyeTilt: numOr(raw?.eyeTilt, -0.5, 0.5, 0),
      pupilShape,
      pupilScale: numOr(raw?.pupilScale, 0.4, 1.45, 1),
      noseShape,
      noseScale: numOr(raw?.noseScale, 0.5, 1.8, 1),
      noseOffsetY: numOr(raw?.noseOffsetY, -1, 1, 0),
      mouthShape,
      mouthScale: numOr(raw?.mouthScale, 0.55, 1.7, 1),
      mouthOffsetY: numOr(raw?.mouthOffsetY, -1, 1, 0),
      whiskerLength: numOr(raw?.whiskerLength, 0, 1.6, 1),
      eyebrowStyle,
      blushAlways: Boolean(raw?.blushAlways),
      blushScale: numOr(raw?.blushScale, 0.5, 1.6, 1),
      bodyChubbiness: numOr(raw?.bodyChubbiness, 0.8, 1.25, 1)
    };
  }
  function parseHexLuminance(hex2) {
    const m = hex2.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return 0.5;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  function isLightColor(hex2) {
    return parseHexLuminance(hex2) > 0.48;
  }
  function resolveCustomSkin(raw) {
    const fur = raw.furColor || "#f2a452";
    const darkBase = !isLightColor(fur);
    const pattern = raw.pattern || "solid";
    const defaultOutline = darkBase ? null : "#524840";
    const outlineColor = raw.outlineColor !== void 0 ? raw.outlineColor || null : defaultOutline;
    const pawColor = raw.pawColor || (pattern === "tuxedo" ? "#faf9f5" : fur);
    const armColor = raw.armColor || fur;
    const pawIsLight = isLightColor(pawColor);
    return {
      id: raw.id,
      name: raw.name || raw.id,
      isDarkBase: darkBase,
      furColor: fur,
      furSecondaryColor: raw.furSecondaryColor || fur,
      outlineColor,
      legLineColor: raw.legLineColor || (darkBase ? "rgba(214, 218, 224, 0.62)" : "rgba(82, 72, 64, 0.62)"),
      pattern,
      maskColor: raw.maskColor || (pattern === "siamese" ? "#4a382c" : pattern === "bicolor" ? "#9e8e7f" : null),
      foreheadBridgeColor: raw.foreheadBridgeColor || null,
      flankColor: raw.flankColor || null,
      bellyBibColor: raw.bellyBibColor || (pattern === "tuxedo" ? "#faf9f5" : null),
      stripeColor: raw.stripeColor || (pattern === "tabby" ? "#9e5318" : null),
      calicoPatchColor: raw.calicoPatchColor || (pattern === "calico" ? "#3a3533" : null),
      earOuterColor: raw.earOuterColor || raw.maskColor || fur,
      earTipColor: raw.earTipColor || null,
      earInnerColor: raw.earInnerColor || (darkBase ? null : "#efc4c8"),
      earTuftColor: raw.earTuftColor || null,
      tailColor: raw.tailColor || raw.earOuterColor || raw.maskColor || fur,
      tailTipColor: raw.tailTipColor || raw.earTipColor || raw.tailColor || fur,
      tailFluffy: Boolean(raw.tailFluffy),
      tailStripes: Boolean(raw.tailStripes || pattern === "tabby"),
      eyeColorTop: raw.eyeColorTop || "#5a94d6",
      eyeColorBottom: raw.eyeColorBottom || raw.eyeColorTop || "#a3d2f2",
      rightEyeColorTop: raw.rightEyeColorTop || raw.eyeColorTop || "#5a94d6",
      rightEyeColorBottom: raw.rightEyeColorBottom || raw.rightEyeColorTop || raw.eyeColorBottom || raw.eyeColorTop || "#a3d2f2",
      pupilColor: raw.pupilColor || "#10141e",
      eyeCatchlight: raw.eyeCatchlight ?? !darkBase,
      eyeRimColor: raw.eyeRimColor || (darkBase ? null : "rgba(42, 46, 58, 0.78)"),
      squintColor: raw.squintColor || (darkBase ? raw.eyeColorTop || "#d4f044" : "#2c2928"),
      squintGlowColor: raw.squintGlowColor || null,
      noseColor: raw.noseColor !== void 0 ? raw.noseColor || null : darkBase ? null : "#ee8e9e",
      mouthColor: raw.mouthColor || (darkBase ? null : "rgba(72, 68, 76, 0.78)"),
      blushColor: raw.blushColor || (darkBase ? null : "#f492a6"),
      whiskerColor: raw.whiskerColor || (darkBase ? "rgba(210, 214, 220, 0.56)" : "rgba(84, 76, 70, 0.56)"),
      eyebrowColor: raw.eyebrowColor || (darkBase ? "#e8e2d4" : outlineColor || "#4a3d35"),
      armColor,
      pawColor,
      pawOutlineColor: raw.pawOutlineColor !== void 0 ? raw.pawOutlineColor || null : pawIsLight ? outlineColor || "#524840" : null,
      armCreaseColor: raw.armCreaseColor !== void 0 ? raw.armCreaseColor || null : !pawIsLight ? "rgba(216, 218, 222, 0.62)" : null,
      accentColor: raw.accentColor || "#d2f244",
      accentSideColor: raw.accentSideColor || "#8cb014",
      contour: resolveCatContour(raw),
      species: resolveSpecies(raw.species),
      muzzleLength: clampNum(raw.muzzleLength ?? defaultMuzzleLength(raw.species), 0, 1),
      muzzleWidth: clampNum(raw.muzzleWidth ?? 0.62, 0.3, 1.2),
      muzzleColor: raw.muzzleColor || null,
      spots: Array.isArray(raw.spots) ? raw.spots : []
    };
  }
  var SPECIES_SET = /* @__PURE__ */ new Set([
    "dog",
    "fox",
    "panda",
    "bunny",
    "penguin",
    "frog",
    "chiikawa",
    "grasscow",
    "milkdragon",
    "capybara",
    "loopy",
    "bubu"
  ]);
  function resolveSpecies(raw) {
    const s = String(raw || "cat").toLowerCase();
    return SPECIES_SET.has(s) ? s : "cat";
  }
  function defaultMuzzleLength(raw) {
    switch (String(raw || "cat").toLowerCase()) {
      case "dog":
        return 0.78;
      case "fox":
        return 0.9;
      case "panda":
        return 0.5;
      case "bunny":
        return 0.4;
      case "penguin":
        return 0.66;
      // beak
      case "frog":
        return 0;
      case "grasscow":
        return 0.42;
      // broad bovine muzzle
      case "capybara":
        return 0.34;
      // blocky capybara snout
      case "milkdragon":
        return 0.22;
      // small round dragon snout
      case "chiikawa":
        return 0;
      // flat chubby face
      case "loopy":
        return 0;
      // flat pink face
      case "bubu":
        return 0.12;
      default:
        return 0;
    }
  }

  // src/chibi2d.ts
  function hex(c, fallback) {
    if (!c) return fallback;
    const v = String(c).trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
    if (/^rgba?\(/i.test(v)) return v;
    return fallback;
  }
  function shift(c, amt) {
    const m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const h = m[1];
      const ch = (i) => Math.max(0, Math.min(255, parseInt(h.slice(i, i + 2), 16) + amt));
      return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
    }
    const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) {
      const ch = (v) => Math.max(0, Math.min(255, parseInt(v, 10) + amt));
      return `rgb(${ch(rgb[1])},${ch(rgb[2])},${ch(rgb[3])})`;
    }
    return c;
  }
  function fillEllipse(ctx, x, y, rx, ry, color, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function plushFill(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(
      x - rx * 0.28,
      y - ry * 0.42,
      rx * 0.08,
      x + rx * 0.1,
      y + ry * 0.18,
      Math.max(rx, ry) * 1.12
    );
    g.addColorStop(0, shift(color, 16));
    g.addColorStop(0.55, color);
    g.addColorStop(1, shift(color, -18));
    ctx.fillStyle = g;
    ctx.fill();
  }
  function fillSoftEdge(ctx, x, y, rx, ry, color) {
    fillEllipse(ctx, x, y, rx + 5, ry + 5, shift(color, -20));
    plushFill(ctx, x, y, rx, ry, color);
  }
  function fillPoly(ctx, pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function roundLine(ctx, color, w, pts) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }
  function curve(ctx, color, w, draw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  }
  function chibiEye(p, x, y, rx, ry, iris, sclera, pupilScale = 0.5) {
    const { ctx, ink } = p;
    if (p.blink > 0.45 || p.squint > 0.55) {
      curve(ctx, ink, Math.max(5, rx * 0.28), () => {
        ctx.moveTo(x - rx, y);
        ctx.quadraticCurveTo(x, y + ry * 0.75, x + rx, y);
      });
      return;
    }
    if (p.expression === "happy") {
      curve(ctx, ink, Math.max(5, rx * 0.3), () => {
        ctx.moveTo(x - rx, y + ry * 0.18);
        ctx.quadraticCurveTo(x, y - ry * 1.15, x + rx, y + ry * 0.18);
      });
      return;
    }
    if (p.expression === "love") {
      const r = Math.max(rx, ry) * 0.95;
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.9);
      ctx.bezierCurveTo(x - r * 1.5, y - r * 0.15, x - r * 0.7, y - r * 1.3, x, y - r * 0.42);
      ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.5, y - r * 0.15, x, y + r * 0.9);
      ctx.closePath();
      ctx.fillStyle = "#e56f7f";
      ctx.fill();
      return;
    }
    if (p.expression === "surprised") {
      fillEllipse(ctx, x, y, rx * 1.18, ry * 1.24, sclera ? "#ffffff" : iris);
      fillEllipse(ctx, x, y, rx, ry, iris);
      fillEllipse(ctx, x, y, rx * pupilScale, ry * pupilScale * 1.12, ink);
      fillEllipse(ctx, x - rx * 0.3, y - ry * 0.32, rx * 0.32, ry * 0.32, "#ffffff");
      return;
    }
    if (sclera) fillEllipse(ctx, x, y, rx * 1.24, ry * 1.24, "#ffffff");
    fillEllipse(ctx, x, y, rx, ry, iris);
    fillEllipse(ctx, x, y, rx * pupilScale, ry * pupilScale * 1.12, ink);
    if (p.s.eyeCatchlight !== false) {
      fillEllipse(ctx, x - rx * 0.3, y - ry * 0.32, rx * 0.31, ry * 0.31, "#ffffff");
      fillEllipse(ctx, x + rx * 0.34, y + ry * 0.3, rx * 0.15, ry * 0.15, "#ffffff");
    }
    if (p.expression === "worried") {
      const side = x < 0 ? -1 : 1;
      roundLine(ctx, ink, Math.max(4, rx * 0.24), [[x + side * rx, y - ry * 0.7], [x - side * rx * 0.85, y - ry * 1.1]]);
    }
  }
  function chibiMouth(p, y, w, grin = true, arc = 0.34) {
    curve(p.ctx, p.ink, Math.max(4, w * 0.14), () => {
      p.ctx.moveTo(-w, y);
      p.ctx.quadraticCurveTo(0, y + (grin ? w * arc : 3), w, y);
    });
  }
  function drawLegs(p, cfg) {
    const { ctx } = p;
    const lx = cfg.legX ?? 60;
    const ly = cfg.legY ?? 248;
    const lr = cfg.legR ?? 46;
    [-1, 1].forEach((side) => {
      const x = side * lx;
      roundLine(ctx, cfg.bodyColor || p.secondary, lr * 1.15, [[x, ly - 24], [x, ly + 46]]);
      fillEllipse(ctx, x, ly + 46, lr * 0.86, lr * 0.44, cfg.pawColor || cfg.bodyColor || p.secondary);
      if (cfg.footClaw) {
        for (let i = -1; i <= 1; i++) {
          fillEllipse(ctx, x + i * lr * 0.4, ly + 46 + lr * 0.24, lr * 0.13, lr * 0.13, cfg.footClaw);
        }
      }
    });
  }
  function drawArms(p, cfg) {
    const { ctx } = p;
    const reach = Math.max(0, Math.min(1, p.reach));
    const ax = cfg.armX ?? 96;
    const ay = cfg.armY ?? 92;
    const aw = cfg.armR ?? 30;
    const body = cfg.bodyColor || p.secondary;
    [-1, 1].forEach((side) => {
      const sx = side * ax;
      const sy = ay;
      const restX = side * (cfg.hug ? 26 : 50);
      const restY = ay + (cfg.hug ? 46 : 92);
      const typeX = side * (ax + 18);
      const typeY = 282;
      const px = restX + (typeX - restX) * reach;
      let py = restY + (typeY - restY) * reach;
      const tap = (side < 0 ? p.tapLeft : p.tapRight) * reach * 15;
      py -= tap;
      roundLine(ctx, body, aw * 1.05, [[sx, sy], [(sx + px) / 2, (sy + py) / 2 + 16], [px, py]]);
      fillEllipse(ctx, px, py, aw * 0.82, aw * 0.68, cfg.pawColor || body);
      if (cfg.claw) {
        for (let i = -1; i <= 1; i++) {
          fillEllipse(ctx, px + i * aw * 0.44, py + aw * 0.42, aw * 0.15, aw * 0.16, cfg.claw);
        }
      }
    });
  }
  function drawChibi(p, cfg) {
    const { ctx } = p;
    const headColor = cfg.headColor || p.fur;
    const bodyColor = cfg.bodyColor || p.secondary;
    if (cfg.tail) cfg.tail(p);
    drawLegs(p, cfg);
    fillSoftEdge(ctx, 0, cfg.bodyY, cfg.bodyRx, cfg.bodyRy, bodyColor);
    if (cfg.bellyColor) {
      ctx.save();
      const wob = 1 + Math.sin(p.t * 2.5) * 0.012;
      ctx.translate(0, cfg.bellyY ?? cfg.bodyY + 20);
      ctx.scale(wob, 2 - wob);
      fillEllipse(ctx, 0, 0, cfg.bellyRx ?? cfg.bodyRx * 0.66, cfg.bellyRy ?? cfg.bodyRy * 0.74, cfg.bellyColor);
      ctx.restore();
    }
    drawArms(p, cfg);
    ctx.save();
    ctx.translate(0, 26);
    if (cfg.ears) cfg.ears(p);
    fillSoftEdge(ctx, 0, cfg.headY, cfg.headRx, cfg.headRy, headColor);
    if (cfg.markings) cfg.markings(p);
    if (cfg.crown) cfg.crown(p);
    if (cfg.blush) {
      [-1, 1].forEach((side) => fillEllipse(ctx, side * cfg.eyeX * 1.45, cfg.eyeY + cfg.eyeRy * 1.55, cfg.eyeRx * 0.66, cfg.eyeRy * 0.3, cfg.blush));
    }
    [-1, 1].forEach((side) => chibiEye(
      p,
      side * cfg.eyeX,
      cfg.eyeY,
      cfg.eyeRx,
      cfg.eyeRy,
      cfg.iris || p.s.eyeColorTop || "#2c2a30",
      cfg.sclera ?? false,
      cfg.pupil ?? 0.5
    ));
    if (cfg.face) cfg.face(p);
    chibiMouth(p, cfg.mouthY ?? cfg.eyeY + cfg.eyeRy * 2.05, cfg.mouthW ?? cfg.eyeRx * 1.1, true, cfg.smileCurve ?? 0.34);
    ctx.restore();
  }
  function configFor(p, species) {
    const s = p.s;
    const fur = p.fur;
    const pale = s.bellyBibColor || "#fff3e0";
    const ink = p.ink;
    switch (species) {
      case "cat":
        return {
          headRx: 138,
          headRy: 126,
          headY: -96,
          bodyRx: 104,
          bodyRy: 108,
          bodyY: 132,
          bellyColor: pale,
          eyeX: 48,
          eyeY: -100,
          eyeRx: 26,
          eyeRy: 30,
          iris: s.eyeColorTop || "#c8e64a",
          pupil: 0.34,
          ears: (q) => [-1, 1].forEach((side) => fillPoly(q.ctx, [
            [side * 54, -182],
            [side * 112, -182],
            [side * 82, -268]
          ], fur)),
          tail: (q) => curve(q.ctx, fur, 34, () => {
            q.ctx.moveTo(96, 190);
            q.ctx.quadraticCurveTo(210, 150, 178, 30);
          }),
          face: (q) => {
            fillPoly(q.ctx, [[-12, -44], [12, -44], [0, -28]], q.s.noseColor || "#e08f9c");
          }
        };
      case "dog":
        return {
          bodyColor: p.secondary,
          headColor: fur,
          headRx: 142,
          headRy: 130,
          headY: -94,
          bodyRx: 112,
          bodyRy: 106,
          bodyY: 134,
          bellyColor: pale,
          eyeX: 50,
          eyeY: -100,
          eyeRx: 26,
          eyeRy: 30,
          pupil: 0.46,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 118, -104, 38, 82, q.s.earOuterColor || q.secondary, side * 0.22)),
          tail: (q) => curve(q.ctx, q.secondary, 30, () => {
            q.ctx.moveTo(100, 176);
            q.ctx.quadraticCurveTo(196, 136, 168, 62);
          }),
          face: (q) => {
            fillEllipse(q.ctx, 0, -38, 46, 36, pale);
            fillEllipse(q.ctx, 0, -52, 20, 14, q.s.noseColor || "#2b211d");
            fillEllipse(q.ctx, 0, -14, 15, 20, "#ef8e9e");
          }
        };
      case "fox":
        return {
          bodyColor: p.secondary,
          headColor: fur,
          headRx: 136,
          headRy: 118,
          headY: -98,
          bodyRx: 108,
          bodyRy: 100,
          bodyY: 140,
          bellyColor: pale,
          eyeX: 48,
          eyeY: -104,
          eyeRx: 25,
          eyeRy: 27,
          iris: s.eyeColorTop || "#d8a23c",
          pupil: 0.28,
          ears: (q) => [-1, 1].forEach((side) => fillPoly(q.ctx, [
            [side * 52, -172],
            [side * 122, -186],
            [side * 90, -272]
          ], fur)),
          tail: (q) => {
            q.ctx.save();
            q.ctx.translate(112, 168);
            q.ctx.rotate(0.35);
            fillEllipse(q.ctx, 62, 0, 92, 46, fur);
            fillEllipse(q.ctx, 136, -8, 34, 30, "#fff5e6");
            q.ctx.restore();
          },
          face: (q) => fillEllipse(q.ctx, 0, -34, 40, 25, pale)
        };
      case "panda":
        return {
          headRx: 142,
          headRy: 128,
          headY: -96,
          bodyRx: 112,
          bodyRy: 110,
          bodyY: 132,
          eyeX: 52,
          eyeY: -104,
          eyeRx: 27,
          eyeRy: 31,
          pupil: 0.44,
          sclera: true,
          iris: "#3c3c44",
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 104, -192, 40, 42, "#202024")),
          markings: (q) => {
            [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 52, -104, 36, 38, "#202024"));
          },
          face: (q) => fillEllipse(q.ctx, 0, -40, 15, 11, "#202024")
        };
      case "bunny":
        return {
          headRx: 132,
          headRy: 126,
          headY: -100,
          bodyRx: 100,
          bodyRy: 108,
          bodyY: 136,
          bellyColor: pale,
          eyeX: 46,
          eyeY: -106,
          eyeRx: 24,
          eyeRy: 28,
          iris: "#8a6a67",
          pupil: 0.48,
          ears: (q) => [-1, 1].forEach((side) => {
            fillEllipse(q.ctx, side * 52, -264, 25, 92, fur, side * 0.1);
            fillEllipse(q.ctx, side * 52, -264, 11, 72, "#f3b8c4", side * 0.1);
          }),
          tail: (q) => fillEllipse(q.ctx, 92, 196, 32, 32, "#fffaf4"),
          blush: "#f3b8c4",
          face: (q) => fillEllipse(q.ctx, 0, -42, 11, 8, "#d98a9a")
        };
      case "penguin":
        return {
          headRx: 130,
          headRy: 122,
          headY: -96,
          bodyRx: 104,
          bodyRy: 120,
          bodyY: 136,
          bellyColor: "#ffffff",
          bellyRx: 70,
          bellyRy: 100,
          bellyY: 146,
          eyeX: 46,
          eyeY: -104,
          eyeRx: 23,
          eyeRy: 26,
          pupil: 0.5,
          face: (q) => fillPoly(q.ctx, [[-22, -48], [22, -48], [0, -16]], "#f5a623"),
          pawColor: "#f5a623"
        };
      case "frog":
        return {
          headRx: 150,
          headRy: 112,
          headY: -92,
          bodyRx: 116,
          bodyRy: 100,
          bodyY: 140,
          bellyColor: "#c9e89b",
          bellyRx: 74,
          bellyRy: 72,
          eyeX: 62,
          eyeY: -156,
          eyeRx: 30,
          eyeRy: 32,
          iris: "#f5f5e8",
          pupil: 0.34,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 62, -156, 37, 39, fur)),
          blush: "#f3a8b6",
          face: (q) => {
            curve(q.ctx, "#3d7a35", 4, () => {
              q.ctx.moveTo(-34, -52);
              q.ctx.quadraticCurveTo(0, -38, 34, -52);
            });
          }
        };
      case "chiikawa":
        return {
          headRx: 140,
          headRy: 128,
          headY: -96,
          bodyRx: 98,
          bodyRy: 100,
          bodyY: 136,
          eyeX: 44,
          eyeY: -100,
          eyeRx: 16,
          eyeRy: 18,
          iris: "#2c2a30",
          pupil: 0.62,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 100, -178, 24, 25, fur)),
          blush: "#f6b8c4",
          face: (q) => {
            fillEllipse(q.ctx, 0, -46, 9, 6, "#c48f9a");
            q.ctx.fillStyle = "#c48f9a";
            q.ctx.font = "bold 14px sans-serif";
            q.ctx.fillText("\u03C9", -8, -30);
          }
        };
      case "grasscow":
        return {
          bodyColor: "#ffffff",
          headColor: "#ffffff",
          headRx: 140,
          headRy: 120,
          headY: -94,
          bodyRx: 116,
          bodyRy: 104,
          bodyY: 138,
          eyeX: 50,
          eyeY: -104,
          eyeRx: 24,
          eyeRy: 27,
          pupil: 0.46,
          ears: (q) => [-1, 1].forEach((side) => {
            fillEllipse(q.ctx, side * 130, -136, 34, 22, "#2c2c30", side * 0.3);
            fillEllipse(q.ctx, side * 84, -196, 16, 24, "#e8d6a8");
          }),
          face: (q) => {
            fillEllipse(q.ctx, 0, -38, 46, 34, "#f2a9b8");
            [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 17, -42, 7, 6, "#b86c7c"));
            fillEllipse(q.ctx, 0, -186, 34, 24, "#2c2c30");
          }
        };
      case "milkdragon":
        return {
          // 按用户参考图：亮黄宽圆头 + 橙色身体 + 白圈墨绿眼 + 粉白大肚皮 + 抱胸臂
          headColor: s.furColor || "#ffc233",
          bodyColor: s.furSecondaryColor || "#f5a623",
          headRx: 168,
          headRy: 138,
          headY: -100,
          bodyRx: 112,
          bodyRy: 104,
          bodyY: 142,
          bellyColor: "#fff1ef",
          bellyRx: 80,
          bellyRy: 88,
          bellyY: 158,
          eyeX: 60,
          eyeY: -104,
          eyeRx: 25,
          eyeRy: 28,
          iris: "#2f6b46",
          sclera: true,
          pupil: 0.54,
          armX: 106,
          armY: 78,
          armR: 34,
          hug: true,
          pawColor: s.furSecondaryColor || "#f5a623",
          claw: "#8a7466",
          legX: 62,
          legY: 258,
          legR: 48,
          footClaw: "#8a7466",
          mouthY: -22,
          mouthW: 30,
          smileCurve: 0.62
          // 参考图胸前的小灰褐爪尖由 drawArms 的 claw 画在掌上，不再在脸上叠一排点
        };
      case "capybara":
        return {
          bodyColor: p.secondary,
          headColor: fur,
          headRx: 138,
          headRy: 118,
          headY: -92,
          bodyRx: 116,
          bodyRy: 104,
          bodyY: 140,
          bellyColor: pale,
          eyeX: 50,
          eyeY: -100,
          eyeRx: 23,
          eyeRy: 25,
          pupil: 0.48,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 112, -168, 26, 26, fur)),
          crown: (q) => {
            fillEllipse(q.ctx, 0, -238, 30, 28, "#f28c28");
            fillEllipse(q.ctx, 4, -258, 9, 16, "#6fa84a");
          },
          face: (q) => fillEllipse(q.ctx, 0, -34, 34, 26, "#f2a94a")
        };
      case "loopy":
        return {
          bodyColor: p.secondary,
          headColor: fur,
          headRx: 142,
          headRy: 128,
          headY: -96,
          bodyRx: 102,
          bodyRy: 106,
          bodyY: 138,
          bellyColor: "#ffd3e0",
          bellyRx: 68,
          bellyRy: 80,
          eyeX: 48,
          eyeY: -104,
          eyeRx: 25,
          eyeRy: 29,
          pupil: 0.46,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 116, -172, 30, 32, q.secondary)),
          crown: (q) => fillPoly(q.ctx, [[-38, -212], [0, -188], [-38, -164]], "#7fc4e8"),
          face: (q) => {
            fillEllipse(q.ctx, 0, -26, 18, 12, "#ffffff");
            q.ctx.fillStyle = "#c9527a";
            q.ctx.fillRect(-6, -34, 12, 12);
          },
          blush: "#f49ab6"
        };
      case "bubu":
        return {
          bodyColor: p.secondary,
          headColor: fur,
          headRx: 138,
          headRy: 124,
          headY: -96,
          bodyRx: 106,
          bodyRy: 106,
          bodyY: 138,
          bellyColor: "#e9cba8",
          bellyRx: 66,
          bellyRy: 76,
          eyeX: 48,
          eyeY: -102,
          eyeRx: 25,
          eyeRy: 26,
          pupil: 0.46,
          ears: (q) => [-1, 1].forEach((side) => fillEllipse(q.ctx, side * 104, -182, 32, 34, q.secondary)),
          crown: (q) => {
            curve(q.ctx, "#7a5844", 3.5, () => {
              q.ctx.moveTo(22, -214);
              q.ctx.lineTo(30, -178);
              q.ctx.lineTo(20, -150);
            });
          },
          face: (q) => {
            fillPoly(q.ctx, [[-42, -8], [0, 16], [42, -8], [0, 4]], "#f0b429");
            fillEllipse(q.ctx, 0, -36, 12, 9, "#4a3528");
          }
        };
    }
  }
  function drawChibiSpecies(ctx, skin, species, t, expression, blink, squint, tapLeft, tapRight, reach) {
    const s = skin;
    const fur = hex(s.furColor, "#f4ece6");
    const p = {
      ctx,
      s,
      fur,
      secondary: hex(s.furSecondaryColor || s.armColor, shift(fur, -18)),
      belly: hex(s.bellyBibColor || s.muzzleColor, "#fff3e0"),
      ink: hex(s.mouthColor, "#3a302c"),
      t,
      expression,
      blink,
      squint,
      tapLeft,
      tapRight,
      reach
    };
    drawChibi(p, configFor(p, species));
  }

  // src/careScene.ts
  var TAU = Math.PI * 2;
  var clamp01 = (v) => Math.max(0, Math.min(1, v));
  function softEllipse(ctx, x, y, rx, ry, color, edge, rotation = 0) {
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 2.2, ry + 2.2, rotation, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
    ctx.fill();
  }
  function drawBowl(ctx, x, y, s, time, alpha, isDrink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const shell = isDrink ? "#6db6dd" : "#e6a15c";
    const shellEdge = isDrink ? "#4e93bd" : "#c47c3c";
    const inner = isDrink ? "#a9dcf3" : "#f6d6a4";
    ctx.globalAlpha = alpha * 0.14;
    ctx.fillStyle = "#3a2c22";
    ctx.beginPath();
    ctx.ellipse(0, 15, 66, 12, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = shellEdge;
    ctx.beginPath();
    ctx.moveTo(-61, -5);
    ctx.lineTo(61, -5);
    ctx.quadraticCurveTo(54, 27, 0, 29);
    ctx.quadraticCurveTo(-54, 27, -61, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.moveTo(-57, -4);
    ctx.lineTo(57, -4);
    ctx.quadraticCurveTo(50, 24, 0, 26);
    ctx.quadraticCurveTo(-50, 24, -57, -4);
    ctx.closePath();
    ctx.fill();
    softEllipse(ctx, 0, -5, 59, 15, inner, shellEdge);
    if (isDrink) {
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const wob = Math.sin(time * 3.2 + i * 1.7) * 3;
        ctx.beginPath();
        ctx.ellipse(-4 + wob, -6 + i * 4, 30 - i * 8, 5.5 - i, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
    } else {
      const chew = Math.sin(time * 9.5) * 2.2;
      const bits = [
        [-24, -7, 11, "#c9703f"],
        [1, -9, 12, "#e9b563"],
        [24, -6, 10, "#b96138"],
        [-8, -14, 8.5, "#f0c987"],
        [14, -15, 7.5, "#d98b4a"]
      ];
      for (const [bx, by, br, c] of bits) {
        softEllipse(ctx, bx, by + chew * 0.4, br, br * 0.72, c, "rgba(90,55,30,0.35)");
      }
      ctx.fillStyle = "#7fb563";
      ctx.beginPath();
      ctx.ellipse(34, -12 + chew * 0.5, 10, 5.5, -0.5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, -5, 54, 12.5, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();
  }
  function drawBall(ctx, x, y, s, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    softEllipse(ctx, 0, 0, r, r, color, "rgba(70,50,40,0.30)");
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
  }
  function drawStar(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffd45e";
    ctx.strokeStyle = "rgba(214,142,38,0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawCareScene2D(ctx, o) {
    const amt = clamp01(o.amt);
    if (amt < 0.012) return;
    const mood = o.mood;
    if (mood !== "eat" && mood !== "drink" && mood !== "play" && mood !== "bath") return;
    const { cx, cy, s, time } = o;
    const alpha = Math.min(1, amt * 1.5);
    const rise = (1 - amt) * 22 * s;
    const bowlX = cx - 96 * s;
    const bowlY = cy + 8 * s + rise;
    ctx.save();
    if (mood === "eat" || mood === "drink") {
      drawBowl(ctx, bowlX, bowlY, s, time, alpha, mood === "drink");
      const n = mood === "drink" ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const ph = (time * 0.85 + i * 0.29) % 1;
        const bx = bowlX + Math.sin(time * 2.6 + i * 1.9) * 17 * s + (i - (n - 1) / 2) * 13 * s;
        const by = bowlY - 26 * s - ph * 62 * s;
        ctx.globalAlpha = alpha * (1 - ph) * 0.78;
        ctx.fillStyle = mood === "drink" ? "#c8ecff" : "#fff0cd";
        ctx.beginPath();
        ctx.arc(bx, by, (5 + ph * 3.4) * s, 0, TAU);
        ctx.fill();
      }
    } else if (mood === "play") {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 2; i++) {
        const ph = (time * 1.45 + i * 0.5) % 1;
        const hop = Math.abs(Math.sin(ph * Math.PI)) * 58 * s;
        const bx = cx + (i === 0 ? -104 : 104) * s + Math.sin(time * 2.1 + i) * 13 * s;
        const by = cy + 14 * s - hop;
        drawBall(ctx, bx, by, s, i === 0 ? 19 : 15, i === 0 ? "#f2837f" : "#8fc7e8");
      }
      for (let i = 0; i < 4; i++) {
        const ph = (time * 1.1 + i * 0.25) % 1;
        const sx = cx + Math.sin(i * 2.4 + time * 1.2) * 128 * s;
        const sy = cy - 20 * s - ph * 130 * s;
        drawStar(ctx, sx, sy, (7 + 4 * Math.sin(ph * Math.PI)) * s, alpha * (1 - ph) * 0.95);
      }
    } else {
      ctx.globalAlpha = alpha * 0.24;
      ctx.fillStyle = "#8fd0f0";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 18 * s, 122 * s, 20 * s, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = "#bfe8fb";
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 18 * s, 122 * s, 20 * s, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
      for (let i = 0; i < 11; i++) {
        const ph = (time * 0.95 + i * 0.113) % 1;
        const dx = Math.sin(i * 2.31 + time * 0.7) * 128 * s;
        const dy = cy - 180 * s + ph * 214 * s;
        ctx.globalAlpha = alpha * (1 - Math.abs(ph - 0.5) * 0.9) * 0.86;
        ctx.fillStyle = i % 3 === 0 ? "#bfe6ff" : "#79c3ec";
        ctx.beginPath();
        ctx.ellipse(cx + dx, dy, 4.6 * s, 9.5 * s, 0.22, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        const ph = (time * 0.52 + i * 0.19) % 1;
        const bx = cx + Math.sin(i * 1.83 + time * 1.15) * 112 * s;
        const by = cy - 6 * s - ph * 168 * s;
        const r = (7 + i % 3 * 3.5) * s;
        ctx.globalAlpha = alpha * (1 - ph) * 0.82;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.2 * s;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.36)";
        ctx.beginPath();
        ctx.arc(bx - r * 0.32, by - r * 0.34, r * 0.26, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // src/speciesRenderer2d.ts
  var chibiReach = 0;
  var chibiLastTyping = -100;
  var chibiPrevTime = 0;
  var chibiTimeInit = false;
  function pickExpression2d(t, mood, moodAmt, sleep) {
    if (sleep > 0.5) return "idle";
    if (moodAmt > 0.02 && (mood === "happy" || mood === "eat" || mood === "drink" || mood === "play" || mood === "bath")) {
      return "happy";
    }
    const slice = Math.floor(t / 6.5) % 4;
    const within = (t % 6.5 + 6.5) % 6.5;
    if (within > 4.6) return ["happy", "love", "surprised", "worried"][slice];
    return "idle";
  }
  function normHex(c, fallback = "#cccccc") {
    if (!c) return fallback;
    const v = String(c).trim();
    const m3 = v.match(/^#([0-9a-f]{3})$/i);
    if (m3) return "#" + m3[1].split("").map((x) => x + x).join("");
    if (/^#[0-9a-f]{6}$/i.test(v) || /^rgba?\(/i.test(v)) return v;
    return fallback;
  }
  function shade(hex2, amt) {
    const rgb = normHex(hex2).match(/^#([0-9a-f]{6})$/i);
    if (!rgb) return hex2;
    const h = rgb[1];
    const channel = (i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) + amt)));
    return `rgb(${channel(0)},${channel(2)},${channel(4)})`;
  }
  function blob(ctx, x, y, rx, ry, fill, stroke, lw = 5, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  function poly(ctx, pts, fill, stroke, lw = 5) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }
  function strokePath(ctx, color, width, draw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  }
  function drawHeart(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.55, y - r * 0.15, x - r * 0.72, y - r * 1.3, x, y - r * 0.42);
    ctx.bezierCurveTo(x + r * 0.72, y - r * 1.3, x + r * 1.55, y - r * 0.15, x, y + r * 0.9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function drawEye(P, x, y, rx, ry, color = "#24232a") {
    const { ctx, outline } = P;
    const side = x < P.cx ? -1 : 1;
    if (P.expression === "happy" || P.expression === "love") {
      if (P.expression === "love") {
        drawHeart(ctx, x, y, Math.max(rx, ry) * 1.05, "#e56f7f");
      } else {
        strokePath(ctx, outline, Math.max(4, rx * 0.3), () => {
          ctx.moveTo(x - rx * 1.05, y + ry * 0.16);
          ctx.quadraticCurveTo(x, y - ry * 1.18, x + rx * 1.05, y + ry * 0.16);
        });
      }
      return;
    }
    if (P.blink > 0.45 || P.squint > 0.55) {
      strokePath(ctx, outline, 5, () => {
        ctx.moveTo(x - rx, y);
        ctx.quadraticCurveTo(x, y + ry * 0.8, x + rx, y);
      });
      return;
    }
    if (P.expression === "surprised") {
      blob(ctx, x, y, rx * 1.2, ry * 1.28, normHex(color), outline, 2.5);
      blob(ctx, x - rx * 0.34, y - ry * 0.42, Math.max(3, rx * 0.28), Math.max(3, ry * 0.28), "#fff");
      return;
    }
    blob(ctx, x, y, rx, ry, normHex(color), outline, 2.5);
    if (P.s.eyeCatchlight) blob(ctx, x - rx * 0.28, y - ry * 0.3, Math.max(3, rx * 0.23), Math.max(3, ry * 0.23), "#fff");
    if (P.expression === "angry") {
      strokePath(ctx, outline, Math.max(4, rx * 0.28), () => {
        ctx.moveTo(x + side * rx * 1.14, y - ry * 1.05);
        ctx.lineTo(x - side * rx * 0.9, y - ry * 0.34);
      });
    } else if (P.expression === "worried") {
      strokePath(ctx, outline, Math.max(4, rx * 0.26), () => {
        ctx.moveTo(x + side * rx * 1.02, y - ry * 0.72);
        ctx.lineTo(x - side * rx * 0.9, y - ry * 1.14);
      });
      blob(ctx, x + side * rx * 0.92, y + ry * 0.82, Math.max(3, rx * 0.22), Math.max(4, ry * 0.34), "#7fc6e8");
    }
  }
  function mouth(P, x, y, w, smile = true) {
    strokePath(P.ctx, P.s.mouthColor || P.outline, 4, () => {
      P.ctx.moveTo(x - w, y);
      P.ctx.quadraticCurveTo(x, y + (smile ? 22 : 3), x + w, y);
    });
  }
  function drawCat(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const hw = s.contour.headWidth * 150;
    const hy = cy - 40;
    strokePath(ctx, fur, 34, () => {
      ctx.moveTo(cx + 115, cy + 300);
      ctx.quadraticCurveTo(cx + 250, cy + 280, cx + 220, cy + 90);
    });
    blob(ctx, cx, cy + 215, s.contour.bodyChubbiness * 118, 150, fur, outline);
    if (s.bellyBibColor) blob(ctx, cx, cy + 235, 74, 110, s.bellyBibColor);
    [-1, 1].forEach((side) => {
      const ex = cx + side * hw * 0.6;
      poly(ctx, [[ex - 38, hy - 40], [ex + 38, hy - 40], [ex + side * 6, hy - 136 * s.contour.earScale]], fur, outline);
    });
    blob(ctx, cx, hy + 20, hw, 150, fur, outline, 6);
    [-1, 1].forEach((side) => P.eye(cx + side * hw * 0.4, hy + 8, 40, 46, s.eyeColorTop));
    if (s.noseColor) poly(ctx, [[cx - 14, hy + 80], [cx + 14, hy + 80], [cx, hy + 98]], s.noseColor);
    mouth(P, cx, hy + 118, 28);
  }
  function chibi(species) {
    return (p) => drawChibiSpecies(
      p.ctx,
      p.s,
      species,
      p.t,
      p.expression,
      p.blink,
      p.squint,
      p.tapLeft,
      p.tapRight,
      p.reach
    );
  }
  var RENDERERS = {
    cat: chibi("cat"),
    dog: chibi("dog"),
    fox: chibi("fox"),
    panda: chibi("panda"),
    bunny: chibi("bunny"),
    penguin: chibi("penguin"),
    frog: chibi("frog"),
    chiikawa: chibi("chiikawa"),
    grasscow: chibi("grasscow"),
    milkdragon: chibi("milkdragon"),
    capybara: chibi("capybara"),
    loopy: chibi("loopy"),
    bubu: chibi("bubu")
  };
  function renderSpecies2d(ctx, o) {
    const { skin, w, h, time, breath, blink, sleep, squint, mood, moodAmt } = o;
    const typing = Math.max(0, Math.min(1, o.typing ?? 0)) * (1 - sleep * 0.85);
    const tapPhase = time * (9.2 + typing * 4.5);
    const tapLeft = typing * Math.max(0, Math.sin(tapPhase));
    const tapRight = typing * Math.max(0, -Math.sin(tapPhase));
    let reach;
    if (o.handReach !== void 0) {
      reach = Math.max(0, Math.min(1, o.handReach));
    } else {
      if (!chibiTimeInit) {
        chibiTimeInit = true;
        chibiPrevTime = time;
      }
      const dt = Math.max(0, Math.min(0.05, time - chibiPrevTime));
      chibiPrevTime = time;
      if (typing > 0.01) chibiLastTyping = time;
      const want = time - chibiLastTyping < 0.5 ? 1 : 0;
      const rate = want > chibiReach ? 12 : 4.5;
      chibiReach += (want - chibiReach) * (1 - Math.exp(-rate * dt));
      reach = chibiReach;
    }
    const species = resolveSpecies(skin.species);
    const fur = normHex(skin.furColor);
    const outline = skin.outlineColor ? normHex(skin.outlineColor) : shade(fur, -55);
    const k = Math.min(w / 700, h / 720);
    const baseX = w / 2 - 15 * k;
    const baseY = h * 0.97 - 370 * k;
    const isEating = mood === "eat" && moodAmt > 0.01;
    const isDrinking = mood === "drink" && moodAmt > 0.01;
    const hopMood = mood === "happy" || mood === "play" || isEating && (species === "bunny" || species === "penguin");
    const hop = hopMood ? -Math.abs(Math.sin(time * 8.2)) * 26 * moodAmt : 0;
    const lean = mood === "drink" ? 0.09 * moodAmt : mood === "bath" ? Math.sin(time * 9) * 0.05 * moodAmt : 0;
    const bob = Math.sin(time * 1.7) * 3.2 * (1 - sleep * 0.7) + breath * 1.6 * (1 - sleep * 0.5);
    const chewHz = {
      grasscow: 2.6,
      dog: 5.2,
      fox: 4.6,
      panda: 3,
      bunny: 7.5,
      penguin: 5.5,
      frog: 3.4,
      milkdragon: 3.2,
      chiikawa: 5,
      capybara: 2.8,
      loopy: 4,
      bubu: 2.2
    };
    const chew = (Math.sin(time * (chewHz[species] ?? 3.5) * Math.PI * 2) * 0.5 + 0.5) * moodAmt;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.965, 175 * k, 19 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(baseX, baseY + bob + hop * k);
    ctx.scale(k, k);
    if (lean) ctx.rotate(lean);
    if (isEating || isDrinking) {
      const dip = {
        grasscow: 0.075,
        dog: 0.055,
        fox: 0.05,
        panda: 0.045,
        capybara: 0.04,
        bunny: 0.035,
        penguin: 0.03,
        frog: 0.01,
        milkdragon: 0.03,
        chiikawa: 0.025,
        loopy: 0.025,
        bubu: 0.04
      };
      ctx.rotate((isDrinking ? (dip[species] ?? 0.04) * 1.3 : (dip[species] ?? 0.04) + chew * 0.02) * moodAmt);
      ctx.translate(0, (isDrinking ? 10 : 6) * moodAmt);
    }
    if (sleep > 0.6) ctx.rotate(-0.03 * sleep);
    const P = {
      ctx,
      cx: 0,
      cy: 0,
      s: skin,
      fur,
      outline,
      blink: Math.max(blink, sleep),
      squint,
      t: time,
      mood,
      moodAmt,
      expression: pickExpression2d(time, mood, moodAmt, sleep),
      tapLeft,
      tapRight,
      reach,
      eye: (x, y, rx, ry, color) => drawEye(P, x, y, rx, ry, color)
    };
    (RENDERERS[species] || drawCat)(P);
    drawCareScene2D(ctx, {
      cx: 0,
      cy: 300,
      s: 1,
      time,
      mood,
      amt: moodAmt
    });
    ctx.restore();
  }
  function renderSpeciesPreview2d(ctx, raw, w, h) {
    renderSpecies2d(ctx, {
      skin: resolveCustomSkin(raw),
      w,
      h,
      time: 0,
      breath: 0,
      blink: 0,
      sleep: 0,
      squint: 0,
      mood: "idle",
      moodAmt: 0,
      typing: 0
    });
  }

  // tools/species-preview-entry.ts
  window.KuroSpecies2D = {
    render: renderSpeciesPreview2d,
    renderWith: (ctx, skin, w, h, time, mood, typing, handReach) => renderSpecies2d(ctx, {
      skin: resolveCustomSkin(skin),
      w,
      h,
      time,
      breath: 0,
      blink: 0,
      sleep: 0,
      squint: 0,
      mood,
      moodAmt: mood === "idle" ? 0 : 1,
      typing,
      handReach
    })
  };
})();
