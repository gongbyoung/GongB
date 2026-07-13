/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 9.0 (시즌별 가산 축적 버퍼 및 GAUGE 타이밍 마스크 엔진)
 * - GAUGE 수치를 자막 종료 전 가림 시간(초)으로 파싱하여 정확한 타임라인 통제 구현
 * - createGraphics 백포 버퍼를 활용해 낙엽과 풀잎이 사양 저하 없이 무제한으로 쌓이는 시스템 시공
 * - Scale 슬라이더 기반 최소 글꼴 배율 2배 격상 및 자간/줄간 고정 비례 팽창 패치
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    // 무제한 축적 레이어를 위한 오프스크린 가상 캔버스 버퍼
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.version = "020호 Layered Accumulation Engine Ver 9.0";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // 영구 축적용 그래픽스 버퍼 레이어 생성
        this.accumulationBuffer = p.createGraphics(p.width, p.height);
        this.accumulationBuffer.clear();
        
        this.lastWidth = p.width;
        this.lastHeight = p.height;
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        // main.js의 /10, /100 정규화 스케일 파이프라인 수신
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon' 
        };
        
        p.randomSeed(settings.seed);
        const style = settings.colorStyle; 

        // 화면 크기가 변했을 때 축적 버퍼도 안전하게 리사이즈
        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1. SRT 타임라인 및 GAUGE 기반 가림 윈도우 계산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        // 현재 재생 중인 자막 객체 정밀 역추적
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          // Gauge(0.0~1.0)를 최대 2.5초 전부터 덮기 시작하는 매커니즘 시간선으로 매핑
          const coverThresholdTime = p.map(settings.gaugeValue, 0.0, 1.0, 0.0, 2.5);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
          }
        }

        // 2. 자연계 입자 생성 프로세스 (일반 낙하 vs 자막 집중 매립)
        let spawnRate = p.floor(p.map(settings.gaugeValue, 0.0, 1.0, 1, 6));
        if (isCoveringTimeWindow) spawnRate *= 3; // 가림 시간 타이밍에는 3배 폭발 스폰

        if (p.frameCount % 2 === 0) {
          for (let k = 0; k < spawnRate; k++) {
            this.spawnParticle(p, style, settings, isCoveringTimeWindow);
          }
        }

        // 3. 실시간 물리 입자 갱신 및 수명이 다한 조각들 축적 버퍼에 영구 박제
        this.updateAndBufferParticles(p, settings);

        // 4. 먼저 쌓인 낙엽/풀잎 축적 버퍼 레이어를 메인 화면에 묘사
        p.image(this.accumulationBuffer, 0, 0);

        // 5. 완벽한 자간/줄간 비율이 공급되는 자막 레이어 최종 출력
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, currentSub);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow) {
    // Volume 슬라이더 수치에 직결된 입자 고유 셰이프 기본 크기 배율 결정
    const particleScale = p.map(settings.audioGain, 0.1, 5.0, 20, 110);
    const speedScale = p.map(settings.scatterExponent, 0.5, 5.0, 1.0, 8.0);

    let type = 'leaf'; // neon
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    let spawnX = p.random(p.width);
    let spawnY = -40;

    // 💡 [매커니즘 핵심]: 자막 가림 타임라인 윈도우 발동 시, 스폰 좌표를 자막 정중앙 픽셀 박스로 강제 고정 펌핑
    if (isCoveringTimeWindow && type !== 'rain') {
      const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
      spawnX = (p.width / 2) + p.random(-fontSize * 2.5, fontSize * 2.5) + (settings.positionOffset?.x || 0);
      spawnY = (p.height / 2) + p.random(-fontSize * 1.5, fontSize * 1.5) + (settings.positionOffset?.y || 0);
    }

    this.particles.push({
      x: spawnX,
      y: type === 'rain' ? p.random(p.height) : spawnY,
      vx: isCoveringTimeWindow ? p.random(-0.5, 0.5) : p.random(-2, 2),
      vy: type === 'rain' ? 0 : (isCoveringTimeWindow ? p.random(0.5, 2.0) : p.random(2, 5) * (speedScale * 0.5)),
      size: p.random(particleScale * 0.75, particleScale * 1.25),
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.05, 0.05),
      type: type,
      isSettled: false,
      alpha: 255
    });
  }

  updateAndDrawParticles(p, settings) {
    // 이 메서드는 아래 updateAndBufferParticles 시스템 내로 정밀 통합 분희되어 연산됩니다.
  }

  updateAndBufferParticles(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (pt.type === 'rain') {
        // [4번 효과]: 빗방울 탑뷰 리플 물리
        pt.alpha -= 6;
        p.noFill();
        p.stroke(160, 200, 255, pt.alpha);
        p.strokeWeight(2);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.size * 0.04));
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        // [1,2,3번 효과]: 낙하 및 바닥 바인딩 물리
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.angle += pt.spin;

        // 바닥 또는 자막 가림 타겟 안착 조건 연산
        if (pt.y >= p.height - pt.size * 0.4) {
          pt.y = p.height - pt.size * 0.4;
          pt.isSettled = true;
        }

        // 실시간 화면에 살아있는 공중 파티클 묘사
        p.push();
        p.translate(pt.x, pt.y);
        p.rotate(pt.angle);
        p.noStroke();
        this.drawNatureShape(p, pt);
        p.pop();

        // 💡 [무제한 축적 매커니즘]: 바닥에 닿았거나 낙엽/풀잎 고유 플래그 충족 시 오프스크린 그래픽 버퍼에 영구 페인팅 후 가볍게 소멸
        if (pt.isSettled) {
          this.accumulationBuffer.push();
          this.accumulationBuffer.translate(pt.x, pt.y);
          this.accumulationBuffer.rotate(pt.angle);
          this.accumulationBuffer.noStroke();
          this.drawNatureShape(this.accumulationBuffer, pt);
          this.accumulationBuffer.pop();

          // Live 배열에서 제거하여 리소스 반환 (메모리 누수 완전 동결)
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawNatureShape(ctx, pt) {
    // p5 메인 캔버스와 오프스크린 버퍼 양쪽 모두 정밀 드로잉이 연동되도록 상호 컨텍스트 추적 처리
    if (pt.type === 'leaf') {
      ctx.fill(200, 60, 40, 240);
      ctx.beginShape();
      for (let a = 0; a < 6.28; a += 0.06) {
        let r = pt.size * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        ctx.vertex(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.endShape(2); // CLOSE
      ctx.stroke(130, 25, 15); ctx.strokeWeight(2); ctx.line(0, 0, 0, pt.size * 1.1);
    } 
    else if (pt.type === 'grass') {
      ctx.fill(50, 160, 70, 240);
      ctx.beginShape();
      ctx.vertex(0, -pt.size * 1.3);
      ctx.bezierVertex(pt.size * 0.65, -pt.size * 0.45, pt.size * 0.65, pt.size * 0.65, 0, pt.size * 1.3);
      ctx.bezierVertex(-pt.size * 0.65, pt.size * 0.65, -pt.size * 0.65, -pt.size * 0.45, 0, -pt.size * 1.3);
      ctx.endShape(2);
      ctx.stroke(30, 100, 40); ctx.strokeWeight(2.5); ctx.line(0, -pt.size * 1.2, 0, pt.size * 1.2);
    } 
    else if (pt.type === 'snow') {
      ctx.stroke(245, 250, 255, 235);
      ctx.strokeWeight(Math.max(2.5, pt.size * 0.1));
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

    // 💡 [글자 크기 하한선 2배 상향]: 최소 크기 50px에서 최대 220px까지 광활한 팽창 밸런스 매핑
    const fontSize = p.map(settings.glowIntensity, 0.1, 2.5, 50, 220);
    const tracking = fontSize * 0.72; // 글꼴에 고정 비례 연동되는 완벽한 자간 배율
    const leading = fontSize * 1.45;  // 글꼴과 동일 비율로 동반 조율되는 절대 줄간격 배율 공정

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // 💡 [타임라인 알파 덮기 연산식]: 가림 시간 윈도우에 돌입하면 자막 투명도가 0으로 서서히 용해 소멸
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

        // [4번 효과 - 빗방울 탑뷰 리플 파동 분산 왜곡]
        if (style === 'earth') {
          let wave = p.sin(p.frameCount * 0.12 + charIdx * 0.7) * p.map(settings.gaugeValue, 0.0, 1.0, 0, 50);
          finalX += wave * 0.8;
          finalY += p.cos(p.frameCount * 0.09 + charIdx) * wave * 0.5;
        }

        p.fill(255, alphaFade);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });

    // 💡 자막 가림 타이밍이 완벽히 끝나 자막 투명도가 0이 되면 축적 버퍼에 자막 형상의 잔상을 낙엽과 동화시켜 도장 찍기
    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel')) {
       // 자막이 가려짐과 동시에 낙엽/풀잎 무더기로 완전히 고착화되었음을 버퍼에 각인
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 45] : [30, 95, 35, 45]);
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
