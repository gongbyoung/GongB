/**
 * src/sketches/001_p5_wave.js
 * - [수리 완결판] 보컬/드럼/베이스 연동 다이내믹 원형 웨이브
 */
export default class P5WaveSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.angle = 0;
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
    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || 0) * gainVal;
    const other  = (targetAudio.otherVol  || 0) * gainVal;

    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.fillStyle = 'rgba(6, 8, 16, 0.3)';
    this.ctx.fillRect(0, 0, w, h);

    this.angle += 0.01 + other * 0.04;

    this.ctx.save();
    this.ctx.translate(w / 2, h / 2);
    this.ctx.rotate(this.angle);

    const strokeColor = globalSettings.customColors?.gas1 || '#ff0055';
    this.ctx.shadowColor = strokeColor;
    this.ctx.shadowBlur = 10 + bass * 45;

    this.ctx.beginPath();
    const points = 180;
    const baseRadius = Math.min(w, h) * 0.22 + (drums * 60);

    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      // 🎤 보컬 & 드럼 진동 가중치 극대화
      const wave = Math.sin(a * 12 + this.angle * 4) * (vocals * 90 + 10) + Math.cos(a * 24) * (drums * 50);
      const r = baseRadius + wave;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;

      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();

    this.ctx.strokeStyle = globalSettings.customColors?.star || '#00ffcc';
    this.ctx.lineWidth = 3 + bass * 10;
    this.ctx.stroke();

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Wave Active [Vocal:${vocals.toFixed(2)}]`,
      isCovering: true,
      activeFunction: "P5Wave[Fixed_Active]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
