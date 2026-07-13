/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 6.0 (관제탑 제어권 100% 통합판)
 * - 4단계 물리 엔진(낙엽, 풀잎, 눈, 비)이 우측 UI 슬라이더와 완벽 동기화
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    this.version = "020호 Seasonal Physics Lyric Ver 6.0";
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
          colorStyle: 'neon', gaugeValue: 0.5, scatterExponent: 2.2, glowIntensity: 0.85 
        };
        
        // 1. UI 연동: Gauge(입자수), Range(입자크기), Scale(전체크기) 적용
        const style = settings.colorStyle; 
        const density = Math.floor(settings.gaugeValue * 20);
        
        if (p.frameCount % Math.max(1, (20 - density)) === 0) {
          this.spawnParticle(p, style, settings);
        }

        this.updateAndDrawParticles(p, style, settings);
        this.drawSubtitle(p, settings);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings) {
    // 💡 Range(scatterExponent)를 입자 크기 편차에 반영
    const sizeVar = settings.scatterExponent * 2;
    let type = style === 'neon' ? 'leaf' : style === 'pastel' ? 'grass' : style === 'monochrome' ? 'snow' : 'rain';
    this.particles.push({
      x: p.random(p.width), y: -20,
      vx: p.random(-1, 1), vy: p.random(2, 5),
      size: p.random(sizeVar, sizeVar * 2),
      type: type
    });
  }

  updateAndDrawParticles(p, style, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.x += pt.vx; pt.y += pt.vy;

      p.noStroke();
      // 💡 1:낙엽, 2:풀잎, 3:눈, 4:빗방울
      if (pt.type === 'leaf') { p.fill(200, 100, 50, 200); p.ellipse(pt.x, pt.y, pt.size); }
      else if (pt.type === 'grass') { p.fill(50, 200, 50, 200); p.rect(pt.x, pt.y, pt.size, pt.size); }
      else if (pt.type === 'snow') { p.fill(255, 200); p.ellipse(pt.x, pt.y, pt.size); }
      else if (pt.type === 'rain') { 
        p.stroke(150, 150, 255, 150); 
        p.line(pt.x, pt.y, pt.x, pt.y + 10); 
        if (pt.y > p.height - 50) pt.vy *= -0.5; // 4번: 바닥 솟구침 물리
      }
      
      if (pt.y > p.height + 50) this.particles.splice(i, 1);
    }
  }

  drawSubtitle(p, settings) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    // 💡 Scale(glowIntensity)을 폰트 크기에 반영
    p.textSize(settings.glowIntensity * 100);
    p.textAlign(p.CENTER, p.CENTER);
    p.fill(255);
    
    // 빗방울(rain) 스타일일 때의 왜곡 효과
    let yOffset = 0;
    if (window.cosmicEngineSettings?.colorStyle === 'custom') {
       yOffset = Math.sin(p.frameCount * 0.1) * (settings.audioGain * 20);
    }

    const lines = text.split(" ");
    lines.forEach((line, i) => {
      p.text(line, p.width / 2 + (settings.positionOffset?.x || 0), p.height / 2 + (settings.positionOffset?.y || 0) + yOffset + (i * 50));
    });
  }

  update(audioData) { if (this.p5Instance) this.p5Instance.redraw(); }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() { if (this.p5Instance) this.p5Instance.remove(); }
}
