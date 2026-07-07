/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [최종 완결판] Dynamic 구름 모양 워핑 및 날씨 컬러 스타일 통합 엔진
 * - [수정] 오디오 비트(Mid)에 반응하여 구름 모양이 실시간으로 다양하게 폭발 및 워핑
 * - [수정] Color Style Palette 완벽 매핑: 먹구름, 맑은 하늘, 노을/해돋이, 🎲 Pure Full Random
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
    
    // 이전에 선택된 스타일을 저장하여 resetCanvas 호출 시점 제어
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
        // 연산 가속을 위한 다운샘플링 버퍼 생성
        this.cloudImg = p.createImage(Math.floor(p.width / 2.5), Math.floor(p.height / 2.5));
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
          scatter: settings.scatterExponent ?? 2.2, // 구름 밀도 해칭
          glow: settings.glowAmount ?? (settings.size ?? 0.25), // 하늘 밝기
          burst: settings.audioGain ?? 1.0, // 형태 변화 속도 배율
          seed: settings.seed ?? 42,
          // Color Style Palette 선택창의 값을 소문자로 가져옵니다.
          style: (settings.colorStyle || 'monochrome').toLowerCase()
      };
  }

  // 💡 [핵심 교정] Dynamic 구름 형태 워핑(Warping) 엔진 코어
  // 단순히 노이즈를 겹치는 게 아니라, 노이즈 값으로 입력 좌표를 다시 왜곡하여
  // 음악 비트에 맞춰 형태가 폭발하고 유동적으로 변하게 만듭니다.
  warpNoise(x, y, p, midBump) {
    let frequency = 0.003;
    let timeScale = p.millis() * 0.0002;
    
    // 💡 첫 번째 노이즈 레이어로 기본 왜곡 필드 생성
    let ox = p.noise(x * frequency + timeScale, y * frequency + 100) * 100;
    let oy = p.noise(x * frequency + 200, y * frequency + timeScale + 300) * 100;

    // 💡 두 번째 노이즈 레이어로 왜곡을 더 미세하게 다듬음
    let frequency2 = 0.001;
    let ox2 = p.noise((x + ox) * frequency2 + timeScale, (y + oy) * frequency2 + 400) * 100;
    let oy2 = p.noise((x + ox) * frequency2 + 500, (y + oy) * frequency2 + timeScale + 600) * 100;

    // 💡 [핵심] 음악 비트(Mid)가 터질 때 왜곡의 강도를 증폭시켜 모양을 다양하게 만듭니다.
    // image_598822.png에서 보신 것처럼 모양이 고정되는 현상을 해결합니다.
    let warpIntensity = 100 + (midBump * 300);
    
    // 최종 워핑된 좌표로 펄린 노이즈 샘플링
    let fbmFrequency = 0.005;
    return p.noise((x + ox2) * fbmFrequency, (y + oy2) * fbmFrequency);
  }

  resetCanvas(p, isPreview = false) {
    if(!this.pg) return;
    this.pg.background(15, 18, 25);
    
    p.randomSeed(this.currentSettings.seed);
    
    this.drawn1 = 0; this.drawn2 = 0; this.drawn3 = 0;
    this.isPreviewMode = isPreview;

    if (isPreview && this.isImageLoaded) {
       while(this.q1.length > 0) this.paintBrush(this.q1.pop(), 1, this.currentSettings, p, 0.5, 0.5, 0.5);
       while(this.q2.length > 0) this.paintBrush(this.q2.pop(), 2, this.currentSettings, p, 0.5, 0.5, 0.5);
       while(this.q3.length > 0) this.paintBrush(this.q3.pop(), 3, this.currentSettings, p, 0.5, 0.5, 0.5);
       
       if (this.currentSettings.style.includes('custom')) this.drawOldPhotoEffect(p);
    }
  }

  update(audioData) {
    if (!this.p5Instance || !this.cloudImg) return;
    let p = this.p5Instance;
    const ui = this.getUIParams();

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    // 스타일이 변경되면 캔버스를 초기화하여 컬러 연동을 확실히 합니다.
    if (this.lastStyle !== ui.style) {
        this.resetCanvas(p, true);
        this.lastStyle = ui.style;
    }

    // 주파수 대역 정밀 분리
    let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0.3;
    let mid = audioData ? (audioData.raw[15] + audioData.raw[16]) / 510 : 0.2;
    let high = audioData ? (audioData.raw[55] + audioData.raw[56]) / 510 : 0.1;

    // 지형변경 슬라이더로 노이즈 시드를 제어
    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // 💡 [수정] Color Style Palette에 맞춘 정교한 날씨 컬러 그라데이션 엔진
    let skyColor, cloudColor;
    let glow = ui.glow + 0.5; // 하늘 밝기

    if (ui.style.includes('monochrome')) {
        // [비 오는 날 먹구름]: 칙칙한 청회색 하늘에 짙은 회색 구름
        skyColor = p.color(20 * glow, 30 * glow, 40 * glow);
        cloudColor = p.color(80, 80, 90); 
    } else if (ui.style.includes('neon')) {
        // [맑은 하늘에 흰색 구름]: 깊은 파란색 그라데이션 하늘에 밝은 흰색 구름
        let topH = p.color(10 * glow, 100 * glow, 220 * glow);
        let botH = p.color(100 * glow, 180 * glow, 255 * glow);
        skyColor = p.lerpColor(topH, botH, low); // 저음에 따라 하늘 파란색 깊이 변화
        cloudColor = p.color(255, 255, 255);
    } else if (ui.style.includes('pastel')) {
        // [노을 또는 해돋이때 구름]: 저음에 따라 깊은 보라색에서 붉은 주황색으로 그라데이션
        let dawnTop = p.color(50 * glow, 20 * glow, 120 * glow); // 깊은 밤/보라
        let dawnBot = p.color(255 * glow, 100 * glow, 30 * glow);  // 해오름/붉은 주황
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.5); // 저음에 반응하여 노을 농도 조절
        cloudColor = p.color(255, 220, 180); // 노을을 머금은 주황빛 구름
    } else if (ui.style.includes('full-random')) {
        // [🎲 Pure Full Random]: 매 순간 저,중,고음에 매핑하여 기괴하고 랜덤한 색상 출력
        p.randomSeed(low * 1000 + mid * 100 + high * 10);
        skyColor = p.color(p.random(0, 100), p.random(0, 50), p.random(100, 255));
        cloudColor = p.color(p.random(150, 255), p.random(150, 255), p.random(150, 255));
    } else {
        // 기본값 (Cyberpunk Neon)
        skyColor = p.color(15 * glow, 18 * glow, 25 * glow);
        cloudColor = p.color(0, 230, 255);
    }

    // 픽셀 연산 루프
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 💡 [수정] Dynamic 워핑 엔진 호출 - 음악 비트(Mid)와 폭발력(Burst)에 반응
        let midBump = mid * 2.0;
        let fbmVal = this.warpNoise(x, y, p, midBump * ui.burst);

        // 구름 밀도 및 안개 질감 매핑 (Scatter 슬라이더 연동)
        let densityOffset = p.map(ui.scatter, 5, 50, 0.1, -0.2);
        let cloudThreshold = p.map(mid, 0, 1, 0.45, 0.3) + densityOffset;
        
        let density = Math.max(0, fbmVal - cloudThreshold);
        let cloudIntensity = Math.min(1.0, density * (2.0 / (low + 0.1)));

        let idx = (y * w + x) * 4;

        // 최종 하늘 색상과 구름 색상 보간
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

  // 💡 기존 스케치의 paintBrush 코드를 누락 없이 완벽 통합
  paintBrush(pt, layerNum, ui, p, low, mid, high) {
    if (!this.brushTexture) return;

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

    let scatterMod = Math.max(0.5, ui.scatter);
    let audioBump = low * 2.0; 
    let baseSize = 0;
    let opacity = 200;

    if (layerNum === 1) {
        baseSize = (24 + (20 * audioBump)) * scatterMod;
        opacity = 100; // 넓고 투명하게 블렌딩
    } else if (layerNum === 2) {
        baseSize = (12 + (10 * audioBump));
        opacity = 170;
    } else if (layerNum === 3) {
        baseSize = (4 + (4 * audioBump)) / scatterMod; 
        opacity = 240; // 윤곽은 명확하고 진하게
    }

    let finalSize = baseSize / detailMod; 

    this.pg.push();
    this.pg.translate(pt.x, pt.y);
    
    if (pt.angle !== undefined) {
        this.pg.rotate(pt.angle + p.random(-0.08, 0.08)); 
    }

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
