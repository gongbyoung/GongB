/**
 * 020_p5_srt_canvas.js
 * [회원님 맞춤형 패치 완료]
 * - 띄어쓰기 기준 자막 자동 줄바꿈
 * - Range: 폰트 글씨 크기 제어
 * - X, Y, Z: 폰트 중심점 및 깊이(Scale) 제어
 * - Scale: 단풍잎, 나뭇잎, 눈꽃 파티클 크기 제어
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
    
    // 이펙트 파티클
    this.particles = [];
    this.environmentalParticles = []; // 상시 흩날리는 자연물 (단풍, 눈 등)
    
    this.lastSubtitle = "";
    this.fadeAlpha = 0;
    this.textImpactScale = 1.0; 
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const drawSnow = (p, x, y, size, color) => {
      p.push();
      p.translate(x, y);
      p.stroke(color);
      p.strokeWeight(size * 0.15);
      let r = size;
      for (let i = 0; i < 6; i++) {
        p.line(0, 0, 0, -r);
        p.line(0, -r * 0.4, r * 0.3, -r * 0.8);
        p.line(0, -r * 0.4, -r * 0.3, -r * 0.8);
        p.rotate(p.PI / 3);
      }
      p.pop();
    };

    const drawLeaf = (p, x, y, size, color, angle) => {
      p.push();
      p.translate(x, y);
      p.rotate(angle);
      p.fill(color);
      p.noStroke();
      p.scale(size / 15);
      p.beginShape();
      p.bezierVertex(0, -15, 15, -8, 15, 8);
      p.bezierVertex(15, 8, 0, 15, 0, 15);
      p.bezierVertex(0, 15, -15, 8, -15, 8);
      p.bezierVertex(-15, 8, -15, -8, 0, -15);
      p.endShape(p.CLOSE);
      p.stroke(0, 50);
      p.strokeWeight(1);
      p.line(0, -15, 0, 15);
      p.pop();
    };

    const drawMaple = (p, x, y, size, color, angle) => {
      p.push();
      p.translate(x, y);
      p.rotate(angle);
      p.fill(color);
      p.noStroke();
      p.scale(size / 15);
      p.beginShape();
      p.vertex(0, -15); p.vertex(4, -4); p.vertex(15, -6);
      p.vertex(7, 3); p.vertex(12, 15); p.vertex(0, 7);
      p.vertex(-12, 15); p.vertex(-7, 3); p.vertex(-15, -6);
      p.vertex(-4, -4);
      p.endShape(p.CLOSE);
      p.stroke(0, 50);
      p.strokeWeight(1.5);
      p.line(0, 7, 0, 18);
      p.pop();
    };

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.rectMode(p.CENTER);
        p.textAlign(p.CENTER, p.CENTER);
        
        // 자연 파티클 초기화
        for (let i = 0; i < 60; i++) {
          let types = ['snow', 'leaf', 'maple'];
          this.environmentalParticles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            baseSize: p.random(5, 15), // 기본 사이즈
            type: p.random(types),
            speedX: p.random(-1, 1),
            speedY: p.random(0.5, 2.5),
            angle: p.random(p.TWO_PI),
            spin: p.random(-0.05, 0.05),
            cOffset: p.random(0, 255)
          });
        }
        
        p.noLoop();
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        p.clear();
        p.background(10, 15, 20, 180); // 배경

        let rangeVal = 22, scaleVal = 85, gain = 100;
        let offsetX = 0, offsetY = 0, offsetZ = 0;
        let c1 = '#ff0055', c2 = '#00ffcc';

        if (window.cosmicEngineSettings) {
          rangeVal = window.cosmicEngineSettings.scatterExponent * 10; // Range 슬라이더 (5~50)
          scaleVal = window.cosmicEngineSettings.glowIntensity * 100;  // Scale 슬라이더 (10~250)
          gain = window.cosmicEngineSettings.audioGain;
          
          if (window.cosmicEngineSettings.positionOffset) {
            offsetX = window.cosmicEngineSettings.positionOffset.x || 0;
            offsetY = window.cosmicEngineSettings.positionOffset.y || 0;
            offsetZ = window.cosmicEngineSettings.positionOffset.z || 0;
          }
          if (window.cosmicEngineSettings.customColors) {
            c1 = window.cosmicEngineSettings.customColors.gas1 || c1;
            c2 = window.cosmicEngineSettings.customColors.gas2 || c2;
          }
        }

        const audio = document.getElementById('audio-player');
        const isPlaying = audio && !audio.paused && audio.currentTime > 0;

        let rms = 0;
        if (this.currentAudioData && this.currentAudioData.raw) {
          let sum = 0;
          for (let i = 0; i < 128; i++) sum += this.currentAudioData.raw[i];
          rms = (sum / 128) / 255.0;
        }

        this.environmentalParticles.forEach(ep => {
          ep.x += ep.speedX + (p.noise(p.frameCount * 0.01, ep.y * 0.01) - 0.5) * 2;
          ep.y += ep.speedY * (1.0 + rms * gain * 0.5);
          ep.angle += ep.spin;

          if (ep.y > height + 20) {
            ep.y = -20;
            ep.x = p.random(width);
          }
          if (ep.x > width + 20) ep.x = -20;
          if (ep.x < -20) ep.x = width + 20;

          // 💡 [핵심] Scale 슬라이더로 단풍, 잎, 눈의 크기 조절
          let particleScale = (scaleVal / 85.0); 
          let finalSize = ep.baseSize * particleScale * (1.0 + rms * 0.5);

          // 색상 결정 (타입별)
          let pColor;
          if (ep.type === 'snow') pColor = p.color(255, 255, 255, 180);
          else if (ep.type === 'maple') pColor = p.color('#d9381e'); // 단풍색
          else pColor = p.color('#556b2f'); // 낙엽색

          if (ep.type === 'snow') drawSnow(p, ep.x, ep.y, finalSize, pColor);
          else if (ep.type === 'maple') drawMaple(p, ep.x, ep.y, finalSize, pColor, ep.angle);
          else drawLeaf(p, ep.x, ep.y, finalSize, pColor, ep.angle);
        });

        const rawSubtitle = window.currentSubtitleText || "";

        if (rawSubtitle !== this.lastSubtitle && rawSubtitle !== "") {
          this.lastSubtitle = rawSubtitle;
          this.fadeAlpha = 0; 
          this.textImpactScale = 1.5; // 등장 시 쾅 치는 효과
        }

        if (isPlaying && rawSubtitle !== "") {
          if (this.fadeAlpha < 255) this.fadeAlpha += 20;
          if (this.textImpactScale > 1.0) this.textImpactScale -= 0.1;

          p.push();
          ctx.shadowBlur = 20 * (1.0 + rms);
          ctx.shadowColor = p.color(c2).toString();

          // 💡 [핵심] 띄어쓰기를 줄바꿈으로 강제 변환
          let formattedText = rawSubtitle.split(' ').join('\n');

          // 💡 [핵심] Range 슬라이더로 폰트 글씨 크기 조정 (기본 크기 대비 비율)
          let baseFontSize = (rangeVal / 22.0) * (height * 0.08); 
          if (baseFontSize < 10) baseFontSize = 10;
          
          // Z 오프셋을 통한 추가 3D 스케일링 효과
          let depthScale = 1.0 + (offsetZ / 100.0);
          
          p.textSize(baseFontSize * this.textImpactScale * depthScale);
          p.textStyle(p.BOLD);
          // 줄바꿈 간격 설정 (글씨가 커지면 간격도 넓어짐)
          p.textLeading(baseFontSize * 1.2 * depthScale); 

          p.fill(255, 255, 255, this.fadeAlpha);
          p.stroke(p.color(c1));
          p.strokeWeight(baseFontSize * 0.03); 

          // 💡 [핵심] X, Y 오프셋으로 폰트 중심점 지정
          // 기본 중심점(width/2, height/2)에 사용자가 입력한 오프셋 합산
          let textX = (width / 2) + offsetX;
          let textY = (height / 2) + offsetY - (rms * 15.0 * gain); // 베이스에 약간 통통 튐

          p.text(formattedText, textX, textY);
          p.pop();
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.particles = [];
    this.environmentalParticles = [];
    this.currentAudioData = null;
  }
}
