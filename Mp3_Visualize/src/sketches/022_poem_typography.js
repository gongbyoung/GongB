/**
 * src/sketches/022_poem_typography.js
 * - [버전] Ver 5.5 4-Stem 전역 이중 검증 & 하이브리드 자동 추종 완결판
 */

export default class PoemTypographySketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.smoothedValues = {};
    this.version = "022호 시 타이포 Ver 5.5";

    this.init();
  }

  init() {
    if (!this.canvas || !this.canvas.parentNode) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (this.container) {
        this.container.appendChild(this.canvas);
      }
    }
    this.resize();
    this.showGuideModal();
    this.updateSidePanel();
  }

  showGuideModal() {
    let popup = document.getElementById('poem-standalone-modal');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'poem-standalone-modal';
      popup.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(2, 6, 18, 0.85); backdrop-filter: blur(4px);
        z-index: 100000; display: flex; align-items: center; justify-content: center;
      `;
      document.body.appendChild(popup);
    }

    popup.innerHTML = `
      <div style="
        background: #0b1329; border: 2px solid #00ffcc; border-radius: 10px;
        width: 480px; max-width: 90vw; padding: 20px; color: #e2e8f0;
        box-shadow: 0 0 30px rgba(0, 255, 204, 0.35); font-family: sans-serif;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:12px;">
          <span style="color:#00ffcc; font-size:14px; font-weight:bold;">✍️ 022호 시 타이포 스마트 안내</span>
          <span id="btn-poem-modal-x" style="color:#f43f5e; font-weight:bold; cursor:pointer; font-size:16px;">✕</span>
        </div>

        <div style="font-size:11px; line-height:1.6; max-height:60vh; overflow-y:auto;">
          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">⚡ 스마트 파일 일괄 인식 지원</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            좌측 상단의 <strong style="color:#00ffcc;">[MP3 파일 전체 일괄 선택]</strong> 칸에 폴더 안의 파일들을 한꺼번에 선택(Ctrl+A)해서 올리면, 시스템이 메인 MP3와 4개 스템(Vocals, Drums, Bass, Other)을 자동으로 분류하여 바로 재생합니다!
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:15px;">
          <button id="btn-poem-modal-ok" style="
            background:#00ffcc; color:#020617; border:none; padding:6px 16px;
            font-size:11px; font-weight:bold; border-radius:4px; cursor:pointer;
          ">확인 (Close)</button>
        </div>
      </div>
    `;

    popup.style.display = 'flex';
    const closeFn = () => { popup.style.display = 'none'; };
    document.getElementById('btn-poem-modal-x')?.addEventListener('click', closeFn);
    document.getElementById('btn-poem-modal-ok')?.addEventListener('click', closeFn);
  }

  updateSidePanel() {
    const panel = document.getElementById('sketch-description-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="line-height:1.5; color:#d0e0ff; font-size:11px;">
          <strong style="color:#00ffcc; font-size:12px;">✍️ [022호 시타이포] 사용 가이드</strong><br>
          • <strong>일괄 선택</strong>: [MP3 전체 일괄 선택]으로 다중 파일 한 번에 로드<br>
          • <strong>Scale (Glow)</strong>: 글자 크기 축소/확대<br>
          • <strong>Range (Scatter)</strong>: 자간 간격 조율<br>
          • <strong>Gauge</strong>: 행간(줄 간격) 조율
        </div>
      `;
    }
  }

  resize(w, h) {
    if (!this.container && !w) return;
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  wrapText(text, maxLineWidth, letterSpacing) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = word.length * letterSpacing;

      if (currentLineWidth + wordWidth > maxLineWidth && currentLine.length > 0) {
        lines.push(currentLine.join(' '));
        currentLine = [word];
        currentLineWidth = wordWidth + letterSpacing;
      } else {
        currentLine.push(word);
        currentLineWidth += wordWidth + letterSpacing;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine.join(' '));
    return lines.length > 0 ? lines : [text];
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) {
      this.init();
      if (!this.ctx) return;
    }

    // 💡 전역 데이터 이중 보완 백업
    const targetAudio = (audioData && audioData.isMultiStem !== undefined) ? audioData : (window.latestCompiledAudioData || audioData || {});

    this.time += 0.016;
    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 2.2;
    const glowVal = globalSettings.glowIntensity ?? 0.85;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    const rawText = (globalSettings.poemText || "떠날 때의 님의 얼굴").trim();

    let vocalsVol = 0, drumsVol = 0, bassVol = 0, otherVol = 0;
    let modeText = "Idle";

    if (targetAudio && targetAudio.isMultiStem) {
      vocalsVol = (targetAudio.vocalsVol || 0) * gainVal * 5.0;
      drumsVol  = (targetAudio.drumsVol  || 0) * gainVal * 5.0;
      bassVol   = (targetAudio.bassVol   || 0) * gainVal * 5.0;
      otherVol  = (targetAudio.otherVol  || 0) * gainVal * 5.0;
      modeText = `4-Stem Active [Vocal:${vocalsVol.toFixed(2)}]`;

      const maxOther = Math.max(drumsVol, bassVol, otherVol);
      if (vocalsVol < 0.05 && maxOther > 0.05) {
        vocalsVol = maxOther * 0.6;
      }
    } else if (targetAudio) {
      const vol = targetAudio.vol || 0;
      const bass = targetAudio.bass || 0;
      const mid = targetAudio.mid || 0;
      const treble = targetAudio.treble || 0;

      vocalsVol = (mid * 3.5 + vol * 2.0) * gainVal;
      drumsVol  = (bass * 4.0) * gainVal;
      bassVol   = (bass * 3.5 + vol * 1.5) * gainVal;
      otherVol  = (treble * 3.5 + mid * 1.5) * gainVal;
      modeText = `Single MP3 [Vol:${vol.toFixed(2)}]`;
    }

    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'neon';
    if (colorSelectDOM) colorStyle = colorSelectDOM.value.toLowerCase();

    // 🥁 드럼 반응: 화면 충격 셰이크
    this.ctx.save();
    if (drumsVol > 0.05) {
      const shakeX = (Math.random() - 0.5) * Math.min(drumsVol * 25, 25);
      const shakeY = (Math.random() - 0.5) * Math.min(drumsVol * 25, 25);
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. 배경 처리
    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
      const canvasAspect = renderW / renderH;
      let rw, rh, xs, ys;

      if (canvasAspect > imgAspect) {
        rw = renderW; rh = renderW / imgAspect; xs = 0; ys = (renderH - rh) / 2;
      } else {
        rh = renderH; rw = renderH * imgAspect; xs = (renderW - rw) / 2; ys = 0;
      }

      this.ctx.drawImage(bgImg, xs, ys, rw, rh);
      this.ctx.fillStyle = 'rgba(4, 6, 12, 0.65)';
      this.ctx.fillRect(0, 0, renderW, renderH);
    } else {
      this.ctx.fillStyle = '#03050a';
      this.ctx.fillRect(0, 0, renderW, renderH);
    }

    // 2. 폰트 레이아웃
    const isPortrait = renderH > renderW;
    const baseFontSize = Math.min(renderW, renderH) * (isPortrait ? 0.08 : 0.07) * (0.5 + glowVal * 1.2);
    const letterSpacing = baseFontSize * (0.75 + scatterVal * 0.15);
    const lineHeight = baseFontSize * (1.3 + gaugeVal * 0.4);
    const maxLineWidth = renderW * 0.88;

    const lines = this.wrapText(rawText, maxLineWidth, letterSpacing);
    const totalLines = lines.length;

    const totalBlockHeight = (totalLines - 1) * lineHeight;
    const startY = (renderH - totalBlockHeight) / 2;

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `900 ${baseFontSize}px 'Noto Sans KR', sans-serif`;

    const animMode = seed % 4;
    let globalCharIndex = 0;

    for (let l = 0; l < totalLines; l++) {
      const lineText = lines[l];
      const lineChars = lineText.split('');
      const lineCharCount = lineChars.length;

      const lineLineWidth = (lineCharCount - 1) * letterSpacing;
      const lineStartX = (renderW - lineLineWidth) / 2;
      const lineY = startY + (l * lineHeight);

      for (let c = 0; c < lineCharCount; c++) {
        const char = lineChars[c];
        globalCharIndex++;

        if (char === ' ') continue;

        if (typeof this.smoothedValues[globalCharIndex] !== 'number' || isNaN(this.smoothedValues[globalCharIndex])) {
          this.smoothedValues[globalCharIndex] = 0;
        }

        const targetVal = vocalsVol;
        this.smoothedValues[globalCharIndex] += (targetVal - this.smoothedValues[globalCharIndex]) * 0.35;
        const charIntensity = Math.max(0, this.smoothedValues[globalCharIndex]);

        const waveDelay = globalCharIndex * (gaugeVal * 0.2);
        const timePhase = this.time * 4.5 - waveDelay;

        const charX = lineStartX + (c * letterSpacing);
        let charY = lineY;
        let charScale = 1.0;
        let charRotation = 0;

        // 🎤 보컬 반응
        const idleMotion = Math.sin(this.time * 2 + globalCharIndex * 0.5) * (baseFontSize * 0.05);
        const bounce = Math.abs(Math.sin(timePhase)) * (charIntensity * baseFontSize * 1.6) + idleMotion;
        charY -= bounce;

        // 🎹 기타 반응
        charRotation = Math.sin(timePhase) * (otherVol * 1.0 + Math.sin(this.time + globalCharIndex) * 0.1);

        if (animMode === 1) charScale = 1.0 + charIntensity * 0.8;
        else if (animMode === 2) charRotation += (charIntensity * 0.5);
        else if (animMode === 3) charScale = 1.0 + Math.sin(timePhase) * charIntensity * 0.5;

        let strokeColor = '#00f0ff', fillColor = '#ffffff', shadowColor = '#00f0ff';
        const hueOffset = (globalCharIndex * 22 + seed * 10) % 360;

        switch(colorStyle) {
          case 'monochrome':
            strokeColor = '#e2e8f0'; fillColor = '#ffffff'; shadowColor = '#ffffff'; break;
          case 'neon':
            strokeColor = '#00f0ff'; fillColor = '#ffffff'; shadowColor = '#00f0ff'; break;
          case 'earth':
          case '3':
            strokeColor = `hsla(${hueOffset}, 100%, 60%, 1)`;
            fillColor = `hsla(${hueOffset}, 100%, 88%, 1)`;
            shadowColor = `hsla(${hueOffset}, 100%, 55%, 1)`;
            break;
          case 'pastel':
            strokeColor = '#f472b6'; fillColor = '#fef08a'; shadowColor = '#fb7185'; break;
          case 'custom':
            strokeColor = globalSettings.customColors?.gas1 || '#00ffcc';
            fillColor = globalSettings.customColors?.star || '#ffffff';
            shadowColor = globalSettings.customColors?.gas2 || '#ff00ff';
            break;
        }

        this.ctx.save();
        this.ctx.translate(charX, charY);
        this.ctx.scale(charScale, charScale);
        this.ctx.rotate(charRotation);

        // 🎸 베이스 반응
        const effectiveGlow = bassVol + charIntensity * 0.4;
        if (effectiveGlow > 0.02) {
          this.ctx.shadowColor = shadowColor;
          this.ctx.shadowBlur = 8 + effectiveGlow * 45 * glowVal;
        } else {
          this.ctx.shadowBlur = 0;
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fillText(char, 0, 0);

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2 + effectiveGlow * 5;
        this.ctx.strokeText(char, 0, 0);

        this.ctx.restore();
      }
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: modeText,
      isCovering: true,
      activeFunction: "PoemTypography[AutoMatch_v5.5]"
    };
  }

  destroy() {
    const popup = document.getElementById('poem-standalone-modal');
    if (popup) popup.remove();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
