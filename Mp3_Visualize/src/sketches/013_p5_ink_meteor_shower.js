/**
 * 013_p5_ink_meteor_shower.js
 * 조선시대 풍경화의 공기원근법(먹의 농담)과 무작위 층 배치를 적용하여 4겹의 고정된 산맥을 중첩해 그리고,
 * 오디오 주파수에 반응하여 하늘에서 흑백 점묘 유성우가 쏟아지는 시네마틱 미디어 아트
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
    
    // 💡 [에러 방어] 레이어별 무작위 Y 오프셋 저장용
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
            
            // 💡 [배치 및 에러 방어] 레이어별 무작위 Y 오프셋 초기화
            for (let i = 0; i < 4; i++) {
                // 하단 20%(height*0.8) ~ 60%(height*0.4) 사이 공간 활용
                // 사용자 요청: 1/3 위로 안 올라가게 (height * 0.33 아래로)
                const topBoundary = height * 0.33;
                const bottomBoundary = height * 0.9;
                
                // scatter(분산범위) 슬라이더로 상하 간격을 넓히거나 좁힘 (0 모임 ~ 5 펼침)
                const spacingScale = scatter / 2.2; 
                const spread = (bottomBoundary - topBoundary) * spacingScale;
                const midPoint = (topBoundary + bottomBoundary) / 2;
                
                // 각 레이어의 무작위 Y 오프셋을 scatter 범위 내에서 생성
                // NaN 에러 방어: height가 유효할 때만 계산
                if (Number.isFinite(height)) {
                    const layerY = midPoint - (spread / 2) + p.random() * spread;
                    this.layerBaseY[i] = Math.max(topBoundary, Math.min(bottomBoundary, layerY));
                } else {
                    this.layerBaseY[i] = 0.5 * height; // height가 비정상적일 때의 대체값
                }
            }
        }

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
                  color: p.lerpColor(p.color(255), p.color(255), p.random(0, 0.5)) // 유성은 백색
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

        // 💡 5. 수묵 풍경화: 공기원근법을 적용한 다중 중첩 산맥 (4 Layers)
        const numLayers = 4;
        p.noiseDetail(4, 0.5); 
        ctx.shadowBlur = 0; // 수묵화의 묵직함을 위해 산 자체의 네온 글로우는 최소화

        for (let l = numLayers - 1; l >= 0; l--) {
            let depthFactor = l / (numLayers - 1); 
            
            // 🎨 [핵심] 먹의 농담 조절 (Atmospheric Perspective)
            let layerFill = p.lerpColor(p.color('#03050a'), skyMid, depthFactor * 0.85);
            let layerStroke = p.lerpColor(p.color('#557799'), skyMid, depthFactor * 0.7);

            p.stroke(layerStroke);
            p.strokeWeight(1.5 + (1 - depthFactor) * 1.5); 
            p.fill(layerFill);

            // 💡 [배치 및 에러 방어] scatter에 따라 60% ~ 20% (height * 0.4 ~ height * 0.8) 기본 배치
            // 사용자 요청: 1/3 위로 안 올라가게 (height * 0.33 아래로)
            const topBoundary = height * 0.33;
            const bottomBoundary = height * 0.9;
            
            // 💡 [핵심 - 무작위 배치] 4개 레이어에 무작위 Y 오프셋 할당
            // shuffleMap에 따라 4개 레이어의 무작위 Y좌표를 매핑
            let layerYIndex = this.shuffleMap[l];
            let baseY = this.layerBaseY[layerYIndex];
            let amplitude = height * (0.35 - (1 - depthFactor) * 0.15); 
            
            // NaN 에러 방어
            let safeBaseY = Number.isFinite(baseY) ? baseY : height * 0.5;
            let safeAmplitude = Number.isFinite(amplitude) ? amplitude : 15;

            p.beginShape();
            p.vertex(-100, height + 100); 
            p.curveVertex(-100, safeBaseY);

            p.noiseSeed(seed + l * 100); // 레이어마다 다른 형태의 산맥 생성
            for (let x = -50; x <= width + 50; x += 10) {
                // x 좌표와 seed를 섞어서 산의 능선을 계산
                let noiseVal = p.noise(x * 0.003 - time * (0.2 + l*0.05), l * 10 + time * 0.1);
                let waveOffset = p.sin(x * 0.01 + time + l) * 0.5 + 0.5; 
                
                // 사용자 요청: 산이 계속 움직이지는 않게 (진동 제거)
                let y = safeBaseY - (noiseVal * waveOffset) * safeAmplitude * 2.0;
                p.curveVertex(x, y);

                // 💡 [수묵 점묘법(Mi Dots) 연산] 능선 위에 먹 점(나무, 바위) 찍기
                // l이 3(맨 뒤)일수록 점이 거의 없고(듬성듬성), 앞산은 빽빽함
                let dotDensity = p.map(depthFactor, 0, 1, 20, 80); 
                let dotColor = p.lerpColor(p.color('#557799'), skyMid, depthFactor * 0.5);

                p.noiseSeed(seed + l * 200);
                for(let ptX = -50; ptX <= width + 50; ptX += dotDensity) {
                    let ptN = p.noise(ptX * 0.005, seed * 0.01 + l * 30);
                    // 앞산일수록 점을 찍을 확률이 높아짐
                    if(ptN > 0.4 + depthFactor * 0.2) {
                        let dotNoiseScale = 0.002 + (1 - depthFactor) * 0.0015;
                        let mtnY = safeBaseY - (p.noise(ptX * dotNoiseScale, seed * 0.01 + l * 50) * safeAmplitude);
                        
                        // 앞산의 먹 점이 더 크고 또렷함
                        let dotSize = p.random(15, 35) * (1 - depthFactor * 0.4);
                        // 나무 그릴 필요 없다고 했으므로, Mi Dots만 찍음
                        this.drawInkDot(p, ptX, mtnY, dotSize, dotColor);
                    }
                }
            }
            
            p.vertex(width + 100, height + 100);
            p.endShape(p.CLOSE);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 🖌️ 수묵화 특유의 먹 번짐(수채화) 느낌을 살린 Mi Dot 그리기 함수
  drawInkDot(p, x, y, h, c) {
      p.push();
      p.translate(x, y);
      
      // 나뭇잎/바위를 반투명한 타원(먹물 번짐) 여러 개를 겹쳐서 표현
      p.noStroke();
      let inkColor = p.color(c);
      inkColor.setAlpha(180); // 반투명 겹침 효과
      p.fill(inkColor);
      
      for(let i = 0; i < 4; i++) {
          let levelY = -h * (0.2 + i * 0.25);
          let levelW = h * (0.6 - i * 0.15);
          
          // 약간 찌그러진 타원으로 자연스러운 붓터치 느낌 강조
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
