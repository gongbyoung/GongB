/**
 * src/sketches/016_p5_stylized_painter.js
 * - [통합 완결판] 단 한 줄의 생략도 없는 전체 코드
 * - 3단계 페인팅: 윤곽선(30%) -> 면 채우기(60%) -> 정밀 묘사(80%)
 * - UI 슬라이더 실시간 연동 (분산, 크기/발광, 폭발력, 시드)
 * - 정지 시 즉시 100% 완성본 렌더링 (미리보기 모드)
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; 
    
    this.edgeData = []; // 전처리된 픽셀 데이터 보관소
    this.points = [];   // 실제로 그릴 큐(Queue)
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
        
        this.pg = p.createGraphics(p.width, p.height);
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
    this.sourceImg = img;
    this.sourceImg.loadPixels();
    
    // 💡 1. 흑백 사본을 만들어 윤곽선(Edge) 추출
    let grayImg = p.createImage(img.width, img.height);
    grayImg.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
    grayImg.filter(p.GRAY);
    grayImg.loadPixels();

    this.edgeData = [];
    let step = 4; // 붓터치 샘플링 간격
    
    for (let y = 1; y < img.height - 1; y += step) {
      for (let x = 1; x < img.width - 1; x += step) {
        let idx = (y * img.width + x) * 4;
        
        // 미분(밝기 차이)을 통해 윤곽선 강도 계산
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
    this.resetCanvas(p, true); // 로드 즉시 미리보기 생성
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    // 원본 데이터를 복사하여 큐에 장전
    this.points = [...this.edgeData];
    
    // 지형변경(Seed) 슬라이더 연동
    p.randomSeed(this.currentSettings.seed);
    p.noiseSeed(this.currentSettings.seed);
    
    p.shuffle(this.points, true);
    this.totalPoints = this.points.length;
    this.drawnCount = 0;
    this.isPreviewMode = isPreview;

    // 💡 2. 미리보기 모드일 경우 즉시 100% 렌더링
    if (isPreview && this.isImageLoaded) {
       for(let i=0; i < this.points.length; i++) {
           // 0~1 사이의 가상 진행률을 부여하여 3단계 화풍을 모두 캔버스에 찍음
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
    
    // 💡 3. UI 슬라이더 변경 감지
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
        this.resetCanvas(p, !isPlaying); // 정지 중이면 미리보기 갱신
    }

    if (isPlaying && this.isPreviewMode) {
        this.resetCanvas(p, false); // 재생 시 캔버스 지우기
    }

    // 💡 4. 진행률 계산 (80% 지점에서 100% 완성)
    let progress = 0;
    if (audioEl && audioEl.duration) {
        progress = audioEl.currentTime / audioEl.duration;
    } else {
        if (isPlaying) this.simulatedProgress += 0.016 / 180.0;
        progress = this.simulatedProgress;
    }

    // 음악 되감기 감지 시 캔버스 리셋
    if (progress < this.lastProgress) {
        this.resetCanvas(p, !isPlaying);
    }
    this.lastProgress = progress;

    let normalizedProgress = Math.min(progress / 0.8, 1.0);
    
    if (!this.isPreviewMode) {
        let targetCount = Math.floor(this.totalPoints * normalizedProgress);
        
        // 폭발력(Burst) 슬라이더 연동: 한 프레임에 그릴 최대 획 개수 한계치 설정
        let baseRate = Math.floor(this.totalPoints * 0.02 * ui.burst);
        let drawBudget = Math.min(targetCount - this.drawnCount, baseRate);
        drawBudget = Math.max(0, drawBudget);

        for (let i = 0; i < drawBudget; i++) {
            if (this.points.length === 0) break;
            let pt = this.points.pop();
            this.drawnCount++;
            this.paintStepByStep(pt, normalizedProgress, ui, p);
        }

        // 완성 후 고음역대 라이브 이펙트 (음악이 터질 때 빈 공간에 반짝임)
        if (this.points.length === 0 && audioData && progress >= 0.8) {
           let high = (audioData.raw[60] + audioData.raw[61]) / 510;
           if (high > 0.15) {
               for(let i=0; i < 5; i++) {
                   let pt = this.edgeData[Math.floor(p.random(this.edgeData.length))];
                   this.paintStepByStep(pt, 1.0, ui, p, high); // 강제로 3단계 정밀 묘사 출력
               }
           }
        }
    }

    // 인상파(Custom) 스타일 - 오래된 사진 효과
    if (ui.style === 'custom' && progress >= 0.8 && !this.isPreviewMode) {
        this.drawOldPhotoEffect(p);
    }

    p.redraw();
  }

  // 💡 5. 3단계 화가 엔진 로직
  paintStepByStep(pt, progress, ui, p, highFreq = 0) {
    let alpha = 200 * ui.glow; // 발광/크기 슬라이더 -> 투명도 연동
    let scatterOffset = (p.random(-1, 1) * 10 * ui.scatter) + (highFreq * 20); // 분산 범위 연동
    
    this.pg.push();
    this.pg.translate(pt.x + scatterOffset, pt.y + scatterOffset);
    
    if (progress < 0.3) {
        // [1단계: 0~30%] 윤곽선 스케치
        if (pt.edge) {
            this.pg.stroke(255, 150 * ui.glow);
            this.pg.strokeWeight(p.random(0.5, 1.5) * (ui.glow * 2));
            this.pg.point(0, 0);
        }
    } else if (progress < 0.6) {
        // [2단계: 30~60%] 윤곽선 안쪽 면 채우기
        if (!pt.edge) {
            this.pg.noStroke();
            this.pg.fill(pt.r, pt.g, pt.b, alpha);
            let rectSize = 6 * ui.glow * (ui.scatter > 0 ? ui.scatter : 1);
            this.pg.rect(0, 0, rectSize, rectSize);
        }
    } else {
        // [3단계: 60~80%] 전체 정밀 묘사 덧칠
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
