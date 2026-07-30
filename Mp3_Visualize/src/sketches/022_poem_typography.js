/**
 * src/sketches/022_poem_typography.js
 * - [버전] Ver 1.0 오디오 리액티브 시 타이포그래피 모션 스케치
 * - 기능 사양:
 * 1) 시 제목(문장)을 글자/단어 단위로 자동 분리하여 32채널 오디오 주파수와 1:1 매핑
 * 2) Shuffle (Seed): 글자 파동 애니메이션 모드 (0: 수직 바운스, 1: 줌&회전, 2: 3D 파동, 3: 네온 릴레이)
 * 3) Range (Scatter): 글자/단어 간격 및 자간 분산도 조율
 * 4) Scale (Glow): 글자 폰트 크기 및 네온 발광 세기
 * 5) Volume (Gain): 음악 비트에 반응하는 글자 튀오름 폭
 * 6) Gauge: 글자 간의 파동 시차 (Wave Delay - 첫 글자부터 끝 글자로 전이되는 시간차)
 * 7) Color Style: Neon, Pastel, Monochrome, Earth, Custom 5대 팔레트 완벽 연동
 * 8) BG 이미지: 관제탑에서 올린 배경 사진 위로 글자가 춤추는 융합 레이어 지원
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
    this.smoothedValues = new Array(32).fill(0);
    this.version = "022호 시 타이포그래피 Ver 1.0";

    // 기본 시 제목 문구 (추후 필요시 동적 변경 가능)
    this.poemTitle = "떠날 때의 님의 얼굴";
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth;
    this.height = h || this.container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(0, 240, 255, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(char => char + char).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  update(audioData) {
    if (!this.ctx) return;

    this.time += 0.016;
    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    // 관제탑 슬라이더 연동 파라미터 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 1.8; // 자간/간격
    const glowVal = globalSettings.glowIntensity ?? 0.85;       // 폰트 크기 및 발광
    const gainVal = globalSettings.audioGain ?? 1.0;           // 모션 진폭
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;         // 파동 시차(Delay)

    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'neon';
    if (colorSelectDOM) colorStyle = colorSelectDOM.value.toLowerCase();
    else colorStyle = (globalSettings.colorStyle || 'neon').toLowerCase();

    // 1. 배경 처리 (업로드한 배경 이미지 지원)
    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      this.ctx.save();
      const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
      const canvasAspect = renderW / renderH;
      let renderableWidth, renderableHeight, xStart, yStart;

      if (canvasAspect > imgAspect) {
        renderableWidth = renderW;
        renderableHeight = renderW / imgAspect;
        xStart = 0;
        yStart = (renderH - renderableHeight) / 2;
      } else {
        renderableHeight = renderH;
        renderableWidth = renderH * imgAspect;
        xStart = (renderW - renderableWidth) / 2;
        yStart = 0;
      }

      this.ctx.drawImage(bgImg, xStart, yStart, renderableWidth, renderableHeight);
      
      // 글자 시인성을 위한 차분한 어두운 딤 필터 Layer
      this.ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
      this.ctx.fillRect(0, 0, renderW, renderH);
      this.ctx.restore();
    } else {
      // 배경 이미지 없을 때의 딥 칠흑 배경
      this.ctx.fillStyle = '#03050a';
      this.ctx.fillRect(0, 0, renderW, renderH);
    }

    // 2. 글자 쪼개기 및 32채널 오디오 매핑
    const charList = this.poemTitle.split('');
    const totalChars = charList.length;

    // 슬라이더 조율에 따른 폰트 크기 및 간격 산출
    const baseFontSize = Math.min(renderW, renderH) * (0.07 + glowVal * 0.06);
    const letterSpacing = baseFontSize * (0.8 + scatterVal * 0.3);

    // 문장 전체 캔버스 중앙 정렬 좌표 계산
    const totalTextWidth = (totalChars - 1) * letterSpacing;
    const startX = (renderW - totalTextWidth) / 2;
    const centerY = renderH / 2;

    // Shuffle(Seed) 값에 따른 애니메이션 연출 모드 선택 (0~3)
    const animMode = seed % 4;

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `900 ${baseFontSize}px 'Noto Sans KR', sans-serif`;

    // 3. 글자별 독립 루프 렌더링
    for (let i = 0; i < totalChars; i++) {
      const char = charList[i];
      if (char === ' ') continue; // 공백 넘기기

      // 각 글자 채널에 바인딩할 오디오 주파수 채널 지정 (32개 주파수에 글자 분산)
      const dataIdx = Math.floor((i / totalChars) * 32);

      let rawFreq = 0;
      if (audioData && audioData.customBands && audioData.customBands[dataIdx] !== undefined) {
        rawFreq = audioData.customBands[dataIdx];
      } else if (audioData && audioData.raw && audioData.raw.length > 0) {
        const sampleIdx = Math.floor((dataIdx / 32) * audioData.raw.length);
        rawFreq = (audioData.raw[sampleIdx] || 0) / 255.0;
      }

      // Smooth 필터 적용
      const targetVal = rawFreq * gainVal;
      this.smoothedValues[i] += (targetVal - this.smoothedValues[i]) * 0.28;
      const intensity = Math.max(0, this.smoothedValues[i]);

      // Gauge 슬라이더 기반 시차(Wave Delay) 계산
      const waveDelay = i * (gaugeVal * 0.25);
      const timePhase = this.time * 4 - waveDelay;

      // 글자 기본 X, Y 좌표
      const charX = startX + (i * letterSpacing);
      let charY = centerY;
      let charScale = 1.0;
      let charRotation = 0;

      // 💡 [애니메이션 모드별 변형 수식]
      if (animMode === 0) {
        // [모드 0]: 수직 튀오름 (Vertical Jump)
        const bounce = Math.abs(Math.sin(timePhase)) * intensity * (baseFontSize * 1.5);
        charY -= bounce;
      } 
      else if (animMode === 1) {
        // [모드 1]: 줌 & 스케일 펄스 (Zoom Pulse)
        charScale = 1.0 + intensity * 1.2;
        charY -= intensity * (baseFontSize * 0.4);
      } 
      else if (animMode === 2) {
        // [모드 2]: 리드미컬 3D 회전 & 각도 틸트 (Rotational Wave)
        charRotation = Math.sin(timePhase) * (intensity * 0.6);
        charY += Math.cos(timePhase) * (intensity * (baseFontSize * 0.6));
      } 
      else if (animMode === 3) {
        // [모드 3]: 물결 팝업 & 입체 팽창 (Ripple Bloom)
        const ripple = Math.sin(timePhase * 2) * intensity;
        charY -= ripple * (baseFontSize * 0.8);
        charScale = 1.0 + ripple * 0.5;
      }

      // 💡 [컬러 스타일 5대 팔레트 변환 수식]
      let strokeColor = '#00f0ff';
      let fillColor = '#ffffff';
      let shadowColor = '#00f0ff';

      const hueOffset = (i * 25 + seed * 10) % 360;

      switch(colorStyle) {
        case 'monochrome':
          strokeColor = `rgb(${180 + intensity * 75}, ${180 + intensity * 75}, ${180 + intensity * 75})`;
          fillColor = `rgb(${220 + intensity * 35}, ${220 + intensity * 35}, ${220 + intensity * 35})`;
          shadowColor = 'rgba(255, 255, 255, 0.6)';
          break;
        case 'neon':
          strokeColor = '#00f0ff';
          fillColor = '#ffffff';
          shadowColor = '#00f0ff';
          break;
        case 'earth':
        case '3': // 진성 올랜덤 파장 매핑
          strokeColor = `hsla(${hueOffset}, 100%, 60%, 1)`;
          fillColor = `hsla(${hueOffset}, 100%, 85%, 1)`;
          shadowColor = `hsla(${hueOffset}, 100%, 55%, 1)`;
          break;
        case 'pastel':
          strokeColor = '#f472b6';
          fillColor = '#fef08a';
          shadowColor = '#fb7185';
          break;
        case 'custom':
          strokeColor = globalSettings.customColors?.gas1 || '#00ffcc';
          fillColor = globalSettings.customColors?.star || '#ffffff';
          shadowColor = globalSettings.customColors?.gas2 || '#ff00ff';
          break;
      }

      // 글자 그리기
      this.ctx.save();
      this.ctx.translate(charX, charY);
      this.ctx.scale(charScale, charScale);
      this.ctx.rotate(charRotation);

      // 4. 네온 그림자 및 발광 튜닝 (Glow Effect)
      if (intensity > 0.05) {
        this.ctx.shadowColor = shadowColor;
        this.ctx.shadowBlur = 10 + intensity * 30 * glowVal;
      } else {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
      }

      // 글자 채우기
      this.ctx.fillStyle = fillColor;
      this.ctx.fillText(char, 0, 0);

      // 글자 외곽 테두리 붓칠
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2 + intensity * 3;
      this.ctx.strokeText(char, 0, 0);

      this.ctx.restore();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Text [Chars:${totalChars} / Mode:${animMode}]`,
      isCovering: true,
      activeFunction: "PoemTypography[Interactive_v1.0]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
    this.ctx = null;
    this.canvas = null;
  }
}
