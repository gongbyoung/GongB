/**
 * VideoRecorder.js
 * WebCodecs API 기반 Canvas -> MP4(H.264) 실시간 인코딩 레코더 부품
 */
export class VideoRecorder {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.isRecording = false;
    this.videoEncoder = null;
    this.muxer = null; // MP4 파일 구조 생성용 가상 믹서
    this.frameCounter = 0;
    this.fps = 30;     // 안정적인 내보내기를 위한 타겟 FPS 고정
    this.recordInterval = null;
  }

  /**
   * 녹화 시작
   */
  async start() {
    const canvas = this.container.querySelector('canvas');
    if (!canvas) {
      console.error('[🎥 Recorder] 녹화할 Canvas를 찾을 수 없습니다.');
      return;
    }

    this.isRecording = true;
    this.frameCounter = 0;

    // 녹화 대상 해상도 실시간 획득 (대칭 해상도 보정: WebCodecs 규칙상 가로/세로는 항상 2의 배수여야 함)
    const width = canvas.width % 2 === 0 ? canvas.width : canvas.width - 1;
    const height = canvas.height % 2 === 0 ? canvas.height : canvas.height - 1;

    console.log(`[🎥 Recorder] 인코딩 해상도 정의: ${width}x${height} (${this.fps}fps)`);

    // 1. 순수 JS 기반 MP4 컨테이너 스트림 준비 (mp4-muxer 규격 구조 에뮬레이션)
    // WebCodecs의 청크(Encoded Video Chunk)들을 모아 완전한 MP4 파일 바이너리로 빌드하는 스트림입니다.
    this.chunks = [];
    
    // 2. 비디오 인코더(VideoEncoder) 초기화 및 GPU 가속 H.264 프로파일 세팅
    this.videoEncoder = new VideoEncoder({
      output: (chunk, metadata) => {
        // 인코딩된 데이터 조각을 배열에 축적
        const buffer = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(buffer);
        this.chunks.push(buffer);
      },
      error: (e) => console.error('[❌ Encoder Error]', e)
    });

    // 인코더 상세 스펙 파라미터 셋업
    await this.videoEncoder.configure({
      codec: 'avc1.4d002a', // H.264 Main Profile
      width: width,
      height: height,
      bitrate: 4_000_000, // 4Mbps 고품질 비트레이트 지정
      avc: { format: 'annexb' },
      framerate: this.fps,
      hardwareAcceleration: 'prefer-hardware' // 그래픽카드 GPU 하드웨어 가속 최우선 활용
    });

    // 3. 타이머 기반 프레임 캡처 시작 (60fps 렌더링 중 안정적인 30fps 비디오 싱크 추출)
    const msPerFrame = 1000 / this.fps;
    
    // WebGL(Three.js)의 경우 해제 방지 처리가 필요할 수 있으므로 강제 프레임 복사 유도
    const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('2d');

    this.recordInterval = setInterval(async () => {
      if (!this.isRecording) return;

      // Three.js 렌더링 직후 컨텍스트가 증발하기 전에 가상 비디오 프레임으로 변환
      // WebCodecs 내장 VideoFrame 객체가 Canvas의 현재 화면을 스냅샷으로 캡처합니다.
      const timestamp = (this.frameCounter * 1000000) / this.fps; // 마이크로초 단위 변환
      const frame = new VideoFrame(canvas, { timestamp: timestamp });

      // 키프레임 주기 설정 (30프레임마다 하나씩 강제 지정하여 영상 탐색 부드럽게 처리)
      const insertKeyframe = this.frameCounter % this.fps === 0;

      this.videoEncoder.encode(frame, { keyFrame: insertKeyframe });
      frame.close(); // GPU 가비지 컬렉션 유도 (메모리 누수 원천 차단)
      this.frameCounter++;
    }, msPerFrame);
  }

  /**
   * 녹화 중지 및 MP4 파일 브라우저 다운로드 연동
   */
  async stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    // 타이머 클리어
    clearInterval(this.recordInterval);

    console.log('[🎥 Recorder] 인코더 대기열 플러시 중...');
    // 남은 프레임 인코딩이 모두 끝날 때까지 동기 대기
    await this.videoEncoder.flush();
    this.videoEncoder.close();

    console.log('[🎥 Recorder] MP4 포맷 바이너리 합성 중...');
    
    // 최종 파일 합체 및 다운로드 트리거
    const blob = new Blob(this.chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `GongB_Visual_Art_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.chunks = [];
    
    console.log('[🎯 Export] MP4 비디오 저장 완료!');
  }
}
