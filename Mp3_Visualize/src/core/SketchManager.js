/**
 * src/core/SketchManager.js
 * - 7월 2일 c7f988c 원본 커밋 구조 100% 복원
 * - sketches/ 경로 중복 자동 방지 & 컨테이너 입력 타입 안전 처리 추가
 */

export class SketchManager {
  constructor(canvasContainerId) {
    // 문자열 ID 또는 DOM Element 모두 안전 지원
    this.container = typeof canvasContainerId === 'string'
      ? document.getElementById(canvasContainerId)
      : canvasContainerId;

    this.currentSketch = null;       
    this.animationFrameId = null;    
    this.currentSketchId = null;     
  }

  async switchSketch(sketchFileName, audioAnalyzerInstance) {
    if (this.currentSketchId === sketchFileName) return;

    // 이전 스케치 메모리 파괴 및 청소
    this.cleanup();

    // 파일명에 'sketches/'가 이미 포함되어 있어도 중복되지 않도록 다듬기
    const cleanFileName = sketchFileName.replace(/^sketches\//, '');

    try {
      // 💡 [7월 2일 원본 명시적 상대 경로 방식] core 기준 상위 sketches 폴더 접근
      const sketchModule = await import(`../sketches/${cleanFileName}`);
      
      this.currentSketch = new sketchModule.default(this.container);
      this.currentSketchId = sketchFileName;

      if (typeof this.currentSketch.init === 'function') {
        this.currentSketch.init();
      }

      this.startLoop(audioAnalyzerInstance);

      console.log(`[🎯 Success] 스케치 로드 완료: ${cleanFileName}`);
    } catch (error) {
      console.error(`[❌ Error] 스케치 로드 실패 (${cleanFileName}):`, error);
    }
  }

  startLoop(analyzer) {
    const loop = () => {
      if (!this.currentSketch) return;

      let audioData = {};
      if (analyzer && typeof analyzer.getAudioData === 'function') {
        audioData = analyzer.getAudioData();
      } else if (window.latestCompiledAudioData) {
        audioData = window.latestCompiledAudioData;
      }

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
