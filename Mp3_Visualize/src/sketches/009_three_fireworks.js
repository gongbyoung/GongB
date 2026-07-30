/**
 * src/sketches/009_three_fireworks.js
 * - [수리 완결판] 드럼 타격 연동 불꽃 폭발 복원
 */
export default class ThreeFireworksSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.particles = [];
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

  spawnFirework(cx, cy, count, hue, speedMult) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 8 + 3) * speedMult;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: Math.random() * 0.02 + 0.015,
        color: `hsl(${hue + Math.random() * 50}, 100%, 65%)`
      });
    }
  }

  update(audioData) {
    if (!this.ctx) return;
    this.time += 0.016;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || 0) * gainVal;
    const other  = (targetAudio.otherVol  || 0) * gainVal;

    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.fillStyle = 'rgba(3, 5, 12, 0.25)';
    this.ctx.fillRect(0, 0, w, h);

    // 🥁 드럼 타격 시 불꽃 자동 발사 (기본 지속 발사 임계값 완화)
    if (drums > 0.03 || Math.random() < 0.08) {
      const cx = Math.random() * (w * 0.8) + w * 0.1;
      const cy = Math.random() * (h * 0.5) + h * 0.15;
      const hue = (this.time * 80 + other * 120) % 360;
      this.spawnFirework(cx, cy, Math.floor(20 + drums * 70), hue, 1.0 + bass * 0.8);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // 중력
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8 + vocals * 12;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2.5 + bass * 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Sparks: ${this.particles.length}`,
      isCovering: true,
      activeFunction: "ThreeFireworks[Render_Fixed]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
