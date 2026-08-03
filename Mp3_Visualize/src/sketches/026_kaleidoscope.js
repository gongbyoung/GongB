/**
 * src/sketches/026_kaleidoscope.js
 * - [026호 만화경 Ver 3.0 - Solid Fill Volume Duplication & Ratio Framing]
 * - 테두리선(Stroke) 100% 제거 ➔ 부드러운 다층 채우기(Fill Only)
 * - 극단적 크기 차이 (거대 배경 쉐이프 ~ 미세 파티클)
 * - 4-Stem 볼륨 상승 시 2~4중 동심원/동심도형 중복 충격파 팝업
 * - 16:9, 9:16 Export 비율 변경 시 실시간 프레임 클리핑 연동
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
    this.version = "026호 만화경 Ver 3.0 (Fill Only & Dynamic Scale)";
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
  // 🎲 무작위성 및 다채로운 크기의 방사형 원소 생성
  // =========================================================================
  generateElements(seed) {
    this.elements = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 드럼 기하학 쉐이프 (거대 쉐이프 ~ 소형 쉐이프)
    for (let i = 0; i < 22; i++) {
      const r1 = pseudoRand(seed + i * 2.1);
      const r2 = pseudoRand(seed + i * 4.3);
      const r3 = pseudoRand(seed + i * 6.7);
      const r4 = pseudoRand(seed + i * 9.1);

      // 크기 분포: 거대(0.15), 중간(0.35), 소형(0.50)
      let sizeCategory = 30 + r3 * 50; // 기본
      if (r4 < 0.18) sizeCategory = 180 + r3 * 220; // 💡 배경 거대 쉐이프
      else if (r4 < 0.5) sizeCategory = 70 + r3 * 90;  // 중간 쉐이프

      this.elements.push({
        type: 'drumShape',
        shapeType: Math.floor(r1 * 3), // 0: 원, 1: 삼각, 2: 사각
        radialProgress: r2,
        speed: 0.12 + r3 * 0.38,
        angleSector: r1 * Math.PI,
        baseSize: sizeCategory,
        rotOffset: r4 * Math.PI * 2,
        seed: seed + i * 11.3
      });
    }

    // 2. 베이스 방사 띠
    for (let i = 0; i < 20; i++) {
      const r1 = pseudoRand(seed + i * 3.1);
      const r2 = pseudoRand(seed + i * 5.7);

      this.elements.push({
        type: 'bassLine',
        radialProgress: r1,
        lengthRatio: 0.15 + r2 * 0.45,
        widthRatio: 8 + r1 * 25,
        angleSector: (i / 20) * Math.PI,
        seed: seed + i * 17.1
      });
    }

    // 3. 기타/그외 별 & 다이아몬드 파티클
    for (let i = 0; i < 24; i++) {
      const r1 = pseudoRand(seed + i * 1.9);
      const r2 = pseudoRand(seed + i * 3.7);
      const r3 = pseudoRand(seed + i * 5.3);

      this.elements.push({
        type: 'guitarStar',
        radialProgress: r1,
        direction: r2 > 0.5 ? 1 : -1,
        starPoints: r2 > 0.6 ? 5 : r2 > 0.3 ? 4 : 6,
        angleSector: r1 * Math.PI,
        size: 12 + r3 * 45,
        seed: seed + i * 23.5
      });
    }
  }

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
    const innerRadius = radius * 0.42;
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

    // Export 비율 파악 ('full', '16:9', '9:16')
    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    // ⚡ [Scatter]: 1 ~ 500 속도
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));
    const segments = Math.floor(6 + (Math.min(50, rawScatter) / 50) * 10);

    // 🎨 [Glow]: 크기 및 농도
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 오디오 4-Stem 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    this.time += (0.006 + vocalsVol * 0.015) * (scatterSpeed / 30.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 💡 [16:9 / 9:16 레터박스 뷰포트 영점 계산]
    let renderW = W;
    let renderH = H;
    let renderX = 0;
    let renderY = 0;

    if (exportRatio === '16:9') {
      renderW = W;
      renderH = W * (9 / 16);
      if (renderH > H) {
        renderH = H;
        renderW = H * (16 / 9);
      }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
    } else if (exportRatio === '9:16') {
      renderH = H;
      renderW = H * (9 / 16);
      if (renderW > W) {
        renderW = W;
        renderH = W * (16 / 9);
      }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
    }

    const maxRadius = Math.sqrt(renderW * renderW + renderH * renderH) * 0.60;

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateElements(seedVal);
    }

    this.ctx.save();

    // 캔버스 전체 배경 (어두운 레터박스 영역)
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    // 💡 선택한 16:9 / 9:16 프레임 내부만 클리핑
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 🎨 팔레트 설정
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

    // 선택 프레임 내부 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    // 프레임 중앙 원점 배치
    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;
    this.ctx.translate(centerX, centerY);

    const sectorAngle = (Math.PI * 2) / segments;

    for (let s = 0; s < segments; s++) {
      this.ctx.save();
      
      this.ctx.rotate(s * sectorAngle);
      if (s % 2 === 1) {
        this.ctx.scale(1, -1);
      }

      this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

      // ---------------------------------------------------------------------
      // 1. 🥁 드럼 반응: 볼륨에 따른 도형 다층 중복(Duplication) 폭발
      // ---------------------------------------------------------------------
      const drumImpact = drumsVol * 1.8;
      // 볼륨이 높으면 2~4개 중첩 레이어 생성
      const dupCount = Math.floor(1 + drumImpact * 2.5);

      this.elements.filter(e => e.type === 'drumShape').forEach((elem, idx) => {
        const color = colorPalette[idx % colorPalette.length];
        
        let currentR = (elem.radialProgress + this.time * elem.speed * 0.8) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR * (1.0 + drumImpact * 0.2);
        const baseS = elem.baseSize * scaleFactor * (0.35 + currentR * 1.1);

        const alphaFade = Math.sin(currentR * Math.PI);

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        // 💡 [핵심]: stroke 없이 오직 fill 기반 다층 중복 팝업!
        for (let dup = 0; dup < dupCount; dup++) {
          const layerScale = 1.0 + dup * (0.35 + drumImpact * 0.2);
          const size = baseS * layerScale;
          const fillAlpha = (isDark ? 0.35 : 0.22) * alphaFade * (1.0 / (dup + 1));

          this.ctx.fillStyle = `rgba(${color}, ${fillAlpha})`;

          if (elem.shapeType === 0) { // 원형
            this.ctx.beginPath();
            this.ctx.arc(px, py, size, 0, Math.PI * 2);
            this.ctx.fill();
          } else if (elem.shapeType === 1) { // 삼각형
            this.drawPolygon(this.ctx, px, py, size, 3, elem.rotOffset + elem.angleSector);
            this.ctx.fill();
          } else { // 사각형
            this.drawPolygon(this.ctx, px, py, size, 4, elem.rotOffset + elem.angleSector);
            this.ctx.fill();
          }
        }
      });

      // ---------------------------------------------------------------------
      // 2. 🎸 베이스 반응: 중심 방사 채우기 띠 (Fill Band)
      // ---------------------------------------------------------------------
      const bassExpand = bassVol * 1.8;
      this.elements.filter(e => e.type === 'bassLine').forEach((elem, idx) => {
        const color = colorPalette[(idx + 1) % colorPalette.length];

        let currentR = (elem.radialProgress + this.time * 0.22) % 1.0;
        const startR = maxRadius * currentR;
        const length = maxRadius * elem.lengthRatio * (1.0 + bassExpand * 1.4);
        const width = elem.widthRatio * scaleFactor * (1.0 + bassExpand * 1.2);

        const alphaFade = Math.sin(currentR * Math.PI);
        const fillAlpha = (isDark ? 0.40 : 0.25) * alphaFade;

        const x1 = Math.cos(elem.angleSector) * startR;
        const y1 = Math.sin(elem.angleSector) * startR;
        const x2 = Math.cos(elem.angleSector) * (startR + length);
        const y2 = Math.sin(elem.angleSector) * (startR + length);

        // 두꺼운 직사각형 띠 채우기
        const perpAngle = elem.angleSector + Math.PI / 2;
        const px = Math.cos(perpAngle) * (width / 2);
        const py = Math.sin(perpAngle) * (width / 2);

        this.ctx.fillStyle = `rgba(${color}, ${fillAlpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 + px, y1 + py);
        this.ctx.lineTo(x2 + px, y2 + py);
        this.ctx.lineTo(x2 - px, y2 - py);
        this.ctx.lineTo(x1 - px, y1 - py);
        this.ctx.closePath();
        this.ctx.fill();
      });

      // ---------------------------------------------------------------------
      // 3. 🎤 보컬 반응: 방사형 나선 구름 리플 (Spiral Ripple Fill)
      // ---------------------------------------------------------------------
      if (vocalsVol > 0.02) {
        const spiralColor = colorPalette[2 % colorPalette.length];
        const spiralPoints = 60;
        const rippleWidth = (15 + vocalsVol * 30) * scaleFactor;

        this.ctx.fillStyle = `rgba(${spiralColor}, ${isDark ? 0.35 : 0.20})`;

        for (let p = 0; p < spiralPoints; p += 2) {
          const ratio = p / spiralPoints;
          const wave = Math.sin(ratio * 20.0 - this.time * 6.0) * (vocalsVol * 35.0 * scaleFactor);
          const r = (ratio * maxRadius * 0.8) + wave;
          const a = ratio * Math.PI * 3.0;

          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;

          this.ctx.beginPath();
          this.ctx.arc(sx, sy, rippleWidth * (0.5 + ratio * 0.8), 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // ---------------------------------------------------------------------
      // 4. 🎹 기타/그외 반응: 중첩 채우기 별 (Multi-Layer Fill Star)
      // ---------------------------------------------------------------------
      const otherGlow = otherVol * 1.8;
      const starDupCount = Math.floor(1 + otherGlow * 2.0);

      this.elements.filter(e => e.type === 'guitarStar').forEach((elem, idx) => {
        const color = colorPalette[(idx + 2) % colorPalette.length];

        let currentR = (elem.radialProgress + this.time * 0.2 * elem.direction) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR;
        const baseS = elem.size * scaleFactor * (0.4 + currentR * 1.1);

        const alphaFade = Math.sin(currentR * Math.PI);

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        for (let dup = 0; dup < starDupCount; dup++) {
          const size = baseS * (1.0 + dup * 0.4);
          const fillAlpha = (isDark ? 0.45 : 0.28) * alphaFade * (1.0 / (dup + 1));

          this.ctx.fillStyle = `rgba(${color}, ${fillAlpha})`;
          this.drawStar(this.ctx, px, py, size, elem.starPoints, elem.angleSector + dup * 0.2);
          this.ctx.fill();
        }
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Kaleidoscope Ver3 (${exportRatio.toUpperCase()} ${renderW}x${renderH})`,
      isCovering: true,
      activeFunction: `Kaleidoscope[RatioFill_${colorStyle.toUpperCase()}]`
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
