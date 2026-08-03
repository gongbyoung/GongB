/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 21.0 - Water Ink Diffusion Physics]
 * - 🎸 기타/베이스: 음압 상승 시 잉크 촉수(Tendril)가 확 물속으로 폭발하듯 뻗어나감
 * - 🎤 보컬: 볼륨 상승 시 유체 흐름 속도(Time Delta) 및 소용돌이 회전 가속
 * - 물속 먹물 드롭(Ink Drop in Water) 미세 실타래 연출 적용
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
    this.version = "025호 물속 잉크 번짐 Ver 21.0";
    this.inkDrops = [];
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
  // 🧩 3D Curl Noise 유체 소용돌이 수식
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

  hexToRgb(hex) {
    if (!hex) return "30, 36, 48";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // =========================================================================
  // 🎲 물속 잉크 드롭 생태계 생성
  // =========================================================================
  generateInkDrops(seed, W, H) {
    this.inkDrops = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 7; // 물속에 떨어진 7개의 주요 잉크 피어남 지점
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      // 각 잉크 드롭별 36개 미세 촉수(Filament Rays) 초기 구성
      const tendrilCount = 36;
      const tendrils = [];
      for (let t = 0; t < tendrilCount; t++) {
        const angle = (t / tendrilCount) * Math.PI * 2;
        tendrils.push({
          angle: angle,
          lengthFactor: 0.5 + pseudoRand(seed + i * 10 + t) * 0.8,
          curvePhase: pseudoRand(seed + i * 20 + t) * Math.PI * 2
        });
      }

      this.inkDrops.push({
        x: (0.1 + r1 * 0.8) * W,
        y: (0.15 + r2 * 0.7) * H,
        z: (r3 - 0.5) * 300,
        baseRadius: (40 + r3 * 60) * (Math.min(W, H) / 1000),
        tendrils: tendrils,
        seedOffset: seed + i * 43.1
      });
    }
  }

  // =========================================================================
  // 🖌️ 오디오 스템 기반 물속 잉크 번짐 렌더링
  // =========================================================================
  drawWaterInkDiffusion(ctx, drop, time, scatterMotion, baseColorRgb, vocalVol, drumVol, bassVol, otherVol, isDark) {
    ctx.save();

    ctx.translate(drop.x, drop.y);

    // 🎸 [베이스/기타 오디오 반응 1]: 베이스/기타 폭발 시 잉크가 확 뻗어나감 (Expansion Burst)
    const instrumentPower = (bassVol * 2.2) + (otherVol * 1.8);
    const dynamicRadius = drop.baseRadius * (1.0 + instrumentPower * 2.5);

    // 🥁 [드럼 반응]: 타격 순간 순간 미세 진동
    const drumShake = (Math.sin(time * 60 + drop.seedOffset) * 0.5) * (drumVol * 8.0);

    // 💡 물속 미세 촉수 실타래 렌더링 (Ink Tendril Rays)
    const tendrilPoints = [];
    const tCount = drop.tendrils.length;

    for (let i = 0; i < tCount; i++) {
      const t = drop.tendrils[i];
      
      // 🎤 [보컬 오디오 반응 2]: 보컬 볼륨에 맞춰 소용돌이 속도 및 기류 회전 가속
      const vocalSwirl = Math.sin(time * 1.5 + t.curvePhase) * (vocalVol * 0.8);
      const currentAngle = t.angle + vocalSwirl;

      // 3D Curl Noise로 물속에서 미끄러지듯 꺾이는 잉크 가닥
      const nx = Math.cos(currentAngle) * 0.8 + drop.seedOffset;
      const ny = Math.sin(currentAngle) * 0.8 + drop.seedOffset;
      const nz = time * 0.08 * (scatterMotion * 0.08);

      const noiseCurl = this.fbm3D(nx, ny, nz);
      const reachLength = dynamicRadius * t.lengthFactor * (0.8 + noiseCurl * (1.0 + scatterMotion / 25.0));

      const px = Math.cos(currentAngle) * (reachLength + drumShake);
      const py = Math.sin(currentAngle) * (reachLength + drumShake);

      tendrilPoints.push({ x: px, y: py, noise: noiseCurl });
    }

    // 1) 잉크 실타래 외곽선 잇기
    ctx.beginPath();
    ctx.moveTo((tendrilPoints[0].x + tendrilPoints[tCount - 1].x) / 2, (tendrilPoints[0].y + tendrilPoints[tCount - 1].y) / 2);
    for (let i = 0; i < tCount; i++) {
      const curr = tendrilPoints[i];
      const next = tendrilPoints[(i + 1) % tCount];
      ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
    }
    ctx.closePath();

    // 물속 부드러운 스며듦 블러
    const blurAmount = Math.max(4, Math.min(22, dynamicRadius * 0.15));
    ctx.filter = `blur(${blurAmount}px)`;

    // 잉크 구름 면 채우기 (베이스/기타 볼륨이 클수록 짙어짐)
    const fillAlpha = isDark ? (0.15 + instrumentPower * 0.25) : (0.10 + instrumentPower * 0.20);
    ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
    ctx.fill();

    // 2) 물속 잉크 핵심 실선 줄기 렌더링 (Water Filaments)
    ctx.filter = `blur(${Math.max(1, blurAmount * 0.3)}px)`;
    for (let i = 0; i < tCount; i += 2) {
      const p1 = tendrilPoints[i];
      const p2 = tendrilPoints[(i + 1) % tCount];

      ctx.beginPath();
      ctx.moveTo(0, 0); // 중심에서부터
      ctx.quadraticCurveTo(p1.x * 0.5, p1.y * 0.5, p2.x, p2.y); // 사방으로 퍼지는 가닥

      const filamentAlpha = isDark ? (0.25 + instrumentPower * 0.35) : (0.18 + instrumentPower * 0.30);
      ctx.strokeStyle = `rgba(${baseColorRgb}, ${filamentAlpha})`;
      ctx.lineWidth = 1.0 + instrumentPower * 2.0;
      ctx.stroke();
    }

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

    // 🎤 [보컬 반응]: 보컬 볼륨이 커질수록 시간 축 흐름 속도(Time Delta)가 더 빠르게 증가!
    const timeDelta = 0.005 + (vocalsVol * 0.015);
    this.time += timeDelta;

    const W = this.canvas.width;
    const H = this.canvas.height;

    // Range (Scatter) 0.1 ~ 50.0 가변 제어
    const rawScatter = globalSettings.scatterExponent !== undefined ? globalSettings.scatterExponent * 10 : 25;
    const scatterMotion = Math.max(0.1, Math.min(50.0, rawScatter));

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkDrops(seedVal, W, H);
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
      bgColor = "#f4f1ea";
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

    // 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);

    // 합성 모드 (한지 multiply)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 물속 잉크 확산 렌더링
    this.inkDrops.forEach((drop, idx) => {
      const colors = getColors(idx);
      this.drawWaterInkDiffusion(
        this.ctx,
        drop,
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
      particleCount: `7 Water Ink Drops (Tendril Filaments)`,
      isCovering: true,
      activeFunction: `FluidInkWash[WaterInkPhysics_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkDrops = [];
  }
}
