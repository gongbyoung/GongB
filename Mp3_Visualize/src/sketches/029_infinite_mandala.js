/**
 * src/sketches/029_infinite_mandala.js
 * - [029호 무한 확장 만다라 & 5대 화풍 테마 시뮬레이터]
 * - 화면 중앙으로부터 겹겹이 회전하며 무한히 팽창하는 기하학적 장미창 만다라
 * - 바로크, 르네상스, 인상파, 야수파, 무채색 화풍별 색상 및 재질 질감 실시간 전환
 */
/**
 * src/sketches/029_infinite_mandala.js
 * - [거미줄 현상 완치] 선 긋기가 아닌 진짜 꽃잎/물방울 기하학 도형 기반의 웅장한 만다라
 * - 업로드된 이미지 배경 연동 및 5대 화풍 색감 완벽 적용
 */
/**
 * src/sketches/029_infinite_mandala.js
 * - [리얼 만다라 & 만화경 줌인 엔진 Ver 4.0]
 * - 단순 선긋기가 아닌 정교하게 디자인된 4종의 고퀄리티 쉐이프(연꽃잎, 레이스 띠, 둥근꽃잎, 다이아몬드)
 * - 중앙에서부터 무한히 생성되며 화면 밖으로 퍼져나가는 만화경(Kaleidoscope) 효과 적용
 * - 배경 이미지 업로드 완벽 연동 및 16:9 / 9:16 비율 강제 레터박스 엔진 탑재
 */

