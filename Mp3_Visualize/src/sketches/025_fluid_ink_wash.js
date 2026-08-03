/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 6.0 - Zero Banding & Bezier Spline Art]
 * - concentric layer 루프 완전 제거 ➔ 계단 현상(층) 100% 소멸
 * - 방사형 공식 폐기 ➔ 4가지 이질적 베지어/붓터치/연기 스플라인 형태 탑재
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 6.0 (Seamless Diffusion)";

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
  // 🧩 FBM 유체 노이즈 수학 엔진
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

  // =========================================================================
  // 🎲 4가지 완전 이질적 형태 구조 생성 (방사형 방식 폐기)
  // =========================================================================
  generateInkStructures(seed, W, H) {
    this.inkPatches = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    const kinds = ['BRUSH_SWEEP', 'BEZIER_PATCH', 'SMOKE_TRAIL', 'FLUID_SPLASH'];
    const count = 10;

    for (let i = 0; i < count; i++) {
      const r1 = pseudoRand(seed + i * 1.7);
      const r2 = pseudoRand(seed + i * 3.1);
      const r3 = pseudoRand(seed + i * 4.9);
      const r4 = pseudoRand(seed + i * 7.3);

      // 베지어 제어점 생성 (5개 오프셋)
      const ctrlPoints = [];
      for (let cp = 0; cp < 5; cp++) {
        ctrlPoints.push({
          angle: (cp / 5) * Math.PI * 2 + (pseudoRand(seed + i * 10 + cp) - 0.5) * 0.8,
          distMult: 0.4 + pseudoRand(seed + i * 20 + cp) * 1.2
        });
      }

      this.inkPatches.push({
        kind: kinds[i % kinds.length],
        cx: (0.1 + r1 * 0.8) * W,
        cy: (0.15 + r2 * 0.7) * H,
        radius: (130 + r3 * 210) * (Math.min(W, H) / 1000),
        angle: r4 * Math.PI * 2,
        scaleX: 0.6 + r1 * 2.0,
        scaleY: 0.4 + r2 * 1.5,
        driftSpeedX: (r1 - 0.5) * 50,
        driftSpeedY: (r2 - 0.5) * 50,
        ctrlPoints: ctrlPoints,
        seedOffset: seed + i * 31.4
      });
    }
  }

  // =========================================================================
  // 🖌️ 단일 패스 연속 수묵 그라데이션 (계단 현상/층 100% 소멸)
  // =========================================================================
  drawSmoothOrganicPatch(ctx, patch, time, baseColorRgb, vocalVol, drumVol, shatterVal) {
    ctx.save();

    // 유동 드리프트 계산
    const driftX = Math.sin(time * 0.15 + patch.seedOffset) * patch.driftSpeedX * (shatterVal * 0.01);
    const driftY = Math.cos(time * 0.2 + patch.seedOffset) * patch.driftSpeedY * (shatterVal * 0.01);

    ctx.translate(patch.cx + driftX, patch.cy + driftY);
    ctx.rotate(patch.angle + Math.sin(time * 0.08) * 0.1);
    ctx.scale(patch.scaleX, patch.scaleY);

    const R = patch.radius * (1.0 + vocalVol * 1.4 + drumVol * 0.7);

    ctx.beginPath();

    if (patch.kind === 'BRUSH_SWEEP') {
      // 1. 대각선/수평 붓 터치 (S자 곡선 띠)
      ctx.moveTo(-R * 1.8, -R * 0.3);
      ctx.bezierCurveTo(-R * 0.8, -R * 1.2, R * 0.8, R * 1.2, R * 1.8, R * 0.3);
      ctx.bezierCurveTo(R * 0.8, R * 0.8, -R * 0.8, -R * 0.4, -R * 1.8, -R * 0.3);

    } else if (patch.kind === 'BEZIER_PATCH') {
      // 2. 비대칭 베지어 곡선 먹면 (불규칙 5점)
      const pts = patch.ctrlPoints;
      for (let p = 0; p < pts.length; p++) {
        const curr = pts[p];
        const next = pts[(p + 1) % pts.length];

        const nVal = this.fbmNoise(Math.cos(curr.angle) + time * 0.1, Math.sin(curr.angle) + patch.seedOffset);
        const rCurr = R * curr.distMult * (0.8 + nVal * 0.5);

        const x = Math.cos(curr.angle) * rCurr;
        const y = Math.sin(curr.angle) * rCurr;

        if (p === 0) ctx.moveTo(x, y);
        else {
          const prev = pts[(p - 1 + pts.length) % pts.length];
          const cX = Math.cos((prev.angle + curr.angle) * 0.5) * rCurr * 0.8;
          const cY = Math.sin((prev.angle + curr.angle) * 0.5) * rCurr * 0.8;
          ctx.quadraticCurveTo(cX, cY, x, y);
        }
      }

    } else if (patch.kind === 'SMOKE_TRAIL') {
      // 3. 은은하게 퍼지는 연기 흐름
      ctx.moveTo(-R * 0.5, -R * 1.5);
      ctx.quadraticCurveTo(R * 1.2, 0, -R * 0.5, R * 1.5);
      ctx.quadraticCurveTo(-R * 1.2, 0, -R * 0.5, -R * 1.5);

    } else {
      // 4. 길쭉한 잉크 방울 스플래시
      ctx.arc(-R * 0.3, 0, R * 0.8, 0, Math.PI * 2);
    }

    ctx.closePath();

    // 💡 [핵심] 단 하나의 연속 반사형 그라데이션으로 렌더링 (층/계단 현상 0%)
    const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.6);
    radGrad.addColorStop(0, `rgba(${baseColorRgb}, 0.28)`);
    radGrad.addColorStop(0.45, `rgba(${baseColorRgb}, 0.12)`);
    radGrad.addColorStop(0.8, `rgba(${baseColorRgb}, 0.03)`);
    radGrad.addColorStop(1, `rgba(${baseColorRgb}, 0)`);

    ctx.fillStyle = radGrad;
    ctx.fill();

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

    // 관제탑 설정 수치 독출
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 구조 생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateInkStructures(seedVal, W, H);
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

    // 캔버스 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 합성 모드 (한지 multiply, 네온 screen)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 10개 유기적 수묵 패치 렌더링
    this.inkPatches.forEach((patch, idx) => {
      const rgb = getRgb(idx);
      this.drawSmoothOrganicPatch(
        this.ctx,
        patch,
        this.time + idx * 5,
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
      particleCount: `10 Continuous Bezier Patches (Zero Banding)`,
      isCovering: true,
      activeFunction: `FluidInkWash[Seamless_${colorStyle.toUpperCase()}]`
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
