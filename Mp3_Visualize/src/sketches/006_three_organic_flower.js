/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.2 (지형변경 슬라이더 ➡️ 5대 꽃잎 모양 구간 다이렉트 변형 매퍼 완결판)
 * - 슬라이더(1~100) 수치 구간을 5등분하여 사용자가 원하는 형태학 모양을 직관적으로 조절 및 고정 가능
 * - 스케일이나 위치 간섭을 완벽히 배제하고 오직 순수한 잎사귀 패스 형태만 변형 처리
 * - 로딩 시 HTML DOM 사용 설명 가이드창 고정 및 재생 시 자동 페이드아웃 표준 규격 유지
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; 
    
    this.version = "006호 Organic Flower Engine Ver 3.2";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 꽃 형태학 가변 제어 구조체
    this.flowerShapeType = 'teardrop'; 
    this.petalCount = 16; // 낱개 렌더링이 가장 아름다운 기본 16개 고정
    this.petalNoiseSeeds = [];

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
        <p style="margin: 6px 0;">🌱 <strong style="color: #ff6699;">[지형 변경]</strong> 슬라이더를 밀면 위치 변동 없이 꽃잎 모양(타원, 하트, 눈물방울 등)만 단계별로 칼 변형됩니다.</p>
        <p style="margin: 6px 0;">📏 <strong style="color: #ffffff;">[분산 범위]</strong> 꽃 전체 레이아웃 크기 스케일을 조절합니다.</p>
        <p style="margin: 6px 0;">✨ <strong style="color: #ffffff;">[발광 크기]</strong> 꽃잎의 두께감과 중앙 노란 꽃술 원의 지름 크기만 단독 조절합니다.</p>
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
        
        // 초기 잎사귀 위상 구조 정의
        this.updateFlowerShapeBySeed(this.getUIParams().seed);
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

  // 💡 [핵심 교정 알고리즘] 슬라이더의 무수한 숫자를 5대 잎사귀 패스 형태학으로 다이렉트 1:1 매핑 변형
  updateFlowerShapeBySeed(seedValue) {
    // 1. 숫자가 아무리 많아도 5개 등분 구간으로 완벽하게 분할 정렬
    if (seedValue <= 20) {
      this.flowerShapeType = 'sharp-ellipse'; // 1구간: 뾰족한 타원형
    } else if (seedValue <= 40) {
      this.flowerShapeType = 'ellipse';       // 2구간: 부드러운 이클립스
    } else if (seedValue <= 60) {
      this.flowerShapeType = 'heart';         // 3구간: 사랑스러운 하트모양
    } else if (seedValue <= 80) {
      this.flowerShapeType = 'teardrop';      // 4구간: 한쪽은 뾰족 한쪽은 동그란 눈물방울
    } else {
      this.flowerShapeType = 'narrow';        // 5구간: 슬림 코스모스형
    }

    // 2. 위치나 스케일이 요동치지 않도록, 잎사귀별 고유 각도 오프셋과 길이 가중치를 깔끔하게 고정 격리
    p5.prototype.randomSeed(999); // 고정형 시드로 난수 오염 차단
    this.petalNoiseSeeds = [];
    for (let i = 0; i < this.petalCount; i++) {
      this.petalNoiseSeeds.push({
        angleOffset: 0, // 위치 이탈 방지를 위해 제로 셋업
        lengthScale: 1.0, // 스케일 흔들림 차단을 위해 정배율 셋업
        colorShift: p5.prototype.random(-20, 20)
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

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon'
      };
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  // 잎사귀 기하학 베지에 수식 드로잉 매퍼
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
      // teardrop
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

    // 💡 슬라이더 조작 감지 즉시 위치 왜곡 없이 오직 '순수 모양(Shape)'만 스위칭 변경
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

    let cx = p.width / 2;
    let cy = p.height / 2;

    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2) * (1.0 + bass * 0.15);
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85) * (1.0 + treble * 0.2);
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.25);

    // 🌸 1단계: 꽃잎 정밀 정렬 렌더링
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    p.rotate(this.time * 0.12 + vol * 0.15);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0 };
      
      p.push();
      p.rotate(i * angleStep);

      // 음악 고음 성분에 따른 부드러운 오가닉 스웨이
      let sway = Math.sin(this.time * 2.5 + i) * 0.02 * (1.0 + treble);
      p.rotate(sway);

      let baseLength = 110; 
      let hueVal = 15; let satVal = 80; let briVal = 95;

      if (ui.style.includes('neon')) {
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 30)) % 360; 
        satVal = 90;
      } else if (ui.style.includes('pastel')) {
        hueVal = (45 + seedInfo.colorShift) % 360; 
        satVal = 55;
      } else if (ui.style.includes('monochrome')) {
        hueVal = 175; 
        satVal = 85;
      } else {
        hueVal = (i * 22) % 360;
      }

      p.fill(hueVal, satVal, briVal, 160 + vol * 70);
      p.stroke((hueVal + 15) % 360, satVal + 10, briVal - 10, 200);
      p.strokeWeight(1.2);

      // 💡 [형태 변형 스위치 실행]
      this.drawPetalShape(p, baseLength, petalThickness, this.flowerShapeType);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 노란색 원형 꽃술 코어 드로잉
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    p.noStroke();
    for(let r = 3; r > 0; r--) {
      p.fill(45, 90, 100, 45 / r);
      p.circle(0, 0, pistilCenterSize + (r * 12));
    }
    
    p.stroke(0, 0, 100, 180);
    p.strokeWeight(1.5);
    p.fill(45, 85, 98, 255); 
    p.circle(0, 0, pistilCenterSize);

    p.noStroke();
    p.fill(15, 90, 90, 200);
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
