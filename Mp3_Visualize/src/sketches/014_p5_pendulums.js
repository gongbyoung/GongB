/**
 * 014_p5_pendulums.js
 * 화면 중앙 상단의 줄에 매달린 5개의 물리 진자가
 * 왼쪽(저음)부터 오른쪽(고음)까지 5개의 독립된 주파수에 타격을 받아 흔들리는 미디어 아트
 */
export default class P5PendulumStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numPendulums = 5; 
    this.pendulums = [];
    
    // 오디오 타격량 계산용 버퍼
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
      // 💡 진자(Pendulum) 클래스 내부 정의 (물리 엔진)
      class Pendulum {
        constructor(x, y, len, radius, colorHex) {
          this.origin = p.createVector(x, y); // 매달린 고정점
          this.position = p.createVector();   // 현재 추의 위치
          this.r = len;                       // 줄의 길이
          this.angle = 0;                     // 현재 각도 (0이면 정중앙 아래)
          this.aVelocity = 0.0;               // 각속도
          this.aAcceleration = 0.0;           // 각가속도
          
          this.damping = 0.985;               // 공기 저항 (마찰력 - 서서히 멈춤)
          this.ballRadius = radius;           // 추의 크기
          this.colorHex = colorHex;           // 추의 색상
          
          // 꼬리(Trail) 효과를 위한 이전 위치 저장 배열
          this.trail = [];
        }

        // 💡 물리 연산 업데이트
        update(force) {
          // 1. 중력에 의한 진자 운동 공식 (a = -g/L * sin(theta))
          const gravity = 0.6; // 중력 상수
          this.aAcceleration = (-1 * gravity / this.r) * p.sin(this.angle);

          // 2. 오디오 타격(Force) 적용
          // 소리가 튈 때, 진자가 현재 향하고 있는 방향으로 가속도를 팍 밀어줍니다.
          if (force > 0) {
              let pushDir = (this.angle < 0) ? -1 : 1; 
              // 각도가 0(정지상태)일 때는 랜덤한 방향으로 튕김
              if (Math.abs(this.angle) < 0.05) pushDir = p.random() > 0.5 ? 1 : -1;
              
              this.aVelocity += pushDir * force * 0.05; 
          }

          // 3. 속도와 각도 업데이트
          this.aVelocity += this.aAcceleration;
          this.aVelocity *= this.damping; // 마찰력 적용
          this.angle += this.aVelocity;

          // 극단적인 회전(360도 뺑뺑이) 방지 리미트
          this.angle = p.constrain(this.angle, -p.PI / 1.5, p.PI / 1.5);
        }

        // 💡 화면에 그리기
        display(ctx, glowAmount, pColor) {
          // 현재 위치 삼각함수로 계산
          this.position.x = this.r * p.sin(this.angle);
          this.position.y = this.r * p.cos(this.angle);
          this.position.add(this.origin);

          // 꼬리(Trail) 저장
          this.trail.push(p.createVector(this.position.x, this.position.y));
          if (this.trail.length > 25) this.trail.shift();

          // 1. 줄 그리기
          p.stroke(255, 255, 255, 80);
          p.strokeWeight(2);
          ctx.shadowBlur = 0;
          p.line(this.origin.x, this.origin.y, this.position.x, this.position.y);

          // 2. 꼬리 그리기
          p.noFill();
          ctx.shadowBlur = 15 * glowAmount;
          ctx.shadowColor = pColor.toString();
          
          p.beginShape();
          for (let i = 0; i < this.trail.length; i++) {
              let alpha = p.map(i, 0, this.trail.length, 0, 150);
              let trailC = p.color(pColor);
              trailC.setAlpha(alpha);
              p.stroke(trailC);
              p.strokeWeight(this.ballRadius * 0.5 * (i / this.trail.length));
              p.vertex(this.trail[i].x, this.trail[i].y);
          }
          p.endShape();

          // 3. 빛나는 추(Bob) 그리기
          p.noStroke();
          p.fill(pColor);
          ctx.shadowBlur = 30 * glowAmount;
          ctx.shadowColor = pColor.toString();
          p.circle(this.position.x, this.position.y, this.ballRadius * 2);
          
          // 추 중심의 코어(하얀 점)
          p.fill(255);
          ctx.shadowBlur = 0;
          p.circle(this.position.x, this.position.y, this.ballRadius * 0.5);
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // 5개의 진자 초기 생성 (임시 위치, resize/draw에서 재배치)
        for (let i = 0; i < this.numPendulums; i++) {
            this.pendulums.push(new Pendulum(0, 0, 100, 12, '#ffffff'));
        }
        
        p.noLoop(); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        // 배경 그리기
        p.clear();
        let bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#050a15'); 
        bgGrad.addColorStop(1, '#010205'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        if (!this.currentAudioData) return;

        // UI 설정
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

        // 전체 볼륨 무시 (오토 게인)
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

        // 💡 중앙 상단 수평 줄(Bar) 그리기
        const barWidth = width * Math.min(0.8, scatter / 2.0); // scatter로 간격 조절
        const startX = (width - barWidth) / 2;
        const originY = height * 0.15; // 상단에서 15% 내려온 곳
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        p.stroke(255, 255, 255, 150);
        p.strokeWeight(4);
        p.line(startX - 20, originY, startX + barWidth + 20, originY);

        // 5개 진자 오디오 타격 및 렌더링
        for (let i = 0; i < this.numPendulums; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            // 5개 밴드로 분리
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
          
          // 타격(Spike) 감지
          let delta = this.currentHeights[i] - this.prevHeights[i];
          let impactForce = 0;
          if (delta > 2.0) impactForce = delta; // 뾰족한 소리가 날 때만 힘 발생

          // 🎨 색상 테마 계산
          let cRatio = i / 4.0; // 0.0 ~ 1.0
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

          // 물리 진자 업데이트 및 그리기
          let pend = this.pendulums[i];
          
          // UI 조작에 실시간 반응하도록 위치/길이 세팅
          pend.origin.x = startX + (i * (barWidth / 4));
          pend.origin.y = originY;
          // Scatter 슬라이더가 진자의 길이를 조절함 (기본 height * 0.45)
          pend.r = (height * 0.3) + (scatter * height * 0.08); 
          pend.ballRadius = 10 + (glow * 5);

          // 섞인 순서(shuffleMap)에 따라 타격 전달
          let freqIdx = this.shuffleMap[i];
          let actualImpact = (i === freqIdx) ? impactForce : 0; 
          
          // 각 진자에 매핑된 오디오 임팩트 적용
          pend.update(impactForce); 
          pend.display(ctx, glow, pColor);
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
