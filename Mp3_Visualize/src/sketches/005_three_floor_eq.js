/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 3.0 (5대 변형 커스텀 스타일 및 파도선 / 외곽선 박스 셔플 매트릭스 완결판)
 * - 스타일 1: 바다색 그라디언트 (아래 어둡고 위가 밝은 청량한 아쿠아 마린 블루)
 * - 스타일 2: 불색 그라디언트 (아래 밝고 강렬하며 위로 갈수록 어두워지는 스모크 파이어 레드)
 * - 스타일 3: 가상 픽커 커스텀 배색 링크 고정
 * - 스타일 4: 아래칸 제거 후 최고 피크 정점들만 스무스하게 이어 실시간으로 출렁이는 네온 파도(Wave)선 연출
 * - 스타일 5: 면 채움 없이 순수 사각형 외곽 테두리선(Wireframe Only)으로만 구성된 개별 도트 올랜덤 컬러 셔플
 * - 분산범위(가로간격), 지형변경(주파수 셔플), 발광(밝기), 폭발력(볼륨 높이) 및 무결점 배경 주입 완벽 연동
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = []; 
    this.waveLineMesh = null; // 4번 스타일 전용 스무스 파도선
    
    this.barCount = 32; 
    this.maxCells = 15; 
    
    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.sampleIndices = []; 
    this.currentWidth = 0;
    this.currentHeight = 0;
    
    this.version = "005호 5대 신형 스타일 스펙트럼 Ver 3.0";
  }

  init() {
    this.currentWidth = this.container.clientWidth;
    this.currentHeight = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-this.currentWidth / 2, this.currentWidth / 2, this.currentHeight / 2, -this.currentHeight / 2, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(0x000000, 0.0); 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);

    this.syncUISettings();
    this.buildSegmentMatrix(geometry);
    this.buildWaveLineContainer(); 
    this.setupDirectInputTracker();
  }

  syncUISettings() {
    if (window.cosmicEngineSettings) {
      const global = window.cosmicEngineSettings;
      this.uiSettings.seed = global.seed ?? 42;
      // 9:16 최적화를 위해 가로 스케터 픽셀 간격 축 매핑 보정
      this.uiSettings.scatter = THREE.MathUtils.mapLinear(global.scatterExponent ?? 2.2, 0.5, 5.0, 45, 8);
      this.uiSettings.style = global.colorStyle ?? 'neon';
      this.uiSettings.glow = (global.glowIntensity ?? 0.85) * 100; 
      this.uiSettings.gain = (global.audioGain ?? 1.0) * 100;
      this.uiSettings.customColors = global.customColors ?? { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }
  }

  buildSegmentMatrix(geometry) {
    this.eqBars.forEach(channel => {
      channel.cells.forEach(cellMesh => this.scene.remove(cellMesh));
    });
    this.eqBars = [];

    const totalScatterWidth = THREE.MathUtils.mapLinear(this.uiSettings.scatter, 5, 50, this.currentWidth * 0.98, this.currentWidth * 0.4);
    const barWidth = (totalScatterWidth / this.barCount) * 0.85; 
    const startX = -totalScatterWidth / 2 + barWidth / 2;
    const bottomY = -this.currentHeight / 2 + 15;

    const totalHeightLimit = this.currentHeight * 0.82;
    const cellHeight = (totalHeightLimit / this.maxCells) * 0.86;
    const cellSpacing = (totalHeightLimit / this.maxCells) * 0.14;

    this.sampleIndices = [];
    for (let i = 0; i < 256; i++) this.sampleIndices.push(i);
    
    let seedValue = this.uiSettings.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = this.sampleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [this.sampleIndices[i], this.sampleIndices[j]] = [this.sampleIndices[j], this.sampleIndices[i]];
    }

    for (let i = 0; i < this.barCount; i++) {
      // 💡 [개조 사항] 신형 1~3번 그라디언트 컬러 좌표 기획 시공
      let bottomColor = new THREE.Color();
      let topColor = new THREE.Color();

      if (this.uiSettings.style === 'monochrome') {
        // 1. 바다색 그라디언트: 아래 어두운 블루 ➡️ 위 밝은 시안 실버 블루
        bottomColor.setHex(0x002244); 
        topColor.setHex(0x33ccff);   
      } else if (this.uiSettings.style === 'pastel') {
        // 2. 불색 그라디언트: 아래 밝은 네온 레드 오렌지 ➡️ 위 어두운 다크 블러드 크림슨
        bottomColor.setHex(0xff3300); 
        topColor.setHex(0x220000);   
      } else if (this.uiSettings.style === 'custom') {
        // 3. 커스텀 지정 배색
        bottomColor.set(this.uiSettings.customColors.gas1);
        topColor.set(this.uiSettings.customColors.gas2);
      } else {
        // 4, 5번 레이아웃 및 쉴드 기본 배색 (Cyberpunk Pink-Mint)
        bottomColor.setHex(0xff0055);
        topColor.setHex(0x00ffcc);
      }

      // 커스텀 버텍스/프레그먼트 빌더 매핑
      const material = new THREE.ShaderMaterial({
        uniforms: {
          u_bottomColor: { value: bottomColor },
          u_topColor: { value: topColor },
          u_opacity: { value: 0.1 },
          u_wireOnly: { value: 0.0 } // 5번 와이어프레임 플래그
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 u_bottomColor;
          uniform vec3 u_topColor;
          uniform float u_opacity;
          uniform float u_wireOnly;
          varying vec2 vUv;
          void main() {
            vec3 gradColor = mix(u_bottomColor, u_topColor, vUv.y);
            
            // 일반 격자 셀 테두리 마스크 보간
            float borderX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            float borderY = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
            float mask = borderX * borderY;

            // 💡 스타일 5번 제어: u_wireOnly 가 활성화되면 속을 도려내고 엣지선만 표현
            if (u_wireOnly > 0.5) {
               mask = (mask < 0.95) ? 1.0 : 0.0;
               if(mask < 0.1) discard; // 내부 픽셀 제거
            }

            gl_FragColor = vec4(gradColor, u_opacity * mask);
          }
        `,
        transparent: true,
        depthWrite: false
      });

      const channelObj = {
        cells: [],
        materials: [],
        sampleIndex: this.sampleIndices[i % 256], 
        smoothedHeight: 0,
        posX: startX + i * (totalScatterWidth / this.barCount)
      };

      for (let j = 0; j < this.maxCells; j++) {
        const cellMat = material.clone();
        
        // 스타일 5번 우회 예외: 테두리만 남기고 올 랜덤 컬러 처리 시
        if (this.uiSettings.style !== 'monochrome' && this.uiSettings.style !== 'pastel' && this.uiSettings.style !== 'custom' && this.uiSettings.style !== 'full-random') {
            cellMat.uniforms.u_wireOnly.value = 1.0; // 5번 외곽선 기능 활성화
            
            // 128개 모든 칸막이 도트가 완벽히 독립된 무작위 랜덤 색상 셔플 바인딩
            let randColor = new THREE.Color();
            randColor.setHSL(seededRandom(), 1.0, 0.6);
            cellMat.uniforms.u_bottomColor.value.copy(randColor);
            cellMat.uniforms.u_topColor.value.copy(randColor);
        }

        const cellMesh = new THREE.Mesh(geometry, cellMat);
        cellMesh.scale.set(barWidth, cellHeight, 1);
        cellMesh.position.set(channelObj.posX, bottomY + j * (cellHeight + cellSpacing), 0);

        this.scene.add(cellMesh);
        channelObj.cells.push(cellMesh);
        channelObj.materials.push(cellMat);
      }

      this.eqBars.push(channelObj);
    }
  }

  // 💡 [스타일 4번 대수술] 최고 피크를 하나로 부드럽게 이어서 출렁이게 만들 스플라인 파도선 라인 컨테이너
  buildWaveLineContainer() {
    if (this.waveLineMesh) this.scene.remove(this.waveLineMesh);
    
    const lineGeo = new THREE.BufferGeometry();
    // 부드러운 보간 정점을 위해 채널 수의 4배 서브 포인터 배치
    const positions = new Float32Array(this.barCount * 4 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 4, // 굵고 선명한 네온 라인 효과
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.waveLineMesh = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.waveLineMesh);
  }

  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = "";
      let sourceElement = null;

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

    this.syncUISettings();
    this.renderer.clear();

    const time = Date.now() * 0.001;

    if (audioData && audioData.raw && audioData.raw.length > 0) {
      const peakPoints = []; // 파도선 생성용 정점 배열

      // 💡 [발광/크기 ➡️ 색의 밝기 매칭] 
      const glowMultiplier = THREE.MathUtils.mapLinear(this.uiSettings.glow, 10, 250, 0.5, 4.0);
      // 💡 [폭발력 ➡️ 볼륨 높이 마스터 매칭] 
      const gainMultiplier = parseFloat(this.uiSettings.gain) / 100;

      this.eqBars.forEach((channel) => {
        const rawValue = (audioData.raw[channel.sampleIndex] || 0) / 255;

        let sensitivityBoost = 1.0;
        if (channel.sampleIndex > 110) sensitivityBoost = 2.4;
        else if (channel.sampleIndex > 60) sensitivityBoost = 1.7;

        const targetHeight = rawValue * sensitivityBoost * gainMultiplier;
        channel.smoothedHeight = THREE.MathUtils.lerp(channel.smoothedHeight, targetHeight, 0.24);

        const activeThreshold = channel.smoothedHeight * this.maxCells;
        
        // 파도선 추적용 로컬 최고점 피크값 산출 변수
        let channelHighestY = -this.currentHeight / 2 + 15;

        channel.materials.forEach((mat, cellIdx) => {
          // 실시간 밝기 배율 실시간 곱 연산 적용
          mat.uniforms.u_bottomColor.value.multiplyScalar(glowMultiplier);
          mat.uniforms.u_topColor.value.multiplyScalar(glowMultiplier);

          // 💡 스타일 4번 조건 판정 시: 아래칸 다 지우고 채움 없이 무조건 투명 은폐 시공
          if (this.uiSettings.style === 'full-random') {
             mat.uniforms.u_opacity.value = 0.0; // 강제 소등 처리
             
             // 최고 파도의 위치 정점만 역산하여 좌표 백업
             if (cellIdx < activeThreshold) {
                 channelHighestY = channel.cells[cellIdx].position.y + (channel.cells[cellIdx].scale.y);
             }
          } 
          // 그 외 일반 그라디언트 및 5번 외곽선 셔플 스타일 구동 분기
          else {
             if (cellIdx < activeThreshold) {
               mat.uniforms.u_opacity.value = 0.95; // 활성 점등
             } else {
               mat.uniforms.u_opacity.value = 0.08; // 기본 소등
             }
          }
        });

        // 4번 스타일을 위한 실시간 피크 3D 원점 벡터 수집
        peakPoints.push(new THREE.Vector3(channel.posX, channelHighestY, 2));
      });

      // 💡 [스타일 4번 파도 연출 코어 수식 엔진 기동]
      if (this.uiSettings.style === 'full-random' && this.waveLineMesh) {
          this.waveLineMesh.material.opacity = 1.0;
          
          // 파도선을 더 영롱하게 보정하기 위해 CatmullRom 3D 곡선 스플라인 함수 보간 수학 적용
          const curve = new THREE.CatmullRomCurve3(peakPoints);
          curve.curveType = 'centripetal'; // 엣지 튕김 없는 스무스 스플라인 형태 락
          
          const splinePoints = curve.getPoints(this.barCount * 4);
          this.waveLineMesh.geometry.setFromPoints(splinePoints);
          
          // 파도선 색상 전용 커스텀 칼라 가변 연동
          this.waveLineMesh.material.color.setHSL(0.4 + Math.sin(time * 2.0) * 0.15, 1.0, 0.55 * glowMultiplier);
      } else if (this.waveLineMesh) {
          this.waveLineMesh.material.opacity = 0.0; // 4번 스타일 아닐 때는 파도 라인 완전 은닉
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.currentWidth = w;
      this.currentHeight = h;
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0, 0.5, 0);
      this.syncUISettings();
      this.buildSegmentMatrix(geometry);
      this.buildWaveLineContainer();
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
    if (this.waveLineMesh) {
        this.waveLineMesh.geometry.dispose();
        this.waveLineMesh.material.dispose();
    }
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
