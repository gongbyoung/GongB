/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 2.0]
 * - 경계선(Outline) 완전 제거 ➔ 부드러운 FBM 유체 잉크 번짐 이식
 * - 4-Stem 오디오 연동 & 4가지 컬러 스타일 지원
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 2.0 (No Outlines)";

    this.inkBlobs = [];
    this.inkStreams = [];
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
  // 🧩 FBM (Fractional Brownian Motion) 유체 전용 노이즈 수식
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
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.valueNoise(x * frequency, y * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // =========================================================================
  // 🎲 잉크 구조 사전 생성
  // =========================================================================
  generateInkStructures(seed, W, H) {
    this.inkBlobs = [];
    this.inkStreams = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 유체 잉크 번짐 덩어리 (8개)
    const blobCount = 8;
    for (let i = 0; i < blobCount; i++) {
      const r1 = pseudoRand(seed + i * 1.3);
      const r2 = pseudoRand(seed + i * 2.7);
      const r3 = pseudoRand(seed + i * 4.1);

      this.inkBlobs.push({
        cx: (0.15 + r1 * 0.7) * W,
        cy: (0.2 + r2 * 0.6) * H,
        baseRadius: (140 + r3 * 200) * (Math.min(W, H) / 1000),
        noiseOffset: r1 * 100,
        speed: 0.2 + r2 * 0.5
      });
    }

    // 2. 배경으로 은은하게 흐르는 수묵 연기 흐름 (6개)
    for (let s = 0; s < 6; s++) {
      const r1 = pseudoRand(seed + s * 8.3);
      const r2 = pseudoRand(seed + s * 9.7);

      this.inkStreams.push({
        startY: (0.1 + r1 * 0.8) * H,
        amplitude: 40 + r2 * 100,
        scale: 0.002 + r1 * 0.003
      });
    }
  }

  // =========================================================================
  // 🖌️ 경계선 없는 부드러운 유체 잉크 렌더링 (Border-less Ink Wash)
  // =========================================================================
  drawSoftInkWash(ctx, cx, cy, radius, noiseOffset, time, baseColorRgb) {
    ctx.save();
    ctx.translate(cx, cy);

    // 72개 고해상도 곡선 포인트로 각진 부분 완벽 제거
    const points = 72;
    const angleStep = (Math.PI * 2) / points;

    // 5단계 미세 알파 겹침으로 깊이감 있는 수묵 농담(濃淡) 연출
    for (let layer = 5; layer >= 1; layer--) {
      const layerRadius = radius * (layer / 5);
      const alpha = 0.04 + (6 - layer) * 0.025; // 아주 은은한 알파 적용

      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const a = (i % points) * angleStep;

        // FBM 유체 파동 변위 계산
        const nx = Math.cos(a) * 1.2 + noiseOffset;
        const ny = Math.sin(a) * 1.2 + time * 0.2;
        const nVal = this.fbmNoise(nx, ny);

        const r = layerRadius * (0.7 + nVal * 0.6);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();

      // 💡 경계선(stroke)을 절대 그리지 않고 부드러운 방사형 그라데이션 채우기만 수행
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, layerRadius * 1.2);
      grad.addColorStop(0, `rgba(${baseColorRgb}, ${alpha * 1.5})`);
      grad.addColorStop(0.7, `rgba(${baseColorRgb}, ${alpha * 0.8})`);
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

    // 관제탑 컨트롤러 수치 독출
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const scatterVal = (globalSettings.scatterExponent ?? 2.2) * 0.1;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 재생성
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

    // =========================================================================
    // 🎨 4가지 스타일 RGB 모드
    // =========================================================================
    let bgColor = "#f2eee5"; // 한지 바탕색
    let isDark = false;
    let getRgb = (idx) => "25, 28, 36"; // 흑백 기본 먹색

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      // 1. 흑백 (Monochrome - 원본 수묵화 느낌)
      bgColor = "#f2eee5";
      isDark = false;
      getRgb = (idx) => (idx % 2 === 0 ? "15, 18, 25" : "40, 45, 55");
    } else if (colorStyle === 'pastel') {
      // 2. 파스텔컬러
      bgColor = "#f6f4ed";
      isDark = false;
      const pastelRgbs = ["225, 150, 170", "140, 180, 210", "150, 200, 180", "210, 170, 220"];
      getRgb = (idx) => pastelRgbs[idx % pastelRgbs.length];
    } else if (colorStyle === 'neon') {
      // 3. 네온컬러
      bgColor = "#04060d";
      isDark = true;
      const neonRgbs = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      getRgb = (idx) => neonRgbs[idx % neonRgbs.length];
    } else {
      // 4. 올컬러 (Alcohol Ink)
      bgColor = "#f8f6f0";
      isDark = false;
      const fullRgbs = ["210, 50, 90", "20, 140, 200", "230, 160, 30", "110, 60, 180"];
      getRgb = (idx) => fullRgbs[idx % fullRgbs.length];
    }

    // 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 어두운 배경은 screen, 밝은 한지는 multiply 합성 적용
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 🎹 오디오 반응 변수
    const vocalExpand = vocalsVol * 1.6;
    const drumSurge = drumsVol * 1.1;

    // 1. 배경으로 흐르는 은은한 수묵 안개 흐름
    this.inkStreams.forEach((st, idx) => {
      const rgb = getRgb(idx);
      this.ctx.fillStyle = `rgba(${rgb}, ${isDark ? 0.05 : 0.03})`;

      this.ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const nVal = this.fbmNoise(x * st.scale + this.time, idx);
        const y = st.startY + (nVal - 0.5) * st.amplitude + Math.sin(this.time + idx) * (otherVol * 40);

        if (x === 0) this.ctx.moveTo(x, y - 60);
        this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(W, H);
      this.ctx.lineTo(0, H);
      this.ctx.closePath();
      this.ctx.fill();
    });

    // 2. 8개 메인 유체 잉크 블룸 (No Outline)
    this.inkBlobs.forEach((blob, idx) => {
      const currentRadius = blob.baseRadius * (1.0 + vocalExpand + (idx % 2 === 0 ? drumSurge : 0));
      const rgb = getRgb(idx);

      this.drawSoftInkWash(
        this.ctx,
        blob.cx,
        blob.cy,
        currentRadius,
        blob.noiseOffset,
        this.time * blob.speed + (otherVol * 0.5),
        rgb
      );
    });

    this.ctx.restore();

    // HUD 진단 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Ink Blooms: 8 Borderless Pools`,
      isCovering: true,
      activeFunction: `FluidInkWash[FBM_Seamless_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.inkBlobs = [];
    this.inkStreams = [];
  }
}
