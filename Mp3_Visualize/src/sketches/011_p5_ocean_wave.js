/**
 * 011_p5_ocean_wave.js
 * [수정됨] 유한 좌표 연산 패치를 통한 Non-finite error 방어 로직 내장
 */
export default class P5OceanWaveStage {
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
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
        }

        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            this.shuffleMap = [0, 1, 2, 3, 4, 5].sort(() => p.random() - 0.5);
        }

        let frameAverage = 0;
        if (this.currentAudioData.raw) {
            let sum = 0;
            for(let i=0; i<150; i++) sum += (this.currentAudioData.raw[i] || 0);
            frameAverage = (sum / 150) / 255.0;
        }

        const targetHeights = new Float32Array(this.numBands);
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = (this.currentAudioData.raw && this.currentAudioData.raw[Math.floor(2 + Math.pow(i / 5, 1.5) * 100)]) || 0;
          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.8));
          targetHeights[i] = Math.pow(isolated, 1.8) * gain * 300; 

          this.prevHeights[i] = this.currentHeights[i];
          if (targetHeights[i] > this.currentHeights[i]) {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.4;
          } else {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.08;
          }
        }

        const time = Date.now() * 0.001;
        for (let idx = 0; idx < this.numBands; idx++) {
          let freqIdx = this.shuffleMap[idx];
          let amplitude = this.currentHeights[freqIdx] + 20; 
          let delta = this.currentHeights[freqIdx] - this.prevHeights[freqIdx];
          
          const topBoundary = height * 0.4;
          const bottomBoundary = height * 0.8;
          const midPoint = (topBoundary + bottomBoundary) / 2;
          const spread = (bottomBoundary - topBoundary) * (scatter / 2.2);
          let baseY = midPoint - (spread / 2) + (idx / 5) * spread;

          // 💡 [안전패치]: Non-finite 방어용 좌표 가공
          const gradY0 = Math.max(0, Math.min(height, baseY - amplitude));
          const gradY1 = Math.max(0, Math.min(height, baseY + height*0.3));

          let baseOceanColor = colorStyle === 'pastel' ? p.color('#2b5d8c') : p.color('#0f5e9c');
          let deepOceanColor = p.color('#020b1a');
          let whiteMixRatio = Math.min(1.0, (glow / 2.0)); 
          let crestColor = p.lerpColor(baseOceanColor, p.color(255, 255, 255), whiteMixRatio);

          const fillGrad = ctx.createLinearGradient(0, gradY0, 0, gradY1);
          fillGrad.addColorStop(0, p.lerpColor(deepOceanColor, crestColor, 0.6).toString()); 
          fillGrad.addColorStop(1, deepOceanColor.toString());
          
          ctx.fillStyle = fillGrad;
          ctx.strokeStyle = crestColor.toString();
          ctx.lineWidth = 2.5;

          p.beginShape();
          p.vertex(-100, height + 100); 
          for (let x = -50; x <= width + 50; x += 40) {
            let noiseVal = p.noise(x * 0.003 - time * (0.2 + idx*0.05), idx * 10 + time * 0.1);
            let waveOffset = p.sin(x * 0.01 + time + idx) * 0.5 + 0.5; 
            let y = baseY - (noiseVal * waveOffset) * amplitude * 2.0;
            
            // 파티클 생성 로직
            if (delta > 5.0 && noiseVal > 0.5 && p.random() < 0.2) {
                this.particles.push({ x: x, y: y, vx: p.random(-1, 1), vy: -p.random(2, 5), life: 255, color: crestColor });
            }
            p.curveVertex(x, y);
          }
          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);
        }

        // 파티클 처리
        p.noStroke();
        this.particles.forEach((pt, i) => {
            pt.vy += 0.2; pt.x += pt.vx; pt.y += pt.vy; pt.life -= 5;
            p.fill(pt.color.levels[0], pt.color.levels[1], pt.color.levels[2], pt.life);
            p.circle(pt.x, pt.y, 3);
            if (pt.life <= 0) this.particles.splice(i, 1);
        });
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
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    this.particles = [];
  }
}
