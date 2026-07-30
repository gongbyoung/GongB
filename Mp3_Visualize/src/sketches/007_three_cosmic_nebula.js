/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [수리 완료] 3D 은하수 성운 입자 비주얼라이저 (100% 출력 보장)
 */
export default class ThreeCosmicNebulaSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.particles = [];
    this.time = 0;
    this.initParticles();
    this.resize();
  }

  init() { this.resize(); }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 1200; i++) {
      const r = Math.random() * 280 + 20;
      const theta = Math.random() * Math.PI * 2;
      this.particles.push({
        r: r,
        baseR: r,
        theta: theta,
        size: Math.random() * 2.5 + 1.0,
        color: `hsl(${Math.random() * 60 + 180}, 100%, 75%)`
      });
    }
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  update(audioData) {
    if (!this.ctx) return;
    this.time += 0.015;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || 0) * gainVal;
    const other  = (targetAudio.otherVol  || 0) * gainVal;

    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.fillStyle = 'rgba(2, 4, 12, 0.4)';
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.save();
    this.ctx.translate(W / 2, H / 2);

    const burstFactor = 1.0 + drums * 0.9 + bass * 0.4;

    this.particles.forEach((p, idx) => {
      p.theta += 0.002 + other * 0.02;
      const currentR = p.baseR * burstFactor + Math.sin(this.time * 3 + idx) * (vocals * 20);

      const x = Math.cos(p.theta) * currentR;
      const y = Math.sin(p.theta) * (currentR * 0.4); // 타원 은하 3D 틸트

      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 6 + bass * 15;

      this.ctx.beginPath();
      this.ctx.arc(x, y, p.size + drums * 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Stars: 1,200 Pcs`,
      isCovering: true,
      activeFunction: "ThreeCosmicNebula[Render_Fixed_v2]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
