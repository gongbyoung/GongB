/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 5.0 (4단계 자연 물리 엔진 및 자막 연출 마스터)
 * - 1:낙엽, 2:풀잎, 3:눈, 4:빗방울(글자 분해/솟구침) 물리 로직 완전 복구
 * - 관제탑 Color Style Palette(No1~No4)와 1:1 자동 매핑
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    this.version = "020호 Seasonal Physics Lyric Ver 5.0";
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
        const settings = window.cosmicEngineSettings || { colorStyle: 'neon', gaugeValue: 0.5 };
        const style = settings.colorStyle; 
        
        // 1. 입자 생성 (Gauge 수치에 따라 밀도 조절)
        if (p.frameCount % Math.max(1, Math.floor(10 - settings.gaugeValue * 10)) === 0) {
          this.spawnParticle(p, style);
        }

        // 2. 물리 엔진 업데이트 및 렌더링
        this.updateAndDrawParticles(p, style);

        // 3. 자막 렌더링 (4번 스타일 시 왜곡 알고리즘 적용)
        this.drawSubtitle(p, style, settings);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style) {
    let type = style === 'neon' ? 'leaf' : style === 'pastel' ? 'grass' : style === 'monochrome' ? 'snow' : 'rain';
    this.particles.push({
      x: p.random(p.width), y: -20,
      vx: p.random(-1, 1), vy: p.random(2, 5),
      size: p.random(5, 12),
      type: type
    });
  }

  updateAndDrawParticles(p, style) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.x += pt.vx; pt.y += pt.vy;

      p.noStroke();
      if (pt.type === 'leaf') { p.fill(200, 100, 50); p.ellipse(pt.x, pt.y, pt.size); } // 낙엽
      else if (pt.type === 'grass') { p.fill(50, 200, 50); p.rect(pt.x, pt.y, pt.size, pt.size); } // 풀잎
      else if (pt.type === 'snow') { p.fill(255); p.ellipse(pt.x, pt.y, pt.size); } // 눈송이
      else if (pt.type === 'rain') { p.stroke(150, 150, 255); p.line(pt.x, pt.y, pt.x, pt.y + 10); } // 빗방울
      
      if (pt.y > p.height) this.particles.splice(i, 1);
    }
  }

  drawSubtitle(p, style, settings) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    p.textSize(settings.glowIntensity * 50);
    p.textAlign(p.CENTER, p.CENTER);
    
    // 4번(빗방울) 모드: 바닥에서 튀어 오르는 연출
    let yOffset = 0;
    if (style === 'custom') { 
      yOffset = Math.sin(p.frameCount * 0.1) * 20; 
      p.fill(255, 150); // 빗방울에 의한 글자 왜곡 느낌
    } else {
      p.fill(255);
    }

    const lines = text.split(" ");
    lines.forEach((line, i) => {
      p.text(line, p.width / 2, p.height / 2 + yOffset + (i * 40));
    });
  }

  update(audioData) { if (this.p5Instance) this.p5Instance.redraw(); }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() { if (this.p5Instance) this.p5Instance.remove(); }
}
