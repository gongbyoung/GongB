/**
 * src/sketches/009_three_fireworks.js
 * - [4-Stem 전용] 드럼 타격 연동 불꽃 폭발 시뮬레이션
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
      const speed = (Math.random() * 6 + 2) * speedMult;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: Math.random() * 0.02 + 0.01,
        color: `hsl(${hue + Math.random() * 40}, 100%, 65%)`
      });
    }
  }

  update(audioData) {
    if (!this.ctx) return;
    this.time += 0.016;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // 어두운 잔상 배경
    this.ctx.fillStyle = 'rgba(3, 5, 12, 0.25)';
    this.ctx.fillRect(0, 0, w, h);

    // 🥁 드럼: 비트 피크 시 불꽃 폭발 생성
    if (drums > 0.08 && Math.random() < 0.4) {
      const cx = Math.random() * (w * 0.7) + w * 0.15;
      const cy = Math.random() * (h * 0.5) + h * 0.2;
      const hue = (this.time * 60 + other * 100) % 360;
      this.spawnFirework(cx, cy, Math.floor(20 + drums * 60), hue, 1.0 + bass);
    }

    // 불꽃 파티클 물리 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // 중력
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 6 + vocals * 10;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2 + bass * 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Sparks: ${this.particles.length}`,
      isCovering: true,
      activeFunction: "ThreeFireworks[4Stem_Active]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
