/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 악기 연주 무대 & 멀티 스트로크 붓글씨 캘리그래피 Ver 30.0]
 * - ✒️ 캔버스 다중 패스 스트로크(Multi-Pass Stroke) 기법을 통한 붓글씨 효과 극대화
 * - 🔒 028번 스케치 완벽 고정 및 16:9 / 9:16 / Full 레터박스 뷰포트 대응
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
    this.version = "028호 붓글씨 캘리그래피 Ver 30.0";
    
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
    this.selectedRatio = 'full';

    setTimeout(() => {
      const allButtons = document.querySelectorAll('button, [data-ratio]');
      allButtons.forEach(btn => {
        const text = (btn.getAttribute('data-ratio') || btn.innerText || '').trim().toLowerCase();
        if (text.includes('16:9') || text.includes('9:16') || text.includes('full')) {
          btn.addEventListener('click', () => {
            const ratioVal = text.includes('16:9') ? '16:9' : text.includes('9:16') ? '9:16' : 'full';
            this.selectedRatio = ratioVal;
            window.cosmicEngineSettings = window.cosmicEngineSettings || {};
            window.cosmicEngineSettings.exportRatio = ratioVal;
          });
        }
      });
    }, 400);
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
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    const exportRatio = (this.selectedRatio || globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    const drumsVol  = (targetAudio.drumsVol  ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? 0) * gainVal;
    const vocalsVol = (targetAudio.vocalsVol ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? 0) * gainVal;

    this.time += 0.016;

    const W = this.canvas.width;
    const H = this.canvas.height;

    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    let targetBg = this.bg169;

    if (exportRatio.includes('16:9')) {
      renderW = W;
      renderH = W * (9 / 16);
      if (renderH > H) { renderH = H; renderW = H * (16 / 9); }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
      targetBg = this.bg169;
    } else if (exportRatio.includes('9:16')) {
      renderH = H;
      renderW = H * (9 / 16);
      if (renderW > W) { renderW = W; renderH = W * (16 / 9); }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
      targetBg = this.bg916;
    } else {
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    this.ctx.save();

    this.ctx.fillStyle = "#0c0d10";
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    if (targetBg && targetBg.complete && targetBg.naturalWidth > 0) {
      this.ctx.drawImage(targetBg, renderX, renderY, renderW, renderH);
    } else {
      this.ctx.fillStyle = "#222327";
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;

    // ---------------------------------------------------------------------
    // 🎸 중앙 메탈 현 진동 연출 (Bass 연동)
    // ---------------------------------------------------------------------
    const stringCount = 5;
    const stringSpread = renderW * 0.08 * gaugeVal;

    for (let i = 0; i < stringCount; i++) {
      const norm = (i / (stringCount - 1) - 0.5);
      const baseX = centerX + norm * stringSpread;

      const energy = (i % 2 === 0 ? bassVol : otherVol);
      this.stringVibration[i] = this.stringVibration[i] * 0.75 + (energy * 18.0) * 0.25;

      this.ctx.strokeStyle = `rgba(255, 235, 210, ${0.7 + energy * 0.3})`;
      this.ctx.lineWidth = (2.2 + i * 0.4) * scaleFactor;
      this.ctx.beginPath();

      const segments = 40;
      for (let s = 0; s <= segments; s++) {
        const ratio = s / segments;
        const y = renderY + ratio * renderH;
        const sineWave = Math.sin(ratio * Math.PI * 6 + this.time * 14 + i) * this.stringVibration[i] * Math.sin(ratio * Math.PI);
        const x = baseX + sineWave;

        if (s === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🥁 드럼 타격 연주 리액션
    // ---------------------------------------------------------------------
    if (drumsVol > 0.05) {
      const drumX = renderX + renderW * 0.22;
      const drumY = renderY + renderH * 0.45;

      this.ctx.strokeStyle = `rgba(255, 60, 60, ${drumsVol * 0.9})`;
      this.ctx.lineWidth = 3.5 * scaleFactor;
      this.ctx.beginPath();
      this.ctx.arc(drumX, drumY, drumsVol * 55 * scaleFactor, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 🎹 피아노 연주 리액션
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.05 || otherVol > 0.05) {
      const pianoPulse = Math.max(vocalsVol, otherVol);
      const pianoX = renderX + renderW * 0.78;
      const pianoY = renderY + renderH * 0.38;

      this.ctx.fillStyle = `rgba(255, 215, 0, ${pianoPulse * 0.30})`;
      this.ctx.beginPath();
      this.ctx.arc(pianoX, pianoY, pianoPulse * 75 * scaleFactor, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ---------------------------------------------------------------------
    // ✒️ [핵심]: 다중 패스 스트로크 기법의 붓글씨(캘리그래피) 자막 렌더링
    // -----------------------------------Info----------------------------------
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.save();
      
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.07)) * scaleFactor;
      // 악기 비트에 맞춰 글자가 생동감 있게 미세하게 떨리거나 커지는 붓글씨 바운스 효과
      const beatPulse = 1.0 + (drumsVol * 0.06) + (vocalsVol * 0.04);
      const fontSize = baseFontSize * beatPulse;

      // 붓글씨 느낌을 극대화하는 폰트 패밀리 지정
      this.ctx.font = `bold ${fontSize}px "MapoFlowerIsland", "Nanum Pen Script", "Gowun Dodum", "Apple SD Gothic Neo", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const subX = centerX;
      const subY = renderY + renderH * 0.22;

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.3;

      lines.forEach((line, idx) => {
        const lineY = subY + (idx - (lines.length - 1) / 2) * lineHeight;

        // 💡 붓글씨 특유의 두꺼운 먹물 번짐과 외곽선 질감을 내기 위한 다중 오프셋 스트로크 (Multi-Pass Stroke)
        const offsets = [
          {-2, -2}, {2, -2}, {-2, 2}, {2, 2},
          {-3, 0}, {3, 0}, {0, -3}, {0, 3},
          {-1, -1}, {1, -1}, {-1, 1}, {1, 1}
        ];

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        offsets.forEach(off => {
          this.ctx.fillText(line, subX + off[0] * (scaleFactor * 0.8), lineY + off[1] * (scaleFactor * 0.8));
        });

        // 은은한 먹물 퍼짐 그림자
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 15;
        this.ctx.shadowOffsetX = 4;
        this.ctx.shadowOffsetY = 4;

        // 메인 붓글씨 텍스트 본체 (고풍스러운 한지 미색 톤)
        this.ctx.fillStyle = "#faf6ed";
        this.ctx.fillText(line, subX, lineY);

        this.ctx.shadowBlur = 0; // 그림자 초기화
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Brush Calligraphy Stage (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `BrushCalligraphy[${exportRatio.toUpperCase()}]`
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
