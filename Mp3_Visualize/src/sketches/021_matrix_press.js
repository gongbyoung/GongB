/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 3.0 주파수 스크램블러 및 예외 차단 완결판 콘솔
 * - 기능 혁신: 관제탑 Range (Scatter) 슬라이더의 위치 값을 시드로 차용하여 32채널 주파수 배선을 정밀하게 뒤섞음
 * - 컬러 진화: 주파수가 스크램블될 때, 해당 채널 고유의 네온 컬러 파장도 주파수 경로를 따라 함께 이동하여 시각적 인지성 보장
 */

export default class MatrixPressSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    this.smoothedValues = new Array(32).fill(0);
    this.version = "021호 Matrix Press Ver 3.0";

    // 32채널 고유 무작위 테두리 색상 파장 배열
    this.randomStrokeHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    
    // 아날로그 빈티지 노이즈 캐시 맵
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = 128;
    this.noiseCanvas.height = 128;
    const nCtx = this.noiseCanvas.getContext('2d');
    const nImg = nCtx.createImageData(128, 128);
    for (let i = 0; i < nImg.data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      nImg.data[i] = val; nImg.data[i+1] = val; nImg.data[i+2] = val; nImg.data[i+3] = 24; 
    }
    nCtx.putImageData(nImg, 0, 0);
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

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawInstrumentGlyph(ctx, cx, cy, size, type, intensity) {
    ctx.save();
    ctx.lineWidth = 1.5 + intensity * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const r = size * 0.35;

    switch(type % 4) {
      case 0: 
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.moveTo(cx - r, cy - r * 0.3); ctx.lineTo(cx + r, cy - r * 0.3);
        ctx.moveTo(cx - r * 0.6, cy + r * 0.4); ctx.lineTo(cx - r * 0.1, cy - r * 0.3);
        ctx.moveTo(cx + r * 0.6, cy + r * 0.4); ctx.lineTo(cx + r * 0.1, cy - r * 0.3);
        ctx.stroke(); break;
      case 1: 
        ctx.beginPath();
        for (let x = -r; x <= r; x += 2) {
          let y = Math.sin(x * 0.2 + Date.now() * 0.01) * r * 0.4;
          if (x === -r) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke(); break;
      case 2: 
        ctx.strokeRect(cx - r, cy - r * 0.4, r * 2, r * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx - r * 0.4, cy + r * 0.1);
        ctx.moveTo(cx, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.1);
        ctx.moveTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.1);
        ctx.stroke(); break;
      case 3: 
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.6); ctx.lineTo(cx - r, cy + r * 0.6); ctx.closePath(); ctx.stroke(); break;
    }
    ctx.restore();
  }

  update(audioData) {
    if (!this.ctx) return;

    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    this.ctx.fillStyle = '#04060b';
    this.ctx.fillRect(0, 0, renderW, renderH);

    const isVerticalLayout = renderH > renderW;
    const cols = isVerticalLayout ? 4 : 8;
    const rows = isVerticalLayout ? 8 : 4;

    const cellW = renderW / cols;
    const cellH = renderH / rows;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;
    const seed = globalSettings.seed ?? 42;
    
    // 💡 [DOM 연동]: 드롭다운 컬러 및 스캐터 슬라이더 노브 값 실시간 판독 수리
    const colorSelectDOM = document.getElementById('select-cosmic-color');
    const scatterDOM = document.getElementById('num-cosmic-scatter');
    
    let colorStyle = 'neon';
    if (colorSelectDOM) colorStyle = colorSelectDOM.value.toLowerCase();
    else colorStyle = (globalSettings.colorStyle || 'neon').toLowerCase();

    let scatterVal = 0;
    if (scatterDOM) scatterVal = parseInt(scatterDOM.value) || 0;
    else if (globalSettings.scatterExponent !== undefined) scatterVal = Math.round(globalSettings.scatterExponent * 10);

    const pressModeType = seed % 4;

    // 💡 [지능형 스크램블러 코어]: 스캐터 값이 0보다 클 때, 32채널 배열 주파수 통로를 난수 매핑화
    let bandIndices = Array.from({ length: 32 }, (_, idx) => idx);
    if (scatterVal > 0) {
      // 슬라이더 위치 번호와 시드를 연산하여 고정 난수 제너레이터(LCG) 기동
      let currentSeed = scatterVal * 87654 + (seed * 321);
      for (let m = bandIndices.length - 1; m > 0; m--) {
        currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
        let j = Math.floor((currentSeed / 2147483648) * (m + 1));
        let temp = bandIndices[m];
        bandIndices[m] = bandIndices[j];
        bandIndices[j] = temp;
      }
    }

    for (let i = 0; i < 32; i++) {
      const colIdx = i % cols;
      const rowIdx = Math.floor(i / cols);

      const startX = colIdx * cellW;
      const startY = rowIdx * cellH;

      // 💡 현재 격자 칸(i)이 락온할 분산 주파수 채널 인덱스(dataIdx) 추출
      const dataIdx = bandIndices[i];

      let rawFreq = 0;
      if (audioData && audioData.customBands && audioData.customBands[dataIdx] !== undefined) {
        rawFreq = audioData.customBands[dataIdx];
      } else if (audioData && audioData.raw && audioData.raw.length > 0) {
        const sampleIdx = Math.floor((dataIdx / 32) * audioData.raw.length);
        rawFreq = (audioData.raw[sampleIdx] || 0) / 255.0;
      }

      const targetValue = rawFreq * gainScale;
      this.smoothedValues[i] += (targetValue - this.smoothedValues[i]) * 0.28;
      const intensity = Math.max(0, this.smoothedValues[i]);

      const margin = 4;
      const btnX = startX + margin;
      const btnY = startY + margin;
      const btnW = cellW - margin * 2;
      const btnH = cellH - margin * 2;
      const centerX = btnX + btnW / 2;
      const centerY = btnY + btnH / 2;
      const cornerRadius = Math.min(btnW, btnH) * 0.12;

      let baseStrokeStyle = '#152035';
      let activeColor = '#00f0ff';
      let fillBaseColor = 'rgba(10, 16, 32, 0.9)';

      // 💡 색상 파장을 dataIdx 기준으로 연동하여, 주파수가 섞이더라도 악기 고유 컬러가 버튼을 따라다니도록 바인딩
      const strokeHue = (this.randomStrokeHues[dataIdx] + seed) % 360;

      switch(colorStyle) {
        case 'monochrome':
          baseStrokeStyle = '#334155';
          activeColor = `rgb(${210 + intensity * 45}, ${210 + intensity * 45}, ${210 + intensity * 45})`;
          fillBaseColor = `rgba(${12 + intensity * 35}, ${12 + intensity * 35}, ${12 + intensity * 35}, 0.955)`;
          break;
        case 'neon':
          baseStrokeStyle = '#14203e';
          activeColor = '#00f0ff';
          break;
        case 'earth':
        case '3':
          baseStrokeStyle = `hsla(${strokeHue}, 85%, 35%, 0.65)`;
          if (intensity > 0.08) {
             baseStrokeStyle = `hsla(${strokeHue}, 100%, 55%, 1)`;
          }
          const dynamicSat = Math.min(100, Math.round(35 + intensity * 65));
          const dynamicLight = Math.min(90, Math.round(14 + intensity * 51));
          activeColor = `hsla(${strokeHue}, ${dynamicSat}%, ${dynamicLight}%, 1)`;
          break;
        case 'pastel':
          baseStrokeStyle = '#475569';
          activeColor = '#fbbf24';
          fillBaseColor = 'rgba(26, 31, 44, 0.92)';
          break;
        case 'custom':
          baseStrokeStyle = '#261b15';
          activeColor = globalSettings.customColors?.star || '#ff0055';
          break;
      }

      this.ctx.save();

      this.ctx.fillStyle = fillBaseColor;
      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.fill();

      // 내부 모션 팩토리
      if (pressModeType === 0) {
        if (intensity > 0.01) {
          const outerRadius = Math.max(1.1, Math.max(btnW, btnH) * 0.45 * intensity);
          const innerBlurGlow = this.ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, outerRadius);
          
          let midGlowColor = activeColor;
          if (midGlowColor.includes('hsla')) {
            midGlowColor = midGlowColor.replace('1)', '0.35)').replace(')', ', 0.35)');
          } else {
            midGlowColor = 'rgba(0, 240, 255, 0.35)';
          }

          innerBlurGlow.addColorStop(0, activeColor);
          innerBlurGlow.addColorStop(0.5, midGlowColor);
          innerBlurGlow.addColorStop(1, 'rgba(0,0,0,0)');
          
          this.ctx.fillStyle = innerBlurGlow;
          this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
          this.ctx.fill();
        }
      } 
      else if (pressModeType === 1) {
        if (intensity > 0.01) {
          this.ctx.save();
          this.ctx.globalAlpha = intensity * 0.85;
          this.ctx.fillStyle = activeColor;
          this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
          this.ctx.fill();
          this.ctx.restore();
        }
      } 
      else if (pressModeType === 2) {
        if (colorStyle === 'earth' || colorStyle === '3') {
          this.ctx.fillStyle = activeColor;
        } else {
          const brightnessValue = Math.floor(intensity * 120);
          this.ctx.fillStyle = `rgba(${brightnessValue}, ${brightnessValue + 15}, ${brightnessValue + 35}, 0.7)`;
        }
        this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
        this.ctx.fill();
      } 
      else if (pressModeType === 3) {
        this.ctx.strokeStyle = activeColor;
        this.ctx.globalAlpha = 0.2 + intensity * 0.8;
        // 악기 모양도 섞인 매핑 구조(dataIdx)를 추적하도록 파라미터 매칭
        this.drawInstrumentGlyph(this.ctx, centerX, centerY, Math.min(btnW, btnH), dataIdx, intensity);
      }

      if (colorStyle === 'pastel') {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        const noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
        this.ctx.fillStyle = noisePattern;
        this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
        this.ctx.fill();
        this.ctx.restore();
      }

      this.ctx.strokeStyle = baseStrokeStyle;
      this.ctx.lineWidth = intensity > 0.08 ? 1.8 + intensity * 2 : 1.0;
      
      if (intensity > 0.08 && colorStyle !== 'monochrome') {
        this.ctx.shadowBlur = intensity * 12;
        this.ctx.shadowColor = activeColor;
      }

      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.stroke();

      this.ctx.restore();
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `32 Matrix [Scrambler Node: ${scatterVal}]`,
      isCovering: true,
      activeFunction: `Matrix[Freq_Scrambled_v3.0]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) { this.container.removeChild(this.canvas); }
    this.ctx = null; this.canvas = null;
  }
}
