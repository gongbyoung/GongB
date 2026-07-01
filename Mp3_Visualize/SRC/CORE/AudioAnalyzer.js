/**
 * AudioAnalyzer.js
 * 공장형 미디어 아트를 위한 오디오 분석 코어 모듈
 */
export class AudioAnalyzer {
  constructor(fftSize = 2048) {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.fftSize = fftSize; // 주파수 분해능 (결과 배열 길이는 fftSize / 2)
    this.isPlaying = false;
  }

  /**
   * 오디오 컨텍스트 초기화 (브라우저 보안 정책상 사용자 상호작용 후 호출 필요)
   */
  init() {
    if (this.audioContext) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8; // 부드러운 값 변화를 위한 보정값 (0~1)
    
    // 분석할 데이터를 담을 배열 생성 (fftSize가 2048이면 1024개의 대역)
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  /**
   * 오디오 엘리먼트(Audio Tag 또는 MP3)를 노드에 연결
   * @param {HTMLAudioElement} audioElement 
   */
  connectAudioElement(audioElement) {
    this.init();
    
    // 기존 소스가 있다면 연결 해제
    if (this.source) {
      this.source.disconnect();
    }

    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination); // 스피커로 출력
  }

  /**
   * 특정 주파수 영역(Hz)의 평균 에너지를 추출하는 핵심 함수 (그룹핑 로직)
   */
  getAverageVolumeInRange(lowFreq, highFreq) {
    if (!this.analyser) return 0;

    const sampleRate = this.audioContext.sampleRate; // 보통 44100Hz 또는 48000Hz
    const binCount = this.analyser.frequencyBinCount; // 예: 1024
    
    // 각 Bin(대역 하나)이 담당하는 주파수 범위 계산
    const hzPerBin = sampleRate / this.fftSize; 

    // 우리가 원하는 Hz 영역에 해당하는 배열의 인덱스(Index) 구하기
    const lowIndex = Math.floor(lowFreq / hzPerBin);
    const highIndex = Math.min(Math.floor(highFreq / hzPerBin), binCount - 1);

    if (lowIndex > highIndex) return 0;

    let sum = 0;
    let count = 0;

    for (let i = lowIndex; i <= highIndex; i++) {
      sum += this.dataArray[i];
      count++;
    }

    // 0 ~ 255 사이의 값을 0.0 ~ 1.0 스케일로 정규화하여 반환
    return count > 0 ? (sum / count) / 255 : 0;
  }

  /**
   * 매 프레임마다 호출되어 정제된 데이터를 객체로 반환하는 함수
   * 미디어 아트 스케치들의 update(data) 안으로 들어갈 데이터셋입니다.
   */
  getAudioData() {
    if (!this.analyser) {
      return { volume: 0, bass: 0, mid: 0, treble: 0, subBass: 0, raw: [] };
    }

    // 실시간 주파수 데이터를 dataArray에 업데이트
    this.analyser.getByteFrequencyData(this.dataArray);

    // 1. 전체 볼륨 (전체 대역의 평균)
    let totalSum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      totalSum += this.dataArray[i];
    }
    const volume = (totalSum / this.dataArray.length) / 255;

    // 2. 세부 주파수 대역 그룹핑 (Hz 기준)
    // 음악적 특성에 맞춰 언제든 이 수치를 미세조정(Tuning)할 수 있습니다.
    const subBass = this.getAverageVolumeInRange(20, 60);     // 초저역 (웅웅거리는 서브우퍼)
    const bass = this.getAverageVolumeInRange(60, 250);       // 저역 (킥 드럼, 베이스 라인)
    const mid = this.getAverageVolumeInRange(250, 4000);      // 중역 (보컬, 피아노, 대부분의 악기)
    const treble = this.getAverageVolumeInRange(4000, 16000);  // 고역 (하이햇, 심벌즈, 전자음 선율)

    return {
      volume: volume,
      subBass: subBass,
      bass: bass,
      mid: mid,
      treble: treble,
      raw: Array.from(this.dataArray) // 필요한 경우 전체 배열도 그대로 전달
    };
  }
}
