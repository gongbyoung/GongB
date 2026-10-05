class PaperNoiseEngine {
  constructor(width, height, config = {}) {
    this.width = width;
    this.height = height;
    this.roughness = config.roughness || 0.5; // 거친 정도 (0.1 ~ 1.0)
    
    // 픽셀별 요철 데이터를 저장할 1차원 배열 (0.0 ~ 1.0)
    this.noiseMap = new Float32Array(width * height);
    this.generateNoise();
  }

  generateNoise() {
    // 간단한 난수 기반 요철 맵 생성 (추후 Perlin Noise 알고리즘으로 업그레이드 가능)
    for (let i = 0; i < this.noiseMap.length; i++) {
      // 거칠기(roughness)에 따라 깊게 파인 섬유질(높은 값)과 평평한 곳(낮은 값) 혼합
      this.noiseMap[i] = Math.random() < this.roughness ? Math.random() : 0.1;
    }
  }

  renderBackground(ctx) {
    // 시각적인 화선지 배경색 렌더링
    ctx.fillStyle = '#faf7f2';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  getMap() {
    return this.noiseMap;
  }
}
