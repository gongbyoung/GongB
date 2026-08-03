/**
 * src/core/SketchManager.js
 * - [001~025 전 스케치 호환] 오디오 데이터 중앙 어댑터(Audio Normalizer) 탑재
 * - 4-Stem(보컬/드럼/베이스/기타) 및 1곡(단일 MP3) 데이터를 양방향 자동 변환
 * - 25개 스케치 전체가 개별 수정 없이 1곡/4곡 수신 환경에 모두 반응하도록 보장
 */

export class SketchManager {
  constructor(canvasContainerId) {
    this.container = typeof canvasContainerId === 'string'
      ? document.getElementById(canvasContainerId)
      : canvasContainerId;

    this.currentSketch = null;       
    this.animationFrameId = null;    
    this.currentSketchId = null;     
  }

  async switchSketch(sketchFileName, audioAnalyzerInstance) {
    if (this.currentSketchId === sketchFileName) return;

    this.cleanup();

    const cleanFileName = sketchFileName.replace(/^sketches\//, '');

    try {
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

  // =========================================================================
  // 💡 [핵심] 1곡 ↔ 4-Stem 양방향 오디오 정규화 어댑터
  // =========================================================================
  normalizeAudioData(rawAudio) {
    if (!rawAudio) {
      return {
        vocalsVol: 0, drumsVol: 0, bassVol: 0, otherVol: 0,
        bass: 0, mid: 0, treble: 0, overall: 0, isMultiStem: false
      };
    }

    // 1. 4-Stem 데이터가 들어온 경우 ➔ 1곡용 변수(bass, mid, treble) 자동 생성
    if (rawAudio.isMultiStem || rawAudio.vocalsVol !== undefined) {
      const v = rawAudio.vocalsVol || 0;
      const d = rawAudio.drumsVol  || 0;
      const b = rawAudio.bassVol   || 0;
      const o = rawAudio.otherVol  || 0;

      return {
        ...rawAudio,
        vocalsVol: v,
        drumsVol:  d,
        bassVol:   b,
        otherVol:  o,
        // 1곡 전용 스케치 호환용 매핑
        bass: Math.max(d, b),
        mid: v,
        treble: o,
        overall: (v + d + b + o) / 4
      };
    }

    // 2. 1곡(단일 MP3) 데이터가 들어온 경우 ➔ 4-Stem 변수(vocalsVol, drumsVol...) 자동 생성
    const bassVal   = rawAudio.bass   || rawAudio.low  || 0;
    const midVal    = rawAudio.mid    || rawAudio.midRange || 0;
    const trebleVal = rawAudio.treble || rawAudio.high || 0;
    const overallVal = rawAudio.overall || rawAudio.volume || (bassVal + midVal + trebleVal) / 3;

    return {
      ...rawAudio,
      // 4-Stem 전용 스케치 호환용 매핑
      vocalsVol: midVal * 1.2,
      drumsVol:  bassVal * 1.3,
      bassVol:   bassVal,
      otherVol:  trebleVal * 1.1,
      // 1곡 전용 변수 유지
      bass: bassVal,
      mid: midVal,
      treble: trebleVal,
      overall: overallVal,
      isMultiStem: false
    };
  }

  startLoop(analyzer) {
    const loop = () => {
      if (!this.currentSketch) return;

      let rawAudio = {};
      if (analyzer && typeof analyzer.getAudioData === 'function') {
        rawAudio = analyzer.getAudioData();
      } else if (window.latestCompiledAudioData) {
        rawAudio = window.latestCompiledAudioData;
      }

      // 🎯 스케치에 넘겨주기 전 중앙에서 규격 통합 통일
      const normalizedAudio = this.normalizeAudioData(rawAudio);

      if (typeof this.currentSketch.update === 'function') {
        this.currentSketch.update(normalizedAudio);
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
