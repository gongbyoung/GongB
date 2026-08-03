/**
 * src/sketches/026_kaleidoscope.js
 * - [026호 오디오 반응형 만화경 Ver 1.0 - Multi-Stem Kaleidoscope]
 * - 🥁 드럼: 원형, 삼각형, 사각형 팝업 기하학 쉐이프
 * - 🎸 베이스: 짧고 긴 선형 레이저 빔 & 폴리곤 바
 * - 🎤 보컬: 나선형(Spiral) 회전 파형
 * - 🎹 기타/그외: 별, 다이아몬드, 추상 파티클
 * - Range (Scatter): 만화경 거울 대칭 분할 수(6~16) & 회전 속도 연동
 * - Scale (Glow): 쉐이프 크기 및 선 두께 연동
 */

export default class KaleidoscopeSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "026호 만화경 Ver 1.0";
    this.elements = [];
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

  hexToRgb(hex) {
    if (!hex) return "0, 240, 255";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // =========================================================================
  // 🎲 시드 기반 만화경 내부 기하학 원소 생성
  // =========================================================================
  generateElements(seed, maxDist) {
    this.elements = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 드럼 기하학 쉐이프 (원, 삼각, 사각)
    for (let i = 0; i < 12; i++) {
      const r1 = pseudoRand(seed + i * 2.1);
      const r2 = pseudoRand(seed + i * 4.3);
      const r3 = pseudoRand(seed + i * 6.7);

      this.elements.push({
        type: 'drumShape',
        shapeType: Math.floor(r1 * 3), // 0: 원, 1: 삼각, 2: 사각
        baseR: 0.15 + r2 * 0.75,       // 중심 기준 거리를 비율로 지정
        baseSize: 18 + r3 * 35,
        rotOffset: r1 * Math.PI * 2,
        seed: seed + i * 11.3
      });
    }

    // 2. 베이스 선형 레이저 빔 (짧고 긴 선)
    for (let i = 0; i < 16; i++) {
      const r1 = pseudoRand(seed + i * 3.1);
      const r2 = pseudoRand(seed + i * 5.7);

      this.elements.push({
        type: 'bassLine',
        startRatio: 0.05 + r1 * 0.4,
        lengthRatio: 0.1 + r2 * 0.45,  // 짧고 긴 선
        angleOffset: (i / 16) * Math.PI,
        seed: seed + i * 17.1
      });
    }

    // 3. 기타/그외 추상 다면체 & 별
    for (let i = 0; i < 14; i++) {
      const r1 = pseudoRand(seed + i * 1.9);
      const r2 = pseudoRand(seed + i * 3.7);

      this.elements.push({
        type: 'guitarStar',
        distRatio: 0.2 + r1 * 0.7,
        starPoints: r2 > 0.5 ? 5 : 4,
        size: 12 + r2 * 25,
        seed: seed + i * 23.5
      });
    }
  }

  // =========================================================================
  // 🖌️ 도형 렌더링 도우미 (원, 삼각, 사각, 별)
  // =========================================================================
  drawPolygon(ctx, x, y, radius, sides, angle = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawStar(ctx, x, y, radius, points, angle = 0) {
    ctx.beginPath();
    const innerRadius = radius * 0.45;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : innerRadius;
      const a = angle + (i / (points * 2)) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = audioData || {};

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // ⚡ [Range (Scatter)]: 거울 대칭 분할 수(6~16) 및 속도 연동 (1~500)
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));
    const segments = Math.floor(6 + (Math.min(50, rawScatter) / 50) * 10); // 6 ~ 16 분할 만화경

    // 🎨 [Scale (Glow)]: 크기 및 선 두께 연동
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 오디오 4-Stem 음압 추출
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 시간 가속
    this.time += (0.008 + vocalsVol * 0.02) * (scatterSpeed / 30.0);

    const W = this.canvas.width;
    const H = this.canvas.height;
    const maxRadius = Math.sqrt(W * W + H * H) * 0.55;

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateElements(seedVal, maxRadius);
    }

    this.ctx.save();

    // 🎨 팔레트 및 색상 지정
    let bgColor = "#04050d";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    let colorPalette = [];
    if (colorStyle === 'neon') {
      bgColor = "#04050d";
      isDark = true;
      colorPalette = [cGas1, cGas2, cStar, "180, 100, 255"];
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0";
      isDark = false;
      colorPalette = [cGas1, cGas2, cStar, "160, 120, 210"];
    } else if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea";
      isDark = false;
      colorPalette = ["20, 26, 38", "42, 50, 68", "120, 80, 50"];
    } else {
      bgColor = "#0b0c16";
      isDark = true;
      colorPalette = ["255, 60, 120", "0, 220, 255", "255, 200, 50", "150, 80, 255"];
    }

    // 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, W, H);

    // 중심점 기준 만화경 거울 변환
    const centerX = W / 2;
    const centerY = H / 2;
    this.ctx.translate(centerX, centerY);

    // 오디오 반응형 글로벌 회전
    const globalRot = this.time * 0.15 + (otherVol * 0.5);

    // 💡 [핵심]: N분할 거울 대칭 반사 반복문
    const sectorAngle = (Math.PI * 2) / segments;

    for (let s = 0; s < segments; s++) {
      this.ctx.save();
      
      this.ctx.rotate(s * sectorAngle + globalRot);
      // 홀수 거울면은 반대로 뒤집어 실제 만화경 반사 생성
      if (s % 2 === 1) {
        this.ctx.scale(1, -1);
      }

      this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

      // ---------------------------------------------------------------------
      // 1. 🥁 드럼 반응: 원형, 삼각형, 사각형 팝업 기하학 쉐이프
      // ---------------------------------------------------------------------
      const drumImpact = drumsVol * 1.5;
      this.elements.filter(e => e.type === 'drumShape').forEach((elem, idx) => {
        const color = colorPalette[idx % colorPalette.length];
        const dist = maxRadius * elem.baseR * (1.0 + drumImpact * 0.4);
        const size = elem.baseSize * scaleFactor * (1.0 + drumImpact * 1.2);
        const rot = elem.rotOffset + this.time * 0.8;

        this.ctx.strokeStyle = `rgba(${color}, ${isDark ? 0.85 : 0.65})`;
        this.ctx.fillStyle = `rgba(${color}, ${isDark ? 0.25 : 0.15})`;
        this.ctx.lineWidth = (2.0 + drumImpact * 3.0) * scaleFactor;

        const px = Math.cos(rot) * dist;
        const py = Math.sin(rot) * dist;

        if (elem.shapeType === 0) { // 원형
          this.ctx.beginPath();
          this.ctx.arc(px, py, size, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.fill();
        } else if (elem.shapeType === 1) { // 삼각형
          this.drawPolygon(this.ctx, px, py, size, 3, rot * 1.5);
          this.ctx.stroke();
          this.ctx.fill();
        } else { // 사각형
          this.drawPolygon(this.ctx, px, py, size, 4, rot * 1.2);
          this.ctx.stroke();
          this.ctx.fill();
        }
      });

      // ---------------------------------------------------------------------
      // 2. 🎸 베이스 반응: 짧고 긴 선형 레이저 빔 & 정다각형 링
      // ---------------------------------------------------------------------
      const bassExpand = bassVol * 1.6;
      this.elements.filter(e => e.type === 'bassLine').forEach((elem, idx) => {
        const color = colorPalette[(idx + 1) % colorPalette.length];
        const startR = maxRadius * elem.startRatio;
        const length = maxRadius * elem.lengthRatio * (1.0 + bassExpand * 1.4);
        const angle = elem.angleOffset + Math.sin(this.time * 0.5 + elem.seed) * 0.2;

        const x1 = Math.cos(angle) * startR;
        const y1 = Math.sin(angle) * startR;
        const x2 = Math.cos(angle) * (startR + length);
        const y2 = Math.sin(angle) * (startR + length);

        this.ctx.strokeStyle = `rgba(${color}, ${isDark ? 0.9 : 0.75})`;
        this.ctx.lineWidth = (1.5 + bassExpand * 4.0) * scaleFactor;

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      });

      // ---------------------------------------------------------------------
      // 3. 🎤 보컬 반응: 나선형 (Spiral) 파동 파형
      // ---------------------------------------------------------------------
      if (vocalsVol > 0.02) {
        const spiralColor = colorPalette[2 % colorPalette.length];
        this.ctx.strokeStyle = `rgba(${spiralColor}, ${isDark ? 0.9 : 0.7})`;
        this.ctx.lineWidth = (2.0 + vocalsVol * 3.5) * scaleFactor;

        this.ctx.beginPath();
        const spiralTurns = 3;
        const spiralPoints = 60;
        for (let p = 0; p < spiralPoints; p++) {
          const ratio = p / spiralPoints;
          const a = ratio * Math.PI * 2 * spiralTurns + this.time * 2.0;
          const wave = Math.sin(ratio * 20 + this.time * 5.0) * (vocalsVol * 25.0 * scaleFactor);
          const r = (ratio * maxRadius * 0.7) + wave;

          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;

          if (p === 0) this.ctx.moveTo(sx, sy);
          else this.ctx.lineTo(sx, sy);
        }
        this.ctx.stroke();
      }

      // ---------------------------------------------------------------------
      // 4. 🎹 기타/그외 반응: 별, 다이아몬드, 추상 파티클
      // ---------------------------------------------------------------------
      const otherGlow = otherVol * 1.8;
      this.elements.filter(e => e.type === 'guitarStar').forEach((elem, idx) => {
        const color = colorPalette[(idx + 2) % colorPalette.length];
        const dist = maxRadius * elem.distRatio + Math.sin(this.time + elem.seed) * 30;
        const rot = elem.seed + this.time * 1.2;
        const size = elem.size * scaleFactor * (1.0 + otherGlow * 1.0);

        const px = Math.cos(rot) * dist;
        const py = Math.sin(rot) * dist;

        this.ctx.strokeStyle = `rgba(${color}, ${isDark ? 0.95 : 0.8})`;
        this.ctx.fillStyle = `rgba(${color}, ${isDark ? 0.3 : 0.2})`;
        this.ctx.lineWidth = 1.5 * scaleFactor;

        this.drawStar(this.ctx, px, py, size, elem.starPoints, rot * 2);
        this.ctx.stroke();
        this.ctx.fill();
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Kaleidoscope (${segments} Mirrors)`,
      isCovering: true,
      activeFunction: `Kaleidoscope[${segments}Seg_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.elements = [];
  }
}
