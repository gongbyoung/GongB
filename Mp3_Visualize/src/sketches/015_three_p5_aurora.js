/**
 * 015_three_p5_aurora.js
 * 3겹의 비선형 오로라 유체가 저음, 중음, 고음 주파수에 각각 독립적으로 반응하며,
 * UI 스타일(Neon/Pastel/Custom/Monochrome)에 따라 오로라 자체와 그 경계선이 
 * 희미한 유체, 점, 사각형, 스피어 형태로 다이나믹하게 변환되는 100% WebGL 셰이더 미디어 아트
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
    
    // 2D 셰이더 렌더링에 최적화된 Orthographic 카메라
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.container.appendChild(this.renderer.domElement);

    // 💡 [핵심] 3겹 오로라 및 입자 쉐이프 변환 GLSL 셰이더 코드
    this.uniforms = {
        uTime: { value: 0.0 },
        uAudioLow: { value: 0.0 },
        uAudioMid: { value: 0.0 },
        uAudioHigh: { value: 0.0 },
        uColor1: { value: new THREE.Color(0xff0055) }, // 저음: 마젠타/레드
        uColor2: { value: new THREE.Color(0x00ffcc) }, // 중음: 시안/민트
        uColor3: { value: new THREE.Color(0xffcc00) }, // 고음: 골드/옐로우
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

        // 독립적인 오로라 레이어 생성 함수
        float aurora(vec2 p, float audio, float seed, float offset) {
            float t = uTime * 0.15 + seed * 2.0;
            
            // uSize(분산범위)를 통해 오로라의 크기를 제어
            float scale = 3.0 / max(0.5, uSize); 
            vec2 q = p * scale;
            q.y += offset; 

            float n1 = snoise(q + vec2(t, t*0.5));
            float n2 = snoise(q * 1.5 - vec2(t*1.2, -t*0.8) + n1);
            
            float wave = sin(q.x * 2.0 + n2 * 2.5 + t * 1.5);
            float dist = abs(q.y - wave * 0.4);
            
            float glow = 0.05 / (dist + 0.02);
            glow *= (0.2 + audio * 3.5); 
            return glow;
        }

        void main() {
            vec2 st = vUv;
            st.y -= 0.5; 
            st.x *= uResolution.x / uResolution.y; 

            vec3 finalColor = vec3(0.0);

            if (uShapeMode == 0) {
                // 💡 모드 0: 희미한 유체 (부드러운 오리지널 오로라)
                float a1 = aurora(st, uAudioLow, uSeed, 0.2);
                float a2 = aurora(st, uAudioMid, uSeed + 10.0, 0.0);
                float a3 = aurora(st, uAudioHigh, uSeed + 20.0, -0.2);
                finalColor = uColor1 * a1 + uColor2 * a2 + uColor3 * a3;
            } else {
                // 💡 모드 1, 2, 3: 오로라 자체를 입자로 구성 (가장자리로 갈수록 소멸)
                float cells = 60.0; 
                vec2 gridUv = fract(st * cells); // 각 셀 내부의 지역 좌표 (0.0 ~ 1.0)
                vec2 cellSt = floor(st * cells) / cells; // 각 셀의 중앙 좌표

                // 전체 화면이 아닌 "각 셀의 중앙"을 기준으로 오로라가 지나가는지 강도를 측정
                float a1 = aurora(cellSt, uAudioLow, uSeed, 0.2);
                float a2 = aurora(cellSt, uAudioMid, uSeed + 10.0, 0.0);
                float a3 = aurora(cellSt, uAudioHigh, uSeed + 20.0, -0.2);
                
                vec3 cellColor = uColor1 * a1 + uColor2 * a2 + uColor3 * a3;
                float intensity = (a1 + a2 + a3) / 3.0; // 현재 셀의 오로라 평균 에너지

                // [핵심] 오로라의 에너지가 강할수록 입자 크기가 커지고, 경계선으로 갈수록 입자가 작아져 사라짐
                float radiusMod = clamp(intensity * 10.0, 0.0, 1.0); 
                float maxRadius = 0.45 * radiusMod; // 입자의 최대 크기 제한
                float shapeAlpha = 0.0;

                if (maxRadius > 0.01) { // 오로라 에너지가 있는 곳에서만 렌더링
                    if (uShapeMode == 1) { 
                        // 모드 1: 점 (Dots)
                        float d = length(gridUv - vec2(0.5));
                        shapeAlpha = 1.0 - smoothstep(max(0.0, maxRadius - 0.05), maxRadius, d);
                    } else if (uShapeMode == 2) { 
                        // 모드 2: 사각형 (Squares)
                        vec2 dist = abs(gridUv - vec2(0.5));
                        float maxD = max(dist.x, dist.y);
                        shapeAlpha = 1.0 - smoothstep(max(0.0, maxRadius - 0.05), maxRadius, maxD);
                    } else if (uShapeMode == 3) { 
                        // 모드 3: 3D 스피어 (Spheres)
                        float d = length(gridUv - vec2(0.5));
                        if (d < maxRadius) {
                            float z = sqrt(maxRadius * maxRadius - d * d) / maxRadius; // 구체의 입체감
                            float light = 0.3 + z * 1.5; 
                            shapeAlpha = (1.0 - smoothstep(max(0.0, maxRadius - 0.05), maxRadius, d)) * light;
                        }
                    }
                }
                finalColor = cellColor * shapeAlpha;
            }

            vec3 bg = vec3(0.02, 0.03, 0.08); // 우주 다크 블루 배경
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

    // 💡 [주파수 3분할 추출]
    let lowSum = 0, midSum = 0, highSum = 0;
    let lowCount = 0, midCount = 0, highCount = 0;

    if (audioData.raw && audioData.raw.length > 0) {
        // 저음 (Bass)
        for(let i = 2; i < 12; i++) { lowSum += audioData.raw[i] || 0; lowCount++; }
        // 중음 (Mid)
        for(let i = 12; i < 35; i++) { midSum += audioData.raw[i] || 0; midCount++; }
        // 고음 (Treble)
        for(let i = 35; i < 90; i++) { highSum += audioData.raw[i] || 0; highCount++; }
    }

    let targetLow = lowCount > 0 ? Math.pow((lowSum / lowCount) / 255.0, 1.8) : 0;
    let targetMid = midCount > 0 ? Math.pow((midSum / midCount) / 255.0, 1.8) : 0;
    let targetHigh = highCount > 0 ? Math.pow((highSum / highCount) / 255.0, 1.8) : 0;

    // 자연스러운 발광 스무딩
    this.smoothLow += (targetLow * gain - this.smoothLow) * 0.15;
    this.smoothMid += (targetMid * gain - this.smoothMid) * 0.15;
    this.smoothHigh += (targetHigh * gain - this.smoothHigh) * 0.15;

    // 💡 [스타일 매핑] UI에 맞춰 셰이더 모드를 변경합니다.
    let shapeMode = 0; // 희미하게 (Smooth Fluid)
    if (colorStyle === 'pastel') shapeMode = 1; // 점 (Dots)
    else if (colorStyle === 'custom') shapeMode = 2; // 사각형 (Squares)
    else if (colorStyle === 'monochrome') shapeMode = 3; // 스피어 (Spheres)

    // 셰이더 Uniform 전송
    this.uniforms.uTime.value += 0.01;
    this.uniforms.uAudioLow.value = this.smoothLow;
    this.uniforms.uAudioMid.value = this.smoothMid;
    this.uniforms.uAudioHigh.value = this.smoothHigh;
    
    this.uniforms.uSize.value = scatter; // 오로라 크기 조정
    this.uniforms.uSeed.value = seed;    // 오로라 지형 변형
    this.uniforms.uShapeMode.value = shapeMode; // 입자 형태 변경

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
