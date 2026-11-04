// ============================================================================
// [사용자 커스텀 쉐이프 추가 파일 - src/mandara/custom_shapes.js]
// 새로운 모양을 만들고 싶을 때, index.html을 수정할 필요 없이
// 아래처럼 registerMandalaShape({ ... }) 블록만 추가하면 자동으로 적용됩니다!
// ============================================================================

(function() {
  const { TAU, quad, circle } = window.MandalaUtils;

  // 9. [추가 예시 1] 나비 날개 / 하트 잎 (HEART_PETAL)
  registerMandalaShape({
    id: "HEART_PETAL",
    name: "🦋 나비하트 (Butterfly)",
    defaultWeight: 0.70,
    midBias: (mid) => 0.8 + mid * 0.5,
    generate(n, variant, which, morph) {
      const splines = [];
      const inner = 0.58;
      const spread = (Math.PI / n) * (0.85 + variant * 0.2);
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const base = [Math.cos(a) * inner, Math.sin(a) * inner];
        const notch = [Math.cos(a) * (0.88 + morph * 0.08), Math.sin(a) * (0.88 + morph * 0.08)];
        const lTip = [Math.cos(a - spread * 0.55) * 1.06, Math.sin(a - spread * 0.55) * 1.06];
        const rTip = [Math.cos(a + spread * 0.55) * 1.06, Math.sin(a + spread * 0.55) * 1.06];
        const lCtrl = [Math.cos(a - spread * 1.1) * 0.82, Math.sin(a - spread * 1.1) * 0.82];
        const rCtrl = [Math.cos(a + spread * 1.1) * 0.82, Math.sin(a + spread * 1.1) * 0.82];

        const s1 = quad(base, lCtrl, lTip, 6);
        const s2 = quad(lTip, [Math.cos(a - spread * 0.2) * 0.98, Math.sin(a - spread * 0.2) * 0.98], notch, 4);
        const s3 = quad(notch, [Math.cos(a + spread * 0.2) * 0.98, Math.sin(a + spread * 0.2) * 0.98], rTip, 4);
        const s4 = quad(rTip, rCtrl, base, 6);

        const poly = s1.concat(s2.slice(1), s3.slice(1), s4.slice(1));
        splines.push({ pts: poly, closed: true });
      }
      return splines;
    }
  });

  // 10. [추가 예시 2] 태양 광선 프리즘 (SUN_PRISM)
  registerMandalaShape({
    id: "SUN_PRISM",
    name: "☀️ 태양프리즘 (Prism)",
    defaultWeight: 0.65,
    midBias: (mid) => 0.7 + mid * 0.8,
    generate(n, variant, which, morph) {
      const splines = [];
      const rInner = 0.64;
      const rMid = 0.86 + morph * 0.08;
      const rOuter = 1.08 + variant * 0.08;
      const half = (Math.PI / n) * 0.72;

      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        // 바깥 다이아몬드 광선
        splines.push({
          pts: [
            [Math.cos(a) * rInner, Math.sin(a) * rInner],
            [Math.cos(a - half) * rMid, Math.sin(a - half) * rMid],
            [Math.cos(a) * rOuter, Math.sin(a) * rOuter],
            [Math.cos(a + half) * rMid, Math.sin(a + half) * rMid],
            [Math.cos(a) * rInner, Math.sin(a) * rInner],
          ],
          closed: true
        });
      }
      splines.push({ pts: circle(rInner * 0.95), closed: true, ringFill: true });
      return splines;
    }
  });
})();
