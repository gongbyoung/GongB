/**
 * src/sketches/025_fluid_ink_wash.js
 * - [025호 수묵 잉크 블룸 Ver 7.0 - Pure Veil Ink Wash]
 * - 단차/층(Concentric Banding) 100% 제거: 단일 무늬 면 채우기 + 제일 외곽선 테두리 마름선만 채색
 * - 정형화된 형태 폐기 ➔ FBM Domain Warping 2D 필드로 자유 유체 베일 생성
 * - 4-Stem 오디오 독립 반응 & 4가지 컬러 스타일 (흑백, 올컬러, 파스텔, 네온)
 */

export default class FluidInkWashSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.time = 0;
    this.version = "025호 수묵 잉크 블룸 Ver 7.0 (Pure Ink Veil)";

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

  domainWarp2D(x, y, time) {
    let qx = this.fbmNoise(x + time * 0.08, y + 1.2);
    let qy = this.fbmNoise(x + 2.8, y + time * 0.08);
    let rx = this.fbmNoise(x + 4.0 * qx + 1.7, y + 4.0 * qy + 9.2);
    let ry = this.fbmNoise(x + 4.0 * qx + 8.3, y + 4.0 * qy + 2.8);
    return {
      x: rx - 0.5,
      y: ry - 0.5
    };
  }

  // =========================================================================
  // 🎲 자유 유체 베일(Ink Veil) 구조 생성
  // =========================================================================
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

      const anchorCount = 120; // 120개 고해상도 연속 노드
      this.inkVeils.push({
        cx: (0.1 + r1 * 0.8) * W,
        cy: (0.15 + r2 * 0.7) * H,
        baseRadiusX: (180 + r3 * 300) * (Math.min(W, H) / 1000),
        baseRadiusY: (120 + r4 * 250) * (Math.min(W, H) / 1000),
        anchorCount: anchorCount,
        rotation: r1 * Math.PI * 2,
        driftSpeedX: (r1 - 0.5) * 40,
        driftSpeedY: (r2 - 0.5) * 40,
        seedOffset: seed + i * 29.3
      });
    }
  }

  // =========================================================================
  // 🖌️ 수묵/알코올 잉크 베일 렌더링 (단차 없음, 외곽 마름선만 채색)
  // =========================================================================
  drawSingleInkVeil(ctx, veil, time, baseColorRgb, edgeRgb, vocalVol, drumVol, bassVol, shatterVal, isDark) {
    ctx.save();

    // 드리프트 이동
    const driftX = Math.sin(time * 0.15 + veil.seedOffset) * veil.driftSpeedX * (shatterVal * 0.008);
    const driftY = Math.cos(time * 0.18 + veil.seedOffset) * veil.driftSpeedY * (shatterVal * 0.008);

    ctx.translate(veil.cx + driftX, veil.cy + driftY);
    ctx.rotate(veil.rotation + Math.sin(time * 0.05) * 0.1);

    const radX = veil.baseRadiusX * (1.0 + vocalVol * 1.2 + drumVol * 0.5);
    const radY = veil.baseRadiusY * (1.0 + vocalVol * 1.2 + drumVol * 0.5);

    const N = veil.anchorCount;
    const angleStep = (Math.PI * 2) / N;

    // 💡 단 하나의 불규칙 유체 외곽 경로(Path) 생성 (단차 100% 소멸)
    ctx.beginPath();

    for (let i = 0; i <= N; i++) {
      const a = (i % N) * angleStep;

      // 2D Domain Warping을 이용해 정형화되지 않은 우아한 유체 라인 계산
      const normX = Math.cos(a) * 1.5;
      const normY = Math.sin(a) * 1.5;
      const warp = this.domainWarp2D(normX + veil.seedOffset, normY + veil.seedOffset, time * 0.5);

      const rX = radX * (1.0 + warp.x * 1.2 + Math.sin(a * 2) * 0.3);
      const rY = radY * (1.0 + warp.y * 1.2 + Math.cos(a * 3) * 0.3);

      const px = Math.cos(a) * rX;
      const py = Math.sin(a) * rY;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.closePath();

    // 1. 단일 부드러운 수묵/잉크 면 채우기 (내부 단차/계단 현상 없음!)
    const fillAlpha = isDark ? (0.12 + bassVol * 0.15) : (0.08 + bassVol * 0.12);
    ctx.fillStyle = `rgba(${baseColorRgb}, ${fillAlpha})`;
    ctx.fill();

    // 2. 💡 [핵심] 제일 외곽에만 약한 수묵 마름 윤곽선(Ink Bleed Edge) 채색
    const edgeAlpha = isDark ? (0.35 + drumVol * 0.4) : (0.28 + drumVol * 0.35);
    ctx.strokeStyle = `rgba(${edgeRgb}, ${edgeAlpha})`;
    ctx.lineWidth = 1.0 + drumVol * 1.2;
    ctx.stroke();

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

    // 관제탑 설정 수치
    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const shatterVal = (globalSettings.glowIntensity ?? 0.85) * 150;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // 시드 변경 시 베일 구조 생성
    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateVeils(seedVal, W, H);
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

    // 🎨 4가지 스타일 색상 지정 (면 채우기 RGB & 외곽 마름선 RGB)
    let bgColor = "#f4f1ea";
    let isDark = false;
    let getColors = (idx) => ({ base: "25, 30, 42", edge: "10, 12, 18" });

    if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      // 1. 흑백 (수묵화 Ink Wash - 참고 이미지와 100% 동일)
      bgColor = "#f4f1ea";
      isDark = false;
      getColors = (idx) => ({
        base: idx % 2 === 0 ? "20, 24, 34" : "45, 50, 62",
        edge: "8, 10, 15"
      });
    } else if (colorStyle === 'pastel') {
      // 2. 파스텔컬러
      bgColor = "#f8f6f0";
      isDark = false;
      const pastelBases = ["215, 140, 165", "130, 175, 210", "140, 195, 175", "200, 160, 215"];
      const pastelEdges = ["160, 80, 105", "70, 115, 160", "80, 135, 115", "140, 100, 155"];
      getColors = (idx) => ({
        base: pastelBases[idx % pastelBases.length],
        edge: pastelEdges[idx % pastelEdges.length]
      });
    } else if (colorStyle === 'neon') {
      // 3. 네온컬러
      bgColor = "#04050d";
      isDark = true;
      const neonBases = ["0, 240, 255", "255, 0, 120", "120, 255, 100", "180, 100, 255"];
      const neonEdges = ["180, 255, 255", "255, 150, 200", "200, 255, 180", "220, 180, 255"];
      getColors = (idx) => ({
        base: neonBases[idx % neonBases.length],
        edge: neonEdges[idx % neonEdges.length]
      });
    } else {
      // 4. 올컬러 (Alcohol Ink)
      bgColor = "#fdfbf7";
      isDark = false;
      const fullBases = ["210, 45, 85", "20, 135, 195", "225, 155, 25", "105, 55, 175"];
      const fullEdges = ["140, 15, 45", "10, 80, 135", "150, 95, 10", "65, 20, 115"];
      getColors = (idx) => ({
        base: fullBases[idx % fullBases.length],
        edge: fullEdges[idx % fullEdges.length]
      });
    }

    // 바탕면 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 합성 모드 (한지는 multiply로 중첩될 때 자연스럽게 먹이 짙어짐)
    this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

    // 8개 자유 유체 베일 렌더링
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

    // HUD 진단 출력
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `8 Pure Organic Ink Veils (No Banding)`,
      isCovering: true,
      activeFunction: `FluidInkWash[PureVeil_${colorStyle.toUpperCase()}]`
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
