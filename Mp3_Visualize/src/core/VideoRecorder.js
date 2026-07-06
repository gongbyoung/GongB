/**
 * src/core/VideoRecorder.js
 * 4K급 초고해상도 에러 무한 지원 및 오디오 자동 동기화/녹음 엔진 탑재
 * (export 문법 및 자동 재생 교정판)
 */
class VideoRecorder { 
  constructor(canvas, fps = 30) {
    this.canvas = canvas;
    this.fps = fps;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    
    // 오디오 컨텍스트 (영상에 음악을 함께 녹음하기 위함)
    this.audioCtx = null;
    this.audioSource = null;
    this.audioDest = null;
  }

  start() {
    if (this.isRecording) return;
    this.recordedChunks = [];

    console.log(`[🎥 Recorder] 녹화 시작: ${this.canvas.width}x${this.canvas.height} (${this.fps}fps)`);

    // 1. 캔버스 비디오 스트림 캡처
    const videoStream = this.canvas.captureStream(this.fps);
    const combinedStream = new MediaStream(videoStream.getVideoTracks());

    // 2. 오디오 스트림 캡처 및 병합 (영상 파일에 음악 포함)
    const audioEl = document.querySelector('audio');
    if (audioEl) {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!this.audioSource) {
                // 한 번만 소스 연결
                this.audioSource = this.audioCtx.createMediaElementSource(audioEl);
                this.audioDest = this.audioCtx.createMediaStreamDestination();
                
                // 오디오를 녹음기와 스피커 양쪽으로 동시 출력
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

        // 💡 [동기화 추가] 음악 0초로 강제 되감기 후 재생
        audioEl.currentTime = 0;
        audioEl.play();

        // 💡 [자동 종료 추가] 음악이 끝나면 자동으로 녹화 종료
        audioEl.onended = () => {
            console.log("🎵 음악 종료: 녹화를 자동으로 완료하고 저장합니다.");
            this.stop();
        };
    }

    // 3. MediaRecorder 설정 (고화질 WebM/VP9 코덱 사용)
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

    // 4. 녹화 시작
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
        audioEl.onended = null; // 이벤트 해제
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

// 💡 [수정] main.js와 짝을 맞추기 위해 export default를 사용합니다.
export default VideoRecorder;
