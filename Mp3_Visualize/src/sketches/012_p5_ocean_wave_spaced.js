/**
 * 012_p5_ocean_wave_spaced.js
 * 6겹의 바다 레이어 간격을 %로 엄격히 통제하며,
 * 비정상적인 오디오 데이터 입력 시 발생하는 NaN 연산 에러를 원천 차단하고
 * 색상 스타일(Neon/Pastel/Custom)의 백색 혼합 비율(Glow %) 연산을 적용한 무결점 버전
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

        // 💡 [에러 방어 1] UI 슬라이더 값이 undefined나 NaN으로 들어올 경우를 대비한 안전 할당
        let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
          gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
          glow = Number.isFinite(window.cosmicEngineSettings.glowIntensity) ? window.cosmicEngineSettings.glowIntensity : 0.85;
          seed = Number.isFinite(window.cosmicEngineSettings.seed) ? window.cosmicEngineSettings.seed : 42;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          customColors = window.cosmicEngineSettings.customColors || { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
        }

        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            this.shuffleMap = [0, 1, 2, 3, 4, 5].sort(() => p.random() - 0.5);
        }

        // 💡 [에러 방어 2] 오디오 데이터 배열 길이가 짧거나 값이 없을 때 NaN이 되는 현상 원천 차단
        let frameAverage = 0;
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            let sum = 0;
            let count = 0;
            let maxLen = Math.min(150, this.currentAudioData.raw.length);
            for(let i = 0; i < maxLen; i++) {
                sum += this.currentAudioData.raw[i] || 0;
                count++;
            }
            if (count > 0) frameAverage = (sum / count) / 255.0;
        }

        const targetHeights = new Float32Array(this.numBands);
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const binIndex = Math.floor(2 + Math.pow(i / 5, 1.5) * 100);
            if (binIndex < this.currentAudioData.raw.length) {
              rawVal = this.currentAudioData.raw[binIndex] || 0;
            }
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.8));
          
          targetHeights[i] = Math.pow(isolated, 1.8) * gain * 240; 
          
          if (!Number.isFinite(targetHeights[i])) targetHeights[i] = 0;

          this.prevHeights[i] = this.currentHeights[i];
          if (targetHeights[i] > this.currentHeights[i]) {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.4;
          } else {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.08;
          }
        }

        const time = Date.now() * 0.001;

        let topY, bottomY;
        if (scatter <= 2.2) {
          topY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.4);
          bottomY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.8);
        } else {
          topY = p.map(scatter, 2.2, 5.0, height * 0.4, height * 0.2);
          bottomY = p.map(scatter, 2.2, 5.0, height * 0.8, height * 0.8); 
        }

        // 💡 [에러 방어 3] 좌표값이 NaN으로 createLinearGradient에 들어가지 않도록 최종 필터링 및 색상 스타일 정의
        let baseOceanColor;
        let deepOceanColor = p.color('#020b1a');
        let particleShadowColor;

        if (colorStyle === 'neon') {
            baseOceanColor = p.color('#10a5e5'); // Bright cyan
            particleShadowColor = '#00ffcc';
        } else if (colorStyle === 'pastel') {
            baseOceanColor = p.color('#2b5d8c'); // Softer blue
            particleShadowColor = '#88ccff';
        } else if (colorStyle === 'custom') {
            baseOceanColor = p.color(customColors.gas1);
            particleShadowColor = customColors.gas2;
        } else { // Default/monochrome
            baseOceanColor = p.color('#0f5e9c');
            particleShadowColor = '#88ccff';
        }

        // Glow 슬라이더(0.0~5.0)를 %비율로 환산하여, 파도 꼭대기에 하얀색이 얼마나 섞일지 결정 (0~100%)
        let whiteMixRatio = Math.min(1.0, Math.max(0, (glow / 2.0))); 
        if (!Number.isFinite(whiteMixRatio)) whiteMixRatio = 0.5;

        // 최종 파도 거품(Crest) 색상: 바다색에서 하얀색으로 블렌딩
        let crestColor = p.lerpColor(baseOceanColor, p.color(255, 255, 255), whiteMixRatio);

        for (let idx = 0; idx < this.numBands; idx++) {
          let freqIdx = this.shuffleMap[idx];
          let amplitude = this.currentHeights[freqIdx] + 15; 
          let delta = this.currentHeights[freqIdx] - this.prevHeights[freqIdx];

          let baseY = topY === bottomY ? topY : p.map(idx, 0, 5, topY, bottomY);

          let safeBaseY = Number.isFinite(baseY) ? baseY : height / 2;
          let safeAmplitude = Number.isFinite(amplitude) ? amplitude : 15;

          const fillGrad = ctx.createLinearGradient(0, safeBaseY - safeAmplitude, 0, safeBaseY + height*0.3);
          fillGrad.addColorStop(0, p.lerpColor(deepOceanColor, crestColor, 0.6).toString()); 
          fillGrad.addColorStop(1, deepOceanColor.toString());
          
          const strokeGrad = ctx.createLinearGradient(0, safeBaseY - safeAmplitude * 1.5, 0, safeBaseY);
          strokeGrad.addColorStop(0, crestColor.toString()); 
          strokeGrad.addColorStop(1, baseOceanColor.toString());

          ctx.fillStyle = fillGrad;
          ctx.strokeStyle = strokeGrad;
          ctx.lineWidth = 2.5;

          p.beginShape();
          p.vertex(-100, height + 100); 
          p.curveVertex(-100, safeBaseY);

          for (let x = -50; x <= width + 50; x += 40) {
            let noiseVal = p.noise(x * 0.003 - time * (0.2 + idx*0.05), idx * 10 + time * 0.1);
            let waveOffset = p.sin(x * 0.01 + time + idx) * 0.5 + 0.5; 
            
            let y = safeBaseY - (noiseVal * waveOffset) * safeAmplitude * 2.0;
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
                      color: crestColor // 파티클 색상도 백색 혼합 비율을 따름
                  });
              }
            }
          }

          p.curveVertex(width + 100, safeBaseY);
          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);
        }

        p.noStroke();
        ctx.shadowBlur = 8 * (glow / 2.0);
        ctx.shadowColor = particleShadowColor; // 파티클 발광색도 스타일에 따라 변경

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
