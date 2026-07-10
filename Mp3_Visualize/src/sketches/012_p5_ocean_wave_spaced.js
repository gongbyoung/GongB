/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.2 (배경 이미지 지원 및 마스터 조작 가이드 콘솔 출력 완결판)
 * - 사용자가 업로드한 이미지(window.currentUploadedImageElement)를 배경화면으로 실시간 자동 매핑
 * - 초기화(init) 시점에 현재 시스템 버전 및 패널별 정밀 조작법 가이드를 브라우저 콘솔에 자동 출력
 * - SRT 자막 연동 엔진을 전면 걷어내고 오직 음악 비트와 매뉴얼 패널 수치로만 깔끔하게 구동되는 앰비언트 모드 완비
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    this.smoothedInput = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.currentMode = "공명 바운스";
    this.version = "Satisfying Orbs 물리 스튜디오 Ver 7.2";
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

    // 💡 [초기화 가이드 시스템]: 현재 버전 명칭 및 패널 조작 메뉴얼 콘솔 출력 부량
    console.log(`%c[🔮 012호 시스템 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
      `%c🛠️ 마스터 패널 실시간 제어 가이드\n` +
      `1. Shuffle  ➡️ 입력하는 숫자에 따라 3가지 물리 모드(공명 바운스 / 진자 웨이브 / 무한 마블 런)가 무작위로 교체됩니다.\n` +
      `2. Range    ➡️ 9개 공(Orb)의 크기 및 가로 배치 간격(Spacing)의 너비를 조절합니다.\n` +
      `3. Scale    ➡️ 공들이 바닥에 부딪히거나 회전할 때 뿜어져 나오는 네온 빛(Glow)의 Blur 확산 강도를 조절합니다.\n` +
      `4. Volume   ➡️ 오디오 소리에 반응하여 공이 운동하는 물리적인 진폭(바운스 및 하강 속도)을 증폭시킵니다.\n` +
      `5. Gauge    ➡️ 공명 바운스 및 마블 런 모드에서 공들이 기본적으로 굴러가는 기저 속도를 제어합니다.`,
      "color: #ffffff; line-height: 1.6;"
    );

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        
        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.height / 2,
            vy: 0,
            angle: 0
          });
        }
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        if (!this.currentAudioData) { p.clear(); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); return; }

        let scatter = 22, gain = 100, glow = 85, seed = 42, gauge = 50;
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          customColors = window.cosmicEngineSettings.customColors || customColors;
        }

        // Shuffle 수치 변경 시 물리 테이블 무대 리셋 분기
        if (this.loadedSeed !== seed) {
            this.loadedSeed = seed;
            p.randomSeed(seed);
            
            let modes = ["공명 바운스", "진자 웨이브", "무한 마블 런"];
            this.currentMode = modes[p.floor(p.random(modes.length))];
            console.log(`%c[🎛️ 무대 스위칭 리포트] 현재 가동 중인 물리 법칙: ${this.currentMode}`, "color: #ffaa00; font-weight: bold;");
            
            for (let i = 0; i < this.numBands; i++) {
                this.orbs[i].y = height / 2;
                this.orbs[i].vy = 0;
            }
        }

        p.clear();

        // 💡 [배경 이미지 엔진 이식 완료]
        // 사용자가 로컬에서 이미지를 업로드했으면 무대 배경에 꽉 차게 드로잉 처리
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            // 가독성을 위해 어두운 반투명 틴트 레이어 한 겹 필터링
            ctx.fillStyle = 'rgba(10, 5, 25, 0.7)';
            ctx.fillRect(0, 0, width, height);
        } else {
            // 업로드된 이미지가 없을 때는 기존 오리지널 앰비언트 그라디언트 맵 가동
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#0a001a');
            bgGrad.addColorStop(0.5, '#15002a');
            bgGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 오디오 타격 버퍼 주입
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            for (let i = 0; i < this.numBands; i++) {
                const binIndex = p.floor(2 + Math.pow(i / 8, 1.3) * 120); 
                let rawVal = (binIndex < this.currentAudioData.raw.length) ? this.currentAudioData.raw[binIndex] : 0;
                let normalized = Math.pow(rawVal / 255.0, 1.8);
                
                let currentH = this.smoothedInput[i];
                let targetH = normalized * (gain * 1.5); 

                currentH += (targetH - currentH) * 0.25;
                this.smoothedInput[i] = currentH;
            }
        }

        const time = Date.now() * 0.0015;
        const orbSize = p.map(scatter, 5, 50, 12, 38); // Range에 매핑된 공 크기
        const baseGlow = p.map(glow, 10, 250, 4, 30);  // Scale에 매핑된 광량 퍼짐 정도

        const spacing = p.map(scatter, 5, 50, width * 0.07, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 가이드 트랙 가이드라인 렌더링
        p.strokeWeight(1);
        for (let i = 0; i < this.numTracks; i++) {
          let lineC = p.color(customColors.gas2);
          let x = startX + i * spacing;
          
          if (this.currentMode === "공명 바운스") {
              lineC.setAlpha(25); p.stroke(lineC);
              p.line(x, height * 0.1, x, height * 0.8);
          } else if (this.currentMode === "진자 웨이브") {
              p.beginShape(); p.noFill();
              lineC.setAlpha(35); p.stroke(lineC);
              for (let y = height * 0.15; y <= height * 0.85; y += 15) {
                  let yRatio = p.map(y, height * 0.15, height * 0.85, 0, p.PI * 2);
                  let guideX = x + p.sin(yRatio + time) * (spacing * 0.15); 
                  p.curveVertex(guideX, y);
              }
              p.endShape();
          } else if (this.currentMode === "무한 마블 런") {
              let lineC_2 = p.color(customColors.gas1);
              lineC_2.setAlpha(40); p.stroke(lineC_2);
              p.line(x, 0, x, height);
          }
        }

        // 네온 글로우 발광 콘텍스트 고정
        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        // 9개 공 물리 법칙 투사 루프
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === "공명 바운스") {
            const gravity = 0.4 + (gauge * 0.005); // Gauge 수치로 기본 탄성 가중치 가변
            pt.vy += gravity;
            pt.vy -= input * 2.5; 
            pt.vy *= 0.97; 
            pt.y += pt.vy;

            if (pt.y > height * 0.8) {
              pt.y = height * 0.8;
              pt.vy = -pt.vy * 0.65; 

              // 충돌 스플래시 발광 효과
              ctx.shadowBlur = baseGlow * 2.5;
              ctx.shadowColor = orbColor;
              let flashC = p.lerpColor(orbColor, p.color(255), 0.5);
              p.fill(flashC);
              p.circle(x, pt.y, orbSize * 1.3);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            } else if (pt.y < height * 0.1) { pt.y = height * 0.1; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === "진자 웨이브") {
            const pendulumBaseH = height * 0.35;
            const pivotY = height * 0.1;

            let pendulumLen = pendulumBaseH + i * (spacing * 0.5) - input * 1.0;
            
            // 아름다운 하모닉 정현파 무한 루프 진동 수식
            let phase = time * (0.7 + i * 0.07) + p.PI / 2; 
            let theta = p.sin(phase) * 0.4; 
            
            p.strokeWeight(1.5);
            let lineC = p.color(customColors.gas2); lineC.setAlpha(90); p.stroke(lineC);
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
            
            // Gauge 수치에 오디오 진폭을 더해 낙하 롤링 속도 직결 제어
            let currentVy = (gauge * 0.1) + 2.0 + (i * 0.4) + (input * 2.0);
            pt.y += currentVy; 

            if (pt.y > railBottom) {
              pt.y = railTop; 
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
