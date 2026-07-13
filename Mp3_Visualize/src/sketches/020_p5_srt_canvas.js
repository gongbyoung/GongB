/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 7.5 (자연계 리얼 셰이프 모델링 및 가산 레이어 감쇠 완결판)
 * - Shuffle(배치 랜덤 시드), Range(입자 낙하 속도 분산), Scale(자간/줄간 동격 지배), Volume(잎/눈꽃송이 고유 형태 크기), Gauge(가림 밀도 임계점 조절)
 * - 1:단풍잎(Maple), 2:풀잎(Grass), 3:눈꽃송이(6축 결정), 4:빗방울 탑뷰 리플(자막 레이어 파동 용해 용출 알고리즘) 완전 시공
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    this.version = "020호 Real Custom Geometry Lyric Ver 7.5";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 22, glowIntensity: 85, audioGain: 100, gaugeValue: 50, colorStyle: 'neon' 
        };
        
        p.randomSeed(settings.seed);

        const style = settings.colorStyle; // neon=단풍잎, pastel=풀잎, monochrome=눈꽃송이, earth=빗방울탑뷰
        const density = Math.floor(p.map(settings.gaugeValue, 0, 100, 2, 45));

        // 1. 파티클 수명 주기 스폰
        if (p.frameCount % Math.max(1, (50 - density)) === 0) {
          this.spawnParticle(p, style, settings);
        }

        // 2. 물리 렌더링 및 개별 자막 마스크 레이어 산출
        let maskForce = this.updateAndDrawParticles(p, style, settings);

        // 3. 자간 및 줄간격이 완벽히 비례 동기화된 가림 자막 마스터 출력
        this.drawSubtitle(p, style, settings, maskForce);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings) {
    // Volume(audioGain)에 정비례하는 자연 셰이프 고유 크기 스케일 바인딩
    const baseSize = p.map(settings.audioGain, 10, 500, 8, 85);
    const scatterSpeed = p.map(settings.scatterExponent, 5, 50, 1, 8);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    this.particles.push({
      x: p.random(p.width),
      y: type === 'rain' ? p.random(p.height) : -30,
      vx: p.random(-1.5, 1.5),
      vy: type === 'rain' ? 0 : p.random(1.5, 4.5) * (scatterSpeed * 0.5),
      size: p.random(baseSize * 0.6, baseSize * 1.4),
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.03, 0.03),
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 45 : 600
    });
  }

  updateAndDrawParticles(p, style, settings) {
    let textZoneCoverage = 0;
    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const textBoundary = p.map(settings.glowIntensity, 10, 250, 40, 400);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.age++;

      if (pt.type === 'rain') {
        // 💡 4번 효과 [탑뷰 비 무대]: 빗방울 낙하 파동 리플 링 전개
        p.noFill();
        let progress = pt.age / pt.maxAge;
        p.stroke(140, 180, 255, 255 * (1.0 - progress));
        p.strokeWeight(2);
        p.ellipse(pt.x, pt.y, pt.age * (pt.size * 0.15));
        
        // 리플 중심부 타격점 가림 산출
        let d = p.dist(pt.x, pt.y, centerX, centerY);
        if (d < textBoundary) {
          textZoneCoverage += (1.0 - progress) * (settings.gaugeValue / 50.0);
        }
      } else {
        // 💡 1,2,3번 효과 [하강 기류 무대]: 자막 덮기용 정밀 자연 기하학 드로잉
        pt.x += pt.vx; 
        pt.y += pt.vy;
        pt.angle += pt.spin;

        p.push();
        p.translate(pt.x, pt.y);
        p.rotate(pt.angle);
        p.noStroke();

        if (pt.type === 'leaf') {
          // 🍁 No1: 단풍잎 리얼 수식 모델링
          p.fill(195, 55, 35, 230);
          p.beginShape();
          for (let a = 0; a < p.TWO_PI; a += 0.05) {
            let r = pt.size * (1.0 + 0.4 * p.sin(5 * a) + 0.2 * p.sin(10 * a));
            let x = r * p.cos(a); let y = r * p.sin(a);
            p.vertex(x, y);
          }
          p.endShape(p.CLOSE);
          p.stroke(130, 25, 15); p.strokeWeight(1.5); p.line(0, 0, 0, pt.size * 1.1);
        } 
        else if (pt.type === 'grass') {
          // 🍃 No2: 뾰족한 인맥 수려 풀잎 모델링
          p.fill(55, 155, 65, 230);
          p.beginShape();
          p.vertex(0, -pt.size * 1.2);
          p.bezierVertex(pt.size * 0.6, -pt.size * 0.4, pt.size * 0.6, pt.size * 0.6, 0, pt.size * 1.2);
          p.bezierVertex(-pt.size * 0.6, pt.size * 0.6, -pt.size * 0.6, -pt.size * 0.4, 0, -pt.size * 1.2);
          p.endShape(p.CLOSE);
          p.stroke(35, 105, 40); p.strokeWeight(2); p.line(0, -pt.size * 1.1, 0, pt.size * 1.1);
        } 
        else {
          // ❄️ No3: 정교한 6축 결정 대우주 눈꽃송이 모델링
          p.stroke(240, 248, 255, 230);
          p.strokeWeight(p.max(1.5, pt.size * 0.08));
          p.noFill();
          for (let j = 0; j < 6; j++) {
            p.rotate(p.PI / 3);
            p.line(0, 0, 0, -pt.size);
            p.line(0, -pt.size * 0.4, pt.size * 0.3, -pt.size * 0.6);
            p.line(0, -pt.size * 0.4, -pt.size * 0.3, -pt.size * 0.6);
            p.line(0, -pt.size * 0.7, pt.size * 0.2, -pt.size * 0.85);
            p.line(0, -pt.size * 0.7, -pt.size * 0.2, -pt.size * 0.85);
          }
        }
        p.pop();

        // 글자 영역 가림 누적량 연산
        let d = p.dist(pt.x, pt.y, centerX, centerY);
        if (d < textBoundary) {
          textZoneCoverage += (settings.gaugeValue / 40.0);
        }
      }

      if (pt.age > pt.maxAge || pt.y > p.height + 40) {
        this.particles.splice(i, 1);
      }
    }
    return textZoneCoverage;
  }

  drawSubtitle(p, style, settings, maskForce) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    // 💡 [자간/줄간격 비율 고정 수술]: Scale(glowIntensity) 수치에 따라 완벽한 기하급수 비례 배율 연동
    const fontSize = p.map(settings.glowIntensity, 10, 250, 16, 110);
    const tracking = fontSize * 0.65; // 글자간의 정갈한 여백 비율 박제
    const leading = fontSize * 1.35;  // 줄간격이 글꼴 크기와 동일한 비율로 동반 팽창 보정

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    // Gauge 및 자연 누적 가림 힘에 의한 알파 레이어 감쇠식
    let calculatedAlpha = 255 - (maskForce * 12);
    calculatedAlpha = p.constrain(calculatedAlpha, 0, 255);

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

        // 💡 4번 비 효과: 자막 레이어가 물결 파동(Ripple)에 퍼지듯이 왜곡 소멸하는 물리식
        if (style === 'earth') {
          let waveFactor = p.sin(p.frameCount * 0.08 + charIdx * 0.5 + lineIdx) * p.map(settings.gaugeValue, 0, 100, 2, 45);
          finalX += waveFactor * 0.6;
          finalY += p.cos(p.frameCount * 0.06 + charIdx) * waveFactor * 0.4;
        }

        p.fill(255, calculatedAlpha);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });
  }

  update(audioData) {
    if (this.p5Instance) this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    this.particles = [];
  }
}
