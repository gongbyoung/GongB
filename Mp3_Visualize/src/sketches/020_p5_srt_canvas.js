/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 12.0 (정통 종낙하 하강 적층 및 로컬 자막 솟구침 엔진 완결판)
 * - 화면 상단에서 하단 바닥으로 나풀거리며 떨어져 무제한으로 쌓이는 리얼 가을 물리 시공
 * - 자막 전환 시 화면 밑바닥이 아닌, 자막 고유 안착점 바로 아래(35px)에서 스르륵 솟구치는 트랜지션
 * - Gauge 임계 타임라인 돌입 시 자막 영역 x축 전역으로 낙엽이 집중 투하되어 완벽 가림 실현
 * - 네이티브 원형 그라디언트 셰이딩을 통해 자연스럽게 단풍이 든 오가닉 이파리 묘사
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    // 바닥 누적 레이어를 위한 오프스크린 가상 캔버스 버퍼
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    // 자막 변경 및 상승 트리거 제어 상태 변수
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Fall Leaf Accumulation Engine Ver 12.0";
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

        // 💡 [자막 상승폭 버그 조치]: 150px을 버리고 자막 안착점 35px 아래에서 부드럽게 솟구치도록 보정
        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 35; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        // 자막 가림 타임라인 계수 연산
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

        // 2. 하강 낙엽 생성 속도 (상시 천천히 낙하 vs 자막 가림 시 폭발 스폰)
        let spawnRate = p.frameCount % 4 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(3, p.floor(gaugeRaw * 0.35))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow);
        }

        // 3. 종방향 중력 및 바람 나풀거림 물리엔진 업데이트
        this.updateParticlesPhysics(p, settings);

        // 💡 [레이어 역전 적층 시공]: 자막을 가장 먼저 그려 쌓인 낙엽 및 공중 낙엽 밑에 배치
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY);

        // 4. 이미 바닥에 떨어져 무제한 누적되고 있는 그라디언트 축적 레이어 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 5. 공중에서 가을바람을 타고 내려오는 라이브 입자들을 최상단에 렌더링
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow) {
    if (style === 'earth') return; // 비 효과는 기존 로직을 위해 바이패스

    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 15, 80);
    const finalSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    
    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.8, 3.5);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';

    // 💡 [정통 하강 스폰]: 하늘(화면 최상단 위쪽) 전체 가로폭에서 스폰 좌표계 설정
    let spawnX = p.random(p.width);
    let spawnY = -40;

    // 💡 [가림 집중 투하 알고리즘]: 자막 가림 타이밍일 경우 스폰 가로 x축 범위를 자막 영역 폭으로 제한 집중 투사
    if (isCoveringTimeWindow) {
      const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
      const fontSize = p.map(glowRaw, 10, 250, 50, 220);
      const textWidthBounds = fontSize * 3.5;
      
      spawnX = (p.width / 2) + p.random(-textWidthBounds, textWidthBounds) + (settings.positionOffset?.x || 0);
      // 가림 타이밍에는 화면 중간 살짝 위에서도 즉시 스폰시켜 즉각적인 매립 반응 유도
      if (p.random(1) > 0.4) {
        spawnY = p.random(-30, p.height / 2 - 50);
      }
    }

    this.particles.push({
      x: spawnX,
      y: spawnY,
      vx: p.random(-0.5, 0.5),
      vy: p.random(1.2, 2.8) * speedScale,
      size: finalSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.03, 0.03),
      waveSeed: p.random(1000),
      // 나풀거리는 진동 가로 폭
      waveAmp: p.random(1.5, 3.5),
      type: type,
      alpha: 255
    });
  }

  updateParticlesPhysics(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      // 💡 [종하강 중력 물리 수식]: 아래로 내려가며 삼각함수 파동에 의해 좌우로 나풀나풀 하강
      pt.y += pt.vy;
      pt.x += Math.sin(p.frameCount * 0.04 + pt.waveSeed) * pt.waveAmp;
      pt.angle += pt.spin;

      // 💡 [화면을 바닥으로 인식해 쌓이는 로직]: 화면 최하단 경계선에 도달하면 버퍼에 박제 후 소멸
      const groundLine = p.height - (pt.size * 0.35) - p.random(0, 15);
      if (pt.y >= groundLine) {
        pt.y = groundLine;
        this.drawGradientShape(this.accumulationBuffer, pt);
        this.particles.splice(i, 1);
      }
    }
  }

  drawLiveParticles(p) {
    for (let i = 0; i < this.particles.length; i++) {
      this.drawGradientShape(p, this.particles[i]);
    }
  }

  drawGradientShape(target, pt) {
    let ctx = target.drawingContext;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);

    let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pt.size * 1.1);

    if (pt.type === 'leaf') {
      // 🍁 No1 단풍잎 그라디언트 물들임 (자연물 고유 톤)
      grad.addColorStop(0, 'rgba(255, 115, 65, 0.95)');   // 내핵: 화사한 다홍빛
      grad.addColorStop(0.4, 'rgba(210, 50, 30, 0.95)');   // 중간: 깊은 단풍색
      grad.addColorStop(1, 'rgba(115, 20, 10, 0.95)');     // 외곽 테두리: 진한 갈색
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = pt.size * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(80, 10, 5, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, pt.size * 1.05); ctx.stroke();
    } 
    else if (pt.type === 'grass') {
      // 🍃 No2 풀잎 오가닉 그라디언트 물들임
      grad.addColorStop(0, 'rgba(155, 245, 100, 0.95)');  
      grad.addColorStop(0.5, 'rgba(50, 165, 70, 0.95)');   
      grad.addColorStop(1, 'rgba(15, 70, 20, 0.95)');      
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -pt.size * 1.3);
      ctx.bezierCurveTo(pt.size * 0.65, -pt.size * 0.45, pt.size * 0.65, pt.size * 0.65, 0, pt.size * 1.3);
      ctx.bezierCurveTo(-pt.size * 0.65, pt.size * 0.65, -pt.size * 0.65, -pt.size * 0.45, 0, -pt.size * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(10, 45, 12, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -pt.size * 1.1), ctx.lineTo(0, pt.size * 1.1); ctx.stroke();
    } 
    else if (pt.type === 'snow') {
      // ❄️ No3 눈꽃송이 아이스 입체 필터
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');   
      grad.addColorStop(1, 'rgba(180, 215, 255, 0.55)');   
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2.0, pt.size * 0.09);
      
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

    const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
    const fontSize = p.map(glowRaw, 10, 250, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // 가림 타이밍에 완만하게 소멸하는 알파값 산출
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const offX = settings.positionOffset?.x || 0;
    const offY = settings.positionOffset?.y || 0;
    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      // 💡 [로컬 솟구침]: riseY를 정중앙 줄간격 공식에 더해 로컬 바인딩 솟구침 안착 구현
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let finalX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        let finalY = currentLineY;

        p.fill(255, alphaFade);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });

    // 완전히 파묻혔을 때 바닥 버퍼 면적 톤 다운 시공
    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 15] : style === 'pastel' ? [30, 95, 35, 15] : [220, 230, 245, 10]);
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
