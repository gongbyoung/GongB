/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 19.0 (누락된 입자 판별 엔진 복구 및 가사 공백 방어 마스터판)
 * - spawnParticle 내부의 ReferenceError: type 변수 선언부를 완벽하게 부활시켜 흑화 현상 완치
 * - Neon 단풍잎: 중심의 찬란한 노랑, 주황에서 외곽의 마른 대지 갈색까지 섞인 입체적 오가닉 단풍 8종 탑재
 * - Pastel 풀잎: 연두, 잔디초록, 깊은 상록수 그린 계열 8종 그라데이션으로 리얼 초록잎 무드 완전 고정
 * - 가사 미로딩(음악 정지 상태) 시 Bounding Box 연산이 NaN으로 튕기며 버퍼가 깨지던 취약점 가드 조치
 * - 30FPS 하드웨어 가속 최적화 락 고정 및 가사 레이어 절대 물리 가림 구조 시공
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
    this.textureCachesList = null; 
    this.version = "020호 Hardware-Accelerated Optimized Engine Ver 19.0";
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
        
        // 초기화 및 리셋 시 가사 폰트 2종 중 무작위 자동 결정
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        console.log(`🎨 [FONT ENGINE] 캔버스 가사 서체 무작위 세팅 완료: ${this.currentFont}`);
        
        this.createTextureFactories(p);
        
        // 30FPS 하드웨어 가속 락 고정
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
        const custom = settings.customColors || { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' };

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1단계 최하단 바닥 레이어: 외부 땅바닥/호수바닥 배경 이미지 실시간 합성
        if (window.currentUploadedImageElement) {
          p.image(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        }

        // SRT 가사 동기화 타임라인 추적
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

        // 가사가 다음 구절로 바뀔 때 글자 위 고착 낙엽들을 배경 버퍼로 강제 압착 굽기(Bake)
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
          this.particles = this.particles.filter(pt => !pt.isSettledOnText);
          this.lastTrackedText = text;
        }

        // 가림 임계 윈도우 계산
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

        // 30FPS 대응 밀도 스폰 보정
        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(5, p.floor(gaugeRaw * 0.55))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // 시스템 진단 HUD 통신 가동
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: `Render[Font:${this.currentFont.replace(/ /g,'')}]`
        };

        // 2단계 레이어: 배경 위에 차곡차곡 누적되는 잎사귀 평면 안착 버퍼 투사
        p.image(this.accumulationBuffer, 0, 0);
        
        // 3단계 레이어: 100% 불투명도로 가사 자막 선명하게 노출 (배경 낙엽 더미 위에 깔끔히 얹어짐)
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY);
        
        // 4단계 레이어: 공중 파티클 및 자막 표면에 안착하여 글씨를 덮어 지워버리는 물리 가림 잎사귀 최상단 투사
        this.drawLiveParticles(p, glowRaw, custom);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [그라데이션 세분화]: 진짜 가을 산길 낙엽의 노랑/갈색 조화 및 PASTEL용 리얼 초록색류 분리 팩토리
  createTextureFactories(p) {
    this.textureCachesList = []; 
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors || { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' };

    // 🍁 1. 단풍잎(Neon 무드): 노랑, 주황, 다홍, 마른 흙갈색이 한 조각 안에 수묵화처럼 번져있는 진짜 낙엽 조합 (8종)
    const leafMixes = [
      { c0: '#ffe04d', c1: '#ff5a21', c2: '#5e1b00', size: 35 }, // 골드노랑 -> 단풍주황 -> 마른 대지 갈색
      { c0: custom.star,c1: '#d63300', c2: '#4a1200', size: 36 }, // 커스텀Star -> 붉은다홍 -> 밤색 갈색
      { c0: '#ff9933', c1: custom.gas1,c2: '#360a00', size: 34 }, // 노란 앰버 -> 커스텀1 -> 다크 브라운
      { c0: '#ffa644', c1: '#b31800', c2: custom.gas2, size: 35 }, // 주황빛 -> 피빛 크림슨 -> 커스텀2 갈색
      { c0: '#ffea70', c1: custom.gas1,c2: '#732c02', size: 32 }, 
      { c0: '#ffd214', c1: '#c62828', c2: '#4a1102', size: 37 }, 
      { c0: '#ff6f40', c1: custom.gas2,c2: '#3a2521', size: 33 }, 
      { c0: '#ffeb3b', c1: '#ff5722', c2: '#5c3e35', size: 35 }
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

    // 🍃 2. 풀잎(Pastel 무드): 붉은 간섭을 원천 차단하고 연두, 초록, 상록수 숲속 그린으로 완전 고정된 8종 디자인
    const greenMixes = [
      { c0: '#bdf567', c1: '#37bd51', c2: '#0e4a1a', size: 38 }, // 라임연두 -> 실시간 잔디초록 -> 깊은 삼림그린
      { c0: '#a3eb81', c1: '#26996c', c2: '#093f2c', size: 36 }, // 새싹연두 -> 비취초록 -> 다크 포레스트
      { c0: '#d9fa6f', c1: '#6ec73b', c2: '#1d6313', size: 37 }, 
      { c0: '#c1ef94', c1: '#4aaf4a', c2: '#12541d', size: 38 }, 
      { c0: '#9ee05c', c1: '#30903a', c2: '#0a3b0d', size: 35 }, 
      { c0: '#c2ff55', c1: '#2c7a30', c2: '#17571c', size: 34 }, 
      { c0: '#e5f3e6', c1: '#4caf4f', c2: '#16571c', size: 36 }, 
      { c0: '#c5e6c6', c1: '#2c7a30', c2: '#00473e', size: 38 }
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

    // ❄️ 3. 눈꽃송이(Monochrome 무드): 고선명 겨울 성에 결정 캐시 (8종)
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
    sb.clear(); sb.textFont(this.currentFont); sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
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

    // 💡 [원인 완치]: 누락되었던 쉐이프 무드 판별문을 완벽하게 부활시켜 ReferenceError 근절!
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

    // 💡 [NaN 가사 가드]: 자막 미로딩 시 구역 폭이 NaN으로 환산되어 튕기는 연산 오차 방어
    const safeBoxW = isNaN(boxW) || boxW <= 0 ? 100 : boxW;
    const safeBoxH = isNaN(boxH) || boxH <= 0 ? 50 : boxH;

    if (!isCoveringTimeWindow) {
      let guardLoop = 0;
      while (p.abs(targetX - centerX) < safeBoxW * 1.2 && p.abs(targetY - centerY) < safeBoxH * 1.2 && guardLoop < 25) {
        targetX = p.random(p.width); targetY = p.random(p.height);
        guardLoop++;
      }
    } else {
      targetX = centerX + p.random(-safeBoxW * 0.45, safeBoxW * 0.45);
      targetY = centerY + p.random(-safeBoxH * 0.45, safeBoxH * 0.45);
    }

    // 팩토리 슬라이싱 셔플 정보 매핑 (단풍:0~7, 풀잎:8~15, 눈꽃:16~23)
    let baseOffset = 0;
    if (style === 'pastel') baseOffset = 8;
    if (style === 'monochrome') baseOffset = 16;

    const shuffledIdx = baseOffset + p.floor(p.random(8)); 

    this.particles.push({
      x: startX, y: startY,
      startX: startX, startY: startY, targetX: targetX, targetY: targetY,
      pct: 0.0, step: isCoveringTimeWindow ? p.random(0.04, 0.095) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize, endSize: endSize, currentSize: startSize,
      angle: p.random(p.TWO_PI), spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100), waveAmp: p.random(25, 55), alpha: 255,
      isTargetingText: isCoveringTimeWindow, 
      isSettledOnText: false,
      textureIdx: shuffledIdx 
    });

    if (this.particles.length > 350) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow) {
    const style = settings.colorStyle;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (style === 'earth') {
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
    if (!this.textureCachesList || this.textureCachesList.length === 0) return;
    
    let cachedGraphics = this.textureCachesList[pt.textureIdx % this.textureCachesList.length]; 
    const style = window.cosmicEngineSettings ? window.cosmicEngineSettings.colorStyle : 'neon';
    const isSnow = style === 'monochrome';
    const renderSize = useEndSize ? pt.endSize : pt.currentSize;

    if (target === this.p5Instance) {
      let p = this.p5Instance;
      p.push(); p.translate(pt.x, pt.y); p.rotate(pt.angle);
      if (isSnow && glowRaw > 0) {
        let ctx = p.drawingContext;
        ctx.save(); ctx.shadowBlur = p.map(glowRaw, 10, 250, 15, 60); ctx.shadowColor = custom?.gas2 || '#ffffff';
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
    if (!text) return; // 자막 데이터 부재 시 예외 프리그 탈출 가드

    let textColorStyle = '#ffffff';
    if (style === 'monochrome' || style === 'earth' || style === 'custom') {
      textColorStyle = custom?.star || '#ffffff'; 
    }

    const safeFontSize = isNaN(fontSize) || fontSize <= 0 ? 60 : fontSize;
    const safeTracking = isNaN(tracking) || tracking <= 0 ? 40 : tracking;
    const safeLeading = isNaN(leading) || leading <= 0 ? 80 : leading;

    if (text !== this.lastRenderedText || safeFontSize !== this.lastRenderedFontSize || textColorStyle !== this.lastRenderedColor) {
      this.renderSubtitleCache(p, text, safeFontSize, safeTracking, safeLeading, textColorStyle);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = safeFontSize;
      this.lastRenderedColor = textColorStyle;
    }

    if (!this.subtitleBuffer) return;

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
    if (this.textureCachesList) {
      this.textureCachesList.forEach(g => g?.remove());
      this.textureCachesList = null;
    }
    this.particles = [];
  }
}
