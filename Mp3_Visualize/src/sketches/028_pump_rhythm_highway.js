/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 이미지 악기 무대 & 오디오 반응형 실시간 엔진 Ver 23.0 - Asset Path Fix]
 * - 🖼️ assets/ 폴더 및 .png 확장자 경로 정확히 연동 ('./assets/028_169_bg.png', './assets/028_916_BG.png')
 * - 🎸 중앙 메탈 현(Strings), 좌측 드럼(Drums), 우측 피아노/스피커 실시간 오디오 반응
 * - main.js 수정 ZERO (완전 독립형 스케치)
 */

export default class PumpRhythmHighwaySketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "028호 이미지 악기 무대 Ver 23.0 (Path Fixed)";
    
    // 💡 assets 폴더 안의 정확한 .png 파일명으로 경로 수정
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  hexToRgb(hex) {
    if (!hex) return "0, 240, 255";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = audioData || {};

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    // Export 비율 파악 ('16:9', '9:16', 'full')
    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    // 4-Stem 음압 수신
    const drumsVol  = (targetAudio.drumsVol  ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? 0) * gainVal;
    const vocalsVol = (targetAudio.vocalsVol ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? 0) * gainVal;

    this.time += 0.016;

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 캔버스 초기화
    this.ctx.save();
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(0, 0, W, H);

    // ---------------------------------------------------------------------
    // 🖼️ 1. assets 폴더 기반 배경 이미지 렌더링
    // ---------------------------------------------------------------------
    let targetBg = this.bg169;
    if (exportRatio === '9:16') {
      targetBg = this.bg916;
    } else if (exportRatio === '16:9') {
      targetBg = this.bg169;
    } else {
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    if (targetBg && targetBg.complete && targetBg.naturalWidth > 0) {
      const imgAspect = targetBg.naturalWidth / targetBg.naturalHeight;
      const canvasAspect = W / H;
      let drawW = W, drawH = H, drawX = 0, drawY = 0;

      if (canvasAspect > imgAspect) {
        drawH = W / imgAspect;
        drawY = (H - drawH) / 2;
      } else {
        drawW = H * imgAspect;
        drawX = (W - drawW) / 2;
      }
      this.ctx.drawImage(targetBg, drawX, drawY, drawW, drawH);
    } else {
      this.ctx.fillStyle = "#2c2d30";
      this.ctx.fillRect(0, 0, W, H);
    }

    // 은은한 오버레이 레이어
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    this.ctx.fillRect(0, 0, W, H);

    // ---------------------------------------------------------------------
    // 🎸 2. 중앙 메탈 현(Strings) 오디오 진동 반응 연출 (Bass & Other 연동)
    // ---------------------------------------------------------------------
    const centerX = W / 2;
    const stringCount = 5;
    const stringSpread = W * 0.08 * gaugeVal;

    for (let i = 0; i < stringCount; i++) {
      const norm = (i / (stringCount - 1) - 0.5);
      const baseX = centerX + norm * stringSpread;

      const energy = (i % 2 === 0 ? bassVol : otherVol);
      this.stringVibration[i] = this.stringVibration[i] * 0.8 + (energy * 15.0) * 0.2;

      this.ctx.strokeStyle = `rgba(255, 230, 200, ${0.6 + energy * 0.4})`;
      this.ctx.lineWidth = (2.0 + i * 0.4) * scaleFactor;
      this.ctx.beginPath();

      const segments = 35;
      for (let s = 0; s <= segments; s++) {
        const ratio = s / segments;
        const y = ratio * H;
        const sineWave = Math.sin(ratio * Math.PI * 6 + this.time * 12 + i) * this.stringVibration[i] * Math.sin(ratio * Math.PI);
        const x = baseX + sineWave;

        if (s === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🥁 3. 좌측 드럼 킷 타격 리액션 (Drums 연동)
    // ---------------------------------------------------------------------
    if (drumsVol > 0.06) {
      const pulseRadius = drumsVol * 50 * scaleFactor;
      this.ctx.strokeStyle = `rgba(255, 60, 60, ${drumsVol * 0.85})`;
      this.ctx.lineWidth = 3.5;
      this.ctx.beginPath();
      this.ctx.arc(W * 0.22, H * 0.42, pulseRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🎹 4. 우측 피아노 & 스피커 오디오 펄스 리액션 (Vocals & Other 연동)
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.06 || otherVol > 0.06) {
      const rightPulse = Math.max(vocalsVol, otherVol);
      this.ctx.fillStyle = `rgba(255, 215, 0, ${rightPulse * 0.22})`;
      this.ctx.beginPath();
      this.ctx.arc(W * 0.78, H * 0.38, rightPulse * 70 * scaleFactor, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Asset Path Fixed Stage (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `AssetStageFixed[${exportRatio.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
