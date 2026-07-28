/**
 * src/sketches/003_glsl_noise.js
 * - [버전] Ver 4.0 (이미지 가속 굴절 및 주파수 하이퍼 동기화 판)
 * - 외부 업로드 이미지(땅/호수바닥)를 THREE.Texture로 실시간 마운트하여 파이프라인 최하단에 바인딩
 * - 주파수(Bass/Mid)에 연동되어 배경 이미지와 오로라 수면이 함께 액체처럼 출렁이는 실시간 굴절 연출 완성
 * - Shuffle(Seed) 슬라이더 연동: 시드 값에 따라 사인 노이즈 기저 위상을 격파하여 모양 다변화 완수
 * - 30FPS 진단 HUD 통신용 가상 프레임 레이터 및 함수 식 트래커 내장
 */

export default class GlslNoise {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uniforms = null;

    this.version = "003호 Refractive Fluid Nebula Ver 4.0";
    this.currentMode = "오로라 밤의 수면 & 이미지 굴절";
    
    // CPU 보간 버퍼 (끈적한 유체 감쇠용)
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;

    // 💡 배경 이미지 전용 트래킹 멤버 변수 수립
    this.bgTexture = null;
    this.lastBgImage = null;
    this.lastTime = 0;
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

    // 💡 [대수술: 이미지 굴절 및 주파수 하이퍼 반응 프래그먼트 셰이더]
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      
      // 관제탑 UI 인터페이스 유니폼 매핑
      uniform int u_color_style;
      uniform vec3 u_custom_c1;
      uniform vec3 u_custom_c2;
      uniform float u_scale;
      uniform float u_range;
      uniform float u_gauge;
      uniform vec3 u_camera_offset;
      
      // 💡 [신규 유니폼 이식]: 셔플 시드 및 배경 이미지 연동 컨트롤러
      uniform float u_seed;
      uniform int u_has_bg;
      uniform sampler2D u_bg_texture;

      // 오가닉 스플라인 유체 사인 노이즈
      float sineNoise(in vec2 p) {
        return sin(p.x * 2.5 + sin(p.y * 1.8)) * cos(p.y * 2.2 + cos(p.x * 1.5));
      }

