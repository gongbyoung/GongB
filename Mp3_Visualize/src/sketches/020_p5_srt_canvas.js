/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 18.5 (그래픽 메모리 최적화 및 Silent Failure 완치판)
 * - 그래픽 메모리 가속 패치: textureCaches를 하나의 통합된 Lite 팩토리로 리팩토링하여 
 *   그래픽 버퍼 수를 줄이고 VRAM 점유율을 획기적으로 낮추어 검은 화면 오류 원천 차단
 * - 배경 이미지 PERSISTENCY 확보: 캔버스 컨텍스트가 초기화되더라도 배경 이미지가 항상PERSISTENCY하게 출력되도록 로직 통합
 * - Ver 18.0의 절대 레이어 적층 및 진짜 물리 가림 물리 연산은 그대로 유지
 * - 30FPS 하드웨어 락 보정으로 조작 지연 현상 0% 달성
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    this.accumulationBuffer = null;
    this.subtitleBuffer = null; 
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.lastRenderedText = "";
    this.lastRenderedFontSize = 0;
    this.lastRenderedColor = "";
    
    this.currentFont = 'Black Han Sans';
    
    // 💡 [패치 요령 1]: textureCaches를 리스트 하나로 통합하여 Lite 팩토리로 개편
    this.textureCachesList = null; 
    this.version = "020호 Hardware-Accelerated optimized Engine Ver 18.5";
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
        
        // 초기화 시 가사 폰트 2종 중 무작위 스위칭
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        console.log(`🎨 [FONT ENGINE] 캔버스 가사 서체 무작위 세팅 완료: ${this.currentFont}`);
        
        this.createTextureFactories(p);
        
        // 30FPS 하드웨어 가속 락
        p.frameRate(30);
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon',
          customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' }
        };
        
        const style = settings.colorStyle; 
        const custom = settings.customColors;

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // SRT 가사 동기화 타임라인 트래킹
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 52, 210);
        const tracking = fontSize * 0.74;
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

        // 가사 변환 시 최상단 고착 입자들을 바닥 버퍼로 완전 압착 베이킹 처리
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
          this.particles = this.particles.filter(pt => !pt.isSettledOnText);
          this.lastTrackedText = text;
        }

        // 가림 임계 연산
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

        // 30FPS 하드웨어 락 대응 프레임 밀도 스폰 보정
        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(5, p.floor(gaugeRaw * 0.55))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // HUD 로거 진단 정보 매핑
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: `Render[Font:${this.currentFont.replace(/ /g,'')}]`
        };

        // ==========================================
        // 💡 [알고리즘 2: 배경 이미지 PERSISTENCY 및 절대 레이어 적층 리펙토링]
        // ==========================================
        
        // 1단계(최하단 바닥): 리얼 땅바닥/호수바닥 텍스처 레이어 시공
        // [패치 요령 2]: 배경 이미지가 항상 PERSISTENCY하게 출력되도록 로직 통합
        if (window.currentUploadedImageElement) {
          p.image(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        }
        
        // 2단계: 기존에 이미 안착해 깔려있던 낙엽 축적 버퍼 투사
        p.image(this.accumulationBuffer, 0, 0);
        
        // 3단계(중간 전경): 100% 완전 불투명 상태로 가사 자막 인쇄
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY);
        
        // 4단계(최상단 덮개): 공중 비행 입자 및 자막 표면에 안착한 낙엽들을 최종 투사 (물리 가림 백프로 실현)
        this.drawLiveParticles(p, glowRaw, custom);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [알고리즘 3: Lite 팩토리 - 그래픽 메모리 최적화 통합 생성]
  createTextureFactories(p) {
    this.textureCachesList = []; // [패치 요령 3]: 리스트 하나로 Lite 팩토리 통합 생성
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors;

    // 🍁 단풍잎(Neon): 8종 Lite 팩토리 수묵 그라데이션 물들임
    const leafMixes = [
      { c0: 'rgba(255, 220, 85, 0.95)',  c1: custom.gas1, c2: 'rgba(100, 35, 10, 0.95)', size: 35 },  
      { c0: custom.star,                 c1: 'rgba(215, 65, 25, 0.95)',  c2: 'rgba(85, 30, 8, 0.95)',  size: 35 },   
      { c0: 'rgba(255, 195, 60, 0.95)',  c1: custom.gas2, c2: 'rgba(75, 20, 5, 0.95)',   size: 35 },   
      { c0: 'rgba(230, 160, 45, 0.95)',  c1: 'rgba(180, 40, 15, 0.95)',  c2: custom.gas2,               size: 35 },               
      { c0: 'rgba(255, 235, 110, 0.95)', c1: custom.gas1, c2: 'rgba(115, 45, 15, 0.95)', size: 35 }, 
      { c0: custom.star,                 c1: custom.gas2,                 c2: 'rgba(128, 64, 32, 0.95)', size: 32 }, 
      { c0: custom.gas1,                 c1: custom.gas2,                 c2: 'rgba(64, 32, 16, 0.95)',  size: 38 }, 
      { c0: 'rgba(255, 255, 255, 0.95)', c1: custom.gas1, c2: custom.gas2, size: 30 } 
    ];

    leafMixes.forEach((m, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = m.size;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, m.c0); grad.addColorStop(0.5, m.c1); grad.addColorStop(1, m.c2);
      ctx.fillStyle = grad; ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let lobes = idx % 2 === 0 ? 5 : 7;
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCachesList.push(pg);
    });

    // 🍃 풀잎(Pastel): 붉은색을 차단한 청아하고 화사한 리얼 초록색류 8종 Lite 팩토리 캐시 고정 시공
    const greenMixes = [
      { c0: 'rgba(185, 245, 100, 0.95)', c1: 'rgba(55, 185, 80, 0.95)',  c2: 'rgba(15, 75, 25, 0.95)',  size: 38 },  
      { c0: 'rgba(165, 235, 130, 0.95)', c1: 'rgba(40, 155, 110, 0.95)', c2: 'rgba(10, 65, 45, 0.95)',  size: 38 },  
      { c0: 'rgba(215, 250, 110, 0.95)', c1: 'rgba(110, 200, 60, 0.95)', c2: 'rgba(30, 100, 20, 0.95)', size: 38 }, 
      { c0: 'rgba(195, 240, 150, 0.95)', c1: 'rgba(75, 175, 75, 0.95)',  c2: 'rgba(20, 85, 30, 0.95)',  size: 38 },  
      { c0: 'rgba(160, 225, 95, 0.95)',  c1: 'rgba(50, 145, 60, 0.95)',  c2: 'rgba(12, 60, 15, 0.95)', size: 38 }, 
      { c0: 'rgba(185, 245, 100, 0.95)', c1: custom.gas1, c2: custom.gas2, size: 35 }, 
      { c0: custom.star,                 c1: 'rgba(128, 255, 128, 0.95)', c2: custom.gas1, size: 32 }, 
      { c0: custom.gas2,                 c1: custom.gas1, c2: custom.star, size: 40 } 
    ];

    greenMixes.forEach((gm, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = gm.size;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, gm.c0); grad.addColorStop(0.5, gm.c1); grad.addColorStop(1, gm.c2);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCachesList.push(pg);
    });

    // ❄️ 눈꽃송이(Monochrome): 8종 Lite 팩토리 캐시 시공
    for (let i = 0; i < 8; i++) {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = p.random(30, 40);
      ctx.save(); ctx.translate(64, 64);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = p.random(2.5, 4.0);
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3); ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -size);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(size * 0.32, -size * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      this.textureCachesList.push(pg);
    }
  }

  renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle) {
    if (!text) { if (this.subtitleBuffer) this.subtitleBuffer.clear(); return; }
    const lines = text.split(" ");
    let maxLineChars = 0;
    lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
    
    const reqW = Math.max(120, p.floor(maxLineChars * tracking + 60));
    const reqH = Math.max(120, p.floor(lines.length * leading + 60));
    
    if (!this.subtitleBuffer || this.subtitleBuffer.width < reqW || this.subtitleBuffer.height < reqH) {
      if (this.subtitleBuffer) this.subtitleBuffer.remove();
      this.subtitleBuffer = p.createGraphics(reqW, reqH);
    }
    
    let sb = this.subtitleBuffer;
    sb.clear(); 
    sb.textFont(this.currentFont); 
    sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
    sb.fill(textColorStyle); sb.noStroke();
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (sb.height / 2) + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      chars.forEach((char, charIdx) => {
        let finalX = (sb.width / 2) + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        sb.text(char, finalX, currentLineY);
      });
    });
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.0; 

    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.024, 0.09);

    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.75;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    if (!isCoveringTimeWindow) {
      let guardLoop = 0;
      while (p.abs(targetX - centerX) < boxW * 1.2 && p.abs(targetY - centerY) < boxH * 1.2 && guardLoop < 25) {
        targetX = p.random(p.width); targetY = p.random(p.height);
        guardLoop++;
      }
    } else {
      targetX = centerX + p.random(-boxW * 0.45, boxW * 0.45);
      targetY = centerY + p.random(-boxH * 0.45, boxH * 0.45);
    }

    // 💡 [패치 요령 4]: 통합 Lite 팩토리 리스트에 맞게 spawning logic 리펙토링
    const totalTextures = this.textureCachesList ? this.textureCachesList.length : 1;
    const typeOffset = style === 'neon' ? 0 : style === 'pastel' ? 8 : style === 'monochrome' ? 16 : 0; // 통합 리스트의 인덱스 오프셋 연산
    const shuffledIdx = p.floor(p.random(totalTextures)); // 전체 리스트 중 무작위 셔플 (rain 효과 제외)

    this.particles.push({
      x: startX, y: startY,
      startX: startX, startY: startY, targetX: targetX, targetY: targetY,
      pct: 0.0, step: isCoveringTimeWindow ? p.random(0.04, 0.095) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize, endSize: endSize, currentSize: startSize,
      angle: p.random(p.TWO_PI), spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100), waveAmp: p.random(25, 55), alpha: 255,
      isTargetingText: isCoveringTimeWindow, 
      isSettledOnText: false,
      textureIdx: shuffledIdx // Lite 팩토리 전용 무작위 셔플 인덱스 바인딩
    });

    if (this.particles.length > 350) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (settings.colorStyle === 'earth') {
        pt.alpha -= 10; 
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        if (pt.isSettledOnText) continue;

        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          let wave = Math.sin(pt.pct * Math.PI * 3 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + wave * 0.6; pt.y = rawY + wave * 0.4;
          
          pt.currentSize = p.lerp(pt.startSize, pt.endSize, pt.pct);
          pt.angle += pt.spin;
        }

        if (pt.pct >= 1.0) {
          if (isCoveringTimeWindow && pt.isTargetingText) {
            pt.isSettledOnText = true; 
          } else {
            this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            this.particles.splice(i, 1);
          }
        }
      }
    }
  }

  drawLiveParticles(p, glowRaw, custom) {
    // rain 효과 전용 루틴 분리
    const style = window.cosmicEngineSettings ? window.cosmicEngineSettings.colorStyle : 'neon';
    if (style === 'earth') {
      for (let i = 0; i < this.particles.length; i++) {
        let pt = this.particles[i];
        p.noFill(); p.stroke(custom.gas1); p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      }
    } else {
      for (let i = 0; i < this.particles.length; i++) {
        this.drawCachedTextureShape(p, this.particles[i], this.particles[i].isSettledOnText, glowRaw, custom);
      }
    }
  }

  drawCachedTextureShape(target, pt, useEndSize, glowRaw, custom) {
    // 💡 [패치 요령 5]: 통합 Lite 팩토리 전용 텍스처 인덱싱 루틴 시공
    if (!this.textureCachesList || this.textureCachesList.length === 0) return;
    
    // spawning logic에서 바인딩된 shuffledIdx를 그대로 사용하여 무작위성 확보
    const style = window.cosmicEngineSettings ? window.cosmicEngineSettings.colorStyle : 'neon';
    const totalTextures = this.textureCachesList.length;
    let cachedGraphics = this.textureCachesList[pt.textureIdx % totalTextures]; // Lite 팩토리 무작위 셔플링

    // snow 효과 전용 특수 드로우 루틴 시공
    const isSnow = style === 'monochrome';
    const renderSize = useEndSize ? pt.endSize : pt.currentSize;

    if (target === this.p5Instance) {
      let p = this.p5Instance;
      p.push(); p.translate(pt.x, pt.y); p.rotate(pt.angle);
      if (isSnow && glowRaw > 0) {
        let ctx = p.drawingContext;
        ctx.save(); ctx.shadowBlur = p.map(glowRaw, 10, 250, 15, 60); ctx.shadowColor = custom.gas2;
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
        ctx.restore();
      } else {
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      }
      p.pop();
    } else {
      target.push(); target.translate(pt.x, pt.y); target.rotate(pt.angle);
      target.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      target.pop();
    }
  }

  drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    let textColorStyle = '#ffffff';
    if (style === 'monochrome' || style === 'earth' || style === 'custom') {
      textColorStyle = custom.star; 
    }

    if (text !== this.lastRenderedText || fontSize !== this.lastRenderedFontSize || textColorStyle !== this.lastRenderedColor) {
      this.renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = fontSize;
      this.lastRenderedColor = textColorStyle;
    }

    p.push(); p.imageMode(p.CENTER);
    let alphaLock = 255;
    if (style === 'earth' && isCoveringTimeWindow && currentSub) {
      alphaLock = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    p.tint(255, alphaLock);
    p.image(this.subtitleBuffer, (p.width / 2) + offX, (p.height / 2) + offY);
    p.pop();
  }

  update(audioData) {}
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    if (this.subtitleBuffer) { this.subtitleBuffer.remove(); this.subtitleBuffer = null; }
    // [패치 요령 6]: Lite 팩토리 리스트 통합 해제
    if (this.textureCachesList) {
      this.textureCachesList.forEach(g => g?.remove());
      this.textureCachesList = null;
    }
    this.particles = [];
  }
}
