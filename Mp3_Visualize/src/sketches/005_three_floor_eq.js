/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 1.0 (디지털 LED 칸막이 도트 매트릭스 게이지 및 배경 주입 통합판)
 * - 통막대 연산 방식을 폐기하고, 32개 채널별로 15칸의 독립된 LED 셀들이 수직으로 차오르는 아날로그 격자 레이아웃 시공
 * - scene.background 직통 링커를 이식하여 main.js 관제탑의 업로드 이미지를 무결점으로 상시 배경 투사 보장
 * - 주파수 대역별 그라데이션 컬러 존(네온 핑크 -> 시안 -> 블루 -> 연두) 및 정면 직교 고정 시점 유지
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = []; // 각 채널의 마스터 노드 배열
    
    this.barCount = 32; // 주파수 채널 총 개수
    this.maxCells = 15; // 수직으로 쪼개져 쌓일 칸막이 최대 도트 개수
    
    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;
    
    this.version = "005호 LED 도트 매트릭스 EQ Ver 1.0";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    // 정면 직교 카메라(OrthographicCamera) 시점 픽셀 매핑 스펙 유지
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0.0); 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // 기본 셀 형태 (기준점을 맨 아래 Y = -0.5 로 세팅하여 위로만 스택 배치)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);

    this.buildSegmentMatrix(width, height, geometry);
    this.setupDirectInputTracker();
  }

  /**
   * 💡 [도트 그리드 격자 대시공] 채널별로 세로 칸막이를 개별 생성 배치하는 함수
   */
  buildSegmentMatrix(width, height, geometry) {
    // 기존에 배치된 메쉬 전수 파괴 제거
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => this.scene.remove(cellMesh));
    });
    this.eqBars = [];

    const barWidth = (width / this.barCount) * 0.82; // 가로폭 여백
    const startX = -width / 2 + barWidth / 2 + (width / this.barCount) * 0.09;
    const bottomY = -height / 2 + 10; // 💥 화면 최하단에서 10픽셀 살짝 띄워 정돈

    // 화면 세로 한도의 75% 공간을 도트들이 나누어 가지도록 셀 정밀 높이 연산
    const totalHeightLimit = height * 0.75;
    const cellHeight = (totalHeightLimit / this.maxCells) * 0.85; // 세로 블록 크기
    const cellSpacing = (totalHeightLimit / this.maxCells) * 0.15; // 칸과 칸 사이의 칼여백

    for (let i = 0; i < this.barCount; i++) {
      // 대역폭별 아날로그 네온 컬러 그라데이션 라벨 유지
      let colorHex = 0x00ffcc;
      if (i < this.barCount * 0.15) colorHex = 0xff0055;      // Sub-Bass Zone
      else if (i < this.barCount * 0.4) colorHex = 0x00ffcc;  // Bass Zone
      else if (i < this.barCount * 0.75) colorHex = 0x0077ff; // Mid Zone
      else colorHex = 0xaaff00;                               // Treble Zone

      const channelObj = {
        cells: [],
        sampleIndex: Math.floor((i / this.barCount) * 160), // 감도 최적화를 위해 활성 주파수 인덱스 최적 배정
        smoothedHeight: 0
      };

      // 💡 한 채널당 수직으로 maxCells(15칸)만큼 메쉬를 선형 적재 빌드
      for (let j = 0; j < this.maxCells; j++) {
        // 꺼져있을 때의 기본 은은한 반투명 재질 세팅 (아날로그 소등 감성)
        const material = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.08, // 평소에는 거의 꺼진 듯이 투명하게 대기
          depthWrite: false
        });

        const cellMesh = new THREE.Mesh(geometry, material);
        
        // 도트 물리 스케일 주입
        cellMesh.scale.x = barWidth;
        cellMesh.scale.y = cellHeight;
        cellMesh.scale.z = 1;

        // X축은 대역폭 정렬 위치, Y축은 수직으로 한 칸씩 계단식 누적 쌓기 연산
        cellMesh.position.x = startX + i * (width / this.barCount);
        cellMesh.position.y = bottomY + j * (cellHeight + cellSpacing);
        cellMesh.position.z = 0;

        this.scene.add(cellMesh);
        channelObj.cells.push(cellMesh);
      }

      this.eqBars.push(channelObj);
    }
  }

  /**
   * 💡 [배경 이미지 직통 바인딩 엔진] 002호 무결점 파이프라인 완벽 이식
   */
  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = "";
      let sourceElement = null;

      // 관제탑 main.js의 리소스 텍스처 업로드 메모리 다이렉트 캡처
      if (window.currentUploadedImageElement && window.currentUploadedImageElement.src) {
        targetSrc = window.currentUploadedImageElement.src;
        sourceElement = window.currentUploadedImageElement;
      } else {
        const allImgs = document.querySelectorAll('.media-resources img') || document.querySelectorAll('img');
        for (let img of allImgs) {
          if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview') || img.src.includes('data:image'))) {
            targetSrc = img.src;
            sourceElement = img;
            break;
          }
        }
      }

      if (targetSrc && targetSrc !== this.lastBgSrc && sourceElement) {
        this.lastBgSrc = targetSrc;
        try {
          const tex = new THREE.Texture(sourceElement);
          tex.needsUpdate = true;
          this.bgTexture = tex;
          
          // 💡 정면 직교 레이어에서도 버퍼 침범 없이 투사되도록 씬 배경 인스턴스에 칼고정
          this.scene.background = this.bgTexture;
        } catch (e) {
          const loader = new THREE.TextureLoader();
          loader.load(targetSrc, (t) => {
            this.bgTexture = t;
            this.scene.background = this.bgTexture;
          });
        }
      }
    };

    this.domObserver = new MutationObserver(() => { forceSyncTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceSyncTexture, 1000);
    setTimeout(forceSyncTexture, 500);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (audioData && audioData.raw && audioData.raw.length > 0) {
      
      this.eqBars.forEach(channel => {
        const rawValue = (audioData.raw[channel.sampleIndex] || 0) / 255;

        // 고음 감도 데시벨 밸런싱 보정 가중치
        let boost = 1.0;
        if (channel.sampleIndex > 110) boost = 2.4;
        else if (channel.sampleIndex > 60) boost = 1.7;

        const targetActivePower = rawValue * boost;
        channel.smoothedHeight = THREE.MathUtils.lerp(channel.smoothedHeight, targetActivePower, 0.24);

        // 💡 [실시간 칸수 제어 구역] 
        // 총 15칸 중 현재 오디오 볼륨 강도에 부합하는 활성 칸수 경계 수치 도출
        const activeThreshold = channel.smoothedHeight * this.maxCells;

        channel.cells.forEach((cellMesh, index) => {
          if (index < activeThreshold) {
            // 💥 볼륨 진폭이 뚫고 올라온 활성 칸: 불빛이 100% 네온 네이티브로 강하게 점등
            cellMesh.material.opacity = 0.95;
            cellMesh.scale.z = 1.2; // 입체감을 위해 점등된 셀은 살짝 앞으로 돌출진동
          } else {
            // 💤 진폭이 도달하지 못한 미달 칸: 은은한 기본 끄기 투명도 상태 유지
            cellMesh.material.opacity = 0.08;
            cellMesh.scale.z = 1.0;
          }
        });
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0, 0.5, 0);
      this.buildSegmentMatrix(w, h, geometry);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => {
        cellMesh.geometry.dispose();
        cellMesh.material.dispose();
      });
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = [];
  }
}
