/**
 * 014_p5_pendulums.js
 * 5개의 물리 진자가 딱 붙어있는 '뉴턴의 요람(Newton's Cradle)' 구조.
 * 실시간 오디오 스파이크에 의해 타격을 받으면 충돌 시 에너지를 교환하여 
 * 반대편 진자가 튀어 오르는 완벽한 물리 연쇄 작용을 시뮬레이션하는 미디어 아트.
 */
export default class P5PendulumStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numPendulums = 5; 
    this.pendulums = [];
    
    this.currentHeights = new Float32Array(this.numPendulums);
    this.prevHeights = new Float32Array(this.numPendulums);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.shuffleMap = [0, 1, 2, 3, 4];
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
      // 💡 뉴턴의 요람 진자 클래스
      class Pendulum {
        constructor() {
          this.origin = p.createVector(0, 0); 
          this.position = p.createVector();   
          this.r = 250;                       
          this.angle = 0;                     
          this.aVelocity = 0.0;               
          this.aAcceleration = 0.0;           
          
          this.damping = 0.995; // 뉴턴의 요람은 에너지가 오래 보존되어야 하므로 마찰력을 최소화
          this.ballRadius = 20;           
          this.trail = [];
        }

        update() {
          const gravity = 0.8; 
          this.aAcceleration = (-1 * gravity / this.r) * p.sin(this.angle);

          this.aVelocity += this.aAcceleration;
          this.aVelocity *= this.damping; 
          this.angle += this.aVelocity;

          this.angle = p.constrain(this.angle, -p.PI / 2.5, p.PI / 2.5);
        }

        display(ctx, glowAmount, pColor) {
          this.position.x = this.origin.x + this.r * p.sin(this.angle);
          this.position.y = this.origin.y + this.r * p.cos(this.angle);

          // 꼬리(Trail) 효과
          this.trail.push(p.createVector(this.position.x, this.position.y));
          if (this.trail.length > 20) this.trail.shift();

          // 줄 그리기
          p.stroke(255, 255, 255, 100);
          p.strokeWeight(1.5);
          ctx.shadowBlur = 0;
          p.line(this.origin.x, this.origin.y, this.position.x, this.position.y);

          // 꼬리 렌더링
          p.noFill();
          ctx.shadowBlur = 15 * glowAmount;
          ctx.shadowColor = pColor.toString();
          
          p.beginShape();
          for (let i = 0; i < this.trail.length; i++) {
              let alpha = p.map(i, 0, this.trail.length, 0, 150);
              let trailC = p.color(pColor);
              trailC.setAlpha(alpha);
              p.stroke(trailC);
              p.strokeWeight(this.ballRadius * 0.8 * (i / this.trail.length));
              p.vertex(this.trail[i].x, this.trail[i].y);
          }
          p.endShape();

          // 추 렌더링
          p.noStroke();
          p.fill(pColor);
          ctx.shadowBlur = 30 * glowAmount;
          ctx.shadowColor = pColor.toString();
          p.circle(this.position.x, this.position.y, this.ballRadius * 2);
          
          p.fill(255);
          ctx.shadowBlur = 0;
          p.circle(this.position.x, this.position.y, this.ballRadius * 0.5);
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        for (let i = 0; i < this.numPendulums; i++) {
            this.pendulums.push(new Pendulum());
        }
        
        p.noLoop(); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        p.clear();
        let bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#050a15'); 
        bgGrad.addColorStop(1, '#010205'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        if (!this.currentAudioData) return;

        let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
          gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
          glow = Number.isFinite(window.cosmicEngineSettings.glowIntensity) ? window.cosmicEngineSettings.glowIntensity : 0.85;
          seed = Number.isFinite(window.cosmicEngineSettings.seed) ? window.cosmicEngineSettings.seed : 42;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          customColors = window.cosmicEngineSettings.customColors || customColors;
        }

        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            this.shuffleMap = [0, 1, 2, 3, 4].sort(() => p.random() - 0.5);
        }

        let frameAverage = 0;
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            let sum = 0, count = 0;
            let maxLen = Math.min(150, this.currentAudioData.raw.length);
            for(let i = 0; i < maxLen; i++) {
                sum += this.currentAudioData.raw[i] || 0;
                count++;
            }
            if (count > 0) frameAverage = (sum / count) / 255.0;
        }

        // 💡 중앙 고정 바 및 진자 세팅
        const originY = height * 0.2; 
        const ballRadius = 25 + (glow * 5); // 공의 크기
        const spacing = ballRadius * 2; // 공이 서로 정확히 맞닿도록 지름만큼 간격 설정
        const startX = (width / 2) - (spacing * 2); // 5개 공의 맨 왼쪽 시작점
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        p.stroke(255, 255, 255, 150);
        p.strokeWeight(4);
        p.line(startX - 20, originY, startX + (spacing * 4) + 20, originY);

        // 💡 1. 오디오 데이터에 의한 타격 (Impulse) 연산
        for (let i = 0; i < this.numPendulums; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const binIndex = Math.floor(2 + Math.pow(i / 4, 1.5) * 100);
            if (binIndex < this.currentAudioData.raw.length) {
              rawVal = this.currentAudioData.raw[binIndex] || 0;
            }
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.7));
          let finalForce = Math.pow(isolated, 1.5) * gain * 30.0; 
          
          if (!Number.isFinite(finalForce)) finalForce = 0;

          this.prevHeights[i] = this.currentHeights[i];
          this.currentHeights[i] = finalForce;
          
          let delta = this.currentHeights[i] - this.prevHeights[i];
          
          let pend = this.pendulums[i];
          
          // 위치 세팅 (완벽하게 맞닿음)
          pend.origin.x = startX + (i * spacing);
          pend.origin.y = originY;
          // Scatter 슬라이더가 진자 줄 길이를 담당
          pend.r = (height * 0.3) + (scatter * height * 0.08); 
          pend.ballRadius = ballRadius;

          // 💥 소리가 터질 때 물리적 타격 가하기
          if (delta > 3.0) {
              let force = delta * 0.0015; // 타격량 스케일링
              
              // 0번, 1번(저음)은 왼쪽으로 치고, 3번, 4번(고음)은 오른쪽으로 쳐서 뉴턴의 요람 효과 극대화
              if (i < 2) {
                  pend.aVelocity -= force; // 왼쪽 밖으로 밀어냄
              } else if (i > 2) {
                  pend.aVelocity += force; // 오른쪽 밖으로 밀어냄
              } else {
                  // 가운데(2번)는 번갈아가며 침
                  pend.aVelocity += (p.random() > 0.5 ? force : -force);
              }
          }
        }

        // 💡 2. 위치 업데이트
        for (let i = 0; i < this.numPendulums; i++) {
            this.pendulums[i].update();
        }

        // 💡 3. 뉴턴의 요람 충돌(Collision) 해결 연산 (가장 핵심 엔진)
        // 충돌 안정성을 위해 한 프레임에 연산을 3번 반복(Iteration)
        for (let iter = 0; iter < 3; iter++) {
            for (let i = 0; i < this.numPendulums - 1; i++) {
                let pLeft = this.pendulums[i];
                let pRight = this.pendulums[i+1];
                
                // 줄 길이가 같고, 기둥 간격이 지름과 같으므로, 왼쪽 각도가 오른쪽 각도보다 크면 무조건 공이 파고든 것(충돌)
                if (pLeft.angle > pRight.angle) {
                    // 강제 겹침 해결 (각도를 중간값으로 맞춰버림)
                    let avgAngle = (pLeft.angle + pRight.angle) / 2.0;
                    pLeft.angle = avgAngle;
                    pRight.angle = avgAngle;
                    
                    // 💥 완벽한 탄성 충돌: 두 공의 속도(에너지)를 맞바꿈! (운동량 보존)
                    let v1 = pLeft.aVelocity;
                    let v2 = pRight.aVelocity;
                    
                    let restitution = 0.99; // 충돌 시 아주 미세한 에너지 손실
                    pLeft.aVelocity = v2 * restitution;
                    pRight.aVelocity = v1 * restitution;
                }
            }
        }

        // 💡 4. 색상 입히고 화면에 렌더링
        for (let i = 0; i < this.numPendulums; i++) {
            let cRatio = i / 4.0; 
            let pColor;
            if (colorStyle === 'neon') {
                pColor = p.lerpColor(p.color('#ff0055'), p.color('#00ffcc'), cRatio);
            } else if (colorStyle === 'pastel') {
                pColor = p.lerpColor(p.color('#ffb3ba'), p.color('#bae1ff'), cRatio);
            } else if (colorStyle === 'custom') {
                pColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), cRatio);
            } else {
                pColor = p.color(255);
            }
            this.pendulums[i].display(ctx, glow, pColor);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw(); 
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (!this.p5Instance) return;
    this.p5Instance.remove();
    this.p5Instance = null;
    this.pendulums = [];
    this.currentAudioData = null;
  }
}
