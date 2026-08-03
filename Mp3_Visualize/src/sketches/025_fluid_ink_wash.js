/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 16.0 - Authentic Overlap Ink Wash]
 * - 겹칠수록 진해지는 수묵 중첩(Multiply) 및 선명한 교차 외곽선
 * - 3D 공간 유체 노이즈 연산 & Range (Scatter) 0.1~50.0 제어 연동
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 16.0";
    this.inkVeils = [];
    this.loadedSeed = -1;
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // =========================================================================
  // 🧩 3D Perlin / FBM 공간 노이즈 수학 엔진
  // =========================================================================
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }

  grad3D(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3D(x, y, z) {
    const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    const perm = new Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A  = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B  = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;

    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad3D(perm[AA], xf, yf, zf), this.grad3D(perm[BA], xf - 1, yf, zf)),
        this.lerp(u, this.grad3D(perm[AB], xf, yf - 1, zf), this.grad3D(perm[BB], xf - 1, yf - 1, zf))
      ),
      this.lerp(v,
        this.lerp(u, this.grad3D(perm[AA + 1], xf, yf, zf - 1), this.grad3D(perm[BA + 1], xf - 1, yf, zf - 1)),
        this.lerp(u, this.grad3D(perm[AB + 1], xf, yf - 1, zf - 1), this.grad3D(perm[BB + 1], xf - 1, yf - 1, zf - 1))
      )
    );
  }

  fbm3D(x, y, z) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 0.6;
    let maxValue = 0;
    for (let i = 0; i < 3; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total / maxValue;
  }

  generateInkVeils(seed, W, H) {
    this.inkVeils = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 9;
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkVeils.push({
        x: (0.12 + r1 * 0.76) * W,
        y: (0.15 + r2 * 0.7) * H,
        z: (r3 - 0.5) * 220,
        baseRx: (200 + r3 * 300) * (Math.min(W, H) / 1000),
        baseRy: (150 + r1 * 240) * (Math.min(W, H) / 1000),
        rotZ: r3 * Math.PI * 2,
        seedOffset: seed + i * 37.1
      });
    }
  }

  drawFluidVeil(ctx, veil, time, scatterMotion, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, otherVol, isDark) {
    ctx.save();

    const motionFactor = scatterMotion;

    // 3D 공간 유체 이동
    const drift3dX = this.fbm3D(veil.seedOffset, time * 0.08, 0) * motionFactor * 14;
    const drift3dY = this.fbm3D(veil.seedOffset + 10, time * 0.08, 5) * motionFactor * 14;
    const drift3dZ = this.fbm3D(veil.seedOffset + 20, time * 0.08, 10) * motionFactor * 8;

    // 🥁 드럼 충격 지터
    const drumShakeX = (Math.sin(time * 50 + veil.seedOffset) * 0.5) * (drumVol * 10.0);
    const drumShakeY = (Math.cos(time * 45 + veil.seedOffset) * 0.5) * (drumVol * 10.0);

    // 🎸 베이스 유체 흐름
    const finalX = veil.x + drift3dX + drumShakeX + Math.sin(time * 0.1 + veil.seedOffset) * (bassVol * 80);
    const finalY = veil.y + drift3dY + drumShakeY + Math.cos(time * 0.12 + veil.seedOffset) * (bassVol * 80);
    const finalZ = veil.z + drift3dZ;

    const perspective = 1000 / (1000 + finalZ);
    ctx.translate(finalX, finalY);

    const swirlAngle = veil.rotZ + (time * 0.04) + (otherVol * Math.PI * 0.3);
    ctx.rotate(swirlAngle);
    ctx.scale(perspective, perspective);

    // 🎤 보컬 만개
    const vocalBloom = 1.0 + (vocalVol * 1.1);
    const rx = Math.max(40, veil.baseRx * vocalBloom);
    const ry = Math.max(40, veil.baseRy * vocalBloom);

    const nodeCount = 180;
    const points = [];

    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;

      const nx = Math.cos(a) * 1.1 + veil.seedOffset;
      const ny = Math.sin(a) * 1.1 + veil.seedOffset;
      const nz = time * 0.06 * (motionFactor * 0.1);

      const nVal3D = this.fbm3D(nx, ny, nz);
      const distortStrength = 0.35 + (motionFactor / 50.0) * 0.65;

      const prx = rx * (0.75 + nVal3D * distortStrength);
      const pry = ry * (0.75 + nVal3D * distortStrength);

      points.push({ x: Math.cos(a) * prx, y: Math.sin(a) * pry });
    }

    ctx.beginPath();
    ctx.moveTo((points[0].x + points[nodeCount - 1].x) / 2, (points[0].y + points[nodeCount - 1].y) / 2);
    for (let i = 0; i < nodeCount; i++) {
      const curr = points[i];
      const next = points[(i + 1) % nodeCount];
      ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
    }
    ctx.closePath();

    ctx.filter = 'none';

    // 1. 단일 레이어 수묵 면 (겹치면 multiply로 자연스럽게 어두워짐)
    const fillAlpha = isDark ? (0.22 + bassVol * 0.15) : (0.16 + bassVol * 0.12);
    ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
    ctx.fill();

    // 2. 테두리 마름선 (교차되는 선들이 중첩되면 선명하게 돋보임)
    const strokeAlpha = isDark ? (0.45 + drumVol * 0.3) : (0.35 + drumVol * 0.25);
    ctx.strokeStyle = `rgba(${edgeRgb}, ${strokeAlpha})`;
    ctx.lineWidth = 1.2 + drumVol * 1.2;
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
    
    const rawScatter = globalSettings.scatterExponent !== undefined ? globalSettings.scatterExponent * 10 : 22;
    const scatterMotion = Math.max(0.1, Math.min(50.0, rawScatter));

    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkVeils(seedVal, W, H);
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
    let getColors = (idx) => ({ base: "25, 30, 42", edge: "8, 10, 15" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea";
      isDark = false;
      getColors = (idx) => ({
        base: idx % 2 === 0 ? "20, 24, 34" : "40, 48, 62",
        edge: "5, 8, 12"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = ["215, 120, 150", "110, 160, 200", "120, 185, 160", "180, 140, 200"];
      const pastelEdges = ["150, 40, 70", "40, 85, 130", "50, 110, 85", "110, 60, 130"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: pastelEdges[idx % pastelEdges.length]
      });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      const neonEdges = ["220, 255, 255", "255, 200, 230", "220, 255, 200", "240, 220, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: neonEdges[idx % neonEdges.length]
      });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 35, 75", "15, 120, 180", "215, 145, 15", "95, 45, 160"];
      const fullEdges = ["110, 5, 25", "2, 50, 100", "120, 65, 0", "40, 5, 80"];
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
      this.drawFluidVeil(
        this.ctx,
        veil,
        this.time * 0.8,
        scatterMotion,
        colors.base,
        colors.edge,
        vocalsVol,
        drumsVol,
        bassVol,
        otherVol,
        isDark
      );
    });

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `9 Overlap Ink Veils`,
      isCovering: true,
      activeFunction: `FluidInkWash[Overlap_${colorStyle.toUpperCase()}]`
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
