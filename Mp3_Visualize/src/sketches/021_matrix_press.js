/**
 * src/sketches/021_matrix_press.js
 * - [버전] Ver 1.0 가변형 32채널 프레스 매트릭스 콘솔
 * - 레이아웃 사양: 16:9 및 9:16 화면비 자동 감지 및 빈틈없는 스케일 매핑 (8x4 / 4x8 동적 스위칭)
 * - 비주얼 메커니즘: 주파수 에너지 강도에 비례한 3D 버튼 프레스(눌림) 깊이 연산 및 네온 그라데이션 광도 매핑
 */

export default class MatrixPressSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    
    // 이전 프레임의 압착 강도를 유지하여 부드러운 유기적 모션을 만드는 감쇠 배열
    this.smoothedValues = new Array(32).fill(0);
    this.version = "021호 Matrix Press Ver 1.0";
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

  /**
   * 캔버스 내부에 라운드 사각형(버튼) 경로를 그리는 2D 팩토리 유틸리티
   */
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

  update(audioData) {
    if (!this.ctx) return;

    // 1. 화면 픽셀 클리어 및 기본 배경색 지정
    this.ctx.fillStyle = '#04060b';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. 16:9 가로형 vs 9:16 세로형 레이아웃 동적 락인 분기 공식
    const isWide = this.width > this.height;
    const cols = isWide ? 8 : 4;
    const rows = isWide ? 4 : 8;

    // 빈 공간 없이 화면을 가득 채우기 위한 셀 단위 치수 연산
    const cellW = this.width / cols;
    const cellH = this.height / rows;

    // 시스템 전역 설정 컬러 무드 로드 가드라인
    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;

    // 3. 32단 격자 매트릭스 전사 드로우 루프 기동
    for (let i = 0; i < 32; i++) {
      const colIdx = i % cols;
      const rowIdx = Math.floor(i / cols);

      // 격자 중심 좌표 산출
      const startX = colIdx * cellW;
      const startY = rowIdx * cellH;

      // 4. 오디오 워크스테이션에서 넘어오는 32채널 커스텀 가공 주파수 수혈
      let rawFreq = 0;
      if (audioData && audioData.customBands && audioData.customBands[i] !== undefined) {
        rawFreq = audioData.customBands[i];
      } else if (audioData && audioData.raw && audioData.raw.length > 0) {
        // 만약 캘리브레이터 채널이 동기화되지 않았을 경우 원본 배열 분배 우회로 가동
        const sampleIdx = Math.floor((i / 32) * audioData.raw.length);
        rawFreq = (audioData.raw[sampleIdx] || 0) / 255.0;
      }

      // 볼륨 게인 배율 주입 및 모션 스무딩 필터 가동
      const targetValue = rawFreq * gainScale;
      this.smoothedValues[i] += (targetValue - this.smoothedValues[i]) * 0.25;
      const intensity = this.smoothedValues[i];

      // 5. 🛠️ [눌림 효과 핵심]: 진폭 강도에 따른 공간 압착 변환 연산
      // 주파수가 강할수록 버튼 크기가 중심 방향으로 축소(Scale down)되어 아래로 들어간 입체감을 구현합니다.
      const margin = 3; // 기본 버튼 간격 테두리
      const baseW = cellW - margin * 2;
      const baseH = cellH - margin * 2;

      const pressScale = 1.0 - intensity * 0.22; // 최대 22% 압착 심도
      const btnW = baseW * pressScale;
      const btnH = baseH * pressScale;

      // 압착 축소 시 중심점이 어긋나지 않도록 보정 오프셋 계산
      const centerX = startX + cellW / 2;
      const centerY = startY + cellH / 2;
      const btnX = centerX - btnW / 2;
      const btnY = centerY - btnH / 2;

      // 라운드 값 산출 (셀 크기에 비례)
      const cornerRadius = Math.min(btnW, btnH) * 0.18;

      // 6. 콘솔 그래픽 렌더링 스타일링 디자인
      this.ctx.save();

      // 버튼 본체 베이스 컬러 그라데이션 투사 (눌릴수록 내부 그림자 효과 처럼 어두워짐)
      const bodyGrad = this.ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      const darkAlpha = 0.35 + intensity * 0.45; // 눌릴수록 어두운 베일 층 강화
      bodyGrad.addColorStop(0, `rgba(16, 24, 48, 0.9)`);
      bodyGrad.addColorStop(1, `rgba(8, 12, 24, 0.95)`);
      
      this.ctx.fillStyle = bodyGrad;
      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.fill();

      // 7. 네온 에너지 코어 센터 라이팅 (눌릴수록 중심에서 올라오는 코어 서지)
      if (intensity > 0.02) {
        const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, Math.max(btnW, btnH) * 0.5);
        coreGrad.addColorStop(0, `rgba(0, 255, 204, ${intensity * 0.75})`);
        coreGrad.addColorStop(0.4, `rgba(0, 102, 255, ${intensity * 0.3})`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        
        this.ctx.fillStyle = coreGrad;
        this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
        this.ctx.fill();
      }

      // 8. 테두리 외곽 네온 와이어프레임 튜닝 (주파수 강도에 따라 핑크에서 청록으로 색 변이)
      const hue1 = 210 + intensity * 120; // 사이안 블루에서 마젠타 핑크 영역 순환
      this.ctx.strokeStyle = `hsla(${hue1}, 95%, 60%, ${0.25 + intensity * 0.75})`;
      this.ctx.lineWidth = 1.5 + intensity * 2.5; // 강도에 따른 선 두께 확장
      
      // 실시간 발광 글로우 광학 효과 인젝션
      this.ctx.shadowBlur = intensity * 14;
      this.ctx.shadowColor = `hsla(${hue1}, 95%, 60%, 0.8)`;

      this.drawRoundedRect(this.ctx, btnX, btnY, btnW, btnH, cornerRadius);
      this.ctx.stroke();

      this.ctx.restore();
    }

    // 엔진 진단 패널 데이터 송신선 체결
    window.sketchDiagnostics = {
      fps: Math.round(1000 / 16), // 가상 타임 윈도우 기준 프레임
      particleCount: "32 Responsive Buttons",
      isCovering: true,
      activeFunction: "Matrix[3D_Press_Contiguous]"
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
