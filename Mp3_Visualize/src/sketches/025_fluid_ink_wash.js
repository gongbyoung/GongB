/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 23.0 - Anti-Starfish Smooth Ink Wash]
 * - 불가사리/가시 뿔 현상 100% 제거 ➔ 완만하고 부드러운 대형 수묵 베일
 * - 🎸 기타/베이스: 부드러운 잉크 베일 부피 팽창 및 확산
 * - 🎤 보컬: 시간 축 유체 흐름 및 소용돌이 가속
 * - Range (Scatter) 0.1~50.0 제어 & 16:9, 9:16 Export 오버스캔 지원
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
    this.version = "025호 수묵 잉크 블룸 Ver 23.0 (Smooth Wash)";
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
  // 🧩 저주파 매끄러운 3D Perlin / FBM 공간 노이즈
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

  // 💡 [핵심 수리]: frequency를 0.2로 낮추어 매끈하고 완만한 곡선 유도 (불가사리 뿔 방지)
  fbm3D(x, y, z) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 0.22;
    let maxValue = 0;
    for (let i = 0; i < 3; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total / maxValue;
  }

  hexToRgb(hex) {
    if (!hex) return "30, 36, 48";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // =========================================================================
  // 🎲 대형 수묵 베일 거점 생성
  // =========================================================================
  generateInkVeils(seed, W, H) {
    this.inkVeils = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 7; // 화면 전체를 넓게 뒤덮는 7개의 수묵 베일
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkVeils.push({
        anchorX: (-0.1 + r1 * 1.2) * W,
        anchorY: (-0.1 + r2 * 1.2) * H,
        z: (r3 - 0.5) * 320,
        spanX: (W * 0.45) + r3 * (W * 0.55),
        spanY: (H * 0.38) + r1 * (H * 0.52),
        rotZ: r2 * Math.PI * 2,
        seedOffset: seed + i * 43.1
      });
    }
  }

  // =========================================================================
  // 🖌️ 완만하고 부드러운 수묵 잉크 베일 렌더링 (Smooth Flow - No Spikes)
  // =========================================================================
  drawSmoothInkVeil(ctx, veil, time, scatterMotion, baseColorRgb, vocalVol, drumVol, bassVol, otherVol, isDark) {
    ctx.save();

    // 🎸 [베이스/기타 오디오 반응]: 음압 상승 시 부드럽게 완만히 확산
    const instrumentPower = (bassVol * 2.0) + (otherVol * 1.4);
    const expandFactor = 1.0 + instrumentPower * 1.6;

    // 🥁 [드럼 반응]: 순간 지터
    const drumShakeX = (Math.sin(time * 45 + veil.seedOffset) * 0.5) * (drumVol * 8.0);
    const drumShakeY = (Math.cos(time * 40 + veil.seedOffset) * 0.5) * (drumVol * 8.0);

    // 3D 공간 드리프트
    const driftX = this.fbm3D(veil.seedOffset, time * 0.04, 0) * scatterMotion * 12;
    const driftY = this.fbm3D(veil.seedOffset + 10, time * 0.04, 5) * scatterMotion * 12;
    const driftZ = this.fbm3D(veil.seedOffset + 20, time * 0.04, 10) * scatterMotion * 8;

    const finalX = veil.anchorX + driftX + drumShakeX;
    const finalY = veil.anchorY + driftY + drumShakeY;
    const finalZ = veil.z + driftZ;

    const perspective = 1000 / (1000 + finalZ);
    ctx.translate(finalX, finalY);

    // 🎤 [보컬 반응]: 유체 회전 가속
    const vocalSwirl = (time * 0.03) + (vocalVol * Math.PI * 0.3);
    ctx.rotate(veil.rotZ + vocalSwirl);
    ctx.scale(perspective, perspective);

    const rx = veil.spanX * expandFactor;
    const ry = veil.spanY * expandFactor;

    // 💡 완만한 수묵 베일 4중 블러층 (Outer Soft ~ Inner Core)
    const layerFactors = [1.0, 0.72, 0.48, 0.24];
    const layerBlurs   = [24, 15, 8, 3];
    const nodeCount = 100;

    layerFactors.forEach((layerScale, layerIdx) => {
      const curRx = rx * layerScale;
      const curRy = ry * layerScale;
      const points = [];

      for (let i = 0; i < nodeCount; i++) {
        const a = (i / nodeCount) * Math.PI * 2;

        // 💡 [핵심 2]: 저주파 공간 샘플링으로 완만하고 곡선 형태의 수묵 윤곽 형성
        const nx = Math.cos(a) * 0.35 + veil.seedOffset;
        const ny = Math.sin(a) * 0.35 + veil.seedOffset;
        const nz = time * 0.05 * (scatterMotion * 0.06) + layerIdx * 0.3;

        const nVal3D = this.fbm3D(nx, ny, nz);
        const distortStrength = 0.25 + (scatterMotion / 50.0) * 0.45;

        const prx = curRx * (0.8 + nVal3D * distortStrength);
        const pry = curRy * (0.8 + nVal3D * distortStrength);

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

      // 외곽 종이 스며듦 블러 필터
      const currentBlur = Math.max(2, Math.min(30, layerBlurs[layerIdx] * (curRx / 400)));
      ctx.filter = `blur(${currentBlur}px)`;

      // 투명도 농담 (중첩 시 자발적으로 어두워짐)
      const fillAlpha = isDark
        ? (0.08 + (layerIdx * 0.07) + instrumentPower * 0.12)
        : (0.05 + (layerIdx * 0.06) + instrumentPower * 0.10);

      ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
      ctx.fill();

      // 🎯 [핵심 3]: 가시/촉수를 만들던 stroke() 선은 완전히 없음!
    });

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 오디오 데이터 수신
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

    // 보컬 반응 시 시간 가속
    const timeDelta = 0.005 + (vocalsVol * 0.012);
    this.time += timeDelta;

    const W = this.canvas.width;
    const H = this.canvas.height;

    // Range (Scatter) 0.1 ~ 50.0 가변 제어
    const rawScatter = globalSettings.scatterExponent !== undefined ? globalSettings.scatterExponent * 10 : 25;
    const scatterMotion = Math.max(0.1, Math.min(50.0, rawScatter));

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkVeils(seedVal, W, H);
    }

    this.ctx.save();

    // +10% 오버스캔 마진
    const marginX = W * 0.10;
    const marginY = H * 0.10;

    this.ctx.beginPath();
    this.ctx.rect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);
    this.ctx.clip();

    // 색상 팔레트
    let bgColor = "#f4f1ea";
    let isDark = false;
    
    const customColors = globalSettings.customColors || {};
    const customGas1 = this.hexToRgb(customColors.gas1);
    const customGas2 = this.hexToRgb(customColors.gas2);
    const customStar = this.hexToRgb(customColors.star);

    let getColors = (idx) => ({ base: "25, 30, 42" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; // 한지 바탕색
      isDark = false;
      getColors = (idx) => ({
        base: idx % 3 === 0 ? "20, 26, 38" : idx % 3 === 1 ? "42, 50, 68" : "58, 48, 40"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = [customGas1, customGas2, customStar, "180, 140, 200"];
      getColors = (idx) => ({ base: pastelBases[idx % pastelBases.length] });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = [customGas1, customGas2, customStar, "180, 100, 255"];
      getColors = (idx) => ({ base: neonBases[idx % neonBases.length] });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 35, 75", "15, 120, 180", "215, 145, 15", "95, 45, 160", "30, 110, 90"];
      getColors = (idx) => ({ base: fullBases[idx % fullBases.length] });
    }

    // 캔버스 배경
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);

    // 합성 모드 (한지 multiply)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 수묵 베일 렌더링
    this.inkVeils.forEach((veil, idx) => {
      const colors = getColors(idx);
      this.drawSmoothInkVeil(
        this.ctx,
        veil,
        this.time * 0.8,
        scatterMotion,
        colors.base,
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
      particleCount: `7 Smooth Ink Veils (No Starfish)`,
      isCovering: true,
      activeFunction: `FluidInkWash[SmoothVeil_${colorStyle.toUpperCase()}]`
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
