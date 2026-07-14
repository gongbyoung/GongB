/**
 * src/sketches/019_p5_512_circles.js
 * - [버전] Ver 2.0 (HTML5 native 이미지 가속 배경 및 512채널 독립 매핑 서클 엔진)
 * - 불안정하던 MutationObserver 추적 장치를 완전히 철폐하고 window.currentUploadedImageElement 직접 바인딩
 * - p.drawingContext.drawImage() 가속 엔진 시공으로 VRAM 과부하 및 이미지 유실 원천 해제
 * - 512채널 독립 분할 파이프라인 및 5대 지오메트리 오가닉 스타일 스위칭 매커니즘 보존
 * - 30FPS 타겟팅 진단 HUD 연동 인터페이스 탑재 완료
 */
export default class P5512CirclesStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.version = "019호 배경가속 서클 엔진 Ver 2.0";
    this.isAudioActive = false;
    
    this.particles = [];
    this.totalChannels = 512;
    this.ripples = [];

    this.lastTime = 0;
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
        canvas.style('left', '0px');
        canvas.style('top', '0px');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 255); 
        
        // 인스턴스 안전 전달을 위해 p 매개변수 주입 크래시 완치
        this.generateUniformGridNodes(p);
        p.noLoop();
      };

      p.draw = () => {
        // 💡 [버그 완치 핵심]: 업로드된 배경 이미지가 존재하면 브라우저 native 2D 그래픽 컨텍스트로 최하단 배경에 즉시 인젝션
        if (window.currentUploadedImageElement) {
          p.drawingContext.drawImage(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        } else {
          p.background(220, 30, 7, 255); // 묵직한 명상형 미드나잇 다크블루 이징
        }

        // 진단 HUD 로거 기본 패널 바인딩
        if (!this.lastTime) this.lastTime = performance.now();
        let now = performance.now();
        let fps = Math.round(1000 / (now - this.lastTime));
        this.lastTime = now;

        window.sketchDiagnostics = {
          fps: isNaN(fps) || fps > 100 ? 30 : fps,
          particleCount: this.particles.length + this.ripples.length,
          isCovering: false,
          activeFunction: window.currentUploadedImageElement ? "Grid[BG_Accelerated]" : "Grid[Core_Active]"
        };

        if (!this.isAudioActive) {
          this.drawOnScreenGuide(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  generateUniformGridNodes(p) {
    this.particles = [];
    let cols = 16;
    let rows = 32;
    
    let spacingX = p.width / (cols + 1);
    let spacingY = p.height / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let index = r * cols + c;
        if (index >= this.totalChannels) break;

        let normX = (c + 1) * spacingX - p.width / 2;
        let normY = (r + 1) * spacingY - p.height / 2;

        this.particles.push({
          origOffsetX: normX, 
          origOffsetY: normY, 
          baseSize: 6, 
          seedColor: Math.floor(p.random(360)) 
        });
      }
    }
  }

  getUIParams() {
      const seedSlider = document.getElementById('num-cosmic-seed');
      const scatterSlider = document.getElementById('num-cosmic-scatter');
      const glowSlider = document.getElementById('num-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('num-cosmic-gain');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85, 
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon' 
      };
  }

  drawOnScreenGuide(p) {
    p.push();
    p.fill(170, 90, 100, 200);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`⚙️ SYSTEM STATUS: ${this.version} READY`, 20, 20);

    p.fill(220, 40, 12, 230);
    p.stroke(170, 80, 100, 120);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(p.width / 2, p.height / 2, p.width * 0.85, 220, 10);

    p.noStroke();
    p.fill(170, 90, 100);
    p.textSize(16);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Cosmic Studio 019호 배경 합성 하이브리드 Stage", p.width / 2, p.height / 2 - 70);

    p.fill(0, 0, 90);
    p.textSize(11);
    p.textAlign(p.LEFT, p.CENTER);
    
    let startX = p.width / 2 - (p.width * 0.38);
    let startY = p.height / 2 - 20;

    p.text("📸 [순서 무관] 좌측 패널에 BG/Texture 배경 이미지를 자유롭게 업로드하세요.", startX, startY);
    p.text("• 업로드 즉시 하늘/호수 바탕으로 자동 깔리며, 그 위로 512 채널 입자들이 연동됩니다.", startX, startY + 22);
    p.text("• Neon: 속빈 원 / • Monochrome: 속찬 원 / • Pastel: 증강 동심원", startX, startY + 44);
    p.fill(45, 90, 100); 
    p.text("• Custom Selector: 호수의 빗방울 동심원 파동 무대 가동", startX, startY + 68);
    p.pop();
  }

  resetCanvas(p, isPreview = false) {
    if (this.p5Instance) this.p5Instance.redraw(); 
  }

  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        this.isAudioActive = false;
        p.redraw();
        return;
    }

    // 💡 매 프레임 오디오 시각화 갱신 전 하드웨어 레이어 배경 복사
    if (window.currentUploadedImageElement) {
      p.drawingContext.drawImage(window.currentUploadedImageElement, 0, 0, p.width, p.height);
    } else {
      p.background(220, 30, 7, 255);
    }

    const ui = this.getUIParams();
    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length > 10;

    let centerX = p.width / 2;
    let centerY = p.height / 2;
    let arrayScale = p.map(ui.scatter, 5, 50, 0.35, 1.45);

    // Custom [호수의 동심원 빗방울 모드] 실시간 연산선 전개
    if (ui.style.includes('custom')) {
      for (let k = this.ripples.length - 1; k >= 0; k--) {
        let rip = this.ripples[k];
        p.push();
        p.noFill();
        p.strokeWeight(p.map(rip.alpha, 255, 0, 2.0, 0.5));
        p.stroke(rip.hue, 80, 95, rip.alpha);
        p.circle(rip.x, rip.y, rip.size);
        p.pop();

        rip.size += 3.2;
        rip.alpha -= 3.8;
        if (rip.alpha <= 0) {
          this.ripples.splice(k, 1);
        }
      }
    }

    for (let i = 0; i < this.totalChannels; i++) {
      let node = this.particles[i];
      if (!node) continue;

      let freqVolume = 0;
      if (hasRaw) {
        let ratio = i / this.totalChannels;
        let rawIdx = Math.floor(ratio * (rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        freqVolume = p.noise(i * 0.05, p.millis() * 0.002) * 0.4;
      }

      freqVolume *= ui.burst;

      if (freqVolume > 0.25) {
        p.noiseSeed(ui.seed + i);
        let randomDistortX = (p.noise(i * 5.2) - 0.5) * (ui.seed * 3.5);
        let randomDistortY = (p.noise(i * 8.7) - 0.5) * (ui.seed * 3.5);

        let finalX = centerX + (node.origOffsetX * arrayScale) + randomDistortX;
        let finalY = centerY + (node.origOffsetY * arrayScale) + randomDistortY;

        let normVol = p.map(freqVolume, 0.25, 1.0, 0.0, 1.0);
        let currentRadius = node.baseSize + (normVol * (ui.glow * 0.9));
        let alpha = p.map(normVol, 0.0, 1.0, 60, 255);

        p.push();

        if (ui.style.includes('neon')) {
          p.noFill();
          p.strokeWeight(p.map(normVol, 0.0, 1.0, 0.8, 2.5));
          p.stroke(170, 85, 95, alpha); 
          p.circle(finalX, finalY, currentRadius * 2);

        } else if (ui.style.includes('monochrome')) {
          p.noStroke();
          p.fill(200, 80, 90, alpha * 0.85); 
          p.circle(finalX, finalY, currentRadius * 2);

        } else if (ui.style.includes('pastel')) {
          p.noFill();
          p.strokeWeight(1.0);
          let ringsCount = Math.floor(p.map(normVol, 0.0, 1.0, 1, 4));
          for(let r = 1; r <= 4; r++) {
             if (r <= ringsCount) {
               p.stroke((node.seedColor + r * 35) % 360, 80, 95, alpha);
               p.circle(finalX, finalY, (node.baseSize + (r * (ui.glow * 0.2))) * 2);
             }
          }

        } else if (ui.style.includes('full-random')) {
          p.noStroke();
          p.rectMode(p.CENTER);
          p.fill(node.seedColor, 85, 95, alpha); 
          let btnSize = currentRadius * 1.4;
          p.rect(finalX, finalY, btnSize, btnSize, 2); 

        } else if (ui.style.includes('custom')) {
          if (normVol > 0.65 && p.random(1.0) > 0.96) {
            this.ripples.push({
              x: finalX,
              y: finalY,
              size: 2,
              alpha: 255,
              hue: node.seedColor
            });
          }
        }

        p.pop();
      }
    }
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      this.generateUniformGridNodes(this.p5Instance);
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    this.particles = [];
    this.ripples = [];
  }
}
