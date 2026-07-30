/**
 * src/sketches/005_three_floor_eq.js
 * - [수리 완료] 드럼/보컬 비트 연동 솟구치는 네온 그리드
 */
export default class ThreeFloorEqSketch {
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

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || 0) * gainVal;

    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    this.ctx.fillStyle = '#03050d';
    this.ctx.fillRect(0, 0, renderW, renderH);

    const cols = 8;
    const rows = 6;
    const cellW = renderW / (cols + 2);
    const cellH = renderH / (rows + 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = cellW * (c + 1.5);
        const y = cellH * (r + 1.5);

        // 🥁 드럼 및 보컬 비트 반응에 따른 스케일 수직 팽창
        const audioBounce = (drums * 50) + ((c === 3 || c === 4) ? vocals * 70 : 0);

        const boxW = Math.max(12, cellW * 0.65 + audioBounce * 0.4);
        const boxH = Math.max(12, cellH * 0.65 + audioBounce);

        this.ctx.save();
        this.ctx.translate(x, y);

        this.ctx.shadowColor = globalSettings.customColors?.gas2 || '#00f0ff';
        this.ctx.shadowBlur = 4 + bass * 40;

        const hue = (c * 25 + r * 20 + this.time * 40) % 360;
        this.ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${0.3 + bass * 0.7})`;
        this.ctx.lineWidth = 2 + bass * 5;
        this.ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

        this.ctx.restore();
      }
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Grid: ${cols}x${rows}`,
      isCovering: true,
      activeFunction: "ThreeFloorEq[Render_Fixed]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
