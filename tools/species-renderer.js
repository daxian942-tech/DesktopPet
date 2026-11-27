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
  function parseHexLuminance(hex) {
    const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return 0.5;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  function isLightColor(hex) {
    return parseHexLuminance(hex) > 0.48;
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

  // src/speciesRenderer2d.ts
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
  function beat(t, period, start, end) {
    const c = (t % period + period) % period;
    if (c <= start || c >= end) return 0;
    const x = (c - start) / (end - start);
    const s = Math.sin(Math.PI * x);
    return s * s;
  }
  function followBeat2d(t, period, start, end, lag) {
    return beat(t - lag, period, start, end);
  }
  function normHex(c, fallback = "#cccccc") {
    if (!c) return fallback;
    const v = String(c).trim();
    const m3 = v.match(/^#([0-9a-f]{3})$/i);
    if (m3) return "#" + m3[1].split("").map((x) => x + x).join("");
    if (/^#[0-9a-f]{6}$/i.test(v) || /^rgba?\(/i.test(v)) return v;
    return fallback;
  }
  function shade(hex, amt) {
    const rgb = normHex(hex).match(/^#([0-9a-f]{6})$/i);
    if (!rgb) return hex;
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
  function limb(ctx, x, y, bend, foot, color, outline, width) {
    strokePath(ctx, outline, width + 8, () => {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + bend, y + 48, foot, 342);
    });
    strokePath(ctx, color, width, () => {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + bend, y + 48, foot, 342);
    });
  }
  function softLimb2d(ctx, x, y, opts) {
    const { width: w, fur, outline, side } = opts;
    const tap = Math.max(0, Math.min(1, opts.tap ?? 0));
    const upperLen = opts.length * 0.56;
    const lowerLen = opts.length * 0.44;
    const lowerW = w * 0.82;
    ctx.save();
    ctx.translate(x, y - tap * 16);
    ctx.rotate(opts.shoulder - side * tap * 0.26);
    blob(ctx, 0, 0, w * 0.62, w * 0.62, fur, outline, 4);
    strokePath(ctx, outline, w + 9, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(side * w * 0.12, upperLen);
    });
    strokePath(ctx, fur, w, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(side * w * 0.12, upperLen);
    });
    ctx.translate(side * w * 0.12, upperLen);
    ctx.rotate(opts.elbow + side * tap * 0.34);
    blob(ctx, 0, 0, lowerW * 0.6, lowerW * 0.6, fur, outline, 3.5);
    strokePath(ctx, outline, lowerW + 8, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, lowerLen);
    });
    strokePath(ctx, fur, lowerW, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, lowerLen);
    });
    ctx.translate(0, lowerLen);
    blob(ctx, 0, opts.pawRy * 0.28, opts.pawRx, opts.pawRy, opts.pawColor, outline, 3.5);
    if (opts.clawColor && opts.clawCount) {
      for (let i = 0; i < opts.clawCount; i++) {
        const dx = (i - (opts.clawCount - 1) / 2) * (opts.pawRx * 0.72);
        blob(ctx, dx, opts.pawRy * 0.62, opts.pawRx * 0.2, opts.pawRy * 0.24, opts.clawColor);
      }
    }
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
  function mouthArc(P, x, y, w, cornerY, depth = 14) {
    strokePath(P.ctx, P.s.mouthColor || P.outline, 4, () => {
      P.ctx.moveTo(x - w, y + cornerY);
      P.ctx.quadraticCurveTo(x, y + depth, x + w, y + cornerY);
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
  function drawDog(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const cream = s.bellyBibColor || "#f6e8d2";
    const ear = s.earOuterColor || shade(fur, -30);
    strokePath(ctx, outline, 45, () => {
      ctx.moveTo(cx + 155, cy + 185);
      ctx.quadraticCurveTo(cx + 265, cy + 115, cx + 220, cy + 20);
    });
    strokePath(ctx, fur, 35, () => {
      ctx.moveTo(cx + 155, cy + 185);
      ctx.quadraticCurveTo(cx + 265, cy + 115, cx + 220, cy + 20);
    });
    [-90, -25, 85, 145].forEach((x, i) => limb(ctx, cx + x, cy + 205, i % 2 ? -8 : 8, cx + x + (i < 2 ? -8 : 8), i < 2 ? cream : fur, outline, 38));
    blob(ctx, cx + 30, cy + 180, 190, 105, fur, outline, 6, -0.04);
    blob(ctx, cx - 48, cy + 205, 65, 82, cream, void 0, 5, -0.25);
    blob(ctx, cx - 122, cy + 25, 124, 112, fur, outline, 6);
    [-1, 1].forEach((side) => {
      const ex = cx - 122 + side * 105;
      blob(ctx, ex, cy + 40, 42, 98, ear, outline, 5, side * 0.24);
    });
    blob(ctx, cx - 122, cy + 83, 70, 52, cream, outline, 4);
    blob(ctx, cx - 122, cy + 52, 29, 20, s.noseColor || "#26211f");
    [-1, 1].forEach((side) => P.eye(cx - 122 + side * 52, cy + 5, 20, 25, s.eyeColorTop));
    mouth(P, cx - 122, cy + 91, 34);
    blob(ctx, cx - 122, cy + 119, 18, 25, "#ef8e9e");
  }
  function drawFox(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const pale = s.bellyBibColor || "#fdf6e8";
    const dark = s.earTipColor || "#3a261c";
    ctx.save();
    ctx.translate(cx + 170, cy + 160);
    ctx.rotate(-0.3);
    blob(ctx, 85, 0, 155, 82, fur, outline, 6);
    poly(ctx, [[170, -60], [245, -5], [175, 52], [195, 0]], pale, outline, 4);
    ctx.restore();
    [-95, -35, 80, 140].forEach((x) => limb(ctx, cx + x, cy + 220, 4, cx + x, dark, outline, 27));
    blob(ctx, cx + 30, cy + 195, 185, 78, fur, outline, 6, -0.05);
    poly(ctx, [[cx - 218, cy - 42], [cx - 188, cy - 175], [cx - 108, cy - 70]], fur, outline, 6);
    poly(ctx, [[cx - 100, cy - 70], [cx - 30, cy - 176], [cx - 20, cy - 35]], fur, outline, 6);
    poly(ctx, [[cx - 200, cy - 72], [cx - 184, cy - 146], [cx - 140, cy - 79]], dark);
    poly(ctx, [[cx - 83, cy - 80], [cx - 39, cy - 146], [cx - 35, cy - 60]], dark);
    poly(ctx, [[cx - 226, cy - 52], [cx - 122, cy - 92], [cx - 18, cy - 48], [cx - 52, cy + 80], [cx - 122, cy + 142], [cx - 193, cy + 75]], fur, outline, 6);
    poly(ctx, [[cx - 207, cy + 28], [cx - 122, cy + 72], [cx - 37, cy + 28], [cx - 70, cy + 105], [cx - 122, cy + 142], [cx - 174, cy + 103]], pale);
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(cx - 122 + side * 54, cy - 12);
      ctx.rotate(-side * 0.28);
      if (P.blink > 0.45) strokePath(ctx, outline, 5, () => {
        ctx.moveTo(-24, 0);
        ctx.lineTo(24, 0);
      });
      else {
        blob(ctx, 0, 0, 28, 13, s.eyeColorTop, outline, 3);
        blob(ctx, 0, 0, 7, 11, "#19181b");
      }
      ctx.restore();
    });
    blob(ctx, cx - 122, cy + 119, 20, 13, s.noseColor || "#2b211c");
  }
  function drawPanda(P) {
    const { ctx, cx, cy, fur, outline } = P;
    const black = "#1c1c1e";
    blob(ctx, cx + 202, cy + 170, 28, 28, fur, outline, 4);
    [-100, -32, 82, 145].forEach((x) => limb(ctx, cx + x, cy + 205, 0, cx + x, black, outline, 48));
    blob(ctx, cx + 30, cy + 180, 188, 115, fur, outline, 6);
    blob(ctx, cx - 65, cy + 190, 65, 112, black, void 0, 5, 0.1);
    [-1, 1].forEach((side) => blob(ctx, cx - 122 + side * 91, cy - 63, 43, 43, black, outline, 5));
    blob(ctx, cx - 122, cy + 18, 125, 112, fur, outline, 6);
    [-1, 1].forEach((side) => {
      blob(ctx, cx - 122 + side * 51, cy + 5, 37, 47, black, void 0, 5, side * 0.35);
      P.eye(cx - 122 + side * 51, cy + 4, 12, 15, "#f7f7f2");
    });
    blob(ctx, cx - 122, cy + 62, 23, 16, black);
    mouth(P, cx - 122, cy + 82, 24, false);
  }
  function drawBunny(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const inner = s.earInnerColor || "#f2b8c6";
    blob(ctx, cx + 205, cy + 190, 45, 45, s.tailTipColor || "#fff", outline, 5);
    blob(ctx, cx + 50, cy + 195, 155, 130, fur, outline, 6, -0.12);
    blob(ctx, cx + 125, cy + 260, 100, 92, fur, outline, 5);
    blob(ctx, cx + 135, cy + 333, 105, 32, fur, outline, 5, -0.08);
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(cx - 105 + side * 48, cy - 38);
      ctx.rotate(side * 0.1);
      blob(ctx, 0, -115, 34, 150, fur, outline, 5);
      blob(ctx, 0, -120, 15, 120, inner);
      ctx.restore();
    });
    blob(ctx, cx - 95, cy + 38, 105, 100, fur, outline, 6);
    blob(ctx, cx - 62, cy + 180, 55, 118, fur, outline, 5, -0.15);
    limb(ctx, cx - 75, cy + 220, -12, cx - 88, fur, outline, 26);
    limb(ctx, cx - 25, cy + 220, -10, cx - 40, fur, outline, 26);
    [-1, 1].forEach((side) => P.eye(cx - 95 + side * 43, cy + 20, 19, 24, s.eyeColorTop));
    poly(ctx, [[cx - 110, cy + 62], [cx - 80, cy + 62], [cx - 95, cy + 77]], s.noseColor || "#f08a9e");
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 109, cy + 82, 28, 28);
    ctx.strokeRect(cx - 109, cy + 82, 28, 28);
    strokePath(ctx, outline, 2, () => {
      ctx.moveTo(cx - 95, cy + 82);
      ctx.lineTo(cx - 95, cy + 110);
    });
  }
  function drawPenguin(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const white = s.bellyBibColor || "#fbfbf7";
    const orange = s.noseColor || "#f0a020";
    [-1, 1].forEach((side) => {
      poly(ctx, [[cx + side * 115, cy - 15], [cx + side * 190, cy + 175], [cx + side * 112, cy + 125]], fur, outline, 5);
      blob(ctx, cx + side * 62, cy + 342, 78, 25, orange, outline, 4, side * 0.1);
    });
    ctx.beginPath();
    ctx.moveTo(cx, cy - 220);
    ctx.bezierCurveTo(cx + 145, cy - 205, cx + 160, cy + 175, cx + 92, cy + 325);
    ctx.quadraticCurveTo(cx, cy + 360, cx - 92, cy + 325);
    ctx.bezierCurveTo(cx - 160, cy + 175, cx - 145, cy - 205, cx, cy - 220);
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 6;
    ctx.stroke();
    blob(ctx, cx, cy + 100, 100, 205, white);
    [-1, 1].forEach((side) => {
      blob(ctx, cx + side * 48, cy - 115, 28, 33, white);
      P.eye(cx + side * 48, cy - 116, 11, 14, "#111318");
    });
    poly(ctx, [[cx - 34, cy - 67], [cx + 34, cy - 67], [cx, cy - 10]], orange, outline, 3);
  }
  function drawFrog(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const pale = s.bellyBibColor || "#d8efb4";
    [-1, 1].forEach((side) => {
      blob(ctx, cx + side * 155, cy + 240, 105, 78, fur, outline, 6, side * 0.35);
      strokePath(ctx, outline, 39, () => {
        ctx.moveTo(cx + side * 130, cy + 245);
        ctx.quadraticCurveTo(cx + side * 220, cy + 260, cx + side * 235, cy + 330);
      });
      strokePath(ctx, fur, 29, () => {
        ctx.moveTo(cx + side * 130, cy + 245);
        ctx.quadraticCurveTo(cx + side * 220, cy + 260, cx + side * 235, cy + 330);
      });
      for (let i = -1; i <= 1; i++) blob(ctx, cx + side * (235 + i * 18), cy + 338, 24, 12, fur, outline, 3);
      limb(ctx, cx + side * 90, cy + 170, side * 20, cx + side * 115, fur, outline, 24);
    });
    blob(ctx, cx, cy + 205, 175, 110, fur, outline, 6);
    blob(ctx, cx, cy + 220, 120, 78, pale);
    blob(ctx, cx, cy + 65, 180, 92, fur, outline, 6);
    [-1, 1].forEach((side) => {
      const ex = cx + side * 105;
      blob(ctx, ex, cy - 30, 58, 62, fur, outline, 5);
      blob(ctx, ex, cy - 28, 34, 38, "#f5f5e8", outline, 3);
      P.eye(ex, cy - 24, 14, 20, "#16210f");
    });
    strokePath(ctx, outline, 7, () => {
      ctx.moveTo(cx - 130, cy + 82);
      ctx.quadraticCurveTo(cx, cy + 150, cx + 130, cy + 82);
    });
    blob(ctx, cx - 25, cy + 45, 6, 4, outline);
    blob(ctx, cx + 25, cy + 45, 6, 4, outline);
  }
  function drawChiikawa(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const blue = "#8fb3cc";
    const cower = beat(P.t, 7.8, 3.6, 5.8) * 0.7;
    ctx.save();
    ctx.translate(0, cower * 12);
    ctx.rotate(cower * 0.02);
    blob(ctx, cx + 118, cy + 190, 36, 36, blue, outline, 4);
    blob(ctx, cx, cy + 215, 110, 120, fur, outline, 5);
    [-1, 1].forEach((rawSide) => {
      const side = rawSide;
      const elbow = followBeat2d(P.t, 7.8, 3.6, 5.8, 0.12) * 0.7;
      const wrist = followBeat2d(P.t, 7.8, 3.6, 5.8, 0.24) * 0.7;
      softLimb2d(ctx, cx + side * 98, cy + 152, {
        length: 96,
        width: 38,
        shoulder: side * (0.12 + cower * 0.42),
        elbow: side * (0.1 + elbow * 0.24 + wrist * 0.08),
        pawRx: 27,
        pawRy: 20,
        fur,
        pawColor: fur,
        outline,
        side,
        tap: side < 0 ? P.tapLeft : P.tapRight
      });
      softLimb2d(ctx, cx + side * 46, cy + 278, {
        length: 48,
        width: 42,
        shoulder: 0,
        elbow: 0,
        pawRx: 40,
        pawRy: 22,
        fur,
        pawColor: shade(fur, -8),
        outline,
        side
      });
      blob(ctx, cx + side * 103, cy - 155, 38, 37, fur, outline, 5);
    });
    blob(ctx, cx, cy - 40, 160, 145, fur, outline, 6);
    blob(ctx, cx - 66, cy - 158, 62, 43, blue, outline, 5, -0.22);
    blob(ctx, cx + 66, cy - 158, 62, 43, blue, outline, 5, 0.22);
    blob(ctx, cx, cy - 150, 22, 20, blue, outline, 4);
    strokePath(ctx, blue, 18, () => {
      ctx.moveTo(cx - 108, cy - 130);
      ctx.quadraticCurveTo(cx, cy - 92, cx + 108, cy - 130);
    });
    [-1, 1].forEach((side) => {
      P.eye(cx + side * 60, cy - 50, 17, 23, s.eyeColorTop);
      if (s.blushColor) {
        blob(ctx, cx + side * 106, cy + 10, 27, 14, s.blushColor || "#ffb3bf");
        for (let i = 0; i < 3; i++) {
          strokePath(ctx, "#e0708c", 3, () => {
            ctx.moveTo(cx + side * (94 + i * 11), cy + 2);
            ctx.lineTo(cx + side * (97 + i * 11), cy + 18);
          });
        }
      }
    });
    strokePath(ctx, s.mouthColor || outline, 4, () => {
      ctx.moveTo(cx - 19, cy + 26);
      ctx.quadraticCurveTo(cx - 9, cy + 39, cx, cy + 28);
      ctx.quadraticCurveTo(cx + 9, cy + 39, cx + 19, cy + 26);
    });
    blob(ctx, cx, cy + 48, 5, 5, s.mouthColor || outline);
    ctx.restore();
  }
  function drawGrassCow(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const dark = s.furSecondaryColor || "#1b1b1e";
    const shock = beat(P.t, 8.4, 2.8, 4.8);
    ctx.save();
    ctx.translate(0, shock * 12);
    blob(ctx, cx, cy + 195, 150, 100, fur, outline, 6);
    blob(ctx, cx - 125, cy + 175, 45, 45, dark, void 0, 4, 0.3);
    [-95, -35, 40, 100].forEach((x, i) => {
      const side = i < 2 ? -1 : 1;
      const delayed = followBeat2d(P.t, 8.4, 2.8, 4.8, i % 2 === 0 ? 0.1 : 0.22);
      softLimb2d(ctx, cx + x, cy + 258, {
        length: 70,
        width: 34,
        shoulder: 0,
        elbow: side * delayed * 0.1,
        pawRx: 24,
        pawRy: 14,
        fur,
        pawColor: dark,
        outline,
        side
      });
    });
    blob(ctx, cx - 158, cy - 55, 52, 26, "#6d6d70", outline, 5, -0.25);
    blob(ctx, cx + 158, cy - 55, 52, 26, "#6d6d70", outline, 5, 0.25);
    blob(ctx, cx, cy + 10, 152, 128, fur, outline, 6);
    blob(ctx, cx - 95, cy - 78, 62, 35, dark, void 0, 5, -0.25);
    blob(ctx, cx + 100, cy - 74, 45, 30, dark, void 0, 5, 0.22);
    ctx.save();
    ctx.translate(cx, cy - 103);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
    strokePath(ctx, dark, 10, () => {
      ctx.moveTo(cx, cy - 92);
      ctx.lineTo(cx, cy - 38);
    });
    [-1, 1].forEach((side) => {
      P.eye(cx + side * 58, cy - 10 + shock * 4, 13, 17 + shock * 5, s.eyeColorTop);
      strokePath(ctx, dark, 13, () => {
        ctx.moveTo(cx + side * 22, cy - 55);
        ctx.lineTo(cx + side * 108, cy - 82);
      });
    });
    blob(ctx, cx, cy + 66, 78, 44, s.noseColor || "#e8a0a8", outline, 4);
    [-1, 1].forEach((side) => blob(ctx, cx + side * 30, cy + 58, 9, 7, "#9d5d68"));
    blob(ctx, cx, cy + 116, 32, 39, "#2b1f22", "#d98fa0", 7);
    blob(ctx, cx, cy + 153, 9, 5, "#2b1f22");
    ctx.restore();
  }
  function drawMilkDragon(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const pale = s.bellyBibColor || "#fff0b8";
    const wobble = Math.sin(P.t * 2.5) * 0.04;
    const duang = beat(P.t, 8.6, 3.2, 5.4);
    blob(ctx, cx, cy + 200, 158, 156, fur, outline, 6);
    ctx.save();
    ctx.translate(cx, cy + 224);
    ctx.scale(1 + wobble + duang * 0.08, 1 - wobble * 0.7 - duang * 0.06);
    blob(ctx, 0, 0, 100, 116, pale);
    ctx.restore();
    [-1, 1].forEach((rawSide) => {
      const side = rawSide;
      const wave = duang * 10 + Math.sin(P.t * 2.6 + side) * 5;
      const elbow = followBeat2d(P.t, 8.6, 3.2, 5.4, 0.12);
      const wrist = followBeat2d(P.t, 8.6, 3.2, 5.4, 0.24);
      softLimb2d(ctx, cx + side * 116, cy + 158 - wave, {
        length: 96,
        width: 46,
        shoulder: -side * (0.42 + duang * 0.16),
        elbow: -side * (0.1 + elbow * 0.26 + wrist * 0.1),
        pawRx: 30,
        pawRy: 22,
        fur,
        pawColor: fur,
        outline,
        clawColor: "#6b3a1f",
        clawCount: 3,
        side,
        tap: side < 0 ? P.tapLeft : P.tapRight
      });
      softLimb2d(ctx, cx + side * 70, cy + 272, {
        length: 56,
        width: 52,
        shoulder: 0,
        elbow: 0,
        pawRx: 46,
        pawRy: 24,
        fur,
        pawColor: fur,
        outline,
        clawColor: "#6b3a1f",
        clawCount: 3,
        side
      });
    });
    blob(ctx, cx, cy - 42, 154, 132, fur, outline, 6);
    [-1, 1].forEach((side) => {
      P.eye(cx + side * 60, cy - 54, 23, 27, "#151515");
    });
    mouthArc(P, cx, cy + 42, 30, 3, 12);
  }
  function drawCapybara(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const dark = shade(fur, -22);
    const wave = beat(P.t, 6.4, 2, 4.6);
    const lean = Math.sin(P.t * 0.48) * 0.03;
    ctx.save();
    ctx.rotate(lean);
    [-90, -30, 55, 115].forEach((x, i) => {
      const side = i < 2 ? -1 : 1;
      softLimb2d(ctx, cx + x, cy + 272, {
        length: 64,
        width: 38,
        shoulder: 0,
        elbow: 0,
        pawRx: 24,
        pawRy: 16,
        fur: dark,
        pawColor: dark,
        outline,
        side
      });
    });
    blob(ctx, cx + 15, cy + 205, 190, 105, fur, outline, 6);
    blob(ctx, cx + 15, cy + 258, 145, 42, "#a9602e", outline, 5);
    strokePath(ctx, shade("#a9602e", -22), 4, () => {
      ctx.moveTo(cx - 55, cy + 275);
      ctx.quadraticCurveTo(cx - 20, cy + 248, cx + 5, cy + 272);
      ctx.moveTo(cx + 55, cy + 275);
      ctx.quadraticCurveTo(cx + 88, cy + 250, cx + 110, cy + 270);
    });
    const capyElbow = followBeat2d(P.t, 6.4, 2, 4.6, 0.12);
    const capyWrist = followBeat2d(P.t, 6.4, 2, 4.6, 0.24);
    softLimb2d(ctx, cx + 155, cy + 205, {
      length: 88,
      width: 42,
      shoulder: -0.95 - wave * 0.35,
      elbow: -(capyElbow * 0.28 + capyWrist * 0.12),
      pawRx: 24,
      pawRy: 18,
      fur,
      pawColor: fur,
      outline,
      side: 1,
      tap: P.tapRight
    });
    ctx.save();
    ctx.translate(cx - 20, cy + 55);
    ctx.rotate(lean + wave * 0.02);
    blob(ctx, 0, -8, 106, 110, fur, outline, 6);
    blob(ctx, 0, 40, 100, 80, "#f59b1f", outline, 6);
    [-1, 1].forEach((side) => {
      blob(ctx, side * 73, -82, 24, 22, dark, outline, 4);
      blob(ctx, side * 71, -86, 11, 10, shade(fur, -34));
      P.eye(side * 47, -14, 12, 15, "#151515");
    });
    mouthArc(P, 0, 68, 22, 4, 14);
    ctx.restore();
    const ox = cx - 20 + Math.sin(P.t * 0.9) * 7;
    ctx.save();
    ctx.translate(ox, cy - 82);
    ctx.rotate(Math.sin(P.t * 1.35) * 0.12 + lean);
    blob(ctx, 0, 0, 34, 31, "#f5883a", outline, 4);
    blob(ctx, -10, -8, 12, 8, "#ffd06b");
    strokePath(ctx, "#5a8f32", 5, () => {
      ctx.moveTo(2, -26);
      ctx.lineTo(12, -40);
    });
    blob(ctx, 19, -38, 12, 6, "#68a541", void 0, 0, -0.5);
    ctx.restore();
    ctx.restore();
  }
  function drawLoopy(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const darkPaw = "#51283c";
    const wave = beat(P.t, 9.2, 3.8, 6.6);
    ctx.save();
    ctx.translate(cx + 165, cy + 270);
    ctx.rotate(-0.45 + Math.sin(P.t * 1.8) * 0.05);
    blob(ctx, 60, 25, 105, 55, shade(fur, -20), outline, 5);
    for (let i = -2; i <= 2; i++) {
      strokePath(ctx, shade(fur, -38), 3, () => {
        ctx.moveTo(i * 32 + 60, -12);
        ctx.lineTo(i * 32 + 92, 62);
      });
      strokePath(ctx, shade(fur, -38), 3, () => {
        ctx.moveTo(i * 32 + 60, 62);
        ctx.lineTo(i * 32 + 92, -12);
      });
    }
    ctx.restore();
    blob(ctx, cx, cy + 205, 135, 140, fur, outline, 5);
    blob(ctx, cx, cy + 240, 82, 92, "#f3e3e6");
    [-1, 1].forEach((rawSide) => {
      const side = rawSide;
      const raised = side < 0;
      const elbow = followBeat2d(P.t, 9.2, 3.8, 6.6, 0.12);
      const wrist = followBeat2d(P.t, 9.2, 3.8, 6.6, 0.24);
      softLimb2d(ctx, cx + side * 122, cy + 158, {
        length: 96,
        width: 42,
        shoulder: raised ? 0.85 + wave * 0.3 : -side * 0.15,
        elbow: raised ? elbow * 0.28 + wrist * 0.12 : -side * (0.08 + elbow * 0.1),
        pawRx: 24,
        pawRy: 18,
        fur,
        pawColor: darkPaw,
        outline,
        clawColor: darkPaw,
        clawCount: 3,
        side,
        tap: side < 0 ? P.tapLeft : P.tapRight
      });
      softLimb2d(ctx, cx + side * 62, cy + 280, {
        length: 52,
        width: 46,
        shoulder: 0,
        elbow: 0,
        pawRx: 42,
        pawRy: 22,
        fur,
        pawColor: darkPaw,
        outline,
        side
      });
      blob(ctx, cx + side * 140, cy - 80, 31, 33, fur, outline, 4);
      blob(ctx, cx + side * 140, cy - 80, 15, 16, "#f7d9df", outline, 2);
    });
    blob(ctx, cx, cy - 35, 155, 135, fur, outline, 6);
    [-1, 1].forEach((side) => {
      const sway = Math.sin(P.t * 2.1 + side) * 8;
      poly(ctx, [
        [cx + side * 18, cy - 156],
        [cx + side * 50, cy - 214],
        [cx + side * 40 + sway, cy - 252],
        [cx + side * 30 + sway, cy - 210]
      ], "#e8752f", outline, 3);
      blob(ctx, cx + side * 40 + sway, cy - 250, 11, 13, "#e8752f");
    });
    [-1, 1].forEach((side) => {
      P.eye(cx + side * 60, cy - 45, 17, 22, "#151515");
    });
    blob(ctx, cx, cy + 12, 26, 21, "#6d1d53", outline, 3);
    blob(ctx, cx, cy + 58, 36, 26, "#7a2a48", outline, 3);
    ctx.fillStyle = "#fffdf5";
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.fillRect(cx - 20, cy + 46, 17, 18);
    ctx.strokeRect(cx - 20, cy + 46, 17, 18);
    ctx.fillRect(cx + 3, cy + 46, 17, 18);
    ctx.strokeRect(cx + 3, cy + 46, 17, 18);
  }
  function drawBubu(P) {
    const { ctx, cx, cy, s, fur, outline } = P;
    const nod = Math.sin(P.t * 0.85) * 5;
    const wave = beat(P.t, 7.6, 3.4, 5.8);
    blob(ctx, cx, cy + 205, 140, 145, fur, outline, 5);
    blob(ctx, cx - 34, cy + 118, 38, 24, "#f2c14e", outline, 4, -0.18);
    blob(ctx, cx + 34, cy + 118, 38, 24, "#f2c14e", outline, 4, 0.18);
    blob(ctx, cx, cy + 118, 15, 15, "#f2c14e", outline, 3);
    [-1, 1].forEach((rawSide) => {
      const side = rawSide;
      const elbow = followBeat2d(P.t, 7.6, 3.4, 5.8, 0.12);
      const wrist = followBeat2d(P.t, 7.6, 3.4, 5.8, 0.24);
      softLimb2d(ctx, cx + side * 118, cy + 158 - (side > 0 ? wave * 28 : 0), {
        length: 104,
        width: 46,
        shoulder: -side * (0.15 + (side > 0 ? wave * 0.72 : 0)),
        elbow: -side * (0.1 + elbow * 0.22 + wrist * 0.1),
        pawRx: 30,
        pawRy: 22,
        fur,
        pawColor: shade(fur, -12),
        outline,
        side,
        tap: side < 0 ? P.tapLeft : P.tapRight
      });
      softLimb2d(ctx, cx + side * 62, cy + 275, {
        length: 56,
        width: 48,
        shoulder: 0,
        elbow: 0,
        pawRx: 42,
        pawRy: 22,
        fur,
        pawColor: shade(fur, -20),
        outline,
        side
      });
      blob(ctx, cx + side * 108, cy - 150, 50, 50, fur, outline, 5);
      blob(ctx, cx + side * 108, cy - 150, 25, 25, s.earInnerColor || "#5b3a24");
    });
    strokePath(ctx, "#6b9a4a", 7, () => {
      ctx.moveTo(cx - 150, cy + 200);
      ctx.lineTo(cx - 176, cy + 118);
    });
    blob(ctx, cx - 162, cy + 165, 24, 11, "#6b9a4a", void 0, 0, -0.5);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      blob(ctx, cx - 176 + Math.cos(a) * 20, cy + 100 + Math.sin(a) * 20, 20, 20, "#e05260", outline, 2);
    }
    blob(ctx, cx - 176, cy + 100, 14, 14, "#e05260", outline, 2);
    ctx.save();
    ctx.translate(0, nod + wave * 3);
    blob(ctx, cx, cy - 35, 150, 135, fur, outline, 6);
    [-1, 1].forEach((side) => {
      P.eye(cx + side * 58, cy - 45, 12, 15, "#151515");
      blob(ctx, cx + side * 112, cy + 8, 33, 21, "#e6a96f");
      for (let i = 0; i < 2; i++) {
        strokePath(ctx, "#c9864f", 3, () => {
          ctx.moveTo(cx + side * (99 + i * 14), cy + 1);
          ctx.lineTo(cx + side * (103 + i * 14), cy + 16);
        });
      }
    });
    strokePath(ctx, s.mouthColor || outline, 3.5, () => {
      ctx.moveTo(cx - 16, cy + 30);
      ctx.quadraticCurveTo(cx - 8, cy + 40, cx, cy + 30);
      ctx.quadraticCurveTo(cx + 8, cy + 40, cx + 16, cy + 30);
    });
    ctx.restore();
  }
  var RENDERERS = {
    cat: drawCat,
    dog: drawDog,
    fox: drawFox,
    panda: drawPanda,
    bunny: drawBunny,
    penguin: drawPenguin,
    frog: drawFrog,
    chiikawa: drawChiikawa,
    grasscow: drawGrassCow,
    milkdragon: drawMilkDragon,
    capybara: drawCapybara,
    loopy: drawLoopy,
    bubu: drawBubu
  };
  function renderSpecies2d(ctx, o) {
    const { skin, w, h, time, breath, blink, sleep, squint, mood, moodAmt } = o;
    const typing = Math.max(0, Math.min(1, o.typing ?? 0)) * (1 - sleep * 0.85);
    const tapPhase = time * (9.2 + typing * 4.5);
    const tapLeft = typing * Math.max(0, Math.sin(tapPhase));
    const tapRight = typing * Math.max(0, -Math.sin(tapPhase));
    const species = resolveSpecies(skin.species);
    const fur = normHex(skin.furColor);
    const outline = skin.outlineColor ? normHex(skin.outlineColor) : shade(fur, -55);
    const k = Math.min(w / 700, h / 720);
    const baseX = w / 2 - 15 * k;
    const baseY = h * 0.97 - 370 * k;
    const hopMood = mood === "happy" || mood === "eat" || mood === "play";
    const hop = hopMood ? -Math.abs(Math.sin(time * 8.2)) * 26 * moodAmt : 0;
    const lean = mood === "drink" ? 0.09 * moodAmt : mood === "bath" ? Math.sin(time * 9) * 0.05 * moodAmt : 0;
    const bob = Math.sin(time * 1.7) * 3.2 * (1 - sleep * 0.7) + breath * 1.6 * (1 - sleep * 0.5);
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
      eye: (x, y, rx, ry, color) => drawEye(P, x, y, rx, ry, color)
    };
    (RENDERERS[species] || drawCat)(P);
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
      moodAmt: mood === "idle" ? 0 : 1,
      typing
    })
  };
})();
