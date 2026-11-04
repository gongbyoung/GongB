// ============================================================================
// [무한만다라 공통 수학 & 기하학 헬퍼 라이브러리]
// ============================================================================

window.TAU = Math.PI * 2;
window.MandalaShapes = window.MandalaShapes || [];

window.registerMandalaShape = function(shapeConfig) {
  const idx = window.MandalaShapes.findIndex(s => s.id === shapeConfig.id);
  if (idx >= 0) {
    window.MandalaShapes[idx] = shapeConfig; 
  } else {
    window.MandalaShapes.push(shapeConfig);
  }
};

window.MandalaUtils = {
  TAU: Math.PI * 2,

  quad(p0, p1, p2, steps = 8) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]);
    }
    return pts;
  },

  circle(r, segs = 56, phase = 0.0) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = phase + (Math.PI * 2 * i) / segs;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  },

  polygon(r, sides = 6, phase = 0.0) {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
      const a = phase + (Math.PI * 2 * i) / sides;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }
};
