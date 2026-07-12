/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 1.2 (p5 인스턴스 참조 에러 완치 및 아날로그 입자 쉐이프 대개조 마스터판)
 * - trackSrtTimeline 내 p.millis 참조 오류를 봉쇄하고 정중앙 정렬 동기화 유지
 * - No1(단풍잎), No2(풀잎), No3(눈꽃 결정)을 베지에 곡선 및 육방 구조식으로 정교하게 드로잉
 * - Scale(폭), Volume(자막크기), Range(입자편차), Gauge(가림시간ms), 3D 위치 오프셋 직결 완비
 */

export default class P5SrtCanvas {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;

    this.srtTracks = [];
    this.currentText = "은하수를 유영하는 키네틱 빛의 숨결";
    this.currentTrackEndTime = 0;

    this.particles = [];
    this.textPixels = [];
    
    this.version = "020호 SRT Kinetic Lyric Ver 1.2";
    this.guiOverlay = null;
    this.lastColorStyle = "";
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

    console.log(`%c[🔮 020호 자막 엔진 패치 완료] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    this.buildOnScreenGuideUI();
    this.parseDefaultSrt();

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        p.textFont('sans-serif');
        p.textAlign(p.CENTER, p.CENTER);
      };

      p.draw = () => {
        p.clear();

        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let offX = 0, offY = 0, offZ = 0;
        let colorStyle = 'monochrome';

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 22; 
          gain = window.cosmicEngineSettings.audioGain || 1.0;          
          glow = window.cosmicEngineSettings.glowIntensity || 85; 
          colorStyle = window.cosmicEngineSettings.colorStyle || 'monochrome';
          gauge = window.cosmicEngineSettings.gaugeValue || 50; 
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        p.noiseSeed(seed);
        p.randomSeed(seed);

        const width = p.width;
        const height = p.height;

        this.trackSrtTimeline();

        p.background(8, 11, 18);

        let bass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;
        let volumeFactor = gain * (1.0 + bass * 0.5);
        let leafSizeMultiplier = p.map(scatter, 5, 50, 1.0, 100.0);

        if (this.lastColorStyle !== colorStyle || p.frameCount % 120 === 0) {
          this.lastColorStyle = colorStyle;
          this.regenerateParticles(width, height);
          if (colorStyle === 'custom') {
            this.computeTextPixels(p, glow, gain);
          }
        }

        p.push();
        p.translate(width / 2 + offX * 2, height / 2 + offY * -2, offZ * -1);

        let fadeTimeFactor = p.map(gauge, 0, 100, 0, 1200);

        if (colorStyle === 'monochrome') {
          // 🍁 [스타일 1]: 단풍잎 마스크 연출
          this.drawStandardText(p, glow, gain, 'rgba(245, 238, 225, 0.95)', fadeTimeFactor);
          this.drawMapleLeafLayer(p, scatter, leafSizeMultiplier);
        } 
        else if (colorStyle === 'neon') {
          // 🌿 [스타일 2]: 풀잎 마스크 연출
          this.drawStandardText(p, glow, gain, 'rgba(238, 246, 240, 0.95)', fadeTimeFactor);
          this.drawGrassLeafLayer(p, scatter, leafSizeMultiplier);
        } 
        else if (colorStyle === 'pastel') {
          // ❄️ [스타일 3]: 눈꽃 결정 마스크 연출
          this.drawStandardText(p, glow, gain, 'rgba(255, 255, 255, 0.98)', fadeTimeFactor);
          this.drawSnowflakeLayer(p, scatter, leafSizeMultiplier);
        } 
        else if (colorStyle === 'custom' || colorStyle === 'full-random') {
          // 🌊 [스타일 4]: 빗방울 비선형 왜곡 분해 물리
          this.drawRainFluidAlgorithm(p, glow, gain, volumeFactor, scatter);
        }

        p.pop();
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 자막 드로잉 레이어 파이프라인
  drawStandardText(p, glow, gain, textColorStr, fadeTimeFactor) {
    p.push();
    let fontSize = p.map(gain, 10, 500, 30, 130);
    p.textSize(fontSize);
    
    let wrapWidthFactor = p.map(glow, 10, 250, 0.4, 0.95);
    let wrapWidth = p.width * wrapWidthFactor;

    p.fill(textColorStr);
    
    const time = performance.now();
    if (this.currentTrackEndTime && time > this.currentTrackEndTime - fadeTimeFactor) {
      let alpha = p.map(time, this.currentTrackEndTime - fadeTimeFactor, this.currentTrackEndTime, 255, 0);
      p.fill(255, alpha);
    }
    
    p.text(this.currentText, 0, 0, wrapWidth); 
    p.pop();
  }

  // 🍁 [독립 쉐이더 1]: 다각 베지에 곡선을 활용한 리얼 단풍잎 드로잉
  drawMapleLeafLayer(p, scatter, leafSizeMultiplier) {
    p.noStroke();
    const time = p.frameCount * 0.015;
    this.particles.forEach((pt, idx) => {
      pt.y += pt.speed * 0.4;
      pt.x += p.sin(time + pt.phase) * 0.5;
      if (pt.y > p.height) { pt.y = p.random(-50, -10); pt.x = p.random(p.width); }

      // 가을 단풍 무드 파스텔 그라데이션 조합 분배
      p.fill(idx % 2 === 0 ? 'rgba(185, 65, 45, 0.55)' : 'rgba(215, 125, 40, 0.45)');
      p.push();
      p.translate(pt.x - p.width / 2, pt.y - p.height / 2);
      p.rotate(pt.phase + time);
      
      let r = (pt.size * 1.5) * leafSizeMultiplier * 0.15;
      
      // 베지에 기반 5갈래 단풍 잎사귀 물리 구조 수식 시공
      p.beginShape();
      p.vertex(0, -r);
      p.bezierVertex(r*0.2, -r*0.5, r*0.4, -r*0.6, r*0.7, -r*0.4);
      p.vertex(r*0.5, -r*0.2);
      p.bezierVertex(r*0.7, -r*0.1, r*0.9, 0, r, r*0.3);
      p.vertex(r*0.4, r*0.2);
      p.bezierVertex(r*0.3, r*0.5, r*0.1, r*0.8, 0, r);
      p.bezierVertex(-r*0.1, r*0.8, -r*0.3, r*0.5, -r*0.4, r*0.2);
      p.vertex(-r, r*0.3);
      p.bezierVertex(-r*0.9, 0, -r*0.7, -r*0.1, -r*0.5, -r*0.2);
      p.vertex(-r*0.7, -r*0.4);
      p.bezierVertex(-r*0.4, -r*0.6, -r*0.2, -r*0.5, 0, -r);
      p.endShape(p.CLOSE);
      p.pop();
    });
  }

  // 🌿 [독립 쉐이더 2]: 유선형 대칭 곡선을 활용한 리얼 봄/여름 풀잎 드로잉
  drawGrassLeafLayer(p, scatter, leafSizeMultiplier) {
    p.noStroke();
    const time = p.frameCount * 0.015;
    this.particles.forEach((pt, idx) => {
      pt.y += pt.speed * 0.4;
      pt.x += p.sin(time + pt.phase) * 0.5;
      if (pt.y > p.height) { pt.y = p.random(-50, -10); pt.x = p.random(p.width); }

      p.fill(idx % 2 === 0 ? 'rgba(52, 128, 82, 0.5)' : 'rgba(92, 173, 126, 0.4)');
      p.push();
      p.translate(pt.x - p.width / 2, pt.y - p.height / 2);
      p.rotate(pt.phase + time);
      
      let w = pt.size * leafSizeMultiplier * 0.25;
      let h = w * 2.2;
      
      // 풀잎 형태학 융합 곡선 가공
      p.beginShape();
      p.vertex(0, -h/2);
      p.bezierVertex(w/2, -h/4, w/2, h/4, 0, h/2);
      p.bezierVertex(-w/2, h/4, -w/2, -h/4, 0, -h/2);
      p.endShape(p.CLOSE);

      // 인맥 중앙선 드로잉으로 아날로그 질감 가산
      p.stroke(idx % 2 === 0 ? 'rgba(32, 85, 52, 0.3)' : 'rgba(255,255,255,0.2)');
      p.strokeWeight(1.5);
      p.line(0, -h/2, 0, h/2);
      p.noStroke();
      
      p.pop();
    });
  }

  // ❄️ [독립 쉐이더 3]: 육방 대칭 기하학 결정을 활용한 리얼 겨울 눈꽃 드로잉
  drawSnowflakeLayer(p, scatter, leafSizeMultiplier) {
    p.stroke(255, 255, 255, 160);
    const time = p.frameCount * 0.01;
    this.particles.forEach(pt => {
      pt.y += pt.speed * 0.3;
      pt.x += p.sin(time * 2.0 + pt.phase) * 0.8;
      if (pt.y > p.height) { pt.y = p.random(-30, 0); pt.x = p.random(p.width); }

      p.push();
      p.translate(pt.x - p.width / 2, pt.y - p.height / 2);
      p.rotate(pt.phase + time * 0.5);
      
      let size = (pt.size * 0.8) * (leafSizeMultiplier * 0.12);
      p.strokeWeight(p.constrain(size * 0.15, 1.0, 3.5));
      
      // 6방 대칭 결정 침상 가지 군무 연산
      for (let j = 0; j < 6; j++) {
        p.rotate(p.PI / 3);
        p.line(0, 0, 0, -size);
        p.line(0, -size * 0.5, size * 0.25, -size * 0.7);
        p.line(0, -size * 0.5, -size * 0.25, -size * 0.7);
      }
      p.pop();
    });
    p.noStroke();
  }

  // 🌊 [스타일 4]: 빗방울 물리 분해 왜곡 연산
  drawRainFluidAlgorithm(p, glow, gain, volumeFactor, scatter) {
    const width = p.width;
    const height = p.height;
    const time = p.frameCount * 0.03;

    p.stroke('rgba(165, 195, 215, 0.4)');
    p.strokeWeight(1.2);
    this.particles.forEach(pt => {
      pt.y += pt.speed * p.map(scatter, 5, 50, 0.5, 2.5);
      pt.x += p.sin(time + pt.phase) * 0.4;
      if (pt.y > height) { pt.y = p.random(-20, 0); pt.x = p.random(width); }
      p.line(pt.x, pt.y, pt.x, pt.y + pt.size * 2);
    });

    p.noStroke();
    let groundY = height * 0.82;

    this.textPixels.forEach(px => {
      let waveWarp = p.noise(px.origX * 0.01, px.origY * 0.01, time) * (volumeFactor * 0.8);
      px.x += p.sin(time + px.phase) * (waveWarp * 0.05);
      
      if (waveWarp > 12) {
        px.y += (groundY - px.y) * 0.08;
        px.isGrounded = true;
      }

      if (px.isGrounded) {
        px.popupY -= 0.6 + p.noise(px.x, time) * 1.5;
        if (px.popupY < -120) { px.popupY = 0; px.isGrounded = false; }
      }

      let finalY = px.origY + (px.isGrounded ? px.popupY : p.cos(time + px.phase) * waveWarp * 0.2);
      p.fill(160 + p.sin(time + px.phase) * 45, 195, 245, px.alpha);
      p.ellipse(px.x - p.width / 2, finalY - p.height / 2, p.map(scatter, 5, 50, 1.5, 4.5));
    });
  }

  computeTextPixels(p, glow, gain) {
    this.textPixels = [];
    let fontSize = p.map(gain, 10, 500, 30, 130);
    p.textSize(fontSize);
    
    let wrapWidthFactor = p.map(glow, 10, 250, 0.4, 0.95);
    let wrapWidth = p.width * wrapWidthFactor;

    let offscreen = p.createGraphics(p.width, p.height);
    offscreen.pixelDensity(1);
    offscreen.textSize(fontSize);
    offscreen.textAlign(p.CENTER, p.CENTER);
    offscreen.fill(255);
    offscreen.text(this.currentText, p.width / 2, p.height / 2, wrapWidth);
    offscreen.loadPixels();

    for (let y = 0; y < p.height; y += 4) {
      for (let x = 0; x < p.width; x += 4) {
        let index = (x + y * p.width) * 4;
        if (offscreen.pixels[index] > 128) {
          this.textPixels.push({
            x: x, y: y, origX: x, origY: y,
            phase: p.random(p.TWO_PI), alpha: p.random(140, 255),
            popupY: 0, isGrounded: false
          });
        }
      }
    }
    offscreen.remove();
  }

  regenerateParticles(width, height) {
    this.particles = [];
    for (let i = 0; i < 280; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 8 + 4,
        speed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
        alpha: Math.random() * 100 + 100
      });
    }
  }

  trackSrtTimeline() {
    const audioEl = document.querySelector('audio');
    if (!audioEl || this.srtTracks.length === 0) return;

    let curTime = audioEl.currentTime;
    let foundTrack = this.srtTracks.find(t => curTime >= t.start && curTime <= t.end);
    if (foundTrack && this.currentText !== foundTrack.text) {
      this.currentText = foundTrack.text;
      // 💡 [에러 정화 고정]: p.millis() 대신 고유 타임 바인딩으로 ReferenceError 완전 봉쇄
      this.currentTrackEndTime = performance.now() + (foundTrack.end - curTime) * 1000;
    }
  }

  parseDefaultSrt() {
    const rawSrt = `
1
00:00:01,000 --> 00:00:06,000
새벽 안개 속에서 부드럽게 일렁이는 빛의 고리

2
00:00:07,500 --> 00:00:13,000
은하수를 유영하는 키네틱 빛의 군무와 조화

3
00:00:14,000 --> 00:00:20,000
오로라가 일렁이는 밤의 수면 위를 걷듯이

4
00:00:21,000 --> 00:00:28,000
마음이 안정되고 편안해지는 명상 미디어 아트의 세계
    `;

    this.srtTracks = [];
    const lines = rawSrt.trim().split('\n');
    let currentTrack = null;

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      if (line.includes('-->')) {
        const parts = line.split('-->');
        const start = this.timeToSeconds(parts[0].trim());
        const end = this.timeToSeconds(parts[1].trim());
        currentTrack = { start, end, text: "" };
      } else if (currentTrack && isNaN(line)) {
        currentTrack.text = line;
        this.srtTracks.push(currentTrack);
        currentTrack = null;
      }
    });
  }

  timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const secsParts = parts[2].split(',');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(secsParts[0]) + parseInt(secsParts[1]) / 1000;
  }

  buildOnScreenGuideUI() {
    if (!this.container) return;
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    Object.assign(this.guiOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '85%', maxWidth: '440px', backgroundColor: 'rgba(7, 10, 15, 0.96)',
      border: '1px solid rgba(0, 255, 204, 0.6)', borderRadius: '12px', padding: '22px',
      color: '#ffffff', fontFamily: 'sans-serif', zIndex: '99', textAlign: 'center',
      transition: 'opacity 0.4s ease-in-out'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 12px; font-weight: bold;">⚙️ STAGE STATUS: ${this.version} READY</div>
      <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 14px 0; font-weight: 600;">020호 익스프레션 자막 미디어 아트</h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 4px 0;">🎬 1, 2, 3번은 단풍잎/풀잎/눈꽃 마스크이며 4번(Custom Color)은 빗방울 물리 분산 및 바닥 분출 자막 알고리즘이 가동됩니다.</p>
        <p style="margin: 4px 0; color: #ffcc00;">▶️ [하단 오디오 재생] 기능과 100% 실시간 호환 연동 완료!</p>
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw();
  }

  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.guiOverlay) { this.guiOverlay.remove(); this.guiOverlay = null; }
    this.srtTracks = []; this.particles = []; this.textPixels = [];
  }
}
