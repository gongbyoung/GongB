/**
 * 013_p5_ink_meteor_shower.js
 * - [수리 완료] 산맥 및 나무(수묵 점묘) 사전 생성 구조 이식 (100% 고정, 흔들림 완벽 차단)
 * - 주파수 반응형 시네마틱 수묵 유성우 미디어 아트
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
    this.loadedW = 0;
    this.loadedH = 0;
    
    // 💡 산맥 및 고정된 나무(점묘) 데이터 저장소
    this.mountainLayers = [];
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

        // 하늘색 변수 지정
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

        // 💡 [핵심 수리]: 시드나 해상도가 변경될 때만 산맥과 나무(점묘)를 1회만 사전 생성 (흔들림 완벽 차단)
        if (this.loadedSeed !== seed || this.loadedW !== width || this.loadedH !== height) {
          this.loadedSeed = seed;
          this.loadedW = width;
          this.loadedH = height;
          this.rebuildMountainsAndTrees(p, width, height, seed, bgMid);
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
              color: p.lerpColor(p.color(255), p.color(255), p.random(0, 0.5))
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

        // 💡 [수묵 풍경화 고정 렌더링]: 사전 계산된 고정 산맥 및 고정 나무만 정적으로 렌더링
        ctx.shadowBlur = 0; 
        for (let l = this.mountainLayers.length - 1; l >= 0; l--) {
          const layer = this.mountainLayers[l];

          p.stroke(layer.layerStrokeHex);
          p.strokeWeight(1.5 + (1 - layer.depthFactor) * 1.5);
          p.fill(layer.layerFillHex);

          p.beginShape();
          p.vertex(-100, height + 100);
          p.curveVertex(-100, layer.ridgePoints[0].y);

          for (let pt of layer.ridgePoints) {
            p.curveVertex(pt.x, pt.y);
          }

          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);

          // 🌲 사전 생성된 100% 고정 나무(점묘) 그리기
          p.noStroke();
          for (let dot of layer.dots) {
            let inkColor = p.color(dot.colorHex);
            inkColor.setAlpha(180);
            p.fill(inkColor);

            for (let sub of dot.subEllipses) {
              p.ellipse(dot.x + sub.dx, dot.y + sub.levelY, sub.levelW, sub.levelH);
            }
          }
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [사전 고정 생성 함수]: 산맥의 형태와 나무들의 위치, 가지 형태를 1회만 계산하여 저장
  rebuildMountainsAndTrees(p, width, height, seed, bgMid) {
    p.randomSeed(seed);
    p.noiseSeed(seed);

    const shuffleMap = [0, 1, 2, 3].sort(() => p.random() - 0.5);
    this.mountainLayers = [];

    const numLayers = 4;
    const topBoundary = height * 0.75;
    const bottomBoundary = height * 0.95;

    p.noiseDetail(4, 0.5);

    for (let l = 0; l < numLayers; l++) {
      const depthFactor = l / (numLayers - 1);
      const layerYIndex = shuffleMap[l];
      const layerY = topBoundary + p.random() * (bottomBoundary - topBoundary);
      const safeBaseY = Math.max(topBoundary, Math.min(bottomBoundary, layerY));
      const amplitude = height * 0.08;

      const layerFillHex = p.lerpColor(p.color('#03050a'), bgMid, depthFactor * 0.85).toString();
      const layerStrokeHex = p.lerpColor(p.color('#557799'), bgMid, depthFactor * 0.7).toString();

      // 능선 좌표 생성
      const ridgePoints = [];
      p.noiseSeed(seed + l * 100);
      for (let x = -50; x <= width + 50; x += 10) {
        const noiseVal = p.noise(x * 0.003, l * 100);
        const y = safeBaseY - (noiseVal * amplitude * 2.0);
        ridgePoints.push({ x, y });
      }

      // 고정 나무(점묘) 생성
      const dotDensity = p.map(depthFactor, 0, 1, 2, 8);
      const dotColorHex = p.lerpColor(p.color('#557799'), bgMid, depthFactor * 0.5).toString();
      const dots = [];

      p.noiseSeed(seed + l * 200);
      for (let k = 0; k < ridgePoints.length; k += Math.floor(dotDensity)) {
        const pt = ridgePoints[k];
        const ptN = p.noise(pt.x * 0.005, seed * 0.01 + l * 30);

        if (ptN > 0.3 + depthFactor * 0.2) {
          const dotSize = p.random(15, 35) * (1 - depthFactor * 0.4);
          
          // 나무 1그루당 4단계 오프셋 및 타원 형태 사전 고정 생성
          const subEllipses = [];
          for (let i = 0; i < 4; i++) {
            subEllipses.push({
              dx: p.random(-2, 2),
              levelY: -dotSize * (0.2 + i * 0.25),
              levelW: dotSize * (0.6 - i * 0.15) + p.random(-3, 3),
              levelH: (dotSize * (0.6 - i * 0.15)) * 0.7
            });
          }

          dots.push({
            x: pt.x,
            y: pt.y,
            colorHex: dotColorHex,
            subEllipses
          });
        }
      }

      this.mountainLayers.push({
        depthFactor,
        layerFillHex,
        layerStrokeHex,
        ridgePoints,
        dots
      });
    }
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
    this.mountainLayers = [];
    this.currentAudioData = null;
  }
}
