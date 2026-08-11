/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 독립형 비율 전환 & 악기 연주 시뮬레이터 Ver 25.0]
 * - 📐 Export 버튼(Full, 16:9, 9:16) 자체 감지 리스너 장착 (main.js 수정 ZERO)
 * - 🖼️ 16:9 및 9:16 비율 전환 시 레터박스 뷰포트 및 배경(.png) 이미지 즉시 실시간 전환
 * - 🎸 중앙 현 진동, 🥁 드럼스틱 타격 연주, 🎹 피아노 건반 터치 연주 모션
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
    this.version = "028호 독립형 비율 전환 연주기 Ver 25.0";
    
    // assets 폴더 내의 배경 이미지 .png 로드
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
    this.drumHitPhase = 0;
    this.selectedRatio = 'full'; // 기본값

    // 💡 [핵심]: main.js를 건드리지 않고 스케치 내부에서 Export 버튼 클릭 직접 감지
    setTimeout(() => {
      const allButtons = document.querySelectorAll('button');
      allButtons.forEach(btn => {
        const text = btn.innerText.trim().toLowerCase();
        if (text === '16:9' || text === '9:16' || text === 'full') {
          btn.addEventListener('click', () => {
            this.selectedRatio = text;
            window.cosmicEngineSettings = window.cosmicEngineSettings || {};
            window.cosmicEngineSettings.exportRatio = text;
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

    // Export 비율 파악 (스케치 내부 수동 제어값 또는 글로벌 설정 연동)
    const exportRatio = (this.selectedRatio || globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

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

    // ---------------------------------------------------------------------
    // 📐 비율별 뷰포트 레터박스(Viewport Letterbox) 연산
    // ---------------------------------------------------------------------
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    let targetBg = this.bg169;

    if (exportRatio === '16:9') {
      renderW = W;
      renderH = W * (9 / 16);
      if (renderH > H) { renderH = H; renderW = H * (16 / 9); }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
      targetBg = this.bg169;
    } else if (exportRatio === '9:16') {
      renderH = H;
      renderW = H * (9 / 16);
      if (renderW > W) { renderW = W; renderH = W * (16 / 9); }
      renderX = (W - renderW) / 2;
      renderY = (H - renderH) / 2;
      targetBg = this.bg916;
    } else {
      // Full 모드일 때 화면 비율에 따라 자동 선택
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    this.ctx.save();

    // 외부 레터박스 영역 (다크 처리)
    this.ctx.fillStyle = "#0c0d10";
    this.ctx.fillRect(0, 0, W, H);

    // 뷰포트 영역 클리핑
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // ---------------------------------------------------------------------
    // 🖼️ 배경 이미지 렌더링
    // ---------------------------------------------------------------------
    if (targetBg && targetBg.complete && targetBg.naturalWidth > 0) {
      this.ctx.drawImage(targetBg, renderX, renderY, renderW, renderH);
    } else {
      this.ctx.fillStyle = "#222327";
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    // 은은한 오버레이
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;

    // ---------------------------------------------------------------------
    // 🎸 중앙 메탈 현(Strings) 진동 연출 (Bass 연동)
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
    // 🥁 드럼 연주 시뮬레이션 (드럼스틱 타격 모션 & 패드 울림)
    // ---------------------------------------------------------------------
    if (drumsVol > 0.05) {
      this.drumHitPhase += drumsVol * 0.4;
      
      const drumX = renderX + renderW * 0.22;
      const drumY = renderY + renderH * 0.45;

      this.ctx.strokeStyle = `rgba(255, 60, 60, ${drumsVol * 0.9})`;
      this.ctx.lineWidth = 3.5 * scaleFactor;
      this.ctx.beginPath();
      this.ctx.arc(drumX, drumY, drumsVol * 55 * scaleFactor, 0, Math.PI * 2);
      this.ctx.stroke();

      const stickAngle = -Math.PI / 4 + Math.sin(this.drumHitPhase * 8) * 0.35 * drumsVol;
      this.ctx.save();
      this.ctx.translate(drumX - 30, drumY - 40);
      this.ctx.rotate(stickAngle);
      this.ctx.fillStyle = "#e0a96d";
      this.ctx.fillRect(0, -4, 80 * scaleFactor, 8 * scaleFactor);
      this.ctx.restore();
    }

    // ---------------------------------------------------------------------
    // 🎹 피아노 연주 시뮬레이션 (건반 터치 바운스)
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.05 || otherVol > 0.05) {
      const pianoPulse = Math.max(vocalsVol, otherVol);
      const pianoX = renderX + renderW * 0.78;
      const pianoY = renderY + renderH * 0.38;

      this.ctx.fillStyle = `rgba(255, 215, 0, ${pianoPulse * 0.28})`;
      this.ctx.beginPath();
      this.ctx.arc(pianoX, pianoY, pianoPulse * 75 * scaleFactor, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = `rgba(255, 255, 255, ${pianoPulse * 0.8})`;
      const keyWidth = 8 * scaleFactor;
      for (let k = 0; k < 6; k++) {
        const kx = pianoX - 30 + k * 12;
        const ky = pianoY + 15 + Math.sin(this.time * 15 + k) * pianoPulse * 12;
        this.ctx.fillRect(kx, ky, keyWidth, 18 * scaleFactor);
      }
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Instrument Player (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `InstrumentPlayer[${exportRatio.toUpperCase()}]`
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
