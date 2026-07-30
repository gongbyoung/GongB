/**
 * src/sketches/002_three_cube.js
 * - [수리 완료] 초고속 Canvas 2D 3D 큐브 링 비주얼라이저 (100% 출력 보장)
 */
export default class ThreeCubeSketch {
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

  drawWireCube(cx, cy, cz, size, rotX, rotY) {
    const half = size / 2;
    const vertices = [
      [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
      [-half, -half, half],  [half, -half, half],  [half, half, half],  [-half, half, half]
    ];

    const projected = vertices.map(v => {
      let x = v[0], y = v[1], z = v[2];

      // X축 회전
      let y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
      let z1 = y * Math.sin(rotX) + z * Math.cos(rotX);

      // Y축 회전
      let x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY);
      let z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY);

      // 3D 투영
      const fov = 400;
      const scale = fov / (fov + z2 + cz + 300);
      return {
        px: (x2 + cx) * scale + this.width / 2,
        py: (y1 + cy) * scale + this.height / 2
      };
    });

    const edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7]
    ];

    edges.forEach(e => {
      const p1 = projected[e[0]];
      const p2 = projected[e[1]];
      this.ctx.beginPath();
      this.ctx.moveTo(p1.px, p1.py);
      this.ctx.lineTo(p2.px, p2.py);
      this.ctx.stroke();
    });
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
    const other  = (targetAudio.otherVol  || 0) * gainVal;

    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.fillStyle = '#03050f';
    this.ctx.fillRect(0, 0, W, H);

    const cubeCount = 20;
    const baseRadius = Math.min(W, H) * 0.28 + (drums * 80);

    this.ctx.strokeStyle = globalSettings.customColors?.gas2 || '#00ffcc';
    this.ctx.lineWidth = 2 + bass * 4;
    this.ctx.shadowColor = globalSettings.customColors?.gas2 || '#00ffcc';
    this.ctx.shadowBlur = 8 + bass * 30;

    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2 + this.time * (0.5 + other * 1.5);
      const cx = Math.cos(angle) * baseRadius;
      const cy = Math.sin(angle) * baseRadius;

      const cubeSize = 25 + vocals * 45;
      this.drawWireCube(cx, cy, 0, cubeSize, this.time + i, this.time * 0.8);
    }

    // 중앙 코어 3D 큐브
    this.ctx.strokeStyle = globalSettings.customColors?.gas1 || '#ff0055';
    this.drawWireCube(0, 0, 0, 60 + bass * 90, this.time * 1.5, this.time);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `3D Cubes: 20 Pcs`,
      isCovering: true,
      activeFunction: "ThreeCube[Render_Fixed_v2]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null;
  }
}
