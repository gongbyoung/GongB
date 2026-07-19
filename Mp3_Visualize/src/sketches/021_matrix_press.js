/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 2.7 DOM 다이렉트 바이패스형 진성 올랜덤 매트릭스 콘솔
 * - 시스템 수리: main.js의 이벤트 신호 누수를 차단하기 위해 드롭다운 DOM 엘리먼트 실시간 직결 판독
 * - 컬러 사양: 'Earth' (또는 인덱스 3번) 선택 시 32개 버튼의 [테두리 고유 색상]과 [내부 불빛 고유 색상]을 완전 독립 분리하여 진성 올랜덤 격발
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
    this.version = "021호 Matrix Press Ver 2.7";

    // 💡 테두리(Stroke)와 내부 불빛(Active)이 완벽히 따로 놀도록 32채널 독립 랜덤 색상축 분리 생성
    this.randomActiveHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    this.randomStrokeHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    
    // 아날로그 빈티지 노이즈 캐시 버퍼
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

    // 가로/세로 화면비 실시간 격자 레이아웃 정렬 장치 (16:9 - 8x4 / 9:16 - 4x8)
    const isVerticalLayout = renderH > renderW;
    const cols = isVerticalLayout ? 4 : 8;
    const rows = isVerticalLayout ? 8 : 4;

    const cellW = renderW / cols;
    const cellH = renderH / rows;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;
    const seed = globalSettings.seed ?? 42;
    
    // 💡 [원천 해결 책]: main.js를 거치지 않고 드롭다운 메뉴의 실제 선택 값을 실시간 다이렉트 추적
    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'neon';
    if (colorSelectDOM) {
      colorStyle = colorSelectDOM.value.toLowerCase();
    } else {
      colorStyle = (globalSettings.colorStyle || 'neon').toLowerCase();
    }

    const pressModeType = seed % 4;

    for (let i = 0; i < 32; i++) {
      const colIdx = i % cols;
      const rowIdx = Math.floor(i / cols);

      const startX = colIdx * cellW;
      const startY = rowIdx * cellH;

      let rawFreq = 0;
      if (audioData && audioData.customBands && audioData.customBands[i] !== undefined) {
        rawFreq = audioData.customBands[i];
      } else if (audioData && audioData.raw && audioData.raw.length > 0) {
        const sampleIdx = Math.floor((i / 32) * audioData.raw.length);
        rawFreq = (audioData.raw[sampleIdx] || 0) / 255.0;
      }

      const targetValue = rawFreq * gainScale;
      this.smoothedValues[i] += (targetValue - this.smoothedValues[i]) * 0.28;
      const intensity = this.smoothedValues[i];

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

      // 하드웨어식 컬러 라우팅 분기
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
          
        // 💡 [수리 포인트]: 문자열 'earth' 나 혹은 select의 인덱스 매핑값 '3'이 들어와도 완벽 격발
        case 'earth':
        case '3':
          const strokeHue = (this.randomStrokeHues[i] + seed) % 360;
          const activeHue = (this.randomActiveHues[i] + seed) % 360;
          
          // 💡 정적 상태에서도 테두리 올랜덤이 확연히 인지되도록 기본 베이스 라인 자체를 컬러풀하게 빌드
          baseStrokeStyle = `hsla(${strokeHue}, 90%, 38%, 0.65)`;
          if (intensity > 0.08) {
             baseStrokeStyle = `hsla(${strokeHue}, 100%, 55%, 1)`;
          }
          // 내부 인터랙션용 별도 고유 컬러 매핑
          activeColor = `hsla(${activeHue}, 100%, 55%, 1)`;
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

      // 내부 모션 유닛
      if (pressModeType === 0) {
        if (intensity > 0.01) {
          const innerBlurGlow = this.ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, Math.max(btnW, btnH) * 0.45 * intensity);
          innerBlurGlow.addColorStop(0, activeColor);
          innerBlurGlow.addColorStop(0.5, activeColor.replace('1)', '0.35)').replace(')', ', 0.35)'));
          innerBlurGlow.addColorStop(1, 'rgba(0,0,0,0)');
          this.ctx.fillStyle = innerBlurGlow;
          this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
          this.ctx.fill();
        }
      } 
      else if (pressModeType === 1) {
        if (intensity > 0.01) {
          this.ctx.save();
          this.ctx.globalAlpha = intensity * 0.8;
          this.ctx.fillStyle = activeColor;
          this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
          this.ctx.fill();
          this.ctx.restore();
        }
      } 
      else if (pressModeType === 2) {
        const brightnessValue = Math.floor(intensity * 120);
        this.ctx.fillStyle = `rgba(${brightnessValue}, ${brightnessValue + 15}, ${brightnessValue + 35}, 0.7)`;
        this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
        this.ctx.fill();
      } 
      else if (pressModeType === 3) {
        this.ctx.strokeStyle = activeColor;
        this.ctx.globalAlpha = 0.2 + intensity * 0.8;
        this.drawInstrumentGlyph(this.ctx, centerX, centerY, Math.min(btnW, btnH), i, intensity);
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

      // 와이어프레임 외곽선 마감 드로우
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
      particleCount: `32 Matrix Console [DOM Bypass Active]`,
      isCovering: true,
      activeFunction: `Matrix[True_AllRandom_V2.7]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) { this.container.removeChild(this.canvas); }
    this.ctx = null; this.canvas = null;
  }
}
