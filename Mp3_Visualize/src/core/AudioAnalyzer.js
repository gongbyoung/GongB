/**
 * AudioAnalyzer.js
 * 주파수 분석 및 가변 범위 그룹핑, 오디오 소스 중복 연결 방지 로직 탑재
 */
export class AudioAnalyzer {
  constructor(fftSize = 2048) {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.fftSize = fftSize;
    
    // 💡 [중복 연결 방지] 어떤 오디오 엘리먼트가 이미 연결되었는지 기록할 플래그
    this.isConnected = false;

    // 동적 튜닝을 위한 상태 변수
    this.bounds = {
      bassLow: 20,     bassHigh: 250,
      midLow: 250,     midHigh: 4000,
      trebleLow: 4000, trebleHigh: 16000
    };
  }

  init() {
    if (this.audioContext) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8; 
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  connectAudioElement(audioElement) {
    this.init();
    
    // 💡 [핵심 가드 로직] 이미 한 번이라도 노드가 생성/연결되었다면 프로세스를 패스합니다.
    // 플레이어 소스(src)가 바뀌어도 기존 파이프라인 줄기는 그대로 재사용이 가능하기 때문입니다.
    if (this.isConnected) {
      // 오디오 컨텍스트가 브라우저 보안 정책으로 정지되어 있다면 깨워만 줍니다.
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      return;
    }

    // 최초 1회만 노드 생성 및 브라우저 하드웨어 아웃풋 연결
    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    this.isConnected = true; // 💥 연결 완료 낙인 찍기
    console.log('[🎯 Analyzer] 오디오 파이프라인 최초 연결 완료');
  }

  getAverageVolumeInRange(lowFreq, highFreq) {
    if (!this.analyser) return 0;

    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const hzPerBin = sampleRate / this.fftSize; 

    const lowIndex = Math.floor(lowFreq / hzPerBin);
    const highIndex = Math.min(Math.floor(highFreq / hzPerBin), binCount - 1);

    if (lowIndex > highIndex) return 0;

    let sum = 0;
    let count = 0;

    for (let i = lowIndex; i <= highIndex; i++) {
      sum += this.dataArray[i];
      count++;
    }

    return count > 0 ? (sum / count) / 255 : 0;
  }

  updateBounds(newBounds) {
    this.bounds = { ...this.bounds, ...newBounds };
  }

// src/core/AudioAnalyzer.js 내부의 getAudioData 함수 구역 교체

  getAudioData() {
    if (!this.analyser) {
      return { volume: 0, bass: 0, mid: 0, treble: 0, subBass: 0, raw: [], text: "", image: null };
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    let totalSum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      totalSum += this.dataArray[i];
    }
    const volume = (totalSum / this.dataArray.length) / 255;

    const subBass = this.getAverageVolumeInRange(20, 60);     
    const bass = this.getAverageVolumeInRange(this.bounds.bassLow, this.bounds.bassHigh);       
    const mid = this.getAverageVolumeInRange(this.bounds.midLow, this.bounds.midHigh);      
    const treble = this.getAverageVolumeInRange(this.bounds.trebleLow, this.bounds.trebleHigh);  

    // 💡 [정식 이식] window 전역에 안전하게 보관된 실시간 자막과 이미지 객체를 
    // 분석 데이터 팩에 안전하게 탑승시켜 배달합니다.
    return {
      volume: volume,
      subBass: subBass,
      bass: bass,
      mid: mid,
      treble: treble,
      raw: Array.from(this.dataArray),
      text: window.currentSubtitleText || "",
      image: window.currentUploadedImageElement || null
    };
  }
}
