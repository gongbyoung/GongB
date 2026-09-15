/**
 * src/sketches/029_infinite_mandala.js
 * - [UI 완벽 연동 및 3-Band 주파수 리액티브 만다라 Ver 5.0]
 * - 🔀 Shuffle (Seed): 시드를 변경하면 쉐이프 조합/순서/색상이 완전히 새로 섞임
 * - 📏 Range (Scatter): 만다라 겹(Ring)이 생성되는 총 갯수(밀도) 조절
 * - 🔍 Scale (Glow): 만다라 전체의 거대한 스케일 조절
 * - 🔊 Volume (Gain): 바깥으로 팽창하며 퍼져나가는 기본 속도 조절
 * - 🎛️ Gauge: 음악 주파수(Bass, Mid, Treble)에 반응하여 진동하는 정도를 조절
 */
/**
 * src/sketches/029_infinite_mandala.js
 * - [UI 완벽 연동 및 3-Band 주파수 리액티브 만다라 Ver 5.1]
 * - 🔤 커스텀 TTF/OTF 폰트 및 16:9/9:16 레터박스 동시 완벽 적용
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
    this.version = "029호 UI 연동 3-Band 만다라 Ver 5.1";
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

  drawLotusPetal(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(15 * thickness, -20, 20 * thickness, -40, 0, -60);
    ctx.bezierCurveTo(-20 * thickness, -40, -15 * thickness, -20, 0, 0);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = palette.bg;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(8 * thickness, -20, 10 * thickness, -35, 0, -50);
    ctx.bezierCurveTo(-10 * thickness, -35, -8 * thickness, -20, 0, -5);
    ctx.fill();
  }

  drawLaceBand(ctx, color, palette, symmetry) {
    let w = (Math.PI * 300) / symmetry;
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.bg;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(-w/2, 0);
    ctx.quadraticCurveTo(0, -20, w/2, 0);
    ctx.quadraticCurveTo(w/2 + 10, 15, w/2, 30);
    ctx.quadraticCurveTo(0, 10, -w/2, 30);
    ctx.quadraticCurveTo(-w/2 - 10, 15, -w/2, 0);
    
    ctx.moveTo(5, 15); ctx.arc(0, 15, 6, 0, Math.PI*2, true);
    ctx.moveTo(-w/4 + 4, 5); ctx.arc(-w/4, 5, 4, 0, Math.PI*2, true);
    ctx.moveTo(w/4 + 4, 5); ctx.arc(w/4, 5, 4, 0, Math.PI*2, true);
    
    ctx.fill(); ctx.stroke();
  }

  drawRoundPetal(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -20, 20 * thickness, 0, Math.PI, true);
    ctx.bezierCurveTo(20 * thickness, 10, 10 * thickness, 20, 0, 30);
    ctx.bezierCurveTo(-10 * thickness, 20, -20 * thickness, 10, -20 * thickness, -20);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = palette.bg;
    ctx.beginPath(); ctx.arc(0, -32, 4, 0, Math.PI*2); ctx.fill();
  }

  drawDiamond(ctx, color, palette, thickness) {
    ctx.fillStyle = color;
    ctx.strokeStyle = palette.bg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -45); ctx.lineTo(15 * thickness, -15);
    ctx.lineTo(0, 10); ctx.lineTo(-15 * thickness, -15);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = palette.glow;
    ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(0, 10);
    ctx.moveTo(-15 * thickness, -15); ctx.lineTo(15 * thickness, -15);
    ctx.stroke();
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

        if (r.type === 0) this.drawLotusPetal(this.ctx, color, palette, r.thickness);
        else if (r.type === 1) this.drawLaceBand(this.ctx, color, palette, r.symmetry);
        else if (r.type === 2) this.drawRoundPetal(this.ctx, color, palette, r.thickness);
        else this.drawDiamond(this.ctx, color, palette, r.thickness);

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

    // 🔤 [수리 완료]: 폰트 이름의 따옴표를 완전히 제거하고 캔버스에 깔끔하게 주입
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (bass * 0.05 * gaugeVal));
      
      const rawFont = window.cosmicEngineSettings?.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); // 불필요한 따옴표 완벽 제거
      
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
      activeFunction: `Mandala[Ratio:${exportRatio}]`
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
