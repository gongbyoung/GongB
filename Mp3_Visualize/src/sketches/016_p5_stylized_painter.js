/**
 * src/sketches/016_p5_stylized_painter.js
 * - 3단계 페인팅: 윤곽선(30%) -> 면 채우기(60%) -> 정밀 묘사(80%)
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.sourceImg = null;
    this.pg = null; 
    this.points = []; // 픽셀 기반 붓터치 위치
    this.drawnCount = 0;
    this.isImageLoaded = false;
  }

  // ... (init, handleDragOver, handleDrop 동일)

  prepareCanvas(img, p) {
    this.sourceImg = img;
    this.sourceImg.filter(p.GRAY); // 윤곽선 추출을 위한 전처리
    this.sourceImg.loadPixels();
    this.pg.background(15, 18, 25);
    
    // 💡 이미지의 윤곽선 데이터(Edge)와 면 데이터(Area)를 분리하여 큐에 담음
    this.points = [];
    let step = 4;
    for (let y = 1; y < p.height - 1; y += step) {
        for (let x = 1; x < p.width - 1; x += step) {
            let idx = (y * img.width + x) * 4;
            // 미분(밝기 차이)을 통해 윤곽선 강도 계산
            let edge = Math.abs(img.pixels[idx] - img.pixels[idx + 4]) + 
                       Math.abs(img.pixels[idx] - img.pixels[idx + img.width * 4]);
            this.points.push({x, y, edge: edge > 50 ? 1 : 0});
        }
    }
    p.shuffle(this.points, true);
    this.isImageLoaded = true;
  }

  update(audioData) {
    if (!this.p5Instance || !this.isImageLoaded) return;
    const progress = Math.min(document.querySelector('audio').currentTime / (document.querySelector('audio').duration * 0.8), 1.0);
    
    let budget = Math.floor(this.points.length * 0.05); // 프레임당 예산
    
    for(let i = 0; i < budget; i++) {
        if(this.points.length === 0) break;
        let pt = this.points.pop();
        this.paintStepByStep(pt, progress);
    }
    this.p5Instance.redraw();
  }

  paintStepByStep(pt, progress) {
    let p = this.p5Instance;
    let c = this.sourceImg.get(pt.x, pt.y);
    
    // 💡 시간대별 엔진 분기
    if (progress < 0.3) {
        // 1단계: 윤곽선 위주로 거친 스케치
        if (pt.edge) {
            this.pg.stroke(255, 150);
            this.pg.strokeWeight(1);
            this.pg.point(pt.x, pt.y);
        }
    } else if (progress < 0.6) {
        // 2단계: 면 채우기 (Blocking)
        this.pg.noStroke();
        this.pg.fill(c);
        this.pg.rect(pt.x, pt.y, 6, 6);
    } else {
        // 3단계: 정밀 묘사 (Details)
        this.pg.fill(c);
        this.pg.ellipse(pt.x, pt.y, 2, 2);
    }
  }
}