      void main() {
        vec2 centerUV = gl_FragCoord.xy / u_resolution.xy;
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        
        // 💡 [Shuffle 연동]: 시드 난수에 따라 원천 좌표 공간을 뒤틀어 매번 다른 형태 유도
        vec2 shuffleOffset = vec2(sin(u_seed * 4.12 + 1.5), cos(u_seed * 7.85 - 2.3)) * 3.5;
        uv += shuffleOffset;
        
        // 3D 카메라 공간 오프셋 제어
        uv.x -= (u_camera_offset.x * 0.2);
        uv.y -= (u_camera_offset.y * 0.2);
        uv *= (1.0 + u_camera_offset.z * 0.1);

        // Scale 제어
        float patternScale = mix(3.5, 0.8, u_scale);
        uv *= patternScale;

        // 💡 [주파수 움직임 극대화]: 주파수 크기 변동폭을 유체 스피드와 진폭 계수에 직접 곱 연산 처리
        float flowSpeed = u_time * 0.15 + (u_bass * 0.3);
        vec2 warpUV = uv;
        
        float bassFactor = 1.0 + (u_bass * 3.2);
        float midFactor = 1.0 + (u_mid * 2.5);

        // 유체 파동 왜곡 연산 파트 (주파수 락인 매커니즘)
        for(float i = 1.0; i < 4.0; i++) {
          warpUV.x += sin(warpUV.y + flowSpeed + u_mid * 2.2) * 0.45 * bassFactor / i;
          warpUV.y += cos(warpUV.x + flowSpeed * 0.8 + u_bass * 1.8) * 0.35 * midFactor / i;
        }

        // 세포 밀도 및 최종 노이즈 강도 계산
        float cellDensity = mix(1.0, 4.0, u_range);
        float strength = sineNoise(warpUV * cellDensity + u_seed * 0.1);

        // 어두운 명도 리프팅 기저색 생성
        vec3 baseMidnight = vec3(0.03, 0.05, 0.09) * mix(0.5, 2.0, u_gauge); 
        
        // 💡 [배경 이미지 드로우 및 호수 굴절 왜곡 알고리즘]
        vec3 finalBackground = baseMidnight;
        if (u_has_bg == 1) {
          // 오디오 저음에 맞춰 배경 이미지 픽셀이 물결치듯 굴절되는 유체 렌즈 효과 구현
          vec2 refractionUV = centerUV + vec2(sin(warpUV.y * 2.5), cos(warpUV.x * 2.5)) * 0.012 * u_bass;
          vec3 bgImageColor = texture2D(u_bg_texture, refractionUV).rgb;
          
          // 이미지를 숲속 깊은 수면 아래의 질감으로 부드럽게 동화시킴
          finalBackground = mix(baseMidnight, bgImageColor * 0.6, 0.85);
        }

        // 테마 컬러 그라데이션 분기
        vec3 col1 = vec3(0.0);
        vec3 col2 = vec3(0.0);

        if (u_color_style == 0) {
          col1 = vec3(0.15, 0.32, 0.22); col2 = vec3(0.42, 0.75, 0.58);
        } else if (u_color_style == 1) {
          col1 = vec3(0.68, 0.56, 0.44); col2 = vec3(0.92, 0.88, 0.82);
        } else if (u_color_style == 2) {
          col1 = vec3(0.12, 0.18, 0.26); col2 = vec3(0.95, 0.76, 0.70);
        } else if (u_color_style == 3) {
          col1 = u_custom_c1; col2 = u_custom_c2;
        } else {
          col1 = vec3(0.2, 0.4, 0.6) + sin(u_time * 0.2) * 0.1;
          col2 = vec3(0.7, 0.5, 0.6) + cos(u_time * 0.3) * 0.1;
        }

        // 고음(Treble) 반응성 인광 물들임 시프팅
        vec3 dynamicGlow = mix(col1, col2, 0.5 + 0.5 * sin(u_time * 0.4 + u_treble * 1.8));
        
        // 굴절 오로라 패턴 합성
        float alphaFilter = smoothstep(-0.8, 0.8, strength);
        float glowIntensityPulse = alphaFilter * (0.5 + u_bass * 0.8 + u_treble * 0.4);
        
        vec3 finalGlowPattern = mix(finalBackground, dynamicGlow, glowIntensityPulse);

        // 이미지 로딩 모드 시 오로라 빛무리를 수면 위에 유기적으로 발광 혼합(Screen Blend)
        if (u_has_bg == 1) {
          vec3 bgImageColorOrigin = texture2D(u_bg_texture, centerUV + vec2(sin(warpUV.y), cos(warpUV.x)) * 0.005).rgb;
          finalGlowPattern = mix(bgImageColorOrigin, finalGlowPattern + bgImageColorOrigin * 0.25, alphaFilter * 0.65);
        }

        // 주변부 렌즈 비네팅 아웃포커스 마스크
        float distFromCenter = length(centerUV - vec2(0.5));
        float blurMask = smoothstep(0.15, 0.65, distFromCenter);
        vec3 finalVisual = mix(finalGlowPattern, finalBackground * 1.1, blurMask * 0.45);

        gl_FragColor = vec4(finalVisual, 1.0);
      }
    `;

    // 유니폼 아키텍처 인젝션
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
      u_camera_offset: { value: new THREE.Vector3(0, 0, 0) },
      
      // 💡 셔플 및 텍스처 데이터 Uniform 엔트리 추가
      u_seed: { value: 0.0 },
      u_has_bg: { value: 0 },
      u_bg_texture: { value: null }
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

  // [RESET 및 실시간 드래그 동기화 마스터 트래커]
  syncWithCosmicPanel() {
    if (!this.uniforms || !window.cosmicEngineSettings) return;
    const settings = window.cosmicEngineSettings;
    
    // 1) 컬러 스타일 인덱스 디코딩
    let styleInt = 1; 
    if (settings.colorStyle === 'monochrome') styleInt = 0;
    else if (settings.colorStyle === 'neon') styleInt = 1;
    else if (settings.colorStyle === 'pastel') styleInt = 2;
    else if (settings.colorStyle === 'custom') styleInt = 3;
    else if (settings.colorStyle === 'full-random') styleInt = 4;
    
    this.uniforms.u_color_style.value = styleInt;

    // 2) 💡 [배경 이미지 감지 엔진 체결]: 이미지 가속 텍스처 실시간 핫 마운트
    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(bgImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = bgImg;
      this.uniforms.u_bg_texture.value = this.bgTexture;
      this.uniforms.u_has_bg.value = 1;
    } else if (!bgImg) {
      this.uniforms.u_has_bg.value = 0;
    }

    // 3) 💡 [Shuffle 시드 바인딩]: 형태 무작위 전환 계수 주입
    this.uniforms.u_seed.value = parseFloat(settings.seed || 0.0);

    // 4) 커스텀 색상 피커 수혈
    if (settings.customColors) {
      this.uniforms.u_custom_c1.value.set(settings.customColors.gas1);
      this.uniforms.u_custom_c2.value.set(settings.customColors.gas2);
    }

    // 5) 슬라이더 물리 계수 정규화 연동
    const scaleEl = document.getElementById('num-cosmic-glow');
    const rangeEl = document.getElementById('num-cosmic-scatter');
    const gaugeEl = document.getElementById('num-cosmic-gauge');

    this.uniforms.u_scale.value = scaleEl ? (parseFloat(scaleEl.value) / 250.0) : 0.4;
    this.uniforms.u_range.value = rangeEl ? (parseFloat(rangeEl.value) / 50.0) : 0.5;
    this.uniforms.u_gauge.value = gaugeEl ? (parseFloat(gaugeEl.value) / 100.0) : 0.5;

    // 3D 공간 카메라 오프셋 매핑
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

    this.syncWithCosmicPanel();

    // 진단 HUD 연동용 타임 체크 계산
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    // 메인 HUD에 실시간 변수 상태 피딩 투사
    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.uniforms.u_has_bg.value === 1 ? "BG_Refracted" : "ShaderOnly",
      isCovering: false,
      activeFunction: `FluidNoise[Seed:${this.uniforms.u_seed.value}]`
    };

    // 오디오 초저속 릴리즈 보간 (끈적하고 부드러운 전개 확보)
    let targetBass = 0.0, targetMid = 0.0, targetTreble = 0.0;
    
    if (audioData) {
      targetBass = (audioData.bass || 0.0) * 1.6;
      targetMid = (audioData.mid || 0.0) * 1.3;
      targetTreble = (audioData.treble || 0.0) * 1.3;
    }

    this.smoothBass += (targetBass - this.smoothBass) * 0.05;
    this.smoothMid += (targetMid - this.smoothMid) * 0.05;
    this.smoothTreble += (targetTreble - this.smoothTreble) * 0.05;

    // 주파수 반응 타임 연산선 전개
    this.uniforms.u_time.value += 0.005 + (this.smoothBass * 0.006);
    
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
    
    // 💡 생성된 이미지 가속 텍스처 메모리 자원 완전 해제
    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }
    this.lastBgImage = null;

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}
