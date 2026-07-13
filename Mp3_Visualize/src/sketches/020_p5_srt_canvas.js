/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 13.0 (리얼 탑뷰 원근 감쇄 및 분산 안착 엔진 완결판)
 * - 매 프레임 randomSeed를 리셋하여 지네처럼 뭉치던 치명적인 트레일 버그 완치
 * - 화면 바깥에서 크게 생성 -> 화면 안쪽 목푯값으로 살랑살랑 회전하며 축소(원근 투과)
 * - 입자가 목적지에 도달해 멈추는 픽셀 좌표를 곧바로 '바닥'으로 인식해 무제한 레이어 축적
 * - 자막 가림 타이밍에는 목적지가 자막 텍스트 레이아웃 전역으로 분산 타겟팅되어 매립
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    // 탑뷰 바닥 평면 누적을 위한 오프스크린 가상 캔버스 버퍼
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Top-View Perspective Shrink Engine Ver 13.0";
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
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon' 
        };
        
        // 💡 [버그 완치]: 지네 모양 사슬을 만들던 프레임별 randomSeed() 강제 초기화 코드를 폐기하여 정상 난수 복구
        const style = settings.colorStyle; 

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1. SRT 자막 타임라인 추적 및 가림 임계 수치 환산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        // 자막 변경 시 자막 박스 로컬 기준 35px 아래에서 솟구침
        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 35; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const coverThresholdTime = p.map(settings.gaugeValue, 0, 100, 0.0, 2.5);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 2. 탑뷰 스폰 레이트 (상시 유입 vs 자막 가림 시 분산 폭발 스폰)
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(3, p.floor(gaugeRaw * 0.35))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor);
        }

        // 3. 탑뷰 감쇄 보간 물리엔진 업데이트
        this.updateParticlesPhysics(p, settings);

        // 💡 [레이어 축적 시공]: 자막을 가장 먼저 그려 이미 깔린 낙엽 및 날아오는 낙엽 밑에 배치
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY);

        // 4. 낙엽이 안착하여 멈추는 순간 도장이 찍히는 평면 축적 버퍼 레이어 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 5. 현재 하늘에서 바닥(목적지)을 향해 작아지며 날아오는 라이브 입자들을 최상단에 렌더링
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); // 바닥에 안착했을 때의 최종 크기
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    
    // 💡 [원근 스케일 박제]: 하늘 높이 있을 때는 카메라와 가까우므로 3배 더 크게 시작
    const startSize = endSize * 3.2;

    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.01, 0.04);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    // 💡 [사방 외곽 스폰]: 화면 중앙 기준 반지름 바깥 경계선 외곽에서 스폰
    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.75;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    // 화면 평면 전체가 곧 바닥이므로, 무작위 타겟 좌표 설정
    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 자막 가림 타이밍에는 목적지를 자막 박스 면적 전역으로 골고루 분산 타겟팅
    if (isCoveringTimeWindow && type !== 'rain') {
      const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
      const fontSize = p.map(glowRaw, 10, 250, 50, 220);
      const textWidthArea = fontSize * 4.5 * coverFactor;
      const textHeightArea = fontSize * 2.2 * coverFactor;
      
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
      pct: 0.0, // 보간 진행률 (0.0 -> 1.0)
      step: isCoveringTimeWindow ? p.random(0.015, 0.045) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize,
      endSize: endSize,
      currentSize: startSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100),
      waveAmp: p.random(20, 50),
      type: type,
      alpha: 255
    });
  }

  updateParticlesPhysics(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (pt.type === 'rain') {
        pt.alpha -= 5;
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          // 사방 바깥에서 안쪽 목적지로 좁혀지는 평면 궤적 보간
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          // 💡 [살랑살랑 부유 진동]: 날아오는 궤적의 수직축으로 가을바람 조화 진동 대입
          let wave = Math.sin(pt.pct * Math.PI * 3 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + wave * 0.6;
          pt.y = rawY + wave * 0.4;
          
          // 💡 [크기 조절 핵심]: 하늘(대)에서 바닥(소)으로 내려앉으며 원근감 있게 축소
          pt.currentSize = p.lerp(pt.startSize, pt.endSize, pt.pct);
          pt.angle += pt.spin;
        }

        // 💡 목적지에 100% 도달해 멈추면 거기를 곧바로 바닥으로 인정, 영구 축적 버퍼에 복사 후 라이브 배열 탈출
        if (pt.pct >= 1.0) {
          this.drawGradientShape(this.accumulationBuffer, pt, true);
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
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      } else {
        this.drawGradientShape(p, pt, false);
      }
    }
  }

  drawGradientShape(target, pt, useEndSize) {
    let ctx = target.drawingContext;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);

    // 안착 플래그에 따라 최종 고정 크기 혹은 실시간 유동 축소 크기를 바인딩
    const renderSize = useEndSize ? pt.endSize : pt.currentSize;
    let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, renderSize * 1.2);

    if (pt.type === 'leaf') {
      grad.addColorStop(0, 'rgba(255, 110, 60, 0.95)');   
      grad.addColorStop(0.4, 'rgba(215, 55, 35, 0.95)');   
      grad.addColorStop(1, 'rgba(125, 25, 15, 0.95)');     
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = renderSize * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(95, 15, 5, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, renderSize * 1.05); ctx.stroke();
    } 
    else if (pt.type === 'grass') {
      grad.addColorStop(0, 'rgba(150, 240, 95, 0.95)');   
      grad.addColorStop(0.5, 'rgba(50, 165, 70, 0.95)');   
      grad.addColorStop(1, 'rgba(15, 75, 25, 0.95)');      
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -renderSize * 1.3);
      ctx.bezierCurveTo(renderSize * 0.65, -renderSize * 0.45, renderSize * 0.65, renderSize * 0.65, 0, renderSize * 1.3);
      ctx.bezierCurveTo(-renderSize * 0.65, renderSize * 0.65, -renderSize * 0.65, -renderSize * 0.45, 0, -renderSize * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(10, 50, 15, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -renderSize * 1.1), ctx.lineTo(0, renderSize * 1.1); ctx.stroke();
    } 
    else if (pt.type === 'snow') {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');   
      grad.addColorStop(1, 'rgba(175, 210, 255, 0.55)');   
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2.0, renderSize * 0.09);
      
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -renderSize);
        ctx.moveTo(0, -renderSize * 0.4); ctx.lineTo(renderSize * 0.35, -renderSize * 0.6);
        ctx.moveTo(0, -renderSize * 0.4); ctx.lineTo(-renderSize * 0.35, -renderSize * 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
    const fontSize = p.map(glowRaw, 10, 250, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const offX = settings.positionOffset?.x || 0;
    const offY = settings.positionOffset?.y || 0;
    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      // 자막 고유 안착 위치 바로 아래(35px)에서 부드럽게 고개를 들며 상승 안착
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let finalX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        let finalY = currentLineY;

        if (style === 'earth') {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          let wave = p.sin(p.frameCount * 0.12 + charIdx * 0.7) * (gaugeRaw * 0.45);
          finalX += wave * 0.8;
          finalY += p.cos(p.frameCount * 0.09 + charIdx) * wave * 0.5;
        }

        p.fill(255, alphaFade);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });

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
