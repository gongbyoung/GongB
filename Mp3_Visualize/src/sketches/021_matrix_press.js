/**
 * src/sketches/021_matrix_press.js
 * - [4-Stem 전용] 32채널 이퀄라이저 패드 관제탑
 */
export default class MatrixPressSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.time = 0;
    this.resize();
  }

  init() { this.resize(); }

  resize(w, h) {
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  update(audioData) {
    if (!this.ctx) return;
    this.time += 0.02;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;
    const glowVal = globalSettings.glowIntensity ?? 0.85;

    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    this.ctx.fillStyle = '#02040a';
    this.ctx.fillRect(0, 0, renderW, renderH);

    const cols = 8;
    const rows = 4; // 8 x 4 = 32채널
    const padding = 12;
    const padW = (renderW - padding * (cols + 1)) / cols;
    const padH = (renderH - padding * (rows + 1)) / rows;

    let padIndex = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        padIndex++;
        const x = padding + c * (padW + padding);
        const y = padding + r * (padH + padding);

        // 악기별 채널 분담 연산
        let intensity = 0;
        if (r === 3) intensity = bass * 1.5;         // 맨 아래행: 베이스
        else if (r === 2) intensity = drums * 1.5;    // 3번째 행: 드럼
        else if (r === 1) intensity = vocals * 1.5;   // 2번째 행: 보컬
        else intensity = other * 1.5;                 // 맨 위행: 기타/반주

        const wave = Math.sin(this.time * 5 + padIndex * 0.3) * 0.2;
        const activeAlpha = Math.min(1.0, intensity + wave);

        this.ctx.save();
        this.ctx.translate(x, y);

        // 베이스/드럼 반응 글로우
        if (activeAlpha > 0.15) {
          this.ctx.shadowColor = `hsl(${padIndex * 11 + this.time * 40}, 100%, 60%)`;
          this.ctx.shadowBlur = activeAlpha * 25 * glowVal;
        }

        // 패드 테두리
        this.ctx.strokeStyle = `hsl(${padIndex * 11 + this.time * 40}, 100%, ${50 + activeAlpha * 40}%)`;
        this.ctx.lineWidth = 2 + activeAlpha * 4;
        this.ctx.strokeRect(0, 0, padW, padH);

        // 패드 내부 채우기
        this.ctx.fillStyle = `hsla(${padIndex * 11 + this.time * 40}, 100%, 50%, ${activeAlpha * 0.4})`;
        this.ctx.fillRect(0, 0, padW, padH);

        this.ctx.restore();
      }
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `32 Channel Matrix Pads`,
      isCovering: true,
      activeFunction: "MatrixPress[4Stem_Active]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
