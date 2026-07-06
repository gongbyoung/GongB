/**
 * src/sketches/016_p5_stylized_painter.js
 * - 3단계 페인팅: 윤곽선(30%) -> 면 채우기(60%) -> 정밀 묘사(80%)
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; // 오프스크린 그래픽 버퍼
    this.points = []; // 픽셀 기반 붓터치 위치 데이터
    this.isImageLoaded = false;
    this.step = 4; // 픽셀 샘플링 간격 (값이 클수록 더 거친 스케치)
  }

  async init() {
    // p5.js가 로드되어 있는지 확인
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    // 드래그 앤 드롭 이벤트 리스너 등록
    this.container.addEventListener('dragover', this.handleDragOver.bind(this));
    this.container.addEventListener('drop', this.handleDrop.bind(this));

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // 그림을 그릴 그래픽 버퍼 생성
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.background(15, 18, 25); // 어두운 배경
        
        p.noLoop(); // draw()를 수동으로 호출
      };

      p.draw = () => {
        p.clear();
        if (this.pg) {
          p.image(this.pg, 0, 0); // 버퍼의 내용을 화면에 그림
        } else {
          this.drawDropUI(p); // 이미지 없을 때 가이드 표시
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  drawDropUI(p) {
    p.push();
    p.fill(200);
    p.noStroke();
    p.textSize(24);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("이미지를 드래그하여 드롭하세요", p.width/2, p.height/2);
    p.pop();
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      if (this.p5Instance) {
        // 기존 이미지가 있다면 정리
        if(this.sourceImg) {
          this.sourceImg.remove();
        }
        this.p5Instance.loadImage(url, (img) => {
          this.prepareCanvas(img, this.p5Instance);
        });
      }
    }
  }

  prepareCanvas(img, p) {
    // 원본 이미지 설정 및 전처리
    this.sourceImg = img;
    // 이미지를 Grayscale(흑백)으로 변환하여 윤곽선 추출 준비
    this.sourceImg.filter(p.GRAY); 
    this.sourceImg.loadPixels();
    
    // 그래픽 버퍼 초기화
    this.pg.clear();
    this.pg.background(15, 18, 25);
    
    // 💡 이미지의 픽셀 데이터를 순회하며 점(포인트) 데이터 생성
    this.points = [];
    // 이미지 경계선을 제외하고 샘플링
    for (let y = 1; y < img.height - 1; y += this.step) {
      for (let x = 1; x < img.width - 1; x += this.step) {
        let idx = (y * img.width + x) * 4;
        
        // 간단한 Sobel-like 윤곽선 검출 (밝기 차이 계산)
        // 오른쪽 픽셀과의 차이
        let diffX = Math.abs(img.pixels[idx] - img.pixels[idx + 4]);
        // 아래쪽 픽셀과의 차이
        let diffY = Math.abs(img.pixels[idx] - img.pixels[idx + img.width * 4]);
        
        let edgeStrength = diffX + diffY;
        
        // 포인트 데이터 저장 (좌표, 원본 RGB, 윤곽선 여부)
        this.points.push({
          x: x,
          y: y,
          r: img.pixels[idx],     // 원본 R값
          g: img.pixels[idx + 1], // 원본 G값
          b: img.pixels[idx + 2], // 원본 B값
          // 임계값(50)보다 크면 윤곽선으로 간주
          edge: edgeStrength > 50 ? 1 : 0
        });
      }
    }
    
    // 💡 중요: 그리는 순서를 무작위로 섞어서 체계적이지 않은 거친 느낌 부여
    p.shuffle(this.points, true);
    
    this.isImageLoaded = true;
    console.log(`[3-Step Painter] 준비 완료: ${this.points.length} 포인트 생성`);
    this.p5Instance.redraw(); // 화면 갱신
  }

  update() {
    if (!this.p5Instance || !this.isImageLoaded || this.points.length === 0) return;

    const audioEl = document.querySelector('audio');
    // 오디오가 없으면 진행 불가
    if (!audioEl || !audioEl.duration) return;

    // 💡 [핵심] 진행률 계산 (전체 시간의 80%를 100% 완료로 설정)
    const progress = Math.min(audioEl.currentTime / (audioEl.duration * 0.8), 1.0);
    
    // 💡 [최적화] 프레임당 그릴 포인트 수 계산 (남은 포인트의 5%)
    let budget = Math.max(10, Math.floor(this.points.length * 0.05)); 
    
    this.pg.push();
    // 캔버스 좌표를 이미지 크기에 맞게 조정 (이미지가 캔버스보다 작을 경우 중앙 정렬 등 고려 가능)
    // 여기서는 간단하게 원본 비율로 매핑한다고 가정
    
    for(let i = 0; i < budget; i++) {
      if(this.points.length === 0) break;
      let pt = this.points.pop();
      this.paintStepByStep(pt, progress);
    }
    this.pg.pop();
    
    this.p5Instance.redraw(); // 변경된 그래픽 버퍼를 화면에 그림
  }

  paintStepByStep(pt, progress) {
    // 그래픽 버퍼 좌표계 보정 (p5 인스턴스 기준)
    // prepareCanvas에서 이미 스케일이 적용되었으므로 여기서는 1:1 매핑
    
    let targetX = pt.x;
    let targetY = pt.y;

    // 💡 시간대별 엔진 분기
    if (progress < 0.3) {
      // 1단계 (0~30%): 윤곽선 위주로 거친 스케치 (연필/목탄 느낌)
      if (pt.edge) {
        this.pg.stroke(255, 150); // 흰색, 반투명
        this.pg.strokeWeight(p.random(0.5, 1.5)); // 랜덤한 굵기
        this.pg.point(targetX, targetY);
      }
    } else if (progress < 0.6) {
      // 2단계 (30~60%): 윤곽선 안쪽 면 채우기 (Blocking - 과감한 붓터치)
      // 윤곽선이 아닌 점들에 대해서만 실행
      if (!pt.edge) {
        this.pg.noStroke();
        this.pg.fill(pt.r, pt.g, pt.b); // 원본 색상
        // 사각형으로 과감하게 채우기
        let rectSize = this.step * 1.5;
        this.pg.rect(targetX, targetY, rectSize, rectSize);
      }
    } else {
      // 3단계 (60~80%): 섬세한 덧칠 (Refining - 디테일과 명암 보강)
      // 모든 점을 사용하여 묘사
      this.pg.noStroke();
      // 색상에 약간의 변화를 주어 깊이감 생성
      this.pg.fill(pt.r, pt.g, pt.b, 200);
      // 작은 원형으로 섬세하게 묘사
      let ellipseSize = this.step * 0.5;
      this.pg.ellipse(targetX, targetY, ellipseSize, ellipseSize);
    }
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      // 리사이즈 시 그래픽 버퍼도 함께 재생성
      this.pg = this.p5Instance.createGraphics(w, h);
      // 이미지가 로드된 상태라면 다시 준비
      if (this.sourceImg) {
        this.prepareCanvas(this.sourceImg, this.p5Instance);
      } else {
        this.pg.background(15, 18, 25);
      }
    }
  }

  destroy() {
    // 이벤트 리스너 제거
    this.container.removeEventListener('dragover', this.handleDragOver);
    this.container.removeEventListener('drop', this.handleDrop);
    if (this.p5Instance) {
      this.p5Instance.remove();
    }
    if (this.sourceImg) {
      this.sourceImg.remove();
    }
  }
}
