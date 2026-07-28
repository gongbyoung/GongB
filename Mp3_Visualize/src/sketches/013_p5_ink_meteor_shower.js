/**
 * 013_p5_ink_meteor_shower.js
 * 1. ReferenceError (skyMid) 오타 완벽 제거
 * 2. 산맥의 이동(파동) 완전 제거 및 화면 하단 1/3 높이 제한
 * 3. 층이 만들어지지 않도록 산맥 레이어 무작위 뒤섞임 배치
 * 4. 주파수에 맞춰 쏟아지는 수묵 점묘 유성우 시네마틱 미디어 아트
 */
export default class P5InkMeteorShowerSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 16; 
    this.currentHeights = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.meteors = []; 
    this.stars = []; 
    this.currentAudioData = null;

    this.loadedSeed = -1;
    this.shuffleMap = [0, 1, 2, 3];
    
    // 레이어별 무작위 Y 오프셋 저장용
    this.layerBaseY = new Float32Array(4);
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
        
        for(let i = 0; i < 150; i++) {
            this.stars.push({
                x: p.random(p.width),
                y: p.random(p.height * 0.8), 
                size: p.random(0.5, 2.5),
                twinkleSpeed: p.random(0.02, 0.08)
            });
        }
        p.noLoop(); 
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        p.clear();
        
        if (!this.currentAudioData) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

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
            this.shuffleMap = [0, 1, 2, 3].sort(() => p.random() - 0.5);
            
            // 💡 [배치] 레이어별 완전 무작위 Y 오프셋 설정 (층 제거)
            for (let i = 0; i < 4; i++) {
                // 💡 [제한] 산의 능선이 화면 상단 2/3를 침범하지 않도록, 베이스캠프를 하단 1/3로 꾹 눌러 내림
                const topBoundary = height * 0.75; 
                const bottomBoundary = height * 0.95;
                
                if (Number.isFinite(height)) {
                    // 일정한 간격이 아닌 완전 무작위 생성
                    const layerY = topBoundary + p.random() * (bottomBoundary - topBoundary);
                    this.layerBaseY[i] = Math.max(topBoundary, Math.min(bottomBoundary, layerY));
                } else {
                    this.layerBaseY[i] = 0.8 * height; 
                }
            }
        }

        // 하늘색 변수명 bgTop, bgMid 로 100% 통일 (오타 완전 제거)
        let bgTop, bgMid;
        if (colorStyle === 'neon') {
            bgTop = p.color('#0a001a'); 
            bgMid = p.color('#1a0033');
        } else if (colorStyle === 'pastel') {
            bgTop = p.color('#1e2a3a'); 
            bgMid = p.color('#2b3d54');
        } else if (colorStyle === 'custom') {
            bgTop = p.lerpColor(p.color(customColors.gas1), p.color(0), 0.85); 
            bgMid = p.lerpColor(p.color(customColors.gas2), p.color(0), 0.80);
        } else {
            bgTop = p.color('#02040a'); 
            bgMid = p.color('#051020');
        }

        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, bgTop.toString()); 
        bgGrad.addColorStop(0.6, bgMid.toString()); 
        bgGrad.addColorStop(1, '#000000'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

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

        const time = Date.now() * 0.001;

        // 배경 별
        p.noStroke();
        ctx.shadowBlur = 0;
        for(let s of this.stars) {
            let twinkle = p.sin(time * s.twinkleSpeed * 100) * 0.5 + 0.5;
            let alpha = (twinkle * 100) + (frameAverage * 150);
            let starC = p.color(255, 255, 255);
            starC.setAlpha(alpha);
            p.fill(starC);
            p.circle(s.x, s.y, s.size);
        }

        // 주파수 반응형 유성우 (Meteor Shower)
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const binIndex = Math.floor(2 + Math.pow(i / (this.numBands-1), 1.5) * 120);
            if (binIndex < this.currentAudioData.raw.length) {
              rawVal = this.currentAudioData.raw[binIndex] || 0;
            }
          }

          let normalized = rawVal / 255.0;
          let isolated = Math.max(0, normalized - (frameAverage * 0.7));
          let finalForce = Math.pow(isolated, 2.0) * gain * 250; 
          
          if (!Number.isFinite(finalForce)) finalForce = 0;

          this.prevHeights[i] = this.currentHeights[i];
          this.currentHeights[i] = finalForce;
          let delta = this.currentHeights[i] - this.prevHeights[i];

          if (delta > 15.0 && p.random() > 0.4) {
              let startX = p.map(i, 0, this.numBands, width * 0.1, width * 0.9);
              this.meteors.push({
                  x: startX + p.random(-100, 100),
                  y: -50, 
                  vx: p.random(4, 8),   
                  vy: p.random(10, 20) + (delta * 0.1), 
                  life: 255,
                  weight: p.random(1.5, 3.5),
                  color: p.lerpColor(p.color(255), p.color(255), p.random(0, 0.5)) // 유성은 백색 발묵
              });
          }
        }

        ctx.shadowBlur = 15 * glow;
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            let m = this.meteors[i];
            m.x += m.vx;
            m.y += m.vy;
            m.life -= 4; 

            let tailMultiplier = Math.max(0.1, scatter); 
            let tailLengthX = m.vx * tailMultiplier * 3;
            let tailLengthY = m.vy * tailMultiplier * 3;

            ctx.shadowColor = m.color.toString();
            let strokeC = p.color(m.color);
            strokeC.setAlpha(m.life);
            p.stroke(strokeC);
            p.strokeWeight(m.weight);
            p.line(m.x, m.y, m.x - tailLengthX, m.y - tailLengthY);

            if (m.life <= 0 || m.y > height + 100 || m.x > width + 100) {
                this.meteors.splice(i, 1);
            }
        }

        // 💡 5. 수묵 풍경화: 공기원근법 중첩 산맥 (고정형)
        const numLayers = 4;
        p.noiseDetail(4, 0.5); 
        ctx.shadowBlur = 0; 

        for (let l = numLayers - 1; l >= 0; l--) {
            let depthFactor = l / (numLayers - 1); 
            
            // 🎨 bgMid 변수를 참조하여 공기원근법 (먹의 농담) 조절
            let layerFill = p.lerpColor(p.color('#03050a'), bgMid, depthFactor * 0.85);
            let layerStroke = p.lerpColor(p.color('#557799'), bgMid, depthFactor * 0.7);

            p.stroke(layerStroke);
            p.strokeWeight(1.5 + (1 - depthFactor) * 1.5); 
            p.fill(layerFill);

            let layerYIndex = this.shuffleMap[l];
            let baseY = this.layerBaseY[layerYIndex];
            
            // 💡 [제한] 산의 진폭(솟아오르는 높이) 자체를 줄여서 위로 너무 튀어오르지 않게 방지
            let amplitude = height * 0.12; 
            
            let safeBaseY = Number.isFinite(baseY) ? baseY : height * 0.8;
            let safeAmplitude = Number.isFinite(amplitude) ? amplitude : 15;

            p.beginShape();
            p.vertex(-100, height + 100); 
            p.curveVertex(-100, safeBaseY);

            p.noiseSeed(seed + l * 100); 
            
            // 수묵 점묘(Mi Dots)를 정확한 능선 위에 찍기 위해 좌표 임시 저장
            let ridgeX = [];
            let ridgeY = [];

            for (let x = -50; x <= width + 50; x += 10) {
                // 💡 [핵심] time 변수를 완전히 삭제! 이제 산은 스크롤되지 않고 얼음처럼 멈춰있습니다.
                let noiseVal = p.noise(x * 0.003, l * 100);
                
                let y = safeBaseY - (noiseVal * safeAmplitude * 2.0);
                p.curveVertex(x, y);
                
                ridgeX.push(x);
                ridgeY.push(y);
            }
            
            p.vertex(width + 100, height + 100);
            p.endShape(p.CLOSE);

            // 💡 [수묵 점묘법 연산] 앞서 저장한 고정된 능선(ridge)을 따라 먹 점을 콕콕 찍음
            let dotDensity = p.map(depthFactor, 0, 1, 2, 8); // 간격 인덱스
            let dotColor = p.lerpColor(p.color('#557799'), bgMid, depthFactor * 0.5);

            p.noiseSeed(seed + l * 200);
            for(let k = 0; k < ridgeX.length; k += Math.floor(dotDensity)) {
                let ptX = ridgeX[k];
                let ptY = ridgeY[k];
                
                let ptN = p.noise(ptX * 0.005, seed * 0.01 + l * 30);
                if(ptN > 0.3 + depthFactor * 0.2) {
                    let dotSize = p.random(15, 35) * (1 - depthFactor * 0.4);
                    this.drawInkDot(p, ptX, ptY, dotSize, dotColor);
                }
            }
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 🖌️ 수묵화 특유의 먹 번짐(수채화) 느낌을 살린 Mi Dot(점묘) 그리기
  drawInkDot(p, x, y, h, c) {
      p.push();
      p.translate(x, y);
      
      p.noStroke();
      let inkColor = p.color(c);
      inkColor.setAlpha(180); 
      p.fill(inkColor);
      
      for(let i = 0; i < 4; i++) {
          let levelY = -h * (0.2 + i * 0.25);
          let levelW = h * (0.6 - i * 0.15);
          p.ellipse(p.random(-2, 2), levelY, levelW + p.random(-3, 3), levelW * 0.7);
      }
      p.pop();
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
    this.meteors = [];
    this.stars = [];
    this.currentAudioData = null;
  }
}
