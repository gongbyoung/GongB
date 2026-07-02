/**
 * 003_glsl_noise.js
 * GPU 프래그먼트 셰이더 기반 오디오 반응형 추상 노이즈 아트
 */
export default class GlslNoise {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.uniforms = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    const vertexShader = `
      void main() { gl_Position = vec4(position, 1.0); }
    `;

    // 🌊 음악에 맞추어 시각적 카오스를 만들어내는 GPU 프래그먼트 셰이더 코드
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;

      // GPU용 사인 노이즈 함수
      float noise(in vec2 p) {
        return sin(p.x * 3.0) * sin(p.y * 3.0);
      }

      void main() {
        // 중심점 기준 (-1.0 ~ 1.0) 좌표계 정규화
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);

        // 음악 주파수 왜곡율 계산
        float distort = u_bass * 4.0;
        
        // 유기적인 왜곡 루프 연산 (음악 중음/고음에 반응)
        for(float i = 1.0; i < 4.0; i++) {
          uv.x += sin(uv.y + u_time * 0.5 + u_mid) * 0.4 / i;
          uv.y += cos(uv.x + u_time * 0.3 + u_treble) * 0.3 / i;
        }

        // 고음(Treble) 수치에 따라 입자감 텍스처 추가
        float strength = noise(uv * (1.0 + distort));

        // 최종 컬러 조합 (저음=R, 중음=G, 고음=B 성향 강조)
        vec3 color = vec3(
          strength + u_bass * 0.5,
          strength * 0.5 + u_mid * 0.3,
          strength + 0.5 + sin(u_time) * 0.2 + u_treble
        );

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.uniforms = {
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_bass: { value: 0 },
      u_mid: { value: 0 },
      u_treble: { value: 0 }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.uniforms.u_time.value += 0.008;
    if (audioData) {
      this.uniforms.u_bass.value = audioData.bass;
      this.uniforms.u_mid.value = audioData.mid;
      this.uniforms.u_treble.value = audioData.treble;
    }

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