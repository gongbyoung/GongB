/**
 * src/sketches/022_poem_typography.js
 * - [버전] Ver 4.0 4-Stem 분리 음원 완전 락온 & 캔버스 라이프사이클 복원판
 * - 수정 내용:
 * 1) 캔버스 파기 후 재진입 시 캔버스/컨텍스트 자동 재개설 (스케치 선택 차단 방지)
 * 2) smoothedValues 객체 기반 NaN 오염 차단 회로 탑재
 * 3) 4-Stem 감도 5배 증폭 및 보컬 무음 구간 시 타 악기 추종 Fallback 모션 작동
 */

export default class PoemTypographySketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.smoothedValues = {};
    this.version = "022호 시 타이포 Ver 4.0";

    this.init();
  }

  // 💡 [수리 1]: 스케치 재선택 시 캔버스 및 컨텍스트 자동 복원
  init() {
    if (!this.canvas || !this.canvas.parentNode) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (this.container) {
        this.container.appendChild(this.canvas);
      }
    }
    this.resize();
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

  // 자동 줄바꿈 처리
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
    // 💡 캔버스가 없으면 즉시 자동 개설
    if (!this.ctx || !this.canvas) {
      this.init();
      if (!this.ctx) return;
    }

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

    // 💡 [수리 2]: 4-Stem 음압 감도 5배 증폭 및 보컬 무음 시 타 악기 반응 보완
    if (audioData && audioData.isMultiStem) {
      vocalsVol = (audioData.vocalsVol || 0) * gainVal * 5.0;
      drumsVol  = (audioData.drumsVol  || 0) * gainVal * 5.0;
      bassVol   = (audioData.bassVol   || 0) * gainVal * 5.0;
      otherVol  = (audioData.otherVol  || 0) * gainVal * 5.0;

      // 보컬이 잠시 쉴 때 드럼/기타 소리에 맞춰 글자가 점프하도록 보정
      const maxOther = Math.max(drumsVol, bassVol, otherVol);
      if (vocalsVol < 0.05 && maxOther > 0.05) {
        vocalsVol = maxOther * 0.6;
      }
    } else if (audioData) {
      const vol = audioData.vol || 0;
      const bass = audioData.bass || 0;
      const mid = audioData.mid || 0;
      const treble = audioData.treble || 0;

      vocalsVol = (mid * 3.0 + vol * 2.0) * gainVal;
      drumsVol  = (bass * 3.5) * gainVal;
      bassVol   = (bass * 3.0 + vol * 1.0) * gainVal;
      otherVol  = (treble * 3.0 + mid * 1.0) * gainVal;
    }

    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'neon';
    if (colorSelectDOM) colorStyle = colorSelectDOM.value.toLowerCase();

    // 🥁 [드럼]: 화면 충격 셰이크
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

        // 💡 [수리 3]: NaN 방지 가드 (항상 정수 0에서 출발하도록 검증)
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

        // 🎤 [보컬 반응]: 글자 수직 점프
        const idleMotion = Math.sin(this.time * 2 + globalCharIndex * 0.5) * (baseFontSize * 0.05);
        const bounce = Math.abs(Math.sin(timePhase)) * (charIntensity * baseFontSize * 1.6) + idleMotion;
        charY -= bounce;

        // 🎹 [기타 반응]: 글자 회전 파동
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

        // 🎸 [베이스 반응]: 네온 불빛 폭발
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
      particleCount: `4-Stem Mapped [Vocals:${vocalsVol.toFixed(2)}]`,
      isCovering: true,
      activeFunction: "PoemTypography[4Stem_Active_v4.0]"
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
