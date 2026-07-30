/**
 * src/sketches/022_poem_typography.js
 * - [버전] Ver 5.0 가이드 팝업 모달 탑재 & 4-Stem / 단일 MP3 하이브리드 완결판
 * - 기능 사양:
 * 1) 스케치 선택 시 독립 팝업 안내 모달(showGuideModal) 및 좌측 설명 패널 자동 출력
 * 2) 4-Stem 동시 재생 시 [보컬/드럼/베이스/기타] 각자 역할 매핑
 * 3) 단일 MP3 재생 시 [중음=보컬, 저음=드럼/베이스, 고음=기타] 주파수 자동 대체 반응
 * 4) 16:9 / 9:16 반응형 자동 줄바꿈 및 Scale/Range/Gauge 슬라이더 완벽 연동
 */

export default class PoemTypographySketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.smoothedValues = {};
    this.version = "022호 시 타이포 Ver 5.0";

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
    // 💡 022호 진입 시 가이드 팝업 및 좌측 설명 패널 자율 주입
    this.showGuideModal();
    this.updateSidePanel();
  }

  // 💡 [안내 팝업 모달 구현]
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
          <span style="color:#00ffcc; font-size:14px; font-weight:bold;">✍️ 022호 시 타이포 모션 조작 가이드</span>
          <span id="btn-poem-modal-x" style="color:#f43f5e; font-weight:bold; cursor:pointer; font-size:16px;">✕</span>
        </div>

        <div style="font-size:11px; line-height:1.6; max-height:60vh; overflow-y:auto; padding-right:5px;">
          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎛️ 음악 연동 방식 (2가지 모드 지원)</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>1. 4-Stem 분리 음원 사용 시 (추천)</strong>:<br>
              좌측 메뉴의 4-Stem 멀티 입력란에 4개 MP3(Vocals, Drums, Bass, Other)를 선택 후 <strong style="color:#00ffcc;">[▶️ 4-Stem 동시 재생]</strong> 버튼을 누르세요.<br>
            • <strong>2. 단일 MP3 파일 사용 시</strong>:<br>
              상단 MP3 등록 후 <strong style="color:#00ffcc;">[▶️ 음악 재생]</strong>을 누르면 저음/중음/고음 주파수로 자동 분할 연동됩니다.
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎼 악기별 모션 반응 역할</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>🎤 보컬 (Vocals / 중음)</strong>: 시 글자가 위아래로 쿵쿵 점프<br>
            • <strong>🥁 드럼 (Drums / 저음)</strong>: 화면 전체 충격 셰이크 (Shake)<br>
            • <strong>🎸 베이스 (Bass / 중저음)</strong>: 글자 테두리 네온 빛(Glow) 및 두께 폭발<br>
            • <strong>🎹 기타/반주 (Other / 고음)</strong>: 글자들의 좌우 회전 및 물결 파동
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎛️ 화면 비율 & 슬라이더 조율</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b;">
            • <strong>Scale (Glow)</strong>: 글자 크기 조정 (9:16 세로 모드 시 화면에 맞게 조율)<br>
            • <strong>Range (Scatter)</strong>: 글자 사이 간격(자간) 조율<br>
            • <strong>Gauge</strong>: 줄 간격(행간) 및 파동 시차 조율<br>
            • <strong>Shuffle (Seed)</strong>: 글자 모션 연출 형태 변경 (0~3)
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

  // 💡 [좌측 안내 패널 업데이트]
  updateSidePanel() {
    const panel = document.getElementById('sketch-description-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="line-height:1.5; color:#d0e0ff; font-size:11px;">
          <strong style="color:#00ffcc; font-size:12px;">✍️ [022호 시타이포] 사용 가이드</strong><br>
          • <strong>4-Stem 재생</strong>: 파일 선택 후 [▶️ 4-Stem 동시 재생] 클릭<br>
          • <strong>단일 MP3 재생</strong>: [▶️ 음악 재생] 클릭 시 주파수 자동 대체<br>
          • <strong>Scale (Glow)</strong>: 9:16 모드 시 글자 크기 축소/확대<br>
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

    // 💡 [하이브리드 음원 반응 엔진]: 4-Stem 및 단일 MP3 완벽 호환
    if (audioData && audioData.isMultiStem) {
      vocalsVol = (audioData.vocalsVol || 0) * gainVal * 5.0;
      drumsVol  = (audioData.drumsVol  || 0) * gainVal * 5.0;
      bassVol   = (audioData.bassVol   || 0) * gainVal * 5.0;
      otherVol  = (audioData.otherVol  || 0) * gainVal * 5.0;
      modeText = `4-Stem [Vocal:${vocalsVol.toFixed(2)}]`;

      const maxOther = Math.max(drumsVol, bassVol, otherVol);
      if (vocalsVol < 0.05 && maxOther > 0.05) {
        vocalsVol = maxOther * 0.6;
      }
    } else if (audioData) {
      const vol = audioData.vol || 0;
      const bass = audioData.bass || 0;
      const mid = audioData.mid || 0;
      const treble = audioData.treble || 0;

      vocalsVol = (mid * 3.5 + vol * 2.0) * gainVal;
      drumsVol  = (bass * 4.0) * gainVal;
      bassVol   = (bass * 3.5 + vol * 1.5) * gainVal;
      otherVol  = (treble * 3.5 + mid * 1.5) * gainVal;
      modeText = `Single MP3 [Vol:${vol.toFixed(2)}]`;
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

    // 2. 폰트 및 자동 줄바꿈 레이아웃
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

        // 🎤 [보컬 반응]: 수직 점프
        const idleMotion = Math.sin(this.time * 2 + globalCharIndex * 0.5) * (baseFontSize * 0.05);
        const bounce = Math.abs(Math.sin(timePhase)) * (charIntensity * baseFontSize * 1.6) + idleMotion;
        charY -= bounce;

        // 🎹 [기타 반응]: 회전 파동
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

        // 🎸 [베이스 반응]: 네온 발광 폭발
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
      activeFunction: "PoemTypography[Interactive_v5.0]"
    };
  }

  destroy() {
    const popup = document.getElementById('poem-standalone-modal');
    if (popup) {
      popup.remove();
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
