/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 13.5 (자막 면적 자동 트래킹 및 오프스크린 잎사귀 뚫기 매립 엔진)
 * - 자막의 줄수/글자수/스케일을 실시간 분석하여 Bounding Box 면적 인지 알고리즘 탑재
 * - Gauge 세팅 초단위 타임라인 매칭 시 자막 영역 내부로만 낙엽 집중 매립 통제
 * - 차기 자막 출현 시 p5.js 오프스크린 erase() 엔진을 연동하여 쌓인 잎사귀 융단을 뚫고 출현(Piercing Reveal)
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
    
    // 자막 상태 제어 큐
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Subtitle Dimension Piercing Engine Ver 13.5";
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
        
        const style = settings.colorStyle; 

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // ==========================================
        // ⚙️ ALGORITHM 1: 자막 데이터 및 공간 영역(Bounding Box) 연산
        // ==========================================
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        // 관제탑 인풋 박스 배율 크기 복원 통합 매핑
        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 50, 220);
        const tracking = fontSize * 0.72;
        const leading = fontSize * 1.45;

        // 자막 공간 상자 너비/높이 동적 연산
        let maxLineChars = 0;
        const lines = text.split(" ");
        lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
        
        const boxW = maxLineChars * tracking;
        const boxH = lines.length * leading;

        const offX = settings.positionOffset?.x || 0;
        const offY = settings.positionOffset?.y || 0;
        const centerX = (p.width / 2) + offX;
        const centerY = (p.height / 2) + offY;

        // 자막 변경 감지 및 로컬 바운더리 상승 트리거
        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 40; // 자막 위치 아래 40px 지점 배치
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        // ==========================================
        // ⚙️ ALGORITHM 2: 타임라인 동기화 기반 가림 계수 연산
        // ==========================================
        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          // Gauge 수치를 초 단위(최대 2.8초) 타임라인 가림 한계선으로 정밀 치환
          const coverThresholdTime = p.map(gaugeRaw, 0, 100, 0.0, 2.8);
          
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 3. 탑뷰 입자 생성 제어 (가림 타이밍 동기화 시 융단폭격 모드 돌입)
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(3, p.floor(gaugeRaw * 0.45))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        // 4. 물리 연산 업데이트 (목적지 도달 시 영구축적 버퍼에 복사)
        this.updateParticlesPhysics(p, settings);

        // ==========================================
        // ⚙️ ALGORITHM 3: 새 자막 출현 시 잎사귀 뚫기(Piercing Mask) 실현
        // ==========================================
        if (this.subtitleRiseY > 0.5 && text !== "" && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
          // 상승 애니메이션 진행도 산출 (뚫고 나오는 구멍 면적의 팽창 계수)
          let pierceProgress = p.map(this.subtitleRiseY, 40, 0, 0.2, 1.15);
          
          this.accumulationBuffer.push();
          // 오프스크린 그래픽스 픽셀 버퍼 알파 채널 소거 모드 진입
          this.accumulationBuffer.erase();
          this.accumulationBuffer.rectMode(p.CENTER);
          this.accumulationBuffer.noStroke();
          this.accumulationBuffer.fill(0, 255);
          // 자막이 위치한 로컬 공간 면적만큼 누적된 낙엽 더미를 물리적으로 도려냄
          this.accumulationBuffer.rect(centerX, (p.height / 2) + offY + this.subtitleRiseY, boxW * pierceProgress, boxH * pierceProgress, 18);
          this.accumulationBuffer.noErase();
          this.accumulationBuffer.pop();
        }

        // 5. 레이어 출력 큐: 1단계 자막 드로우
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY, fontSize, tracking, leading, offX, offY);

        // 6. 레이어 출력 큐: 2단계 뚫기 컷아웃이 완료된 영구 축적 버퍼 평면 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 7. 레이어 출력 큐: 3단계 공중에서 하강 낙하 중인 역동적 라이브 파티클 최상단 투사
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.2; // 원근 투과 공중 확대 배율

    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.012, 0.045);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.75;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    // 화면 평면 전체 목적지 분산화 기본값
    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 💡 [자막 위치 자동 매칭 가림 통제]: 동적으로 추출한 자막 박스 면적 사각형 영역 내부로만 목적지 제한 바인딩
    if (isCoveringTimeWindow && type !== 'rain') {
      targetX = centerX + p.random(-boxW * 0.5, boxW * 0.5);
      targetY = centerY + p.random(-boxH * 0.5, boxH * 0.5);
    }

    this.particles.push({
      x: startX,
      y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      pct: 0.0,
      step: isCoveringTimeWindow ? p.random(0.018, 0.05) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize,
      endSize: endSize,
      currentSize: startSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100),
      waveAmp: p.random(25, 55),
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
          
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          // 가을바람에 살랑거리는 하모닉 웨이브 궤적 보정
          let wave = Math.sin(pt.pct * Math.PI * 3 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + wave * 0.6;
          pt.y = rawY + wave * 0.4;
          
          pt.currentSize = p.lerp(pt.startSize, pt.endSize, pt.pct);
          pt.angle += pt.spin;
        }

        // 평면 바닥(목적지)에 도달 및 안착 즉시 축적 그래픽 버퍼에 도장 찍기
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

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY, fontSize, tracking, leading, offX, offY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // Easing 보간을 적용해 부드럽게 지워지는 알파 채널 계산
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      // 35px 아래에서 안착 위치를 향해 고개를 들며 상승 분출 연출
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

    // 완벽 가림 매립 완료 플래그 작동 시 버퍼 색상 동화 안정화
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
