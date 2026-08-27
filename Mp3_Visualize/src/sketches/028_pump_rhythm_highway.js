/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [붓글씨 자막 전용 클린 스케치 - Syntax Fix]
 * - SRT 자막을 붓글씨(먹물 번짐) 스타일로 화면 중앙에 렌더링
 */

export default class CalligraphySubtitleSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "붓글씨 자막 전용 클린 스케치 (Fixed)";
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

    // 1. 고요하고 감성적인 어두운 한지/먹색 배경
    const bgGrad = this.ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#121215");
    bgGrad.addColorStop(1, "#070709");
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, W, H);

    // 2. 음악 볼륨에 따라 배경 중앙에서 은은하게 퍼지는 빛 효과
    const vol = audioData && audioData.vol ? audioData.vol : 0;
    const glowRadius = Math.min(W, H) * 0.35 + (vol * 80);
    
    const radialGrad = this.ctx.createRadialGradient(W / 2, H / 2, 5, W / 2, H / 2, glowRadius);
    radialGrad.addColorStop(0, `rgba(255, 215, 0, ${0.06 + vol * 0.12})`);
    radialGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = radialGrad;
    this.ctx.fillRect(0, 0, W, H);

    // 3. SRT 자막 텍스트 가져오기
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "상단에서 SRT 자막 파일을 로딩해주세요.";

    // 4. 붓글씨(캘리그래피) 스타일 텍스트 렌더링
    if (subtitleText) {
      const baseFontSize = Math.max(32, Math.min(64, W * 0.07));
      const pulse = 1.0 + (vol * 0.05);
      const fontSize = baseFontSize * pulse;

      this.ctx.font = `bold ${fontSize}px "MapoFlowerIsland", "Nanum Pen Script", "Gowun Dodum", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const centerX = W / 2;
      const centerY = H / 2;

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        // 💡 [수정 완료]: 문법 에러가 났던 대괄호 배열 형태 수정 완료
        const offsets = [
          [-2, -2], [2, -2], [-2, 2], [2, 2],
          [-3, 0], [3, 0], [0, -3], [0, 3],
          [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        offsets.forEach(off => {
          this.ctx.fillText(line, centerX + off[0], lineY + off[1]);
        });

        // 묵직한 그림자
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 18;
        this.ctx.shadowOffsetX = 4;
        this.ctx.shadowOffsetY = 4;

        // 본문 텍스트 (한지 미색)
        this.ctx.fillStyle = "#faf6ed";
        this.ctx.fillText(line, centerX, lineY);

        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: 'Clean Calligraphy Mode',
      isCovering: true,
      activeFunction: 'CalligraphyOnly'
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
