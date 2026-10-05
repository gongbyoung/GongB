class MultiBristleBrush {
  constructor(config = {}) {
    this.numBristles = config.bristles || 50; // 붓털 가닥 수
    this.baseSize = config.size || 20;        // 붓의 굵기
    this.color = config.color || 'rgba(0,0,0,0.8)';
    
    this.bristles = [];
    this.initBristles();
  }

  initBristles() {
    this.bristles = [];
    for (let i = 0; i < this.numBristles; i++) {
      // 붓 중심으로부터 무작위로 흩어진 털들의 상대 좌표 (원형 분포)
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.baseSize;
      this.bristles.push({
        offsetX: Math.cos(angle) * radius,
        offsetY: Math.sin(angle) * radius,
        x: 0, y: 0,
        isInit: false,
        size: Math.random() * 1.5 + 0.5 // 털 가닥마다 미세하게 다른 두께
      });
    }
  }

  reset() {
    // 획을 떼었을 때 붓털 위치 초기화
    this.bristles.forEach(b => b.isInit = false);
  }

  draw(ctx, startX, startY, endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    
    // 속도가 빠를수록 원심력/마찰력에 의해 털 간격이 벌어짐 (갈필 비백 현상)
    const speedFactor = Math.min(1.5, distance / 10); 

    ctx.save();
    ctx.fillStyle = this.color;
    
    let minX = endX, minY = endY, maxX = endX, maxY = endY;

    this.bristles.forEach(b => {
      // 목표 위치 (현재 붓 중심 + 털 고유의 오프셋 * 속도에 따른 벌어짐)
      const targetX = endX + b.offsetX * (1 + speedFactor * 0.5);
      const targetY = endY + b.offsetY * (1 + speedFactor * 0.5);

      if (!b.isInit) {
        b.x = startX + b.offsetX;
        b.y = startY + b.offsetY;
        b.isInit = true;
      }

      // 털이 목표 위치로 탄력적으로 끌려옴 (Spring Damping)
      b.x += (targetX - b.x) * 0.4;
      b.y += (targetY - b.y) * 0.4;

      // 캔버스에 털 자국 렌더링
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();

      // 업데이트 영역 계산 (유체 엔진으로 넘기기 위함)
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.y > maxY) maxY = b.y;
    });

    ctx.restore();

    // 붓이 칠해진 대략적인 사각형 영역 반환
    return { x: Math.floor(minX), y: Math.floor(minY), w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
  }
}
