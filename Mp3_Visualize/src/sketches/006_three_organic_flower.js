/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.4 (3중 커스텀 컬러 피커 연동 및 발광크기 ➡️ 꽃잎 중앙부 거리 확장 제어판)
 * - Custom Color 모드 시 [가스1: 꽃잎면, 가스2: 꽃잎테두리, 대형별: 중앙꽃술] 3축 피커 독립 바인딩 완벽 처리
 * - 발광/크기(ui.glow) 슬라이더 조작 시 꽃잎의 두께뿐만 아니라, 중앙부 핵과의 거리(Distance Offset)까지 연동 확장
 * - 로딩 시 HTML DOM 사용 설명 가이드창 고정 및 재생 시 자동 페이드아웃 표준 규격 유지
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; 
    
    this.version = "006호 Organic Flower Engine Ver 3.4";
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
        <p style="margin: 6px 0;">✨ <strong style="color: #ff6699;">[발광 크기]</strong> 슬라이더를 높이면 꽃잎 두께와 함께 중앙부 핵과의 거리도 멀어져 시원하게 확장됩니다.</p>
        <p style="margin: 6px 0;">🎨 <strong style="color: #ffffff;">[3중 컬러 피커]</strong> Custom Color 선택 시 하단의 가스1(잎사귀), 가스2(잎테두리), 대형별(꽃술) 피커 색상이 100% 동기화됩니다.</p>
        <p style="margin: 6px 0;">💥 <strong style="color: #ffffff;">[꽃잎 개수]</strong> 하단 폭발력 슬라이더를 통해 꽃잎의 총 밀도 개수를 실시간 제어하세요.</p>
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
        colorShift: p5.prototype.random(-25, 25)
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

      // 💡 [개조 피드백 적용] 가스1, 가스2, 대형별 3대 매트릭스 피커 엘리먼트 순차적 전수 검출
      const p1 = document.getElementById('picker-cosmic-color1') || document.getElementById('color1') || document.querySelector('.color-pickers input:nth-of-type(1)');
      const p2 = document.getElementById('picker-cosmic-color2') || document.getElementById('color2') || document.querySelector('.color-pickers input:nth-of-type(2)');
      const p3 = document.getElementById('picker-cosmic-color3') || document.getElementById('color3') || document.querySelector('.color-pickers input:nth-of-type(3)');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          
          // 가스1, 가스2, 대형별 전용 Hex 덤프 수집 및 예외 대비 기본값 수혈
          gas1Hex: (p1 && p1.value) ? p1.value : '#5a4a1a',
          gas2Hex: (p2 && p2.value) ? p2.value : '#e2ecea',
          starHex: (p3 && p3.value) ? p3.value : '#d1e61c'
      };
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  drawPetalShape(p, baseLength, thickness, type) {
    p.beginShape();
    if (type === 'sharp-ellipse') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.6, -baseLength * 0.4, -thickness * 0.6, -baseLength * 0.8, 0, -baseLength);
      p.bezierVertex(thickness * 0.6, -baseLength * 0.8, thickness * 0.6, -baseLength * 0.4, 0, 0);
    } 
    else if (type === 'ellipse') {
      p.ellipseMode(p.CENTER);
      p.ellipse(0, -baseLength * 0.5, thickness * 1.2, baseLength);
    } 
    else if (type === 'heart') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 1.4, -baseLength * 0.25, -thickness * 1.2, -baseLength * 0.85, 0, -baseLength * 0.95);
      p.bezierVertex(thickness * 1.2, -baseLength * 0.85, thickness * 1.4, -baseLength * 0.25, 0, 0);
    } 
    else if (type === 'narrow') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.25, -baseLength * 0.5, -thickness * 0.25, -baseLength * 0.9, 0, -baseLength);
      p.bezierVertex(thickness * 0.25, -baseLength * 0.9, thickness * 0.25, -baseLength * 0.5, 0, 0);
    } 
    else {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.1, -baseLength * 0.2, -thickness * 1.3, -baseLength * 0.7, 0, -baseLength);
      p.bezierVertex(thickness * 1.3, -baseLength * 0.7, thickness * 0.1, -baseLength * 0.2, 0, 0);
    }
    p.endShape(p.CLOSE);
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
    let bass = audioData ? (audioData.raw ? audioData.raw[2]/255 : vol) : vol;
    let treble = audioData ? (audioData.raw ? audioData.raw[60]/255 : vol) : vol;

    vol *= ui.burst;
    bass *= ui.burst;
    treble *= ui.burst;

    this.petalCount = Math.floor(p.map(ui.burst, 1.0, 5.0, 8, 45));

    let cx = p.width / 2;
    let cy = p.height / 2;

    // 전체 스케일 제어
    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2) * (1.0 + bass * 0.12);
    
    // 슬라이더 기반 물리 매핑 설계
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85) * (1.0 + treble * 0.18);
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.22);

    // 💡 [기획 의도 구현] 발광크기(ui.glow)에 비례하여 꽃잎과 중앙점 사이의 이격 거리(Distance Shift)를 밀어냅니다.
    let centralOffsetDistance = p.map(ui.glow, 10, 150, 0, 55);

    // 🌸 1단계: 꽃잎 렌더링
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    p.rotate(this.time * 0.12 + vol * 0.15);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0 };
      
      p.push();
      p.rotate(i * angleStep);

      let sway = Math.sin(this.time * 2.5 + i) * 0.02 * (1.0 + treble);
      p.rotate(sway);

      // 💡 [이격 거리 연동] 잎사귀 드로잉 시작 전, 연산된 변위만큼 Y축 마이너스 방향(바깥)으로 좌표계를 평행 이동시킵니다.
      p.translate(0, -centralOffsetDistance);

      let baseLength = 110; 
      let hueVal = 15; let satVal = 80; let briVal = 95;
      let strokeHue = 30; let strokeSat = 90; let strokeAlpha = 200;
      let fillAlpha = 160 + vol * 70;

      // 💡 [3중 멀티 컬러 피커 파이프라인 정밀 주입 연동 완료]
      if (ui.style.includes('neon')) {
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 30)) % 360; 
        satVal = 90;
        strokeHue = (hueVal + 15) % 360;
      } 
      else if (ui.style.includes('pastel')) {
        hueVal = this.pastelThemeHue; 
        satVal = 45; 
        briVal = 93;
        strokeHue = hueVal;
        strokeSat = 65;
      } 
      else if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
        // 💡 1. [가스 1] 피커 복조 ➡️ 꽃잎 면 전면 바인딩
        let c1 = p.color(ui.gas1Hex);
        hueVal = p.hue(c1); satVal = p.saturation(c1); briVal = p.brightness(c1);
        
        // 💡 2. [가스 2] 피커 복조 ➡️ 꽃잎 테두리 선 단독 바인딩
        let c2 = p.color(ui.gas2Hex);
        strokeHue = p.hue(c2); strokeSat = p.saturation(c2);
      } 
      else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        hueVal = (p.sin(this.time * 0.5 + i * 0.1) * 180 + 180) % 360;
        satVal = 85;
        briVal = 98;
        strokeHue = (hueVal + 180) % 360; 
      } 
      else {
        hueVal = (seedInfo.colorShift * 15 + i * 20) % 360;
        satVal = 90;
        briVal = 95;
        fillAlpha = 15; 
        strokeHue = hueVal;
        strokeSat = 95;
        strokeAlpha = 240; 
      }

      p.fill(hueVal, satVal, briVal, fillAlpha);
      p.stroke(strokeHue, strokeSat, briVal - 10, strokeAlpha);
      p.strokeWeight(ui.style.includes('full-random') ? 2.5 : 1.2); 

      this.drawPetalShape(p, baseLength, petalThickness, this.flowerShapeType);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 중앙 원형 꽃술 코어 드로잉
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    p.noStroke();
    let coreHue = 45; 
    let coreSat = 85;
    let coreBri = 98;

    if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
      // 💡 3. [대형 별] 피커 복조 ➡️ 중앙 원형 꽃술 코어에 단독 주입
      let c3 = p.color(ui.starHex);
      coreHue = p.hue(c3); coreSat = p.saturation(c3); coreBri = p.brightness(c3);
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
