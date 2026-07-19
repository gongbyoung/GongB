/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 2.8 테두리-내부 색상 동기화 및 채도/명도 동적 변조 버전
 * - 레이아웃 사양: 캔버스 실제 종횡비 실시간 추적 격자 정렬 (16:9 <-> 9:16 완벽 완결)
 * - 컬러 혁신: 드롭다운 'Earth' 선택 시 각 채널 버튼이 고유의 테두리 색상(Hue)을 내부로 100% 상속.
 *   음악 볼륨에 비례하여 색상의 채도(S)와 명도(L)가 실시간으로 치솟으며 완벽한 일체형 컬러 입체감을 연출.
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
    this.version = "021호 Matrix Press Ver 2.8";

    // 💡 테두리용 32채널 무작위 고유 색상 파장 배열 가설
    this.randomStrokeHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    
    // 아날로그 빈티지 노이즈 캐시 질감 레이어
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

      const strokeHue = (this.randomStrokeHues[i] + seed) % 360;

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
          // [테두리 색상 연산]: 대기 시에는 차분하게, 음압 유입 시 명도 확보
          baseStrokeStyle = `hsla(${strokeHue}, 85%, 35%, 0.65)`;
          if (intensity > 0.08) {
             baseStrokeStyle = `hsla(${strokeHue}, 100%, 55%, 1)`;
          }

          // 💡 [핵심 개혁]: 내부에 채워질 불빛도 완벽하게 테두리 고유 색상(strokeHue)을 100% 그대로 추적상속
          // 볼륨(intensity)에 맞춰 채도(S)와 명도(L) 수치 레이어가 역동적으로 동반 압착 상승하는 수식 체결
          const dynamicSat = Math.min(100, Math.round(35 + intensity * 65));   // 35% (차분함) -> 100% (원색 폭발)
          const dynamicLight = Math.min(90, Math.round(14 + intensity * 51));  // 14% (어두운 소멸) -> 65% (고명도 네온 광원)
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

      // 내부 확산 연출 유닛 (모든 모드가 상속된 동적 activeColor를 완벽하게 반영하도록 가리개 보정)
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
          this.ctx.globalAlpha = intensity * 0.85;
          this.ctx.fillStyle = activeColor;
          this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
          this.ctx.fill();
          this.ctx.restore();
        }
      } 
      else if (pressModeType === 2) {
        // [모드 2]: 명암비 모드일 때도 올랜덤(Earth)일 경우엔 색상의 명도 변조 스케일링으로 동화
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

      // 와이어프레임 외곽선 최종 타격
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
      particleCount: `32 Matrix Console [Unified Color System]`,
      isCovering: true,
      activeFunction: `Matrix[Color_Decouple_Fixed_v2.8]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) { this.container.removeChild(this.canvas); }
    this.ctx = null; this.canvas = null;
  }
}
