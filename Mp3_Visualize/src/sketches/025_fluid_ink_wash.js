/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 물속 잉크 번짐 Ver 22.0 - No Tendrils / Volumetric Ink Plume]
 * - 말미잘 촉수 선(Stroke) 100% 제거 ➔ 부드럽게 피어나는 물속 먹물 구름(Ink Cloud)
 * - 🎸 기타/베이스: 음압 상승 시 먹물 구름이 부드럽게 밖으로 뭉게뭉게 번짐
 * - 🎤 보컬: 유체 회전 속도 및 퍼짐 시간 축(Time Delta) 가속
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
    this.version = "025호 물속 잉크 번짐 Ver 22.0 (Volumetric Plume)";
    this.inkPlumes = [];
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
  // 🧩 3D Perlin / FBM 유체 공간 노이즈
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
    let frequency = 0.55;
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
  // 🎲 물속 잉크 구름 거점 생성
  // =========================================================================
  generateInkPlumes(seed, W, H) {
    this.inkPlumes = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 8;
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkPlumes.push({
        x: (-0.05 + r1 * 1.1) * W,
        y: (-0.05 + r2 * 1.1) * H,
        z: (r3 - 0.5) * 350,
        baseRx: (160 + r3 * 220) * (Math.min(W, H) / 1000),
        baseRy: (120 + r1 * 180) * (Math.min(W, H) / 1000),
        rotZ: r2 * Math.PI * 2,
        seedOffset: seed + i * 43.1
      });
    }
  }

  // =========================================================================
  // 🖌️ 물속 입체 먹물 구름 렌더링 (No Strokes!)
  // =========================================================================
  drawWaterInkPlume(ctx, plume, time, scatterMotion, baseColorRgb, vocalVol, drumVol, bassVol, otherVol, isDark) {
    ctx.save();

    // 🎸 [베이스/기타 오디오 반응]: 음압 상승 시 구름 부피 팽창
    const instrumentPower = (bassVol * 2.0) + (otherVol * 1.5);
    const expandFactor = 1.0 + instrumentPower * 1.8;

    // 🥁 [드럼 반응]: 타격 시 순간 지터
    const drumShakeX = (Math.sin(time * 50 + plume.seedOffset) * 0.5) * (drumVol * 10.0);
    const drumShakeY = (Math.cos(time * 45 + plume.seedOffset) * 0.5) * (drumVol * 10.0);

    // 3D Curl Noise 드리프트
    const driftX = this.fbm3D(plume.seedOffset, time * 0.05, 0) * scatterMotion * 14;
    const driftY = this.fbm3D(plume.seedOffset + 10, time * 0.05, 5) * scatterMotion * 14;
    const driftZ = this.fbm3D(plume.seedOffset + 20, time * 0.05, 10) * scatterMotion * 10;

    const finalX = plume.x + driftX + drumShakeX;
    const finalY = plume.y + driftY + drumShakeY;
    const finalZ = plume.z + driftZ;

    const perspective = 1000 / (1000 + finalZ);
    ctx.translate(finalX, finalY);

    // 🎤 [보컬 반응]: 회전 및 흐름 가속
    const vocalSwirl = (time * 0.04) + (vocalVol * Math.PI * 0.4);
    ctx.rotate(plume.rotZ + vocalSwirl);
    ctx.scale(perspective, perspective);

    const rx = plume.baseRx * expandFactor;
    const ry = plume.baseRy * expandFactor;

    // 💡 4개의 다층 유체 구름 블러층 (Outer Soft Diffusion ~ Inner Core)
    const layerFactors = [1.0, 0.72, 0.48, 0.24];
    const layerBlurs   = [22, 14, 8, 3]; // 외곽일수록 높은 블러 적용
    const nodeCount = 120;

    layerFactors.forEach((layerScale, layerIdx) => {
      const curRx = rx * layerScale;
      const curRy = ry * layerScale;
      const points = [];

      for (let i = 0; i < nodeCount; i++) {
        const a = (i / nodeCount) * Math.PI * 2;

        const nx = Math.cos(a) * (0.9 + layerIdx * 0.2) + plume.seedOffset;
        const ny = Math.sin(a) * (0.9 + layerIdx * 0.2) + plume.seedOffset;
        const nz = time * 0.06 * (scatterMotion * 0.08) + layerIdx * 0.4;

        const nVal3D = this.fbm3D(nx, ny, nz);
        const distortStrength = 0.35 + (scatterMotion / 50.0) * 0.65;

        const prx = curRx * (0.65 + nVal3D * distortStrength);
        const pry = curRy * (0.65 + nVal3D * distortStrength);

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

      // 외곽 스스륵 번짐 블러 필터 적용
      const currentBlur = Math.max(2, Math.min(28, layerBlurs[layerIdx] * (curRx / 350)));
      ctx.filter = `blur(${currentBlur}px)`;

      // 투명도 농담 (내부로 갈수록 짙어짐)
      const fillAlpha = isDark
        ? (0.08 + (layerIdx * 0.07) + instrumentPower * 0.12)
        : (0.05 + (layerIdx * 0.06) + instrumentPower * 0.10);

      ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
      ctx.fill();

      // 🎯 [핵심]: 말미잘을 만들던 stroke() 선은 완전히 존재하지 않음!
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

    // 오디오 수신
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
      this.generateInkPlumes(seedVal, W, H);
    }

    this.ctx.save();

    // +10% 오버스캔 마진
    const marginX = W * 0.10;
    const marginY = H * 0.10;

    this.ctx.beginPath();
    this.ctx.rect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);
    this.ctx.clip();

    // 색상 커스텀
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

    // 캔버스 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);

    // 합성 모드 (한지 multiply)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 물속 먹물 구름 렌더링
    this.inkPlumes.forEach((plume, idx) => {
      const colors = getColors(idx);
      this.drawWaterInkPlume(
        this.ctx,
        plume,
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
      particleCount: `8 Water Ink Plumes (No Tendril Lines)`,
      isCovering: true,
      activeFunction: `FluidInkWash[VolumetricPlume_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkPlumes = [];
  }
}
