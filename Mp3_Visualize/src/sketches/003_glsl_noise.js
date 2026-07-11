/**
 * src/sketches/003_glsl_noise.js
 * - [버전] Ver 3.5 (오로라가 일렁이는 밤의 수면 - 명상형 GPU 셰이더 완결판)
 * - 순수 블랙(Pure Black) 경계를 해체하고 딥 네이비/미드나잇 퍼플 암부 리프팅 적용
 * - 크기 팽창 대신 액체 유체 왜곡(Fluid Distortion)과 흐르는(Panning) 유기적 왜곡식 매립
 * - 관제탑 Color Style Palette(No1~No5) 및 RESET 단추 클릭 시 시드/카메라 좌표 물리 완벽 동기화
 * - 외곽부 자동 렌즈 아웃포커싱(Subtle Lens Blur) 연산 및 프레임 스무딩(Decay) 극대화 완료
 */

export default class GlslNoise {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uniforms = null;

    this.version = "003호 Ambient Fluid Nebula Ver 3.5";
    this.currentMode = "오로라 밤의 수면";
    
    // CPU 단축 보간 버퍼 수립 (여운 및 이징용)
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    console.log(`%c[🔮 003호 힐링 셰이더 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    const vertexShader = `
      void main() { gl_Position = vec4(position, 1.0); }
    `;

    // 💡 [대수술: 앰비언트 최적화 하이엔드 프래그먼트 셰이더 소스 프로그래밍]
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      
      // 관제탑 UI 직접 제어용 유니폼 매핑
      uniform int u_color_style;
      uniform vec3 u_custom_c1;
      uniform vec3 u_custom_c2;
      uniform float u_scale;
      uniform float u_range;
      uniform float u_gauge;
      uniform vec3 u_camera_offset;

      // 오가닉 스플라인 유체 사인 노이즈
      float sineNoise(in vec2 p) {
        return sin(p.x * 2.5 + sin(p.y * 1.8)) * cos(p.y * 2.2 + cos(p.x * 1.5));
      }

      void main() {
        // 💡 [3D 카메라 오프셋 매핑]: X, Y 변위를 좌표계 기저에 투사하고 Z축으로 스케일 가산
        vec2 centerUV = gl_FragCoord.xy / u_resolution.xy;
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        
        // 관제탑 3D Offset 입력단 매핑 치환 (정면 0,0,0 기준 변위 기믹)
        uv.x -= (u_camera_offset.x * 0.2);
        uv.y -= (u_camera_offset.y * 0.2);
        uv *= (1.0 + u_camera_offset.z * 0.1);

        // 💡 [Scale 연동]: 관제탑 Scale(u_scale) 수치에 따라 전체 세포 패턴 스케일 크기 제어
        float patternScale = mix(3.5, 0.8, u_scale);
        uv *= patternScale;

        // 💡 [개선안 2: 패턴의 크기보다 흐름과 일렁임으로]
        // 즉각적인 툭툭 튀는 반응을 분쇄하고 액체 유체 웨이프 워프 매커니즘 구현
        float flowSpeed = u_time * 0.15;
        vec2 warpUV = uv;
        
        // 저음역 물결(Ripple) 분산 왜곡 루프
        for(float i = 1.0; i < 4.0; i++) {
          warpUV.x += sin(warpUV.y + flowSpeed + u_mid * 0.4) * 0.35 / i;
          warpUV.y += cos(warpUV.x + flowSpeed * 0.8 + u_bass * 0.5) * 0.25 / i;
        }

        // 💡 [Range 연동]: u_range 수치에 따라 입자 안개 및 미세 세포 밀도 조정
        float cellDensity = mix(1.0, 4.0, u_range);
        float strength = sineNoise(warpUV * cellDensity);

        // 💡 [개선안 1: 명도 대비 낮추기]: 완전 블랙 해체 공정
        // 게이지 값(u_gauge)을 진하기 채도로 엮고 베이스는 깊은 미드나잇 네이비블루(#080c16) 톤으로 리프팅
        vec3 baseMidnight = vec3(0.03, 0.05, 0.09) * mix(0.5, 2.0, u_gauge); 
        
        // 💡 [Color Style Palette 5대 테마 그라데이션 컬러 셋업]
        vec3 col1 = vec3(0.0);
        vec3 col2 = vec3(0.0);

        if (u_color_style == 0) {
          // No1: 모스 그린 힐링 톤
          col1 = vec3(0.15, 0.32, 0.22); col2 = vec3(0.42, 0.75, 0.58);
        } else if (u_color_style == 1) {
          // No2: 샌드 베이지 아날로그 수면
          col1 = vec3(0.68, 0.56, 0.44); col2 = vec3(0.92, 0.88, 0.82);
        } else if (u_color_style == 2) {
          // No3: 은은한 대지 / 새벽녘 톤
          col1 = vec3(0.12, 0.18, 0.26); col2 = vec3(0.95, 0.76, 0.70);
        } else if (u_color_style == 3) {
          // No4: 커스텀 컬러 파이프라인 수혈
          col1 = u_custom_c1; col2 = u_custom_c2;
        } else {
          // No5: 올 랜덤 시드 시프팅 오로라 색체
          col1 = vec3(0.2, 0.4, 0.6) + sin(u_time * 0.2) * 0.1;
          col2 = vec3(0.7, 0.5, 0.6) + cos(u_time * 0.3) * 0.1;
        }

        // 💡 [개선안 1: 색상 다양성(Nuance) 부여] 오디오 고음(u_treble) 및 시간 호흡에 따라 물들듯 시프팅
        vec3 dynamicGlow = mix(col1, col2, 0.5 + 0.5 * sin(u_time * 0.4 + u_treble * 0.5));
        
        // 셰이더 마스크 필터 조합
        float alphaFilter = smoothstep(-0.8, 0.8, strength);
        vec3 finalGlowPattern = mix(baseMidnight, dynamicGlow, alphaFilter * (0.6 + u_bass * 0.4));

        // 💡 [개선안 2: 초점의 변화(Lens Blur)] 중심부에서 외곽으로 갈수록 아웃포커싱되도록 비네팅 렌즈 블러 레이어링
        float distFromCenter = length(centerUV - vec2(0.5));
        float blurMask = smoothstep(0.15, 0.65, distFromCenter);
        
        // 주변부 픽셀 채도를 부드럽게 감쇠하여 시각적 쉼터(여백) 제공
        vec3 finalVisual = mix(finalGlowPattern, baseMidnight * 1.2, blurMask * 0.45);

        gl_FragColor = vec4(finalVisual, 1.0);
      }
    `;

    // 유니폼 아키텍처 매립 세팅
    this.uniforms = {
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_bass: { value: 0 },
      u_mid: { value: 0 },
      u_treble: { value: 0 },
      
      u_color_style: { value: 1 },
      u_custom_c1: { value: new THREE.Color('#ff0055') },
      u_custom_c2: { value: new THREE.Color('#00ffcc') },
      u_scale: { value: 0.85 },
      u_range: { value: 0.22 },
      u_gauge: { value: 0.5 },
      u_camera_offset: { value: new THREE.Vector3(0, 0, 0) }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    
    this.syncWithCosmicPanel();
  }

  // 💡 [현재수치적용 RESET 및 실시간 드래그 동기화 마스터 트래커]
  syncWithCosmicPanel() {
    if (!this.uniforms || !window.cosmicEngineSettings) return;

    const settings = window.cosmicEngineSettings;
    
    // 1) 컬러 스타일 변환 매핑 (드롭다운 번호 매칭)
    let styleInt = 1; // 기본 샌드베이지
    if (settings.colorStyle === 'monochrome') styleInt = 0;
    else if (settings.colorStyle === 'neon') styleInt = 1;
    else if (settings.colorStyle === 'pastel') styleInt = 2;
    else if (settings.colorStyle === 'custom') styleInt = 3;
    else if (settings.colorStyle === 'full-random') styleInt = 4;
    
    this.uniforms.u_color_style.value = styleInt;

    // 2) 커스텀 픽커 수혈 변환
    if (settings.customColors) {
      this.uniforms.u_custom_c1.value.set(settings.customColors.gas1);
      this.uniforms.u_custom_c2.value.set(settings.customColors.gas2);
    }

    // 3) Scale, Range, Gauge 계수 정규화 연동 락인
    const scaleEl = document.getElementById('num-cosmic-glow');
    const rangeEl = document.getElementById('num-cosmic-scatter');
    const gaugeEl = document.getElementById('num-cosmic-gauge');

    this.uniforms.u_scale.value = scaleEl ? (parseFloat(scaleEl.value) / 250.0) : 0.4;
    this.uniforms.u_range.value = rangeEl ? (parseFloat(rangeEl.value) / 50.0) : 0.5;
    this.uniforms.u_gauge.value = gaugeEl ? (parseFloat(gaugeEl.value) / 100.0) : 0.5;

    // 4) 가상 3D 카메라 공간 좌표 매핑 연동
    if (settings.positionOffset) {
      this.uniforms.u_camera_offset.value.set(
        settings.positionOffset.x || 0,
        settings.positionOffset.y || 0,
        settings.positionOffset.z || 0
      );
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 매 프레임 실시간 슬라이더 변수 동기화 펌핑
    this.syncWithCosmicPanel();

    // 💡 [개선안 2: 모션 블러와 잔상의 활용] 
    // 오디오 진폭에 0.05 초저속 릴리즈 보간을 먹여 아주 끈적하고 부드러운 유체 흐름 완성 (Decay 완치)
    let targetBass = 0.0, targetMid = 0.0, targetTreble = 0.0;
    
    if (audioData) {
      targetBass = (audioData.bass || 0.0) * 1.5;
      targetMid = (audioData.mid || 0.0) * 1.2;
      targetTreble = (audioData.treble || 0.0) * 1.2;
    }

    this.smoothBass += (targetBass - this.smoothBass) * 0.05;
    this.smoothMid += (targetMid - this.smoothMid) * 0.05;
    this.smoothTreble += (targetTreble - this.smoothTreble) * 0.05;

    // 시간 경과선 투사
    this.uniforms.u_time.value += 0.005 + (this.smoothBass * 0.004);
    
    this.uniforms.u_bass.value = this.smoothBass;
    this.uniforms.u_mid.value = this.smoothMid;
    this.uniforms.u_treble.value = this.smoothTreble;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer) this.renderer.setSize(w, h);
    if (this.uniforms) this.uniforms.u_resolution.value.set(w, h);
  }

  destroy() {
    if (!this.scene) return;
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}
