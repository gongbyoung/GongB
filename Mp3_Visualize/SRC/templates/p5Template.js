/**
 * p5Template.js
 * 새로운 p5.js 기반 미디어 아트를 만들 때 복사해서 쓸 기본 거푸집
 */
export default class P5Template { 
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null; // 최신 오디오 데이터를 보관할 변수
  }

  /**
   * 스케치 초기화 및 캔버스 생성
   */
  init() {
    // p5 인스턴스 모드 가동
    const sketch = (p) => {
      p.setup = () => {
        // 컨테이너 크기에 맞게 캔버스 생성 (필요시 p.WEBGL 모드 추가 가능)
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.parent(this.container);
        p.background(0);
      };

      p.draw = () => {
        // 매 프레임 화면을 지우거나 겹치게 처리
        p.background(0, 0, 0, 25); 

        // 오디오 데이터가 아직 안 들어왔다면 실행 보류
        if (!this.currentAudioData) return;

        // ----------------------------------------------------
        // 🎨 여기에 오디오 반응형 시각화 코드를 작성합니다.
        // 이용 가능한 데이터: 
        // this.currentAudioData.volume (전체 볼륨 0~1)
        // this.currentAudioData.bass (저음 0~1)
        // this.currentAudioData.mid (중음 0~1)
        // this.currentAudioData.treble (고음 0~1)
        // ----------------------------------------------------
        
        // 예시: 베이스(저음) 수치에 따라 크기가 변하는 중앙의 원
        const size = p.map(this.currentAudioData.bass, 0, 1, 50, 400);
        p.noFill();
        p.stroke(0, 255, 200);
        p.strokeWeight(2);
        p.ellipse(p.width / 2, p.height / 2, size, size);
      };
    };

    // p5 인스턴스를 생성하여 화면에 주입
    this.p5Instance = new p5(sketch);
  }

  /**
   * SketchManager로부터 매 프레임 정제된 오디오 데이터를 받는 곳
   */
  update(audioData) {
    this.currentAudioData = audioData;
  }

  /**
   * 창 크기가 변경될 때 캔버스 크기 재조정
   */
  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  /**
   * [중요] 스케치 교체 시 p5 인스턴스를 메모리에서 완벽히 삭제
   */
  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove(); // p5 내부 캔버스 제거 및 루프 정지
      this.p5Instance = null;
    }
    this.currentAudioData = null;
  }
}
