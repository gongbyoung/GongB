export class SketchManager {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.currentSketch = null;       
    this.animationFrameId = null;    
    this.currentSketchId = null;     
  }

async switchSketch(sketchFileName, audioAnalyzerInstance) {
    if (this.currentSketchId === sketchFileName) return;

    // 1. 이전 스케치 메모리 파괴 및 청소
    this.cleanup();

    try {
      // 💡 [핵심 교정] 
      // 만약 sketchFileName에 이미 경로 기호가 섞여 들어오는 변수를 방지하기 위해,
      // 오직 순수한 파일 이름만 남긴 뒤 확실하게 '../sketches/'를 강제로 붙여줍니다.
      const pureFileName = sketchFileName.replace(/^.*[\\\/]/, ''); 
      const modulePath = `../sketches/${pureFileName}`;
      
      console.log(`[🔍 Debug] 로드 시도 경로: ${modulePath}`); // 경로 확인용 로그 추가
      
      const sketchModule = await import(modulePath);
      
      // 2. 모듈 내부의 기본 export 클래스를 인스턴스화
      this.currentSketch = new sketchModule.default(this.container);
      this.currentSketchId = sketchFileName;

      this.currentSketch.init();
      this.startLoop(audioAnalyzerInstance);

      console.log(`[🎯 Success] 스케치 로드 완료: ${sketchFileName}`);
    } catch (error) {
      console.error(`[❌ Error] 스케치 로드 실패 (${sketchFileName}):`, error);
    }
  }

  startLoop(analyzer) {
    const loop = () => {
      if (!this.currentSketch) return;

      const audioData = analyzer.getAudioData();

      if (typeof this.currentSketch.update === 'function') {
        this.currentSketch.update(audioData);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.currentSketch && typeof this.currentSketch.destroy === 'function') {
      this.currentSketch.destroy();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.currentSketch = null;
    this.currentSketchId = null;

    console.log('[🧹 Clean-up] 이전 스케치 자원 및 WebGL 메모리 해제 완료');
  }

  resize(width, height) {
    if (this.currentSketch && typeof this.currentSketch.resize === 'function') {
      this.currentSketch.resize(width, height);
    }
  }
}
