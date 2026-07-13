/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 9.5 (탑뷰 사방 유입 축적 엔진 및 자막 매립 타이밍 완결판)
 * - 사방 외곽 경계선에서 생성되어 화면 안쪽 목적지로 날아와 평면적으로 쌓이는 리얼 탑뷰 시뮬레이션
 * - Volume 기반 크기 스케일에 미세 난수 배율을 바인딩하여 조금씩 다른 크기 편차 구현
 * - 자막 가림 타이밍 진입 시 목적지가 자막 박스로 타겟팅되어 완벽하게 매립 소멸 유도
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    // 탑뷰 영구 안착 레이어를 위한 오프스크린 가상 캔버스 버퍼
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.version = "020호 Top-View Omni Accumulator Ver 9.5";
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

        // 1. SRT 자막 타임라인 트래킹 및 GAUGE 가림 윈도우 연산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const coverThresholdTime = p.map(settings.gaugeValue, 0.0, 1.0, 0.0, 2.5);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
          }
        }

        // 2. 사방 생성 속도 조절 (가림 타이밍에는 폭발적으로 증가)
        let spawnRate = p.floor(p.map(settings.gaugeValue, 0.0, 1.0, 1, 5));
        if (isCoveringTimeWindow) spawnRate *= 4; 

        if (p.frameCount % 2 === 0) {
          for (let k = 0; k < spawnRate; k++) {
            this.spawnParticle(p, style, settings, isCoveringTimeWindow);
          }
        }

        // 3. 탑뷰 물리 엔진 업데이트 및 고착화
        this.updateAndBufferParticles(p, settings);

        // 4. 누적된 탑뷰 배경 레이어 묘사
        p.image(this.accumulationBuffer, 0, 0);

        // 5. 황금비율 자막 레이어 최종 렌더링
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, currentSub);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow) {
    // 💡 [크기 편차 구현]: Volume 수치 기본 크기에 난수(0.65 ~ 1.35)를 곱해 조금씩 다르게 바인딩
    const baseShapeSize = p.map(settings.audioGain, 0.1, 5.0, 15, 90);
    const finalSize = p.random(baseShapeSize * 0.65, baseShapeSize * 1.35);
    
    const speedScale = p.map(settings.scatterExponent, 0.5, 5.0, 0.02, 0.12);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    // 💡 [탑뷰 사방 유입 매커니즘]: 화면 중앙을 기준으로 바깥쪽 원형 경계선에서 스폰 좌표 산출
    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.7;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    // 최종 안착할 평면 목적지(Target) 계산
    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 자막 가림 시간대에는 목적지를 자막 텍스트 바운더리 내부로 강제 밀착
    if (isCoveringTimeWindow && type !== 'rain') {
      const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
      targetX = (p.width / 2) + p.random(-fontSize * 2.2, fontSize * 2.2) + (settings.positionOffset?.x || 0);
      targetY = (p.height / 2) + p.random(-fontSize * 1.2, fontSize * 1.2) + (settings.positionOffset?.y || 0);
    }

    this.particles.push({
      x: startX,
      y: type === 'rain' ? p.random(p.height) : startY,
      targetX: targetX,
      targetY: targetY,
      pct: 0, // 목적지 도달 백분율 (0.0 -> 1.0)
      step: p.random(speedScale * 0.7, speedScale * 1.3),
      size: finalSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.06, 0.06),
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 45 : 300,
      alpha: 255
    });
  }

  updateAndBufferParticles(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.age++;

      if (pt.type === 'rain') {
        // [비 효과]: 탑뷰 수면 리플 파동 물리
        pt.alpha -= 6;
        p.noFill();
        p.stroke(150, 195, 255, pt.alpha);
        p.strokeWeight(2);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.size * 0.05));
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        // [낙엽, 풀잎, 눈 효과]: 사방에서 목적지로 Lerp 이동
        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          // 목적지 유입 좌표 보간 연산
          pt.x = p.lerp(pt.x, pt.targetX, pt.pct);
          pt.y = p.lerp(pt.y, pt.targetY, pt.pct);
          pt.angle += pt.spin;
        }

        // 날아오는 도중의 실시간 공중 객체 묘사
        p.push();
        p.translate(pt.x, pt.y);
        p.rotate(pt.angle);
        p.noStroke();
        this.drawNatureShape(p, pt);
        p.pop();

        // 💡 목적지에 완벽히 도달하면 가상 백버퍼에 영구 낙인 후 배열 제거 (무제한 축적 보장)
        if (pt.pct >= 1.0) {
          this.accumulationBuffer.push();
          this.accumulationBuffer.translate(pt.x, pt.y);
          this.accumulationBuffer.rotate(pt.angle);
          this.accumulationBuffer.noStroke();
          this.drawNatureShape(this.accumulationBuffer, pt);
          this.accumulationBuffer.pop();

          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawNatureShape(ctx, pt) {
    if (pt.type === 'leaf') {
      ctx.fill(205, 65, 40, 245);
      ctx.beginShape();
      for (let a = 0; a < 6.28; a += 0.06) {
        let r = pt.size * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        ctx.vertex(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.endShape(2); // CLOSE
      ctx.stroke(135, 28, 18); ctx.strokeWeight(1.8); ctx.line(0, 0, 0, pt.size * 1.05);
    } 
    else if (pt.type === 'grass') {
      ctx.fill(55, 165, 75, 245);
      ctx.beginShape();
      ctx.vertex(0, -pt.size * 1.3);
      ctx.bezierVertex(pt.size * 0.65, -pt.size * 0.45, pt.size * 0.65, pt.size * 0.65, 0, pt.size * 1.3);
      ctx.bezierVertex(-pt.size * 0.65, pt.size * 0.65, -pt.size * 0.65, -pt.size * 0.45, 0, -pt.size * 1.3);
      ctx.endShape(2);
      ctx.stroke(32, 105, 42); ctx.strokeWeight(2.2); ctx.line(0, -pt.size * 1.15, 0, pt.size * 1.15);
    } 
    else if (pt.type === 'snow') {
      // ❄️ 눈송이 결정이 바닥에 부드럽게 쌓이도록 탑뷰 묘사
      ctx.stroke(245, 250, 255, 240);
      ctx.strokeWeight(Math.max(2.2, pt.size * 0.09));
      for (let j = 0; j < 6; j++) {
        ctx.rotate(3.14159 / 3);
        ctx.line(0, 0, 0, -pt.size);
        ctx.line(0, -pt.size * 0.4, pt.size * 0.35, -pt.size * 0.6);
        ctx.line(0, -pt.size * 0.4, -pt.size * 0.35, -pt.size * 0.6);
      }
    }
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, currentSub) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // 자막 덮기 시점 도달 시 투명도를 감쇠시켜 자연스럽게 파묻히는 연출
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      const audioEl = document.getElementById('audio-player');
      const currentTime = audioEl ? audioEl.currentTime : 0;
      const progress = (currentSub.end - currentTime) / p.map(settings.gaugeValue, 0.0, 1.0, 0.001, 2.5);
      alphaFade = p.constrain(progress * 255, 0, 255);
    }

    const offX = settings.positionOffset?.x || 0;
    const offY = settings.positionOffset?.y || 0;
    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (p.height / 2) + offY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
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

    // 가림이 완료되어 글자가 사라지는 정확한 타이밍에 버퍼 레이어 색상 톤 다운 (완전 고착 효과)
    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 30] : style === 'pastel' ? [30, 95, 35, 30] : [220, 230, 245, 20]);
       this.accumulationBuffer.rect(0, 0, p.width, p.height);
    }
  }

  update(audioData) {
    if (this.p5Instance) this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    this.particles = [];
  }
}
