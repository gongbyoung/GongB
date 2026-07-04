/**
 * 012_p5_ocean_wave_spaced.js
 * 6겹의 바다 레이어 간격을 %로 엄격히 통제하며,
 * 분산 범위 슬라이더에 따라 (최소 30% 모임 ~ 기본 20-60% ~ 최대 20-80%) 넓게 펼쳐지는 미디어 아트
 */
export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 6; 
    this.currentHeights = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.particles = []; 
    this.currentAudioData = null;

    this.loadedSeed = -1;
    this.shuffleMap = [0, 1, 2, 3, 4, 5];
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
        const ctx = p.drawingContext;
        
        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#02040a'); 
        bgGrad.addColorStop(0.5, '#051020'); 
        bgGrad.addColorStop(1, '#000000'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        if (!this.currentAudioData) return;

        let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42;
        let colorStyle = 'neon';
        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent; 
          gain = window.cosmicEngineSettings.audioGain;          
          glow = window.cosmicEngineSettings.glowIntensity;
          seed = window.cosmicEngineSettings.seed;
          colorStyle = window.cosmicEngineSettings.colorStyle;
        }

        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            this.shuffleMap = [0, 1, 2, 3, 4, 5].sort(() => p.random() - 0.5);
        }

        let frameAverage = 0;
        if (this.currentAudioData.raw) {
            let sum = 0;
            for(let i=0; i<150; i++) sum += this.currentAudioData.raw[i];
            frameAverage = (sum / 150) / 255.0;
        }

        const targetHeights = new Float32Array(this.numBands);
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw) {
            const binIndex = Math.floor(2 + Math.pow(i / 5, 1.5) * 100); 
            rawVal = this.currentAudioData.raw[binIndex] || 0;
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.8));
          
          // 파도들이 너무 겹치지 않게 기본 증폭률을 살짝 다듬음 (300 -> 240)
          targetHeights[i] = Math.pow(isolated, 1.8) * gain * 240; 

          this.prevHeights[i] = this.currentHeights[i];
          if (targetHeights[i] > this.currentHeights[i]) {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.4;
          } else {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.08;
          }
        }

        const time = Date.now() * 0.001;

        // 💡 [배치 간격 % 정밀 연산 로직]
        let topY, bottomY;
        
        // Scatter(0~5.0) 값에 따라 화면 높이(height)를 기준으로 맵핑
        // 0.0일 때: 모두 하단 30%(height * 0.7)에 모임
        // 2.2일 때: 60% ~ 20% (height * 0.4 ~ height * 0.8) 기본 배치
        // 5.0일 때: 80% ~ 20% (height * 0.2 ~ height * 0.8) 넓게 펼쳐짐
        if (scatter <= 2.2) {
          topY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.4);
          bottomY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.8);
        } else {
          topY = p.map(scatter, 2.2, 5.0, height * 0.4, height * 0.2);
          bottomY = p.map(scatter, 2.2, 5.0, height * 0.8, height * 0.8); 
        }

        for (let idx = 0; idx < this.numBands; idx++) {
          let freqIdx = this.shuffleMap[idx];
          let amplitude = this.currentHeights[freqIdx] + 15; 
          let delta = this.currentHeights[freqIdx] - this.prevHeights[freqIdx];

          // idx 0이 가장 뒤쪽(상단 topY), idx 5가 가장 앞쪽(하단 bottomY)
          let baseY = topY === bottomY ? topY : p.map(idx, 0, 5, topY, bottomY);

          let baseOceanColor = colorStyle === 'pastel' ? p.color('#2b5d8c') : p.color('#0f5e9c');
          let deepOceanColor = p.color('#020b1a');
          
          let whiteMixRatio = Math.min(1.0, (glow / 2.0)); 
          let crestColor = p.lerpColor(baseOceanColor, p.color(255, 255, 255), whiteMixRatio);

          const fillGrad = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY + height*0.3);
          fillGrad.addColorStop(0, p.lerpColor(deepOceanColor, crestColor, 0.6).toString()); 
          fillGrad.addColorStop(1, deepOceanColor.toString());
          
          const strokeGrad = ctx.createLinearGradient(0, baseY - amplitude * 1.5, 0, baseY);
          strokeGrad.addColorStop(0, crestColor.toString()); 
          strokeGrad.addColorStop(1, baseOceanColor.toString());

          ctx.fillStyle = fillGrad;
          ctx.strokeStyle = strokeGrad;
          ctx.lineWidth = 2.5;

          p.beginShape();
          p.vertex(-100, height + 100); 
          p.curveVertex(-100, baseY);

          for (let x = -50; x <= width + 50; x += 40) {
            let noiseVal = p.noise(x * 0.003 - time * (0.2 + idx*0.05), idx * 10 + time * 0.1);
            let waveOffset = p.sin(x * 0.01 + time + idx) * 0.5 + 0.5; 
            
            let y = baseY - (noiseVal * waveOffset) * amplitude * 2.0;
            p.curveVertex(x, y);

            if (delta > 5.0 && noiseVal > 0.5 && p.random() < 0.2) {
              let splashCount = p.floor(p.random(1, 4));
              for(let s = 0; s < splashCount; s++) {
                  this.particles.push({
                      x: x + p.random(-20, 20),
                      y: y,
                      vx: p.random(-1.5, 1.5) - 1.0, 
                      vy: -p.random(2, 6) - (delta * 0.15), 
                      life: 255,
                      size: p.random(1.5, 4.0),
                      color: crestColor 
                  });
              }
            }
          }

          p.curveVertex(width + 100, baseY);
          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);
        }

        p.noStroke();
        ctx.shadowBlur = 8 * (glow / 2.0);
        ctx.shadowColor = '#ffffff';

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let pt = this.particles[i];
            
            pt.vy += 0.25; 
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= p.random(3, 7); 

            let pColor = p.color(pt.color);
            pColor.setAlpha(pt.life);
            p.fill(pColor);
            p.circle(pt.x, pt.y, pt.size);

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
    this.particles = [];
    this.currentAudioData = null;
  }
}
