/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 2.3 반응형 픽셀 락인 및 올랜덤 테두리 이퀄라이저 콘솔
 * - 레이아웃 보정: 캔버스 물리 스케일(w, h) 실시간 종횡비 연동형 격자 정렬 (16:9 <-> 9:16 완벽 대응)
 * - 컬러 스타일 추가: 'neon_random' 선택 시 버튼의 테두리(Stroke)와 내부 활성 컬러가 32채널 고유 랜덤 색상으로 일제 도포
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
    this.version = "021호 Matrix Press Ver 2.3";

    // 💡 [신설]: 32개 채널 버튼 고유의 올랜덤 HSLA 색상 코드 씨드 테이블 사전 구축
    this.randomHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    
    // 아날로그 빈티지 노이즈 캐시 맵 생성
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
    // 💡 마스터 스케줄러가 던져주는 실제 캔버스 엘리먼트 크기 1:1 강제 동화 수리
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
      case 0: //  drum
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.moveTo(cx - r, cy - r * 0.3); ctx.lineTo(cx + r, cy - r * 0.3);
        ctx.moveTo(cx - r * 0.6, cy + r * 0.4); ctx.lineTo(cx - r * 0.1, cy - r * 0.3);
        ctx.moveTo(cx + r * 0.6, cy + r * 0.4); ctx.lineTo(cx + r * 0.1, cy - r * 0.3);
        ctx.stroke(); break;
      case 1: // vocal sine
        ctx.beginPath();
        for (let x = -r; x <= r; x += 2) {
          let y = Math.sin(x * 0.2 + Date.now() * 0.01) * r * 0.4;
          if (x === -r) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke(); break;
      case 2: // synth/melody
        ctx.strokeRect(cx - r, cy - r * 0.4, r * 2, r * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx - r * 0.4, cy + r * 0.1);
        ctx.moveTo(cx, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.1);
        ctx.moveTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.1);
        ctx.stroke(); break;
      case 3: // high-hat / bell
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.6); ctx.lineTo(cx - r, cy + r * 0.6); ctx.closePath(); ctx.stroke(); break;
    }
    ctx.restore();
  }

  update(audioData) {
    if (!this.ctx) return;

    // 💡 [수리 완료]: 렌더 프레임 시작 시점의 물리 픽셀 규격을 실시간 추출하여 매핑 에러 원천 차단
    const renderW = this.canvas.width;
    const renderH = this.canvas.height;

    this.ctx.fillStyle = '#04060b';
    this.ctx.fillRect(0, 0, renderW, renderH);

    // 💡 [수리 완료]: 종횡비를 체크하여 16:9(가로)는 8x4, 9:16(세로)은 4x8로 격자 보드판 강제 스위칭 연동
    const isVerticalLayout = renderH > renderW;
    const cols = isVerticalLayout ? 4 : 8;
    const rows = isVerticalLayout ? 8 : 4;

    const cellW = renderW / cols;
    const cellH = renderH / rows;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;
    const seed = globalSettings.seed ?? 42;
    const colorStyle = globalSettings.colorStyle || 'neon';

    // SHUFFLE(Seed) 입력 수치에 따라 내부 프레스 인터랙션 모드 (0~3) 매핑
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

      // 💡 [외곽선 100% 완전 고정]: 프레스 모드가 변해도 바깥 마스크 좌표는 격자선에 고정
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

      // 컬러 팔레트 배포 분기점
      switch(colorStyle) {
        case 'bw':
          baseStrokeStyle = '#334155';
          activeColor = `rgb(${210 + intensity * 45}, ${210 + intensity * 45}, ${210 + intensity * 45})`;
          fillBaseColor = `rgba(${12 + intensity * 35}, ${12 + intensity * 35}, ${12 + intensity * 35}, 0.95)`;
          break;
        case 'neon':
          baseStrokeStyle = '#14203e';
          activeColor = '#00f0ff';
          break;
          
        // 💡 [신설 및 수리 완료]: 관제탑 Color Style Palette에서 'neon_random' 피킹 시 작동할 올랜덤 테두리 매핑
        case 'neon_random':
          const targetHue = (this.randomHues[i] + seed) % 360;
          // 비활성 베이스 테두리선도 고유 어두운 톤의 네온 컬러로 분배
          baseStrokeStyle = `hsla(${targetHue}, 85%, 25%, 0.7)`;
          // 소리가 유입되어 활성화될 때 분출될 청명한 고유 네온 컬러 매핑
          activeColor = `hsla(${targetHue}, 100%, 55%, 1)`;
          break;
          
        case 'custom':
          baseStrokeStyle = '#261b15';
          activeColor = globalSettings.customColors?.star || '#ff0055';
          break;
        case 'vintage_noise':
          baseStrokeStyle = '#475569';
          activeColor = '#fbbf24';
          fillBaseColor = 'rgba(26, 31, 44, 0.92)';
          break;
      }

      this.ctx.save();

      // 버튼 하우징 베이스 드로우
      this.ctx.fillStyle = fillBaseColor;
      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.fill();

      // 4대 지능형 프레스 인터랙션 구동층 (외곽선 고정형 내부 확산 연산)
      if (pressModeType === 0) {
        // [모드 0]: 안쪽으로 스며들며 번지는 블러 광학식 레이저 효과
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
        // [모드 1]: 내부 전체를 외부 활성 컬러 음압 비율로 가득 밀어 채우기
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
        // [모드 2]: 유입 볼륨 수치에 따른 정밀 흑백/컬러 명암 대비 계측 레이어
        const brightnessValue = Math.floor(intensity * 120);
        this.ctx.fillStyle = `rgba(${brightnessValue}, ${brightnessValue + 15}, ${brightnessValue + 35}, 0.7)`;
        this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
        this.ctx.fill();
      } 
      else if (pressModeType === 3) {
        // [모드 3]: 중앙 배치 악기 글리프 센터 라이팅 투사
        this.ctx.strokeStyle = activeColor;
        this.ctx.globalAlpha = 0.2 + intensity * 0.8;
        this.drawInstrumentGlyph(this.ctx, centerX, centerY, Math.min(btnW, btnH), i, intensity);
      }

      // 오래된 아날로그 노이즈 오버레이 표면 텍스처 인젝션
      if (colorStyle === 'vintage_noise') {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        const noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
        this.ctx.fillStyle = noisePattern;
        this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
        this.ctx.fill();
        this.ctx.restore();
      }

      // 💡 [최종 테두리 렌더 마감]: 32채널 고정 와이어프레임 타격 (올랜덤 색상 완벽 투사)
      this.ctx.strokeStyle = intensity > 0.08 ? activeColor : baseStrokeStyle;
      this.ctx.lineWidth = intensity > 0.08 ? 1.5 + intensity * 2 : 1.0;
      
      if (intensity > 0.08 && colorStyle !== 'bw') {
        this.ctx.shadowBlur = intensity * 12;
        this.ctx.shadowColor = activeColor;
      }

      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.stroke();

      this.ctx.restore();
    }

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `32 Matrix Console [Shuffle Mode: ${pressModeType}]`,
      isCovering: true,
      activeFunction: `Matrix[Aspect_Sync_V2.3]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) { this.container.removeChild(this.canvas); }
    this.ctx = null; this.canvas = null;
  }
}
