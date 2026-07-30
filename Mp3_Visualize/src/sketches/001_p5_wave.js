/**
 * src/sketches/001_p5_wave.js
 * - [4-Stem 개혁판] 보컬/드럼/베이스/기타 각자 역할 분담 오디오 웨이브
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
    const glowVal = globalSettings.glowIntensity ?? 0.85;

    // 💡 4-Stem 표준 수치 수신
    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    this.ctx.fillStyle = 'rgba(6, 8, 16, 0.25)';
    this.ctx.fillRect(0, 0, w, h);

    // 🎹 기타/반주: 회전 속도 제어
    this.angle += 0.01 + other * 0.05;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(this.angle);

    // 🎸 베이스: 네온 Glow 발광
    this.ctx.shadowColor = globalSettings.customColors?.gas1 || '#00ffcc';
    this.ctx.shadowBlur = 10 + bass * 40 * glowVal;

    this.ctx.beginPath();
    const points = 120;
    // 🥁 드럼: 기본 반경 펄스
    const baseRadius = Math.min(w, h) * 0.22 + drums * 40;

    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      // 🎤 보컬: 진동 굴곡 파동
      const wave = Math.sin(a * 8 + this.angle * 5) * (vocals * 60) + Math.cos(a * 16) * (drums * 30);
      const r = baseRadius + wave;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;

      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();

    this.ctx.strokeStyle = globalSettings.customColors?.star || '#ffffff';
    // 🎸 베이스: 선 두께 확장
    this.ctx.lineWidth = 2 + bass * 8;
    this.ctx.stroke();

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `4-Stem Wave [Drums:${drums.toFixed(2)}]`,
      isCovering: true,
      activeFunction: "P5Wave[4Stem_Mapped]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
