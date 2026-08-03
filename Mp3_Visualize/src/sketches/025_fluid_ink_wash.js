/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 3.0]
 * - 제자리 고정 완전 해제 (위치 유동 노이즈 Drift 탑재)
 * - All-in-One Multi-Noise Blending (Perlin + Simplex + Worley + FBM + Curl 융합)
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 3.0 (Multi-Noise & Drift)";

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
  // 🧩 5가지 개별 노이즈 알고리즘 수식
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

  perlinNoise(x, y) {
    return (this.valueNoise(x, y) + this.valueNoise(x * 2.1 + 1.3, y * 2.1 + 1.7) * 0.5) / 1.5;
  }

  simplexNoise(x, y) {
    let xin = x * 0.866; let yin = y * 0.866;
    let n1 = Math.sin(xin + Math.cos(yin * 1.4));
    let n2 = Math.cos(yin + Math.sin(xin * 1.4));
    return (n1 + n2) * 0.5 + 0.5;
  }

  worleyNoise(x, y) {
    let ix = Math.floor(x); let iy = Math.floor(y);
    let minDist = 1.0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let cx = ix + dx; let cy = iy + dy;
        let px = cx + this.pseudoRandom(cx, cy);
        let py = cy + this.pseudoRandom(cx + 100, cy + 100);
        let dist = Math.hypot(x - px, y - py);
        if (dist < minDist) minDist = dist;
      }
    }
    return Math.min(1.0, minDist);
  }

  fbmNoise(x, y) {
    let value = 0; let amplitude = 0.5; let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.valueNoise(x * frequency, y * frequency);
      frequency *= 2.0; amplitude *= 0.5;
    }
    return value;
  }

  curlNoise(x, y) {
    let eps = 0.1;
    let n1 = this.perlinNoise(x, y + eps);
    let n2 = this.perlinNoise(x, y - eps);
    let n3 = this.perlinNoise(x + eps, y);
    let n4 = this.perlinNoise(x - eps, y);
    return { x: (n1 - n2) / (2 * eps), y: -(n3 - n4) / (2 * eps) };
  }

  // =========================================================================
  // 🔀 [핵심] SHUFFLE 시드 기반 Multi-Noise 복합 샘플러
  // =========================================================================
  sampleMultiNoise(x, y, time, seed) {
    // 시드 수치에 따라 5가지 노이즈의 가중치 믹스 비율 연산
    let wFbm = (Math.sin(seed * 1.1) * 0.5 + 0.5);
    let wPerlin = (Math.cos(seed * 2.3) * 0.5 + 0.5);
    let wSimplex = (Math.sin(seed * 3.7) * 0.5 + 0.5);
    let wWorley = (Math.cos(seed * 4.9) * 0.5 + 0.5);
    let totalW = wFbm + wPerlin + wSimplex + wWorley + 0.001;

    // 각 노이즈 조합
    let nFbm = this.fbmNoise(x + time, y);
    let nPerlin = this.perlinNoise(x, y + time);
    let nSimplex = this.simplexNoise(x + time * 0.5, y + time * 0.5);
    let nWorley = this.worleyNoise(x * 1.5, y * 1.5 + time);

    let blendedScalar = (nFbm * wFbm + nPerlin * wPerlin + nSimplex * wSimplex + nWorley * wWorley) / totalW;

    // Curl 유체 회전 가중치
    let curl = this.curlNoise(x * 0.5 + time * 0.2, y * 0.5 + time * 0.2);

    return {
      val: blendedScalar,
      dx: (blendedScalar - 0.5) * 2.0 + curl.x * 1.5,
      dy: (this.fbmNoise(x + 5.2, y + time) - 0.5) * 2.0 + curl.y * 1.5
    };
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

    const blobCount = 9;
    for (let i = 0; i < blobCount; i++) {
      const r1 = pseudoRand(seed + i * 1.3);
      const r2 = pseudoRand(seed + i * 2.7);
      const r3 = pseudoRand(seed + i * 4.1);

      this.inkBlobs.push({
        baseX: (0.15 + r1 * 0.7) * W,
        baseY: (0.2 + r2 * 0.6) * H,
        baseRadius: (140 + r3 * 200) * (Math.min(W, H) / 1000),
        seedOffset: seed + i * 15.7,
        driftSpeed: 0.15 + r2 * 0.35
      });
    }

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
  // 🖌️ 테두리 없는 부드러운 유체 잉크 렌더링
  // =========================================================================
  drawSoftInkWash(ctx, cx, cy, radius, seedOffset, time, baseColorRgb, shatterVal) {
    ctx.save();
    ctx.translate(cx, cy);

    const points = 72;
    const angleStep = (Math.PI * 2) / points;

    for (let layer = 5; layer >= 1; layer--) {
      const layerRadius = radius * (layer / 5);
      const alpha = 0.04 + (6 - layer) * 0.025;

      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const a = (i % points) * angleStep;

        // 💡 복합 Multi-Noise로 형상 파동 샘플링
        const sampleX = Math.cos(a) * 1.2 + seedOffset;
        const sampleY = Math.sin(a) * 1.2 + time * 0.2;
        const multiNoise = this.sampleMultiNoise(sampleX, sampleY, time * 0.1, seedOffset);

        const r = layerRadius * (0.65 + multiNoise.val * 0.7);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, layerRadius * 1.2);
      grad.addColorStop(0, `rgba(${baseColorRgb}, ${alpha * 1.6})`);
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

    // 관제탑 컨트롤러 수치 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const rangeVal = (globalSettings.scatterExponent ?? 2.2) * 0.003;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150; // 위치 이동 반경 세기
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 구조 재구성
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

    // 4가지 스타일 RGB 모드
    let bgColor = "#f2eee5";
    let isDark = false;
    let getRgb = (idx) => "25, 28, 36";

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f2eee5";
      isDark = false;
      getRgb = (idx) => (idx % 2 === 0 ? "15, 18, 25" : "40, 45, 55");
    } else if (colorStyle === 'pastel') {
      bgColor = "#f6f4ed";
      isDark = false;
      const pastelRgbs = ["225, 150, 170", "140, 180, 210", "150, 200, 180", "210, 170, 220"];
      getRgb = (idx) => pastelRgbs[idx % pastelRgbs.length];
    } else if (colorStyle === 'neon') {
      bgColor = "#04060d";
      isDark = true;
      const neonRgbs = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      getRgb = (idx) => neonRgbs[idx % neonRgbs.length];
    } else {
      bgColor = "#f8f6f0";
      isDark = false;
      const fullRgbs = ["210, 50, 90", "20, 140, 200", "230, 160, 30", "110, 60, 180"];
      getRgb = (idx) => fullRgbs[idx % fullRgbs.length];
    }

    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    const vocalExpand = vocalsVol * 1.6;
    const drumSurge = drumsVol * 1.2;

    // 1. 배경으로 유동하는 안개 스트림
    this.inkStreams.forEach((st, idx) => {
      const rgb = getRgb(idx);
      this.ctx.fillStyle = `rgba(${rgb}, ${isDark ? 0.05 : 0.03})`;

      this.ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const streamNoise = this.sampleMultiNoise(x * st.scale, idx, this.time * 0.2, seedVal);
        const y = st.startY + streamNoise.dx * st.amplitude + Math.sin(this.time + idx) * (otherVol * 40);

        if (x === 0) this.ctx.moveTo(x, y - 60);
        this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(W, H);
      this.ctx.lineTo(0, H);
      this.ctx.closePath();
      this.ctx.fill();
    });

    // 2. 🌊 [위치 이동 노이즈 적용] 9개 잉크 블룸 유동 렌더링
    this.inkBlobs.forEach((blob, idx) => {
      // 위치 이동(Drift) 노이즈 샘플링
      const posNoise = this.sampleMultiNoise(
        blob.baseX * rangeVal,
        blob.baseY * rangeVal,
        this.time * blob.driftSpeed,
        blob.seedOffset
      );

      // 관제탑 Scale(Glow) / Shatter 수치 + 드럼 타격에 따른 유체 이동 좌표 계산
      const currentShatter = shatterVal * (1.0 + drumsVol * 2.0);
      const renderCx = blob.baseX + posNoise.dx * currentShatter;
      const renderCy = blob.baseY + posNoise.dy * currentShatter;

      const currentRadius = blob.baseRadius * (1.0 + vocalExpand + (idx % 2 === 0 ? drumSurge : 0));
      const rgb = getRgb(idx);

      this.drawSoftInkWash(
        this.ctx,
        renderCx,
        renderCy,
        currentRadius,
        blob.seedOffset,
        this.time * (0.8 + blob.driftSpeed) + (otherVol * 0.5),
        rgb,
        shatterVal
      );
    });

    this.ctx.restore();

    // HUD 진단 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Multi-Noise Ink Pools: 9 Floating Blooms`,
      isCovering: true,
      activeFunction: `FluidInkWash[All_Noise_Blended_${colorStyle.toUpperCase()}]`
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
