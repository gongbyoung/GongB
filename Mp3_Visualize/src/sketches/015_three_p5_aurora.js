/**
 * 015_three_p5_aurora.js
 * 회원님의 완벽한 물리 반응 설계 반영:
 * - 저음(Low): 오로라 스케일(크기) 팽창/수축
 * - 중음(Mid): 유체의 흐름 속도(Speed) 가속/감속
 * - 고음(High): 내부 빛 번짐 및 색상 확산(Diffusion)
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
    
    // 💡 중음(Mid)에 의한 시간 가속을 위해 누적 타임 변수 독립 생성
    this.accumulatedTime = 0.0;
    
    this.currentAudioData = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 2D 평면 마스킹 및 오리지널 쉐이프 유지를 위한 Orthographic 카메라
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.container.appendChild(this.renderer.domElement);

    // 💡 GLSL 셰이더 코드 (물리 엔진 적용)
    this.uniforms = {
        uTime: { value: 0.0 },
        uAudioLow: { value: 0.0 },   // 스케일 제어용
        uAudioHigh: { value: 0.0 },  // 색상 확산 제어용
        uColor1: { value: new THREE.Color(0xff0055) }, 
        uColor2: { value: new THREE.Color(0x00ffcc) }, 
        uColor3: { value: new THREE.Color(0xffcc00) }, 
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

        // 💡 3겹의 오로라를 그리는 함수 (저음과 고음 물리 엔진 적용)
        float aurora(vec2 p, float seed, float offset) {
            float t = uTime + seed * 2.0;
            
            // 1. [저음 반응] 스케일 팽창/수축
            // uAudioLow가 커지면 scale이 작아지며 화면에 오로라가 거대하게 줌인(Zoom-in) 됨
            float baseScale = 3.0 / max(0.5, uSize); 
            float currentScale = max(0.5, baseScale - (uAudioLow * 1.5)); 
            
            vec2 q = p * currentScale;
            q.y += offset; 

            float n1 = snoise(q + vec2(t * 0.5, t * 0.2));
            float n2 = snoise(q * 1.5 - vec2(t * 0.8, -t * 0.6) + n1);
            
            // 저음이 터질 때 위아래 출렁이는 폭(진폭)도 커짐
            float waveAmp = 0.4 + (uAudioLow * 0.2);
            float wave = sin(q.x * 2.0 + n2 * 2.5 + t) * waveAmp;
            float dist = abs(q.y - wave);
            
            // 2. [고음 반응] 내부 색상 확산 및 빛 번짐 (Diffusion)
            // uAudioHigh가 커지면 빛의 두께가 넓어지고 부드럽게 퍼짐
            float diffusion = 0.012 + (uAudioHigh * 0.06); 
            float glow = diffusion / (dist + 0.005);
            
            glow *= 0.6; // 기본 밝기 밸런스
            return glow;
        }

        void main() {
            vec2 st = vUv - 0.5; 
            st.x *= uResolution.x / uResolution.y; 

            vec3 finalColor = vec3(0.0);

            // 고음(High)에 의한 3겹 색상 강제 섞임 (Color Bleeding)
            float mixFactor = uAudioHigh * 0.4;
            vec3 c1 = mix(uColor1, uColor2, mixFactor);
            vec3 c2 = mix(uColor2, uColor3, mixFactor);
            vec3 c3 = mix(uColor3, uColor1, mixFactor);

            if (uShapeMode == 0) {
                // 모드 0: 희미하고 선명한 3겹 유체
                float a1 = aurora(st, uSeed, 0.2);
                float a2 = aurora(st, uSeed + 10.0, 0.0);
                float a3 = aurora(st, uSeed + 20.0, -0.2);
                
                finalColor = c1 * a1 + c2 * a2 + c3 * a3;
                
                // 고음 확산 폭발 효과 추가
                finalColor *= (1.0 + uAudioHigh * 1.5);
                
                if ((a1 + a2 + a3) < 0.05) discard; 
                
            } else {
                // 모드 1, 2, 3: 점/사각형/스피어 마스킹 처리
                float cells = 70.0; 
                vec2 gridUv = fract(st * cells);
                vec2 cellSt = floor(st * cells) / cells; 

                float a1 = aurora(cellSt, uSeed, 0.2);
                float a2 = aurora(cellSt, uSeed + 10.0, 0.0);
                float a3 = aurora(cellSt, uSeed + 20.0, -0.2);
                
                vec3 cellColor = c1 * a1 + c2 * a2 + c3 * a3;
                float intensity = a1 + a2 + a3; 

                // 고음(High)이 입자의 크기를 직접적으로 키워 서로 뭉치게 만듦 (확산)
                float radius = clamp(intensity * 0.15 + (uAudioHigh * 0.15), 0.0, 0.45); 
                
                if (radius < 0.05) discard; 

                float shapeAlpha = 0.0;
                float d = length(gridUv - vec2(0.5));

                if (uShapeMode == 1) { 
                    shapeAlpha = 1.0 - smoothstep(radius - 0.05, radius, d);
                } else if (uShapeMode == 2) { 
                    vec2 box = abs(gridUv - vec2(0.5));
                    float maxD = max(box.x, box.y);
                    shapeAlpha = 1.0 - smoothstep(radius - 0.05, radius, maxD);
                } else if (uShapeMode == 3) { 
                    if (d > radius) discard;
                    float z = sqrt(radius * radius - d * d) / radius; 
                    shapeAlpha = 0.3 + z * 0.7; 
                }
                
                finalColor = cellColor * shapeAlpha;
                if (shapeAlpha < 0.01) discard;
            }

            vec3 bg = vec3(0.02, 0.03, 0.08); 
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

    // 부드러운 반응을 위한 스무딩 보간
    this.smoothLow += (targetLow * gain - this.smoothLow) * 0.15;
    this.smoothMid += (targetMid * gain - this.smoothMid) * 0.15;
    this.smoothHigh += (targetHigh * gain - this.smoothHigh) * 0.15;

    // 💡 [중음 반응] 유체의 속도(Speed) 조절 연산
    // 음악이 조용할 때는 기본 속도(0.002)로 잔잔하게 흐르다가, 보컬/기타(중음)가 터지면 속도가 최대 25배(0.05) 급가속!
    let baseSpeed = 0.002;
    let speedBoost = this.smoothMid * 0.05; 
    this.accumulatedTime += (baseSpeed + speedBoost);

    // UI 스타일 매핑
    let shapeMode = 0; 
    if (colorStyle === 'pastel') shapeMode = 1; 
    else if (colorStyle === 'custom') shapeMode = 2; 
    else if (colorStyle === 'monochrome') shapeMode = 3; 

    // 셰이더로 연산 결과 전송
    this.uniforms.uTime.value = this.accumulatedTime;
    this.uniforms.uAudioLow.value = this.smoothLow;
    this.uniforms.uAudioHigh.value = this.smoothHigh;
    
    this.uniforms.uSize.value = scatter; 
    this.uniforms.uSeed.value = seed;    
    this.uniforms.uShapeMode.value = shapeMode; 

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer) {
      this.renderer.setSize(w, h);
      this.uniforms.uResolution.value.set(w, h); 
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
