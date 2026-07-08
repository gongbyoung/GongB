/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.5 (꽃잎 2파장 독립 주파수 분할 및 베지에 끝부분 흐느적 살랑임 엔진 완결판)
 * - 저음(Bass) ➡️ 중앙 꽃술, 중음(Mid) ➡️ 홀수 꽃잎 1세트, 고음(Treble) ➡️ 짝수 꽃잎 2세트 교차 분리 매핑 완료
 * - 단순 크기 진동을 전면 금지하고, 꽃잎 기둥은 고정된 채 끝부분(Tip)만 시간에 따라 좌우로 흐느적 곡선 변형
 * - 3중 커스텀 컬러 피커, 발광크기(Glow) 기반 중앙부 이격 거리 확장 및 HTML 가이드 페이드아웃 규격 유지
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; 
    
    this.version = "006호 Organic Flower Engine Ver 3.5";
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
        <p style="margin: 6px 0;">🌬️ <strong style="color: #ff6699;">[흐느적 살랑임]</strong> 진동이 아니라 바람 기류를 타고 꽃잎의 끝부분만 유연하게 휘어지는 물리 공식이 작동합니다.</p>
        <p style="margin: 6px 0;">🎹 <strong style="color: #ffffff;">[3축 파장 분할]</strong> 저음은 꽃술 코어를, 중음은 홀수 잎사귀를, 고음은 짝수 잎사귀를 따로 교차 제어합니다.</p>
        <p style="margin: 6px 0;">✨ <strong style="color: #ffffff;">[발광 크기]</strong> 꽃잎 두께와 함께 중앙 격리 거리가 멀어지며 광활하게 만개합니다.</p>
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
        swayPhase: p5.prototype.random(p5.prototype.TWO_PI) // 잎사귀마다 불규칙한 살랑임 위상 분산 시드
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

  // 💡 [흐느적 물리 핵심 공식 이식] 
  // 기둥 시작부는 고정하고, 오디오 파장 세기(bendForce)를 받아 베지에 제어점과 최외곽 끝 정점(Tip)만 유기적으로 휘어지게 그리는 구조
  drawFlexiblePetalShape(p, baseLength, thickness, type, bendForce) {
    p.beginShape();
    
    // 좌우로 유연하게 흐느적거리는 팁 정점 오프셋 연산
    let tipX = bendForce * (baseLength * 0.35);

    if (type === 'sharp-ellipse') {
      p.vertex(0, 0);
      // 베지에 곡선의 중간 및 끝 핸들을 변형해 낭창낭창하게 휘어지는 선을 만듭니다.
      p.bezierVertex(-thickness * 0.6, -baseLength * 0.4, -thickness * 0.6 + tipX * 0.5, -baseLength * 0.8, tipX, -baseLength);
      p.bezierVertex(thickness * 0.6 + tipX * 0.5, -baseLength * 0.8, thickness * 0.6, -baseLength * 0.4, 0, 0);
    } 
    else if (type === 'ellipse') {
      // 일반 에클립스도 유연한 뼈대 처리를 위해 베지에 외곽 패스로 리빌딩 수혈 완료
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
      // teardrop 눈물방울형 흐느적 오버홀
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.1, -baseLength * 0.2, -thickness * 1.3 + tipX, -baseLength * 0.7, tipX, -baseLength);
      p.bezierVertex(thickness * 1.3 + tipX, -baseLength * 0.7, thickness * 0.1, -baseLength * 0.2, 0, 0);
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

    // 💡 [오가닉 기류 칼분할] 오디오 FFT 채널 분석 고속 분리 가동
    let vol = audioData ? audioData.vol : p.noise(this.time) * 0.3;
    let bass = audioData ? (audioData.raw ? (audioData.raw[1] + audioData.raw[2] + audioData.raw[3])/765 : vol) : vol;
    let mid = audioData ? (audioData.raw ? (audioData.raw[15] + audioData.raw[16] + audioData.raw[17])/765 : vol) : vol;
    let treble = audioData ? (audioData.raw ? (audioData.raw[50] + audioData.raw[52] + audioData.raw[55])/765 : vol) : vol;

    // 감도 배율 주입
    vol *= ui.burst;
    bass *= ui.burst;
    mid *= ui.burst;
    treble *= ui.burst;

    // 하단 슬라이더 연동 실시간 개수 가변 마스터 채널
    this.petalCount = Math.floor(p.map(ui.burst, 1.0, 5.0, 8, 45));

    let cx = p.width / 2;
    let cy = p.height / 2;

    // 분산범위 슬라이더 기반 마스터 스케일 박스
    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2);
    
    // 발광크기 슬라이더 ➡️ 두께 및 센터 크기 매핑 균형
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85);
    // 💡 [저음 독립 바인딩] 가운데 꽃술 코어는 오직 묵직한 베이스(bass) 주파수 충격에만 원형 반응 팽창하도록 격리
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.3);

    // 발광크기에 비례한 중앙부 이격 배치 레이아웃 거리
    let centralOffsetDistance = p.map(ui.glow, 10, 150, 0, 55);

    // 🌸 1단계: 유기적 2파장 분할 꽃잎 렌더 루프
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    // 전체 무대 상시 기류 관성 미동 회전 효과
    p.rotate(this.time * 0.08 + mid * 0.06);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0, swayPhase: 0 };
      
      p.push();
      p.rotate(i * angleStep);

      // 💡 [2파장 주파수 독립 매핑 및 흐느적 곡선 힘 도출]
      let bendForce = 0;
      if (i % 2 === 0) {
        // A세트 (짝수 꽃잎): 고음(treble) 주파수 연동 및 전용 살랑임 물리 파동 계산
        let windSway = Math.sin(this.time * 4.0 + seedInfo.swayPhase) * 0.18;
        bendForce = windSway + (treble * 0.45);
      } else {
        // B세트 (홀수 꽃잎): 중음(mid) 주파수 연동 및 전용 살랑임 물리 파동 계산
        let windSway = Math.cos(this.time * 3.2 + seedInfo.swayPhase) * 0.18;
        bendForce = windSway + (mid * 0.42);
      }

      // 발광 크기 기반 평행 이격 배치
      p.translate(0, -centralOffsetDistance);

      let baseLength = 110; 
      let hueVal = 15; let satVal = 80; let briVal = 95;
      let strokeHue = 30; let strokeSat = 90; let strokeAlpha = 200;
      let fillAlpha = 160 + vol * 70;

      // 3중 멀티 컬러 스펙트럼 피커 연동 파이프라인
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
        let c1 = p.color(ui.gas1Hex);
        hueVal = p.hue(c1); satVal = p.saturation(c1); briVal = p.brightness(c1);
        
        let c2 = p.color(ui.gas2Hex);
        strokeHue = p.hue(c2); strokeSat = p.saturation(c2);
      } 
      else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        hueVal = (p.sin(this.time * 0.4 + i * 0.1) * 180 + 180) % 360;
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

      // 💡 [유연 흐느적 렌더팩 작동] 연산된 독립 주파수 힘을 주입하여 끝부분만 낭창하게 드로잉
      this.drawFlexiblePetalShape(p, baseLength, petalThickness, this.flowerShapeType, bendForce);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 중앙 원형 꽃술 코어 드로잉 (베이스 연동 전용)
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    p.noStroke();
    let coreHue = 45; let coreSat = 85; let coreBri = 98;

    if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
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
