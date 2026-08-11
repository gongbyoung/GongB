/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 이미지 악기 무대 & 오디오 반응형 실시간 엔진 Ver 21.0]
 * - 🖼️ 16:9 및 9:16 Export 비율에 맞춰 업로드된 두 장의 배경 이미지 자동 맵핑 및 렌더링
 * - 🎸 중앙 현(Strings), 🥁 좌측 드럼(Drums), 🎹 우측 피아노/스피커(Other/Bass/Vocals) 실시간 주파수 진동 매칭
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
    this.version = "028호 이미지 악기 무대 & 오디오 반응형 Ver 21.0";
    
    // 두 장의 배경 이미지 객체 로드
    this.bg169 = new Image();
    this.bg169.src = './z-image-turbo_01598_.jpg'; // 16:9 가로형 이미지

    this.bg916 = new Image();
    this.bg916.src = './Krea2_turbo_00788_.jpg'; // 9:16 세로형 이미지

    this.stringVibration = [0, 0, 0, 0];
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
    // 🖼️ 1. 비율별 배경 이미지(Wallpaper) 렌더링 (16:9 또는 9:16)
    // ---------------------------------------------------------------------
    let targetBg = this.bg169;
    if (exportRatio === '9:16') {
      targetBg = this.bg916;
    } else if (exportRatio === '16:9') {
      targetBg = this.bg169;
    } else {
      // 'full' 또는 자동일 때 화면 비율에 따라 선택
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    if (targetBg && targetBg.complete && targetBg.naturalWidth > 0) {
      // 비율을 유지하며 화면을 꽉 채우는 Cover 방식 드로잉
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
      // 이미지가 로딩되는 동안의 단색 배경
      this.ctx.fillStyle = "#2c2d30";
      this.ctx.fillRect(0, 0, W, H);
    }

    // 어두운 오버레이 레이어 (오디오 반응 이펙트의 가인성을 높이기 위함)
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    this.ctx.fillRect(0, 0, W, H);

    // ---------------------------------------------------------------------
    // 🎸 2. 중앙 현(Strings) 오디오 진동 반응 연출 (Bass & Other 연동)
    // ---------------------------------------------------------------------
    const centerX = W / 2;
    const stringCount = 4;
    const stringSpread = W * 0.12 * gaugeVal;

    for (let i = 0; i < stringCount; i++) {
      const norm = (i / (stringCount - 1) - 0.5); // -0.5 ~ 0.5
      const baseX = centerX + norm * stringSpread;

      const energy = (i % 2 === 0 ? bassVol : otherVol);
      this.stringVibration[i] = this.stringVibration[i] * 0.8 + (energy * 18.0) * 0.2;

      this.ctx.strokeStyle = `rgba(255, 220, 180, ${0.7 + energy * 0.3})`;
      this.ctx.lineWidth = (2.5 + i * 0.5) * scaleFactor;
      this.ctx.beginPath();

      const segments = 30;
      for (let s = 0; s <= segments; s++) {
        const ratio = s / segments;
        const y = ratio * H;
        const sineWave = Math.sin(ratio * Math.PI * 4 + this.time * 10 + i) * this.stringVibration[i] * Math.sin(ratio * Math.PI);
        const x = baseX + sineWave;

        if (s === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🥁 3. 좌측 드럼 킷 및 스피커 박동 연출 (Drums 연동)
    // ---------------------------------------------------------------------
    if (drumsVol > 0.05) {
      const pulseRadius = drumsVol * 45 * scaleFactor;
      this.ctx.strokeStyle = `rgba(255, 80, 80, ${drumsVol * 0.8})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(W * 0.22, H * 0.45, pulseRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🎹 4. 우측 피아노 & 스피커 타격광 연출 (Vocals & Other 연동)
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.05 || otherVol > 0.05) {
      const pianoPulse = Math.max(vocalsVol, otherVol);
      this.ctx.fillStyle = `rgba(255, 215, 0, ${pianoPulse * 0.25})`;
      this.ctx.beginPath();
      this.ctx.arc(W * 0.78, H * 0.35, pianoPulse * 60 * scaleFactor, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Image Instruments Stage (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `ImageStage[${exportRatio.toUpperCase()}]`
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
