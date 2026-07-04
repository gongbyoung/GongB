/**
 * 011_p5_ocean_wave.js
 * 6겹의 바다 레이어가 20%~60% 높이에 배치되며, 
 * 전체 볼륨을 무시하고 6개 주파수 대역에만 반응하여 우아하게 솟구치고 하얀 포말(%)을 만들어내는 미디어 아트
 */
export default class P5OceanWaveStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 6; // 6겹의 파도 레이어
    this.currentHeights = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.particles = []; // 물방울 파티클
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
        
        // 1. 심연의 밤바다 배경
        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#02040a'); // 밤하늘
        bgGrad.addColorStop(0.5, '#051020'); // 수평선
        bgGrad.addColorStop(1, '#000000'); // 심해
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        if (!this.currentAudioData) return;

        // UI 컨트롤 패널 연동
        let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42;
        let colorStyle = 'neon';
        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent; 
          gain = window.cosmicEngineSettings.audioGain;          
          glow = window.cosmicEngineSettings.glowIntensity;
          seed = window.cosmicEngineSettings.seed;
          colorStyle = window.cosmicEngineSettings.colorStyle;
        }

        // 💡 [지형 변경] Random Seed에 따라 6개 파도가 담당하는 주파수 악기 순서 셔플
        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            this.shuffleMap = [0, 1, 2, 3, 4, 5].sort(() => p.random() - 0.5);
        }

        // 전체 평균 볼륨 계산 (오토 게인 / 묻히는 현상 방지)
        let frameAverage = 0;
        if (this.currentAudioData.raw) {
            let sum = 0;
            for(let i=0; i<150; i++) sum += this.currentAudioData.raw[i];
            frameAverage = (sum / 150) / 255.0;
        }

        // 6개 주파수 대역 정밀 추출
        const targetHeights = new Float32Array(this.numBands);
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (this.currentAudioData.raw) {
            const binIndex = Math.floor(2 + Math.pow(i / 5, 1.5) * 100); 
            rawVal = this.currentAudioData.raw[binIndex] || 0;
          }

          let normalized = rawVal / 255.0;
          // 전체 시끄러움을 무시하고 해당 대역이 유독 튀어나올 때만 캐치
          let isolated = Math.max(0, normalized - (frameAverage * 0.8));
          
          // 파도가 극적으로 튀어오르게 제곱 스케일링
          targetHeights[i] = Math.pow(isolated, 1.8) * gain * 300; 

          // 스무딩 (점성 표현: 올라갈 땐 확 튀고, 내려갈 땐 물처럼 부드럽게)
          this.prevHeights[i] = this.currentHeights[i];
          if (targetHeights[i] > this.currentHeights[i]) {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.4;
          } else {
            this.currentHeights[i] += (targetHeights[i] - this.currentHeights[i]) * 0.08;
          }
        }

        const time = Date.now() * 0.001;

        // 💡 6겹의 파도 그리기 (뒤에서부터 앞으로)
        for (let idx = 0; idx < this.numBands; idx++) {
          // 셔플된 주파수 맵핑 가져오기
          let freqIdx = this.shuffleMap[idx];
          let amplitude = this.currentHeights[freqIdx] + 20; // 기본 일렁임 20 보장
          let delta = this.currentHeights[freqIdx] - this.prevHeights[freqIdx];

          // 💡 [배치 및 간격 조절] 
          // 하단 20%(height*0.8) ~ 60%(height*0.4) 사이 공간 활용
          const topBoundary = height * 0.4;
          const bottomBoundary = height * 0.8;
          const midPoint = (topBoundary + bottomBoundary) / 2;
          
          // scatter(분산범위) 슬라이더로 6겹 파도의 상하 간격을 넓히거나 좁힘
          const spacingScale = scatter / 2.2; 
          const spread = (bottomBoundary - topBoundary) * spacingScale;
          
          // idx 0이 가장 뒤쪽(상단), idx 5가 가장 앞쪽(하단)
          let baseY = midPoint - (spread / 2) + (idx / 5) * spread;

          // 🎨 [포말(White) 퍼센트 블렌딩] 
          // 바다 본연의 색상 (에메랄드/블루)
          let baseOceanColor = colorStyle === 'pastel' ? p.color('#2b5d8c') : p.color('#0f5e9c');
          let deepOceanColor = p.color('#020b1a');
          
          // Glow 슬라이더(0.0~5.0)를 %비율로 환산하여, 파도 꼭대기에 하얀색이 얼마나 섞일지 결정
          let whiteMixRatio = Math.min(1.0, (glow / 2.0)); 
          let crestColor = p.lerpColor(baseOceanColor, p.color(255, 255, 255), whiteMixRatio);

          // 1. 파도 몸통(Fill) 그라데이션
          const fillGrad = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY + height*0.3);
          fillGrad.addColorStop(0, p.lerpColor(deepOceanColor, crestColor, 0.6).toString()); 
          fillGrad.addColorStop(1, deepOceanColor.toString());
          
          // 2. 파도 테두리(Stroke) 그라데이션: 위로 튕기는 꼭대기일수록 설정한 %만큼 하얗게 변함
          const strokeGrad = ctx.createLinearGradient(0, baseY - amplitude * 1.5, 0, baseY);
          strokeGrad.addColorStop(0, crestColor.toString()); 
          strokeGrad.addColorStop(1, baseOceanColor.toString());

          ctx.fillStyle = fillGrad;
          ctx.strokeStyle = strokeGrad;
          ctx.lineWidth = 2.5;

          p.beginShape();
          // 프레임 제거를 위해 화면 밖에서 시작
          p.vertex(-100, height + 100); 
          p.curveVertex(-100, baseY);

          // 파도의 부드러운 굴곡 그리기
          for (let x = -50; x <= width + 50; x += 40) {
            // Perlin Noise를 이용해 현실적인 바다 물결 생성
            let noiseVal = p.noise(x * 0.003 - time * (0.2 + idx*0.05), idx * 10 + time * 0.1);
            let waveOffset = p.sin(x * 0.01 + time + idx) * 0.5 + 0.5; 
            
            // 주파수가 튀어오를 때(amplitude) 해당 구역의 물결이 크게 솟구침
            let y = baseY - (noiseVal * waveOffset) * amplitude * 2.0;
            
            p.curveVertex(x, y);

            // 💦 [물방울 튀김 연산] 파도가 급격히 솟구치고(Delta>5) 골짜기가 아닐 때 포말 파티클 튀어오름
            if (delta > 5.0 && noiseVal > 0.5 && p.random() < 0.2) {
              let splashCount = p.floor(p.random(1, 4));
              for(let s = 0; s < splashCount; s++) {
                  this.particles.push({
                      x: x + p.random(-20, 20),
                      y: y,
                      vx: p.random(-1.5, 1.5) - 1.0, // 바람에 약간 밀리는 느낌
                      vy: -p.random(2, 6) - (delta * 0.15), 
                      life: 255,
                      size: p.random(1.5, 4.0),
                      // 파티클 색상도 설정된 백색 혼합 비율(crestColor)을 따라감
                      color: crestColor 
                  });
              }
            }
          }

          p.curveVertex(width + 100, baseY);
          p.vertex(width + 100, height + 100);
          p.endShape(p.CLOSE);
        }

        // 💦 파티클(물방울) 물리 엔진 렌더링
        p.noStroke();
        ctx.shadowBlur = 8 * (glow / 2.0);
        ctx.shadowColor = '#ffffff';

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let pt = this.particles[i];
            
            pt.vy += 0.25; // 중력
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= p.random(3, 7); 

            // 파티클 투명도 적용
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
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.particles = [];
    this.currentAudioData = null;
  }
}
