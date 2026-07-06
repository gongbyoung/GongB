/**
 * src/sketches/016_p5_stylized_painter.js
 * - 무작위 섞기(Shuffle) 제거 및 공간 정렬(Sorting) 도입
 * - 스케치 선이 사물의 윤곽 방향(Angle)을 따라가도록 물리 엔진 수정
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
          style: settings.colorStyle ?? 'neon'
      };
  }

  prepareCanvas(img, p) {
    img.resize(p.width, p.height);
    this.sourceImg = img;
    
    // 코어 모듈에서 각도와 정렬 키까지 받아옵니다
    let rawData = ImageAnalyzer.extractFeatures(img, p, 4, 20);
    
    this.layer1 = []; this.layer2 = []; this.layer3 = [];
    
    for(let pt of rawData) {
        if (pt.edge) this.layer1.push(pt);  
        else this.layer2.push(pt);          
        this.layer3.push(pt);               
    }
    
    // 💡 [핵심 교정] 무작위 셔플 대신, 사람이 그리듯 좌상단 -> 우하단으로 정렬합니다.
    // 배열에서 pop()으로 꺼내므로, 내림차순 정렬해야 값이 작은 좌측상단부터 그려집니다.
    this.layer1.sort((a, b) => b.sortKey - a.sortKey);
    this.layer2.sort((a, b) => b.sortKey - a.sortKey);
    this.layer3.sort((a, b) => b.sortKey - a.sortKey);
    
    this.isImageLoaded = true;
    this.currentSettings = this.getUIParams();
    this.resetCanvas(p, true); 
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    this.q1 = [...this.layer1];
    this.q2 = [...this.layer2];
    this.q3 = [...this.layer3];
    
    p.randomSeed(this.currentSettings.seed);
    p.noiseSeed(this.currentSettings.seed);
    
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintStep(this.q1.pop(), 1, this.currentSettings, p);
       while(this.q2.length > 0) this.paintStep(this.q2.pop(), 2, this.currentSettings, p);
       while(this.q3.length > 0) this.paintStep(this.q3.pop(), 3, this.currentSettings, p);
       
       if (this.currentSettings.style === 'custom') this.drawOldPhotoEffect(p);
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
        let highFreq = audioData ? (audioData.raw[60] + audioData.raw[61]) / 510 : 0;
        
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
            if (this.q1.length > 0) { this.paintStep(this.q1.pop(), 1, ui, p, highFreq); this.drawn1++; }
        }
        for (let i = 0; i < budget2; i++) {
            if (this.q2.length > 0) { this.paintStep(this.q2.pop(), 2, ui, p, highFreq); this.drawn2++; }
        }
        for (let i = 0; i < budget3; i++) {
            if (this.q3.length > 0) { this.paintStep(this.q3.pop(), 3, ui, p, highFreq); this.drawn3++; }
        }
    }

    if (ui.style === 'custom' && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  paintStep(pt, layerNum, ui, p, highFreq = 0) {
    let alpha = 200 * ui.glow; 
    let scatterOffset = (p.random(-1, 1) * 10 * ui.scatter) + (highFreq * 20); 
    
    this.pg.push();
    this.pg.translate(pt.x + scatterOffset, pt.y + scatterOffset);
    
    if (layerNum === 1) {
        this.pg.stroke(220, 220, 220, 180 * ui.glow); 
        this.pg.strokeWeight(p.random(1, 2) * ui.glow);
        let len = p.random(5, 15) * ui.glow;
        
        // 💡 [핵심 교정] 무작위 빗금이 아니라, 사물의 결(Angle)을 감싸듯 선을 긋습니다.
        this.pg.rotate(pt.angle + p.random(-0.15, 0.15)); 
        this.pg.line(-len/2, 0, len/2, 0); 
        
    } else if (layerNum === 2) {
        this.pg.noStroke();
        this.pg.fill(pt.r, pt.g, pt.b, alpha);
        this.pg.rectMode(p.CENTER);
        let rectSize = 8 * ui.glow * (ui.scatter > 0 ? ui.scatter : 1);
        this.pg.rect(0, 0, rectSize, rectSize);
    } else if (layerNum === 3) {
        this.pg.noStroke();
        this.pg.fill(pt.r, pt.g, pt.b, alpha);
        let ellipseSize = 3 * ui.glow;
        this.pg.ellipse(0, 0, ellipseSize, ellipseSize);
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
