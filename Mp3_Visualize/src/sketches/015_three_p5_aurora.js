/**
 * 015_three_p5_aurora.js
 * (화면 깨짐 및 바둑판 에러 완벽 복구판)
 * 처음에 완성했던 가장 아름다운 '비선형 오로라 유체'의 원래 형태를 100% 복구하고, 
 * 오로라의 밝기에 비례해 점/사각형/스피어의 크기가 변하며 가장자리에서 완벽히 사라지는 셰이더 미디어 아트
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeAuroraFluidStage {
  constructor(container) {
    this.container = container;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uniforms = null;
    this.material = null;
    this.plane = null;

    this.smoothLow = 0;
    this.smoothMid = 0;
    this.smoothHigh = 0;
    
    this.currentAudioData = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 화면이 깨지지 않고 1:1로 꽉 차도록 Orthographic(평면) 카메라로 롤백!
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.container.appendChild(this.renderer.domElement);

    // 💡 [핵심] 오리지널 오로라 형태 복구 및 입자 필터 적용 GLSL
    this.uniforms = {
        uTime: { value: 0.0 },
        uAudioLow: { value: 0.0 },
        uAudioMid: { value: 0.0 },
        uAudioHigh: { value: 0.0 },
        uColor1: { value: new THREE.Color(0xff0055) }, // 저음: 마젠타
        uColor2: { value: new THREE.Color(0x00ffcc) }, // 중음: 시안
        uColor3: { value: new THREE.Color(0xffcc00) }, // 고음: 골드
        uSize: { value: 2.2 },
        uSeed: { value: 42.0 },
        uShapeMode: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) }
    };

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float uTime;
        uniform float uAudioLow;
        uniform float uAudioMid;
        uniform float uAudioHigh;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uSize;
        uniform float uSeed;
        uniform int uShapeMode;
        uniform vec2 uResolution;
        varying vec2 vUv;

        // 2D Simplex Noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ; m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        // 💡 극찬하셨던 오리지널 유체(Fluid) 궤적 공식 100% 복구
        float aurora(vec2 p, float audio, float seed, float offset) {
            float t = uTime * 0.15 + seed * 2.0;
            float scale = 3.0 / max(0.5, uSize); 
            vec2 q = p * scale;
            q.y += offset; 

            float n1 = snoise(q + vec2(t, t*0.5));
            float n2 = snoise(q * 1.5 - vec2(t*1.2, -t*0.8) + n1);
            
            float wave = sin(q.x * 2.0 + n2 * 2.5 + t * 1.5);
            float dist = abs(q.y - wave * 0.4);
            
            float glow = 0.05 / (dist + 0.015);
            glow *= (0.4 + audio * 3.0); 
            return glow;
        }

        void main() {
            // 화면 비율을 완벽히 맞추어 동그라미가 타원이 되지 않게 교정
            vec2 st = vUv - 0.5; 
            st.x *= uResolution.x / uResolution.y; 

            vec3 finalColor = vec3(0.0);

            if (uShapeMode == 0) {
                // 모드 0: 원본 오로라 유체 (선명하고 몽환적인 3겹)
                float a1 = aurora(st, uAudioLow, uSeed, 0.2);
                float a2 = aurora(st, uAudioMid, uSeed + 10.0, 0.0);
                float a3 = aurora(st, uAudioHigh, uSeed + 20.0, -0.2);
                
                finalColor = uColor1 * a1 + uColor2 * a2 + uColor3 * a3;
                
                // 오로라가 전혀 없는 까만 바탕은 완벽히 제거
                if ((a1 + a2 + a3) < 0.05) discard; 
                
            } else {
                // 모드 1, 2, 3: 오리지널 오로라 위에 점/사각형/스피어 필터 적용
                float cells = 70.0; // 입자 밀도
                
                // 그리드 셀 좌표 계산
                vec2 gridUv = fract(st * cells);
                vec2 cellSt = floor(st * cells) / cells; 

                // 화면 전체가 아닌 "해당 셀의 중심"에서 오로라 에너지를 측정
                float a1 = aurora(cellSt, uAudioLow, uSeed, 0.2);
                float a2 = aurora(cellSt, uAudioMid, uSeed + 10.0, 0.0);
                float a3 = aurora(cellSt, uAudioHigh, uSeed + 20.0, -0.2);
                
                vec3 cellColor = uColor1 * a1 + uColor2 * a2 + uColor3 * a3;
                float intensity = a1 + a2 + a3; 

                // 💡 [핵심] 오로라 에너지가 강할수록 반지름이 커짐. 
                // 에너지가 없는 곳(반지름 < 0.05)은 아예 그리지 않음 (모기장 에러 해결!)
                float radius = clamp(intensity * 0.15, 0.0, 0.45); 
                
                if (radius < 0.05) discard; 

                float shapeAlpha = 0.0;
                float d = length(gridUv - vec2(0.5));

                if (uShapeMode == 1) { 
                    // 점 (Dots)
                    shapeAlpha = 1.0 - smoothstep(radius - 0.05, radius, d);
                } else if (uShapeMode == 2) { 
                    // 사각형 (Squares)
                    vec2 box = abs(gridUv - vec2(0.5));
                    float maxD = max(box.x, box.y);
                    shapeAlpha = 1.0 - smoothstep(radius - 0.05, radius, maxD);
                } else if (uShapeMode == 3) { 
                    // 3D 스피어 (Spheres)
                    if (d > radius) discard;
                    float z = sqrt(radius * radius - d * d) / radius; 
                    shapeAlpha = 0.3 + z * 0.7; // 구슬의 입체 조명
                }
                
                finalColor = cellColor * shapeAlpha;
                if (shapeAlpha < 0.01) discard;
            }

            vec3 bg = vec3(0.02, 0.03, 0.08); // 어두운 우주 배경
            gl_FragColor = vec4(bg + finalColor, 1.0);
        }
    `;

    this.material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: this.uniforms
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.plane = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.plane);
  }

  update(audioData) {
    if (!this.scene) return;
    this.currentAudioData = audioData;

    let scatter = 2.2, gain = 1.0, seed = 42;
    let colorStyle = 'neon';

    if (window.cosmicEngineSettings) {
      scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
      gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
      seed = Number.isFinite(window.cosmicEngineSettings.seed) ? window.cosmicEngineSettings.seed : 42;
      colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
    }

    // 주파수 3분할 추출 (저음, 중음, 고음)
    let lowSum = 0, midSum = 0, highSum = 0;
    let lowCount = 0, midCount = 0, highCount = 0;

    if (audioData.raw && audioData.raw.length > 0) {
        for(let i = 2; i < 12; i++) { lowSum += audioData.raw[i] || 0; lowCount++; }
        for(let i = 12; i < 35; i++) { midSum += audioData.raw[i] || 0; midCount++; }
        for(let i = 35; i < 90; i++) { highSum += audioData.raw[i] || 0; highCount++; }
    }

    let targetLow = lowCount > 0 ? Math.pow((lowSum / lowCount) / 255.0, 1.8) : 0;
    let targetMid = midCount > 0 ? Math.pow((midSum / midCount) / 255.0, 1.8) : 0;
    let targetHigh = highCount > 0 ? Math.pow((highSum / highCount) / 255.0, 1.8) : 0;

    this.smoothLow += (targetLow * gain - this.smoothLow) * 0.15;
    this.smoothMid += (targetMid * gain - this.smoothMid) * 0.15;
    this.smoothHigh += (targetHigh * gain - this.smoothHigh) * 0.15;

    // UI 스타일 -> 쉐이프 매핑
    let shapeMode = 0; 
    if (colorStyle === 'pastel') shapeMode = 1; // 점
    else if (colorStyle === 'custom') shapeMode = 2; // 사각형
    else if (colorStyle === 'monochrome') shapeMode = 3; // 스피어

    // 셰이더 Uniform 전송
    this.uniforms.uTime.value += 0.01;
    this.uniforms.uAudioLow.value = this.smoothLow;
    this.uniforms.uAudioMid.value = this.smoothMid;
    this.uniforms.uAudioHigh.value = this.smoothHigh;
    
    this.uniforms.uSize.value = scatter; // 오로라 크기 줌아웃
    this.uniforms.uSeed.value = seed;    // 오로라 지형 변형
    this.uniforms.uShapeMode.value = shapeMode; // 입자 형태 변경

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer) {
      this.renderer.setSize(w, h);
      this.uniforms.uResolution.value.set(w, h); // 화면 비율 실시간 교정
    }
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
      this.renderer = null;
    }
    if (this.material) {
      this.material.dispose();
      this.plane.geometry.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.currentAudioData = null;
  }
}
