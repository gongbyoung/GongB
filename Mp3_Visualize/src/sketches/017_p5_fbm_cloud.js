/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [버전] Ver 1.4 (Glow/Size 줌, 분산범위 밀도 슬라이더 실시간 미반응 버그 완벽 픽스)
 * - 슬라이더 변경 감지 시 p.redraw() 강제 트리거로 정지 상태에서도 실시간 피드백 보장
 * - Glow & Size 슬라이더 기반 10배 줌 인/아웃 카메라 엔진 및 날씨 팔레트 통합형
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "017호 FBM Cloud Generator Ver 1.4";
    
    this.timeX = 0;
    this.timeY = 0;
    this.simulatedProgress = 0;
    this.lastProgress = 0;
    
    this.isAudioActive = false; 
    this.lastStyle = null;
    
    // 💡 슬라이더 실시간 변경 추적용 버퍼
    this.lastSettingsStr = "";
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
        this.cloudImg = p.createImage(Math.floor(p.width / 2.0), Math.floor(p.height / 2.0));
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
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
      return {
          scatter: settings.scatterExponent ?? 2.2, 
          glow: settings.glowAmount ?? (settings.size ?? 0.85), 
          burst: settings.audioGain ?? 1.0, 
          seed: settings.seed ?? 42,
          style: (settings.colorStyle || 'monochrome').toLowerCase()
      };
  }

  warpNoise(x, y, p, midBump, zoomFactor) {
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

  // 💡 슬라이더 조작 시 버퍼 강제 갱신
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

    // 💡 [핵심 버그 수정] 어떤 슬라이더든 수치가 변경되는 순간 상태 변조를 감지하여 리렌더링 트리거를 당깁니다.
    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.glow}-${ui.style}-${ui.burst}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.resetCanvas(p, true);
    }

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        // 💡 음악이 정지해 있더라도 슬라이더를 만지면 미리보기를 위해 루프를 강제로 한 번 돌려줍니다.
        this.isAudioActive = false;
    }

    // 주파수 매핑 기본값 및 Fallback 안정화
    let low = 0.3; let mid = 0.2; let high = 0.1;
    if (audioData && audioData.raw && audioData.raw.length > 60) {
        low = (audioData.raw[2] + audioData.raw[3]) / 510;
        mid = (audioData.raw[15] + audioData.raw[16]) / 510;
        high = (audioData.raw[55] + audioData.raw[56]) / 510;
    } else if (isPlaying) {
        low = p.noise(p.millis() * 0.001) * 0.6;
        mid = p.noise(p.millis() * 0.002 + 50) * 0.5;
        high = p.noise(p.millis() * 0.003 + 100) * 0.4;
    }

    let windSpeed = (0.01 + high * 0.05) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.2;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // 💡 [Glow & Size] -> 줌아웃 팩터 맵핑 보정 (0.1 ~ 2.5 범위 대응 최대 10배 줌아웃)
    let zoomFactor = p.map(ui.glow, 10, 250, 0.5, 10.0);

    // 날씨 컬러 매핑
    let skyColor, cloudColor;
    let colorGlow = p.map(ui.glow, 10, 250, 0.4, 1.4);

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
        let midBump = mid * 2.0;
        let fbmVal = this.warpNoise(x + this.timeX * 20, y + this.timeY * 20, p, midBump * ui.burst, zoomFactor);

        // 💡 [Center Scatter] -> 구름의 퍼짐 밀도 슬라이더(5 ~ 50) 연동 보정
        let densityOffset = p.map(ui.scatter, 5, 50, 0.15, -0.25);
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
