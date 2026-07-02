/**
 * 006_three_organic_flower.js
 * 극좌표계를 이용해 탑뷰(Top-view) 구조로 주파수와 공명하는 오가닉 비주얼라이저
 */
export default class ThreeOrganicFlower {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.coreMesh = null;   // 중앙 수술/코어
    this.petals = [];       // 방사형 꽃잎/갓털 배열
    this.petalCount = 64;   // 360도를 촘촘하게 채울 꽃잎 총 개수
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 깊이감을 더해줄 부드러운 안개 설정
    this.scene.fog = new THREE.FogExp2(0x020205, 0.05);

    // 완벽한 탑뷰 느낌을 내기 위해 카메라를 정중앙 위에 배치하고 아래(원점)를 내려다보도록 세팅
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 0); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x020205);
    this.container.appendChild(this.renderer.domElement);

    // 은은한 앰비언트 라이트와 상단 포인트 조명
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const centerLight = new THREE.PointLight(0x00ffff, 2, 30);
    centerLight.position.set(0, 5, 0);
    this.scene.add(centerLight);

    // 1. 🟡 중앙 코어(수술) 생성
    const coreGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 0.5,
      roughness: 0.2
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(this.coreMesh);

    // 2. 🌸 방사형 꽃잎(갓털 가닥) 구조 설계
    // 💡 [중앙 고정 테크닉] 박스의 기준점을 정중앙에서 맨 아래 끝(Z = 0.5)으로 이전시킵니다.
    // Three.js 좌표계 상 눕혀서 배열할 것이므로 Z축 방향으로 늘어나도록 translate 처리합니다.
    const petalGeo = new THREE.BoxGeometry(0.06, 0.02, 1.0);
    petalGeo.translate(0, 0, 0.5); 

    for (let i = 0; i < this.petalCount; i++) {
      // 360도를 균등하게 나누는 라디안 각도 계산 (극좌표계 변환용)
      const angle = (i / this.petalCount) * Math.PI * 2;

      // 안쪽에서 바깥쪽으로 부드러운 네온 그라데이션 컬러 매핑 (인덱스 순서 기준)
      let colorHex = 0x00ffcc;
      if (i % 4 === 0) colorHex = 0xff0055;      // Sub-Bass 반응 라인 (핫핑크)
      else if (i % 4 === 1) colorHex = 0x00ffcc; // Bass 반응 라인 (민트)
      else if (i % 4 === 2) colorHex = 0x0077ff; // Mid 반응 라인 (블루)
      else colorHex = 0xaaff00;                  // Treble 반응 라인 (라임)

      const petalMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.8,
        roughness: 0.3
      });

      const petal = new THREE.Mesh(petalGeo, petalMat);

      // 꽃잎을 원형으로 배치하고 각도에 맞게 바깥쪽을 바라보도록 회전 정렬
      petal.position.x = 0;
      petal.position.y = 0;
      petal.position.z = 0;
      petal.rotation.y = -angle; // 💥 극좌표계 회전 정렬

      // 애니메이션 연산을 위해 주파수 매핑 인덱스(0~3)와 가닥 고유 오프셋 저장
      petal.userData = {
        bandType: i % 4,
        angle: angle,
        seed: i * 0.5
      };

      this.scene.add(petal);
      this.petals.push(petal);
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = Date.now() * 0.002;

    if (audioData) {
      // 주파수 4대역을 배열로 구조화
      const bands = [
        audioData.subBass,
        audioData.bass,
        audioData.mid,
        audioData.treble
      ];

      // 1. 🟡 Sub-Bass 파워에 따라 중앙 코어가 심장박동처럼 수축/팽창
      const coreScale = 1.0 + audioData.subBass * 1.5 + Math.sin(time * 2) * 0.05;
      this.coreMesh.scale.set(coreScale, coreScale, coreScale);
      this.coreMesh.material.emissiveIntensity = 0.5 + audioData.subBass * 3.0;

      // 2. 🌸 개별 꽃잎 가닥들의 실시간 유기적 모션 링킹
      this.petals.forEach(petal => {
        const { bandType, angle, seed } = petal.userData;
        const targetAudioValue = bands[bandType];

        // [길이 연산] 내 대역 주파수 세기에 비례해 바깥쪽으로 길어짐
        // 기본 길이 1.5에 주파수 강도와 전체 볼륨의 시너지 가중치를 더해 솟구치게 함
        const targetLength = 1.5 + (targetAudioValue * 5.0) + (audioData.volume * 1.0);
        
        // Lerp로 꽃잎이 튀지 않고 스무스하게 신축하도록 제어
        petal.scale.z = THREE.MathUtils.lerp(petal.scale.z, targetLength, 0.2);

        // [디테일 떨림 연산] Treble(고음) 및 볼륨 세기에 따라 가닥들이 파르르 떨리는 노이즈 추가
        // 미세하게 X축과 Y축 각도를 비틀어 생명력 있는 오가닉 느낌 연출
        if (audioData.treble > 0.1) {
          petal.rotation.x = Math.sin(time * 5 + seed) * (audioData.treble * 0.08);
          petal.rotation.z = Math.cos(time * 5 + seed) * (audioData.treble * 0.08);
        } else {
          petal.rotation.x = THREE.MathUtils.lerp(petal.rotation.x, 0, 0.1);
          petal.rotation.z = THREE.MathUtils.lerp(petal.rotation.z, 0, 0.1);
        }

        // 비트 강도에 따른 네온 발광 밀도 변조
        petal.material.emissiveIntensity = targetAudioValue * 2.0 + 0.1;
      });

      // 전체 꽃 구조를 전체 음악 볼륨의 크기에 맞춰 미세하게 자전(회전)시켜 몽환적인 무드 극대화
      this.scene.rotation.y = time * 0.05 + (audioData.volume * 0.1);
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
    
    if (this.coreMesh) {
      this.coreMesh.geometry.dispose();
      this.coreMesh.material.dispose();
    }

    this.petals.forEach(petal => {
      petal.geometry.dispose();
      petal.material.dispose();
    });

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.petals = [];
  }
}
