/**
 * src/sketches/029_infinite_mandala.js
 * - [029호 무한 확장 만다라 & 5대 화풍 테마 시뮬레이터]
 * - 화면 중앙으로부터 겹겹이 회전하며 무한히 팽창하는 기하학적 장미창 만다라
 * - 바로크, 르네상스, 인상파, 야수파, 무채색 화풍별 색상 및 재질 질감 실시간 전환
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
    this.version = "029호 무한 확장 만다라 Ver 1.0";
    this.mandalaLayers = 8; // 만다라 겹 수
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

  // 화풍별 색상 팔레트 정의
  getPalette(style) {
    const s = (style || 'neon').toLowerCase();
    if (s.includes('baroque') || s === 'baroque') {
      return { bg: '#080402', primary: '#d4af37', secondary: '#8b0000', accent: '#ff4500', glow: '#ffd700' }; // 금박, 진홍, 바로크 골드
    } else if (s.includes('renaissance') || s === 'renaissance') {
      return { bg: '#0b131f', primary: '#1d4ed8', secondary: '#b45309', accent: '#eab308', glow: '#93c5fd' }; // 울트라마린, 테라코타
    } else if (s.includes('impressionism') || s === 'impressionism') {
      return { bg: '#1e1b2e', primary: '#c084fc', secondary: '#f472b6', accent: '#38bdf8', glow: '#fbcfe8' }; // 파스텔 라벤더, 핑크
    } else if (s.includes('fauvism') || s === 'fauvism') {
      return { bg: '#111827', primary: '#ef4444', secondary: '#10b981', accent: '#f59e0b', glow: '#ec4899' }; // 야수파 원색 충돌
    } else if (s.includes('monochrome') || s === 'monochrome') {
      return { bg: '#09090b', primary: '#f4f4f5', secondary: '#71717a', accent: '#27272a', glow: '#ffffff' }; // 무채색 메탈릭
    } else {
      // 기본 Neon / Custom
      return { bg: '#050508', primary: '#00f0ff', secondary: '#ff007f', accent: '#7000ff', glow: '#00ffff' };
    }
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    const vol = audioData && audioData.vol ? audioData.vol : 0;
    const bass = audioData && audioData.bass ? audioData.bass : 0;
    const gainVal = settings.audioGain ?? 1.0;
    const gaugeVal = settings.gaugeValue ?? 0.5; // 무한 확산 속도 조절
    const seedVal = settings.seed ?? 42;
    const colorStyle = settings.colorStyle || 'neon';

    const palette = this.getPalette(colorStyle);

    this.time += 0.012 + (bass * 0.02 * gainVal);

    this.ctx.save();

    // 1. 배경 렌더링
    this.ctx.fillStyle = palette.bg;
    this.ctx.fillRect(0, 0, W, H);

    const centerX = W / 2;
    const centerY = H / 2;
    const maxRadius = Math.max(W, H) * 0.85;

    // 2. 무한 확장 만다라 레이어 드로잉 루프
    const petals = 12; // 대칭 개수
    const baseScale = (this.time * (0.4 + gaugeVal * 0.8)) % 2.0; // 0에서 2까지 무한 반복 팽창

    for (let i = 0; i < this.mandalaLayers; i++) {
      // 레이어별 확장 진행도 (0.0 ~ 1.0)
      let progress = ((baseScale + (i / this.mandalaLayers)) % 1.0);
      let currentR = progress * maxRadius * (0.8 + bass * 0.5);
      
      // 외곽으로 갈수록 투명해지며 페이드아웃
      let alpha = Math.sin(progress * Math.PI) * (0.4 + vol * 0.6);
      if (alpha < 0) alpha = 0;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      // 레이어별 교차 회전
      this.ctx.rotate(this.time * (i % 2 === 0 ? 0.15 : -0.15) * (i + 1));

      this.ctx.strokeStyle = i % 2 === 0 ? palette.primary : palette.secondary;
      this.ctx.lineWidth = Math.max(1, (3 - progress * 2) * (1 + bass));
      this.ctx.shadowColor = palette.glow;
      this.ctx.shadowBlur = 12 * alpha;

      // 만다라 꽃잎 / 기하학 패턴 그리기
      this.ctx.beginPath();
      for (let p = 0; p < petals; p++) {
        let angle = (p / petals) * Math.PI * 2;
        let pX = Math.cos(angle) * currentR;
        let pY = Math.sin(angle) * currentR;
        
        // 제어점을 이용한 화려한 곡선 장미창 패턴
        let cpR = currentR * 0.5;
        let cpAngle1 = angle + (Math.PI / petals);
        let cpAngle2 = angle - (Math.PI / petals);
        let cp1X = Math.cos(cpAngle1) * cpR;
        let cp1Y = Math.sin(cpAngle1) * cpR;

        if (p === 0) {
          this.ctx.moveTo(pX, pY);
        }
        this.ctx.quadraticCurveTo(cp1X, cp1Y, pX, pY);
      }
      this.ctx.closePath();
      this.ctx.globalAlpha = alpha;
      this.ctx.stroke();

      // 내부 채우기 (은은한 그라데이션 오라)
      if (i % 3 === 0) {
        this.ctx.fillStyle = palette.accent;
        this.ctx.globalAlpha = alpha * 0.15;
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // 3. 중앙 코어 에너지 폭발 광채
    const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 60 + bass * 80);
    coreGrad.addColorStop(0, palette.glow);
    coreGrad.addColorStop(0.5, palette.primary);
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = coreGrad;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 80 + bass * 50, 0, Math.PI * 2);
    this.ctx.fill();

    // 4. 최상단 SRT 캘리그래피 자막 렌더링 (이전 028호와 동일한 고정 자막 시스템 연동)
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      const baseFontSize = Math.max(32, Math.min(64, W * 0.07));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05));
      const selectedFont = window.cosmicEngineSettings?.fontFamily || "'Noto Sans KR', sans-serif";

      this.ctx.font = `bold ${fontSize}px ${selectedFont}, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        // 가독성을 위한 외곽선 및 먹물 번짐 효과
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
      particleCount: `Infinite Mandala (${colorStyle.toUpperCase()})`,
      isCovering: true,
      activeFunction: `MandalaZoom[${colorStyle}]`
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
