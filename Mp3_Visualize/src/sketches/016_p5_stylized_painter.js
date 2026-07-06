/**
 * src/sketches/016_p5_stylized_painter.js
 * - [버그 픽스] this.sourceImg.remove() 오류 해결 (null 처리로 메모리 해제)
 * - ImageAnalyzer 코어 모듈 연동 및 3단계 큐(Queue) 레이어 시스템
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
    
    this.totalPoints = 0;
    this.drawnCount = 0;
    
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
        
        p.loadImage('https://picsum.photos/seed/cosmic/800/600', (img) => {
            if(!this.isImageLoaded) this.prepareCanvas(img, p);
        });
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
    
    let rawData = ImageAnalyzer.extractFeatures(img, p, 4, 30);
    
    this.layer1 = []; this.layer2 = []; this.layer3 = [];
    
    for(let pt of rawData) {
        if (pt.edge) this.layer1.push(pt);  
        else this.layer2.push(pt);          
        this.layer3.push(pt);               
    }
    
    p.shuffle(this.layer1, true);
    p.shuffle(this.layer2, true);
    p.shuffle(this.layer3, true);
    
    this.totalPoints = this.layer1.length + this.layer2.length + this.layer3.length;
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
    
    this.drawnCount = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintStep(this.q1.pop(), 1, this.currentSettings, p);
       while(this.q2.length > 0) this.paintStep(this.q2.pop(), 2, this.currentSettings, p);
       while(this.q3.length > 0) this.paintStep(this.q3.pop(), 3, this.currentSettings, p);
       
       this.drawnCount = this.totalPoints;
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

    let normalizedProgress = Math.min(progress / 0.8, 1.0);
    
    if (!this.isPreviewMode) {
        let targetCount = Math.floor(this.totalPoints * normalizedProgress);
        let baseRate = Math.floor(this.totalPoints * 0.02 * ui.burst);
        let drawBudget = Math.min(targetCount - this.drawnCount, baseRate);
        drawBudget = Math.max(0, drawBudget);

        let highFreq = audioData ? (audioData.raw[60] + audioData.raw[61]) / 510 : 0;

        for (let i = 0; i < drawBudget; i++) {
            if (this.q1.length > 0) {
                this.paintStep(this.q1.pop(), 1, ui, p, highFreq);
            } else if (this.q2.length > 0) {
                this.paintStep(this.q2.pop(), 2, ui, p, highFreq);
            } else if (this.q3.length > 0) {
                this.paintStep(this.q3.pop(), 3, ui, p, highFreq);
            } else {
                break;
            }
            this.drawnCount++;
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
        this.pg.stroke(255, 150 * ui.glow);
        this.pg.strokeWeight(p.random(0.5, 1.5) * (ui.glow * 2));
        this.pg.point(0, 0);
    } else if (layerNum === 2) {
        this.pg.noStroke();
        this.pg.fill(pt.r, pt.g, pt.b, alpha);
        let rectSize = 6 * ui.glow * (ui.scatter > 0 ? ui.scatter : 1);
        this.pg.rect(0, 0, rectSize, rectSize);
    } else if (layerNum === 3) {
        this.pg.noStroke();
        this.pg.fill(pt.r, pt.g, pt.b, alpha);
        let ellipseSize = 2 * ui.glow;
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
        // 💡 [버그 픽스] remove() 대신 안전하게 null로 초기화합니다.
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
    // 💡 [버그 픽스] 스케치 소멸 시에도 안전하게 null로 비웁니다.
    this.sourceImg = null; 
  }
}
