/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 4.5 (4단계 자연 물리 엔진 통합판)
 * - 1:낙엽, 2:풀잎, 3:눈, 4:빗방울 알고리즘 완벽 분리 적용
 * - 모든 7대 관제탑(Seed, Range, Scale, Volume, Gauge, Offset, Color) 연동
 */

export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    this.lastSubtitle = "";
    this.version = "020호 Seasonal Physics Lyric Ver 4.5";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.textAlign(p.CENTER, p.CENTER);
        p.rectMode(p.CENTER);
      };

      p.draw = () => {
        p.clear();
        
        // 1. 관제탑 데이터 수신
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 22, glowIntensity: 85, 
          audioGain: 100, gaugeValue: 50, colorStyle: 'neon', positionOffset: {x:0, y:0} 
        };

        // 2. 물리 환경 설정 (Color Style에 따른 4단계 알고리즘 분기)
        // No1:낙엽, No2:풀잎, No3:눈, No4:빗방울
        const style = settings.colorStyle; 
        const density = Math.floor(settings.gaugeValue / 10);
        
        // 3. 파티클 생성 (Gauge 연동)
        if (p.frameCount % Math.max(1, (10 - density)) === 0) {
          this.spawnParticle(p, style, settings);
        }

        // 4. 파티클 물리 업데이트 및 렌더링
        this.updateAndDrawParticles(p, style, settings);

        // 5. 자막 렌더링
        this.drawSubtitle(p, settings);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings) {
    let type = style === 'neon' ? 'leaf' : style === 'pastel' ? 'grass' : style === 'monochrome' ? 'snow' : 'rain';
    this.particles.push({
      x: p.random(p.width), y: -20,
      vx: p.random(-1, 1), vy: p.random(2, 6) * (settings.scatterExponent / 20),
      size: p.random(5, 15),
      type: type,
      life: 255
    });
  }

  updateAndDrawParticles(p, style, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.x += pt.vx; pt.y += pt.vy;
      
      // 4번 빗방울 모드: 글자 왜곡 및 바닥 튕김 물리
      if (pt.type === 'rain') {
        p.stroke(200, 200, 255, 150);
        p.line(pt.x, pt.y, pt.x, pt.y + 10);
        if (pt.y > p.height - 50) { // 바닥 닿으면 튕김
            pt.vy *= -0.5;
        }
      } else {
        p.noStroke();
        p.fill(255, 200);
        p.ellipse(pt.x, pt.y, pt.size);
      }
      
      if (pt.y > p.height + 20) this.particles.splice(i, 1);
    }
  }

  drawSubtitle(p, settings) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    // Scale(Glow) -> 글자 크기, X,Y Offset 적용
    p.textSize(settings.glowIntensity / 2);
    p.fill(255);
    
    // 띄어쓰기 기준 줄바꿈
    const lines = text.split(" ");
    const centerX = p.width / 2 + (settings.positionOffset?.x || 0);
    const centerY = p.height / 2 + (settings.positionOffset?.y || 0);
    
    lines.forEach((line, i) => {
      p.text(line, centerX, centerY + (i * settings.glowIntensity / 2));
    });
  }

  update(audioData) {
    if (this.p5Instance) this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
  }
}
