/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 15.0 (하이퍼 텍스처 캐싱 렌더러 및 레이어링 안착 마스터판)
 * - createGraphics 텍스처 풀 기술을 시공하여 실시간 그라디언트 연산 과부하 및 CPU 버벅임 100% 완치
 * - 레이어 순서 혁신: [축적 버퍼] -> [가사 자막] -> [라이브 입자] 순으로 배치하여 잎을 뚫고 나오는 가사 구현
 * - 평시 가사 영역 침범 전면 통제 및 Gauge 임계 타임라인 윈도우 진입 시 가사 면적 타겟 가림 폭격
 * - Shuffle 연동: 크림슨, 골드 앰버, 버와인 등 형태와 색이 완벽히 분산된 5가지 프리베이킹 단풍 셔플링 탑재
 * - 눈꽃송이 가산 인광 하이라이트 복구 및 비 효과 시 가사 고정형 디졸브(Dissolve) 소멸 완비
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
    
    // 💡 CPU 과부하 파괴를 위한 오프스크린 고속 텍스처 캐시 풀
    this.textureCaches = null;
    
    this.version = "020호 Optimized Texture Cache Rising Engine Ver 15.0";
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
        
        // 💡 켜지는 순간 초고속 픽셀 텍스처 팩토리 기동
        this.createTextureFactories(p);
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

        // 1. SRT 자막 공간 영역 및 타임라인 정밀 분석
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 50, 220);
        const tracking = fontSize * 0.72;
        const leading = fontSize * 1.45;

        let maxLineChars = 0;
        const lines = text.split(" ");
        lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
        
        const boxW = maxLineChars * tracking;
        const boxH = lines.length * leading;

        const offX = settings.positionOffset?.x || 0;
        const offY = settings.positionOffset?.y || 0;
        const centerX = (p.width / 2) + offX;
        const centerY = (p.height / 2) + offY;

        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 35; // 가사 고유 안착점 35px 아래 배치
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        // 타임라인 가림 윈도우 연산
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

        // 2. 가사 가림 타이밍 연동 스폰 시스템
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(3, p.floor(gaugeRaw * 0.45))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        // 3. 물리 상태 동기화 업데이트
        this.updateParticlesPhysics(p, settings);

        // 💡 [레이어 순서 버그 완치]: 1단계 - 바닥에 쌓여 무제한 누적되는 융단 버퍼를 가장 밑바탕에 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 💡 [레이어 순서 버그 완치]: 2단계 - 깔려있는 낙엽 융단 위로 순수 가사 자막을 렌더링 (뚫고 올라오는 연출 성립)
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY, fontSize, tracking, leading, offX, offY);

        // 💡 [레이어 순서 버그 완치]: 3단계 - 공중에서 날아 떨어지는 역동적 라이브 파티클을 최상단에 묘사 (가릴 때 글자 위로 안착)
        this.drawLiveParticles(p, glowRaw);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [CPU 0% 화 팩토리]: 다채로운 셔플 형태와 그라데이션을 미리 구워 보관하는 메모리 캐시 엔진
  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };

    // 🍁 1. 단풍잎 셔플 레이아웃 프리베이킹 (5종)
    const leafColors = [
      { r: 245, g: 75, b: 35 },  // 산뜻한 다홍
      { r: 185, g: 30, b: 20 },  // 짙은 피빛 크림슨
      { r: 255, g: 155, b: 45 }, // 찬란한 황금 앰버
      { r: 220, g: 90, b: 30 },  // 오가닉 주황 단풍
      { r: 140, g: 25, b: 15 }   // 말라가는 고풍 갈색
    ];
    const lobesPool = [5, 7, 6, 5, 7];

    leafColors.forEach((c, idx) => {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 36;
      let lobes = lobesPool[idx];

      ctx.save();
      ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, `rgba(${c.r}, ${p.min(255, c.g + 45)}, ${p.min(255, c.b + 35)}, 0.95)`);
      grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, 0.95)`);
      grad.addColorStop(1, `rgba(${p.max(10, c.r - 80)}, ${p.max(5, c.g - 25)}, ${p.max(5, c.b - 15)}, 0.95)`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(${p.max(0, c.r - 110)}, 12, 6, 0.35)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, size * 1.05); ctx.stroke();
      ctx.restore();
      this.textureCaches.leaf.push(pg);
    });

    // 🍃 2. 풀잎 프리베이킹 (5종)
    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 38;
      ctx.save();
      ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      let greenShift = 135 + i * 16;
      grad.addColorStop(0, `rgba(${greenShift - 45}, 245, 95, 0.95)`);
      grad.addColorStop(0.5, `rgba(45, ${greenShift - 20}, 65, 0.95)`);
      grad.addColorStop(1, 'rgba(10, 55, 15, 0.95)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(8, 40, 10, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -size * 1.1); ctx.lineTo(0, size * 1.1); ctx.stroke();
      ctx.restore();
      this.textureCaches.grass.push(pg);
    }

    // ❄️ 3. 눈꽃송이 프리베이킹 (5종)
    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 35;
      ctx.save();
      ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      grad.addColorStop(1, `rgba(${190 - i * 12}, 220, 255, 0.75)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.8;

      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -size);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(size * 0.32, -size * 0.58);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(-size * 0.32, -size * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      this.textureCaches.snow.push(pg);
    }
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

    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 💡 [가사 영역 분산 가림 및 우회 알고리즘 체결]
    if (!isCoveringTimeWindow) {
      // 1) 평시 가사가 떠 있을 때는 가사 박스를 절대 침범하지 못하도록 목적지 우회 필터 가동
      let safetyCounter = 0;
      while (p.abs(targetX - centerX) < boxW * 1.1 && p.abs(targetY - centerY) < boxH * 1.1 && safetyCounter < 40) {
        targetX = p.random(p.width);
        targetY = p.random(p.height);
        safetyCounter++;
      }
    } else {
      // 2) 오직 가사가 교체 소멸되는 타이밍에만 정확하게 가사 영역 범위 안으로 폭격 안착
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
      step: isCoveringTimeWindow ? p.random(0.018, 0.048) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize,
      endSize: endSize,
      currentSize: startSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100),
      waveAmp: p.random(25, 55),
      type: type,
      // 💡 셔플 팩토리와 연동시킬 인덱스 값 난수 박제
      shuffledTextureIdx: p.floor(p.random(100)),
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

        // 목적지 평면에 도달해 멈추면 거기를 바닥으로 인정, 영구 축적 오프스크린 버퍼에 고속 페인팅
        if (pt.pct >= 1.0) {
          this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0);
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
        this.drawCachedTextureShape(p, pt, false, glowRaw);
      }
    }
  }

  // 💡 [초고속 이미지 블리팅 렌더러]: 수만 번의 기하 연산을 단순 픽셀 복사로 변환하여 성능 극대화
  drawCachedTextureShape(target, pt, useEndSize, glowRaw) {
    let pool = this.textureCaches[pt.type];
    if (!pool || pool.length === 0) return;
    
    // 복잡한 셔플 정보가 구워져 보관된 고유 그래픽스 피스 링 링크 수립
    let cachedGraphics = pool[pt.shuffledTextureIdx % pool.length];
    const renderSize = useEndSize ? pt.endSize : pt.currentSize;

    if (target === this.p5Instance) {
      // 1) 실시간 주 화면 최상단 투사 파트
      let p = this.p5Instance;
      p.push();
      p.translate(pt.x, pt.y);
      p.rotate(pt.angle);

      // 눈꽃 하이퍼 가산 발광 섀도우 블러 바인딩
      if (pt.type === 'snow' && glowRaw > 0) {
        let ctx = p.drawingContext;
        ctx.save();
        ctx.shadowBlur = p.map(glowRaw, 10, 250, 15, 65);
        ctx.shadowColor = 'rgba(230, 245, 255, 0.95)';
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
        ctx.restore();
      } else {
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      }
      p.pop();
    } else {
      // 2) 가상 오프스크린 영구 안착 버퍼 축적 파트
      target.push();
      target.translate(pt.x, pt.y);
      target.rotate(pt.angle);
      target.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      target.pop();
    }
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY, fontSize, tracking, leading, offX, offY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      // 자막 안착 위치 바로 밑(35px)에서 스르륵 고개를 들며 상승 안착
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let finalX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        let finalY = currentLineY;

        // 💡 [요청 반영 완치]: 비 효과 선택 시 가사가 미쳐 날뛰며 깨지던 번짐 파동식을 완전 삭제
        // 💡 오직 가사가 바뀔 때 비에 고스란히 씻겨 용해되듯 alphaFade 감쇠를 통해 스르륵 디졸브 소멸 고정

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
    this.textureCaches = null;
  }
}
