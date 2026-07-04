/**
 * 013_p5_ink_meteor_shower.js
 * 조선시대 풍경화의 공기원근법(먹의 농담)을 적용하여 4겹의 산맥을 중첩해 그리고,
 * 오디오 주파수에 반응하여 하늘에서 흑백 점묘 유성우가 쏟아지는 시네마틱 미디어 아트
 */
export default class P5InkMeteorShowerStage {
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
        
        if (!this.currentAudioData) {
            p.clear();
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        // 1. UI 설정값 불러오기 (안전 할당)
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

        // 2. 색상 스타일에 따른 밤하늘, 산, 유성 색상 정의
        let skyTop, skyMid, mtnFill, mtnStroke, meteorColor;
        
        if (colorStyle === 'neon') {
            skyTop = p.color('#0a001a'); 
            skyMid = p.color('#1a0033');
            mtnFill = p.color('#050011');
            mtnStroke = p.color('#00ffff'); 
            meteorColor = p.color('#ff00ff'); 
        } else if (colorStyle === 'pastel') {
            skyTop = p.color('#1e2a3a'); 
            skyMid = p.color('#2b3d54');
            mtnFill = p.color('#141d26');
            mtnStroke = p.color('#bae1ff');
            meteorColor = p.color('#ffb3ba');
        } else if (colorStyle === 'custom') {
            skyTop = p.lerpColor(p.color(customColors.gas1), p.color(0), 0.85);
            skyMid = p.lerpColor(p.color(customColors.gas2), p.color(0), 0.80);
            mtnFill = p.color(10, 10, 15);
            mtnStroke = p.color(customColors.gas1);
            meteorColor = p.color(customColors.gas2);
        } else { // 흑백 수묵화(Monochrome) 기본 모드
            skyTop = p.color('#050508');
            skyMid = p.color('#111822');
            mtnFill = p.color('#03050a');
            mtnStroke = p.color('#557799'); // 은은한 먹색
            meteorColor = p.color('#ffffff');
        }

        // 하늘 렌더링
        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, skyTop.toString()); 
        bgGrad.addColorStop(0.6, skyMid.toString()); 
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

        // 3. 배경 별 (수묵 점묘 기법)
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

        // 4. 유성우 스폰 및 렌더링 (산맥 뒤로 떨어져야 하므로 산맥보다 먼저 그림)
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
                  color: p.lerpColor(meteorColor, p.color(255), p.random(0, 0.5)) 
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
            // l이 3(맨 뒤)일수록 1.0, 0(맨 앞)일수록 0.0
            let depthFactor = l / (numLayers - 1); 
            
            // 🎨 [핵심] 먹의 농담 조절 (Atmospheric Perspective)
            // 맨 뒷산은 하늘색(skyMid)과 강하게 섞여서 아주 흐릿해짐
            let layerFill = p.lerpColor(mtnFill, skyMid, depthFactor * 0.85);
            let layerStroke = p.lerpColor(mtnStroke, skyMid, depthFactor * 0.7);

            // 레이어별 기준 높이와 산봉우리 진폭 계산
            // 맨 뒷산은 화면 위쪽(0.4)에 있고 거대함, 앞산은 화면 아래(0.7)에 있음
            let baseY = height * (0.45 + (1 - depthFactor) * 0.35); 
            let amplitude = height * (0.35 - (1 - depthFactor) * 0.15); 

            p.stroke(layerStroke);
            p.strokeWeight(1.5 + (1 - depthFactor) * 1.5); // 앞산일수록 굵은 붓터치
            p.fill(layerFill);

            p.beginShape();
            p.vertex(0, height);
            
            p.noiseSeed(seed + l * 100); // 레이어마다 다른 형태의 산맥 생성
            for (let x = 0; x <= width; x += 10) {
                // 앞산일수록 더 자글자글한 굴곡(노이즈 스케일 증가)
                let noiseScale = 0.002 + (1 - depthFactor) * 0.0015;
                let n = p.noise(x * noiseScale, seed * 0.01 + l * 50); 
                
                let mountainHeight = baseY - (n * amplitude);
                
                // 베이스 진동은 가장 앞산(l=0)에 강하게 적용
                let bassVibration = frameAverage * (15 * (1 - depthFactor)) * p.sin(x * 0.1 + time * 10);
                
                p.vertex(x, mountainHeight + bassVibration);
            }
            
            p.vertex(width, height);
            p.endShape(p.CLOSE);

            // 🌲 [수묵 점묘법(Mi Dots)] 산 능선 위에 먹 점(나무, 바위) 찍기
            p.noStroke();
            // 맨 뒷산은 점이 거의 없고(듬성듬성), 앞산은 빽빽함
            let dotDensity = p.map(depthFactor, 0, 1, 20, 80); 
            let dotColor = p.lerpColor(mtnStroke, skyMid, depthFactor * 0.5);

            p.noiseSeed(seed + l * 200);
            for(let x = 0; x <= width; x += dotDensity) {
                let n = p.noise(x * 0.005, seed * 0.01 + l * 30);
                // 앞산일수록 점을 찍을 확률이 높아짐
                if(n > 0.4 + depthFactor * 0.2) {
                    let noiseScale = 0.002 + (1 - depthFactor) * 0.0015;
                    let mtnY = baseY - (p.noise(x * noiseScale, seed * 0.01 + l * 50) * amplitude);
                    
                    // 베이스 진동 반영
                    mtnY += frameAverage * (15 * (1 - depthFactor)) * p.sin(x * 0.1 + time * 10);

                    // 앞산의 먹 점이 더 크고 또렷함
                    let dotSize = p.random(15, 35) * (1 - depthFactor * 0.4);
                    this.drawInkTree(p, x, mtnY, dotSize, dotColor);
                }
            }
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 🖌️ 수묵화 특유의 먹 번짐(수채화) 느낌을 살린 점묘 나무 그리기
  drawInkTree(p, x, y, h, c) {
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
