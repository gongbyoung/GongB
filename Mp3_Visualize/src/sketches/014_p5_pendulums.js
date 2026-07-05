/**
 * 014_p5_pendulums.js
 * 진자(Mallet)가 허공을 맴도는 것이 아니라, 물리적인 실로폰 건반(Key)을 
 * 완벽한 싱크로율로 타격(Strike)하며 빛과 파편을 뿜어내는 '진자 실로폰' 스테이지
 */
export default class P5PendulumStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numMallets = 5; 
    this.mallets = [];
    this.particles = [];
    
    this.currentHeights = new Float32Array(this.numMallets);
    this.prevHeights = new Float32Array(this.numMallets);
    
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
      // 💡 진자(Mallet) 해머 클래스
      class Mallet {
        constructor(x, y, len, colorHex) {
          this.origin = p.createVector(x, y);
          this.r = len;
          this.angle = 0;
          this.aVel = 0;
          this.aAcc = 0;
          
          // 타격 대상인 실로폰 건반의 위치 (오른쪽 약 28도 각도)
          this.targetAngle = 0.5; 
          this.color = p.color(colorHex);
          this.keyBrightness = 0; // 건반의 빛 발산도
          this.ballRadius = 18;
        }

        // 💥 오디오 스파이크 발생 시 즉각 타격!
        strike(force) {
          this.angle = this.targetAngle; // 레이턴시 없이 즉시 건반에 명중
          
          // 소리의 크기(force)에 비례하여 뒤로 튕겨나가는 물리적 반동(Recoil)
          this.aVel = Math.max(-0.25, -0.05 - (force * 0.005));
          this.keyBrightness = 1.0; // 명중 시 건반 100% 발광
        }

        update() {
          // 중력 연산 (현실적인 진자 운동)
          const gravity = 15.0; 
          this.aAcc = (-gravity / this.r) * p.sin(this.angle);
          this.aVel += this.aAcc;
          this.aVel *= 0.95; // 마찰력 (자연스럽게 멈춤)
          this.angle += this.aVel;

          // 물리적 충돌 보정: 건반(targetAngle)을 뚫고 지나갈 수 없음
          if (this.angle >= this.targetAngle) {
              this.angle = this.targetAngle;
              this.aVel *= -0.4; // 건반에 부딪히면 튕김
          }

          // 건반의 빛이 서서히 꺼짐
          this.keyBrightness *= 0.85; 
        }

        display(ctx, glow) {
          let bx = this.origin.x + this.r * p.sin(this.angle);
          let by = this.origin.y + this.r * p.cos(this.angle);

          // 1. 실로폰 건반 (Target Key) 렌더링
          let keyX = this.origin.x + this.r * p.sin(this.targetAngle);
          let keyY = this.origin.y + this.r * p.cos(this.targetAngle);

          p.push();
          p.translate(keyX, keyY);
          p.rotate(-this.targetAngle); 
          p.rectMode(p.CENTER);
          
          ctx.shadowBlur = 40 * glow * this.keyBrightness;
          ctx.shadowColor = this.color.toString();

          // 타격 시 네온색으로 번쩍임
          p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), 30 + 225 * this.keyBrightness);
          p.stroke(255, 255, 255, 60 + 195 * this.keyBrightness);
          p.strokeWeight(2 + 4 * this.keyBrightness);
          p.rect(0, this.ballRadius + 5, 55, 14, 6); 
          p.pop();

          // 2. 진자(Mallet) 줄 그리기
          p.stroke(200, 200, 255, 150);
          p.strokeWeight(2.5);
          ctx.shadowBlur = 0;
          p.line(this.origin.x, this.origin.y, bx, by);

          // 3. 진자 머리(Hammer) 그리기
          p.noStroke();
          p.fill(this.color);
          ctx.shadowBlur = 20 * glow;
          ctx.shadowColor = this.color.toString();
          p.circle(bx, by, this.ballRadius * 2);

          p.fill(255);
          ctx.shadowBlur = 0;
          p.circle(bx, by, this.ballRadius * 0.8);
        }
      }

      // 💡 불꽃 파편(Particle) 클래스
      class Particle {
          constructor(x, y, color) {
              this.x = x;
              this.y = y;
              // 오른쪽 건반을 때렸으므로, 파편은 왼쪽 위로 강하게 튐
              this.vx = p.random(-9, -2); 
              this.vy = p.random(-7, 2);
              this.life = 255;
              this.color = color;
              this.size = p.random(2, 7);
          }
          update() {
              this.vy += 0.35; // 파편에도 중력 적용
              this.x += this.vx;
              this.y += this.vy;
              this.life -= 12;
          }
          display(ctx, glow) {
              p.noStroke();
              let c = p.color(this.color);
              c.setAlpha(this.life);
              p.fill(c);
              ctx.shadowBlur = 10 * glow;
              ctx.shadowColor = this.color.toString();
              p.circle(this.x, this.y, this.size);
          }
      }

      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        for (let i = 0; i < this.numMallets; i++) {
            this.mallets.push(new Mallet(0, 0, 100, '#ffffff'));
        }
        p.noLoop(); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        p.clear();
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width*0.8);
        bgGrad.addColorStop(0, '#101520'); 
        bgGrad.addColorStop(1, '#020306'); 
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

        // 상단 고정 바 그리기
        let gap = Math.max(50, (width * 0.6 * (scatter / 2.2)) / 4);
        let startX = (width / 2) - (gap * 2);
        let originY = height * 0.15;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        p.stroke(255, 255, 255, 150);
        p.strokeWeight(5);
        p.line(startX - 30, originY, startX + (gap * 4) + 30, originY);

        // 5개 진자 업데이트 및 타격 판정
        for (let i = 0; i < this.numMallets; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const binIndex = Math.floor(2 + Math.pow(i / 4, 1.5) * 100);
            if (binIndex < this.currentAudioData.raw.length) {
              rawVal = this.currentAudioData.raw[binIndex] || 0;
            }
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.7));
          let finalForce = Math.pow(isolated, 1.8) * gain * 30.0; 
          if (!Number.isFinite(finalForce)) finalForce = 0;

          this.prevHeights[i] = this.currentHeights[i];
          this.currentHeights[i] = finalForce;
          let delta = this.currentHeights[i] - this.prevHeights[i];

          let freqIdx = this.shuffleMap[i];
          let m = this.mallets[i];

          // UI 조작에 따른 진자 길이 및 간격 실시간 반영
          m.origin.x = startX + (i * gap);
          m.origin.y = originY;
          // 진짜 실로폰처럼 왼쪽(저음)은 길이가 길고, 오른쪽(고음)은 짧아짐
          m.r = p.map(i, 0, 4, height * 0.55, height * 0.35); 
          m.ballRadius = 15 + (glow * 5);

          let cRatio = i / 4.0; 
          if (colorStyle === 'neon') {
              m.color = p.lerpColor(p.color('#ff0055'), p.color('#00ffcc'), cRatio);
          } else if (colorStyle === 'pastel') {
              m.color = p.lerpColor(p.color('#ffb3ba'), p.color('#bae1ff'), cRatio);
          } else if (colorStyle === 'custom') {
              m.color = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), cRatio);
          } else {
              m.color = p.color(255);
          }

          // 💥 오디오 스파이크 발생! 진자가 악기를 강하게 내리칩니다.
          // 여기서 i === freqIdx 비교를 빼서, 각 자리에 고정된 진자가 주파수에 맞춰 개별적으로 반응하도록 수정
          if (delta > 3.0) {
              m.strike(delta);
              
              // 타격 지점에서 스파크(파편) 폭발
              let keyX = m.origin.x + m.r * p.sin(m.targetAngle);
              let keyY = m.origin.y + m.r * p.cos(m.targetAngle);
              for(let j=0; j<7; j++) {
                  this.particles.push(new Particle(keyX, keyY, m.color));
              }
          }

          m.update();
          m.display(ctx, glow);
          
          // 상단 고정 바 관절 디테일
          p.noStroke();
          p.fill(150);
          ctx.shadowBlur = 0;
          p.circle(m.origin.x, m.origin.y, 12);
        }

        // 스파크 파편 렌더링
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let pt = this.particles[i];
            pt.update();
            pt.display(ctx, glow);
            if (pt.life <= 0) {
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
    this.mallets = [];
    this.particles = [];
    this.currentAudioData = null;
  }
}
