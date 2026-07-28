/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [버전] Ver 2.4 (격자 반복 무늬 해결 및 8중 노이즈 레이어 중첩 충돌 필터 엔진 탑재)
 * - 대칭/반복 좌표계를 완전히 제거하고 독립된 8단계 주파수(Octaves) FBM 레이어 합성
 * - 지형변경(ui.seed) 시 전체 난수 흐름 재배치, 분산범위(ui.scatter) 조작 시 중첩 충돌 임계값 필터링 구현
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; 
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "017호 FBM Cloud Generator Ver 2.4";
    
    this.timeX = 0;
    this.timeY = 0;
    this.isAudioActive = false; 
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
        this.cloudImg = p.createImage(Math.floor(p.width / 2.5), Math.floor(p.height / 2.5));
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
      
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, // 5 ~ 50 범위
          glow: glowSlider ? parseFloat(glowSlider.value) : 85, // 10 ~ 250 범위
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon'
      };
  }

  // 💡 [핵심 개조] 인위적인 반복을 완전히 깨부수는 8단계 멀티 중첩(8-Octave) 프랙탈 노이즈 수식
  get8LayerNoise(x, y, p, midBump, zoomFactor, seed) {
    let totalNoise = 0;
    let amplitude = 1.0;
    let frequency = 0.006 * zoomFactor;
    let maxValue = 0; 
    
    // 음악 비트에 따른 가변 기류 속도 매핑
    let flowX = this.timeX * 0.2;
    let flowY = this.timeY * 0.1;

    // 💡 8개의 레이어를 고유 가중치와 위상 오프셋으로 중첩 연산 (회원님 기획 내용 주입)
    for (let i = 0; i < 8; i++) {
      // 레이어마다 임의의 무작위 궤적 시드를 부여해 대칭/격자 현상을 소멸시킵니다.
      let offsetX = p.noise(i * 15.7 + seed) * 1000;
      let offsetY = p.noise(i * 23.4 - seed) * 1000;
      
      let n = p.noise(
        x * frequency + flowX + offsetX, 
        y * frequency + flowY + offsetY
      );
      
      totalNoise += n * amplitude;
      maxValue += amplitude;
      
      frequency *= 2.13; // 주파수를 잘게 쪼개어 미세한 털구름 질감 유도
      amplitude *= 0.47; // 고주파 레이어일수록 영향력을 약화시켜 밸런스 유지
    }

    // 0.0 ~ 1.0 범위로 정규화 반환
    return totalNoise / maxValue;
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

    // 자연 기류 난류 시뮬레이션 속도 가동
    let windSpeed = (0.0015 + high * 0.01) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.25;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // Glow & Size 슬라이더 기반 카메라 공간 줌 아웃 매핑 밸런스 패치
    let zoomFactor = p.map(ui.glow, 10, 250, 0.3, 3.5);

    // 날씨 컬러 매핑
    let skyColor, cloudColor;

    if (ui.style.includes('monochrome')) {
        skyColor = p.color(18, 26, 38);
        cloudColor = p.color(125, 130, 140); 
    } else if (ui.style.includes('neon')) {
        let topH = p.color(15, 80, 175);
        let botH = p.color(75, 145, 230);
        skyColor = p.lerpColor(topH, botH, low);
        cloudColor = p.color(252, 253, 255); 
    } else if (ui.style.includes('pastel')) {
        let dawnTop = p.color(50, 18, 100);
        let dawnBot = p.color(230, 85, 35);
        skyColor = p.lerpColor(dawnTop, dawnBot, low * 1.1);
        cloudColor = p.color(255, 225, 190); 
    } else if (ui.style.includes('full-random')) {
        p.randomSeed(ui.seed * 20);
        skyColor = p.color(p.random(10, 60), p.random(20, 60), p.random(120, 190));
        cloudColor = p.color(p.random(200, 255), p.random(200, 255), p.random(200, 255));
    } else {
        skyColor = p.color(12, 16, 22);
        cloudColor = p.color(0, 230, 255);
    }

    let step = 2; 

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        let midBump = mid * 1.5;
        
        // 💡 8중 옥타브 연산 호출
        let fbmVal = this.get8LayerNoise(x, y, p, midBump * ui.burst, zoomFactor, ui.seed);

        // 💡 [회원님 기획안 완벽 연동] Center Scatter(5 ~ 50) 슬라이더를 겹친 레이어의 '중복 충돌 허용 임계 커트라인'으로 개조
        // 슬라이더가 우측으로 갈수록 다중 중복 영역만 타격되어 구름 묘사가 아주 선명하고 날카로워집니다.
        let densityThreshold = p.map(ui.scatter, 5, 50, 0.38, 0.62) - (mid * 0.08);
        
        let density = Math.max(0, fbmVal - densityThreshold);
        let cloudIntensity = Math.min(1.0, density * 6.5); // 알파 레이어 혼합 부드러움 증폭

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
      this.cloudImg = this.p5Instance.createImage(Math.floor(w / 2.5), Math.floor(h / 2.5));
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    this.cloudImg = null; 
  }
}
