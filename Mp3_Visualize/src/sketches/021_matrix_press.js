/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 2.0 고정 와이어프레임 내부 확산형 매트릭스 콘솔
 * - 화면비 사양: 캔버스 물리 치수 기반 완전 반응형 격자 매핑 (여백/왜곡 완전 제거)
 * - 비주얼 메커니즘: 외곽선 고정, 내부 번짐 블러, 외부색 채우기, 명암 대비 연산, 악기 글리프 센터 라이팅 통합
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
    this.version = "021호 Matrix Press Ver 2.0";

    // 올랜덤 네온 고유 색상 고정을 위한 씨드 배열
    this.randomHues = Array.from({ length: 32 }, () => Math.floor(Math.random() * 360));
    
    // 빈티지 노이즈 질감 처리를 위한 사전 오프라인 캐시 노이즈 버퍼 생성
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = 128;
    this.noiseCanvas.height = 128;
    const nCtx = this.noiseCanvas.getContext('2d');
    const nImg = nCtx.createImageData(128, 128);
    for (let i = 0; i < nImg.data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      nImg.data[i] = val; nImg.data[i+1] = val; nImg.data[i+2] = val; nImg.data[i+3] = 22; // 미세 투명 노이즈
    }
    nCtx.putImageData(nImg, 0, 0);
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    // 💡 [화면비 무결 수리]: 전달받은 마스터 캔버스 창의 물리적 스케일을 유실 없이 직결 동화
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

  /**
   * 💡 32단 채널별 고유 악기 추상 픽토그램 그래픽 드로우 유틸리티
   */
  drawInstrumentGlyph(ctx, cx, cy, size, type, intensity) {
    ctx.save();
    ctx.lineWidth = 1.5 + intensity * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const r = size * 0.4;
    switch(type % 4) {
      case 0: // 🥁 저음/킥 드럼 팩터 형상
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.moveTo(cx - r, cy - r * 0.3); ctx.lineTo(cx + r, cy - r * 0.3);
        ctx.moveTo(cx - r * 0.7, cy + r * 0.4); ctx.lineTo(cx - r * 0.2, cy - r * 0.3);
        ctx.moveTo(cx + r * 0.7, cy + r * 0.4); ctx.lineTo(cx + r * 0.2, cy - r * 0.3);
        ctx.stroke();
        break;
      case 1: // 〰️ 중음/보컬 주파수 사인 웨이브 형상
        ctx.beginPath();
        for (let x = -r; x <= r; x += 2) {
          let y = Math.sin(x * 0.2 + Date.now() * 0.01) * r * 0.5;
          if (x === -r) ctx.moveTo(cx + x, cy + y);
          else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke();
        break;
      case 2: // 🎹 건반/멜로디 기하학 매트릭스 형상
        ctx.strokeRect(cx - r, cy - r * 0.5, r * 2, r);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.3, cy - r * 0.5); ctx.lineTo(cx - r * 0.3, cy + r * 0.1);
        ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.1);
        ctx.moveTo(cx + r * 0.3, cy - r * 0.5); ctx.lineTo(cx + r * 0.3, cy + r * 0.1);
        ctx.stroke();
        break;
      case 3: // 🔔 고음/하이햇 심벌즈 트라이앵글 형상
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy + r * 0.8);
        ctx.lineTo(cx - r, cy + r * 0.8);
        ctx.closePath();
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  update(audioData) {
    if (!this.ctx) return;

    // 1. 관제탑 전역 설정 상태소 필터 인터셉트
    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;
    const seed = globalSettings.seed ?? 42; 
    const colorStyle = globalSettings.colorStyle || 'neon'; // bw, neon, custom 등

    // 2. 화면 종횡비 자동 검출에 따른 가로/세로 매트릭스 격자 스위칭 (공백 차단 보정축)
    const isWide = this.width > this.height;
    const cols = isWide ? 8 : 4;
    const rows = isWide ? 4 : 8;

    const cellW = this.width / cols;
    const cellH = this.height / rows;

    this.ctx.fillStyle = '#05070e';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 💡 [SHUFFLE 인터커넥트 해독기]: 관제탑 씨드 수치를 연산하여 4개 물리 프레스 모드를 랜덤 조합 분배
    // 씨드 값의 수학적 나머지에 따라 메인 효과 가중치 전환
    const pressModeType = seed % 4; 

    // 3. 32채널 정방향 전사 렌더링 벨트 기동
    for (let i = 0; i < 32; i++) {
      const colIdx = i % cols;
      const rowIdx = Math.floor(i / cols);

      const startX = colIdx * cellW;
      const startY = rowIdx * cellH;

      // 32채널 데이터 정밀 파싱
      let rawFreq = 0;
      if (audioData && audioData.customBands && audioData.customBands[i] !== undefined) {
        rawFreq = audioData.customBands[i];
      } else if (audioData && audioData.raw && audioData.raw.length > 0) {
        const sampleIdx = Math.floor((i / 32) * audioData.raw.length);
        rawFreq = (audioData.raw[sampleIdx] || 0) / 255.0;
      }

      // 평활 모션 댐핑 가동
      const targetValue = rawFreq * gainScale;
      this.smoothedValues[i] += (targetValue - this.smoothedValues[i]) * 0.28;
      const intensity = this.smoothedValues[i];

      // 💡 [외곽선 고정 설계]: 바깥 테두리 영역은 무조건 고정
      const margin = 4;
      const btnX = startX + margin;
      const btnY = startY + margin;
      const btnW = cellW - margin * 2;
      const btnH = cellH - margin * 2;
      const centerX = btnX + btnW / 2;
      const centerY = btnY + btnH / 2;
      const cornerRadius = Math.min(btnW, btnH) * 0.12;

      // 4. 테마 컬러 스타일 수식 분기 라인
      let baseStrokeStyle = '#1e293b';
      let activeColor = '#00ffcc';
      let fillBaseColor = 'rgba(12, 18, 36, 0.86)';

      switch(colorStyle) {
        case 'bw': // 🖤 흑백 스타일 라인
          baseStrokeStyle = '#334155';
          activeColor = `rgb(${200 + intensity * 55}, ${200 + intensity * 55}, ${200 + intensity * 55})`;
          fillBaseColor = `rgba(${15 + intensity * 40}, ${15 + intensity * 40}, ${15 + intensity * 40}, 0.95)`;
          break;
        case 'neon': // 💎 정규 사이안 네온 라인
          baseStrokeStyle = '#16223f';
          activeColor = '#00f0ff';
          break;
        case 'neon_random': // 🌈 올랜덤 개별 고유 네온 무드 라인
          baseStrokeStyle = '#1f1635';
          activeColor = `hsla(${(this.randomHues[i] + seed) % 360}, 100%, 60%, 1)`;
          break;
        case 'custom': // 🎨 사용자 커스텀 컬러 노브 매핑 연동
          baseStrokeStyle = '#231c18';
          activeColor = globalSettings.customColors?.star || '#ffff00';
          break;
        case 'vintage_noise': // 🎚️ 아날로그 텍스처 노이즈 라인
          baseStrokeStyle = '#475569';
          activeColor = '#fbbf24';
          fillBaseColor = 'rgba(28, 33, 46, 0.9)';
          break;
      }

      this.ctx.save();

      // 기본 베이스 버튼 바닥 도포
      this.ctx.fillStyle = fillBaseColor;
      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.fill();

      // 5. 💡 [요구사항 핵심]: 외곽선은 그대로 고정하고 안쪽 가변 프레스 효과 표현 분기
      
      // [옵션 A]: 안쪽으로 번지듯이 블러 형태로 라이팅이 수축/번지는 연출
      if (pressModeType === 0) {
        if (intensity > 0.01) {
          const innerGlow = this.ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, Math.max(btnW, btnH) * 0.45 * intensity);
          innerGlow.addColorStop(0, activeColor);
          innerGlow.addColorStop(0.6, activeColor.replace('1)', '0.3)').replace(')', ', 0.3)'));
          innerGlow.addColorStop(1, 'rgba(0,0,0,0)');
          
          this.ctx.fillStyle = innerGlow;
          this.drawRoundedRect(this.ctx, btnX + 2, btnY + 2, btnW - 4, btnH - 4, cornerRadius);
          this.ctx.fill();
        }
      } 
      // [옵션 B]: 내부 전체를 외부 활성 컬러로 농밀하게 밀어 채우기
      else if (pressModeType === 1) {
        if (intensity > 0.01) {
          this.ctx.save();
          this.ctx.globalAlpha = intensity * 0.85;
          this.ctx.fillStyle = activeColor;
          this.drawRoundedRect(this.ctx, btnX + 2, btnY + 2, btnW - 4, btnH - 4, cornerRadius);
          this.ctx.fill();
          this.ctx.restore();
        }
      } 
      // [옵션 C]: 볼륨의 연산 수치 대역폭에 따라 100% 명암 대비 콘트라스트 매핑
      else if (pressModeType === 2) {
        const shadeValue = Math.floor(intensity * 130);
        this.ctx.fillStyle = `rgba(${ shadeValue }, ${ shadeValue + 20 }, ${ shadeValue + 40 }, 0.65)`;
        this.drawRoundedRect(this.ctx, btnX + 1, btnY + 1, btnW - 2, btnH - 2, cornerRadius);
        this.ctx.fill();
      } 
      // [옵션 D]: 중앙에 세팅된 소리 채널별 악기 아이콘 글리프 활성화 광역 투사
      else if (pressModeType === 3) {
        this.ctx.strokeStyle = activeColor;
        this.ctx.globalAlpha = 0.15 + intensity * 0.85;
        this.drawInstrumentGlyph(this.ctx, centerX, centerY, Math.min(btnW, btnH), i, intensity);
      }

      // 6. [오래된 오래된 아날로그 노이즈 질감 패치 옵션 결합]
      if (colorStyle === 'vintage_noise') {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        // 오프라인 노이즈 캔버스를 반복 패턴 형태로 표면에 전사 마운트
        const noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
        this.ctx.fillStyle = noisePattern;
        this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
        this.ctx.fill();
        this.ctx.restore();
      }

      // 7. 파이널 링 외곽선 처리 (고정 와이어프레임 타격)
      this.ctx.strokeStyle = intensity > 0.1 ? activeColor : baseStrokeStyle;
      this.ctx.lineWidth = intensity > 0.1 ? 1.5 + intensity * 2 : 1.0;
      
      if (intensity > 0.1 && colorStyle !== 'bw') {
        this.ctx.shadowBlur = intensity * 12;
        this.ctx.shadowColor = activeColor;
      }

      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.stroke();

      this.ctx.restore();
    }

    // 엔진 실시간 관제 연동 정보 적재
    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Grid Matrix [Mode Seed: ${pressModeType}]`,
      isCovering: true,
      activeFunction: `Matrix[FixedBounds_AutoAspect]`
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
