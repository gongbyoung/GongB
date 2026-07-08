/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.3 (폭발력 슬라이더 ➡️ 꽃잎 개수 실시간 제어 스케일 연동 완료)
 * - 하단 폭발력(Audio Motion Master) 조작 시 꽃잎 개수가 6개에서 45개까지 조밀하게 실시간 가변 제어
 * - Color Style 5대 스펙트럼 (1:기존색, 2:모든잎 동일 파스텔랜덤, 3:커스텀지정, 4:지속가변 그라데이션, 5:테두리만 랜덤) 완벽 구현
 * - HTML 가이드 패널 및 특수문자 파일명 우회 BG/Texture 이미지 배경 합성 파이프라인 유지
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; 
    
    this.version = "006호 Organic Flower Engine Ver 3.3";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 꽃 형태학 가변 제어 구조체
    this.flowerShapeType = 'teardrop'; 
    this.petalCount = 16; 
    this.petalNoiseSeeds = [];

    // 💡 2번 스타일(단일 파스텔 랜덤) 전용 고정 컬러 저장소
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
        <p style="margin: 6px 0;">💥 <strong style="color: #ff6699;">[꽃잎 개수]</strong> 하단 폭발력 슬라이더를 밀면 꽃잎의 총 개수가 실시간으로 증감 제어됩니다.</p>
        <p style="margin: 6px 0;">🌱 <strong style="color: #ffffff;">[지형 변경]</strong> 슬라이더 이동 구간별로 꽃잎 모양 5단계 패스가 직관적으로 스위칭됩니다.</p>
        <p style="margin: 6px 0;">🎨 <strong style="color: #ffffff;">[스타일 파레트]</strong> 단일 파스텔, 커스텀 지정 피커, 지속 가변 그라데이션, 테두리 라인 아트를 골라보세요.</p>
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
    
    // 💡 2번 스타일용 테마 파스텔 색상 시드 믹싱 고정
    this.pastelThemeHue = Math.floor(p5.prototype.random(360));

    this.petalNoiseSeeds = [];
    // 미리 여유롭게 60개 분량의 무작위 컬러 편차 레이어 생성
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

      // 💡 메인 돔의 커스텀 컬러 패널 데이터 검출 장치 안전 바인딩
      const customPicker1 = document.getElementById('picker-cosmic-color1') || document.getElementById('color1');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          customHex: customPicker1 ? customPicker1.value : '#00ffcc'
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

    // 💡 [개조 통합] 하단 폭발력(ui.burst) 슬라이더 수치를 꽃잎의 실시간 개수 제어로 다이렉트 매핑 링크!
    // 수치가 최하(1.0)이면 8개 조각, 최대(5.0)로 밀면 42개 조각으로 밀도가 격렬하게 증감 제어됩니다.
    this.petalCount = Math.floor(p.map(ui.burst, 1.0, 5.0, 8, 45));

    let cx = p.width / 2;
    let cy = p.height / 2;

    // 전체 레이아웃 크기 제어 (분산범위 사용)
    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2) * (1.0 + bass * 0.12);
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85) * (1.0 + treble * 0.18);
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.22);

    // 🌸 1단계: 5대 가변 꽃잎 루프 가동
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

      let baseLength = 110; 
      
      // 색상 제어 셋업 변수
      let hueVal = 15; let satVal = 80; let briVal = 95;
      let strokeHue = 30; let strokeSat = 90; let strokeAlpha = 200;
      let fillAlpha = 160 + vol * 70;

      // 💡 [회원님 기획안 기반 5대 컬러 파레트 대개조]
      if (ui.style.includes('neon')) {
        // 1️⃣ 스타일: 지금 색 유지 (화사한 네온 그라데이션)
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 30)) % 360; 
        satVal = 90;
        strokeHue = (hueVal + 15) % 360;
      } 
      else if (ui.style.includes('pastel')) {
        // 2️⃣ 스타일: 파스텔톤으로 모든 꽃잎 동일하게 랜덤 부여 (지형변경 동기화)
        hueVal = this.pastelThemeHue; 
        satVal = 45; // 부드러운 파스텔 농도 고정
        briVal = 93;
        strokeHue = hueVal;
        strokeSat = 65;
      } 
      else if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
        // 3️⃣ 스타일: Custom Color 지정 피커 동적 디코딩 샘플링
        let c = p.color(ui.customHex);
        hueVal = p.hue(c);
        satVal = p.saturation(c);
        briVal = p.brightness(c);
        strokeHue = (hueVal + 20) % 360;
      } 
      else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        // 4️⃣ 스타일: 지속 가변 그라데이션으로 흐르며 절대 중복되지 않게 랜덤 변경
        hueVal = (p.sin(this.time * 0.5 + i * 0.1) * 180 + 180) % 360;
        satVal = 85;
        briVal = 98;
        strokeHue = (hueVal + 180) % 360; // 보색 스트로크 반짝임
      } 
      else {
        // 5️⃣ 스타일: 테두리만 색 랜덤 (Border 라인 아트 팩)
        hueVal = (seedInfo.colorShift * 15 + i * 20) % 360;
        satVal = 90;
        briVal = 95;
        
        fillAlpha = 15; // 💡 면 색상은 투명하게 강제 다운
        strokeHue = hueVal;
        strokeSat = 95;
        strokeAlpha = 240; // 테두리 선만 강력 강조
      }

      p.fill(hueVal, satVal, briVal, fillAlpha);
      p.stroke(strokeHue, strokeSat, briVal - 10, strokeAlpha);
      p.strokeWeight(ui.style.includes('full-random') ? 2.5 : 1.2); // 테두리 모드일 때 선을 조금 더 에지있게 두껍게 처리

      this.drawPetalShape(p, baseLength, petalThickness, this.flowerShapeType);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 중앙 원형 꽃술 코어 드로잉
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    p.noStroke();
    let coreHue = 45; // 골드 옐로우 기본값
    if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
      let c = p.color(ui.customHex);
      coreHue = (p.hue(c) + 180) % 360; // 커스텀 모드일 땐 세련된 보색 코어 셋업
    } else if (ui.style.includes('full-random')) {
      coreHue = (this.time * 30) % 360;
    }

    for(let r = 3; r > 0; r--) {
      p.fill(coreHue, 90, 100, 45 / r);
      p.circle(0, 0, pistilCenterSize + (r * 12));
    }
    
    p.stroke(0, 0, 100, 180);
    p.strokeWeight(1.5);
    p.fill(coreHue, 85, 98, 255); 
    p.circle(0, 0, pistilCenterSize);

    p.noStroke();
    p.fill((coreHue + 30) % 360, 95, 90, 200);
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
