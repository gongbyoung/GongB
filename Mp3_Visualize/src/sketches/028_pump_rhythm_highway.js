/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 악기 연주 시뮬레이터 & SRT 캘리그래피 자막 연동 Ver 27.0]
 * - 📜 SRT 자막 연동: window.currentSubtitleText를 가져와 화면 중앙에 캘리그래피 감성으로 렌더링
 * - 🖼️ assets/ 폴더 내 .png 배경 및 16:9 / 9:16 / Full 레터박스 뷰포트 완벽 대응
 * - 🎸 중앙 메탈 현, 🥁 드럼 타격, 🎹 피아노 연주 오디오 리액션 유지
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
    this.version = "028호 SRT 캘리그래피 자막 연동 Ver 27.0";
    
    // 배경 이미지 로드
    this.bg169 = new Image();
    this.bg169.src = './assets/028_169_bg.png';

    this.bg916 = new Image();
    this.bg916.src = './assets/028_916_BG.png';

    this.stringVibration = [0, 0, 0, 0, 0];
    this.selectedRatio = 'full';

    // Export 버튼 직접 감지 리스너
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

    // ---------------------------------------------------------------------
    // 📐 뷰포트 레터박스 연산
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
      targetBg = (W / H < 1.0) ? this.bg916 : this.bg169;
    }

    this.ctx.save();

    this.ctx.fillStyle = "#0c0d10";
    this.ctx.fillRect(0, 0, W, H);

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

    // 텍스트 가독성을 위한 부드러운 다크 오버레이
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;

    // ---------------------------------------------------------------------
    // 🎸 중앙 현 진동 연출 (Bass 연동)
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
    // 📜 [핵심]: SRT 자막 캘리그래피 스타일 렌더링
    // ---------------------------------------------------------------------
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.save();
      
      // 감성적인 캘리그래피 스타일 폰트 설정 (웹 표준 붓글씨 느낌 폰트 적용)
      const fontSize = Math.max(24, Math.min(46, renderW * 0.065)) * scaleFactor;
      this.ctx.font = `bold ${fontSize}px "Gowun Dodum", "MapoFlowerIsland", "Nanum Pen Script", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const subX = centerX;
      const subY = renderY + renderH * 0.25; // 상단 영역에 배치

      // 1. 글자 그림자 (먹물 번짐 효과)
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;

      // 2. 글자 테두리 (스트로크)
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      this.ctx.lineWidth = 4;

      // 여러 줄 자막 처리 (공백이나 \n 기준 분할)
      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = subY + (idx - (lines.length - 1) / 2) * lineHeight;
        this.ctx.strokeText(line, subX, lineY);
        
        // 3. 캘리그래피 본문 채우기 (고풍스러운 짙은 회색/먹색 톤)
        this.ctx.fillStyle = "#f5f2eb"; // 한지 톤 밝은 미색
        this.ctx.fillText(line, subX, lineY);
      });

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `SRT Calligraphy Subtitle (Ratio:${exportRatio})`,
      isCovering: true,
      activeFunction: `CalligraphySubtitle[${exportRatio.toUpperCase()}]`
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
