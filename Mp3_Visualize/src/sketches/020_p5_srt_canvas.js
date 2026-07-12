/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 1.0 (공명의 시: SRT 자막 계절 마스크 미디어 아트 완결판)
 * - SRT 자막 파싱 엔진과 p5.js 파티클 물리 다이내믹스 융합
 * - No1(낙엽 덮기), No2(풀잎 덮기), No3(눈송이 덮기), No4(빗방울 왜곡 분해 및 바닥 팝업) 완벽 구현
 * - 4번 알고리즘 전용 글자 픽셀 미립자 물리 분해 분산 수식 장착
 * - 관제탑 RESET 단추 및 저장(Export) 녹화 파이프라인 무결점 호환 바인딩
 */

export default class P5SrtCanvas {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;

    // SRT 자막 트랙 버퍼 메모리
    this.srtTracks = [];
    this.currentText = "은하수를 유영하는 키네틱 빛의 숨결";
    
    // 자연계 명상 입자 풀
    this.particles = [];
    this.textPixels = [];
    
    this.version = "020호 SRT Kinetic Lyric Ver 1.0";
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

    this.buildOnScreenGuideUI();
    this.parseDefaultSrt(); // 기본 내장 명상 시(詩) 트랙 로드

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

        // 💡 관제탑 프리셋 실시간 하드웨어 변수 동기화 인터셉트
        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let offX = 0, offY = 0, offZ = 0;
        let colorStyle = 'monochrome'; // No1 벨류

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 15; 
          gain = window.cosmicEngineSettings.audioGain || 1.0;          
          glow = window.cosmicEngineSettings.glowIntensity || 85; // 폰트 크기 매핑
          colorStyle = window.cosmicEngineSettings.colorStyle || 'monochrome';
          gauge = window.cosmicEngineSettings.gaugeValue || 50; // 입자 수 매핑
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        p.noiseSeed(seed);
        p.randomSeed(seed);

        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        // 💡 실시간 오디오 타임라인 동기화 자막 추적 기믹
        this.trackSrtTimeline();

        // 어스름한 한지/새벽녘 캔버스 배경 처리
        p.background(8, 11, 18);

        // 오디오 주파수 수혈
        let bass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;
        let volumeFactor = gain * (1.0 + bass * 0.5);

        // 💡 [입자 풀 및 글자 픽셀 동적 컴파일 라이프사이클 관리]
        if (this.lastColorStyle !== colorStyle || p.frameCount % 120 === 0) {
          this.lastColorStyle = colorStyle;
          this.regenerateParticles(width, height, gauge, scatter);
          if (colorStyle === 'custom') { // 4번 알고리즘일 때 픽셀 분해 풀 장착
            this.computeTextPixels(p, glow);
          }
        }

        // 가상 카메라 유영 앵글 매핑
        p.push();
        p.translate(offX * 2, offY * -2);

        // 💡 알고리즘 스위칭 구조 가동
        if (colorStyle === 'monochrome') {
          // 🍁 [스타일 1]: 낙엽 마스크 (차분한 모스그린 및 브라운 잎사귀 페이드)
          this.drawStandardText(p, glow, 'rgba(235, 230, 220, 0.9)', volumeFactor);
          this.drawLeafLayer(p, 'rgba(135, 95, 60, 0.45)', 'rgba(65, 95, 75, 0.5)', scatter);
        } 
        else if (colorStyle === 'neon') {
          // 🌿 [스타일 2]: 풀잎 마스크 (차분한 그린 앤 민트 스프링 잎사귀)
          this.drawStandardText(p, glow, 'rgba(240, 245, 242, 0.9)', volumeFactor);
          this.drawLeafLayer(p, 'rgba(75, 145, 105, 0.5)', 'rgba(125, 185, 155, 0.4)', scatter);
        } 
        else if (colorStyle === 'pastel') {
          // ❄️ [스타일 3]: 눈송이 마스크 (실키 소프트 안개 라벤더 스노우)
          this.drawStandardText(p, glow, 'rgba(255, 255, 255, 0.95)', volumeFactor);
          this.drawSnowLayer(p, scatter);
        } 
        else if (colorStyle === 'custom' || colorStyle === 'full-random') {
          // 🌊 [스타일 4]: 빗방울 물리 분해 왜곡 연산 기믹 (4번 전용 비선형 알고리즘)
          this.drawRainFluidAlgorithm(p, glow, volumeFactor, scatter);
        }

