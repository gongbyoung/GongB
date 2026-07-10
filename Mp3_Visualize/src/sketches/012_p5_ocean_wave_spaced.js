/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.7 (스피어 크기/위치 UI 단독 매핑 및 네온 Trail 잔상 완결판)
 * - 비어있던 3D Position Offset X를 '모든 공의 크기(Size)' 제어로, Y를 '공들의 상하 중심 위치(Y-Center)' 제어로 완벽 바인딩
 * - Range(scatter)는 오직 레일의 가로 간격(Spacing) 확장 역할만 전담하도록 명확히 분리
 * - 캔버스 알파 페이딩 버퍼 기믹을 통해 공명 바운스, 진자 웨이브, 마블 런 모든 모드에 영롱한 꼬리 잔상(Trail) 탑재
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    this.smoothedInput = new Float32Array(this.numBands);
    this.audioHistory = new Float32Array(this.numBands);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.currentMode = "공명 바운스";
    this.version = "정밀 UI 매핑 및 잔상 물리 스튜디오 Ver 7.7";
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

    console.log(`%c[🔮 012호 정밀 매핑 완료] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
      `%c🛠️ 신규 확장 조작 변수 가이드\n` +
      `1. 🔴 3D Position Offset X ➡️ 모든 스피어(공)의 개별 크기(Diameter)를 제어합니다. (추천: 15~50)\n` +
      `2. 🟢 3D Position Offset Y ➡️ 공들의 상하 중간 기준 위치(Y-Center)를 오프셋 제어합니다.\n` +
      `3. 🌊 Range (Range 5~50)  ➡️ 이제 공 크기와 무관하게 오직 레일간 '가로 간격' 너비만 조절합니다.\n` +
      `• 모든 물리 무대에 실시간 네온 궤적 꼬리(Trail) 잔상 엔진이 기본 가동됩니다.`,
      "color: #ffff00; line-height: 1.6;"
    );

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        
        let seed = 42;
        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
        }

        p.randomSeed(seed);
        let modes = ["공명 바운스", "진자 웨이브", "무한 마블 런"];
        this.currentMode = modes[p.floor(p.random(modes.length))];
        console.log(`%c[⚡ RESET 세계관] 결정된 하드웨어 물리: ${this.currentMode}`, "color: #00ffcc; font-weight: bold;");

        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.height / 2, // 기본적으로 화면 정중앙(중간)에 안착
            vy: 0,
            angle: 0
          });
        }
        this.loadedSeed = seed;
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        if (!this.currentAudioData) { p.clear(); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); return; }

        let scatter = 22, gain = 100, glow = 85, seed = 42, gauge = 50;
        let offX = 0, offY = 0; // X(크기), Y(중심위치) 매핑용 변수 초기화
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          customColors = window.cosmicEngineSettings.customColors || customColors;
          
          // 💡 비어있던 오프셋 패널 수치를 다이렉트로 인터셉트
          offX = window.cosmicEngineSettings.positionOffset?.x || 0; // 공의 크기 가인
          offY = window.cosmicEngineSettings.positionOffset?.y || 0; // 공의 상하 중간 정렬 변위
        }

        // 💡 [핵심 구현: 영롱한 Trail 잔상 캔버스 엔진 수립]
        // 매 프레임 화면을 완전히 clear()하지 않고, 반투명 검은색 틴트를 입혀 꼬리 잔상을 보존합니다.
        ctx.save();
        ctx.shadowBlur = 0; // 배경 드로잉 시 블러 간섭 제거
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            ctx.fillStyle = 'rgba(12, 6, 24, 0.18)'; // 잔상 길이를 최적으로 유지하는 알파 블로킹 틴트 (0.18)
            ctx.fillRect(0, 0, width, height);
        } else {
            // 그라디언트 배경 위에도 꼬리가 남도록 반투명 오버레이
            ctx.fillStyle = 'rgba(10, 0, 22, 0.18)';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();

        // 100분의 1초 단위 한 박자 타격 스파이크 역산 엔진
        const spikeTrigger = new Float32Array(this.numBands);
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const dataLen = this.currentAudioData.raw.length;
            const instrumentIndices = [
                p.floor(dataLen * 0.02), p.floor(dataLen * 0.06), p.floor(dataLen * 0.10),
                p.floor(dataLen * 0.16), p.floor(dataLen * 0.26), p.floor(dataLen * 0.42),
                p.floor(dataLen * 0.60), p.floor(dataLen * 0.76), p.floor(dataLen * 0.92)
            ];

            for (let i = 0; i < this.numBands; i++) {
                let idx = p.constrain(instrumentIndices[i], 0, dataLen - 1);
                let rawVal = this.currentAudioData.raw[idx] || 0;
                let normalized = Math.pow(rawVal / 255.0, 1.6) * (gain * 1.5);
                
                let delta = normalized - this.audioHistory[i];
                if (delta > 0.08) { spikeTrigger[i] = delta * 4.5; }
                this.audioHistory[i] = normalized;

                let isPercussion = (i === 0 || i === 1 || i === 5 || i === 7);
                let lerpFactor = isPercussion ? 0.4 : 0.15;
                this.smoothedInput[i] += (normalized - this.smoothedInput[i]) * lerpFactor;
            }
        }

        const time = Date.now() * 0.0015;
        
        // 💡 [UI 변수 다이렉트 직결 변환 고정]
        // 1) 공 크기 조절: positionOffset.x (기본 0일 때 폴백 22, 입력하는 수치대로 실시간 픽셀 반경 락인)
        const orbSize = (offX !== 0) ? p.constrain(offX, 5, 120) : 22; 
        // 2) 상하 중간 정렬 위치: 화면 절반(중간) 축에 positionOffset.y 오프셋을 더함
        const centerYBase = (height / 2) + (offY * -1.5); // 방향 직관성 보정
        
        const baseGlow = p.map(glow, 10, 250, 4, 32);  
        // Range는 이제 오직 순수 가로 간격(Spacing)만 지배합니다.
        const spacing = p.map(scatter, 5, 50, width * 0.072, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 가이드 트랙 가선 드로잉 (중심 Y축 연동)
        p.strokeWeight(1);
        for (let i = 0; i < this.numTracks; i++) {
          let lineC = p.color(customColors.gas2);
          let x = startX + i * spacing;
          
          if (this.currentMode === "공명 바운스") {
              lineC.setAlpha(15); p.stroke(lineC);
              p.line(x, centerYBase - height * 0.35, x, centerYBase + height * 0.35);
          } else if (this.currentMode === "진자 웨이브") {
              p.beginShape(); p.noFill();
              lineC.setAlpha(20); p.stroke(lineC);
              for (let y = centerYBase - height * 0.35; y <= centerYBase + height * 0.35; y += 15) {
                  let yRatio = p.map(y, centerYBase - height * 0.35, centerYBase + height * 0.35, 0, p.PI * 2);
                  let guideX = x + p.sin(yRatio + time) * (spacing * 0.1); 
                  p.curveVertex(guideX, y);
              }
              p.endShape();
          } else if (this.currentMode === "무한 마블 런") {
              let lineC_2 = p.color(customColors.gas1);
              lineC_2.setAlpha(25); p.stroke(lineC_2);
              p.line(x, 0, x, height);
          }
        }

        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        // 9개 오브제 박자 및 네온 Trail 드로잉 루프
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          let spike = spikeTrigger[i]; 
          
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === "공명 바운스") {
            const gravity = 0.35 + (gauge * 0.0055); 
            pt.vy += gravity;
            
            if (spike > 0.0) { pt.vy -= spike * 3.5; }
            pt.vy *= 0.955; 
            pt.y += pt.vy;

            // Y 중심점 연동 바닥 경계선 바운스 설정 (바닥선이 아니라 지정한 중간 영역 안에서 바운스)
            let limitBottom = centerYBase + height * 0.3;
            let limitTop = centerYBase - height * 0.3;

            if (pt.y > limitBottom) {
              pt.y = limitBottom;
              pt.vy = -pt.vy * 0.6; 

              ctx.shadowBlur = baseGlow * 2.5; ctx.shadowColor = orbColor;
              let flashC = p.lerpColor(orbColor, p.color(255), 0.6); p.fill(flashC);
              p.circle(x, pt.y, orbSize * 1.3);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            } else if (pt.y < limitTop) { pt.y = limitTop; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === "진자 웨이브") {
            // Y 중심점 정렬 기저 기준 진자 물리 변형
            const pendulumBaseH = height * 0.32;
            const pivotY = centerYBase - height * 0.35;

            let pendulumLen = pendulumBaseH + i * (spacing * 0.45) - (input * 1.0) - (spike * 1.5);
            let phase = time * (0.65 + i * 0.065) + p.PI / 2; 
            let theta = p.sin(phase) * 0.42; 
            
            p.strokeWeight(1.5);
            let lineC = p.color(customColors.gas2); lineC.setAlpha(60); p.stroke(lineC);
            let pendX = x + p.sin(theta) * pendulumLen;
            let pendY = pivotY + p.cos(theta) * pendulumLen;
            
            p.line(x, pivotY, pendX, pendY);
            p.noStroke();
            
            p.fill(orbColor);
            ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            p.circle(pendX, pendY, orbSize * 1.05);
            
          } else if (this.currentMode === "무한 마블 런") {
            const railTop = -orbSize * 2;
            const railBottom = height + orbSize * 2;
            
            let currentVy = (gauge * 0.12) + 1.2 + (i * 0.35) + (input * 1.2) + (spike * 4.0);
            pt.y += currentVy; 

            if (pt.y > railBottom) { pt.y = railTop; }

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
