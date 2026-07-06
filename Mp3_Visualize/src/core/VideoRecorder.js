/**
 * src/core/VideoRecorder.js
 * (Export 에러 완벽 차단 및 Canvas 강제 탐색 무적판)
 */
class VideoRecorder { 
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

    // 💡 [녹화 에러 완벽 해결] main.js가 이상한 값을 넘겨주더라도 무시하고, 
    // 웹페이지에 떠 있는 진짜 <canvas> 태그를 무조건 강제로 찾아냅니다!
    let actualCanvas = document.querySelector('canvas');

    if (!actualCanvas) {
        console.error("❌ [Recorder Error] 화면에 캔버스(Canvas)가 존재하지 않습니다.");
        alert("녹화할 화면이 없습니다. 스케치를 먼저 로딩해 주세요.");
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

        // 음악 동기화 (처음부터 재생)
        audioEl.currentTime = 0;
        audioEl.play();

        // 음악 끝나면 자동 녹화 종료
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

// 💡 [로딩 에러 완벽 해결] 중괄호({}) 유무에 상관없이 모두 호출 가능하도록 2가지 방식 모두 내보냅니다!
export default VideoRecorder;
export { VideoRecorder };
