/**
 * 013_p5_ink_meteor_shower.js
 * 화면 하단 1/3에 조선 시대 수묵 점묘화 기법으로 지형(산맥)을 렌더링하고,
 * 오디오 주파수 스파이크에 반응하여 하늘에서 흑백 점묘 유성우가 쏟아지는 시네마틱 미디어 아트
 */
export default class P5InkMeteorShowerStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 16; // 16구역에서 유성우 발생
    this.currentHeights = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.meteors = []; 
    this.stars = []; // 배경의 잔잔한 별들
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
        
        // 정적인 배경 별자리 미리 생성
        for(let i = 0; i < 150; i++) {
            this.stars.push({
                x: p.random(p.width),
                y: p.random(p.height * 0.7), // 산 위쪽에만 별 배치
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

        // 💡 1. UI 설정값 불러오기
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

        // 💡 2. 색상 스타일에 따른 밤하늘, 산, 유성 색상 정의
        let skyTop, skyMid, mtnFill, mtnStroke, meteorColor;
        
        if (colorStyle === 'neon') {
            skyTop = p.color('#0a001a'); // 짙은 우주 보라
            skyMid = p.color('#1a0033');
            mtnFill = p.color('#050011');
            mtnStroke = p.color('#00ffff'); // 산 등고선 (네온 시안)
            meteorColor = p.color('#ff00ff'); // 유성 (마젠타)
        } else if (colorStyle === 'pastel') {
            skyTop = p.color('#1e2a3a'); // 부드러운 새벽 남색
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
        } else { // 흑백 (Monochrome) - 기본 설정
            skyTop = p.color('#000000');
            skyMid = p.color('#051020');
            mtnFill = p.color('#010205');
            mtnStroke = p.color('#446688');
            meteorColor = p.color('#ffffff');
        }

        // 하늘 그라데이션 렌더링
        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, skyTop.toString()); 
        bgGrad.addColorStop(0.6, skyMid.toString()); 
        bgGrad.addColorStop(1, '#000000'); 
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 오디오 데이터 연산
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

        const time = Date.now() * 0.001;

        // 💡 3. 잔잔한 배경 별 렌더링 (수묵 점묘 기법 적용)
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

        // 💡 4. 유성우 (Meteor Shower) 스폰 및 렌더링 (흑백 점묘 기법 적용)
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

          // 특정 주파수가 강하게 칠 때 유성 생성
          if (delta > 15.0 && p.random() > 0.4) {
              let startX = p.map(i, 0, this.numBands, width * 0.1, width * 0.9);
              this.meteors.push({
                  x: startX + p.random(-100, 100),
                  y: -50, // 화면 위 밖에서 시작
                  vx: p.random(4, 8),   // 우측으로 사선 이동
                  vy: p.random(10, 20) + (delta * 0.1), // 아래로 낙하
                  life: 255,
                  weight: p.random(1.5, 3.5),
                  color: p.lerpColor(meteorColor, p.color(255), p.random(0, 0.5)) // 약간의 흰색 랜덤 믹스
              });
          }
        }

        // 유성우 물리 및 그리기 연산
        ctx.shadowBlur = 15 * glow;
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            let m = this.meteors[i];
            
            m.x += m.vx;
            m.y += m.vy;
            m.life -= 4; 

            // 꼬리 길이 (Center Scatter) 슬라이더 연동
            let tailMultiplier = Math.max(0.1, scatter); 
            let tailLengthX = m.vx * tailMultiplier * 3;
            let tailLengthY = m.vy * tailMultiplier * 3;

            ctx.shadowColor = m.color.toString();
            
            let strokeC = p.color(m.color);
            strokeC.setAlpha(m.life);
            p.stroke(strokeC);
            p.strokeWeight(m.weight);
            
            p.line(m.x, m.y, m.x - tailLengthX, m.y - tailLengthY);

            // 화면을 벗어나거나 수명이 다하면 제거
            if (m.life <= 0 || m.y > height + 100 || m.x > width + 100) {
                this.meteors.splice(i, 1);
            }
        }

        // 💡 5. 조선 수묵 점묘화 지형 (Mountain) 렌더링
        p.noiseSeed(seed);
        p.noiseDetail(4, 0.5); 

        ctx.shadowBlur = 20 * glow;
        ctx.shadowColor = mtnStroke.toString();
        p.stroke(mtnStroke);
        p.strokeWeight(2);
        
        p.fill(mtnFill);

        p.beginShape();
        p.vertex(0, height);
        
        // 화면 하단 1/3 높이에 산맥을 생성 (y = height * 0.66 기준)
        for (let x = 0; x <= width; x += 10) {
            let n = p.noise(x * 0.002, seed * 0.01); 
            let mountainHeight = height * 0.6 + (n * height * 0.3);
            let bassVibration = frameAverage * 15 * p.sin(x * 0.1 + time * 10);
            
            p.vertex(x, mountainHeight + bassVibration);
        }
        
        p.vertex(width, height);
        p.endShape(p.CLOSE);

        // 산 위에 소나무 등 수묵 점묘 디테일 추가
        p.noStroke();
        ctx.shadowBlur = 0;
        p.noiseSeed(seed + 100);
        for(let x = 0; x <= width; x += 30) {
            let n = p.noise(x * 0.005, seed * 0.01);
            if(n > 0.6) {
                let mountainHeight = height * 0.6 + (p.noise(x * 0.002, seed * 0.01) * height * 0.3);
                this.drawPineTree(p, x, mountainHeight, p.random(30, 60), mtnStroke);
            }
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 수묵 점묘 소나무 그리기 함수
  drawPineTree(p, x, y, h, c) {
      p.push();
      p.translate(x, y);
      
      // 트렁크
      p.stroke(c);
      p.strokeWeight(2);
      p.line(0, 0, 0, -h);
      
      // 나뭇잎 (점묘 기법)
      p.noStroke();
      p.fill(c);
      for(let i = 0; i < 3; i++) {
          let levelY = -h * (0.3 + i * 0.3);
          let levelW = h * (0.5 - i * 0.1);
          p.ellipse(0, levelY, levelW, levelW * 0.6);
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
