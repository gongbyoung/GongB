/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.0 (3in1 통합 물리 스튜디오 - Satisfying Orbs)
 * - 5가지 제안 중 p5.js 물리 엔진으로 구현 가능한 3가지(공명 바운스, 진자 웨이브, 무한 마블 런)를 하나의 스케치로 통합
 * - Shuffle(seed) 입력 시마다 랜덤하게 3가지 물리 모드 중 하나로 전수 스위칭
 * - 9개의 공(Orb)이 9개의 주파수 밴드와 직결되어 물리적으로 요동침
 * - Volume(gain)은 공의 운동 세기, Scale(glow)은 네온 발광 디테일, Range(scatter)는 공 간 격차 제어
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    // 💡 9개의 주파수 직결 당구공 시스템 구축
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    // 오디오 전용 정제 버퍼
    this.smoothedInput = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.currentMode = " 공명 바운스"; // 초기 모드
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
        
        // 초기 물리 오보에 정의
        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.height / 2,
            vy: 0,
            angle: 0,
            phase: i * 0.2 // 진자 웨이브 위차차
          });
        }
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        if (!this.currentAudioData) { p.clear(); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); return; }

        let scatter = 22, gain = 100, glow = 85, seed = 42;
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          customColors = window.cosmicEngineSettings.customColors || customColors;
        }

        // 💡 [핵심 구현: 매 Shuffle 입력 시마다 물리 모드 전수 랜덤 스위칭]
        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            
            // 모드 랜덤 결정 (3in1)
            let modes = [" 공명 바운스", " 진자 웨이브", " 무한 마블 런"];
            this.currentMode = modes[p.floor(p.random(modes.length))];
            console.log(`%c[🎛️ 물리 테이블 모드 전환 완료] 새로운 무대: ${this.currentMode} (시드: ${seed})`, "color: #ffaa00; font-weight: bold;");
            
            // 모드 변경 시 물리 변수 초기화
            for (let i = 0; i < this.numBands; i++) {
                this.orbs[i].y = height / 2;
                this.orbs[i].vy = 0;
                if (this.currentMode === " 진자 웨이브") {
                    this.orbs[i].angle = p.radians(90); // 수직 시작
                }
            }
        }

        // 배경 그라디언트 (우주 당구대 느낌)
        p.clear();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0a001a');
        bgGrad.addColorStop(0.5, '#15002a');
        bgGrad.addColorStop(1, '#000000');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 오디오 데이터 분석 및 정제
        const targetHeights = new Float32Array(this.numBands);
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            for (let i = 0; i < this.numBands; i++) {
                // 💡 9개의 공이 9개의 다른 주파수 대역과 직결
                const binIndex = p.floor(2 + Math.pow(i / 8, 1.3) * 120); 
                let rawVal = (binIndex < this.currentAudioData.raw.length) ? this.currentAudioData.raw[binIndex] : 0;
                let normalized = Math.pow(rawVal / 255.0, 1.8);
                
                // Spring 물리로 가속도 보간
                let currentH = this.smoothedInput[i];
                let targetH = normalized * gain * 0.5; // 공의 바운스 강도

                if (currentH < targetH) { currentH += (targetH - currentH) * 0.3; } 
                else { currentH += (targetH - currentH) * 0.1; }
                
                this.smoothedInput[i] = currentH;
            }
        }

        const time = Date.now() * 0.001;
        const orbSize = mix(scatter, 5, 50, 10, 30); // Range로 공 크기 제어
        const baseGlow = mix(glow, 10, 250, 5, 25); // Scale로 네온 발광 디테일 제어

        // 9개의 물리 테이블 트랙 오프셋 계산
        const spacing = mix(scatter, 5, 50, width * 0.08, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 트랙 가이드라인 드로잉
        for (let i = 0; i < this.numTracks; i++) {
          p.noStroke();
          let lineC = p.color(customColors.gas2);
          lineC.setAlpha(30);
          p.fill(lineC);
          let x = startX + i * spacing;
          
          if (this.currentMode === " 공명 바운스") {
              p.rect(x - 1, height * 0.1, 2, height * 0.8);
          } else if (this.currentMode === " 진자 웨이브") {
              // 진자 춤추는 곡선 가이드 (무질서 속 질서의 예시 곡선)
              p.beginShape();
              p.noFill();
              lineC.setAlpha(50);
              p.stroke(lineC);
              p.strokeWeight(1);
              let pendulumH = height * 0.3;
              for (let y = height * 0.2; y <= height * 0.8; y += 10) {
                  let yRatio = p.map(y, height * 0.2, height * 0.8, 0, p.PI * 2);
                  let guideX = x + sin(yRatio + time) * (spacing * 0.2); 
                  p.curveVertex(guideX, y);
              }
              p.endShape();
          } else if (this.currentMode === " 무한 마블 런") {
              // 9개의 가이드 레일 (Satisfying Marble Run)
              let lineC_2 = p.color(customColors.gas1);
              lineC_2.setAlpha(50);
              p.fill(lineC_2);
              p.rect(x - 1, 0, 2, height);
          }
        }

        // Satisfying 네온 발광 적용
        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        // 9개의 공 물리 시뮬레이션 및 드로잉
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          
          // 공 배색 (Range에 따라 에메랄드와 핑크 사이)
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === " 공명 바운스") {
            // 💡 Mode 1 물리: Spring(용스프링) 바운스
            const gravity = 0.5;
            const targetY = height / 2;
            
            pt.vy += gravity;
            pt.vy -= input * 2.0; // 소리 타격에 따라 하늘로 요동
            pt.vy *= 0.98; // 공기 저항
            pt.y += pt.vy;

            // 바닥 충돌 및 바운스 (뇌에 만족감을 주는 물리)
            if (pt.y > height * 0.8) {
              pt.y = height * 0.8;
              pt.vy = -pt.vy * 0.6; // Satisfying 바운스 계수

              // 바닥 충돌 시 만족감을 주는 네온 발광
              ctx.shadowBlur = baseGlow * 2.0;
              ctx.shadowColor = orbColor;
              p.fill(orbColor);
              let whiteMix = p.color(255); whiteMix.setAlpha(pt.vy * 5); 
              p.fill(p.lerpColor(orbColor, whiteMix, 0.4)); // 충돌 순간 하얗게 번쩍
              p.circle(x, pt.y, orbSize * 1.5);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star; // 리셋
            } else if (pt.y < height * 0.1) { pt.y = height * 0.1; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === " 진자 웨이브") {
            // 💡 Mode 2 물리: 중력(Gravity) 및 Pendulum(진자) 웨이브
            const pendulumBaseH = height * 0.4;
            const pivotY = height * 0.1;
            const gravity = 0.98; // Satisfying 중력 상수
            const friction = 0.9995; // 끊임없이 도는 물리

            // 오디오 타격에 따른 진자 길이 가변
            let pendulumLen = pendulumBaseH + i * (spacing * 0.6) - input * 1.2;
            
            // 각 공마다 다른 주기를 주는 만족스러운 질서의 곡선 공식
            let phase = time * (0.8 + i * 0.08) + p.PI / 2; 
            let theta = p.sin(phase) * (mix(gain, 10, 500, 10, 45) * 0.01); // Volume으로 진폭 제어
            
            // 진자 줄 및 공 드로잉
            p.strokeWeight(1);
            let lineC = p.color(customColors.gas2); lineC.setAlpha(100); p.stroke(lineC);
            let pendX = x + p.sin(theta) * pendulumLen;
            let pendY = pivotY + height * 0.1 + p.cos(theta) * pendulumLen;
            
            p.line(x, pivotY + height * 0.1, pendX, pendY);
            p.noStroke();
            
            p.fill(orbColor);
            ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            p.circle(pendX, pendY, orbSize * 1.1);
            
          } else if (this.currentMode === " 무한 마블 런") {
            // 💡 Mode 3 물리: 무한 루프(Satisfying Marble Run)
            const gravity = 0.6;
            const railTop = -orbSize * 2;
            const railBottom = height + orbSize * 2;
            
            // 오디오 타격에 따른 공의 하강 속도 가인 가변
            let rollingSpeedBase = mix(gain, 10, 500, 2.0, 15.0) + i * 0.5;
            let currentVy = rollingSpeedBase + input * 1.5; 
            
            pt.y += currentVy; // 만족스럽게 굴러가기

            // 하단 도달 시 Satisfying 루프 ( 순간이동 )
            if (pt.y > railBottom) {
              pt.y = railTop; // 뇌에 만족감을 주는 완벽한 리셋 루프
            }

            p.fill(orbColor);
            ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            p.circle(x, pt.y, orbSize);
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
    this.orbs = [];
    this.currentAudioData = null;
  }
}

// 💡 헬퍼 함수: 범위 매핑
function mix(val, inMin, inMax, outMin, outMax) {
  let mapped = ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  return Math.min(Math.max(mapped, Math.min(outMin, outMax)), Math.max(outMin, outMax));
}
