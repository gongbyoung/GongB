/**
 * 015_three_p5_aurora.js
 * (바둑판 에러 완벽 수정판)
 * 3차원 공간에 3겹의 물결치는 3D 곡면(Mesh)을 띄우고, 
 * 셰이더를 통해 오로라의 중심은 뭉치고 경계선으로 갈수록 점/사각형/구슬로 흩어지도록 만든 리얼 3D 유체 엔진
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeAuroraFluidStage {
  constructor(container) {
    this.container = container;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.layers = []; // 3겹의 3D 오로라 레이어

    this.smoothLow = 0;
    this.smoothMid = 0;
    this.smoothHigh = 0;
    
    this.currentAudioData = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 2D 평면 느낌을 없애기 위해 입체 원근(Perspective) 카메라 사용
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.z = 2.5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.setClearColor(0x020308, 1.0); // 우주 심연의 배경색
    this.container.appendChild(this.renderer.domElement);

    // 💡 3겹의 오로라 레이어 생성 (Color, Z위치, Y오프셋)
    // 뒤에서부터 저음(마젠타), 중음(시안), 고음(옐로우) 배치
    this.layers.push(this.createAuroraMesh(0xff0055, -0.5, -0.25)); 
    this.layers.push(this.createAuroraMesh(0x00ffcc, 0.0, 0.0));    
    this.layers.push(this.createAuroraMesh(0xffcc00, 0.5, 0.25));   
  }

  // 💡 리얼 3D 오로라 곡면 생성 함수
  createAuroraMesh(colorHex, zOffset, yOffset) {
    const uniforms = {
        uTime: { value: 0.0 },
        uAudio: { value: 0.0 },
        uColor: { value: new THREE.Color(colorHex) },
        uScatter: { value: 2.2 },
        uSeed: { value: 42.0 },
        uShapeMode: { value: 0 },
        uYOffset: { value: yOffset }
    };

    // Vertex Shader: 평면을 3D로 구불구불하게 왜곡시켜 리얼한 입체감을 줌
    const vertexShader = `
        varying vec2 vUv;
        varying float vNoise;
        uniform float uTime;
        uniform float uSeed;
        uniform float uScatter;

        // 3D Noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i); 
            vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m; return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vUv = uv;
            vec3 pos = position;
            
            // Scatter 슬라이더로 입체 파동의 크기를 제어
            float noiseZ = snoise(vec3(pos.x * 1.5, pos.y * 1.5, uTime * 0.2 + uSeed));
            pos.z += noiseZ * (0.1 + uScatter * 0.1); 
            
            vNoise = noiseZ;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    // Fragment Shader: 오로라 빛의 렌더링 및 입자(경계선 흩어짐) 효과 적용
    const fragmentShader = `
        uniform float uTime;
        uniform float uAudio;
        uniform vec3 uColor;
        uniform float uScatter;
        uniform float uSeed;
        uniform int uShapeMode;
        uniform float uYOffset;
        
        varying vec2 vUv;
        varying float vNoise;

        void main() {
            vec2 uv = vUv;
            
            // 💡 오로라의 흐르는 궤적 계산
            float t = uTime * 0.2 + uSeed;
            float waveY = 0.5 + uYOffset + (vNoise * 0.2 * uScatter); 
            
            // 궤적으로부터의 거리 (거리가 가까울수록 중심부)
            float dist = abs(uv.y - waveY);
            
            // 💡 오로라 빛의 강도 (가운데는 엄청 밝고, 멀어지면 어두워짐)
            float intensity = 0.015 / (dist + 0.005);
            intensity *= (0.5 + uAudio * 2.5); // 주파수 터질 때 밝기 폭발

            float alpha = smoothstep(0.4, 0.0, dist);
            vec3 finalColor = uColor * intensity;

            // 💡 [핵심] 쉐이프 모드 적용 (경계선 소멸 입자 효과)
            if (uShapeMode > 0) {
                float cells = 60.0;
                vec2 grid = fract(uv * cells);
                
                // 오로라 에너지가 쎈 곳(중심)은 반지름이 크고, 약한 곳(가장자리)은 0으로 줄어듦
                float maxRadius = clamp(intensity * 0.15, 0.0, 0.45);
                float shapeAlpha = 0.0;
                
                if (maxRadius > 0.01) {
                    float d = length(grid - vec2(0.5));
                    
                    if (uShapeMode == 1) { // 1. 점 (Dots)
                        shapeAlpha = 1.0 - smoothstep(maxRadius - 0.05, maxRadius, d);
                    } else if (uShapeMode == 2) { // 2. 사각형 (Squares)
                        vec2 box = abs(grid - vec2(0.5));
                        float md = max(box.x, box.y);
                        shapeAlpha = 1.0 - smoothstep(maxRadius - 0.05, maxRadius, md);
                    } else if (uShapeMode == 3) { // 3. 입체 구슬 (Spheres)
                        if (d < maxRadius) {
                            float z = sqrt(maxRadius * maxRadius - d * d) / maxRadius;
                            shapeAlpha = 0.3 + z * 0.7; // 입체 명암
                        }
                    }
                }
                alpha *= shapeAlpha;
                // 입자 모드일 때 색상 보정
                finalColor = uColor * (0.5 + intensity * 0.8); 
            }

            if (alpha < 0.01) discard;

            // 겹칠수록 빛나는 Additive Blending 렌더링
            gl_FragColor = vec4(finalColor * alpha, alpha);
        }
    `;

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // 3겹이 겹칠 때 검은 테두리 생기는 현상 방지
        side: THREE.DoubleSide
    });

    // 해상도가 높은 평면 생성 (왜곡을 부드럽게 하기 위해 분할 수를 64x64로 높임)
    const geometry = new THREE.PlaneGeometry(6, 4, 64, 64);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = zOffset; // 3겹 깊이감
    
    this.scene.add(mesh);
    return { mesh, uniforms };
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

    // 카메라 및 씬 회전 (리얼 3D 입체감 부여)
    const time = Date.now() * 0.001;
    this.scene.rotation.y = Math.sin(time * 0.3) * 0.15; // 좌우 끄덕임
    this.scene.rotation.x = Math.cos(time * 0.2) * 0.05; // 상하 끄덕임

    // 3겹의 레이어에 각각 독립된 주파수 값 주입
    const audios = [this.smoothLow, this.smoothMid, this.smoothHigh];
    
    for (let i = 0; i < 3; i++) {
        const uni = this.layers[i].uniforms;
        uni.uTime.value = time;
        uni.uAudio.value = audios[i];
        uni.uScatter.value = scatter;
        uni.uSeed.value = seed;
        uni.uShapeMode.value = shapeMode;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.renderer && this.camera) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
      this.renderer = null;
    }
    this.layers.forEach(layer => {
        layer.mesh.geometry.dispose();
        layer.mesh.material.dispose();
    });
    this.layers = [];
    this.scene = null;
    this.camera = null;
    this.currentAudioData = null;
  }
}
