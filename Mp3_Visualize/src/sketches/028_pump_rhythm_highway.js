/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 백드롭 오버레이 & 유저 선택 폰트 연동 캘리그래피 Ver 33.0]
 * - 🔀 좌측 패널의 폰트 선택 드롭다운 및 커스텀 TTF/OTF 폰트 실시간 반영
 */

export default class CalligraphyWithBackdropSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "028호 유저 폰트 연동 캘리그래피 Ver 33.0";
    
    this.backdropParticles = [];
    for (let i = 0; i < 70; i++) {
      this.backdropParticles.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        size: Math.random() * 3 + 1,
        speedY: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.2
      });
    }
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

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    this.time += 0.016;
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.save();

    // 🌌 1단계: 뒷배경 (Backdrop Layer) - 오디오 리액티브 비주얼
    const bgGrad = this.ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#0a0c16");
    bgGrad.addColorStop(0.5, "#141026");
    bgGrad.addColorStop(1, "#040407");
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, W, H);

    const vol = audioData && audioData.vol ? audioData.vol : 0;
    const bass = audioData && audioData.bass ? audioData.bass : 0;

    const glowRadius = Math.min(W, H) * 0.5 + (bass * 120);
    const radialGrad = this.ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, glowRadius);
    radialGrad.addColorStop(0, `rgba(0, 240, 255, ${0.12 + bass * 0.25})`);
    radialGrad.addColorStop(0.5, `rgba(138, 43, 225, ${0.08 + vol * 0.15})`);
    radialGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = radialGrad;
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.fillStyle = "#ffffff";
    this.backdropParticles.forEach(pt => {
      pt.y -= pt.speedY + (bass * 3.0);
      if (pt.y < 0) {
        pt.y = H + 10;
        pt.x = Math.random() * W;
      }
      this.ctx.globalAlpha = pt.alpha * (0.5 + vol * 0.5);
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size * (1 + bass * 1.5), 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    const rawWave = audioData && audioData.raw ? audioData.raw : null;
    if (rawWave && rawWave.length > 0) {
      this.ctx.strokeStyle = `rgba(0, 255, 204, ${0.35 + vol * 0.4})`;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      const sliceW = W / rawWave.length;
      let px = 0;
      for (let i = 0; i < rawWave.length; i++) {
        const v = rawWave[i] / 128.0;
        const py = (H / 2) + (v - 1) * (H * 0.35) * (1 + bass * 0.5);
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
        px += sliceW;
      }
      this.ctx.stroke();
    }

    // ✍️ 2단계: 최상단 (Foreground Layer) - SRT 자막 렌더링
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "상단에서 SRT 자막 파일을 로딩해주세요.";

    if (subtitleText) {
      const baseFontSize = Math.max(32, Math.min(64, W * 0.07));
      const pulse = 1.0 + (vol * 0.06);
      const fontSize = baseFontSize * pulse;

      // 💡 [핵심 연동]: 좌측 패널에서 선택한 폰트 패밀리를 실시간으로 가져와 적용
      const selectedFont = window.cosmicEngineSettings?.fontFamily || "'Noto Sans KR', sans-serif";
      this.ctx.font = `bold ${fontSize}px ${selectedFont}, sans-serif`;
      
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const centerX = W / 2;
      const centerY = H / 2;

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        const offsets = [
          [-2, -2], [2, -2], [-2, 2], [2, 2],
          [-3, 0], [3, 0], [0, -3], [0, 3],
          [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        offsets.forEach(off => {
          this.ctx.fillText(line, centerX + off[0], lineY + off[1]);
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 20;
        this.ctx.shadowOffsetX = 4;
        this.ctx.shadowOffsetY = 4;

        this.ctx.fillStyle = "#faf6ed";
        this.ctx.fillText(line, centerX, lineY);

        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: 'Font-Linked Calligraphy',
      isCovering: true,
      activeFunction: 'FontLinkedBackdrop'
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.backdropParticles = [];
  }
}
