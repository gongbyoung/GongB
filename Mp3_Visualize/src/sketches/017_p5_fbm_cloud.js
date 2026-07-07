/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [버전] Ver 1.6 (구름 밀림 현상 방지 및 위치/방향/스케일 중심점 완벽 보정)
 * - 순환형 기류 필드 적용으로 구름이 화면 밖으로 이탈하지 않고 중앙을 중심으로 풍성하게 순환 연산
 * - Glow & Size 슬라이더 기반 10배 줌 인/아웃 카메라 엔진 및 날씨 팔레트 통합형
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "017호 FBM Cloud Generator Ver 1.6";
    
    this.timeX = 0;
    this.timeY = 0;
    this.simulatedProgress = 0;
    this.lastProgress = 0;
    
    this.isAudioActive = false; 
    this.lastStyle = null;
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

  // 💡 [방향/스케일 보정] 화면 중심점을 기준으로 스케일을 축소/확대하는 정밀 워핑 엔진
  warpNoise(x, y, p, midBump, zoomFactor, cx, cy) {
    // 중앙 지향성 좌표계로 변환하여 구름이 한쪽 가장자리로 밀리지 않게 방어합니다.
    let nx = (x - cx) * 0.005 * zoomFactor;
    let ny = (y - cy) * 0.005 * zoomFactor;
    
    // 순환용 흐름 기류 주입
    let tx = this.timeX * 0.5;
    let ty = this.timeY * 0.5;
    
    // 1차 프랙탈 왜곡 필드
    let ox = p.noise(nx + tx, ny + 11.3) * 4.0;
    let oy = p.noise(nx + 7.1, ny + ty) * 4.0;

    // 2차 프랙탈 왜곡 필드 (비트 반응형 형태 워핑 디테일)
    let warpStr = 2.0 + (midBump * 4.0);
    let ox2 = p.noise(nx + ox + tx * 1.5, ny + oy + 42.1) * warpStr;
    let oy2 = p.noise(nx + ox + 17.8, ny + oy + ty * 1.5) * warpStr;
    
    // 최종 프랙탈 밀도 합성
    let fbmFreq = 1.2;
    return p.noise((nx + ox2) * fbmFreq, (ny + oy2) * fbmFreq);
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

    // 주파수 매핑 기본값 및 Fallback 안정화
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

    // 흐르는 대기 속도 가속화
    let windSpeed = (0.003 + high * 0.015) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.3;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;
    
    let centerX = w / 2;
    let centerY = h / 2;

    // 💡 [스케치 비율 보정] 슬라이더 수치에 부합하는 정밀 줌아웃 배율 계산식 재배치
    let zoomFactor = p.map(ui.glow, 10, 250, 2.5, 0.3);

    // 날씨 컬러 매핑
    let skyColor, cloudColor;
    let colorGlow = p.map(ui.glow, 10, 250, 0.6, 1.1);

    if (ui.style.includes('monochrome')) {
        skyColor = p.color(20 * colorGlow, 30 * colorGlow, 45 * colorGlow);
        cloudColor = p.color(125, 130, 140); 
    } else if (ui.style.includes('neon')) {
        let topH = p.color(15 * colorGlow, 85 * colorGlow, 180 * colorGlow);
        let botH = p.color(80 * colorGlow, 150 * colorGlow, 235 * colorGlow);
        skyColor = p.lerpColor(topH, botH, low);
        cloudColor = p.color(250, 252, 255); 
    } else if (ui.style.includes('pastel')) {
        let dawnTop = p.color(55 * colorGlow, 20 * colorGlow, 105 * colorGlow);
        let dawnBot = p.color(235 * colorGlow, 90 * colorGlow, 40 * colorGlow);
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.1);
        cloudColor = p.color(255, 220, 185); 
    } else if (ui.style.includes('full-random')) {
        p.randomSeed(ui.seed * 15);
        skyColor = p.color(p.random(10, 70), p.random(20, 70), p.random(130, 210));
        cloudColor = p.color(p.random(190, 255), p.random(190, 255), p.random(190, 255));
    } else {
        skyColor = p.color(15 * colorGlow, 18 * colorGlow, 25 * colorGlow);
        cloudColor = p.color(0, 230, 255);
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let midBump = mid * 1.5;
        // 💡 중앙 좌표값(centerX, centerY)을 함께 주입하여 방향성과 밸런스를 고정합니다.
        let fbmVal = this.warpNoise(x, y, p, midBump * ui.burst, zoomFactor, centerX, centerY);

        // 분산 범위 슬라이더 연동 강도 최적화
        let densityOffset = p.map(ui.scatter, 5, 50, 0.15, -0.2);
        let cloudThreshold = 0.32 - (mid * 0.1) + densityOffset;
        
        let density = Math.max(0, fbmVal - cloudThreshold);
        let cloudIntensity = Math.min(1.0, density * 4.5); // 알파 레이어링 밀도 증폭

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
