// ============================================================================
// [무한만다라 공통 수학 & 기하학 헬퍼 라이브러리]
// 모든 쉐이프 파일에서 MandalaUtils.quad(), MandalaUtils.circle() 등으로 사용 가능
// ============================================================================

window.TAU = Math.PI * 2;

// 전역 쉐이프 레지스트리 (여기에 등록된 모든 모양이 UI 슬라이더 및 엔진에 자동 반영됨)
window.MandalaShapes = window.MandalaShapes || [];

window. registerMandalaShape = function(shapeConfig) {
  // 중복 ID 덮어쓰기 지원
  const idx = window.MandalaShapes.findIndex(s => s.id === shapeConfig.id);
  if (idx >= 0) {
    window.MandalaShapes[idx] = shapeConfig;
  } else {
    window.MandalaShapes.push(shapeConfig);
  }
};

window.MandalaUtils = {
  TAU: Math.PI * 2,

  // 2차 베지어 곡선 생성 (p0 -> p1(제어점) -> p2)
  quad(p0, p1, p2, steps = 8) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.append ? pts.append([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]) : pts.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]);
    }
    return pts;
  },

  // 원형 폴리곤 생성
  circle(r, segs = 56, phase = 0.0) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = phase + (Math.PI * 2 * i) / segs;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  },

  // 정다각형 생성
  polygon(r, sides = 6, phase = 0.0) {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
      const a = phase + (Math.PI * 2 * i) / sides;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }
};
