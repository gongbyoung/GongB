/**
 * src/sketches/026_kaleidoscope.js
 * - [026호 만화경 Ver 4.0 - Hyper-Reactive 4-Stem Separation Engine]
 * - 4-Stem 악기별 지수형 반응곡선(Power Curve) 적용 ➔ 타격감 대폭 강화
 * - 🥁 드럼: 순간 폭발 크기 팽창 + 2~4중 동심 도형 충격파 팝업
 * - 🎸 베이스: 저음 음압 연동 두꺼운 방사 빔 폭 수축/팽창
 * - 🎤 보컬: 목소리 음압 연동 중앙 나선 파동(Spiral Ribbon) 높낮이 가속
 * - 🎹 기타/그외: 고음 선율 연동 외곽 별 파티클 반짝임 & 크기 반응
 * - 16:9 / 9:16 Export 비율 및 +10% 오버스캔 마진 연동
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
    this.version = "026호 만화경 Ver 4.0 (Hyper-Reactive 4-Stem)";
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
  // 🎲 만화경 원소 생성
  // =========================================================================
  generateElements(seed) {
    this.elements = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 드럼 전용 기하학 쉐이프
    for (let i = 0; i < 20; i++) {
      const r1 = pseudoRand(seed + i * 2.1);
      const r2 = pseudoRand(seed + i * 4.3);
      const r3 = pseudoRand(seed + i * 6.7);

      this.elements.push({
        type: 'drumShape',
        shapeType: Math.floor(r1 * 3), // 0: 원, 1: 삼각, 2: 사각
        radialProgress: r2,
        speed: 0.15 + r3 * 0.35,
        angleSector: r1 * Math.PI,
        baseSize: 25 + r3 * 65,
        rotOffset: r2 * Math.PI * 2,
        seed: seed + i * 11.3
      });
    }

    // 2. 베이스 전용 방사 빔 기둥
    for (let i = 0; i < 18; i++) {
      const r1 = pseudoRand(seed + i * 3.1);
      const r2 = pseudoRand(seed + i * 5.7);

      this.elements.push({
        type: 'bassLine',
        radialProgress: r1,
        lengthRatio: 0.20 + r2 * 0.40,
        baseWidth: 10 + r1 * 28,
        angleSector: (i / 18) * Math.PI,
        seed: seed + i * 17.1
      });
    }

    // 3. 기타/그외 전용 별 파티클
    for (let i = 0; i < 22; i++) {
      const r1 = pseudoRand(seed + i * 1.9);
      const r2 = pseudoRand(seed + i * 3.7);
      const r3 = pseudoRand(seed + i * 5.3);

      this.elements.push({
        type: 'guitarStar',
        radialProgress: r1,
        direction: r2 > 0.5 ? 1 : -1,
        starPoints: r2 > 0.6 ? 5 : r2 > 0.3 ? 4 : 6,
        angleSector: r1 * Math.PI,
        baseSize: 15 + r3 * 40,
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

    // Export 비율 파악
    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    // ⚡ [Scatter]: 1 ~ 500 속도
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));
    const segments = Math.floor(6 + (Math.min(50, rawScatter) / 50) * 10);

    // 🎨 [Glow]: 크기 및 농도
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 💡 [핵심 1]: 4-Stem 음압 추출 및 지수형 비트 연산 (Non-linear Response)
    const rawVocals = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const rawDrums  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const rawBass   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const rawOther  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 비트 감도를 폭발적으로 극대화하는 지수 반응 곡선
    const drumsPower  = Math.pow(Math.min(1.0, rawDrums * 1.3), 1.2) * 2.2;
    const bassPower   = Math.pow(Math.min(1.0, rawBass * 1.3), 1.2) * 2.0;
    const vocalsPower = Math.pow(Math.min(1.0, rawVocals * 1.3), 1.1) * 2.2;
    const otherPower  = Math.pow(Math.min(1.0, rawOther * 1.3), 1.2) * 2.0;

    this.time += (0.006 + vocalsPower * 0.02) * (scatterSpeed / 30.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 💡 Export 프레임 영점 계산
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    if (exportRatio === '16:9') {
      renderW = W;
      renderH = W * (9 / 16);
      if (renderH > H) { renderH = H; renderW = H * (16 / 9); }
      renderX = (W - renderW) / 2; renderY = (H - renderH) / 2;
    } else if (exportRatio === '9:16') {
      renderH = H;
      renderW = H * (9 / 16);
      if (renderW > W) { renderW = W; renderH = W * (16 / 9); }
      renderX = (W - renderW) / 2; renderY = (H - renderH) / 2;
    }

    const maxRadius = Math.sqrt(renderW * renderW + renderH * renderH) * 0.60;

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateElements(seedVal);
    }

    this.ctx.save();

    // 캔버스 배경
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    // 프레임 클리핑
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 💡 [핵심 2]: 악기별 구분을 명확히 해주는 전용 고대비 색상 팔레트
    let bgColor = "#04050d";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    // 스템별 선명한 전용 색상 지정
    let drumColor = "255, 50, 100";   // 드럼: 선명한 붉은 핑크
    let bassColor = "0, 230, 255";    // 베이스: 깊은 형광 시안 Blue
    let vocalColor = "255, 215, 0";   // 보컬: 선명한 골드 Yellow
    let otherColor = "180, 80, 255";  // 기타: 강렬한 보라 퍼플

    if (colorStyle === 'neon') {
      bgColor = "#04050d"; isDark = true;
      drumColor = cGas1; bassColor = cGas2; vocalColor = cStar; otherColor = "180, 100, 255";
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0"; isDark = false;
      drumColor = "230, 100, 130"; bassColor = "90, 160, 220"; vocalColor = "220, 160, 70"; otherColor = "150, 110, 200";
    } else if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#f4f1ea"; isDark = false;
      drumColor = "20, 26, 38"; bassColor = "42, 50, 68"; vocalColor = "120, 80, 50"; otherColor = "80, 70, 90";
    }

    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

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
      // 1. 🥁 드럼 반응: 타격 시 폭발적 크기 확대 + 2~4중 동심 충격파 팝업
      // ---------------------------------------------------------------------
      const drumDupCount = Math.floor(1 + drumsPower * 2.5);

      this.elements.filter(e => e.type === 'drumShape').forEach((elem) => {
        let currentR = (elem.radialProgress + this.time * elem.speed * 0.8) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR;
        const baseS = elem.baseSize * scaleFactor * (0.3 + currentR * 1.1) * (1.0 + drumsPower * 1.5);
        const alphaFade = Math.sin(currentR * Math.PI);

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        for (let dup = 0; dup < drumDupCount; dup++) {
          const layerScale = 1.0 + dup * (0.4 + drumsPower * 0.25);
          const size = baseS * layerScale;
          const fillAlpha = (isDark ? 0.45 : 0.28) * alphaFade * (1.0 / (dup + 1)) * (0.4 + drumsPower * 0.6);

          this.ctx.fillStyle = `rgba(${drumColor}, ${fillAlpha})`;

          if (elem.shapeType === 0) {
            this.ctx.beginPath();
            this.ctx.arc(px, py, size, 0, Math.PI * 2);
            this.ctx.fill();
          } else if (elem.shapeType === 1) {
            this.drawPolygon(this.ctx, px, py, size, 3, elem.rotOffset + elem.angleSector);
            this.ctx.fill();
          } else {
            this.drawPolygon(this.ctx, px, py, size, 4, elem.rotOffset + elem.angleSector);
            this.ctx.fill();
          }
        }
      });

      // ---------------------------------------------------------------------
      // 2. 🎸 베이스 반응: 저음 음압 연동 두꺼운 방사 빔 수축/팽창
      // ---------------------------------------------------------------------
      this.elements.filter(e => e.type === 'bassLine').forEach((elem) => {
        let currentR = (elem.radialProgress + this.time * 0.22) % 1.0;
        const startR = maxRadius * currentR;
        const length = maxRadius * elem.lengthRatio * (1.0 + bassPower * 1.6);
        const width = elem.baseWidth * scaleFactor * (1.0 + bassPower * 2.2);

        const alphaFade = Math.sin(currentR * Math.PI);
        const fillAlpha = (isDark ? 0.50 : 0.30) * alphaFade * (0.3 + bassPower * 0.7);

        const x1 = Math.cos(elem.angleSector) * startR;
        const y1 = Math.sin(elem.angleSector) * startR;
        const x2 = Math.cos(elem.angleSector) * (startR + length);
        const y2 = Math.sin(elem.angleSector) * (startR + length);

        const perpAngle = elem.angleSector + Math.PI / 2;
        const px = Math.cos(perpAngle) * (width / 2);
        const py = Math.sin(perpAngle) * (width / 2);

        this.ctx.fillStyle = `rgba(${bassColor}, ${fillAlpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 + px, y1 + py);
        this.ctx.lineTo(x2 + px, y2 + py);
        this.ctx.lineTo(x2 - px, y2 - py);
        this.ctx.lineTo(x1 - px, y1 - py);
        this.ctx.closePath();
        this.ctx.fill();
      });

      // ---------------------------------------------------------------------
      // 3. 🎤 보컬 반응: 목소리 나올 때만 선명히 요동치는 중앙 나선 파동
      // ---------------------------------------------------------------------
      if (vocalsPower > 0.05) {
        const spiralPoints = 65;
        const rippleWidth = (12 + vocalsPower * 35) * scaleFactor;
        const fillAlpha = (isDark ? 0.55 : 0.35) * Math.min(1.0, vocalsPower);

        this.ctx.fillStyle = `rgba(${vocalColor}, ${fillAlpha})`;

        for (let p = 0; p < spiralPoints; p += 2) {
          const ratio = p / spiralPoints;
          const wave = Math.sin(ratio * 22.0 - this.time * 7.0) * (vocalsPower * 40.0 * scaleFactor);
          const r = (ratio * maxRadius * 0.8) + wave;
          const a = ratio * Math.PI * 3.2;

          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;

          this.ctx.beginPath();
          this.ctx.arc(sx, sy, rippleWidth * (0.4 + ratio * 0.9), 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // ---------------------------------------------------------------------
      // 4. 🎹 기타/그외 반응: 고음 선율에 반응하는 별 파티클 반짝임 & 지터
      // ---------------------------------------------------------------------
      const starDupCount = Math.floor(1 + otherPower * 2.0);

      this.elements.filter(e => e.type === 'guitarStar').forEach((elem) => {
        let currentR = (elem.radialProgress + this.time * 0.22 * elem.direction) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR;
        const baseS = elem.baseSize * scaleFactor * (0.35 + currentR * 1.1) * (1.0 + otherPower * 1.4);

        const alphaFade = Math.sin(currentR * Math.PI);

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        for (let dup = 0; dup < starDupCount; dup++) {
          const size = baseS * (1.0 + dup * 0.35);
          const fillAlpha = (isDark ? 0.50 : 0.30) * alphaFade * (1.0 / (dup + 1)) * (0.3 + otherPower * 0.7);

          this.ctx.fillStyle = `rgba(${otherColor}, ${fillAlpha})`;
          this.drawStar(this.ctx, px, py, size, elem.starPoints, elem.angleSector + dup * 0.2 + otherPower);
          this.ctx.fill();
        }
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Kaleidoscope 4-Stem (D:${drumsPower.toFixed(1)}, B:${bassPower.toFixed(1)}, V:${vocalsPower.toFixed(1)})`,
      isCovering: true,
      activeFunction: `Kaleidoscope[Reactive4Stem_${colorStyle.toUpperCase()}]`
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
