/**
 * src/sketches/022_poem_typography.js
 * - [버전] Ver 3.5 4-Stem 모드 락온 패치판
 */

export default class PoemTypographySketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.smoothedValues = new Array(64).fill(0);
    this.version = "022호 시 타이포 Ver 3.5";
  }

  init() { this.resize(); }

  resize(w, h) {
    this.width = w || this.container.clientWidth;
    this.height = h || this.container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
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
    if (!this.ctx) return;

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

    // 💡 [수리 핵심 3]: 명확한 isMultiStem 플래그 검사로 4-Stem 데이터 100% 매핑
    if (audioData && audioData.isMultiStem) {
      vocalsVol = (audioData.vocalsVol || 0) * gainVal * 4.0;
      drumsVol  = (audioData.drumsVol  || 0) * gainVal * 4.0;
      bassVol   = (audioData.bassVol   || 0) * gainVal * 4.0;
      otherVol  = (audioData.otherVol  || 0) * gainVal * 4.0;
    } else if (audioData) {
      const vol = audioData.vol || 0;
      const bass = audioData.bass || 0;
      const mid = audioData.mid || 0;
      const treble = audioData.treble || 0;

      vocalsVol = (mid * 2.5 + vol * 1.5) * gainVal;
      drumsVol  = (bass * 3.0) * gainVal;
      bassVol   = (bass * 2.5 + vol * 1.0) * gainVal;
      otherVol  = (treble * 2.5 + mid * 1.0) * gainVal;
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

        const targetVal = vocalsVol;
        this.smoothedValues[globalCharIndex] += (targetVal - this.smoothedValues[globalCharIndex]) * 0.3;
        const charIntensity = Math.max(0, this.smoothedValues[globalCharIndex]);

        const waveDelay = globalCharIndex * (gaugeVal * 0.2);
        const timePhase = this.time * 4.5 - waveDelay;

        const charX = lineStartX + (c * letterSpacing);
        let charY = lineY;
        let charScale = 1.0;
        let charRotation = 0;

        // 🎤 보컬 반응: 글자 튀오름
        const idleMotion = Math.sin(this.time * 2 + globalCharIndex * 0.5) * (baseFontSize * 0.06);
        const bounce = Math.abs(Math.sin(timePhase)) * (charIntensity * baseFontSize * 1.5) + idleMotion;
        charY -= bounce;

        // 🎹 기타 반응: 글자 각도 회전
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

        // 🎸 베이스 반응: 네온 발광 폭발
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
      particleCount: `4-Stem Active [Vocals:${vocalsVol.toFixed(2)}]`,
      isCovering: true,
      activeFunction: "PoemTypography[4Stem_Fixed_v3.5]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
