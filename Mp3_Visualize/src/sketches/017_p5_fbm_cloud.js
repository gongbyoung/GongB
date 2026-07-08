/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [버전] Ver 2.3 (화면 비율 고정, 순수 구름 입자 스케일 공간 줌 인/아웃 변환 버그 완전 해결)
 * - 캔버스 크기를 줄이던 하위 레이어 스케일 방식 완전 폐기
 * - Glow & Size 슬라이더 제어 시 9:16 프레임은 꽉 찬 상태를 유지하며 내부 구름 주파수만 멀리서 보듯 미세화 처리
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "017호 FBM Cloud Generator Ver 2.3";
    
    this.timeX = 0;
    this.timeY = 0;
    this.isAudioActive = false; 
    this.lastSettingsStr = "";
    
    // 기본 해상도 주파수 베이스
    this.baseFreq = 0.015;
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
        // 고해상도 구름 묘사를 위해 버퍼 밀도를 확보합니다.
        this.cloudImg = p.createImage(Math.floor(p.width / 2.0), Math.floor(p.height / 2.0));
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        // 💡 [의도 교정] 무대 크기는 100% 꽉 채운 상태를 언제나 고정 유지합니다.
        if (this.cloudImg) {
          p.image(this.cloudImg, 0, 0, p.width, p.height);
        }
        
        if (!this.isAudioActive) {
          this.drawOnScreenGuide(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : (settings.scatterExponent ?? 22), 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85, // 10 ~ 250 날 데이터 추적
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon'
      };
  }

  // 💡 [공간 주파수 줌 변환 메커니즘 개정] 
  // zoomFactor가 커질수록 구름 수학 패턴이 정밀하게 쪼개져 멀리서 보는 효과를 냅니다.
  warpNoise(x, y, p, midBump, zoomFactor, cx, cy) {
    let nx = (x - cx) * this.baseFreq * zoomFactor;
    let ny = (y - cy) * this.baseFreq * zoomFactor;
    
    let tx = this.timeX * 0.3;
    let ty = this.timeY * 0.3;
    
    let ox = p.noise(nx + tx, ny + 11.3) * 2.5;
    let oy = p.noise(nx + 7.1, ny + ty) * 2.5;

    let warpStr = 1.2 + (midBump * 3.5);
    let ox2 = p.noise(nx + ox + tx, ny + oy + 42.1) * warpStr;
    let oy2 = p.noise(nx + ox + 17.8, ny + oy + ty) * warpStr;
    
    return p.noise(nx + ox2, ny + oy2);
  }

  drawOnScreenGuide(p) {
    p.push();
    p.fill(0, 255, 204, 200);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`⚙️ SYSTEM STATUS: ${this.version} READY`, 20, 20);

    p.fill(10, 12, 18, 220);
    p.stroke(50, 55, 75);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(p.width / 2, p.height / 2, p.width * 0.85, 220, 10);

    p.noStroke();
    p.fill(0, 255, 204);
    p.textSize(20);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Cosmic Studio 017호 구름 엔진 사용 방법", p.width / 2, p.height / 2 - 75);

    p.fill(220);
    p.textSize(13);
    p.textAlign(p.LEFT, p.CENTER);
    
    let startX = p.width / 2 - (p.width * 0.38);
    let startY = p.height / 2 - 25;
    let lineSpacing = 32;

    p.text("1️⃣  [좌측 최상단] MP3 음악 파일을 가장 먼저 로딩하세요.", startX, startY);
    p.text("2️⃣  [우측 패널] Color Style Palette에서 날씨(먹구름, 맑은하늘, 노을)를 고르세요.", startX, startY + lineSpacing);
    
    p.fill(255, 204, 0); 
    p.text("3️⃣  [하단 컨트롤] 오디오 플레이어의 재생(▶) 버튼을 누르면 구름이 피어오릅니다!", startX, startY + lineSpacing * 2);

    p.fill(120);
    p.textSize(11);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("음악이 재생되면 이 안내창은 자동으로 사라지고 시뮬레이션 영상이 출력됩니다.", p.width / 2, p.height / 2 + 75);
    p.pop();
  }

  resetCanvas(p, isPreview = false) {
    if(!this.cloudImg) return;
    this.isPreviewMode = isPreview;
    p.redraw(); 
  }

  update(audioData) {
    if (!this.p5Instance || !this.cloudImg) return;
    let p = this.p5Instance;
    const ui = this.getUIParams();

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.glow}-${ui.style}-${ui.burst}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.resetCanvas(p, true);
    }

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        this.isAudioActive = false;
    }

    let low = 0.3; let mid = 0.2; let high = 0.1;
    if (audioData && audioData.raw && audioData.raw.length > 60) {
        low = (audioData.raw[2] + audioData.raw[3]) / 510;
        mid = (audioData.raw[15] + audioData.raw[16]) / 510;
        high = (audioData.raw[55] + audioData.raw[56]) / 510;
    } else if (isPlaying) {
        low = p.noise(p.millis() * 0.001) * 0.5;
        mid = p.noise(p.millis() * 0.002 + 50) * 0.4;
        high = p.noise(p.millis() * 0.003 + 100) * 0.3;
    }

    let windSpeed = (0.003 + high * 0.015) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.3;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;
    
    let centerX = w / 2;
    let centerY = h / 2;

    // 💡 [수식 전면 개정] 슬라이더 수치에 따라 순수 공간의 배율 주파수 계수를 설계합니다.
    // 10일 때는 0.2배 크기로 패턴이 뭉뚱그려져 커지고(줌인), 250일 때는 4.0배 크기로 촘촘하게 쪼개집니다(줌아웃).
    let zoomFactor = p.map(ui.glow, 10, 250, 0.2, 4.0);

    // 날씨 컬러 매핑
    let skyColor, cloudColor;

    if (ui.style.includes('monochrome')) {
        skyColor = p.color(20, 30, 45);
        cloudColor = p.color(130, 135, 145); 
    } else if (ui.style.includes('neon')) {
        let topH = p.color(15, 85, 180);
        let botH = p.color(80, 150, 235);
        skyColor = p.lerpColor(topH, botH, low);
        cloudColor = p.color(250, 252, 255); 
    } else if (ui.style.includes('pastel')) {
        let dawnTop = p.color(55, 20, 105);
        let dawnBot = p.color(235, 90, 40);
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.1);
        cloudColor = p.color(255, 220, 185); 
    } else if (ui.style.includes('full-random')) {
        p.randomSeed(ui.seed * 15);
        skyColor = p.color(p.random(10, 70), p.random(20, 70), p.random(130, 210));
        cloudColor = p.color(p.random(190, 255), p.random(190, 255), p.random(190, 255));
    } else {
        skyColor = p.color(15, 18, 25);
        cloudColor = p.color(0, 230, 255);
    }

    let step = 2; 

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        let midBump = mid * 1.5;
        // 💡 줌 팩터를 노이즈 매개변수로 명확하게 이식하여 해상도는 고정한 채 구름의 정밀도만 조절합니다.
        let fbmVal = this.warpNoise(x, y, p, midBump * ui.burst, zoomFactor, centerX, centerY);

        let densityOffset = p.map(ui.scatter, 5, 50, 0.2, -0.25);
        let cloudThreshold = 0.35 - (mid * 0.12) + densityOffset;
        
        let density = Math.max(0, fbmVal - cloudThreshold);
        let cloudIntensity = Math.min(1.0, density * 5.0); 

        let finalC = p.lerpColor(skyColor, cloudColor, cloudIntensity);
        let r = p.red(finalC); let g = p.green(finalC); let b = p.blue(finalC);

        for (let j = 0; j < step && (y + j) < h; j++) {
          for (let i = 0; i < step && (x + i) < w; i++) {
            let idx = ((y + j) * w + (x + i)) * 4;
            this.cloudImg.pixels[idx]     = r;
            this.cloudImg.pixels[idx + 1] = g;
            this.cloudImg.pixels[idx + 2] = b;
            this.cloudImg.pixels[idx + 3] = 255;
          }
        }
      }
    }
    
    this.cloudImg.updatePixels();
    p.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      this.cloudImg = this.p5Instance.createImage(Math.floor(w / 2.0), Math.floor(h / 2.0));
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    this.cloudImg = null; 
  }
}
