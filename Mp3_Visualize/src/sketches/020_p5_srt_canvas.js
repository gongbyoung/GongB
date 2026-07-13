/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 11.0 (오가닉 그라디언트 셰이딩 및 분산형 부유 낙하 엔진 완결판)
 * - createRadialGradient 인터페이스 연동을 통해 입체적이고 수려한 그라디언트 잎사귀 구현
 * - 자막 영역 전역으로 목적지를 자연스럽게 분산하여 특정 한 점에 몰리는 클럼핑 버그 완치
 * - 삼각함수 조화진동(Harmonic Wave)을 궤적에 대입하여 가을바람에 나풀거리며 날아오는 물리 시공
 * - 남은 시간에 비례하여 레이어 밀도가 스무스하게 보간 상승하는 Easing 알고리즘 장착
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Organic Floating Gradient Engine Ver 11.0";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        this.accumulationBuffer = p.createGraphics(p.width, p.height);
        this.accumulationBuffer.clear();
        
        this.lastWidth = p.width;
        this.lastHeight = p.height;
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon' 
        };
        
        p.randomSeed(settings.seed);
        const style = settings.colorStyle; 

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1. SRT 자막 타임라인 추적 및 Easing 가림 임계 수치 환산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 150; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.09);

        // 💡 [갑작스러운 가림 완화]: 시간 간격을 Easing 계수로 치환하여 밀도 점진 상승 유도
        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const coverThresholdTime = p.map(settings.gaugeValue, 0.0, 1.0, 0.0, 2.8);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            // 종료 지점에 도달할수록 0.0에서 1.0으로 스무스하게 변화
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 2. 상시 낙하 스폰 레이트 결정 (coverFactor에 맞춰 점진적 폭발 발생)
        let spawnRate = 1; 
        if (isCoveringTimeWindow) {
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, Math.floor(settings.gaugeValue * 22)));
        }

        if (p.frameCount % 2 === 0) {
          for (let k = 0; k < spawnRate; k++) {
            this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor);
          }
        }

        // 3. 탑뷰 유기적 조화 물리엔진 업데이트
        this.updateParticlesPhysics(p, settings);

        // 4. [레이어 렌더링 순서박제]: 자막 레이어를 백그라운드에 먼저 묘사 (낙엽 아래 배치)
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY);

        // 5. 이미 바닥에 깔려서 무제한 누적되고 있는 그라디언트 영구 축적 버퍼 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 6. 현재 공중에서 바람을 타고 나풀거리며 날아오는 라이브 입자들을 최상단에 렌더링
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor) {
    const baseShapeSize = p.map(settings.audioGain, 0.1, 5.0, 15, 85);
    // 💡 개별 입자마다 크기 편차 부여
    const finalSize = p.random(baseShapeSize * 0.65, baseShapeSize * 1.35);
    const speedScale = p.map(settings.scatterExponent, 0.5, 5.0, 0.006, 0.035);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    // 사방 원형 테두리 외부 스폰 좌표계 수립
    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.8;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    // 화면 전역으로 골고루 분산되는 기본 목적지
    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 💡 [한 점 뭉침 완치]: 자막 박스의 대략적인 가로/세로 영역 폭에 맞춰 목적지를 넓게 분산 분출
    if (isCoveringTimeWindow && type !== 'rain') {
      const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
      const textWidthArea = fontSize * 5.0 * coverFactor;
      const textHeightArea = fontSize * 2.5 * coverFactor;
      
      targetX = (p.width / 2) + p.random(-textWidthArea, textWidthArea) + (settings.positionOffset?.x || 0);
      targetY = (p.height / 2) + p.random(-textHeightArea, textHeightArea) + (settings.positionOffset?.y || 0);
    }

    this.particles.push({
      x: startX,
      y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      pct: 0,
      // 가림 타이밍 시 진입 가속도를 점진적으로 튜닝
      step: isCoveringTimeWindow ? p.random(0.012, 0.038) : p.random(speedScale * 0.7, speedScale * 1.3),
      size: finalSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.03, 0.03),
      // 💡 나풀나풀 춤추는 진동 벡터 성분 추가
      waveSeed: p.random(100),
      waveAmp: p.random(15, 45),
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 45 : 450,
      alpha: 255
    });
  }

  updateParticlesPhysics(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.age++;

      if (pt.type === 'rain') {
        pt.alpha -= 5;
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          // 기본 보간 궤적 연산
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          // 💡 [가을 낙엽 부유 묘사]: 목적지로 날아오며 진행방향 직교축으로 나풀나풀 물결치는 동선 구현
          let waveOffset = Math.sin(pt.age * 0.06 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + waveOffset * 0.5;
          pt.y = rawY + waveOffset * 0.3;
          
          pt.angle += pt.spin;
        }

        // 목적지 도달 시 영구축적 오프스크린 버퍼에 그라디언트 스탬프를 찍고 배열 이탈
        if (pt.pct >= 1.0) {
          this.drawGradientShape(this.accumulationBuffer, pt);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawLiveParticles(p) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill();
        p.stroke(145, 185, 255, pt.alpha);
        p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.size * 0.05));
      } else {
        this.drawGradientShape(p, pt);
      }
    }
  }

  // 💡 [그라디언트 합성 엔진]: 네이티브 Canvas2D 그라디언트 맵을 p5/그래픽스 레이어에 완벽 주입
  drawGradientShape(target, pt) {
    let ctx = target.drawingContext;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);
    ctx.noStroke();

    // 원형 방사형 그라디언트 정의 (빛과 그림자의 자연스러운 분포 분출)
    let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pt.size * 1.2);

    if (pt.type === 'leaf') {
      // 🍁 No1 단풍잎: 타오르는 가을 불꽃의 단풍 그라디언트
      grad.addColorStop(0, 'rgba(255, 110, 60, 0.95)');   // 중심: 화사한 다홍빛
      grad.addColorStop(0.4, 'rgba(215, 55, 35, 0.95)');   // 중간: 깊은 단풍색
      grad.addColorStop(1, 'rgba(125, 25, 15, 0.95)');     // 외곽: 깊은 갈색 테두리
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = pt.size * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // 맥 줄기선 추가 드로잉
      ctx.strokeStyle = 'rgba(95, 15, 5, 0.4)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, pt.size * 1.05); ctx.stroke();
    } 
    else if (pt.type === 'grass') {
      // 🍃 No2 풀잎: 인맥의 깊이가 살아있는 오가닉 그린 그라디언트
      grad.addColorStop(0, 'rgba(150, 240, 95, 0.95)');   // 중심: 맑은 연두빛
      grad.addColorStop(0.5, 'rgba(50, 165, 70, 0.95)');   // 중간: 수려한 초록색
      grad.addColorStop(1, 'rgba(15, 75, 25, 0.95)');      // 외곽: 짙은 삼림색
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -pt.size * 1.3);
      ctx.bezierCurveTo(pt.size * 0.65, -pt.size * 0.45, pt.size * 0.65, pt.size * 0.65, 0, pt.size * 1.3);
      ctx.bezierCurveTo(-pt.size * 0.65, pt.size * 0.65, -pt.size * 0.65, -pt.size * 0.45, 0, -pt.size * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(10, 50, 15, 0.4)';
      ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.moveTo(0, -pt.size * 1.1), ctx.lineTo(0, pt.size * 1.1); ctx.stroke();
    } 
    else if (pt.type === 'snow') {
      // ❄️ No3 눈꽃송이: 겨울 결정체 성에 입체 그라디언트
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');   // 중심: 화이트
      grad.addColorStop(1, 'rgba(175, 210, 255, 0.60)');   // 외곽: 아이스 블루
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2.2, pt.size * 0.09);
      
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -pt.size);
        ctx.moveTo(0, -pt.size * 0.4); ctx.lineTo(pt.size * 0.35, -pt.size * 0.6);
        ctx.moveTo(0, -pt.size * 0.4); ctx.lineTo(-pt.size * 0.35, -pt.size * 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // Easing 계수를 반영한 자막의 점진적 선형 소멸 알파 계산
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const offX = settings.positionOffset?.x || 0;
    const offY = settings.positionOffset?.y || 0;
    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let currentRawX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        
        let finalX = currentRawX;
        let finalY = currentLineY;

        if (style === 'earth') {
          let wave = p.sin(p.frameCount * 0.12 + charIdx * 0.7) * (settings.gaugeValue * 45);
          finalX += wave * 0.8;
          finalY += p.cos(p.frameCount * 0.09 + charIdx) * wave * 0.5;
        }

        p.fill(255, alphaFade);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });

    // 자막 소멸 매립 시점 완료 플래그 작동
    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 18] : style === 'pastel' ? [30, 95, 35, 18] : [220, 230, 245, 12]);
       this.accumulationBuffer.rect(0, 0, p.width, p.height);
    }
  }

  update(audioData) { if (this.p5Instance) this.p5Instance.redraw(); }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    this.particles = [];
  }
}
