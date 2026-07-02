/**
 * 001_p5_wave.js
 * p5.js 기반 원형 주파수 파형 비주얼라이저
 */
export default class P5Wave { 
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.parent(this.container);
        p.angleMode(p.DEGREES); // 원형 배치를 위해 각도 모드를 도(Degree)로 설정
      };

      p.draw = () => {
        // 잔상 효과를 주어 파형이 부드럽게 흐려지도록 처리
        p.background(10, 10, 15, 30); 

        if (!this.currentAudioData || !this.currentAudioData.raw) {
          // 음악이 재생되지 않을 때 잔잔한 기본 원 배치
          p.noFill();
          p.stroke(0, 255, 200, 100);
          p.ellipse(p.width / 2, p.height / 2, 200);
          return;
        }

        const rawData = this.currentAudioData.raw;
        const bass = this.currentAudioData.bass;

        p.translate(p.width / 2, p.height / 2); // 기준점을 화면 중앙으로 이동

        // 1. 베이스(저음)에 반응하여 전체 배경에 은은한 펄스 효과
        p.noFill();
        p.stroke(255, 0, 150, bass * 50);
        p.strokeWeight(bass * 5);
        p.ellipse(0, 0, 250 + bass * 100);

        // 2. 원형 주파수 파형 그리기
        p.stroke(0, 255, 200);
        p.strokeWeight(2);
        p.beginShape();
        
        // 1024개의 주파수 대역 중 앞쪽 180개(주로 유의미한 주파수)만 매핑하여 원형으로 배치
        for (let i = 0; i < 180; i++) {
          const r = p.map(rawData[i], 0, 255, 100, 250);
          const x = r * p.cos(i * 2);
          const y = r * p.sin(i * 2);
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);

        // 대칭형 비주얼을 위해 반대쪽도 동일하게 묘사
        p.stroke(255, 255, 0);
        p.beginShape();
        for (let i = 0; i < 180; i++) {
          const r = p.map(rawData[i], 0, 255, 100, 250);
          const x = r * p.cos(-i * 2);
          const y = r * p.sin(-i * 2);
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);
      };
    };

    this.p5Instance = new p5(sketch);
  }

  update(audioData) {
    this.currentAudioData = audioData;
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.currentAudioData = null;
  }
}
