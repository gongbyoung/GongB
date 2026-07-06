/**
 * src/sketches/016_p5_stylized_painter.js
 * - [수정1] 분산범위(Scatter): 붓 크기 스케일 대비 조절 (저음은 더 크게, 고음은 더 작게)
 * - [수정2] 발광/크기(Glow): 이미지 밝기(Brightness) 및 섬세함(Detail) 조절
 * - [수정3] 지형변경(Seed): 칠해지는 순서(Shuffle) 무작위 재배치
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; 
    
    this.layer1 = []; 
    this.layer2 = []; 
    this.layer3 = []; 
    
    this.q1 = []; this.q2 = []; this.q3 = [];
    
    this.drawn1 = 0;
    this.drawn2 = 0;
    this.drawn3 = 0;
    
    this.isImageLoaded = false;
    this.isPreviewMode = true;
    this.simulatedProgress = 0;
    this.lastProgress = 0;
    
    this.currentSettings = { style: 'neon', scatter: 2.2, gain: 1.0, seed: 42, glow: 0.25 };
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

    this.container.addEventListener('dragover', this.handleDragOver.bind(this));
    this.container.addEventListener('drop', this.handleDrop.bind(this));

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.pixelDensity(1);
        this.pg.background(15, 18, 25); 
        p.noLoop(); 
      };

      p.draw = () => {
        p.clear();
        if (this.pg) p.image(this.pg, 0, 0); 
        if (!this.isImageLoaded) this.drawDropUI(p);
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      return {
          scatter: settings.scatterExponent ?? 2.2,
          glow: settings.glowAmount ?? (settings.size ?? 0.25),
          burst: settings.audioGain ?? 1.0,
          seed: settings.seed ?? 42,
          style: (settings.colorStyle || 'neon').toLowerCase() 
      };
  }

  prepareCanvas(img, p) {
    img.resize(p.width, p.height);
    this.sourceImg = img;
    
    let rawData = ImageAnalyzer.extractFeatures(img, p, 4, 20);
    
    this.layer1 = []; this.layer2 = []; this.layer3 = [];
    
    for(let pt of rawData) {
        if (pt.edge) this.layer1.push(pt);  
        else this.layer2.push(pt);          
        this.layer3.push(pt);               
    }
    
    this.isImageLoaded = true;
    this.currentSettings = this.getUIParams();
    this.resetCanvas(p, true); 
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    // 💡 [수정3] 지형변경(Seed) - 슬라이더를 움직일 때마다 칠해지는 '순서'를 새롭게 섞습니다.
    p.randomSeed(this.currentSettings.seed);
    
    this.q1 = p.shuffle([...this.layer1]);
    this.q2 = p.shuffle([...this.layer2]);
    this.q3 = p.shuffle([...this.layer3]);
    
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintStep(this.q1.pop(), 1, this.currentSettings, p, 0.5, 0.5, 0.5);
       while(this.q2.length > 0) this.paintStep(this.q2.pop(), 2, this.currentSettings, p, 0.5, 0.5, 0.5);
       while(this.q3.length > 0) this.paintStep(this.q3.pop(), 3, this.currentSettings, p, 0.5, 0.5, 0.5);
       
       if (this.currentSettings.style.includes('custom')) this.drawOldPhotoEffect(p);
    }
  }

  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    if (!this.isImageLoaded) {
        p.redraw();
        return;
    }
    
    const ui = this.getUIParams();
    let settingsChanged = (
        this.currentSettings.style !== ui.style ||
        this.currentSettings.scatter !== ui.scatter ||
        this.currentSettings.burst !== ui.burst ||
        this.currentSettings.seed !== ui.seed ||
        this.currentSettings.glow !== ui.glow
    );

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;
    
    if (settingsChanged) {
        this.currentSettings = ui;
        this.resetCanvas(p, !isPlaying);
    }

    if (isPlaying && this.isPreviewMode) this.resetCanvas(p, false); 

    let progress = 0;
    if (audioEl && audioEl.duration) {
        progress = audioEl.currentTime / audioEl.duration;
    } else {
        if (isPlaying) this.simulatedProgress += 0.016 / 180.0;
        progress = this.simulatedProgress;
    }

    if (progress < this.lastProgress) this.resetCanvas(p, !isPlaying);
    this.lastProgress = progress;

    if (!this.isPreviewMode) {
        // 주파수 대역별 강도 분리
        let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0.5;
        let mid = audioData ? (audioData.raw[20] + audioData.raw[21]) / 510 : 0.5;
        let high = audioData ? (audioData.raw[60] + audioData.raw[61]) / 510 : 0.5;
        
        let p1 = Math.min(progress / 0.3, 1.0); 
        let p2 = progress > 0.3 ? Math.min((progress - 0.3) / 0.3, 1.0) : 0; 
        let p3 = progress > 0.6 ? Math.min((progress - 0.6) / 0.2, 1.0) : 0; 

        let target1 = Math.floor(this.layer1.length * p1);
        let target2 = Math.floor(this.layer2.length * p2);
        let target3 = Math.floor(this.layer3.length * p3);

        let budget1 = Math.max(0, target1 - this.drawn1);
        let budget2 = Math.max(0, target2 - this.drawn2);
        let budget3 = Math.max(0, target3 - this.drawn3);

        for (let i = 0; i < budget1; i++) {
            if (this.q1.length > 0) { this.paintStep(this.q1.pop(), 1, ui, p, low, mid, high); this.drawn1++; }
        }
        for (let i = 0; i < budget2; i++) {
            if (this.q2.length > 0) { this.paintStep(this.q2.pop(), 2, ui, p, low, mid, high); this.drawn2++; }
        }
        for (let i = 0; i < budget3; i++) {
            if (this.q3.length > 0) { this.paintStep(this.q3.pop(), 3, ui, p, low, mid, high); this.drawn3++; }
        }
    }

    if (ui.style.includes('custom') && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  paintStep(pt, layerNum, ui, p, low, mid, high) {
    // 💡 [수정2] 발광/크기 (Glow & Size) = 밝기 & 섬세함
    let brightnessMod = ui.glow; // 값이 클수록 밝아짐
    let detailMod = Math.max(0.2, ui.glow); // 값이 클수록 붓이 작아져 원본과 비슷해짐

    let r = Math.min(255, pt.r * brightnessMod);
    let g = Math.min(255, pt.g * brightnessMod);
    let b = Math.min(255, pt.b * brightnessMod);

    if (ui.style.includes('monochrome')) {
        let lum = (r + g + b) / 3;
        r = lum; g = lum; b = lum;
    } else if (ui.style.includes('pastel')) {
        r = Math.min(255, r + 50); g = Math.min(255, g + 50); b = Math.min(255, b + 50);
    } else if (ui.style.includes('neon')) {
        let maxC = Math.max(r, g, b);
        r = r === maxC ? 255 : r * 0.5; g = g === maxC ? 255 : g * 0.5; b = b === maxC ? 255 : b * 0.5;
    }

    this.pg.push();
    this.pg.translate(pt.x, pt.y); // 위치 어긋남(모자이크 현상) 완전 제거
    if (pt.angle !== undefined) {
        this.pg.rotate(pt.angle + p.random(-0.1, 0.1)); // 사물의 결(각도) 유지
    }

    // 💡 [수정1] 분산범위 (Scatter) = 붓 크기 대비(Contrast) 조절
    let scatterMod = ui.scatter;

    if (layerNum === 1) {
        // 1단계(윤곽선 스케치) - 저음에 반응하여 더 거대해지는 선
        let size = (10 + (low * 20)) * scatterMod / detailMod;
        this.pg.stroke(r, g, b, 150); 
        this.pg.strokeWeight(p.random(1, 2) / detailMod);
        this.pg.line(-size/2, 0, size/2, 0); 
    } else if (layerNum === 2) {
        // 2단계(밑색 채우기) - 중음에 반응하는 중간 타원
        let size = (6 + (mid * 10)) / detailMod;
        this.pg.noStroke();
        this.pg.fill(r, g, b, 200);
        this.pg.ellipse(0, 0, size, size * 0.8);
    } else if (layerNum === 3) {
        // 3단계(정밀 묘사) - 고음에 반응하며 Scatter에 반비례하여 더 미세해지는 붓
        let size = (3 + (high * 8)) / (scatterMod * detailMod);
        this.pg.noStroke();
        this.pg.fill(r, g, b, 230);
        this.pg.ellipse(0, 0, size, size * 0.5);
    }
    
    this.pg.pop();
  }

  drawOldPhotoEffect(p) {
    p.noStroke();
    p.fill(60, 40, 20, 5); 
    p.rect(0, 0, p.width, p.height);

    let cx = p.width / 2;
    let cy = p.height / 2;
    let maxRadius = p.max(p.width, p.height);
    let gradient = p.drawingContext.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius * 0.8);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');     
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');   
    p.drawingContext.fillStyle = gradient;
    p.noStroke();
    p.rect(0, 0, p.width, p.height);
  }

  drawDropUI(p) {
    p.push();
    p.fill(255, 255, 255, 100 + p.sin(p.millis() * 0.005) * 50);
    p.noStroke();
    p.textSize(24);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("원하는 이미지를 드래그 & 드롭하여 캔버스에 올려주세요", p.width/2, p.height/2);
    p.pop();
  }

  handleDragOver(e) { e.preventDefault(); }

  handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      if (this.p5Instance) {
        this.sourceImg = null; 
        this.p5Instance.loadImage(url, (img) => {
          this.prepareCanvas(img, this.p5Instance); 
        });
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
