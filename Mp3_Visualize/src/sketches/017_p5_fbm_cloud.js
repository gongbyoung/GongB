/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [업데이트] Glow & Size (발광/크기) 슬라이더를 카메라 Zoom In / Out 기능으로 매핑
 * - 슬라이더 값이 커질수록 최대 10배까지 멀리서 보는 자잘하고 정밀한 구름(Zoom Out) 연출
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    this.timeX = 0;
    this.timeY = 0;
    this.simulatedProgress = 0;
    this.lastProgress = 0;
    
    this.lastStyle = null;
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        // 줌아웃 시 미세해지는 구름 디테일을 살리기 위해 연산 버퍼 해상도를 살짝 올렸습니다.
        this.cloudImg = p.createImage(Math.floor(p.width / 2.0), Math.floor(p.height / 2.0));
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        if (this.cloudImg) {
          p.image(this.cloudImg, 0, 0, p.width, p.height);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      return {
          scatter: settings.scatterExponent ?? 2.2, 
          glow: settings.glowAmount ?? (settings.size ?? 0.85), // 💡 발광/크기 (기본값 0.85 주변)
          burst: settings.audioGain ?? 1.0, 
          seed: settings.seed ?? 42,
          style: (settings.colorStyle || 'monochrome').toLowerCase()
      };
  }

  // 💡 [줌아웃 탑재] Dynamic 워핑 엔진 좌표계 스케일 조정
  warpNoise(x, y, p, midBump, zoomFactor) {
    // 💡 [핵심] zoomFactor가 커질수록 좌표 간격이 넓어져 구름이 멀리서 보는 것처럼 자잘해집니다.
    let baseFreq = 0.003 * zoomFactor;
    let timeScale = p.millis() * 0.0002;
    
    let ox = p.noise(x * baseFreq + timeScale, y * baseFreq + 100) * (100 * zoomFactor);
    let oy = p.noise(x * baseFreq + 200, y * baseFreq + timeScale + 300) * (100 * zoomFactor);

    let freq2 = 0.001 * zoomFactor;
    let ox2 = p.noise((x + ox) * freq2 + timeScale, (y + oy) * freq2 + 400) * (100 * zoomFactor);
    let oy2 = p.noise((x + ox) * freq2 + 500, (y + oy) * freq2 + timeScale + 600) * (100 * zoomFactor);

    let warpIntensity = (100 + (midBump * 300)) * zoomFactor;
    
    let fbmFreq = 0.005 * zoomFactor;
    return p.noise((x + ox2) * fbmFreq, (y + oy2) * fbmFreq);
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    p.randomSeed(this.currentSettings.seed);
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;
  }

  update(audioData) {
    if (!this.p5Instance || !this.cloudImg) return;
    let p = this.p5Instance;
    const ui = this.getUIParams();

    if (this.lastStyle !== ui.style) {
        this.resetCanvas(p, true);
        this.lastStyle = ui.style;
    }

    let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0.3;
    let mid = audioData ? (audioData.raw[15] + audioData.raw[16]) / 510 : 0.2;
    let high = audioData ? (audioData.raw[55] + audioData.raw[56]) / 510 : 0.1;

    let windSpeed = (0.01 + high * 0.05) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.2;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // 💡 [수정] 발광/크기(ui.glow) 값을 기반으로 최소 0.5배에서 최대 10배까지 줌 팩터 계산
    // 슬라이더 범위(0.1 ~ 2.5 가정)에 대응하여, 값이 커질수록 멀리서 줌아웃된 효과를 만듭니다.
    let zoomFactor = p.map(ui.glow, 0.1, 2.5, 0.5, 10.0);

    // 날씨 컬러 그라데이션 베이스
    let skyColor, cloudColor;
    let colorGlow = p.map(ui.glow, 0.1, 2.5, 0.4, 1.3); // 밝기 계수 보정

    if (ui.style.includes('monochrome')) {
        skyColor = p.color(20 * colorGlow, 30 * colorGlow, 40 * colorGlow);
        cloudColor = p.color(80, 80, 90); 
    } else if (ui.style.includes('neon')) {
        let topH = p.color(10 * colorGlow, 100 * colorGlow, 220 * colorGlow);
        let botH = p.color(100 * colorGlow, 180 * colorGlow, 255 * colorGlow);
        skyColor = p.lerpColor(topH, botH, low);
        cloudColor = p.color(255, 255, 255);
    } else if (ui.style.includes('pastel')) {
        let dawnTop = p.color(50 * colorGlow, 20 * colorGlow, 120 * colorGlow);
        let dawnBot = p.color(255 * colorGlow, 100 * colorGlow, 30 * colorGlow);
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.5);
        cloudColor = p.color(255, 220, 180);
    } else if (ui.style.includes('full-random')) {
        p.randomSeed(low * 1000 + mid * 100 + high * 10);
        skyColor = p.color(p.random(0, 100), p.random(0, 50), p.random(100, 255));
        cloudColor = p.color(p.random(150, 255), p.random(150, 255), p.random(150, 255));
    } else {
        skyColor = p.color(15 * colorGlow, 18 * colorGlow, 25 * colorGlow);
        cloudColor = p.color(0, 230, 255);
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 💡 줌아웃 팩터를 노이즈 엔진에 주입합니다.
        let midBump = mid * 2.0;
        let fbmVal = this.warpNoise(x + this.timeX * 20, y + this.timeY * 20, p, midBump * ui.burst, zoomFactor);

        let densityOffset = p.map(ui.scatter, 5, 50, 0.1, -0.2);
        let cloudThreshold = p.map(mid, 0, 1, 0.45, 0.3) + densityOffset;
        
        let density = Math.max(0, fbmVal - cloudThreshold);
        let cloudIntensity = Math.min(1.0, density * (2.5 / (low + 0.15)));

        let idx = (y * w + x) * 4;
        let finalC = p.lerpColor(skyColor, cloudColor, cloudIntensity);

        this.cloudImg.pixels[idx]     = p.red(finalC);
        this.cloudImg.pixels[idx + 1] = p.green(finalC);
        this.cloudImg.pixels[idx + 2] = p.blue(finalC);
        this.cloudImg.pixels[idx + 3] = 255;
      }
    }
    
    this.cloudImg.updatePixels();
    p.redraw();
  }

  paintBrush(pt, layerNum, ui, p, low, mid, high) {
    if (!this.brushTexture) return;
    let brightnessMod = 1.0 + (ui.glow * 1.5); 
    let detailMod = Math.max(0.3, ui.glow * 2.5); 
    let r = Math.min(255, pt.r * brightnessMod);
    let g = Math.min(255, pt.g * brightnessMod);
    let b = Math.min(255, pt.b * brightnessMod);

    if (ui.style.includes('monochrome')) {
        let lum = (r + g + b) / 3; r = lum; g = lum; b = lum;
    } else if (ui.style.includes('pastel')) {
        r = Math.min(255, r + 40); g = Math.min(255, g + 40); b = Math.min(255, b + 40);
    } else if (ui.style.includes('neon')) {
        let maxC = Math.max(r, g, b);
        r = r === maxC ? 255 : r * 0.4; g = g === maxC ? 255 : g * 0.4; b = b === maxC ? 255 : b * 0.4;
    }

    let scatterMod = Math.max(0.5, ui.scatter);
    let audioBump = low * 2.0; 
    let baseSize = 0;
    let opacity = 200;

    if (layerNum === 1) {
        baseSize = (24 + (20 * audioBump)) * scatterMod; opacity = 100; 
    } else if (layerNum === 2) {
        baseSize = (12 + (10 * audioBump)); opacity = 170;
    } else if (layerNum === 3) {
        baseSize = (4 + (4 * audioBump)) / scatterMod; opacity = 240; 
    }

    let finalSize = baseSize / detailMod; 
    this.pg.push();
    this.pg.translate(pt.x, pt.y);
    if (pt.angle !== undefined) this.pg.rotate(pt.angle + p.random(-0.08, 0.08)); 
    this.pg.tint(r, g, b, opacity);
    this.pg.imageMode(p.CENTER);

    let touches = Math.floor(p.random(2, 4));
    for (let i = 0; i < touches; i++) {
        let nx = p.random(-finalSize * 0.15, finalSize * 0.15);
        let ny = p.random(-finalSize * 0.05, finalSize * 0.05);
        this.pg.image(this.brushTexture, nx, ny, finalSize, finalSize * 0.4); 
    }
    this.pg.pop();
  }

  drawOldPhotoEffect(p) {
    p.noStroke();
    p.fill(60, 40, 20, 5); 
    p.rect(0, 0, p.width, p.height);
    let cx = p.width / 2; let cy = p.height / 2;
    let maxRadius = p.max(p.width, p.height);
    let gradient = p.drawingContext.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius * 0.8);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');   
    p.drawingContext.fillStyle = gradient; p.noStroke(); p.rect(0, 0, p.width, p.height);
  }

  drawDropUI(p) {
    p.push(); p.fill(255, 255, 255, 100 + p.sin(p.millis() * 0.005) * 50); p.noStroke(); p.textSize(24); p.textAlign(p.CENTER, p.CENTER);
    p.text("원하는 이미지를 드래그 & 드롭하여 캔버스에 올려주세요", p.width/2, p.height/2); p.pop();
  }

  handleDragOver(e) { e.preventDefault(); }
  handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      if (this.p5Instance) {
        this.sourceImg = null; 
        this.p5Instance.loadImage(url, (img) => { this.prepareCanvas(img, this.p5Instance); });
      }
    }
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      if (this.pg) {
          this.pg = this.p5Instance.createGraphics(w, h);
          this.pg.pixelDensity(1); 
          this.resetCanvas(this.p5Instance, this.isPreviewMode);
      }
    }
  }

  destroy() {
    this.container.removeEventListener('dragover', this.handleDragOver);
    this.container.removeEventListener('drop', this.handleDrop);
    if (this.p5Instance) this.p5Instance.remove();
    this.sourceImg = null; 
  }
}
