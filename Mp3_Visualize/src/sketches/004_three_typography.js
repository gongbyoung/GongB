/**
 * 004_three_typography.js
 * SRT 자막, 커스텀 이미지, 오디오 반응성이 융합된 3D 타이포 무대
 */
export default class ThreeTypography {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // 1. 자막 렌더링용 가상 2D 캔버스 빌드
    this.textCanvas = document.createElement('canvas');
    this.textCtx = this.textCanvas.getContext('2d');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 256;
    
    this.textTexture = null;
    this.textMesh = null;
    
    // 2. 유저 업로드 배경 이미지 처리를 위한 판(Plane) 세팅
    this.bgTexture = null;
    this.bgMesh = null;
    
    this.lastText = "";
    this.lastImageSrc = null; // 이미지 중복 로드 방지용 체크 변수
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 공간감 연출을 위한 안개(Fog) 설정
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // 레코더 캡처를 위해 preserveDrawingBuffer 필수 주입
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // [레이어 A] 배경 이미지 마스크 판데기 배치
    const bgGeo = new THREE.PlaneGeometry(16, 9);
    // 초기에는 은은한 다크 그레이 기본 배경색 지정
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x05050a, side: THREE.DoubleSide });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.z = -5; // 자막 글씨보다 훨씬 뒤쪽에 배치
    this.scene.add(this.bgMesh);

    // [레이어 B] 가상 자막 네온 텍스처 Plane 배치
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    const textGeo = new THREE.PlaneGeometry(6, 1.5);
    const textMat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.textMesh = new THREE.Mesh(textGeo, textMat);
    this.textMesh.position.z = 0;
    this.scene.add(this.textMesh);

    // 최초 안내 메시지 인쇄
    this.drawText("상단에서 MP3, SRT, 이미지를 올린 뒤 재생하세요!");
  }

  /**
   * 2D 자막 드로잉 및 네온 텍스처 업데이트
   */
  drawText(text) {
    const ctx = this.textCtx;
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
    
    // 투명 배경 유지
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // 폰트 스타일 튜닝
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 사이키델릭 네온 빛 번짐 발광 효과
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#ffffff';
    
    ctx.fillText(text, this.textCanvas.width / 2, this.textCanvas.height / 2);
    
    if (this.textTexture) this.textTexture.needsUpdate = true;
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (audioData) {
      // 💥 [실시간 연동 1] 유저 업로드 이미지 감지 및 3D 텍스처 주입
      if (audioData.image && audioData.image.src !== this.lastImageSrc) {
        this.lastImageSrc = audioData.image.src;
        
        // Three.js 텍스처 모듈로 실시간 변환하여 배경 메쉬에 바인딩
        if (this.bgTexture) this.bgTexture.dispose();
        this.bgTexture = new THREE.Texture(audioData.image);
        this.bgTexture.needsUpdate = true;
        
        this.bgMesh.material.color.setHex(0xffffff); // 기본 어둠 마스크 걷어내기
        this.bgMesh.material.map = this.bgTexture;
        this.bgMesh.material.transparent = true;
        this.bgMesh.material.opacity = 0.4; // 자막이 잘 보이도록 배경은 투명도 조절
        this.bgMesh.material.needsUpdate = true;
        console.log("[🎯 4호 스케치] 3D 스튜디오 배경 이미지 교체 성공!");
      }

      // 💥 [실시간 연동 2] 오디오 동기화 자막 리프레시
      const currentText = audioData.text || "🎵 MUSIC VISUAL STAGE 🎵";
      if (currentText !== this.lastText) {
        this.drawText(currentText);
        this.lastText = currentText;
        
        // 새로운 글자가 등장할 때 줌인 텐션 펄스 충격파 연출
        this.camera.position.z = 4.3;
      }

      // 💥 [실시간 연동 3] 오디오 주파수 수치 반응형 모션 제어
      // 충격파로 당겨진 카메라를 원위치(Z=5)로 부드럽게 복구
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 5, 0.08);

      // 저음(Bass)의 타격감에 따라 글자판이 앞뒤로 뛰며 스케일 진동
      const textScale = 1 + audioData.bass * 0.4;
      this.textMesh.scale.set(textScale, textScale, 1);

      // 중음/전체 소리 크기(Volume)에 따라 뒷배경 커스텀 이미지가 입체적으로 울렁거림
      if (this.bgMesh) {
        const bgScale = 1 + audioData.volume * 0.15;
        this.bgMesh.scale.set(bgScale, bgScale, 1);
        this.bgMesh.rotation.z = Math.sin(Date.now() * 0.001) * (audioData.mid * 0.05);
      }

      // 텍스트 글자판 자체도 음악에 맞춰 오묘하게 3D 회전 무빙
      this.textMesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.2;
      this.textMesh.rotation.x = Math.cos(Date.now() * 0.0015) * 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    if (this.textTexture) this.textTexture.dispose();
    if (this.bgTexture) this.bgTexture.dispose();
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}