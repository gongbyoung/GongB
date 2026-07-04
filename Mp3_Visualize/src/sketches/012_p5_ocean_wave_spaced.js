/**
 * 012_p5_ocean_wave_spaced.js
 * 6겹의 바다 레이어 간격을 %로 엄격히 통제하며,
 * Neon, Pastel, Custom 색상 테마에 따라 바다 본연의 색이 다이나믹하게 변형되는 미디어 아트
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

        if (!this.currentAudioData) {
            // 기본 검은 화면 처리
            p.clear();
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        // 💡 1. UI 슬라이더 설정값 리딩 (안전 할당)
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
            this.shuffleMap = [0, 1, 2, 3, 4, 5].sort(() => p.random() - 0.5);
        }

        // 💡 2. 색상 스타일에 따른 배경색 변형
        let bgTop, bgMid;
        if (colorStyle === 'neon') {
            bgTop = p.color('#0b001a'); // 짙은 보라빛 밤하늘
            bgMid = p.color('#100020');
        } else if (colorStyle === 'pastel') {
            bgTop = p.color('#2a1b24'); // 따뜻한 노을빛 밤하늘
            bgMid = p.color('#201825');
        } else if (colorStyle === 'custom') {
            bgTop = p.lerpColor(p.color(customColors.gas1), p.color(0), 0.85); // 사용자가 고른 색을 어둡게
            bgMid = p.lerpColor(p.color(customColors.gas2), p.color(0), 0.80);
        } else {
            bgTop = p.color('#02040a'); // 기본 심해 블루
            bgMid = p.color('#051020');
        }

        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, bgTop.toString()); 
        bgGrad.addColorStop(0.5, bgMid.toString()); 
        bgGrad.addColorStop(1, '#000000'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 💡 3. 오디오 데이터 처리 및 높이 연산
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

        // 💡 4. 파도 간격 (Scatter) 연산
        let topY, bottomY;
        if (scatter <= 2.2) {
          topY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.4);
          bottomY = p.map(scatter, 0, 2.2, height * 0.7, height * 0.8);
        } else {
          topY = p.map(scatter, 2.2, 5.0, height * 0.4, height * 0.2);
          bottomY = p.map(scatter, 2.2, 5.0, height * 0.8, height * 0.8); 
        }

        // 💡 5. 6겹 파도 그리기
        for (let idx = 0; idx < this.numBands; idx++) {
          let freqIdx = this.shuffleMap[idx];
          let amplitude = this.currentHeights[freqIdx] + 15; 
          let delta = this.currentHeights[freqIdx] - this.prevHeights[freqIdx];

          let baseY = topY === bottomY ? topY : p.map(idx, 0, 5, topY, bottomY);

          let safeBaseY = Number.isFinite(baseY) ? baseY : height / 2;
          let safeAmplitude = Number.isFinite(amplitude) ? amplitude : 15;

          // 🎨 [핵심] 6겹 파도의 깊이에 따른 드라마틱한 색상 변화
          let layerRatio = idx / 5.0; // 0.0(맨 뒤) ~ 1.0(맨 앞)
          let baseOceanColor;
          let deepOceanColor;
          let particleShadowColor;

          if (colorStyle === 'neon') {
              // 마젠타(뒤) -> 시안(앞) 사이버펑크 바다
              baseOceanColor = p.lerpColor(p.color('#e000ff'), p.color('#00ffff'), layerRatio);
              deepOceanColor = p.color('#050011');
              particleShadowColor = '#00ffff';
          } else if (colorStyle === 'pastel') {
              // 핑크(뒤) -> 민트(앞) 솜사탕 바다
              baseOceanColor = p.lerpColor(p.color('#ffb3ba'), p.color('#bae1ff'), layerRatio);
              deepOceanColor = p.color('#2a2030');
              particleShadowColor = '#ffffff';
          } else if (colorStyle === 'custom') {
              // Gas1 -> Gas2 커스텀 색상 매핑
              baseOceanColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), layerRatio);
              deepOceanColor = p.lerpColor(baseOceanColor, p.color(0), 0.85); // 85% 어둡게
              particleShadowColor = customColors.gas2;
          } else {
              // 기본 심해 블루 바다
              baseOceanColor = p.lerpColor(p.color('#0f5e9c'), p.color('#2389da'), layerRatio);
              deepOceanColor = p.color('#020b1a');
              particleShadowColor = '#88ccff';
          }
          
          let whiteMixRatio = Math.min(1.0, Math.max(0, (glow / 2.0))); 
          if (!Number.isFinite(whiteMixRatio)) whiteMixRatio = 0.5;

          let crestColor = p.lerpColor(baseOceanColor, p.color(255, 255, 255), whiteMixRatio);

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
                      color: crestColor 
                  });
              }
            }
          }

          p.curveVertex(width + 100, safeBaseY);
          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);
        }

        // 💡 6. 물방울 렌더링 (스타일에 따른 발광색 적용)
        p.noStroke();
        ctx.shadowBlur = 8 * (glow / 2.0);
        ctx.shadowColor = particleShadowColor; 

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
