/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 8.0 - Safe Render Engine]
 * - 방어적 Canvas 렌더링 검증 적용 (IndexSizeError 및 NaN 예외 완벽 차단)
 * - 단일 수묵 베일 + 가장자리 은은한 마름 테두리선 채색
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 8.0 (Safe Engine)";

    this.inkVeils = [];
    this.loadedSeed = -1;

    this.init();
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  pseudoRandom(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  valueNoise(x, y) {
    let ix = Math.floor(x); let iy = Math.floor(y);
    let fx = x - ix; let fy = y - iy;
    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uy = fy * fy * (3.0 - 2.0 * fy);

    let a = this.pseudoRandom(ix, iy);
    let b = this.pseudoRandom(ix + 1, iy);
    let c = this.pseudoRandom(ix, iy + 1);
    let d = this.pseudoRandom(ix + 1, iy + 1);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  fbmNoise(x, y) {
    let value = 0; let amplitude = 0.5; let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.valueNoise(x * frequency, y * frequency);
      frequency *= 2.0; amplitude *= 0.5;
    }
    return value;
  }

  domainWarp2D(x, y, time) {
    let qx = this.fbmNoise(x + time * 0.08, y + 1.2);
    let qy = this.fbmNoise(x + 2.8, y + time * 0.08);
    let rx = this.fbmNoise(x + 4.0 * qx + 1.7, y + 4.0 * qy + 9.2);
    let ry = this.fbmNoise(x + 4.0 * qx + 8.3, y + 4.0 * qy + 2.8);
    return {
      x: isNaN(rx) ? 0 : rx - 0.5,
      y: isNaN(ry) ? 0 : ry - 0.5
    };
  }

  generateVeils(seed, W, H) {
    this.inkVeils = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const veilCount = 8;
    for (let i = 0; i < veilCount; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);
      const r4 = pseudoRand(seed + i * 7.9);

      this.inkVeils.push({
        cx: (0.1 + r1 * 0.8) * W,
        cy: (0.15 + r2 * 0.7) * H,
        baseRadiusX: Math.max(50, (180 + r3 * 300) * (Math.min(W, H) / 1000)),
        baseRadiusY: Math.max(50, (120 + r4 * 250) * (Math.min(W, H) / 1000)),
        anchorCount: 100,
        rotation: r1 * Math.PI * 2,
        driftSpeedX: (r1 - 0.5) * 40,
        driftSpeedY: (r2 - 0.5) * 40,
        seedOffset: seed + i * 29.3
      });
    }
  }

  drawSingleInkVeil(ctx, veil, time, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, shatterVal, isDark) {
    ctx.save();

    const vVol = isNaN(vocalVol) ? 0 : vocalVol;
    const dVol = isNaN(drumVol) ? 0 : drumVol;
    const bVol = isNaN(bassVol) ? 0 : bassVol;

    const driftX = Math.sin(time * 0.15 + veil.seedOffset) * veil.driftSpeedX * (shatterVal * 0.008);
    const driftY = Math.cos(time * 0.18 + veil.seedOffset) * veil.driftSpeedY * (shatterVal * 0.008);

    ctx.translate(veil.cx + driftX, veil.cy + driftY);
    ctx.rotate(veil.rotation + Math.sin(time * 0.05) * 0.1);

    const radX = Math.max(10, veil.baseRadiusX * (1.0 + vVol * 1.2 + dVol * 0.5));
    const radY = Math.max(10, veil.baseRadiusY * (1.0 + vVol * 1.2 + dVol * 0.5));

    const N = veil.anchorCount;
    const angleStep = (Math.PI * 2) / N;

    ctx.beginPath();

    for (let i = 0; i <= N; i++) {
      const a = (i % N) * angleStep;

      const normX = Math.cos(a) * 1.5;
      const normY = Math.sin(a) * 1.5;
      const warp = this.domainWarp2D(normX + veil.seedOffset, normY + veil.seedOffset, time * 0.5);

      const rX = Math.max(5, radX * (1.0 + warp.x * 1.2 + Math.sin(a * 2) * 0.3));
      const rY = Math.max(5, radY * (1.0 + warp.y * 1.2 + Math.cos(a * 3) * 0.3));

      const px = Math.cos(a) * rX;
      const py = Math.sin(a) * rY;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.closePath();

    // 💡 [방어 연산] 0 이하 반경으로 인한 IndexSizeError 철저 차단
    const maxGradRadius = Math.max(20, Math.max(radX, radY) * 1.5);
    
    if (Number.isFinite(maxGradRadius) && maxGradRadius > 0) {
      const fillAlpha = isDark ? (0.12 + bVol * 0.15) : (0.08 + bVol * 0.12);
      const radGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, maxGradRadius);
      radGrad.addColorStop(0, `rgba(${baseColorRgb}, ${fillAlpha * 1.8})`);
      radGrad.addColorStop(0.5, `rgba(${baseColorRgb}, ${fillAlpha * 0.9})`);
      radGrad.addColorStop(1, `rgba(${baseColorRgb}, 0)`);

      ctx.fillStyle = radGrad;
      ctx.fill();
    }

    const edgeAlpha = isDark ? (0.35 + dVol * 0.4) : (0.28 + dVol * 0.35);
    ctx.strokeStyle = `rgba(${edgeRgb}, ${edgeAlpha})`;
    ctx.lineWidth = 1.0 + dVol * 1.2;
    ctx.stroke();

    ctx.restore();
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.006;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateVeils(seedVal, W, H);
    }

    let vocalsVol = 0, drumsVol = 0, bassVol = 0, otherVol = 0;
    if (targetAudio && targetAudio.isMultiStem) {
      vocalsVol = (targetAudio.vocalsVol || 0) * gainVal;
      drumsVol  = (targetAudio.drumsVol  || 0) * gainVal;
      bassVol   = (targetAudio.bassVol   || 0) * gainVal;
      otherVol  = (targetAudio.otherVol  || 0) * gainVal;
    } else {
      vocalsVol = (targetAudio.mid || 0) * 2.5 * gainVal;
      drumsVol  = (targetAudio.bass || 0) * 3.0 * gainVal;
      bassVol   = (targetAudio.bass || 0) * 2.5 * gainVal;
      otherVol  = (targetAudio.treble || 0) * 2.5 * gainVal;
    }

    this.ctx.save();

    let bgColor = "#f4f1ea";
    let isDark = false;
    let getColors = (idx) => ({ base: "25, 30, 42", edge: "10, 12, 18" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea";
      isDark = false;
      getColors = (idx) => ({
        base: idx % 2 === 0 ? "20, 24, 34" : "45, 50, 62",
        edge: "8, 10, 15"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = ["215, 140, 165", "130, 175, 210", "140, 195, 175", "200, 160, 215"];
      const pastelEdges = ["160, 80, 105", "70, 115, 160", "80, 135, 115", "140, 100, 155"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: pastelEdges[idx % pastelEdges.length]
      });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      const neonEdges = ["180, 255, 255", "255, 150, 200", "200, 255, 180", "220, 180, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: neonEdges[idx % neonEdges.length]
      });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 45, 85", "20, 135, 195", "225, 155, 25", "105, 55, 175"];
      const fullEdges = ["140, 15, 45", "10, 80, 135", "150, 95, 10", "65, 20, 115"];
      getColors = (idx) => ({
        base: fullBases[idx % fullBases.length],
        edge: fullEdges[idx % fullEdges.length]
      });
    }

    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    this.inkVeils.forEach((veil, idx) => {
      const colors = getColors(idx);
      this.drawSingleInkVeil(
        this.ctx,
        veil,
        this.time * 0.8 + (otherVol * 0.5),
        colors.base,
        colors.edge,
        vocalsVol,
        drumsVol,
        bassVol,
        shatterVal,
        isDark
      );
    });

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `8 Pure Organic Ink Veils (Safe Mode)`,
      isCovering: true,
      activeFunction: `FluidInkWash[Safe_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkVeils = [];
  }
}
