export class SketchManager {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.currentSketch = null;       
    this.animationFrameId = null;    
    this.currentSketchId = null;     
  }

  async switchSketch(sketchFileName, audioAnalyzerInstance) {
    if (this.currentSketchId === sketchFileName) return;

    // 이전 스케치 메모리 파괴 및 청소
    this.cleanup();

    try {
      // 💡 [경로 수정 완료] core 폴더 바깥의 sketches 폴더로 향하도록 명시적 상대 경로 지정
      const sketchModule = await import(`../sketches/${sketchFileName}`);
      
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
