/**
 * src/core/VideoRecorder.js
 * - 설정 통합 및 4K/고해상도 자동 대응
 * - 단발성 녹화 및 오디오 동기화 엔진
 */
class VideoRecorder { 
  constructor(containerOrCanvas, fps = 30) {
    this.targetElement = containerOrCanvas; 
    this.fps = fps;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.onAudioEnded = this.handleAudioEnded.bind(this);
  }

  start() {
    if (this.isRecording) return;
    
    let actualCanvas = document.querySelector('canvas');
    if (!actualCanvas) {
        alert("녹화할 캔버스가 없습니다. 스케치를 먼저 켜주세요.");
        return;
    }

    this.isRecording = true;
    this.recordedChunks = [];
    console.log(`[🎥 Recorder] 녹화 시작: ${actualCanvas.width}x${actualCanvas.height} (${this.fps}fps)`);

    // 영상 스트림 캡처
    const videoStream = actualCanvas.captureStream(this.fps);
    const combinedStream = new MediaStream(videoStream.getVideoTracks());

    // 오디오 스트림 병합
    const audioEl = document.querySelector('audio');
    if (audioEl) {
        let audioStream = audioEl.captureStream ? audioEl.captureStream() : 
                          (audioEl.mozCaptureStream ? audioEl.mozCaptureStream() : null);

        if (audioStream && audioStream.getAudioTracks().length > 0) {
            combinedStream.addTrack(audioStream.getAudioTracks()[0]); 
        }

        audioEl.addEventListener('ended', this.onAudioEnded, { once: true });
        audioEl.currentTime = 0;
        audioEl.play().catch(e => console.warn("오디오 재생 실패:", e));
    }

    // 💡 설정 통합: 브라우저가 지원하는 최고의 코덱을 자동으로 선택
    const mimeTypes = [
        'video/webm; codecs=vp9,opus',
        'video/webm; codecs=vp8,opus',
        'video/webm'
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

    try {
        this.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 8000000 // 8Mbps 고화질 설정
        });
    } catch (e) {
        console.warn("코덱 설정 실패, 기본 인코더 사용");
        this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => this.saveVideo();
    this.mediaRecorder.start();
  }

  handleAudioEnded() {
      console.log("🎵 음악 종료: 녹화 저장 실행.");
      this.stop();
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;
    if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.isRecording = false;

    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.removeEventListener('ended', this.onAudioEnded);
    console.log("⏹️ 녹화 종료 처리 중...");
  }

  saveVideo() {
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Cosmic_Studio_Art_${new Date().toLocaleTimeString()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  }
}

export default VideoRecorder;
export { VideoRecorder };
