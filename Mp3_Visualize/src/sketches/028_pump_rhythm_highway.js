/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 악기 연주 시뮬레이터 & SRT 캘리그래피 자막 연동 + 완벽 고정 Ver 29.0]
 * - 🔒 스케치 이탈 원천 차단 가드 (어떤 외부 이벤트나 자막 연동에도 028번 화면 고정 유지)
 * - 📜 SRT 자막 캘리그래피 중앙 감성 렌더링 (`window.currentSubtitleText`)
 * - 📐 Export 버튼(Full, 16:9, 9:16) 수동 감지 및 레터박스 뷰포트 즉시 전환
 * - 🖼️ assets/ 폴더 내 .png 배경 이미지 완벽 연동
 * - 🎸 중앙 현 진동, 🥁 드럼 타격 연주, 🎹 피아노 연주 오디오 리액션
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
    this.version = "028호 악기 연주 & 캘리그래피 자막 고정기 Ver 29.0";
    
    // assets 폴더 내 올바른 .png 배경 이미지 로드
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
    this.selectedRatio = 'full';

    // 💡 [핵심 방어 가드]: 외부 모듈이나 자막 싱크가 스케치를 강제로 바꾸지 못하도록 방어
    this.lockSketchPin();

    // Export 버튼 및 비율 설정 직접 감지 리스너
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

  lockSketchPin() {
    try {
      if (window.sketchManager && typeof window.sketchManager.switchSketch === 'function') {
        const originalSwitch = window.sketchManager.switchSketch.bind(window.sketchManager);
        window.sketchManager.switchSketch = async (sketchName, ...args) => {
          if (sketchName && !String(sketchName).includes('028')) {
            console.warn(`[🔒 Sketch Lock Guard] 자막/외부 모듈에 의한 ${sketchName} 강제 전환 차단됨 (028 고정 유지)`);
            return; // 028번 이외로 넘어가는 명령을 방어함
          }
          return originalSwitch(sketchName, ...args);
        };
      }
    } catch (e) {}
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

    // Export 비율 파악
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
    // 📐 비율별 뷰포트 레터박스 연산
    // ---------------------------------------------------------------------
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

    // 외부 레터박스 어둡게 처리
    this.ctx.fillStyle = "#0c0d10";
    this.ctx.fillRect(0, 0, W, H);

    // 뷰포트 클리핑
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

    // 자막 가독성을 위한 부드러운 오버레이
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
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
    // 🥁 드럼 타격 연주 리액션 (Drums 연동)
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
    // 🎹 피아노 연주 리액션 (Vocals / Other 연동)
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
    // 📜 SRT 자막 캘리그래피 스타일 렌더링
    // ---------------------------------------------------------------------
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.save();
      
      const fontSize = Math.max(24, Math.min(46, renderW * 0.065)) * scaleFactor;
      this.ctx.font = `bold ${fontSize}px "Gowun Dodum", "MapoFlowerIsland", "Nanum Pen Script", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const subX = centerX;
      const subY = renderY + renderH * 0.22; // 상단 영역에 캘리그래피 배치

      this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;

      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      this.ctx.lineWidth = 4;

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = subY + (idx - (lines.length - 1) / 2) * lineHeight;
        this.ctx.strokeText(line, subX, lineY);
        
        this.ctx.fillStyle = "#f5f2eb"; // 한지 톤 미색
        this.ctx.fillText(line, subX, lineY);
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Locked Stage & Subtitle (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `LockedStage[${exportRatio.toUpperCase()}]`
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
