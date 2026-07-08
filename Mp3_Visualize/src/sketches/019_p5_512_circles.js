/**
 * src/sketches/019_p5_512_circles.js
 * - [버전] Ver 1.4 (512채널 독립 매핑 분할 및 노이즈 컷오프 필터 강화 완결판)
 * - 하나의 주파수가 여러 원을 동시 오염시키던 중복 매핑 버그 완전 격파
 * - 임계값 0.25 필터링으로 미세 노이즈 반응을 차단하고 낱개 단위의 깨끗한 반짝임 복원
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5512CirclesStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.version = "019호 주파수 분할 필터 Ver 1.4";
    this.isAudioActive = false;
    
    this.particles = [];
    this.totalChannels = 512;
    this.ripples = [];
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
        
        this.generateUniformGridNodes(p.width, p.height);
        p.noLoop();
      };

      p.draw = () => {
        p.background(220, 30, 7, 255);
        if (!this.isAudioActive) {
          this.drawOnScreenGuide(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  generateUniformGridNodes(w, h) {
    this.particles = [];
    let cols = 16;
    let rows = 32;
    
    let spacingX = w / (cols + 1);
    let spacingY = h / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let index = r * cols + c;
        if (index >= this.totalChannels) break;

        let normX = (c + 1) * spacingX - w / 2;
        let normY = (r + 1) * spacingY - h / 2;

        this.particles.push({
          origOffsetX: normX, 
          origOffsetY: normY, 
          baseSize: 6, // 💡 화면이 뭉개지지 않도록 기본 서클 크기를 슬림하게 다듬음
          seedColor: Math.floor(p5.prototype.random(360)) 
        });
      }
    }
  }

  getUIParams() {
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

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
    p.text("Cosmic Studio 019호 하이브리드 입자 스테이지", p.width / 2, p.height / 2 - 70);

    p.fill(0, 0, 90);
    p.textSize(11);
    p.textAlign(p.LEFT, p.CENTER);
    
    let startX = p.width / 2 - (p.width * 0.38);
    let startY = p.height / 2 - 20;

    p.text("🎨 주파수 칼분할 패치 완료! 512 대역이 낱개로 깔끔하게 쪼개집니다.", startX, startY);
    p.text("• Neon: 속빈 원 / • Monochrome: 속찬 원", startX, startY + 22);
    p.text("• Pastel: 랜덤색상 + 다중 증강원 / • Full-Random: 랜덤 속찬 네모 버튼", startX, startY + 44);
    p.fill(45, 90, 100); 
    p.text("• Custom Selector: 호수의 빗방울 동심원 파동 무대 가동", startX, startY + 68);
    p.pop();
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
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

    p.background(220, 30, 7, 255);

    const ui = this.getUIParams();
    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length > 10;

    let centerX = p.width / 2;
    let centerY = p.height / 2;
    let arrayScale = p.map(ui.scatter, 5, 50, 0.35, 1.45);

    // 5번 [호수 동심원 모드] 파동 처리 엔진
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
        // 💡 [버그 수정] 중복 몰림을 막고 512개에 정확하게 배분하는 보간 매핑 공식 고정
        let ratio = i / this.totalChannels;
        let rawIdx = Math.floor(ratio * (rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        freqVolume = p.noise(i * 0.05, p.millis() * 0.002) * 0.4;
      }

      freqVolume *= ui.burst;

      // 💡 [핵심 패치] 노이즈 컷오프 임계값을 0.25로 상향하여, 확실한 비트에만 개별적으로 반짝이게 격리
      if (freqVolume > 0.25) {
        p.noiseSeed(ui.seed + i);
        let randomDistortX = (p.noise(i * 5.2) - 0.5) * (ui.seed * 3.5);
        let randomDistortY = (p.noise(i * 8.7) - 0.5) * (ui.seed * 3.5);

        let finalX = centerX + (node.origOffsetX * arrayScale) + randomDistortX;
        let finalY = centerY + (node.origOffsetY * arrayScale) + randomDistortY;

        // 볼륨 신호 범위 축소 보정
        let normVol = p.map(freqVolume, 0.25, 1.0, 0.0, 1.0);
        let currentRadius = node.baseSize + (normVol * (ui.glow * 0.9));
        let alpha = p.map(normVol, 0.0, 1.0, 50, 255);

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
      this.generateUniformGridNodes(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
  }
}
