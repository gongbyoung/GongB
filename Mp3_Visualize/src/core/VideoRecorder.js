/**
 * src/core/VideoRecorder.js
 * (중복 저장 방지 및 딱 한 번만 깔끔하게 떨어지도록 설계된 단발성 엔진)
 */
class VideoRecorder { 
  constructor(containerOrCanvas, fps = 30) {
    this.targetElement = containerOrCanvas; 
    this.fps = fps;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    // 이벤트 리스너 해제를 위한 바인딩
    this.onAudioEnded = this.handleAudioEnded.bind(this);
  }

  start() {
    // 💡 이미 녹화 중이면 중복 클릭 방어
    if (this.isRecording) return;
    
    let actualCanvas = document.querySelector('canvas');
    if (!actualCanvas) {
        alert("녹화할 캔버스가 없습니다. 스케치를 먼저 켜주세요.");
        return;
    }

    this.isRecording = true;
    this.recordedChunks = [];
    console.log(`[🎥 Recorder] 녹화 시작: ${actualCanvas.width}x${actualCanvas.height} (${this.fps}fps)`);

    const videoStream = actualCanvas.captureStream(this.fps);
    const combinedStream = new MediaStream(videoStream.getVideoTracks());

    const audioEl = document.querySelector('audio');
    if (audioEl) {
        let audioStream;
        if (audioEl.captureStream) audioStream = audioEl.captureStream();
        else if (audioEl.mozCaptureStream) audioStream = audioEl.mozCaptureStream(); 

        if (audioStream) {
            const audioTracks = audioStream.getAudioTracks();
            if (audioTracks.length > 0) combinedStream.addTrack(audioTracks[0]); 
        }

        // 💡 1번만 실행되는(단발성) 이벤트 리스너 부착
        audioEl.addEventListener('ended', this.onAudioEnded, { once: true });
        
        // 오디오를 0초로 돌리고 재생
        audioEl.currentTime = 0;
        audioEl.play().catch(e => console.warn("오디오 재생 실패:", e));
    }

    let options = { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 8000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 8000000 };
    }

    try {
        this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
        this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
        }
    };

    this.mediaRecorder.onstop = () => {
        this.saveVideo();
    };

    this.mediaRecorder.start();
  }

  handleAudioEnded() {
      console.log("🎵 음악 종료: 단 1번만 녹화를 종료하고 저장합니다.");
      this.stop();
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;
    
    // 💡 녹화기 안전 종료
    if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
    }
    this.isRecording = false;

    // 만약을 대비한 이벤트 리스너 수동 제거
    const audioEl = document.querySelector('audio');
    if (audioEl) {
        audioEl.removeEventListener('ended', this.onAudioEnded);
    }
    
    console.log("⏹️ 녹화 종료 처리 중...");
  }

  saveVideo() {
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const date = new Date();
    const timeStr = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
    a.download = `Cosmic_Studio_Art_${timeStr}.webm`;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("💾 영상 파일 다운로드 완료!");
    }, 100);
  }
}

export default VideoRecorder;
export { VideoRecorder };
