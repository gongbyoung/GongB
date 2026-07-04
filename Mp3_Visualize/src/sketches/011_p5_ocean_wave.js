/**
 * 011_p5_ocean_wave.js
 * 전체 볼륨을 무시하고 오직 12개의 특정 주파수에만 반응하여 
 * 부드러운 바다 물결과 하얀 물방울(Splashes)이 튀어 오르는 p5.js 미디어 아트
 */
export default class P5OceanWaveStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 12; // 정확히 12구역
    this.targetHeights = new Float32Array(this.numBands);
    this.currentHeights = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.particles = []; // 물방울 파티클 배열
    this.currentAudioData = null;
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop(); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        
        // 1. 심해 느낌의 다크 블루 배경 그라데이션
        const ctx = p.drawingContext;
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#020208'); // 밤하늘
        bgGrad.addColorStop(0.5, '#051020'); // 수평선
        bgGrad.addColorStop(1, '#000000'); // 심해
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        if (!this.currentAudioData) return;

        let scatter = 2.2, gain = 1.0;
        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent; 
          gain = window.cosmicEngineSettings.audioGain;          
        }

        const baselineY = height * 0.7; // 바다의 기본 수위 (화면 70% 지점)

        // 💡 [전체 볼륨 무시 로직] 프레임의 전체 평균 볼륨을 구해서 빼버림 (Auto-Gain/Noise Gate)
        let frameAverage = 0;
        if (this.currentAudioData.raw) {
            let sum = 0;
            for(let i=0; i<200; i++) sum += this.currentAudioData.raw[i];
            frameAverage = (sum / 200) / 255.0;
        }

        // 💡 12개 주파수 대역 정밀 추출
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw) {
            const t = i / (this.numBands - 1);
            const binIndex = Math.floor(2 + Math.pow(t, 1.5) * 118); 
            rawVal = this.currentAudioData.raw[binIndex] || 0;
          }

          let normalized = rawVal / 255.0;
          
          // 핵심: 전체 볼륨(frameAverage)이 커져도 무시하고, 돌출된 소리만 취급
          let isolated = Math.max(0, normalized - (frameAverage * 0.8));
          
          // 잔잔한 파도는 무시하고 튀는 소리만 부각 (제곱)
          let finalForce = Math.pow(isolated, 1.8) * gain * 600; 

          this.targetHeights[i] = finalForce;

          // 물결의 부드러운 스무딩 (올라갈 땐 빠르게, 내려갈 땐 물의 점성처럼 천천히)
          this.prevHeights[i] = this.currentHeights[i];
          if (this.targetHeights[i] > this.currentHeights[i]) {
            this.currentHeights[i] += (this.targetHeights[i] - this.currentHeights[i]) * 0.4;
          } else {
            this.currentHeights[i] += (this.targetHeights[i] - this.currentHeights[i]) * 0.08;
          }
        }

        // 💡 물결 그리기 (curveVertex를 이용한 부드러운 바다 표면)
        const waveGrad = ctx.createLinearGradient(0, baselineY - 300, 0, height);
        waveGrad.addColorStop(0, 'rgba(0, 100, 200, 0.8)'); // 수면 (밝은 파랑)
        waveGrad.addColorStop(1, 'rgba(0, 20, 50, 0.9)'); // 바다 속 (어두운 파랑)
        
        ctx.fillStyle = waveGrad;
        ctx.strokeStyle = '#ffffff'; // 하얀 파도 거품 라인
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#88ccff'; // 거품의 빛 번짐

        p.beginShape();
        // 프레임이 안 보이게 화면 왼쪽 밖에서 시작
        p.vertex(-100, height + 100); 
        p.curveVertex(-100, baselineY);

        for (let i = 0; i < this.numBands; i++) {
          let x = p.map(i, 0, this.numBands - 1, 0, width);
          let y = baselineY - (this.currentHeights[i] * (scatter / 2.2));
          
          p.curveVertex(x, y);

          // 💡 [물방울 튀김 입자 생성] 물결이 급격하게 치솟을 때(Delta) 파티클 발사
          let delta = this.currentHeights[i] - this.prevHeights[i];
          if (delta > 8.0 && this.currentHeights[i] > 30) {
              // 한 번 튈 때마다 물방울 3~5개 생성
              let splashCount = p.floor(p.random(3, 6));
              for(let s = 0; s < splashCount; s++) {
                  this.particles.push({
                      x: x + p.random(-15, 15),
                      y: y,
                      vx: p.random(-2, 2),
                      vy: -p.random(3, 8) - (delta * 0.1), // 튀어오르는 속도
                      life: 255,
                      size: p.random(2, 5)
                  });
              }
          }
        }

        // 화면 오른쪽 밖으로 마무리
        p.curveVertex(width + 100, baselineY);
        p.vertex(width + 100, height + 100);
        p.endShape(p.CLOSE);

        // 💡 물방울 파티클(Splash) 물리 연산 및 렌더링
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffff';
        p.noStroke();
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let pt = this.particles[i];
            
            // 중력 적용
            pt.vy += 0.3; // 중력 가속도
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 5; // 서서히 사라짐

            p.fill(255, 255, 255, pt.life);
            p.circle(pt.x, pt.y, pt.size);

            // 수명이 다하거나 화면 바닥으로 떨어지면 제거
            if (pt.life <= 0 || pt.y > height) {
                this.particles.splice(i, 1);
            }
        }
        
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw(); // 화면 갱신
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.particles = [];
    this.currentAudioData = null;
  }
}
