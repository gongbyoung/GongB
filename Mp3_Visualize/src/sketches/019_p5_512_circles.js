/**
 * src/sketches/019_p5_512_circles.js
 * - [버전] Ver 1.2 (5대 Color Style 파레트 형태/물리 드로잉 전면 개조 완결판)
 * - Color Style 선택창에 따라 1:속빈원, 2:속찬원, 3:랜덤색상+증강원, 4:랜덤버튼네모, 5:호수 빗방울 동심원 모드 완벽 연동
 * - 512채널 균일 격자 베이스 및 전체 바უნ더리 크기(ui.scatter) 제어 시스템 유지
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5512CirclesStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "019호 기하학 5대 스타일 엔진 Ver 1.2";
    this.isAudioActive = false;
    
    this.particles = [];
    this.totalChannels = 512;
    
    // 💡 5번 [호수 동심원 모드] 전용 파동 관리 링 배열 생성
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
        p.colorMode(p.HSB, 360, 100, 100, 255); // 화려한 무작위 랜덤 색상 구현을 위해 HSB 모드로 빌드
        
        this.generateUniformGridNodes(p.width, p.height);
        p.noLoop();
      };

      p.draw = () => {
        // HSB 모드 기준의 딥 블랙 밤하늘 배경 배정
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
          baseSize: 10,       
          seedColor: Math.floor(p5.prototype.random(360)) // 각 입자의 고유 무작위 컬러 시드
        });
      }
    }
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
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
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon' // 5대 파레트 감지
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

    p.text("🎨 [Color Style 선택창] 버튼을 눌러 모드를 변경하세요:", startX, startY);
    p.text("• Neon: 속빈 원 / • Monochrome: 속찬 원", startX, startY + 22);
    p.text("• Pastel: 랜덤색상 + 다중 증강원 / • Full-Random: 랜덤 속찬 네모 버튼", startX, startY + 44);
    
    p.fill(45, 90, 100); 
    p.text("• Custom Selector: 호수의 빗방울 동심원 파동 무대 가동 (추천!)", startX, startY + 68);
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
    let hasRaw = rawData.length >= 128;

    let centerX = p.width / 2;
    let centerY = p.height / 2;

    // 분산범위 연동전체 스케일 바운더리 박스 배율
    let arrayScale = p.map(ui.scatter, 5, 50, 0.35, 1.45);

    // 💡 5번 [호수 동심원 모드] 전용 실시간 파동 링 드로잉 및 소멸 루프 처리
    if (ui.style.includes('custom')) {
      for (let k = this.ripples.length - 1; k >= 0; k--) {
        let rip = this.ripples[k];
        p.push();
        p.noFill();
        p.strokeWeight(p.map(rip.alpha, 255, 0, 2.0, 0.5));
        // 비떨어지는 파동 링 렌더링
        p.stroke(rip.hue, 80, 95, rip.alpha);
        p.circle(rip.x, rip.y, rip.size);
        p.pop();

        // 수면 파동 확장 및 페이드아웃 속도 물리 공식
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
        let rawIdx = Math.floor(p.map(i, 0, this.totalChannels, 0, rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        freqVolume = p.noise(i * 0.03, p.millis() * 0.002) * 0.45;
      }

      freqVolume *= ui.burst;

      if (freqVolume > 0.01) {
        // 지형변경(ui.seed) 연동 무작위 위치 왜곡 계산
        p.noiseSeed(ui.seed + i);
        let randomDistortX = (p.noise(i * 5.2) - 0.5) * (ui.seed * 3.5);
        let randomDistortY = (p.noise(i * 8.7) - 0.5) * (ui.seed * 3.5);

        let finalX = centerX + (node.origOffsetX * arrayScale) + randomDistortX;
        let finalY = centerY + (node.origOffsetY * arrayScale) + randomDistortY;

        // 크기 슬라이더 기반 반지름 최대 팽창폭
        let currentRadius = node.baseSize + (freqVolume * (ui.glow * 1.2));
        let alpha = p.map(freqVolume, 0.01, 1.0, 40, 255);

        // 💡 [회원님 기획 내용 주입] Color Style Palette 단추 메뉴를 드로잉 모드로 연동 바인딩
        p.push();

        if (ui.style.includes('neon')) {
          // 1️⃣ 모드: 속빈 동그라미
          p.noFill();
          p.strokeWeight(p.map(freqVolume, 0.01, 1.0, 1.0, 3.0));
          p.stroke(170, 85, 95, alpha); // 네온 민트블루 고정
          p.circle(finalX, finalY, currentRadius * 2);

        } else if (ui.style.includes('monochrome')) {
          // 2️⃣ 모드: 속찬 동그라미
          p.noStroke();
          p.fill(200, 80, 90, alpha * 0.8); // 묵직한 딥블루 고정
          p.circle(finalX, finalY, currentRadius * 2);

        } else if (ui.style.includes('pastel')) {
          // 3️⃣ 모드: 속빈 동그라미 + 랜덤 색상 + [증강 동그라미 방식 개조]
          p.noFill();
          p.strokeWeight(1.2);
          
          // 볼륨 강도에 부합하여 다중 동심 서클들이 레이어로 추가 증강 형성됩니다.
          int ringsCount = Math.floor(p.map(freqVolume, 0.01, 1.0, 1, 5));
          for(int r = 1; r <= 5; r++) {
             if (r <= ringsCount) {
               // 링 레이어마다 개별 랜덤 색상 투영
               p.stroke((node.seedColor + r * 30) % 360, 80, 95, alpha);
               p.circle(finalX, finalY, (node.baseSize + (r * (ui.glow * 0.25))) * 2);
             }
          }

        } else if (ui.style.includes('full-random')) {
          // 4️⃣ 모드: 속이 꽉 찬 네모 (랜덤 색상 - 버튼 모양 반짝이기)
          p.noStroke();
          p.rectMode(p.CENTER);
          p.fill(node.seedColor, 85, 95, alpha); // 버튼 고유 무작위 네온색
          
          let btnSize = currentRadius * 1.6;
          p.rect(finalX, finalY, btnSize, btnSize, 3); // 둥근 모서리 버튼형 네모

        } else if (ui.style.includes('custom')) {
          // 5️⃣ 모드: 호수에 비 떨어지듯이 동심원 퍼트리기 파이프라인 트리거
          // 특정 강력 비트 주파수가 타격될 때 파동 오브젝트를 배열에 실시간 생성 사출합니다.
          if (freqVolume > 0.65 && p.random(1.0) > 0.94) {
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
