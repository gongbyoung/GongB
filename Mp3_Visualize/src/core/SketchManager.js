/**
 * src/core/SketchManager.js
 * - [Fix] SyntaxError: Unexpected token '||' 구문 오류 수리 완료
 * - ?? 연산자와 || 연산자 괄호 격리 및 Optional Chaining(?.) 적용
 * - 001~025 전 스케치 4-Stem & 단일 MP3 오디오 스펙트럼 완벽 호환
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
  // 💡 [구문 수리 완료] 4-Stem & 단일 MP3 오디오 안전 규격 어댑터
  // =========================================================================
  normalizeAudioData(raw) {
    const data = raw || {};

    // 1. 안전한 Optional Chaining과 ?? 연산자로 4-Stem 음압 추출
    const vocal = data.vocalsVol ?? data.vocalVol ?? data.vocals ?? data.vocal ?? data.stems?.vocals ?? 0;
    const drum  = data.drumsVol  ?? data.drumVol  ?? data.drums  ?? data.drum  ?? data.stems?.drums  ?? 0;
    const bass  = data.bassVol   ?? data.bass     ?? data.low    ?? data.stems?.bass   ?? 0;
    const other = data.otherVol  ?? data.othersVol?? data.other  ?? data.guitar?? data.stems?.other  ?? 0;

    const mid    = data.mid ?? vocal;
    const treble = data.treble ?? data.high ?? other;
    
    // 💡 [Fix]: ?? 와 || 연산자 혼용으로 인한 SyntaxError 방지
    const calcOverall = (vocal + drum + bass + other) / 4;
    const overall = (data.overall ?? data.volume ?? calcOverall) || 0;

    // 2. 주파수 스펙트럼 배열(spectrum / frequencyData) 호환성 확보
    let spectrum = data.spectrum || data.frequencyData || data.freqData || data.dataArray;

    if (spectrum && spectrum.length > 0) {
      if (spectrum instanceof Uint8Array || (typeof spectrum[0] === 'number' && spectrum[0] > 1.0)) {
        const normSpec = new Float32Array(spectrum.length);
        for (let i = 0; i < spectrum.length; i++) {
          normSpec[i] = spectrum[i] / 255.0;
        }
        spectrum = normSpec;
      }
    } else {
      // 3. 4-Stem 전용 재생 시 spectrum 배열이 없어 정지하던 스케치들을 위한 64채널 스펙트럼 합성
      const synSpec = new Float32Array(64);
      const t = Date.now() * 0.005;
      for (let i = 0; i < 64; i++) {
        let val = 0;
        if (i < 16) {
          const w = 1.0 - (i / 16);
          val = (bass * 0.7 + drum * 0.8) * (0.6 + 0.4 * Math.sin(t * 3 + i * 0.4)) * w;
        } else if (i < 42) {
          const w = 1.0 - Math.abs(i - 28) / 14;
          val = (vocal * 0.85) * (0.6 + 0.4 * Math.cos(t * 4 + i * 0.3)) * Math.max(0, w);
        } else {
          const w = (i - 42) / 22;
          val = (other * 0.85) * (0.6 + 0.4 * Math.sin(t * 5 + i * 0.5)) * Math.max(0, w);
        }
        synSpec[i] = Math.min(1.0, Math.max(0.01, val));
      }
      spectrum = synSpec;
    }

    // 4. 모든 스케치가 요구하는 속성 통합 반환
    return {
      ...data,
      // 4-Stem 개별 변수
      vocalsVol: vocal,
      drumsVol: drum,
      bassVol: bass,
      otherVol: other,
      vocal: vocal,
      drum: drum,
      other: other,
      // 기존 1곡 스케치 호환 변수
      bass: Math.max(bass, drum),
      mid: Math.max(mid, vocal),
      treble: Math.max(treble, other),
      volume: overall,
      overall: overall,
      // 배열 데이터 (001~025 파형 및 유체 연산 필수 요소)
      spectrum: spectrum,
      frequencyData: spectrum,
      waveform: data.waveform || spectrum,
      isMultiStem: true
    };
  }

  startLoop(analyzer) {
    const loop = () => {
      if (!this.currentSketch) return;

      let rawAudio = {};
      if (analyzer && typeof analyzer.getAudioData === 'function') {
        rawAudio = analyzer.getAudioData();
      }
      if (!rawAudio || Object.keys(rawAudio).length === 0 || (!rawAudio.vocalsVol && !rawAudio.bass && !rawAudio.spectrum)) {
        rawAudio = window.latestCompiledAudioData || window.multiStemAudioData || window.audioData || {};
      }

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
