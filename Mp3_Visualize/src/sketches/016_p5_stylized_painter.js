/**
 * src/sketches/016_p5_stylized_painter.js
 * - [최종 통합 완결판] 단 한 줄의 생략도 없는 전체 소스코드
 * - Texture 브러시 엔진: 드롭된 이미지 자체를 붓터치 질감(Brush Texture)으로 사용
 * - 주파수 지능형 매핑: 저음(비윤곽선 대형 붓) -> 중음(중간 붓) -> 고음(윤곽선 미세 붓)
 * - 슬라이더 4종 제어: 지형변경(Seed/순서섞기), 분산범위(붓크기대비), 발광/크기(밝기 및 섬세함), 폭발력(속도)
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.brushTexture = null; // 💡 텍스처로 사용할 붓 이미지 버퍼
    this.pg = null; 
    
    this.layer1 = []; // 저음용 (비윤곽선, 대형 붓)
    this.layer2 = []; // 중음용 (비윤곽선, 중간 붓)
    this.layer3 = []; // 고음용 (윤곽선, 미세 디테일 붓)
    
    this.q1 = []; this.q2 = []; this.q3 = [];
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    
    this.isImageLoaded = false;
    this.isPreviewMode = true;
    this.simulatedProgress = 0;
    this.lastProgress = 0;
    
    this.currentSettings = { style: 'neon', scatter: 2.2, gain: 1.0, seed: 42, glow: 0.25 };
  }

  // 💡 SketchManager가 정상적으로 로드할 수 있도록 보장하는 표준 init 함수
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
    this.brushTexture = img; // 💡 드롭한 이미지 자체를 붓터치 텍스처로 장전합니다.
    
    // 코어 모듈을 통해 색상, 윤곽선, 결(각도) 데이터를 완벽히 추출합니다.
    let rawData = ImageAnalyzer.extractFeatures(img, p, 4, 30);
    
    this.layer1 = []; this.layer2 = []; this.layer3 = [];
    
    // 회원님의 지능형 매핑 규칙에 따라 주파수/윤곽선 레이어 분할
    for(let pt of rawData) {
        if (pt.edge) {
            this.layer3.push(pt);  // 윤곽선은 무조건 고음(미세 붓)
        } else {
            if (p.random() > 0.5) this.layer1.push(pt); // 배경은 저음(큰 붓)
            else this.layer2.push(pt);                  // 중간 면은 중음
        }
    }
    
    this.isImageLoaded = true;
    this.currentSettings = this.getUIParams();
    this.resetCanvas(p, true); 
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    // 💡 지형변경(Seed): 슬라이더 조작 시 무작위 순서를 제어합니다.
    p.randomSeed(this.currentSettings.seed);
    
    this.q1 = p.shuffle([...this.layer1]);
    this.q2 = p.shuffle([...this.layer2]);
    this.q3 = p.shuffle([...this.layer3]);
    
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;

    // 미리보기 모드일 때 3개 레이어를 완벽히 중첩시켜 완성본 출력
    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintTextureBrush(this.q1.pop(), 1, this.currentSettings, p, 0.5);
       while(this.q2.length > 0) this.paintTextureBrush(this.q2.pop(), 2, this.currentSettings, p, 0.5);
       while(this.q3.length > 0) this.paintTextureBrush(this.q3.pop(), 3, this.currentSettings, p, 0.5);
       
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
        let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0;
        let mid = audioData ? (audioData.raw[20] + audioData.raw[21]) / 510 : 0;
        let high = audioData ? (audioData.raw[60] + audioData.raw[61]) / 510 : 0;
        
        // 80% 시간 완성을 위한 엄격한 레이어 스케줄링
        let p1 = Math.min(progress / 0.3, 1.0); 
        let p2 = progress > 0.3 ? Math.min((progress - 0.3) / 0.3, 1.0) : 0; 
        let p3 = progress > 0.6 ? Math.min((progress - 0.6) / 0.2, 1.0) : 0; 

        let target1 = Math.floor(this.layer1.length * p1);
        let target2 = Math.floor(this.layer2.length * p2);
        let target3 = Math.floor(this.layer3.length * p3);

        let budget1 = Math.max(0, target1 - this.drawn1);
        let budget2 = Math.max(0, target2 - this.drawn2);
        let budget3 = Math.max(0, target3 - this.drawn3);

        // 폭발력(Burst)에 비례하여 그리는 프레임 속도 조절
        let rateLimit = Math.floor(this.totalPoints * 0.02 * ui.burst);

        for (let i = 0; i < Math.min(budget1, rateLimit); i++) {
            if (this.q1.length > 0) { this.paintTextureBrush(this.q1.pop(), 1, ui, p, low); this.drawn1++; }
        }
        for (let i = 0; i < Math.min(budget2, rateLimit); i++) {
            if (this.q2.length > 0) { this.paintTextureBrush(this.q2.pop(), 2, ui, p, mid); this.drawn2++; }
        }
        for (let i = 0; i < Math.min(budget3, rateLimit); i++) {
            if (this.q3.length > 0) { this.paintTextureBrush(this.q3.pop(), 3, ui, p, high); this.drawn3++; }
        }
    }

    if (ui.style.includes('custom') && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  // 💡 텍스처 이미지를 활용한 무적의 붓터치 매핑 엔진
  paintTextureBrush(pt, layerNum, ui, p, audioValue) {
    // 발광/크기 슬라이더 연동 (Glow) -> 밝기 증폭 및 섬세함(Detail) 매핑
    let brightnessMod = 1.0 + (ui.glow * 1.5); 
    let detailMod = Math.max(0.3, ui.glow * 2.5); // 높을수록 브러시가 미세해짐

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

    // 분산범위 슬라이더 연동 (Scatter) -> 대형/미세 브러시의 크기 대비 격차 조절
    let scatterMod = Math.max(0.5, ui.scatter);
    let audioBump = audioValue * 2.0; 
    let baseSize = 0;
    let opacity = 200;

    if (layerNum === 1) {
        // 저음 레이어: 윤곽선 없는 영역을 장악하는 거대 배경 붓
        baseSize = (24 + (20 * audioBump)) * scatterMod;
        opacity = 100; // 넓고 투명하게 블렌딩
    } else if (layerNum === 2) {
        // 중음 레이어: 중간 붓
        baseSize = (12 + (10 * audioBump));
        opacity = 170;
    } else if (layerNum === 3) {
        // 고음 레이어: 윤곽선(Edge)을 파고드는 초미세 묘사 붓
        baseSize = (4 + (4 * audioBump)) / scatterMod; 
        opacity = 240; // 윤곽은 명확하고 진하게
    }

    let finalSize = baseSize / detailMod; 

    this.pg.push();
    this.pg.translate(pt.x, pt.y);
    
    // 사물의 결(기울기 각도)을 따라 붓을 정렬시킵니다.
    if (pt.angle !== undefined) {
        this.pg.rotate(pt.angle + p.random(-0.08, 0.08)); 
    }

    // 💡 붓터치 텍스처 실시간 착색 기법 적용
    this.pg.tint(r, g, b, opacity);
    this.pg.imageMode(p.CENTER);

    // 단순 도형(line/ellipse)을 전면 폐기하고, 드롭된 질감 텍스처를 캔버스에 도장 찍듯 회전하며 브러싱합니다.
    let touches = Math.floor(p.random(2, 4));
    for (let i = 0; i < touches; i++) {
        let nx = p.random(-finalSize * 0.15, finalSize * 0.15);
        let ny = p.random(-finalSize * 0.05, finalSize * 0.05);
        
        // 텍스처를 납작 붓 비율(가로형)로 화면에 전사
        this.pg.image(this.brushTexture, nx, ny, finalSize, finalSize * 0.4); 
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
    p.text("원하는 이미지를 드래그 & 드롭하여 캔버스에 올려주세요 TEXTURE에 붓모양을 로딩하세요/n [MP3] ➡️ [Texture] ➡️ [중앙 캔버스에 원본 이미지 드롭] 순서", p.width/2, p.height/2);
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
