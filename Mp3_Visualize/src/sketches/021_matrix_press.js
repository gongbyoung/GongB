/**
 * src/sketches/021_matrix_press.js
 * - [수리 완료] 32채널 악기별 반응형 런치패드
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

    const targetAudio = (audioData && audioData.vol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || targetAudio.mid || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || targetAudio.bass || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || targetAudio.bass || 0) * gainVal;
    const other  = (targetAudio.otherVol  || targetAudio.treble || 0) * gainVal;

    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    this.ctx.fillStyle = '#02040a';
    this.ctx.fillRect(0, 0, renderW, renderH);

    const cols = 8;
    const rows = 4;
    const padding = 12;
    const padW = (renderW - padding * (cols + 1)) / cols;
    const padH = (renderH - padding * (rows + 1)) / rows;

    let padIndex = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        padIndex++;
        const x = padding + c * (padW + padding);
        const y = padding + r * (padH + padding);

        let intensity = 0;
        if (r === 3) intensity = bass * 2.2;
        else if (r === 2) intensity = drums * 2.2;
        else if (r === 1) intensity = vocals * 2.2;
        else intensity = other * 2.2;

        const activeAlpha = Math.min(1.0, intensity);

        this.ctx.save();
        this.ctx.translate(x, y);

        const hue = padIndex * 11 + this.time * 30;
        if (activeAlpha > 0.05) {
          this.ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
          this.ctx.shadowBlur = activeAlpha * 35;
        }

        this.ctx.strokeStyle = `hsl(${hue}, 100%, ${35 + activeAlpha * 55}%)`;
        this.ctx.lineWidth = 2 + activeAlpha * 6;
        this.ctx.strokeRect(0, 0, padW, padH);

        this.ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.1 + activeAlpha * 0.8})`;
        this.ctx.fillRect(0, 0, padW, padH);

        this.ctx.restore();
      }
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `32 Channel Pads`,
      isCovering: true,
      activeFunction: "MatrixPress[Active]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}