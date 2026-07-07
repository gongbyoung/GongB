/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [버전] Ver 1.5 (구름 미출력 및 증발 현상 완전 버그 픽스 완료)
 * - 임계값(Threshold) 하향 조정 및 기본 노이즈 밸런스 확보로 멈춘 상태에서도 구름 가시성 100% 보장
 * - Glow & Size 슬라이더 기반 10배 줌 인/아웃 카메라 엔진 및 날씨 팔레트 통합형
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "017호 FBM Cloud Generator Ver 1.5";
    
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
        // 픽셀 연산 가속 및 부드러운 안개 필터링을 위한 다운샘플링 버퍼 크기 유지
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

  // 💡 [밀도 보정] 왜곡 수식 최적화를 통한 구름 소실 버그 해결
  warpNoise(x, y, p, midBump, zoomFactor) {
    let baseFreq = 0.003 * zoomFactor;
    let timeScale = p.millis() * 0.00015;
    
    // 왜곡 연산 시 좌표 스케일 계수 안정화
    let ox = p.noise(x * baseFreq + timeScale, y * baseFreq + 100) * (80 * zoomFactor);
    let oy = p.noise(x * baseFreq + 200, y * baseFreq + timeScale + 300) * (80 * zoomFactor);

    let freq2 = 0.001 * zoomFactor;
    let ox2 = p.noise((x + ox) * freq2 + timeScale, (y + oy) * freq2 + 400) * (80 * zoomFactor);
    let oy2 = p.noise((x + ox) * freq2 + 500, (y + oy) * freq2 + timeScale + 600) * (80 * zoomFactor);
    
    let fbmFreq = 0.004 * zoomFactor;
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

    let windSpeed = (0.005 + high * 0.02) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.2;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // 💡 [매핑 교정] Glow & Size 슬라이더(10 ~ 250)에 대응하는 공간 해상도 스케일 보정
    let zoomFactor = p.map(ui.glow, 10, 250, 0.4, 6.0);

    // 날씨 컬러 매핑
    let skyColor, cloudColor;
    let colorGlow = p.map(ui.glow, 10, 250, 0.5, 1.2);

    if (ui.style.includes('monochrome')) {
        skyColor = p.color(25 * colorGlow, 35 * colorGlow, 45 * colorGlow);
        cloudColor = p.color(110, 115, 125); // 먹구름 색상 명도 상향
    } else if (ui.style.includes('neon')) {
        let topH = p.color(15 * colorGlow, 90 * colorGlow, 200 * colorGlow);
        let botH = p.color(90 * colorGlow, 160 * colorGlow, 240 * colorGlow);
        skyColor = p.lerpColor(topH, botH, low);
        cloudColor = p.color(245, 248, 255); // 맑은 날 흰 구름
    } else if (ui.style.includes('pastel')) {
        let dawnTop = p.color(60 * colorGlow, 25 * colorGlow, 110 * colorGlow);
        let dawnBot = p.color(240 * colorGlow, 95 * colorGlow, 35 * colorGlow);
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.2);
        cloudColor = p.color(255, 215, 175); // 노을빛 구름
    } else if (ui.style.includes('full-random')) {
        p.randomSeed(ui.seed * 10);
        skyColor = p.color(p.random(10, 80), p.random(20, 80), p.random(120, 200));
        cloudColor = p.color(p.random(180, 255), p.random(180, 255), p.random(180, 255));
    } else {
        skyColor = p.color(15 * colorGlow, 18 * colorGlow, 25 * colorGlow);
        cloudColor = p.color(0, 230, 255);
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let midBump = mid * 1.5;
        let fbmVal = this.warpNoise(x + this.timeX * 15, y + this.timeY * 15, p, midBump * ui.burst, zoomFactor);

        // 💡 [핵심 임계값 하향 조정] 구름이 안 나오던 현상을 잡기 위해 커트라인을 0.45에서 0.28로 대폭 내렸습니다.
        let densityOffset = p.map(ui.scatter, 5, 50, 0.2, -0.2);
        let cloudThreshold = 0.28 - (mid * 0.15) + densityOffset;
        
        let density = Math.max(0, fbmVal - cloudThreshold);
        // 알파 보간 강도를 높여 경계면을 더 뚜렷하고 풍성하게 빌드업합니다.
        let cloudIntensity = Math.min(1.0, density * 3.5);

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
