/**
 * src/sketches/005_three_floor_eq.js
 * - [4-Stem 전용] 네온 매트릭스 그리드 이퀄라이저
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
    const glowVal = globalSettings.glowIntensity ?? 0.85;

    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

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

        // 🎹 기타: 위치별 파동 계산
        const distFromCenter = Math.sqrt(Math.pow(c - cols / 2, 2) + Math.pow(r - rows / 2, 2));
        const wave = Math.sin(this.time * 4 - distFromCenter * 0.8) * other * 20;

        // 🥁 드럼 & 🎤 보컬: 크기 변형
        let sizeBonus = drums * 25;
        if (c === 3 || c === 4) sizeBonus += vocals * 35; // 중앙 열 보컬 반응

        const boxW = Math.max(10, cellW * 0.7 + sizeBonus);
        const boxH = Math.max(10, cellH * 0.7 + sizeBonus + wave);

        this.ctx.save();
        this.ctx.translate(x, y);

        // 🎸 베이스: 네온 빛 폭발
        this.ctx.shadowColor = globalSettings.customColors?.gas2 || '#00f0ff';
        this.ctx.shadowBlur = 4 + bass * 35 * glowVal;

        this.ctx.strokeStyle = `hsla(${(c * 20 + r * 15 + this.time * 50) % 360}, 100%, 65%, 0.9)`;
        this.ctx.lineWidth = 2 + bass * 4;
        this.ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

        this.ctx.restore();
      }
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Grid: ${cols}x${rows}`,
      isCovering: true,
      activeFunction: "ThreeFloorEq[4Stem_Active]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
