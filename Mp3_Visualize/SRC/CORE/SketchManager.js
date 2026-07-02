/**
 * SketchManager.js
 * 스케치 동적 로딩 및 메모리 해제(가비지 컬렉션)를 총괄하는 관리자 모듈
 */ 
export class SketchManager {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId); // 캔버스가 삽입될 HTML 엘리먼트
    this.currentSketch = null;       // 현재 실행 중인 스케치 인스턴스
    this.animationFrameId = null;    // 애니메이션 루프 ID (정지용)
    this.currentSketchId = null;     // 현재 실행 중인 스케치 ID 기록
  }

  /**
   * 새로운 스케치를 동적으로 불러오고 교체하는 함수
   * @param {string} sketchFileName - 예: '001_p5_wave.js'
   * @param {Object} audioAnalyzerInstance - 오디오 데이터를 뽑아올 분석기 인스턴스
   */
  async switchSketch(sketchFileName, audioAnalyzerInstance) {
    // 1. 동일한 스케치를 다시 클릭했다면 무시
    if (this.currentSketchId === sketchFileName) return;

    // 2. [가비지 컬렉션] 기존에 돌고 있던 스케치가 있다면 안전하게 파괴
    this.cleanup();

    try {
      // 3. Dynamic Import를 이용해 sketches 폴더 안의 모듈을 실시간으로 가져옴
      // Webpack/Vite 환경 또는 순수 ESM 파싱 규칙에 맞게 경로 세팅
      // 변경 후 (main.js에서 완성된 경로를 던져주므로 그대로 import)
       const sketchModule = await import(sketchFileName);


      
      // 4. 모듈 내부의 기본 export 클래스를 인스턴스화 (규격화된 인터페이스 가정)
      // 모든 스케치는 규칙상 'export default class ...' 형태로 작성되어야 함
      this.currentSketch = new sketchModule.default(this.container);
      this.currentSketchId = sketchFileName;

      // 5. 스케치 초기화 (Three.js 씬 빌드 또는 p5 초기화 등)
      this.currentSketch.init();

      // 6. 새로운 애니메이션 프레임 루프 가동
      this.startLoop(audioAnalyzerInstance);

      console.log(`[🎯 Success] 스케치 로드 완료: ${sketchFileName}`);
    } catch (error) {
      console.error(`[❌ Error] 스케치 로드 실패 (${sketchFileName}):`, error);
    }
  }

  /**
   * 매 프레임마다 오디오 데이터를 스케치에 주입하며 화면을 갱신하는 루프
   */
  startLoop(analyzer) {
    const loop = () => {
      if (!this.currentSketch) return;

      // 오디오 분석기에서 정제된 최신 주파수 객체 획득 (Bass, Mid, Treble 등)
      const audioData = analyzer.getAudioData();

      // 현재 활성화된 스케치의 update 함수로 오디오 데이터 토스
      if (typeof this.currentSketch.update === 'function') {
        this.currentSketch.update(audioData);
      }

      // 루프 지속
      this.animationFrameId = requestAnimationFrame(loop);
    };

    // 루프 시작
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 브라우저 메모리 폭발을 막기 위한 극한의 가비지 컬렉션(Clean-up) 로직
   */
  cleanup() {
    // 1. 애니메이션 루프 즉시 정지
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 2. 스케치 자체 내부에 선언된 자체 해제 로직 실행 (Three.js 내부 geometry, material, texture 해제 등)
    if (this.currentSketch && typeof this.currentSketch.destroy === 'function') {
      this.currentSketch.destroy();
    }

    // 3. 컨테이너 내부의 캔버스 엘리먼트 싹 비우기
    if (this.container) {
      this.container.innerHTML = '';
    }

    // 4. 참조형 변수를 완벽히 비워 가비지 컬렉터(GC)가 메모리를 수거하도록 유도
    this.currentSketch = null;
    this.currentSketchId = null;

    console.log('[🧹 Clean-up] 이전 스케치 자원 및 메모리 해제 완료');
  }

  /**
   * 브라우저 창 크기가 바뀔 때 현재 스케치에게도 알려주는 알리미
   */
  resize(width, height) {
    if (this.currentSketch && typeof this.currentSketch.resize === 'function') {
      this.currentSketch.resize(width, height);
    }
  }
}
