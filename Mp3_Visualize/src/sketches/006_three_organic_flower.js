/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.1 (로딩 시 사용 설명 레이어 활성화 및 스타트 재생 시 자동 페이드아웃 규격 탑재판)
 * - 이미지 로딩 순서 제약 해제 및 특수문자 파일명 우회 직통 DOM 이미지 캡처 트래커 유지
 * - 5대 잎사귀 기하학 형태 변이 메커니즘 및 발광크기(Glow) ➡️ 원형 꽃술 스케일 제어 링크 완비
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.guiOverlay = null; // 💡 앞으로 모든 코드에 공통 탑재될 사용 설명 UI 레이어
    
    // 💡 업데이트 마커 세팅
    this.version = "006호 Organic Flower Engine Ver 3.1";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 꽃 형태학 변수 구조체
    this.flowerShapeType = 'teardrop'; 
    this.petalCount = 12;
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

    // 💡 [공통 표준 규격] 기존에 혹시 남아있을 수 있는 가이드 HTML UI 엘리먼트 엘리먼트 청소 후 재생성
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    // 모바일 및 웹 화면 9:16 프레임 정중앙 자석 배치를 위한 초정밀 인라인 CSS 스타일 시공
    Object.assign(this.guiOverlay.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '85%',
      maxWidth: '420px',
      backgroundColor: 'rgba(10, 12, 18, 0.93)',
      border: '1px solid rgba(255, 102, 153, 0.6)', // 꽃 무대에 어울리는 화사한 엣지 코팅
      borderRadius: '12px',
      padding: '22px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '20',
      boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
      boxSizing: 'border-box',
      textAlign: 'center',
      pointerEvents: 'none', // 뒤쪽 컨트롤러 클릭 레이어 간섭 차단
      transition: 'opacity 0.45s cubic-bezier(0.25, 1, 0.5, 1)' // 사르르 사라지는 고밀도 페이드아웃 연출
    });

    // 💡 [공통 표준 규격] 사용설명 로딩 화면 텍스트 주입
    this.guiOverlay.innerHTML = `
      <div style="color: #ff6699; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        ⚙️ STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">
        006호 오가닉 플라워 사용 방법
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">📸 <strong style="color: #ff6699;">[배경 로딩]</strong> BG/Texture 이미지를 자유롭게 업로드하여 꽃 뒤의 바탕 화면으로 배치하세요.</p>
        <p style="margin: 6px 0;">🌱 <strong style="color: #ffffff;">[지형 변경]</strong> 무작위 슬라이더 작동 시 하트잎, 눈물방울잎 등 5대 꽃 모양과 잎 개수가 랜덤 스위칭됩니다.</p>
        <p style="margin: 6px 0;">📏 <strong style="color: #ffffff;">[분산 범위]</strong> 꽃 전체의 스케일 레이아웃 크기를 조절합니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 자동으로 사라지며 영상이 실시간 가동됩니다!</p>
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
        
        this.mutateFlowerTopology(this.getUIParams().seed);
        this.setupDirectInputTracker(p);
        p.noLoop();
      };

      p.draw = () => {
        if (this.bgImageElement && this.bgImageElement.width > 2) {
          p.image(this.bgImageElement, 0, 0, p.width, p.height);
        } else {
          p.background(220, 35, 8, 255);
        }
        // 가이드 패널이 p5 text() 함수 바깥의 순수 HTML DOM레이어로 독립 배치되므로 드로우는 배경만 렌더링 유지
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  mutateFlowerTopology(seedValue) {
    p5.prototype.randomSeed(seedValue);
    const shapes = ['sharp-ellipse', 'ellipse', 'heart', 'teardrop', 'narrow'];
    this.flowerShapeType = shapes[Math.floor(p5.prototype.random(shapes.length))];
    this.petalCount = Math.floor(p5.prototype.random(8, 28));
    
    this.petalNoiseSeeds = [];
    for (let i = 0; i < this.petalCount; i++) {
      this.petalNoiseSeeds.push({
        angleOffset: p5.prototype.random(-0.08, 0.08),
        lengthScale: p5.prototype.random(0.85, 1.25),
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

  drawPetalShape(p, baseLength, thickness, type) {
    p.beginShape();
    if (type === 'sharp-ellipse') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.6, -baseLength * 0.4, -thickness * 0.6, -baseLength * 0.8, 0, -baseLength);
      p.bezierVertex(thickness * 0.6, -baseLength * 0.8, thickness * 0.6, -baseLength * 0.4, 0, 0);
    } 
    else if (type === 'ellipse') {
      p.ellipseMode(p.CENTER);
      p.ellipse(0, -baseLength * 0.5, thickness * 1.1, baseLength);
    } 
    else if (type === 'heart') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 1.3, -baseLength * 0.3, -thickness * 1.1, -baseLength * 0.9, 0, -baseLength * 0.95);
      p.bezierVertex(thickness * 1.1, -baseLength * 0.9, thickness * 1.3, -baseLength * 0.3, 0, 0);
    } 
    else if (type === 'narrow') {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.25, -baseLength * 0.5, -thickness * 0.25, -baseLength * 0.9, 0, -baseLength);
      p.bezierVertex(thickness * 0.25, -baseLength * 0.9, thickness * 0.25, -baseLength * 0.5, 0, 0);
    } 
    else {
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.1, -baseLength * 0.2, -thickness * 1.2, -baseLength * 0.7, 0, -baseLength);
      p.bezierVertex(thickness * 1.2, -baseLength * 0.7, thickness * 0.1, -baseLength * 0.2, 0, 0);
    }
    p.endShape(p.CLOSE);
  }

  // 💡 [실시간 프레임 코어] 애니메이션 연동 및 재생 감지 감쇠 레이어 처리
  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    // 💡 [공통 표준 규격 작동 단추] 스타트 클릭 시 가이드를 부드럽게 숨기고 정지 시 다시 표시
    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '0'; // 영상 시작되면서 깔끔하게 페이드아웃 소멸
    } else {
        this.isAudioActive = false;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '1'; // 정지 시 가이드 복귀
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
        this.mutateFlowerTopology(ui.seed);
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

    // 🌸 1단계: 유기적 꽃잎 렌더 루프
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    p.rotate(this.time * 0.15 + vol * 0.2);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0 };
      
      p.push();
      let currentPetalAngle = i * angleStep + seedInfo.angleOffset;
      p.rotate(currentPetalAngle);

      let sway = Math.sin(this.time * 2.0 + i) * 0.03 * (1.0 + treble);
      p.rotate(sway);

      let baseLength = 110 * seedInfo.lengthScale;
      let hueVal = 15; let satVal = 80; let briVal = 95;

      if (ui.style.includes('neon')) {
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 40)) % 360; 
        satVal = 90;
      } else if (ui.style.includes('pastel')) {
        hueVal = (45 + seedInfo.colorShift) % 360; 
        satVal = 55;
      } else if (ui.style.includes('monochrome')) {
        hueVal = 175; 
        satVal = 85;
      } else {
        hueVal = (i * 25) % 360;
      }

      p.fill(hueVal, satVal, briVal, 160 + vol * 70);
      p.stroke((hueVal + 20) % 360, satVal + 10, briVal - 10, 200);
      p.strokeWeight(1.2);

      this.drawPetalShape(p, baseLength, petalThickness, this.flowerShapeType);
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 중앙 원형 꽃술 코어 드로잉
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
    if (this.guiOverlay) this.guiOverlay.remove(); // 종료 시 생성한 설명창 소멸 보장
    if (this.domObserver) this.domObserver.disconnect();
  }
}
