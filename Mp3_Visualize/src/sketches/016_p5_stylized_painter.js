/**
 * src/sketches/016_p5_stylized_painter.js
 * - [버그 픽스] pixelDensity(1) 및 img.resize 적용으로 블랙스크린 해결
 * - 3단계 페인팅: 윤곽선(30%) -> 면 채우기(60%) -> 정밀 묘사(80%)
 * - 정지 시 즉시 100% 완성본 렌더링 (미리보기 모드)
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; 
    
    this.edgeData = []; 
    this.points = [];   
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
        
        // 💡 [핵심 픽스 1] 픽셀 연산 엉킴 방지를 위해 밀도를 1로 강제 고정
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
    // 💡 [핵심 픽스 2] 원본 이미지를 캔버스 크기에 딱 맞게 리사이징 (화면 이탈 방지)
    img.resize(p.width, p.height);
      
    this.sourceImg = img;
    this.sourceImg.loadPixels();
    
    // 흑백 사본 만들어 윤곽선 추출
    let grayImg = p.createImage(img.width, img.height);
    grayImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
    grayImg.filter(p.GRAY);
    grayImg.loadPixels();

    this.edgeData = [];
    let step = 4; 
    
    for (let y = 1; y < img.height - 1; y += step) {
      for (let x = 1; x < img.width - 1; x += step) {
        let idx = (y * img.width + x) * 4;
        
        // 미분(밝기 차이) 윤곽선 검출
        let diffX = Math.abs(grayImg.pixels[idx] - grayImg.pixels[idx + 4]);
        let diffY = Math.abs(grayImg.pixels[idx] - grayImg.pixels[idx + img.width * 4]);
        let edgeStrength = diffX + diffY;
        
        this.edgeData.push({
          x: x, 
          y: y,
          r: img.pixels[idx], 
          g: img.pixels[idx+1], 
          b: img.pixels[idx+2],
          edge: edgeStrength > 50 ? 1 : 0
        });
      }
    }
    
    this.isImageLoaded = true;
    this.currentSettings = this.getUIParams();
    this.resetCanvas(p, true); 
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    this.points = [...this.edgeData];
    
    p.randomSeed(this.currentSettings.seed);
    p.noiseSeed(this.currentSettings.seed);
    
    p.shuffle(this.points, true);
    this.totalPoints = this.points.length;
    this.drawnCount = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       for(let i=0; i < this.points.length; i++) {
           let simProg = i / this.points.length; 
           this.paintStepByStep(this.points[i], simProg, this.currentSettings, p);
       }
       this.points = [];
       this.drawnCount = this.totalPoints;
       
       if (this.currentSettings.style === 'custom') {
           this.drawOldPhotoEffect(p);
       }
    }
  }

  update(audioData) {
    if (!this.p5Instance || !this.isImageLoaded) return;
    let p = this.p5Instance;
    
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

    if (isPlaying && this.isPreviewMode) {
        this.resetCanvas(p, false); 
    }

    let progress = 0;
    if (audioEl && audioEl.duration) {
        progress = audioEl.currentTime / audioEl.duration;
    } else {
        if (isPlaying) this.simulatedProgress += 0.016 / 180.0;
        progress = this.simulatedProgress;
    }

    if (progress < this.lastProgress) {
        this.resetCanvas(p, !isPlaying);
    }
    this.lastProgress = progress;

    let normalizedProgress = Math.min(progress / 0.8, 1.0);
    
    if (!this.isPreviewMode) {
        let targetCount = Math.floor(this.totalPoints * normalizedProgress);
        let baseRate = Math.floor(this.totalPoints * 0.02 * ui.burst);
        let drawBudget = Math.min(targetCount - this.drawnCount, baseRate);
        drawBudget = Math.max(0, drawBudget);

        for (let i = 0; i < drawBudget; i++) {
            if (this.points.length === 0) break;
            let pt = this.points.pop();
            this.drawnCount++;
            this.paintStepByStep(pt, normalizedProgress, ui, p);
        }

        if (this.points.length === 0 && audioData && progress >= 0.8) {
           let high = (audioData.raw[60] + audioData.raw[61]) / 510;
           if (high > 0.15) {
               for(let i=0; i < 5; i++) {
                   let pt = this.edgeData[Math.floor(p.random(this.edgeData.length))];
                   this.paintStepByStep(pt, 1.0, ui, p, high); 
               }
           }
        }
    }

    if (ui.style === 'custom' && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  paintStepByStep(pt, progress, ui, p, highFreq = 0) {
    let alpha = 200 * ui.glow; 
    let scatterOffset = (p.random(-1, 1) * 10 * ui.scatter) + (highFreq * 20); 
    
    this.pg.push();
    this.pg.translate(pt.x + scatterOffset, pt.y + scatterOffset);
    
    if (progress < 0.3) {
        // [1단계] 거친 윤곽선 스케치
        if (pt.edge) {
            this.pg.stroke(255, 150 * ui.glow);
            this.pg.strokeWeight(p.random(0.5, 1.5) * (ui.glow * 2));
            this.pg.point(0, 0);
        }
    } else if (progress < 0.6) {
        // [2단계] 면 채우기 (채색)
        if (!pt.edge) {
            this.pg.noStroke();
            this.pg.fill(pt.r, pt.g, pt.b, alpha);
            let rectSize = 6 * ui.glow * (ui.scatter > 0 ? ui.scatter : 1);
            this.pg.rect(0, 0, rectSize, rectSize);
        }
    } else {
        // [3단계] 정밀 묘사
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
        if(this.sourceImg) this.sourceImg.remove();
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
          this.pg.pixelDensity(1); // 리사이즈 시에도 밀도 1 유지
          this.resetCanvas(this.p5Instance, this.isPreviewMode);
      }
    }
  }

  destroy() {
    this.container.removeEventListener('dragover', this.handleDragOver);
    this.container.removeEventListener('drop', this.handleDrop);
    if (this.p5Instance) this.p5Instance.remove();
    if (this.sourceImg) this.sourceImg.remove();
  }
}
