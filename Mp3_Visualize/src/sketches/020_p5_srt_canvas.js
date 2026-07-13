/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 14.0 (오가닉 셔플 단풍 및 고휘도 글로우 눈꽃 엔진 통합판)
 * - 인위적인 검은색 사각형 마스크 박스를 영구 삭제하여 오직 가사 자막만 순수하게 출력
 * - 평시 자막 영역 침범 금지 플래그 및 자막 소멸 타임라인 한정 가림 집중 투사 알고리즘 탑재
 * - Shuffle 컨트롤러 연동: 크림슨, 오렌지, 골드 앰버 등 진짜 단풍잎의 색상/디테일 다양성 확보
 * - 눈꽃송이(Monochrome): shadowBlur 가속을 통한 초강력 인광 가산 하이퍼 글로우 엔진 시공
 * - 비(Earth): 가사 흔들림을 원천 봉쇄하고 비에 번지듯 스르륵 사라지는 정성적 디졸브 감쇠식 구현
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
    
    this.version = "020호 High-Glow & Shuffled Leaf Engine Ver 14.0";
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

        // 1. SRT 자막 타임라인 추적 및 가림 임계 수치 환산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 55, 220);
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

        // 자막 변경 시 로컬 바운더리 내부에서만 정갈하게 솟구침
        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 35; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        // 타임라인 동기화 기반 가림 계수 연산
        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          const coverThresholdTime = p.map(gaugeRaw, 0, 100, 0.0, 2.8);
          
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 2. 탑뷰 입자 생성 제어 (가림 타이밍 동기화 시 융단폭격 모드 돌입)
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(3, p.floor(gaugeRaw * 0.45))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        // 3. 물리 연산 업데이트 (목적지 도달 시 영구축적 버퍼에 복사)
        this.updateParticlesPhysics(p, settings);

        // 💡 [검은색 구멍 제거 및 레이어 혁명 큐]: 1단계 자막 드로우 (가사만 순수 출력)
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY, fontSize, tracking, leading, offX, offY);

        // 4. 레이어 출력 큐: 2단계 바닥에 쌓이는 영구 축적 버퍼 평면 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 5. 레이어 출력 큐: 3단계 공중에서 하강 낙하 중인 역동적 라이브 파티클 최상단 투사
        this.drawLiveParticles(p, glowRaw);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.2; 

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

    // 💡 [평시 자막 영역 침범 원천 금지 알고리즘]
    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    if (!isCoveringTimeWindow) {
      // 일반 연주 도중에는 자막 박스(중앙 영역)를 완전히 비껴가도록 목적지 필터링 가동
      while (p.abs(targetX - centerX) < boxW * 1.2 && p.abs(targetY - centerY) < boxH * 1.2) {
        targetX = p.random(p.width);
        targetY = p.random(p.height);
      }
    } else {
      // 💡 가사가 소멸 변환되는 타이밍에만 정확히 가사 상자 내부로 목적지 집중 유출 타겟팅
      targetX = centerX + p.random(-boxW * 0.5, boxW * 0.5);
      targetY = centerY + p.random(-boxH * 0.5, boxH * 0.5);
    }

    // 💡 [Shuffle 시드 연동 오가닉 색상 다양성 추출 변수]
    const colorSeed = p.random(0, 100);
    let leafColor, leafLobeCount;
    
    if (colorSeed < 35) {
      leafColor = { r: p.floor(p.random(225, 255)), g: p.floor(p.random(65, 105)), b: p.floor(p.random(35, 55)) };  // 타오르는 다홍빛
      leafLobeCount = 5;
    } else if (colorSeed < 70) {
      leafColor = { r: p.floor(p.random(175, 205)), g: p.floor(p.random(35, 65)), b: p.floor(p.random(20, 35)) };   // 깊은 진홍색 단풍
      leafLobeCount = 7;
    } else {
      leafColor = { r: p.floor(p.random(235, 255)), g: p.floor(p.random(140, 185)), b: p.floor(p.random(45, 75)) }; // 찬란한 황금 앰버빛
      leafLobeCount = 6;
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
      leafColor: leafColor,      // 셔플 고유 컬러셋
      leafLobeCount: leafLobeCount,  // 셔플 갈래 형태다양성
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
          
          let wave = Math.sin(pt.pct * Math.PI * 3 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + wave * 0.6;
          pt.y = rawY + wave * 0.4;
          
          pt.currentSize = p.lerp(pt.startSize, pt.endSize, pt.pct);
          pt.angle += pt.spin;
        }

        if (pt.pct >= 1.0) {
          this.drawGradientShape(this.accumulationBuffer, pt, true, 0);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawLiveParticles(p, glowRaw) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill();
        p.stroke(145, 185, 255, pt.alpha);
        p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      } else {
        this.drawGradientShape(p, pt, false, glowRaw);
      }
    }
  }

  drawGradientShape(target, pt, useEndSize, glowRaw) {
    let ctx = target.drawingContext;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);

    const renderSize = useEndSize ? pt.endSize : pt.currentSize;
    let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, renderSize * 1.2);

    // 💡 [ALGORITHM 4]: 눈꽃송이 초고휘도 대구경 가산 글로우 합성 식 체결
    if (pt.type === 'snow' && glowRaw > 0) {
      ctx.shadowBlur = target.map(glowRaw, 10, 250, 15, 65); // 눈부신 하이라이트 번짐 필터
      ctx.shadowColor = 'rgba(235, 245, 255, 0.95)';        // 청아한 겨울 백색 인광 고정
    } else {
      ctx.shadowBlur = 0;
    }

    if (pt.type === 'leaf') {
      // 💡 [셔플 다양성 묘사]: 사전에 분할 연산 처리된 고유 난수 컬러맵 바인딩
      const c = pt.leafColor;
      grad.addColorStop(0, `rgba(${c.r}, ${c.g + 30}, ${c.b + 20}, 0.95)`); // 속심지 화사한 빛깔
      grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, 0.95)`);         // 몸통 본연색
      grad.addColorStop(1, `rgba(${Math.max(10, c.r - 80)}, ${Math.max(5, c.g - 30)}, ${Math.max(5, c.b - 20)}, 0.95)`); // 가장자리 마른 테두리
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        // 갈래 개수(leafLobeCount) 또한 유기적 다변화 적용
        let r = renderSize * (1.0 + 0.4 * Math.sin(pt.leafLobeCount * a) + 0.2 * Math.sin(pt.leafLobeCount * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(${Math.max(0, c.r - 110)}, 10, 5, 0.35)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, renderSize * 1.05); ctx.stroke();
    } 
    else if (pt.type === 'grass') {
      grad.addColorStop(0, 'rgba(160, 245, 110, 0.95)');   
      grad.addColorStop(0.5, 'rgba(50, 165, 70, 0.95)');   
      grad.addColorStop(1, 'rgba(12, 65, 18, 0.95)');      
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -renderSize * 1.3);
      ctx.bezierCurveTo(renderSize * 0.65, -renderSize * 0.45, renderSize * 0.65, renderSize * 0.65, 0, renderSize * 1.3);
      ctx.bezierCurveTo(-renderSize * 0.65, renderSize * 0.65, -renderSize * 0.65, -renderSize * 0.45, 0, -renderSize * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(10, 45, 12, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -renderSize * 1.1), ctx.lineTo(0, renderSize * 1.1); ctx.stroke();
    } 
    else if (pt.type === 'snow') {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');   
      grad.addColorStop(1, 'rgba(200, 225, 255, 0.75)');   
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2.0, renderSize * 0.11);
      
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -renderSize);
        ctx.moveTo(0, -renderSize * 0.4); ctx.lineTo(renderSize * 0.32, -renderSize * 0.58);
        ctx.moveTo(0, -renderSize * 0.4); ctx.lineTo(-renderSize * 0.32, -renderSize * 0.58);
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

    // 가사 교체 타임라인에 부드럽게 감쇄하는 알파 페이딩 산출
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      // 자막 고유 안착 위치 아래에서 고개를 들며 부드럽게 상승 안착
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let finalX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        let finalY = currentLineY;

        // 💡 [비 효과 교정]: 가사가 미쳐 날뛰던 파동 연산식을 완전 제거하여 가사 문자열을 차분하고 가만히 고정
        // 💡 오직 가사가 끝나 소멸하는 타이밍에만 가을비에 수묵이 번지듯 alphaFade를 통해 스르륵 고즈넉이 디졸브 연출

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
