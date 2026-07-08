/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.6 (3번 스타일 ➡️ 자연계 꽃잎 질감 리얼 그라데이션 엔진 오버홀 완결판)
 * - 3번 스타일 선택 시 꽃술 쪽(어두운 원색)부터 바깥 끝쪽(밝고 화사한 원색)으로 부드럽게 퍼지는 입체적 그라데이션 구현
 * - 저음/중음/고음 3축 파장 분할 및 베지에 끝부분(Tip) 흐느적 살랑임 물리 파이프라인 유지
 * - HTML 가이드 패널 및 특수문자 파일명 우회 BG/Texture 이미지 배경 합성 규격 유지
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; 
    
    this.version = "006호 Organic Flower Engine Ver 3.6";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 꽃 형태학 가변 제어 구조체
    this.flowerShapeType = 'teardrop'; 
    this.petalCount = 16; 
    this.petalNoiseSeeds = [];

    // 2번 스타일(단일 파스텔 랜덤) 전용 고정 컬러 저장소
    this.pastelThemeHue = 45;

    // 배경 이미지 트래커 속성
    this.bgImageElement = null;
    this.lastBgSrc = "";
    this.domObserver = null;
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    Object.assign(this.guiOverlay.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '85%',
      maxWidth: '420px',
      backgroundColor: 'rgba(10, 12, 18, 0.93)',
      border: '1px solid rgba(255, 102, 153, 0.6)', 
      borderRadius: '12px',
      padding: '22px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '20',
      boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
      boxSizing: 'border-box',
      textAlign: 'center',
      pointerEvents: 'none', 
      transition: 'opacity 0.45s cubic-bezier(0.25, 1, 0.5, 1)' 
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #ff6699; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        ⚙️ STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">
        006호 오가닉 플라워 사용 방법
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🌸 <strong style="color: #ff6699;">[3번 그라데이션]</strong> Custom 선택 시 꽃잎 안쪽(어두운 원색)에서 바깥쪽(밝은 원색)으로 리얼하게 뻗어 나갑니다.</p>
        <p style="margin: 6px 0;">🌬️ <strong style="color: #ffffff;">[흐느적 살랑임]</strong> 꽃잎 기둥은 고정된 채 끝자락만 유연한 베지에 곡선 기류를 타고 흐느적거립니다.</p>
        <p style="margin: 6px 0;">🎹 <strong style="color: #ffffff;">[파장 분할]</strong> 저음은 꽃술 코어, 중음은 홀수 잎사귀, 고음은 짝수 잎사귀를 따로 분리 제어합니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 페이드아웃 되며 영상이 시작됩니다!</p>
      </div>
      <div style="color: #777777; font-size: 10.5px; margin-top: 16px; border-top: 1px solid #222530; padding-top: 10px;">
        음악이 정지되면 안내 설명창이 다시 활성화됩니다.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('left', '0px');
        canvas.style('top', '0px');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 255);
        
        const ui = this.getUIParams();
        this.updateFlowerShapeBySeed(ui.seed);
        this.setupDirectInputTracker(p);
        p.noLoop();
      };

      p.draw = () => {
        if (this.bgImageElement && this.bgImageElement.width > 2) {
          p.image(this.bgImageElement, 0, 0, p.width, p.height);
        } else {
          p.background(220, 35, 8, 255);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  updateFlowerShapeBySeed(seedValue) {
    if (seedValue <= 20) this.flowerShapeType = 'sharp-ellipse';
    else if (seedValue <= 40) this.flowerShapeType = 'ellipse';       
    else if (seedValue <= 60) this.flowerShapeType = 'heart';         
    else if (seedValue <= 80) this.flowerShapeType = 'teardrop';      
    else this.flowerShapeType = 'narrow';        

    p5.prototype.randomSeed(seedValue * 7); 
    this.pastelThemeHue = Math.floor(p5.prototype.random(360));

    this.petalNoiseSeeds = [];
    for (let i = 0; i < 60; i++) {
      this.petalNoiseSeeds.push({
        angleOffset: 0, 
        lengthScale: 1.0, 
        colorShift: p5.prototype.random(-25, 25),
        swayPhase: p5.prototype.random(p5.prototype.TWO_PI),
        individualHue: Math.floor(p5.prototype.random(360)) // 3번 모드용 개별 랜덤 원색 허브 시드
      });
    }
  }

  setupDirectInputTracker(p) {
    const findAndBindImage = () => {
      const allImgs = document.querySelectorAll('img');
      let targetImg = null;
      for (let img of allImgs) {
        if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview'))) {
          targetImg = img;
          break;
        }
      }
      if (targetImg && targetImg.src && targetImg.src !== this.lastBgSrc) {
        this.lastBgSrc = targetImg.src;
        p.loadImage(targetImg.src, (loadedImg) => {
          this.bgImageElement = loadedImg;
          p.redraw();
        });
      }
    };
    this.domObserver = new MutationObserver(() => { findAndBindImage(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setTimeout(findAndBindImage, 500);
  }

  getUIParams() {
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      const p1 = document.getElementById('picker-cosmic-color1') || document.getElementById('color1') || document.querySelector('.color-pickers input:nth-of-type(1)');
      const p2 = document.getElementById('picker-cosmic-color2') || document.getElementById('color2') || document.querySelector('.color-pickers input:nth-of-type(2)');
      const p3 = document.getElementById('picker-cosmic-color3') || document.getElementById('color3') || document.querySelector('.color-pickers input:nth-of-type(3)');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          
          gas1Hex: (p1 && p1.value) ? p1.value : '#5a4a1a',
          gas2Hex: (p2 && p2.value) ? p2.value : '#e2ecea',
          starHex: (p3 && p3.value) ? p3.value : '#d1e61c'
      };
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  // 💡 [그라데이션 연산 적용 패스 엔진] 
  // 내부 면 채우기(fill) 단계를 세밀한 비율(pct)로 슬라이싱 루프 처리하여 진짜 꽃잎 그라데이션 질감을 구현합니다.
  drawFlexiblePetalShape(p, baseLength, thickness, type, bendForce, useNaturalGradient, gradHue, fillAlpha) {
    
    let tipX = bendForce * (baseLength * 0.35);

    // 💡 3번 모드 전용 리얼 내추럴 그라데이션 다층 스캔 렌더링
    if (useNaturalGradient) {
      p.noStroke();
      // 10단계 쉐이딩 슬라이스 루프로 안쪽(어둡고 진함) -> 바깥쪽(밝고 화사함) 그라데이션 구현
      let steps = 12;
      for (let s = 0; s < steps; s++) {
        let pct = s / (steps - 1);
        
        // 💡 [핵심 수식] 안쪽은 채도 높고 명도 낮은 어두운 원색 ➡️ 바깥 끝은 명도 높고 화사한 투명 원색으로 보간
        let currentSat = p.map(pct, 0.0, 1.0, 95, 75);
        let currentBri = p.map(pct, 0.0, 1.0, 50, 98); // 50(어두움)에서 시작해 98(매우 밝음)로 도달
        let currentAlpha = p.map(pct, 0.0, 1.0, fillAlpha, fillAlpha * 0.45);
        
        p.fill(gradHue, currentSat, currentBri, currentAlpha);

        // 현재 비율 단계에 맞는 길이와 두께 상자 축소 연산
        let currentLen = baseLength * pct;
        let currentThick = thickness * p.lerp(0.2, 1.0, p.sin(pct * p.HALF_PI));

        p.beginShape();
        if (type === 'sharp-ellipse') {
          p.vertex(0, 0);
          p.bezierVertex(-currentThick * 0.6, -currentLen * 0.4, -currentThick * 0.6 + tipX * pct * 0.5, -currentLen * 0.8, tipX * pct, -currentLen);
          p.bezierVertex(currentThick * 0.6 + tipX * pct * 0.5, -currentLen * 0.8, currentThick * 0.6, -currentLen * 0.4, 0, 0);
        } 
        else if (type === 'ellipse') {
          p.vertex(0, 0);
          p.bezierVertex(-currentThick * 0.65, -currentLen * 0.25, -currentThick * 0.65 + tipX * pct, -currentLen * 0.75, tipX * pct, -currentLen);
          p.bezierVertex(currentThick * 0.65 + tipX * pct, -currentLen * 0.75, currentThick * 0.65, -currentLen * 0.25, 0, 0);
        } 
        else if (type === 'heart') {
          p.vertex(0, 0);
          p.bezierVertex(-currentThick * 1.4, -currentLen * 0.25, -currentThick * 1.2 + tipX * pct * 0.4, -currentLen * 0.85, tipX * pct, -currentLen * 0.95);
          p.bezierVertex(currentThick * 1.2 + tipX * pct * 0.4, -currentLen * 0.85, currentThick * 1.4, -currentLen * 0.25, 0, 0);
        } 
        else if (type === 'narrow') {
          p.vertex(0, 0);
          p.bezierVertex(-currentThick * 0.25, -currentLen * 0.5, -currentThick * 0.25 + tipX * pct * 0.7, -currentLen * 0.9, tipX * pct, -currentLen);
          p.bezierVertex(currentThick * 0.25 + tipX * pct * 0.7, -currentLen * 0.9, currentThick * 0.25, -currentLen * 0.5, 0, 0);
        } 
        else { // teardrop
          p.vertex(0, 0);
          p.bezierVertex(-currentThick * 0.1, -currentLen * 0.2, -currentThick * 1.3 + tipX * pct, -currentLen * 0.7, tipX * pct, -currentLen);
          p.bezierVertex(currentThick * 1.3 + tipX * pct, -currentLen * 0.7, currentThick * 0.1, -currentLen * 0.2, 0, 0);
        }
        p.endShape(p.CLOSE);
      }
    } else {
      // 일반 단색 테마 모드 드로잉 패스
      p.beginShape();
      if (type === 'sharp-ellipse') {
        p.vertex(0, 0);
        p.bezierVertex(-thickness * 0.6, -baseLength * 0.4, -thickness * 0.6 + tipX * 0.5, -baseLength * 0.8, tipX, -baseLength);
        p.bezierVertex(thickness * 0.6 + tipX * 0.5, -baseLength * 0.8, thickness * 0.6, -baseLength * 0.4, 0, 0);
      } 
      else if (type === 'ellipse') {
        p.vertex(0, 0);
        p.bezierVertex(-thickness * 0.65, -baseLength * 0.25, -thickness * 0.65 + tipX, -baseLength * 0.75, tipX, -baseLength);
        p.bezierVertex(thickness * 0.65 + tipX, -baseLength * 0.75, thickness * 0.65, -baseLength * 0.25, 0, 0);
      } 
      else if (type === 'heart') {
        p.vertex(0, 0);
        p.bezierVertex(-thickness * 1.4, -baseLength * 0.25, -thickness * 1.2 + tipX * 0.4, -baseLength * 0.85, tipX, -baseLength * 0.95);
        p.bezierVertex(thickness * 1.2 + tipX * 0.4, -baseLength * 0.85, thickness * 1.4, -baseLength * 0.25, 0, 0);
      } 
      else if (type === 'narrow') {
        p.vertex(0, 0);
        p.bezierVertex(-thickness * 0.25, -baseLength * 0.5, -thickness * 0.25 + tipX * 0.7, -baseLength * 0.9, tipX, -baseLength);
        p.bezierVertex(thickness * 0.25 + tipX * 0.7, -baseLength * 0.9, thickness * 0.25, -baseLength * 0.5, 0, 0);
      } 
      else {
        p.vertex(0, 0);
        p.bezierVertex(-thickness * 0.1, -baseLength * 0.2, -thickness * 1.3 + tipX, -baseLength * 0.7, tipX, -baseLength);
        p.bezierVertex(thickness * 1.3 + tipX, -baseLength * 0.7, thickness * 0.1, -baseLength * 0.2, 0, 0);
      }
      p.endShape(p.CLOSE);
    }
  }

  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '0'; 
    } else {
        this.isAudioActive = false;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '1'; 
        p.redraw();
        return;
    }

    if (this.bgImageElement && this.bgImageElement.width > 2) {
      p.image(this.bgImageElement, 0, 0, p.width, p.height);
    } else {
      p.background(220, 35, 8, 255);
    }

    const ui = this.getUIParams();
    this.time = p.millis() * 0.001;

    let currentSettingsStr = `${ui.seed}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.updateFlowerShapeBySeed(ui.seed);
    }

    let vol = audioData ? audioData.vol : p.noise(this.time) * 0.3;
    let bass = audioData ? (audioData.raw ? (audioData.raw[1] + audioData.raw[2] + audioData.raw[3])/765 : vol) : vol;
    let mid = audioData ? (audioData.raw ? (audioData.raw[15] + audioData.raw[16] + audioData.raw[17])/765 : vol) : vol;
    let treble = audioData ? (audioData.raw ? (audioData.raw[50] + audioData.raw[52] + audioData.raw[55])/765 : vol) : vol;

    vol *= ui.burst;
    bass *= ui.burst;
    mid *= ui.burst;
    treble *= ui.burst;

    this.petalCount = Math.floor(p.map(ui.burst, 1.0, 5.0, 8, 45));

    let cx = p.width / 2;
    let cy = p.height / 2;

    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2);
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85);
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.3);

    let centralOffsetDistance = p.map(ui.glow, 10, 150, 0, 55);

    // 🌸 1단계: 유기적 꽃잎 렌더 루프
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    p.rotate(this.time * 0.08 + mid * 0.06);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0, swayPhase: 0, individualHue: 0 };
      
      p.push();
      p.rotate(i * angleStep);

      let bendForce = 0;
      if (i % 2 === 0) {
        let windSway = Math.sin(this.time * 4.0 + seedInfo.swayPhase) * 0.18;
        bendForce = windSway + (treble * 0.45);
      } else {
        let windSway = Math.cos(this.time * 3.2 + seedInfo.swayPhase) * 0.18;
        bendForce = windSway + (mid * 0.42);
      }

      p.translate(0, -centralOffsetDistance);

      let baseLength = 110; 
      let hueVal = 15; let satVal = 80; let briVal = 95;
      let strokeHue = 30; let strokeSat = 90; let strokeAlpha = 200;
      let fillAlpha = 160 + vol * 70;
      
      let useNaturalGradient = false;

      if (ui.style.includes('neon')) {
        // 1️⃣ 스타일: 지금 색 유지
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 30)) % 360; 
        satVal = 90;
        strokeHue = (hueVal + 15) % 360;
      } 
      else if (ui.style.includes('pastel')) {
        // 2️⃣ 스타일: 모든 꽃잎 동일 파스텔 톤 랜덤 부여
        hueVal = this.pastelThemeHue; 
        satVal = 45; briVal = 93;
        strokeHue = hueVal; strokeSat = 65;
      } 
      else if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
        // 3️⃣ 스타일: [오버홀 완료] 꽃술 쪽부터 바깥쪽으로 무작위 원색 리얼 그라데이션 엔진 가동!
        useNaturalGradient = true;
        // 지형변경 시 정해진 개별 고유 원색 허브 주입
        hueVal = (seedInfo.individualHue + (i * 10)) % 360; 
      } 
      else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        // 4️⃣ 스타일: 지속 가변 그라데이션
        hueVal = (p.sin(this.time * 0.4 + i * 0.1) * 180 + 180) % 360;
        satVal = 85; briVal = 98;
        strokeHue = (hueVal + 180) % 360; 
      } 
      else {
        // 5️⃣ 스타일: 테두리만 색 랜덤
        hueVal = (seedInfo.colorShift * 15 + i * 20) % 360;
        satVal = 90; briVal = 95;
        fillAlpha = 15; 
        strokeHue = hueVal; strokeSat = 95; strokeAlpha = 240; 
      }

      // 그라데이션 모드가 아닐 때만 표준 단색 처리 적용
      if (!useNaturalGradient) {
        p.fill(hueVal, satVal, briVal, fillAlpha);
        p.stroke(strokeHue, strokeSat, briVal - 10, strokeAlpha);
        p.strokeWeight(ui.style.includes('full-random') ? 2.5 : 1.2); 
      } else {
        // 그라데이션 모드일 때 테두리 라인을 한층 부드럽게 마감
        p.stroke(hueVal, 95, 40, strokeAlpha * 0.3);
        p.strokeWeight(0.5);
      }

      // 제너레이티브 패스 드로잉 가동
      this.drawFlexiblePetalShape(p, baseLength, petalThickness, this.flowerShapeType, bendForce, useNaturalGradient, hueVal, fillAlpha);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 중앙 원형 꽃술 코어 드로잉
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    p.noStroke();
    let coreHue = 45; let coreSat = 85; let coreBri = 98;

    if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
      // 그라데이션 테마에 맞춰 꽃술도 유기적인 고유 원색 매칭
      coreHue = (this.pastelThemeHue + 120) % 360;
    } else if (ui.style.includes('full-random')) {
      coreHue = (this.time * 30) % 360;
    }

    for(let r = 3; r > 0; r--) {
      p.fill(coreHue, coreSat, coreBri, 45 / r);
      p.circle(0, 0, pistilCenterSize + (r * 12));
    }
    
    p.stroke(0, 0, 100, 180);
    p.strokeWeight(1.5);
    p.fill(coreHue, coreSat, coreBri, 255); 
    p.circle(0, 0, pistilCenterSize);

    p.noStroke();
    p.fill((coreHue + 30) % 360, Math.min(100, coreSat + 10), Math.max(0, coreBri - 10), 200);
    for(let a = 0; a < p.TWO_PI; a += p.PI/4) {
       let rx = Math.cos(a) * (pistilCenterSize * 0.25);
       let ry = Math.sin(a) * (pistilCenterSize * 0.25);
       p.circle(rx, ry, 3.5);
    }
    p.pop();
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    if (this.guiOverlay) this.guiOverlay.remove();
    if (this.domObserver) this.domObserver.disconnect();
  }
}
