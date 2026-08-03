/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 5.0 - Authentic Asymmetric Ink Art]
 * - 원형 톱니바퀴 공식 완전 폐기 ➔ 4가지 비대칭 유체 패치(Sweep, Petal, Ribbon, Cloud) 탑재
 * - X/Y 비대칭 스케일링 + 도메인 워핑 좌표 마모 ➔ 진짜 수묵/알코올 잉크 질감 구현
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 5.0 (Authentic Organic)";

    this.inkPatches = [];
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
  // 🧩 FBM & Domain Warping 수학 엔진
  // =========================================================================
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

  domainWarp(x, y, time) {
    let qx = this.fbmNoise(x + time * 0.05, y);
    let qy = this.fbmNoise(x + 3.2, y + time * 0.05);
    return this.fbmNoise(x + 2.5 * qx, y + 2.5 * qy);
  }

  // =========================================================================
  // 🎲 비대칭 수묵 패치 사전 생성 (4가지 형태 조합)
  // =========================================================================
  generateOrganicInkPatches(seed, W, H) {
    this.inkPatches = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const patchTypes = ['SWEEP', 'PETAL', 'RIBBON', 'CLOUD'];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.1);
      const r3 = pseudoRand(seed + i * 4.9);
      const r4 = pseudoRand(seed + i * 7.3);
      const r5 = pseudoRand(seed + i * 9.1);

      this.inkPatches.push({
        type: patchTypes[i % patchTypes.length],
        cx: (0.1 + r1 * 0.8) * W,
        cy: (0.15 + r2 * 0.7) * H,
        scaleX: 0.5 + r3 * 2.2,             // X축 비대칭 연장
        scaleY: 0.4 + r4 * 1.8,             // Y축 비대칭 연장
        baseRadius: (120 + r5 * 220) * (Math.min(W, H) / 1000),
        angle: r3 * Math.PI * 2,           // 기울어짐 각도
        driftSpeedX: (r1 - 0.5) * 60,      // 위치 이동 유동성
        driftSpeedY: (r2 - 0.5) * 60,
        seedOffset: seed + i * 23.5
      });
    }
  }

  // =========================================================================
  // 🖌️ 비대칭 수묵/알코올 잉크 블룸 렌더링 (Border-less Flow)
  // =========================================================================
  drawOrganicPatch(ctx, patch, time, baseColorRgb, vocalVol, drumVol, shatterVal) {
    ctx.save();
    
    // 유체 위치 이동(Drift) 연산
    const driftX = Math.sin(time * 0.2 + patch.seedOffset) * patch.driftSpeedX * (shatterVal * 0.01);
    const driftY = Math.cos(time * 0.25 + patch.seedOffset) * patch.driftSpeedY * (shatterVal * 0.01);

    ctx.translate(patch.cx + driftX, patch.cy + driftY);
    ctx.rotate(patch.angle + Math.sin(time * 0.1) * 0.1);
    ctx.scale(patch.scaleX, patch.scaleY); // 비대칭 찌그러짐 적용

    const points = 90; // 높은 곡선 정밀도
    const angleStep = (Math.PI * 2) / points;
    const baseR = patch.baseRadius * (1.0 + vocalVol * 1.5 + drumVol * 0.8);

    // 6단계 수묵 농담(濃淡) 레이어 겹침
    for (let layer = 6; layer >= 1; layer--) {
      const layerR = baseR * (layer / 6);
      const alpha = 0.025 + (7 - layer) * 0.02;

      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const a = (i % points) * angleStep;

        // 도메인 워핑 유체 왜곡 수식
        const sampleX = Math.cos(a) * 1.5 + patch.seedOffset;
        const sampleY = Math.sin(a) * 1.5 + time * 0.15;
        const warpVal = this.domainWarp(sampleX, sampleY, time);

        // 형태별 고유 비대칭 변형
        let shapeDistort = 1.0;
        if (patch.type === 'SWEEP') {
          shapeDistort = 0.6 + Math.pow(Math.sin(a * 0.5), 2) * 1.2; // 한쪽이 길게 뻗는 구름
        } else if (patch.type === 'PETAL') {
          shapeDistort = 0.4 + Math.sin(a) * 0.8; // 물방울/꽃잎 형태
        } else if (patch.type === 'RIBBON') {
          shapeDistort = 0.3 + Math.abs(Math.cos(a * 2.0)) * 1.4; // 길쭉한 붓터치 띠
        } else {
          shapeDistort = 0.7 + warpVal * 0.8; // 은은한 안개 패치
        }

        const r = layerR * shapeDistort * (0.7 + warpVal * 0.6);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();

      // 테두리 선(stroke) 없이 부드러운 방사형 복합 그라데이션만 채움
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, layerR * 1.5);
      grad.addColorStop(0, `rgba(${baseColorRgb}, ${alpha * 1.8})`);
      grad.addColorStop(0.6, `rgba(${baseColorRgb}, ${alpha * 0.9})`);
      grad.addColorStop(1, `rgba(${baseColorRgb}, 0)`);

      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});

    this.time += 0.008;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // 관제탑 글로벌 수치 독출
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 비대칭 수묵 구조재 재생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateOrganicInkPatches(seedVal, W, H);
    }

    // 4-Stem 음압 감도 수신
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

    // 4가지 스타일 RGB 매핑
    let bgColor = "#f4f1ea";
    let isDark = false;
    let getRgb = (idx) => "20, 24, 32";

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; // 한지 바탕색
      isDark = false;
      getRgb = (idx) => (idx % 2 === 0 ? "15, 18, 26" : "38, 42, 52");
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelRgbs = ["220, 140, 165", "130, 175, 210", "140, 195, 175", "200, 160, 215"];
      getRgb = (idx) => pastelRgbs[idx % pastelRgbs.length];
    } else if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      const neonRgbs = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      getRgb = (idx) => neonRgbs[idx % neonRgbs.length];
    } else {
      bgColor = "#fdfbf7";
      isDark = false;
      const fullRgbs = ["210, 45, 85", "20, 135, 195", "225, 155, 25", "105, 55, 175"];
      getRgb = (idx) => fullRgbs[idx % fullRgbs.length];
    }

    // 캔버스 바탕 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 한지 스타일은 multiply, 네온은 screen 합성
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 12개 비대칭 수묵 패치 렌더링
    this.inkPatches.forEach((patch, idx) => {
      const rgb = getRgb(idx);
      this.drawOrganicPatch(
        this.ctx,
        patch,
        this.time + idx * 10,
        rgb,
        vocalsVol,
        drumsVol,
        shatterVal
      );
    });

    this.ctx.restore();

    // HUD 진단 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `12 Asymmetric Ink Patches (No Circles)`,
      isCovering: true,
      activeFunction: `FluidInkWash[Organic_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkPatches = [];
  }
}
