/**
 * src/sketches/026_kaleidoscope.js
 * - [026호 만화경 Ver 2.0 - Radial Tunnel Flow & Export Ratio]
 * - 회전 운동 완전 제거 ➔ 중심점 입출(Inward/Outward Radial Motion) 전면 개혁
 * - 🥁 드럼: 중심 방사 폭발 원/삼각/사각 팝업
 * - 🎸 베이스: 중심 수축/팽창 레이저 빔
 * - 🎤 보컬: 중심 방사 파동 나선(Radial Spiral Ripple)
 * - 🎹 기타/그외: 중심 흡입/분출 별 파티클
 * - 16:9 / 9:16 Export 비율 & +10% 오버스캔 마진 연동
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
    this.version = "026호 만화경 Ver 2.0 (Radial Tunnel Flow)";
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
  // 🎲 방사형 입출 기하학 원소 생성
  // =========================================================================
  generateElements(seed) {
    this.elements = [];

    const pseudoRand = (s) => {
      let mask = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return mask - Math.floor(mask);
    };

    // 1. 드럼 기하학 쉐이프 (원, 삼각, 사각)
    for (let i = 0; i < 16; i++) {
      const r1 = pseudoRand(seed + i * 2.1);
      const r2 = pseudoRand(seed + i * 4.3);
      const r3 = pseudoRand(seed + i * 6.7);

      this.elements.push({
        type: 'drumShape',
        shapeType: Math.floor(r1 * 3), // 0: 원, 1: 삼각, 2: 사각
        radialProgress: r2,            // 0.0(중심) ~ 1.0(외곽) 방사 진행도
        speed: 0.15 + r3 * 0.35,       // 방사 속도
        angleSector: r1 * Math.PI,      // 섹터 내 고정 각도
        baseSize: 15 + r3 * 30,
        seed: seed + i * 11.3
      });
    }

    // 2. 베이스 직선 레이저 빔
    for (let i = 0; i < 18; i++) {
      const r1 = pseudoRand(seed + i * 3.1);
      const r2 = pseudoRand(seed + i * 5.7);

      this.elements.push({
        type: 'bassLine',
        radialProgress: r1,
        lengthRatio: 0.12 + r2 * 0.35,
        angleSector: (i / 18) * Math.PI,
        seed: seed + i * 17.1
      });
    }

    // 3. 기타/그외 추상 별 파티클
    for (let i = 0; i < 18; i++) {
      const r1 = pseudoRand(seed + i * 1.9);
      const r2 = pseudoRand(seed + i * 3.7);

      this.elements.push({
        type: 'guitarStar',
        radialProgress: r1,
        direction: r2 > 0.5 ? 1 : -1,  // 1: 밖으로, -1: 안으로
        starPoints: r2 > 0.5 ? 5 : 4,
        angleSector: r1 * Math.PI,
        size: 10 + r2 * 22,
        seed: seed + i * 23.5
      });
    }
  }

  // =========================================================================
  // 🖌️ 도형 렌더링 도우미
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

    // ⚡ [Range (Scatter)]: 거울 대칭 분할 수(6~16) 및 방사 속도 연동 (1~500)
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));
    const segments = Math.floor(6 + (Math.min(50, rawScatter) / 50) * 10); // 6 ~ 16 분할 만화경

    // 🎨 [Scale (Glow)]: 크기 및 선 두께 연동
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 오디오 4-Stem 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 시간 가속
    const flowTimeDelta = (0.006 + vocalsVol * 0.015) * (scatterSpeed / 30.0);
    this.time += flowTimeDelta;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const maxRadius = Math.sqrt(W * W + H * H) * 0.60;

    if (this.loadedSeed !== seedVal || this.width !== W || this.height !== H) {
      this.loadedSeed = seedVal;
      this.generateElements(seedVal);
    }

    this.ctx.save();

    // 💡 [Export 비율 대응]: +10% 오버스캔 클리핑
    const marginX = W * 0.10;
    const marginY = H * 0.10;

    this.ctx.beginPath();
    this.ctx.rect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);
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

    // 배경 채우기
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(-marginX, -marginY, W + marginX * 2, H + marginY * 2);

    // 중심점 기준 만화경 거울 변환
    const centerX = W / 2;
    const centerY = H / 2;
    this.ctx.translate(centerX, centerY);

    // 💡 N분할 거울 대칭 반사 반복문 (회전 회전값 고정)
    const sectorAngle = (Math.PI * 2) / segments;

    for (let s = 0; s < segments; s++) {
      this.ctx.save();
      
      this.ctx.rotate(s * sectorAngle);
      // 홀수 거울면 대칭 반사
      if (s % 2 === 1) {
        this.ctx.scale(1, -1);
      }

      this.ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';

      // ---------------------------------------------------------------------
      // 1. 🥁 드럼 반응: 중심에서 밖으로 터져 나오는 원/삼각/사각
      // ---------------------------------------------------------------------
      const drumImpact = drumsVol * 1.5;
      this.elements.filter(e => e.type === 'drumShape').forEach((elem, idx) => {
        const color = colorPalette[idx % colorPalette.length];
        
        // 중심 ➔ 외곽 방사형 무한 이동 수식
        let currentR = (elem.radialProgress + this.time * elem.speed * 0.8) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR * (1.0 + drumImpact * 0.3);
        const size = elem.baseSize * scaleFactor * (0.3 + currentR * 1.2) * (1.0 + drumImpact * 0.8);

        // 중심 근처 및 화면 외곽 페이드 인/아웃
        const alphaFade = Math.sin(currentR * Math.PI);
        const finalAlpha = (isDark ? 0.85 : 0.65) * alphaFade;

        this.ctx.strokeStyle = `rgba(${color}, ${finalAlpha})`;
        this.ctx.fillStyle = `rgba(${color}, ${finalAlpha * 0.25})`;
        this.ctx.lineWidth = (2.0 + drumImpact * 3.0) * scaleFactor;

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        if (elem.shapeType === 0) { // 원형
          this.ctx.beginPath();
          this.ctx.arc(px, py, size, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.fill();
        } else if (elem.shapeType === 1) { // 삼각형
          this.drawPolygon(this.ctx, px, py, size, 3, elem.angleSector);
          this.ctx.stroke();
          this.ctx.fill();
        } else { // 사각형
          this.drawPolygon(this.ctx, px, py, size, 4, elem.angleSector);
          this.ctx.stroke();
          this.ctx.fill();
        }
      });

      // ---------------------------------------------------------------------
      // 2. 🎸 베이스 반응: 중심 수축/팽창 방사형 레이저 빔
      // ---------------------------------------------------------------------
      const bassExpand = bassVol * 1.6;
      this.elements.filter(e => e.type === 'bassLine').forEach((elem, idx) => {
        const color = colorPalette[(idx + 1) % colorPalette.length];

        let currentR = (elem.radialProgress + this.time * 0.25) % 1.0;
        const startR = maxRadius * currentR;
        const length = maxRadius * elem.lengthRatio * (1.0 + bassExpand * 1.5);

        const alphaFade = Math.sin(currentR * Math.PI);

        const x1 = Math.cos(elem.angleSector) * startR;
        const y1 = Math.sin(elem.angleSector) * startR;
        const x2 = Math.cos(elem.angleSector) * (startR + length);
        const y2 = Math.sin(elem.angleSector) * (startR + length);

        this.ctx.strokeStyle = `rgba(${color}, ${(isDark ? 0.9 : 0.7) * alphaFade})`;
        this.ctx.lineWidth = (1.5 + bassExpand * 4.0) * scaleFactor;

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      });

      // ---------------------------------------------------------------------
      // 3. 🎤 보컬 반응: 중심에서 퍼져나가는 나선형 파동 (Radial Spiral Ripple)
      // ---------------------------------------------------------------------
      if (vocalsVol > 0.02) {
        const spiralColor = colorPalette[2 % colorPalette.length];
        this.ctx.strokeStyle = `rgba(${spiralColor}, ${isDark ? 0.9 : 0.7})`;
        this.ctx.lineWidth = (2.0 + vocalsVol * 3.5) * scaleFactor;

        this.ctx.beginPath();
        const spiralPoints = 70;
        for (let p = 0; p < spiralPoints; p++) {
          const ratio = p / spiralPoints; // 0 (중심) ~ 1 (외곽)
          
          // 방사형으로 이동하는 파동 수식
          const wave = Math.sin(ratio * 25.0 - this.time * 6.0) * (vocalsVol * 30.0 * scaleFactor);
          const r = (ratio * maxRadius * 0.8) + wave;
          const a = ratio * Math.PI * 3.0; // 나선 각도

          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;

          if (p === 0) this.ctx.moveTo(sx, sy);
          else this.ctx.lineTo(sx, sy);
        }
        this.ctx.stroke();
      }

      // ---------------------------------------------------------------------
      // 4. 🎹 기타/그외 반응: 중심으로 빨려들거나 뿜어 나오는 별 파티클
      // ---------------------------------------------------------------------
      const otherGlow = otherVol * 1.8;
      this.elements.filter(e => e.type === 'guitarStar').forEach((elem, idx) => {
        const color = colorPalette[(idx + 2) % colorPalette.length];

        // 방향(1: 밖으로, -1: 안으로)에 따른 방사형 위치 연산
        let currentR = (elem.radialProgress + this.time * 0.2 * elem.direction) % 1.0;
        if (currentR < 0) currentR += 1.0;

        const dist = maxRadius * currentR;
        const size = elem.size * scaleFactor * (0.4 + currentR * 1.1) * (1.0 + otherGlow * 1.0);

        const alphaFade = Math.sin(currentR * Math.PI);

        const px = Math.cos(elem.angleSector) * dist;
        const py = Math.sin(elem.angleSector) * dist;

        this.ctx.strokeStyle = `rgba(${color}, ${(isDark ? 0.95 : 0.8) * alphaFade})`;
        this.ctx.fillStyle = `rgba(${color}, ${(isDark ? 0.3 : 0.2) * alphaFade})`;
        this.ctx.lineWidth = 1.5 * scaleFactor;

        this.drawStar(this.ctx, px, py, size, elem.starPoints, elem.angleSector);
        this.ctx.stroke();
        this.ctx.fill();
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Kaleidoscope Radial Tunnel (${segments} Mirrors)`,
      isCovering: true,
      activeFunction: `Kaleidoscope[RadialFlow_${colorStyle.toUpperCase()}]`
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
