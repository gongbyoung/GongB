/**
 * src/core/VideoRecorder.js
 * (Canvas 요소 자동 탐색 및 양방향 Export 만능 호환판)
 */
class VideoRecorder { // 💡 여기서 export 키워드를 뺍니다.
  constructor(containerOrCanvas, fps = 30) {
    this.targetElement = containerOrCanvas; 
    this.fps = fps;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    
    this.audioCtx = null;
    this.audioSource = null;
    this.audioDest = null;
  }

  start() {
    if (this.isRecording) return;
    this.recordedChunks = [];

    let actualCanvas = this.targetElement;
    if (actualCanvas && actualCanvas.tagName !== 'CANVAS') {
        actualCanvas = actualCanvas.querySelector('canvas');
    }

    if (!actualCanvas) {
        console.error("❌ [Recorder Error] 녹화할 캔버스(Canvas) 요소를 찾을 수 없습니다.");
        return;
    }

    console.log(`[🎥 Recorder] 녹화 시작: ${actualCanvas.width}x${actualCanvas.height} (${this.fps}fps)`);

    const videoStream = actualCanvas.captureStream(this.fps);
    const combinedStream = new MediaStream(videoStream.getVideoTracks());

    const audioEl = document.querySelector('audio');
    if (audioEl) {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!this.audioSource) {
                this.audioSource = this.audioCtx.createMediaElementSource(audioEl);
                this.audioDest = this.audioCtx.createMediaStreamDestination();
                
                this.audioSource.connect(this.audioDest);
                this.audioSource.connect(this.audioCtx.destination);
            }
            
            const audioTrack = this.audioDest.stream.getAudioTracks()[0];
            if (audioTrack) {
                combinedStream.addTrack(audioTrack);
            }
        } catch (err) {
            console.warn("오디오 캡처 우회 (영상만 녹화됩니다):", err);
        }

        audioEl.currentTime = 0;
        audioEl.play();

        audioEl.onended = () => {
            console.log("🎵 음악 종료: 녹화를 자동으로 완료하고 저장합니다.");
            this.stop();
        };
    }

    let options = { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 8000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 8000000 };
    }

    try {
        this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
        console.warn("기본 코덱으로 폴백합니다.", e);
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
    this.isRecording = true;
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;
    
    this.mediaRecorder.stop();
    this.isRecording = false;

    const audioEl = document.querySelector('audio');
    if (audioEl) {
        audioEl.pause();
        audioEl.onended = null; 
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

// 💡 [가장 핵심 포인트] main.js가 어떤 이름표를 요구하든 다 받아주도록 두 가지 방식을 모두 열어둡니다!
export default VideoRecorder;         // 'import VideoRecorder from ...' 일 때 작동
export { VideoRecorder };             // 'import { VideoRecorder } from ...' 일 때 작동
