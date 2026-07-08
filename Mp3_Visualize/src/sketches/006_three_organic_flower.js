/**
 * src/sketches/006_three_organic_flower.js
 * - [버전] Ver 3.0 (오가닉 플라워 제너레이티브 스위칭 엔진 오버홀 완결판)
 * - 뾰족타원, 이클립스, 하트, 눈물방울 등 예시 가이드 꽃잎 형태학 완벽 이식
 * - 지형변경(seed) 시 모양/개수 랜덤 스위칭, 분산범위(scatter)로 전체 크기, 발광크기(glow)로 두께/꽃술 원형 조절
 * - 특수문자 파일명 우회 BG/Texture 이미지 배경 실시간 합성 파이프라인 완비
 */

export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    // 💡 업데이트 마커 세팅
    this.version = "006호 Organic Flower Engine Ver 3.0";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 꽃 지형 상태 제어 구조체
    this.flowerShapeType = 'teardrop'; // sharp-ellipse, ellipse, heart, teardrop, narrow
    this.petalCount = 12;
    this.petalNoiseSeeds = [];

    // 배경 이미지 트래커 속성
    this.bgImageElement = null;
    this.lastBgSrc = "";
    this.domObserver = null;
  }

  async init() {
    // p5.js가 로드되어 있지 않다면 동적 가속 주입
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('left', '0px');
        canvas.style('top', '0px');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 255);
        
        // 초기 난수 시드 기반 꽃 위상 배열 구조 빌드
        this.mutateFlowerTopology(this.getUIParams().seed);
        this.setupDirectInputTracker(p);
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        // 💡 [배경 합성] 사용자가 업로드한 이미지가 감지되면 배경으로 깔고, 없으면 딥 나이트 블랙 처리
        if (this.bgImageElement && this.bgImageElement.width > 2) {
          p.image(this.bgImageElement, 0, 0, p.width, p.height);
        } else {
          p.background(220, 35, 8, 255);
        }

        // 오디오 비트가 멈춰있을 때 시스템 안내 레이어 표시
        if (!this.isAudioActive) {
          this.drawOnScreenGuide(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [지형변경 핵심 메커니즘] 랜덤 시드 입력 시 꽃의 기하학적 형태와 구조를 완전히 리모델링
  mutateFlowerTopology(seedValue) {
    p5.prototype.randomSeed(seedValue);
    
    // 1. 기획안의 여러 잎사귀 모양 중 하나를 난수로 선택
    const shapes = ['sharp-ellipse', 'ellipse', 'heart', 'teardrop', 'narrow'];
    this.flowerShapeType = shapes[Math.floor(p5.prototype.random(shapes.length))];
    
    // 2. 꽃잎 개수 변이 (8개에서 32개 사이)
    this.petalCount = Math.floor(p5.prototype.random(8, 28));
    
    // 3. 꽃잎별 고유 생체 노이즈 시드 배정
    this.petalNoiseSeeds = [];
    for (let i = 0; i < this.petalCount; i++) {
      this.petalNoiseSeeds.push({
        angleOffset: p5.prototype.random(-0.08, 0.08),
        lengthScale: p5.prototype.random(0.85, 1.25),
        colorShift: p5.prototype.random(-25, 25)
      });
    }
  }

  // 💡 특수문자 파일명 우회용 직통 DOM 트래커
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
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, // 분산범위 (전체 크기 스케일 박스 계수)
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          // 발광크기 (꽃잎 두께 및 꽃술 원형 지름)
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            // 지형변경 랜덤 스위치 시드
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon'
      };
  }

  drawOnScreenGuide(p) {
    p.push();
    p.fill(15, 85, 95, 200);
    p.noStroke();
    p.textSize(11);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`⚙️ SYSTEM STATUS: ${this.version} READY`, 20, 20);

    p.fill(220, 45, 12, 220);
    p.stroke(15, 85, 95, 120);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(p.width / 2, p.height / 2, p.width * 0.85, 220, 10);

    p.noStroke();
    p.fill(15, 85, 95);
    p.textSize(16);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Cosmic Studio 006호 가변 꽃 모양 생성 무대", p.width / 2, p.height / 2 - 70);

    p.fill(0, 0, 95);
    p.textSize(11);
    p.textAlign(p.LEFT, p.CENTER);
    let startX = p.width / 2 - (p.width * 0.38);
    let startY = p.height / 2 - 15;

    p.text("🌱 [지형변경 조작] 클릭 시 5대 잎사귀(뾰족타원,하트 등) 및 구조 랜덤 전면 리모델링", startX, startY);
    p.text("📏 [분산범위 조작] 꽃 전체 크기 스케일을 시원하게 밀고 당깁니다.", startX, startY + 25);
    p.text("✨ [발광크기 조작] 꽃잎의 통통한 두께와 가운데 원형 꽃술 크기만 단독 조절합니다.", startX, startY + 50);
    p.fill(45, 90, 100);
    p.text("📸 [배경 텍스처] 순서 상관없이 이미지를 로딩하면 배경화면으로 강제 합성 연동!", startX, startY + 75);
    p.pop();
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  // 💡 꽃잎 형태학 수학 수식 드로잉 매퍼 (수학적 제너레이티브 패스)
  drawPetalShape(p, baseLength, thickness, type) {
    p.beginShape();
    if (type === 'sharp-ellipse') {
      // 1. 뾰족한 타원형 패스
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.6, -baseLength * 0.4, -thickness * 0.6, -baseLength * 0.8, 0, -baseLength);
      p.bezierVertex(thickness * 0.6, -baseLength * 0.8, thickness * 0.6, -baseLength * 0.4, 0, 0);
    } 
    else if (type === 'ellipse') {
      // 2. 부드러운 이클립스 타원형
      p.ellipseMode(p.CENTER);
      p.ellipse(0, -baseLength * 0.5, thickness * 1.1, baseLength);
    } 
    else if (type === 'heart') {
      // 3. 로맨틱 하트모양 패스
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 1.3, -baseLength * 0.3, -thickness * 1.1, -baseLength * 0.9, 0, -baseLength * 0.95);
      p.bezierVertex(thickness * 1.1, -baseLength * 0.9, thickness * 1.3, -baseLength * 0.3, 0, 0);
    } 
    else if (type === 'narrow') {
      // 4. 슬림하고 뾰족한 코스모스형 패스
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.25, -baseLength * 0.5, -thickness * 0.25, -baseLength * 0.9, 0, -baseLength);
      p.bezierVertex(thickness * 0.25, -baseLength * 0.9, thickness * 0.25, -baseLength * 0.5, 0, 0);
    } 
    else {
      // 5. teardrop (한쪽은 뾰족하고 한쪽은 동그란 잎사귀)
      p.vertex(0, 0);
      p.bezierVertex(-thickness * 0.1, -baseLength * 0.2, -thickness * 1.2, -baseLength * 0.7, 0, -baseLength);
      p.bezierVertex(thickness * 1.2, -baseLength * 0.7, thickness * 0.1, -baseLength * 0.2, 0, 0);
    }
    p.endShape(p.CLOSE);
  }

  // 💡 [실시간 애니메이션 프레임 코어] 오디오 반응 및 슬라이더 기하학 합성 연산
  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        this.isAudioActive = false;
        p.redraw();
        return;
    }

    // 배경 실시간 리프레시
    if (this.bgImageElement && this.bgImageElement.width > 2) {
      p.image(this.bgImageElement, 0, 0, p.width, p.height);
    } else {
      p.background(220, 35, 8, 255);
    }

    const ui = this.getUIParams();
    this.time = p.millis() * 0.001;

    // 슬라이더 지형변경 변경 사항 실시간 캡처 추적 후 리모델링 기동
    let currentSettingsStr = `${ui.seed}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.mutateFlowerTopology(ui.seed);
    }

    // 오디오 진폭 채널 파싱
    let vol = audioData ? audioData.vol : p.noise(this.time) * 0.3;
    let bass = audioData ? (audioData.raw ? audioData.raw[2]/255 : vol) : vol;
    let treble = audioData ? (audioData.raw ? audioData.raw[60]/255 : vol) : vol;

    // 마스터 펄스 증폭
    vol *= ui.burst;
    bass *= ui.burst;
    treble *= ui.burst;

    let cx = p.width / 2;
    let cy = p.height / 2;

    // 💡 [기획 매핑 1] 분산범위(ui.scatter) ➡️ 꽃 전체 크기 바운더리 박스 배율로 매핑
    let masterScale = p.map(ui.scatter, 5, 50, 0.4, 2.2) * (1.0 + bass * 0.15);

    // 💡 [기획 매핑 2] 발광크기(ui.glow) ➡️ 꽃잎 두께 폭 및 꽃술 원형 단독 스케일 스펙트럼
    let petalThickness = p.map(ui.glow, 10, 150, 8, 85) * (1.0 + treble * 0.2);
    let pistilCenterSize = p.map(ui.glow, 10, 150, 15, 110) * (1.0 + bass * 0.25);

    // 🌸 1단계: 유기적 꽃잎(Petals) 써클 서라운드 루프 드로잉
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    // 부드러운 전체 상시 꽃 춤바람 회전 효과
    p.rotate(this.time * 0.15 + vol * 0.2);

    let angleStep = p.TWO_PI / this.petalCount;

    for (let i = 0; i < this.petalCount; i++) {
      let seedInfo = this.petalNoiseSeeds[i] || { angleOffset: 0, lengthScale: 1, colorShift: 0 };
      
      p.push();
      // 꽃잎 순서별 방사형 각도 정렬 배치 + 생체 난수 위상차 합성
      let currentPetalAngle = i * angleStep + seedInfo.angleOffset;
      p.rotate(currentPetalAngle);

      // 개별 꽃잎의 기류 미동 흔들림 효과
      let sway = Math.sin(this.time * 2.0 + i) * 0.03 * (1.0 + treble);
      p.rotate(sway);

      // 기본 꽃잎 길이 도출
      let baseLength = 110 * seedInfo.lengthScale;

      // 우측 컬러 파레트 테마별 꽃잎 색상 조합 피팅
      let hueVal = 15; // 기본 화사한 레드코랄
      let satVal = 80;
      let briVal = 95;

      if (ui.style.includes('neon')) {
        hueVal = (330 + seedInfo.colorShift + p.map(i, 0, this.petalCount, 0, 40)) % 360; // 사이버 핫핑크/네온 퍼플 계열
        satVal = 90;
      } else if (ui.style.includes('pastel')) {
        hueVal = (45 + seedInfo.colorShift) % 360; // 살구 크림 & 소프트 골드 계열
        satVal = 55;
      } else if (ui.style.includes('monochrome')) {
        hueVal = 175; // 청록 민트 네온 단색 고정
        satVal = 85;
      } else {
        // 프리셋 외 무작위 가변
        hueVal = (seedInfo.seedColor || (i * 25)) % 360;
      }

      // 오디오 타격에 따른 꽃잎 내부 투명도 채도 그라데이션 오버랩
      p.fill(hueVal, satVal, briVal, 160 + vol * 70);
      p.stroke((hueVal + 20) % 360, satVal + 10, briVal - 10, 200);
      p.strokeWeight(1.2);

      // 💡 [핵심 드로잉] 무작위 선택된 예시 잎사귀 패스로 그리기 파이어
      this.drawPetalShape(p, baseLength, petalThickness, this.flowerShapeType);
      
      p.pop();
    }
    p.pop();

    // 🌸 2단계: 가운데 꽃술(Pistil Center Core) 드로잉
    // 기획 사항에 맞춰 크기조절 원형 형태로 단독 배치
    p.push();
    p.translate(cx, cy);
    p.scale(masterScale);
    
    // 꽃술 센터 코어 원형 섀도우 글로우
    p.noStroke();
    for(let r = 3; r > 0; r--) {
      p.fill(45, 90, 100, 45 / r);
      p.circle(0, 0, pistilCenterSize + (r * 12));
    }
    
    // 리얼 선명한 센터 코어 원형 픽스
    p.stroke(0, 0, 100, 180);
    p.strokeWeight(1.5);
    p.fill(45, 85, 98, 255); // 화사한 골드 옐로우 꽃술 고정
    p.circle(0, 0, pistilCenterSize);

    // 내부 디테일 인술 무늬 점 추가
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
    if (this.domObserver) this.domObserver.disconnect();
  }
}