export default class InfiniteMandalaSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "029호 정밀 만화경 만다라 Ver 4.0";
    this.rings = []; // 화면 중앙에서 뿜어져 나오는 만다라 띠 배열
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // 🎨 5대 화풍 색상 팔레트
  getPalette(style) {
    const s = (style || 'neon').toLowerCase();
    if (s.includes('baroque')) return { bg: '#080402', c1: '#d4af37', c2: '#8b0000', c3: '#5e1b00', glow: '#ffd700' };
    else if (s.includes('renaissance')) return { bg: '#0b131f', c1: '#1d4ed8', c2: '#eab308', c3: '#b45309', glow: '#93c5fd' };
    else if (s.includes('impressionism')) return { bg: '#1e1b2e', c1: '#c084fc', c2: '#67e8f9', c3: '#f472b6', glow: '#fbcfe8' };
    else if (s.includes('fauvism')) return { bg: '#111827', c1: '#ef4444', c2: '#10b981', c3: '#f59e0b', glow: '#ec4899' };
    else if (s.includes('monochrome')) return { bg: '#09090b', c1: '#ffffff', c2: '#a1a1aa', c3: '#3f3f46', glow: '#e4e4e7' };
    else return { bg: '#050508', c1: '#00f0ff', c2: '#ff007f', c3: '#7000ff', glow: '#00ffff' };
  }

  // 💠 [고퀄리티 쉐이프 1]: 정교한 연꽃잎 (레이어드)
  drawLotusPetal(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(15 * thickness, -20, 20 * thickness, -40, 0, -60);
    ctx.bezierCurveTo(-20 * thickness, -40, -15 * thickness, -20, 0, 0);
    ctx.fill();
    ctx.stroke();

    // 꽃잎 내부 디테일(수술/결)
    ctx.fillStyle = palette.bg;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(8 * thickness, -20, 10 * thickness, -35, 0, -50);
    ctx.bezierCurveTo(-10 * thickness, -35, -8 * thickness, -20, 0, -5);
    ctx.fill();
  }

  // 💠 [고퀄리티 쉐이프 2]: 구멍 뚫린 레이스 띠 (컴파운드 패스 적용)
  drawLaceBand(ctx, color, palette, symmetry) {
    let w = (Math.PI * 300) / symmetry; // 띠의 너비
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // 바깥쪽 곡선
    ctx.moveTo(-w/2, 0);
    ctx.quadraticCurveTo(0, -20, w/2, 0);
    ctx.quadraticCurveTo(w/2 + 10, 15, w/2, 30);
    ctx.quadraticCurveTo(0, 10, -w/2, 30);
    ctx.quadraticCurveTo(-w/2 - 10, 15, -w/2, 0);
    
    // 레이스 구멍 파내기 (반시계 방향)
    ctx.moveTo(5, 15);
    ctx.arc(0, 15, 6, 0, Math.PI*2, true);
    ctx.moveTo(-w/4 + 4, 5);
    ctx.arc(-w/4, 5, 4, 0, Math.PI*2, true);
    ctx.moveTo(w/4 + 4, 5);
    ctx.arc(w/4, 5, 4, 0, Math.PI*2, true);
    
    ctx.fill();
    ctx.stroke();
  }

  // 💠 [고퀄리티 쉐이프 3]: 둥글고 넓은 겹꽃잎
  drawRoundPetal(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.bg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -20, 20 * thickness, 0, Math.PI, true);
    ctx.bezierCurveTo(20 * thickness, 10, 10 * thickness, 20, 0, 30);
    ctx.bezierCurveTo(-10 * thickness, 20, -20 * thickness, 10, -20 * thickness, -20);
    ctx.fill();
    ctx.stroke();

    // 강조점 (Dot)
    ctx.fillStyle = palette.glow;
    ctx.beginPath(); ctx.arc(0, -32, 4, 0, Math.PI*2); ctx.fill();
  }

  // 💠 [고퀄리티 쉐이프 4]: 기하학 다이아몬드 (만화경 코어)
  drawDiamond(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(15 * thickness, -15);
    ctx.lineTo(0, 10);
    ctx.lineTo(-15 * thickness, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 보석 파셋(결) 라인
    ctx.beginPath();
    ctx.moveTo(0, -45); ctx.lineTo(0, 10);
    ctx.moveTo(-15 * thickness, -15); ctx.lineTo(15 * thickness, -15);
    ctx.stroke();
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    const vol = audioData && audioData.vol ? audioData.vol : 0;
    const bass = audioData && audioData.bass ? audioData.bass : 0;
    const gainVal = settings.audioGain ?? 1.0;
    const colorStyle = settings.colorStyle || 'neon';
    const palette = this.getPalette(colorStyle);

    this.time += 0.01 + (bass * 0.02 * gainVal);

    // 📐 [비율 변환 완벽 수리]: 16:9, 9:16 강제 레터박스 엔진
    let exportRatio = settings.exportRatio || 'full';
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    
    if (exportRatio === '16:9') {
      renderH = W * (9/16);
      if (renderH > H) { renderH = H; renderW = H * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    } else if (exportRatio === '9:16') {
      renderW = H * (9/16);
      if (renderW > W) { renderW = W; renderH = W * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    }

    this.ctx.save();
    // 캔버스 전체 초기화 후 레터박스 영역만 클리핑
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);
    
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;
    const maxRadius = Math.max(renderW, renderH) * 0.8;

    // 1. 유저 업로드 배경 이미지 렌더링
    if (window.currentUploadedImageElement) {
      this.ctx.drawImage(window.currentUploadedImageElement, renderX, renderY, renderW, renderH);
      this.ctx.fillStyle = `rgba(0, 0, 0, 0.75)`; // 만다라가 돋보이게 살짝 톤다운
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    } else {
      this.ctx.fillStyle = palette.bg;
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    // 2. 만화경(Kaleidoscope) 만다라 링 스폰 로직
    // 맨 마지막 링이 일정 크기 이상 커지면 중앙에서 새로운 링을 발사
    if (this.rings.length === 0 || this.rings[this.rings.length - 1].radius > 35) {
      this.rings.push({
        radius: 1, 
        type: Math.floor(Math.random() * 4), // 0:Lotus, 1:Lace, 2:Round, 3:Diamond
        symmetry: [8, 12, 16, 24][Math.floor(Math.random() * 4)],
        colorKey: ['c1', 'c2', 'c3', 'glow'][Math.floor(Math.random() * 4)],
        rotSpd: (Math.random() < 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.005),
        angle: Math.random() * Math.PI,
        thickness: Math.random() * 0.5 + 0.7 
      });
    }

    // 3. 만다라 링들 업데이트 및 렌더링 (줌인 효과)
    for(let i = 0; i < this.rings.length; i++) {
      let r = this.rings[i];
      // 베이스의 타격감에 맞춰 밖으로 빠르게 퍼져나감
      r.radius += (1.5 + bass * 8.0) * gainVal; 
      r.angle += r.rotSpd * (1 + vol * 3.0);

      // 화면 밖으로 나간 링은 제거하여 최적화 유지
      if (r.radius > maxRadius) {
        this.rings.splice(i, 1);
        i--;
        continue;
      }

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(r.angle);

      let color = palette[r.colorKey] || palette.c1;
      
      // 스케일과 투명도 조절 (멀리 갈수록 거대해지며 서서히 사라짐)
      let alpha = 1.0;
      if (r.radius < 40) alpha = r.radius / 40;
      else if (r.radius > maxRadius - 150) alpha = (maxRadius - r.radius) / 150;
      this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      for(let s = 0; s < r.symmetry; s++) {
        this.ctx.save();
        this.ctx.rotate((s / r.symmetry) * Math.PI * 2);
        
        // 링 반경만큼 밖으로 이동 후 크기 확대 (핵심 만화경 로직)
        this.ctx.translate(0, -r.radius);
        let scale = r.radius / 120; // 밖으로 갈수록 도형이 거대해짐
        this.ctx.scale(scale, scale);

        // 정교한 도형 렌더링
        if (r.type === 0) this.drawLotusPetal(this.ctx, color, palette, r.thickness);
        else if (r.type === 1) this.drawLaceBand(this.ctx, color, palette, r.symmetry);
        else if (r.type === 2) this.drawRoundPetal(this.ctx, color, palette, r.thickness);
        else this.drawDiamond(this.ctx, color, palette, r.thickness);

        this.ctx.restore();
      }
      this.ctx.restore();
    }

    // 4. 중앙 코어 빛망울
    const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40 + bass * 60);
    coreGrad.addColorStop(0, palette.glow);
    coreGrad.addColorStop(0.3, palette.c1);
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = coreGrad;
    this.ctx.globalAlpha = 0.8 + bass * 0.2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 60 + bass * 40, 0, Math.PI * 2);
    this.ctx.fill();

    // 5. 최상단 SRT 캘리그래피 자막 렌더링 (가독성 보장)
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05));
      const selectedFont = window.cosmicEngineSettings?.fontFamily || "'Noto Sans KR', sans-serif";

      this.ctx.font = `bold ${fontSize}px ${selectedFont}, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 18;
        this.ctx.fillStyle = "#faf6ed";
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Rings: ${this.rings.length}`,
      isCovering: true,
      activeFunction: `Kaleidoscope[${exportRatio}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.rings = [];
  }
}
