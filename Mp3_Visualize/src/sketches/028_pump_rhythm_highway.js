/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 실제 악기 연주 시뮬레이터 & 비율 전환 가드 Ver 24.0]
 * - 📐 16:9 / 9:16 / Full 비율 전환 시 뷰포트 레터박스 및 배경 이미지(.png) 완벽 실시간 전환
 * - 🥁 드럼스틱 타격 연주 애니메이션 (Drums 비트 연동)
 * - 🎹 피아노 건반 터치 연주 모션 (Other/Vocals 연동)
 * - 🎸 중앙 메탈 현 진동 (Bass 연동)
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
    this.version = "028호 악기 연주 시뮬레이터 Ver 24.0";
    
    // assets 폴더 내의 정확한 .png 배경 이미지 로드
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
    this.drumHitPhase = 0;
    this.pianoKeyFrame = 0;
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

    // 💡 Export 비율 파악 ('16:9', '9:16', 'full')
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

    // ---------------------------------------------------------------------
    // 📐 [핵심]: 16:9 / 9:16 비율별 뷰포트 레터박스(Viewport Letterbox) 연산
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
      // Full 모드일 때 화면 가로세로 비에 따라 자동 선택
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    this.ctx.save();

    // 외부 레터박스 영역 (검은색 처리)
    this.ctx.fillStyle = "#0a0a0c";
    this.ctx.fillRect(0, 0, W, H);

    // 뷰포트 영역 클리핑 (이 안쪽으로만 렌더링됨)
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // ---------------------------------------------------------------------
    // 🖼️ 2. 선택된 비율에 맞는 배경 이미지 렌더링
    // ---------------------------------------------------------------------
    if (targetBg && targetBg.complete && targetBg.naturalWidth > 0) {
      this.ctx.drawImage(targetBg, renderX, renderY, renderW, renderH);
    } else {
      this.ctx.fillStyle = "#222327";
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    // 은은한 오버레이
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;

    // ---------------------------------------------------------------------
    // 🎸 3. 중앙 메탈 현(Strings) 진동 연출 (Bass 연동)
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
    // 🥁 4. 드럼 연주 시뮬레이션 (드럼스틱 타격 모션 & 패드 울림)
    // ---------------------------------------------------------------------
    if (drumsVol > 0.05) {
      this.drumHitPhase += drumsVol * 0.4;
      
      // 좌측 드럼 좌표 (배경 이미지 속 드럼 위치)
      const drumX = renderX + renderW * 0.22;
      const drumY = renderY + renderH * 0.45;

      // 타격 충격파 링
      this.ctx.strokeStyle = `rgba(255, 60, 60, ${drumsVol * 0.9})`;
      this.ctx.lineWidth = 3.5 * scaleFactor;
      this.ctx.beginPath();
      this.ctx.arc(drumX, drumY, drumsVol * 55 * scaleFactor, 0, Math.PI * 2);
      this.ctx.stroke();

      // 🥢 드럼스틱 연주 모션 (스틱이 드럼을 내리치는 애니메이션)
      const stickAngle = -Math.PI / 4 + Math.sin(this.drumHitPhase * 8) * 0.35 * drumsVol;
      this.ctx.save();
      this.ctx.translate(drumX - 30, drumY - 40);
      this.ctx.rotate(stickAngle);
      this.ctx.fillStyle = "#e0a96d"; // 나무 색상 스틱
      this.ctx.fillRect(0, -4, 80 * scaleFactor, 8 * scaleFactor);
      this.ctx.restore();
    }

    // ---------------------------------------------------------------------
    // 🎹 5. 피아노 연주 시뮬레이션 (건반 터치 바운스 & 음표 광채)
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.05 || otherVol > 0.05) {
      const pianoPulse = Math.max(vocalsVol, otherVol);
      const pianoX = renderX + renderW * 0.78;
      const pianoY = renderY + renderH * 0.38;

      // 피아노 건반 영역 빛 번짐
      this.ctx.fillStyle = `rgba(255, 215, 0, ${pianoPulse * 0.28})`;
      this.ctx.beginPath();
      this.ctx.arc(pianoX, pianoY, pianoPulse * 75 * scaleFactor, 0, Math.PI * 2);
      this.ctx.fill();

      // 🎹 건반 눌림 바운스 바 렌더링
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
      particleCount: `Instrument Playing Simulator (Ratio:${exportRatio})`,
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
