/**
 * src/core/VideoRecorder.js
 * (Canvas 요소 자동 탐색 및 해상도 인식 픽스판)
 */
export class VideoRecorder { 
  constructor(containerOrCanvas, fps = 30) {
    // 💡 전달받은 요소가 진짜 캔버스인지, 껍데기 박스(div)인지 일단 저장합니다.
    this.targetElement = containerOrCanvas; 
    this.fps = fps;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    
    // 오디오 컨텍스트
    this.audioCtx = null;
    this.audioSource = null;
    this.audioDest = null;
  }

  start() {
    if (this.isRecording) return;
    this.recordedChunks = [];

    // 💡 [핵심 수정] 박스(div)가 들어왔다면 그 안에서 진짜 도화지(canvas)를 찾아냅니다.
    let actualCanvas = this.targetElement;
    if (actualCanvas && actualCanvas.tagName !== 'CANVAS') {
        actualCanvas = actualCanvas.querySelector('canvas');
    }

    // 도화지를 찾지 못했을 경우의 안전장치
    if (!actualCanvas) {
        console.error("❌ [Recorder Error] 녹화할 캔버스(Canvas) 요소를 찾을 수 없습니다.");
        return;
    }

    console.log(`[🎥 Recorder] 녹화 시작: ${actualCanvas.width}x${actualCanvas.height} (${this.fps}fps)`);

    // 1. 진짜 캔버스에서 비디오 스트림 캡처
    const videoStream = actualCanvas.captureStream(this.fps);
    const combinedStream = new MediaStream(videoStream.getVideoTracks());

    // 2. 오디오 스트림 캡처 및 병합 (영상 파일에 음악 포함)
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

        // 음악 0초로 강제 되감기 후 재생
        audioEl.currentTime = 0;
        audioEl.play();

        // 음악이 끝나면 자동으로 녹화 종료
        audioEl.onended = () => {
            console.log("🎵 음악 종료: 녹화를 자동으로 완료하고 저장합니다.");
            this.stop();
        };
    }

    // 3. MediaRecorder 설정
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
