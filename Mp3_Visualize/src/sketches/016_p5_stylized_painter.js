/**
 * src/sketches/016_p5_stylized_painter.js
 * - [화풍 수정] 긴 막대기(line) 제거 -> 다중 타원(ellipse)과 노이즈를 결합한 납작 붓 텍스처 적용
 * - [로직 수정] 저음(큰 붓/비윤곽선) -> 중음(중간 붓/비윤곽선) -> 고음(미세 붓/윤곽선) 완벽 매핑
 * - [UI 수정] 발광/크기 슬라이더: 밝기 증가 및 붓 크기 축소(섬세함 증가)
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; 
    
    this.layer1 = []; // 저음용 (비윤곽선, 큰 붓)
    this.layer2 = []; // 중음용 (비윤곽선, 중간 붓)
    this.layer3 = []; // 고음용 (윤곽선, 미세 붓)
    
    this.q1 = []; this.q2 = []; this.q3 = [];
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    
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
    
    let rawData = ImageAnalyzer.extractFeatures(img, p, 4, 30);
    
    this.layer1 = []; this.layer2 = []; this.layer3 = [];
    
    // 💡 [핵심] 윤곽선 유무에 따라 데이터를 분리합니다.
    for(let pt of rawData) {
        if (pt.edge) {
            // 윤곽선은 무조건 3단계(고음, 미세 붓)로 배정
            this.layer3.push(pt);  
        } else {
            // 윤곽선이 없는 면은 1단계(저음)와 2단계(중음)로 반반 나눕니다.
            if (p.random() > 0.5) this.layer1.push(pt);
            else this.layer2.push(pt);
        }
    }
    
    this.isImageLoaded = true;
    this.currentSettings = this.getUIParams();
    this.resetCanvas(p, true); 
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    p.randomSeed(this.currentSettings.seed);
    
    // 지형변경: 그리는 순서를 완전히 섞습니다.
    this.q1 = p.shuffle([...this.layer1]);
    this.q2 = p.shuffle([...this.layer2]);
    this.q3 = p.shuffle([...this.layer3]);
    
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintBrush(this.q1.pop(), 1, this.currentSettings, p, 0.5);
       while(this.q2.length > 0) this.paintBrush(this.q2.pop(), 2, this.currentSettings, p, 0.5);
       while(this.q3.length > 0) this.paintBrush(this.q3.pop(), 3, this.currentSettings, p, 0.5);
       
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
        // 💡 주파수 대역 분리 (각각의 붓 크기와 활성화에 영향)
        let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0;
        let mid = audioData ? (audioData.raw[20] + audioData.raw[21]) / 510 : 0;
        let high = audioData ? (audioData.raw[60] + audioData.raw[61]) / 510 : 0;
        
        let p1 = Math.min(progress / 0.3, 1.0); 
        let p2 = progress > 0.3 ? Math.min((progress - 0.3) / 0.3, 1.0) : 0; 
        let p3 = progress > 0.6 ? Math.min((progress - 0.6) / 0.2, 1.0) : 0; 

        let target1 = Math.floor(this.layer1.length * p1);
        let target2 = Math.floor(this.layer2.length * p2);
        let target3 = Math.floor(this.layer3.length * p3);

        let budget1 = Math.max(0, target1 - this.drawn1);
        let budget2 = Math.max(0, target2 - this.drawn2);
        let budget3 = Math.max(0, target3 - this.drawn3);

        // 레이어별로 할당된 주파수(low, mid, high)를 붓 크기 엔진으로 넘깁니다.
        for (let i = 0; i < budget1; i++) {
            if (this.q1.length > 0) { this.paintBrush(this.q1.pop(), 1, ui, p, low); this.drawn1++; }
        }
        for (let i = 0; i < budget2; i++) {
            if (this.q2.length > 0) { this.paintBrush(this.q2.pop(), 2, ui, p, mid); this.drawn2++; }
        }
        for (let i = 0; i < budget3; i++) {
            if (this.q3.length > 0) { this.paintBrush(this.q3.pop(), 3, ui, p, high); this.drawn3++; }
        }
    }

    if (ui.style.includes('custom') && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  paintBrush(pt, layerNum, ui, p, audioValue) {
    // 💡 [수정2] 발광/크기 (Glow) = 밝기 증폭 및 섬세함 조절
    let brightnessMod = 1.0 + (ui.glow * 1.5); // 밝게
    let detailMod = Math.max(0.3, ui.glow * 2.0); // 높을수록 붓이 작아짐(섬세해짐)

    let r = Math.min(255, pt.r * brightnessMod);
    let g = Math.min(255, pt.g * brightnessMod);
    let b = Math.min(255, pt.b * brightnessMod);

    if (ui.style.includes('monochrome')) {
        let lum = (r + g + b) / 3;
        r = lum; g = lum; b = lum;
    } else if (ui.style.includes('pastel')) {
        r = Math.min(255, r + 40); g = Math.min(255, g + 40); b = Math.min(255, b + 40);
    } else if (ui.style.includes('neon')) {
        let maxC = Math.max(r, g, b);
        r = r === maxC ? 255 : r * 0.4; g = g === maxC ? 255 : g * 0.4; b = b === maxC ? 255 : b * 0.4;
    }

    // 💡 [수정1] 분산범위 (Scatter) = 붓 크기 격차(Contrast) 
    let scatterMod = Math.max(0.5, ui.scatter);
    
    // 오디오 진폭에 따른 붓 크기 펌핑 효과
    let audioBump = audioValue * 2.0; 
    let baseSize = 0;
    let opacity = 180;

    // 레이어별 붓 크기 철저히 분리
    if (layerNum === 1) {
        // 저음 (배경): 아주 거대하고 듬성듬성한 붓
        baseSize = (20 + (20 * audioBump)) * scatterMod;
        opacity = 120; // 옅게 깔림
    } else if (layerNum === 2) {
        // 중음 (형태): 중간 크기의 붓
        baseSize = (10 + (10 * audioBump));
        opacity = 180;
    } else if (layerNum === 3) {
        // 고음 (윤곽선 디테일): 아주 작고 뾰족한 붓
        baseSize = (3 + (5 * audioBump)) / scatterMod; 
        opacity = 220; // 진하게 묘사
    }

    let finalSize = baseSize / detailMod; 

    this.pg.push();
    this.pg.translate(pt.x, pt.y);
    
    // 사물의 굴곡을 따라 붓의 방향을 돌립니다.
    if (pt.angle !== undefined) {
        this.pg.rotate(pt.angle + p.random(-0.1, 0.1)); 
    }

    this.pg.noStroke();
    this.pg.fill(r, g, b, opacity);

    // 💡 [핵심] 진짜 붓터치 느낌을 내기 위해 노이즈를 섞어 다중 타원을 그립니다 (긴 막대기 폐기)
    let brushTouches = Math.floor(p.random(2, 4));
    for (let i = 0; i < brushTouches; i++) {
        // 붓결이 살짝 흩어지게 하는 미세 노이즈
        let nx = p.random(-finalSize * 0.2, finalSize * 0.2);
        let ny = p.random(-finalSize * 0.1, finalSize * 0.1);
        
        // 납작 붓 (가로는 길고 세로는 얇은 타원)
        this.pg.ellipse(nx, ny, finalSize, finalSize * 0.4); 
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
