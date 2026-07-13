/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 7.0 (계절 물리 엔진 및 자막 가리기 알고리즘 통합판)
 * - 1:낙엽, 2:풀잎, 3:눈, 4:빗방울(탑뷰 리플) 완전 분리
 * - Scale 기반 자간/줄간격 동기화 및 Volume 기반 파티클 크기 연동 완료
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    this.version = "020호 Seasonal Physics Lyric Ver 7.0";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        const settings = window.cosmicEngineSettings || { 
          colorStyle: 'neon', gaugeValue: 0.5, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0 
        };
        
        const style = settings.colorStyle; 
        const density = Math.floor(settings.gaugeValue * 25);
        
        // 1. 입자 생성 (Gauge -> 밀도)
        if (p.frameCount % Math.max(1, (30 - density)) === 0) {
          this.spawnParticle(p, style, settings);
        }

        // 2. 물리 업데이트 및 렌더링
        this.updateAndDrawParticles(p, style, settings);

        // 3. 자막 렌더링
        this.drawSubtitle(p, settings);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings) {
    // Volume(gain) -> 입자 크기
    const vScale = settings.audioGain * 2;
    let type = style === 'neon' ? 'leaf' : style === 'pastel' ? 'grass' : style === 'monochrome' ? 'snow' : 'rain';
    
    this.particles.push({
      x: type === 'rain' ? p.random(p.width) : p.random(p.width),
      y: type === 'rain' ? p.random(p.height) : -20,
      vx: p.random(-1, 1), vy: type === 'rain' ? 0 : p.random(2, 5),
      size: p.random(5, 15) * vScale,
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 30 : 500
    });
  }

  updateAndDrawParticles(p, style, settings) {
    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const fontSize = settings.glowIntensity * 100;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.age++;

      // 물리 엔진
      if (pt.type === 'rain') {
        // 탑뷰 빗방울 리플 효과
        p.noFill();
        p.stroke(100, 100, 255, 150 - (pt.age * 5));
        p.ellipse(pt.x, pt.y, pt.age * 2);
      } else {
        pt.x += pt.vx; pt.y += pt.vy;
        p.noStroke();
        p.fill(style === 'neon' ? [200, 100, 50] : [255, 255, 255], 200);
        if (pt.type === 'leaf') p.triangle(pt.x, pt.y, pt.x+pt.size, pt.y, pt.x+pt.size/2, pt.y+pt.size);
        else if (pt.type === 'grass') p.rect(pt.x, pt.y, pt.size/2, pt.size);
        else p.ellipse(pt.x, pt.y, pt.size);
      }
      
      // 💡 자막 가리기 로직: 파티클이 자막 영역(중앙)을 지나면 자막 투명도 감소
      if (Math.abs(pt.x - centerX) < fontSize * 2 && Math.abs(pt.y - centerY) < fontSize * 2) {
          pt.isCovering = true;
      }

      if (pt.age > pt.maxAge || pt.y > p.height + 50) this.particles.splice(i, 1);
    }
  }

  drawSubtitle(p, settings) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const fontSize = settings.glowIntensity * 100;
    // 💡 자간/줄간격 동기화
    p.textSize(fontSize);
    p.textLeading(fontSize * 1.2); 
    p.textAlign(p.CENTER, p.CENTER);
    
    // 빗방울(rain) 스타일: 왜곡 효과
    let yOffset = 0;
    if (window.cosmicEngineSettings?.colorStyle === 'custom') {
       yOffset = Math.sin(p.frameCount * 0.1) * 10;
    }

    // 자막 투명도 계산 (Gauge 밀도가 높으면 더 빨리 가림)
    const density = settings.gaugeValue;
    const textAlpha = 255 - (density * 2);
    p.fill(255, textAlpha);

    const lines = text.split(" ");
    lines.forEach((line, i) => {
      p.text(line, p.width / 2 + (settings.positionOffset?.x || 0), p.height / 2 + (settings.positionOffset?.y || 0) + yOffset + (i * fontSize * 1.2));
    });
  }

  update(audioData) { if (this.p5Instance) this.p5Instance.redraw(); }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() { if (this.p5Instance) this.p5Instance.remove(); }
}
