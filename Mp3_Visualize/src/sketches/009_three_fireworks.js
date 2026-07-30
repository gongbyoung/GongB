/**
 * src/sketches/009_three_fireworks.js
 * - [수리 완료] 연속 로켓 발사 및 드럼 폭발 불꽃 시뮬레이션
 */
export default class ThreeFireworksSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.particles = [];
    this.rockets = [];
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
      const speed = (Math.random() * 9 + 3) * speedMult;
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

    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.fillStyle = 'rgba(3, 5, 12, 0.25)';
    this.ctx.fillRect(0, 0, W, H);

    // 주기적 자동 로켓 발사 + 드럼 비트 피크 발사
    if (drums > 0.05 || Math.random() < 0.05) {
      this.rockets.push({
        x: Math.random() * (W * 0.8) + W * 0.1,
        y: H,
        vy: -(Math.random() * 6 + 10),
        targetY: Math.random() * (H * 0.4) + H * 0.1,
        hue: (this.time * 90 + other * 100) % 360
      });
    }

    // 로켓 공중 상승
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += r.vy;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(r.x, r.y, 3, 10);

      if (r.y <= r.targetY) {
        this.spawnFirework(r.x, r.y, Math.floor(30 + drums * 60), r.hue, 1.0 + bass);
        this.rockets.splice(i, 1);
      }
    }

    // 불꽃 입자 물리
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // 중력
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8 + vocals * 10;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2.5 + bass * 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Sparks: ${this.particles.length}`,
      isCovering: true,
      activeFunction: "ThreeFireworks[Render_Fixed_v2]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