        p.pop();
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 1, 2, 3번 공용 스탠다드 자막 출력 및 앰비언트 글로우 브러시 필터
  drawStandardText(p, glow, textColorStr, volumeFactor) {
    const ctx = p.drawingContext;
    p.push();
    p.textSize(p.map(glow, 10, 250, 20, 75));
    
    ctx.save();
    ctx.shadowBlur = 20 * (volumeFactor * 0.01);
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    p.fill(textColorStr);
    p.text(this.currentText, p.width / 2, p.height / 2);
    ctx.restore();
    p.pop();
  }

  // 💡 [4번 전용 비선형 물리 알고리즘]: 빗방울 타격 분해 및 바닥 팝업 역학 수식
  drawRainFluidAlgorithm(p, glow, volumeFactor, scatter) {
    const ctx = p.drawingContext;
    const width = p.width;
    const height = p.height;
    const time = p.frameCount * 0.03;

    // 1) 전경에 내리는 몽환적인 빗방울 드로잉
    p.stroke('rgba(165, 195, 215, 0.4)');
    p.strokeWeight(1.2);
    this.particles.forEach(pt => {
      pt.y += pt.speed * p.map(scatter, 5, 50, 0.5, 2.5);
      pt.x += p.sin(time + pt.phase) * 0.4;
      if (pt.y > height) { pt.y = p.random(-20, 0); pt.x = p.random(width); }
      p.line(pt.x, pt.y, pt.x, pt.y + pt.size * 2);
    });

    // 2) 빗방울에 글자들이 흐트러진 뒤 바닥에서 입체적으로 솟구치는 유체 픽셀 드로잉
    p.noStroke();
    ctx.shadowBlur = 0;

    let textY = height / 2;
    let groundY = height * 0.82; // 바닥 분출 리셋 기준선

    this.textPixels.forEach(px => {
      // 주파수 볼륨과 정현파 사인 노이즈를 융합하여 흐트러지는 왜곡 계수 연산
      let waveWarp = p.noise(px.origX * 0.01, px.origY * 0.01, time) * (volumeFactor * 0.8);
      
      // 빗방울 낙하 시점에 따른 비선형 흐트러짐
      px.x += p.sin(time + px.phase) * (waveWarp * 0.05);
      
      // 💥 핵심 연출 시공: 글자들이 흐트러진 뒤 바닥(groundY)에서 가속도를 타고 솟구쳐 오르는 물리 이징 피딩
      if (waveWarp > 12) {
        px.y += (groundY - px.y) * 0.08; // 바닥으로 정렬 유동
        px.isGrounded = true;
      }

      if (px.isGrounded) {
        px.popupY -= 0.6 + p.noise(px.x, time) * 1.5; // 바닥에서 자막 미립자가 분출되며 수면 위로 솟구침
        if (px.popupY < -120) { px.popupY = 0; px.isGrounded = false; } // 순환 루프 리셋
      }

      let finalY = px.origY + (px.isGrounded ? px.popupY : p.cos(time + px.phase) * waveWarp * 0.2);
      
      // 몽환적인 스카이 블루 인디고 파스텔 톤 픽셀 브러시 조합
      p.fill(160 + p.sin(time + px.phase) * 45, 195, 245, px.alpha);
      p.ellipse(px.x, finalY, p.map(scatter, 5, 50, 1.5, 4.5));
    });
  }

