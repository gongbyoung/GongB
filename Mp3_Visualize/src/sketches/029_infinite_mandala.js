/**
 * src/sketches/029_infinite_mandala.js
 * - [테두리 제거 & Shuffle 그라디언트 연동 Ver 5.2]
 * - 거미줄처럼 보이던 모든 외곽선(Stroke)을 제거하여 깔끔하고 고급스러운 꽃잎 렌더링
 * - 🔀 Shuffle (Seed): 난수 생성뿐만 아니라 '그라디언트로 색이 칠해지는 정도'를 실시간 제어
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
    this.version = "029호 노라인 그라디언트 만다라 Ver 5.2";
    this.rings = []; 
    this.spawnIndex = 0;
  }

  init() { this.resize(); }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  getPalette(style, customColors) {
    const s = (style || 'neon').toLowerCase();
    if (s === 'pastel') return { bg: '#1e1b2e', c1: '#c084fc', c2: '#67e8f9', c3: '#f472b6', glow: '#fbcfe8' };
    if (s === 'earth') return { bg: '#0b131f', c1: '#1d4ed8', c2: '#eab308', c3: '#b45309', glow: '#93c5fd' };
    if (s === 'monochrome') return { bg: '#09090b', c1: '#ffffff', c2: '#a1a1aa', c3: '#3f3f46', glow: '#e4e4e7' };
    if (s === 'custom') return { bg: '#050508', c1: customColors.gas1, c2: customColors.gas2, c3: customColors.star, glow: customColors.gas1 };
    return { bg: '#050508', c1: '#00f0ff', c2: '#ff007f', c3: '#7000ff', glow: '#00ffff' };
  }

  pseudoRandom(seed, index) {
    let x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  // 💡 공통 그라디언트 생성 함수 (Shuffle 슬라이더의 fillDegree 값을 받아 색칠 범위를 정함)
  createGradientFill(ctx, color, yStart, yEnd, fillDegree) {
    let grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
    let stop = Math.max(0.01, Math.min(fillDegree, 1.0));
    grad.addColorStop(0, color);
    grad.addColorStop(stop, 'rgba(0,0,0,0)'); // 지정된 정도까지만 색을 칠하고 끝은 투명하게 번짐
    return grad;
  }

  // 💠 [고퀄리티 쉐이프 1]: 정교한 연꽃잎
  drawLotusPetal(ctx, color, palette, thickness, fillDegree) {
    ctx.fillStyle = this.createGradientFill(ctx, color, 0, -60, fillDegree);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(15 * thickness, -20, 20 * thickness, -40, 0, -60);
    ctx.bezierCurveTo(-20 * thickness, -40, -15 * thickness, -20, 0, 0);
    ctx.fill();

    // 테두리(Stroke) 제거 완료, 대신 속을 파스텔/글로우 톤으로 살짝 채워 디테일 향상
    ctx.fillStyle = palette.glow;
    ctx.globalAlpha = 0.3 * fillDegree;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(8 * thickness, -20, 10 * thickness, -35, 0, -50);
    ctx.bezierCurveTo(-10 * thickness, -35, -8 * thickness, -20, 0, -5);
    ctx.fill();
  }

  // 💠 [고퀄리티 쉐이프 2]: 구멍 뚫린 레이스 띠
  drawLaceBand(ctx, color, palette, symmetry, fillDegree) {
    let w = (Math.PI * 300) / symmetry;
    ctx.fillStyle = this.createGradientFill(ctx, color, 30, -20, fillDegree);

    ctx.beginPath();
    ctx.moveTo(-w/2, 0);
    ctx.quadraticCurveTo(0, -20, w/2, 0);
    ctx.quadraticCurveTo(w/2 + 10, 15, w/2, 30);
    ctx.quadraticCurveTo(0, 10, -w/2, 30);
    ctx.quadraticCurveTo(-w/2 - 10, 15, -w/2, 0);
    
    ctx.moveTo(5, 15); ctx.arc(0, 15, 6, 0, Math.PI*2, true);
    ctx.moveTo(-w/4 + 4, 5); ctx.arc(-w/4, 5, 4, 0, Math.PI*2, true);
    ctx.moveTo(w/4 + 4, 5); ctx.arc(w/4, 5, 4, 0, Math.PI*2, true);
    ctx.fill(); 
  }

  // 💠 [고퀄리티 쉐이프 3]: 둥글고 넓은 겹꽃잎
  drawRoundPetal(ctx, color, palette, thickness, fillDegree) {
    ctx.fillStyle = this.createGradientFill(ctx, color, 30, -40, fillDegree);
    ctx.beginPath();
    ctx.arc(0, -20, 20 * thickness, 0, Math.PI, true);
    ctx.bezierCurveTo(20 * thickness, 10, 10 * thickness, 20, 0, 30);
    ctx.bezierCurveTo(-10 * thickness, 20, -20 * thickness, 10, -20 * thickness, -20);
    ctx.fill();

    ctx.fillStyle = palette.bg;
    ctx.beginPath(); ctx.arc(0, -32, 4, 0, Math.PI*2); ctx.fill();
  }

  // 💠 [고퀄리티 쉐이프 4]: 기하학 다이아몬드/보석
  drawDiamond(ctx, color, palette, thickness, fillDegree) {
    ctx.fillStyle = this.createGradientFill(ctx, color, 10, -45, fillDegree);
    ctx.beginPath();
    ctx.moveTo(0, -45); ctx.lineTo(15 * thickness, -15);
    ctx.lineTo(0, 10); ctx.lineTo(-15 * thickness, -15);
    ctx.closePath(); 
    ctx.fill(); 
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    const customColors = settings.customColors || { gas1: '#00f0ff', gas2: '#ff007f', star: '#ffffff' };
    
    const bass = audioData && audioData.bass ? audioData.bass : 0;
    const mid = audioData && audioData.mid ? audioData.mid : 0;
    const treble = audioData && audioData.treble ? audioData.treble : 0;
    
    const seedVal = settings.seed ?? 42;                             
    const scatterVal = settings.scatterExponent ?? 2.2;              
    const glowVal = settings.glowIntensity ?? 0.85;                  
    const gainVal = settings.audioGain ?? 1.0;                       
    const gaugeVal = settings.gaugeValue ?? 0.5;                     

    // 💡 [핵심 추가]: Shuffle 슬라이더 값(1~500)을 0.05 ~ 1.0 비율로 변환하여 '색을 칠하는 정도'로 사용
    const fillDegree = Math.max(0.05, seedVal / 500);

    const colorStyle = settings.colorStyle || 'neon';
    const palette = this.getPalette(colorStyle, customColors);

    this.time += 0.01;

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
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;
    const maxRadius = Math.max(renderW, renderH) * 1.5;

    if (window.currentUploadedImageElement) {
      this.ctx.drawImage(window.currentUploadedImageElement, renderX, renderY, renderW, renderH);
      this.ctx.fillStyle = `rgba(0, 0, 0, 0.7)`; 
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    } else {
      this.ctx.fillStyle = palette.bg;
      this.ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    let spacingThresh = 15 + (scatterVal * 8); 

    if (this.rings.length === 0 || this.rings[this.rings.length - 1].radius > spacingThresh) {
      this.spawnIndex++;
      let shapeRand = this.pseudoRandom(seedVal, this.spawnIndex);
      let bandRand = this.pseudoRandom(seedVal + 1, this.spawnIndex);
      
      this.rings.push({
        radius: 1, 
        type: Math.floor(shapeRand * 4), 
        symmetry: [6, 8, 12, 16][Math.floor(this.pseudoRandom(seedVal + 2, this.spawnIndex) * 4)],
        colorKey: ['c1', 'c2', 'c3', 'glow'][Math.floor(this.pseudoRandom(seedVal + 3, this.spawnIndex) * 4)],
        rotSpd: (this.pseudoRandom(seedVal + 4, this.spawnIndex) < 0.5 ? 1 : -1) * (0.002 + shapeRand * 0.005),
        angle: this.pseudoRandom(seedVal + 5, this.spawnIndex) * Math.PI,
        thickness: this.pseudoRandom(seedVal + 6, this.spawnIndex) * 0.5 + 0.6,
        audioBand: Math.floor(bandRand * 3) 
      });
    }

    const globalScale = Math.max(0.3, glowVal * 1.4);

    for(let i = 0; i < this.rings.length; i++) {
      let r = this.rings[i];
      let myBandVol = r.audioBand === 0 ? bass : (r.audioBand === 1 ? mid : treble);
      let reaction = myBandVol * gaugeVal * 5.0; 

      r.radius += (1.0 + gainVal * 3.0) + (reaction * 3.0); 
      r.angle += r.rotSpd * (1 + reaction);

      if (r.radius * globalScale > maxRadius) {
        this.rings.splice(i, 1);
        i--; continue;
      }

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(r.angle);

      let color = palette[r.colorKey] || palette.c1;
      
      let alpha = 1.0;
      if (r.radius < 30) alpha = r.radius / 30;
      else if (r.radius * globalScale > maxRadius - 200) alpha = (maxRadius - r.radius * globalScale) / 200;
      this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      for(let s = 0; s < r.symmetry; s++) {
        this.ctx.save();
        this.ctx.rotate((s / r.symmetry) * Math.PI * 2);
        
        this.ctx.translate(0, -r.radius * globalScale);
        let scale = (r.radius / 100) * globalScale;
        scale *= (1.0 + reaction * 0.4); 
        this.ctx.scale(scale, scale);

        // 도형 렌더링 시 fillDegree(Shuffle 값)를 전달하여 색칠 범위를 결정!
        if (r.type === 0) this.drawLotusPetal(this.ctx, color, palette, r.thickness, fillDegree);
        else if (r.type === 1) this.drawLaceBand(this.ctx, color, palette, r.symmetry, fillDegree);
        else if (r.type === 2) this.drawRoundPetal(this.ctx, color, palette, r.thickness, fillDegree);
        else this.drawDiamond(this.ctx, color, palette, r.thickness, fillDegree);

        this.ctx.restore();
      }
      this.ctx.restore();
    }

    const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40 + bass * 80 * gaugeVal);
    coreGrad.addColorStop(0, palette.glow);
    coreGrad.addColorStop(0.3, palette.c1);
    coreGrad.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = coreGrad;
    this.ctx.globalAlpha = 0.8 + bass * 0.2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 80 + bass * 60 * gaugeVal, 0, Math.PI * 2);
    this.ctx.fill();

    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (bass * 0.05 * gaugeVal));
      
      const rawFont = window.cosmicEngineSettings?.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
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
      activeFunction: `Mandala[Grad:${fillDegree.toFixed(2)}]`
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