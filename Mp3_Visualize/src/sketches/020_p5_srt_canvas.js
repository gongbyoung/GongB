/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 10.0 (레이어 역전 적층형 자막 솟구침 엔진 완결판)
 * - 렌더링 파이프라인 구조 개혁: 자막을 버퍼보다 먼저 그려 쌓인 낙엽 아래에서 위로 용출되는 연출 시공
 * - 텍스트 변경 감지기 및 Y축 Lerp 보간기를 탑재하여 새 자막이 아래에서 위로 부드럽게 상승 전환
 * - 평시에는 매우 느린 속도로 상시 낙하 축적, 자막 종료 타임라인 윈도우에서만 자막 집중 매립 트리거 발동
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
    
    // 💡 [자막 상승 애니메이션 상태 기기 제어 매크로]
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Sub-Layer Rising Engine Ver 10.0";
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

        // 1. SRT 자막 추적 및 GAUGE 기반 종료 가림 타임라인 연산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        // 💡 [자막 변경 트리거]: 새로운 자막이 출현하면 바닥(+160px) 아래에 배치하여 상승 준비
        if (text !== this.lastTrackedText) {
          if (text !== "") {
            this.subtitleRiseY = 160; 
          }
          this.lastTrackedText = text;
        }
        // 목적지인 0px(정중앙)을 향해 부드럽게 감속 상승
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const coverThresholdTime = p.map(settings.gaugeValue, 0.0, 1.0, 0.0, 2.5);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
          }
        }

        // 2. 상시 유입 낙하 스폰 (천천히 상시 스폰 vs 가림 타임 폭발 스폰)
        let spawnRate = 1; 
        if (isCoveringTimeWindow) spawnRate = p.floor(p.map(settings.gaugeValue, 0.0, 1.0, 2, 18));

        if (p.frameCount % 3 === 0) {
          for (let k = 0; k < spawnRate; k++) {
            this.spawnParticle(p, style, settings, isCoveringTimeWindow);
          }
        }

        // 3. 물리 연산 업데이트 (안착 시 백버퍼에 박제)
        this.updateParticlesPhysics(p, settings);

        // 💡 [레이어 혁명 큐]: 1단계 - 자막을 가장 먼저 백그라운드 위에 드로우
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, currentSub, this.subtitleRiseY);

        // 💡 [레이어 혁명 큐]: 2단계 - 이미 쌓여있는 영구 낙엽 버퍼를 자막 위에 덮어 씌움
        p.image(this.accumulationBuffer, 0, 0);

        // 💡 [레이어 혁명 큐]: 3단계 - 공중에 날아다니는 실시간 라이브 파티클을 최상단에 투사
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow) {
    const baseShapeSize = p.map(settings.audioGain, 0.1, 5.0, 15, 90);
    const finalSize = p.random(baseShapeSize * 0.65, baseShapeSize * 1.35);
    
    // 💡 [천천히 이동]: 평시 유입 속도를 대폭 하향하여 아주 우아하고 정갈하게 날아오도록 조정
    const speedScale = p.map(settings.scatterExponent, 0.5, 5.0, 0.005, 0.04);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.75;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 💡 [타임라인 가림]: 오직 자막이 지워지는 타이밍에만 자막 박스로 타겟팅 락인
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
      pct: 0,
      step: isCoveringTimeWindow ? p.random(0.03, 0.09) : p.random(speedScale * 0.6, speedScale * 1.4),
      size: finalSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.04, 0.04),
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 45 : 400,
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
          pt.x = p.lerp(pt.x, pt.targetX, pt.pct);
          pt.y = p.lerp(pt.y, pt.targetY, pt.pct);
          pt.angle += pt.spin;
        }

        // 목적지에 도달 완료 시 자막 위 혹은 바닥 버퍼에 영구 박제 및 라이브 목록 소멸
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

  drawLiveParticles(p) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill();
        p.stroke(140, 190, 255, pt.alpha);
        p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.size * 0.05));
      } else {
        p.push();
        p.translate(pt.x, pt.y);
        p.rotate(pt.angle);
        p.noStroke();
        this.drawNatureShape(p, pt);
        p.pop();
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
      ctx.endShape(2);
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

  drawSubtitle(p, style, settings, isCoveringTimeWindow, currentSub, riseY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

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
      // 💡 [상승 좌표 대입]: 산출된 라인 기준 좌표에 실시간 변위인 riseY를 가산하여 솟구침 묘사
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

    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 20] : style === 'pastel' ? [30, 95, 35, 20] : [220, 230, 245, 15]);
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