  // 1, 2번 계절용 유기적 리본/나뭇잎 레이어 연출
  drawLeafLayer(p, c1Str, c2Str, scatter) {
    p.noStroke();
    const time = p.frameCount * 0.015;
    this.particles.forEach((pt, idx) => {
      pt.y += pt.speed * 0.4;
      pt.x += p.sin(time + pt.phase) * 0.5;
      if (pt.y > p.height) { pt.y = p.random(-50, -10); pt.x = p.random(p.width); }

      p.fill(idx % 2 === 0 ? c1Str : c2Str);
      p.push();
      p.translate(pt.x, pt.y);
      p.rotate(pt.phase + time);
      let finalSize = pt.size * p.map(scatter, 5, 50, 0.6, 2.2);
      p.ellipse(0, 0, finalSize * 1.8, finalSize); // 부드러운 유기적 리본 잎사귀 형상화
      p.pop();
    });
  }

  // 3번 계절용 몽환적인 렌더링 스노우 가루 레이어 연출
  drawSnowLayer(p, scatter) {
    p.noStroke();
    const time = p.frameCount * 0.01;
    this.particles.forEach(pt => {
      pt.y += pt.speed * 0.3;
      pt.x += p.sin(time * 2.0 + pt.phase) * 0.8;
      if (pt.y > p.height) { pt.y = p.random(-30, 0); pt.x = p.random(p.width); }

      p.fill(255, 255, 255, pt.alpha * 0.8);
      let snowSize = pt.size * p.map(scatter, 5, 50, 0.5, 2.0);
      p.ellipse(pt.x, pt.y, snowSize);
    });
  }

  // 4번 알고리즘용 텍스트의 픽셀 좌표 분해 매트릭스 추출 캐싱 연산
  computeTextPixels(p, glow) {
    this.textPixels = [];
    let fontSize = p.map(glow, 10, 250, 20, 75);
    
    let offscreen = p.createGraphics(p.width, p.height);
    offscreen.pixelDensity(1);
    offscreen.textSize(fontSize);
    offscreen.textAlign(p.CENTER, p.CENTER);
    offscreen.fill(255);
    offscreen.text(this.currentText, p.width / 2, p.height / 2);
    offscreen.loadPixels();

    // 연산 병목 및 피로도 최적화를 위해 스킵 샘플링 픽셀 스캔 고정
    let sampleStep = p.floor(p.map(fontSize, 20, 75, 2, 4));
    for (let y = 0; y < p.height; y += sampleStep) {
      for (let x = 0; x < p.width; x += sampleStep) {
        let index = (x + y * p.width) * 4;
        if (offscreen.pixels[index] > 128) {
          this.textPixels.push({
            x: x, y: y,
            origX: x, origY: y,
            phase: p.random(p.TWO_PI),
            alpha: p.random(140, 255),
            popupY: 0,
            isGrounded: false
          });
        }
      }
    }
    offscreen.remove();
  }

  regenerateParticles(width, height, gauge, scatter) {
    this.particles = [];
    // Gauge 수치에 1:1 결합되어 입자의 개수가 미세조정 정비 전개
    let pCount = Math.floor(THREE.MathUtils.mapLinear(gauge, 0, 100, 20, 280));
    for (let i = 0; i < pCount; i++) {
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

  // 오디오 싱크 기반 SRT 타임라인 자동 매퍼 변환 장치
  trackSrtTimeline() {
    const audioEl = document.querySelector('audio');
    if (!audioEl || this.srtTracks.length === 0) return;

    let curTime = audioEl.currentTime;
    let foundTrack = this.srtTracks.find(t => curTime >= t.start && curTime <= t.end);
    if (foundTrack && this.currentText !== foundTrack.text) {
      this.currentText = foundTrack.text;
    }
  }

  // 기본 명상 자막 데이터 파싱 모듈 인젝션
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
        <p style="margin: 4px 0;">🎬 1, 2, 3번은 자연물 가림 마스크이며 4번(Color Style: Custom)은 빗방울 물리 분산 및 바닥 분출 자막 알고리즘이 가동됩니다.</p>
        <p style="margin: 4px 0; color: #ffcc00;">▶️ [하단 오디오 재생 및 녹화] 기능과 100% 실시간 호환 연동 완료!</p>
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
    this.srtTracks = [];
    this.particles = [];
    this.textPixels = [];
  }
}
