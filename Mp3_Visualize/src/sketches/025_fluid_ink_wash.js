/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 13.0 - Dense Sharp Core & 3D Diffusion]
 * - 중심부: 선명하고 또렷하게 맺히는 고농도 수묵 핵 (Sharp Nucleus)
 * - 외곽부: 특정 지점만 부분적으로 드러나는 아스라한 마름 테두리선
 * - 모션: 3D 공간 유체 필드 + Range (Scatter) 0.1~50.0 슬라이더 연동
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 13.0 (Dense Sharp Core)";

    this.inkPools = [];
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

  // =========================================================================
  // 🧩 3D Perlin / FBM 공간 노이즈 수학 엔진
  // =========================================================================
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

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
    let frequency = 0.7;
    let maxValue = 0;
    for (let i = 0; i < 3; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total / maxValue;
  }

  // =========================================================================
  // 🎲 잉크 Pool 구조 생성
  // =========================================================================
  generateInkPools(seed, W, H) {
    this.inkPools = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const count = 7;
    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.3);
      const r3 = pseudoRand(seed + i * 5.1);

      this.inkPools.push({
        x: (0.15 + r1 * 0.7) * W,
        y: (0.2 + r2 * 0.6) * H,
        z: (r3 - 0.5) * 280,
        baseRx: (180 + r3 * 260) * (Math.min(W, H) / 1000),
        baseRy: (120 + r1 * 200) * (Math.min(W, H) / 1000),
        rotZ: r3 * Math.PI * 2,
        seedOffset: seed + i * 37.1
      });
    }
  }

  // =========================================================================
  // 🖌️ 선명한 중심 핵 + 은은한 외곽 3D 확산 렌더링
  // =========================================================================
  drawFluidInk3D(ctx, pool, time, scatterMotion, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, otherVol, isDark) {
    ctx.save();

    const motionFactor = scatterMotion;

    // 3D 위치 유동 연산
    const drift3dX = this.fbm3D(pool.seedOffset, time * 0.1, 0) * motionFactor * 12;
    const drift3dY = this.fbm3D(pool.seedOffset + 10, time * 0.1, 5) * motionFactor * 12;
    const drift3dZ = this.fbm3D(pool.seedOffset + 20, time * 0.1, 10) * motionFactor * 8;

    // 🥁 드럼 타격 충격 지터
    const drumShakeX = (Math.sin(time * 60 + pool.seedOffset) * 0.5) * (drumVol * 12.0);
    const drumShakeY = (Math.cos(time * 55 + pool.seedOffset) * 0.5) * (drumVol * 12.0);

    // 위치 조합
    const finalX = pool.x + drift3dX + drumShakeX + Math.sin(time * 0.12 + pool.seedOffset) * (bassVol * 80);
    const finalY = pool.y + drift3dY + drumShakeY + Math.cos(time * 0.15 + pool.seedOffset) * (bassVol * 80);
    const finalZ = pool.z + drift3dZ;

    const perspective = 1000 / (1000 + finalZ);
    ctx.translate(finalX, finalY);

    const swirlAngle = pool.rotZ + (time * 0.05) + (otherVol * Math.PI * 0.4);
    ctx.rotate(swirlAngle);
    ctx.scale(perspective, perspective);

    // 🎤 보컬 만개 크기
    const vocalBloom = 1.0 + (vocalVol * 1.2);
    const rx = Math.max(30, pool.baseRx * vocalBloom);
    const ry = Math.max(30, pool.baseRy * vocalBloom);

    const nodeCount = 180;
    const outerPoints = [];
    const corePoints = [];

    // 180개 노드 좌표 샘플링 (외곽 & 중심 핵)
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;

      const nx = Math.cos(a) * 1.2 + pool.seedOffset;
      const ny = Math.sin(a) * 1.2 + pool.seedOffset;
      const nz = time * 0.08 * (motionFactor * 0.1);

      const nVal3D = this.fbm3D(nx, ny, nz);
      const distortStrength = 0.4 + (motionFactor / 50.0) * 0.6;

      // 1) 외곽 확산 좌표
      const prx = rx * (0.7 + nVal3D * distortStrength);
      const pry = ry * (0.7 + nVal3D * distortStrength);

      // 2) 중심 고농도 핵 좌표 (외곽의 25~35% 크기)
      const corePrx = prx * (0.28 + nVal3D * 0.15);
      const corePry = pry * (0.28 + nVal3D * 0.15);

      outerPoints.push({ x: Math.cos(a) * prx, y: Math.sin(a) * pry, noiseVal: nVal3D });
      corePoints.push({ x: Math.cos(a) * corePrx, y: Math.sin(a) * corePry });
    }

    // 곡선 패스 생성 헬퍼
    const buildCurvePath = (pts) => {
      ctx.beginPath();
      ctx.moveTo((pts[0].x + pts[nodeCount - 1].x) / 2, (pts[0].y + pts[nodeCount - 1].y) / 2);
      for (let i = 0; i < nodeCount; i++) {
        const curr = pts[i];
        const next = pts[(i + 1) % nodeCount];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.closePath();
    };

    // =========================================================================
    // 💡 [레이어 1]: 외곽 은은한 3D 확산 면 (Soft Outer Envelope)
    // =========================================================================
    ctx.filter = `blur(${Math.max(6, Math.min(18, rx * 0.06))}px)`;
    buildCurvePath(outerPoints);
    const outerAlpha = isDark ? (0.12 + bassVol * 0.15) : (0.07 + bassVol * 0.1);
    ctx.fillStyle = `rgba(${baseColorRgb}, ${outerAlpha})`;
    ctx.fill();

    // =========================================================================
    // 💡 [레이어 2]: 중심부 선명한 먹물 핵 (Dense Sharp Nucleus - No Blur!)
    // =========================================================================
    ctx.filter = 'none'; // 🎯 블러를 완전히 제거하여 또렷하게 중심 형성
    buildCurvePath(corePoints);

    // 보컬/베이스 반응 시 중심 먹빛이 매우 짙고 선명해짐
    const coreAlpha = isDark ? (0.65 + vocalVol * 0.3) : (0.55 + vocalVol * 0.35);
    ctx.fillStyle = `rgba(${edgeRgb}, ${coreAlpha})`;
    ctx.fill();

    // 중심 핵 바로 옆 은은한 2차 밀도층
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${baseColorRgb}, ${coreAlpha * 0.5})`;
    ctx.stroke();

    // =========================================================================
    // 💡 [레이어 3]: 특정 지점만 드러나는 부분 마름 윤곽선 (Partial Edge Bleed)
    // =========================================================================
    for (let i = 0; i < nodeCount; i += 2) {
      const p1 = outerPoints[i];
      const p2 = outerPoints[(i + 1) % nodeCount];
      const p3 = outerPoints[(i + 2) % nodeCount];

      const edgeWeight = (p1.noiseVal + p2.noiseVal) * 0.5;

      // 특정 고밀도 지점에만 또렷한 마름 테두리선 배치
      if (edgeWeight > 0.48) {
        const partialAlpha = Math.pow((edgeWeight - 0.48) * 3.5, 2.0) * (isDark ? 0.55 : 0.42);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);

        ctx.strokeStyle = `rgba(${edgeRgb}, ${partialAlpha * (1.0 + drumVol * 0.6)})`;
        ctx.lineWidth = 1.0 + drumVol * 1.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.006;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    
    // Range (Scatter) 0.1 ~ 50.0 수치 매핑
    const rawScatter = globalSettings.scatterExponent !== undefined ? globalSettings.scatterExponent * 10 : 22;
    const scatterMotion = Math.max(0.1, Math.min(50.0, rawScatter));

    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkPools(seedVal, W, H);
    }

    // 4-Stem 음압 감도
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

    // 🎨 4가지 스타일 색상 지정
    let bgColor = "#f4f1ea";
    let isDark = false;
    let getColors = (idx) => ({ base: "30, 36, 48", edge: "8, 10, 15" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; // 한지 바탕색
      isDark = false;
      getColors = (idx) => ({
        base: idx % 2 === 0 ? "25, 30, 42" : "50, 56, 70",
        edge: "5, 6, 10"
      });
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = ["215, 140, 165", "130, 175, 210", "140, 195, 175", "200, 160, 215"];
      const pastelEdges = ["140, 60, 85", "50, 95, 140", "60, 115, 95", "120, 80, 135"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: pastelEdges[idx % pastelEdges.length]
      });
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonBases = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      const neonEdges = ["200, 255, 255", "255, 180, 220", "220, 255, 200", "240, 200, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: neonEdges[idx % neonEdges.length]
      });
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 45, 85", "20, 135, 195", "225, 155, 25", "105, 55, 175"];
      const fullEdges = ["120, 10, 35", "5, 60, 115", "130, 75, 5", "50, 10, 95"];
      getColors = (idx) => ({
        base: fullBases[idx % fullBases.length],
        edge: fullEdges[idx % fullEdges.length]
      });
    }

    // 바탕 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 합성 모드 (한지 multiply, 네온 screen)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 3D 유체 잉크 렌더링
    this.inkPools.forEach((pool, idx) => {
      const colors = getColors(idx);
      this.drawFluidInk3D(
        this.ctx,
        pool,
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
      particleCount: `7 Ink Pools [Sharp Core + 3D Diffusion]`,
      isCovering: true,
      activeFunction: `FluidInkWash[SharpCore_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkPools = [];
  }
}
