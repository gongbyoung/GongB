/**
 * src/sketches/029_infinite_mandala.js
 * - [029호 무한 확장 만다라 & 5대 화풍 테마 시뮬레이터]
 * - 화면 중앙으로부터 겹겹이 회전하며 무한히 팽창하는 기하학적 장미창 만다라
 * - 바로크, 르네상스, 인상파, 야수파, 무채색 화풍별 색상 및 재질 질감 실시간 전환
 */
/**
 * src/sketches/029_infinite_mandala.js
 * - [거미줄 현상 완치] 선 긋기가 아닌 진짜 꽃잎/물방울 기하학 도형 기반의 웅장한 만다라
 * - 업로드된 이미지 배경 연동 및 5대 화풍 색감 완벽 적용
 */

export default class InfiniteMandalaSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "029호 리얼 플로럴 만다라 Ver 2.0";
    this.mandalaLayers = 6; // 겹쳐지는 꽃잎 층수
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

  getPalette(style) {
    const s = (style || 'neon').toLowerCase();
    if (s.includes('baroque') || s === 'baroque') {
      return { bg: '#080402', c1: '#d4af37', c2: '#8b0000', c3: '#5e1b00', glow: '#ffd700' };
    } else if (s.includes('renaissance') || s === 'renaissance') {
      return { bg: '#0b131f', c1: '#1d4ed8', c2: '#eab308', c3: '#b45309', glow: '#93c5fd' };
    } else if (s.includes('impressionism') || s === 'impressionism') {
      return { bg: '#1e1b2e', c1: '#c084fc', c2: '#67e8f9', c3: '#f472b6', glow: '#fbcfe8' };
    } else if (s.includes('fauvism') || s === 'fauvism') {
      return { bg: '#111827', c1: '#ef4444', c2: '#10b981', c3: '#f59e0b', glow: '#ec4899' };
    } else if (s.includes('monochrome') || s === 'monochrome') {
      return { bg: '#09090b', c1: '#ffffff', c2: '#a1a1aa', c3: '#3f3f46', glow: '#e4e4e7' };
    } else {
      return { bg: '#050508', c1: '#00f0ff', c2: '#ff007f', c3: '#7000ff', glow: '#00ffff' };
    }
  }

  // 🌸 연꽃잎 형태 그리기 함수
  drawLotusPetal(ctx, length, width) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(width, -length * 0.3, width, -length * 0.7, 0, -length);
    ctx.bezierCurveTo(-width, -length * 0.7, -width, -length * 0.3, 0, 0);
    ctx.closePath();
  }

  // 💧 물방울/나뭇잎 형태 그리기 함수
  drawTeardrop(ctx, length, width) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(width, -length * 0.5, 0, -length);
    ctx.quadraticCurveTo(-width, -length * 0.5, 0, 0);
    ctx.closePath();
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    const vol = audioData && audioData.vol ? audioData.vol : 0;
    const bass = audioData && audioData.bass ? audioData.bass : 0;
    const gainVal = settings.audioGain ?? 1.0;
    const gaugeVal = settings.gaugeValue ?? 0.5; 
    const colorStyle = settings.colorStyle || 'neon';

    const palette = this.getPalette(colorStyle);

    this.time += 0.008 + (bass * 0.015 * gainVal);

    this.ctx.save();
    this.ctx.clearRect(0, 0, W, H);

    // 1. 유저 업로드 배경 이미지 연동
    if (window.currentUploadedImageElement) {
      this.ctx.drawImage(window.currentUploadedImageElement, 0, 0, W, H);
      // 배경을 약간 어둡게 눌러주어 만다라와 글씨가 돋보이게 함
      this.ctx.fillStyle = `rgba(0, 0, 0, 0.65)`;
      this.ctx.fillRect(0, 0, W, H);
    } else {
      this.ctx.fillStyle = palette.bg;
      this.ctx.fillRect(0, 0, W, H);
    }

    const centerX = W / 2;
    const centerY = H / 2;
    const maxRadius = Math.max(W, H);

    // 2. 무한 확장 겹꽃잎 만다라 렌더링
    const baseScale = (this.time * (0.3 + gaugeVal * 0.6)) % 1.0;

    for (let i = 0; i < this.mandalaLayers; i++) {
      let progress = (baseScale + (i / this.mandalaLayers)) % 1.0;
      let radius = progress * maxRadius * 1.2;
      
      // 스케일이 커질수록 서서히 투명해짐 (무한 줌인 효과)
      let alpha = Math.sin(progress * Math.PI) * (0.6 + vol * 0.4);
      if (alpha < 0) alpha = 0;

      // 층마다 도형 개수와 잎사귀 너비 다르게 설정
      let petalsCount = 8 + (i % 3) * 4; // 8, 12, 16
      let petalWidth = radius * 0.25;
      let isLotus = i % 2 === 0;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      
      // 층별로 서로 반대 방향으로 회전
      let rotation = this.time * (i % 2 === 0 ? 0.2 : -0.2) + (i * Math.PI / 4);
      this.ctx.rotate(rotation);

      // 색상 순환
      let color = i % 3 === 0 ? palette.c1 : (i % 3 === 1 ? palette.c2 : palette.c3);

      for (let p = 0; p < petalsCount; p++) {
        this.ctx.save();
        this.ctx.rotate((p / petalsCount) * Math.PI * 2);
        
        // 꽃잎 드로잉 (거미줄이 아닌 꽉 찬 수채화 느낌)
        if (isLotus) {
          this.drawLotusPetal(this.ctx, radius, petalWidth);
        } else {
          this.drawTeardrop(this.ctx, radius, petalWidth * 0.8);
        }

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha * 0.4; // 수채화처럼 투명도 겹침
        this.ctx.fill();

        this.ctx.strokeStyle = palette.glow;
        this.ctx.lineWidth = 1.5 + bass * 3;
        this.ctx.globalAlpha = alpha * 0.8;
        this.ctx.stroke();
        
        this.ctx.restore();
      }
      this.ctx.restore();
    }

    // 3. 코어 발광 효과
    const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60 + bass * 80);
    coreGrad.addColorStop(0, palette.glow);
    coreGrad.addColorStop(0.4, palette.c1);
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = coreGrad;
    this.ctx.globalAlpha = 0.8 + bass * 0.2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 100 + bass * 60, 0, Math.PI * 2);
    this.ctx.fill();

    // 4. 최상단 SRT 캘리그래피 자막 렌더링
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, W * 0.065));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05));
      const selectedFont = window.cosmicEngineSettings?.fontFamily || "'Noto Sans KR', sans-serif";

      this.ctx.font = `bold ${fontSize}px ${selectedFont}, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 18;
        this.ctx.fillStyle = "#faf6ed";
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Floral Layers: ${this.mandalaLayers}`,
      isCovering: true,
      activeFunction: `Mandala[${colorStyle}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}