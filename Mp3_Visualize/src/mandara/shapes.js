// ============================================================================
// [무한만다라 기본 쉐이프 모음 - src/mandara/shapes.js]
// 이 파일에서 모양 수식을 수정하거나 registerMandalaShape({...})를 복사해 추가하면
// index.html의 UI 슬라이더와 렌더링 엔진에 자동으로 100% 반영됩니다!
// ============================================================================

const { TAU, quad, circle } = window.MandalaUtils;

// 1. 꽃잎 (PETAL)
registerMandalaShape({
  id: "PETAL",
  name: "🌸 꽃잎 (Petal)",
  defaultWeight: 0.85,
  midBias: (mid) => 0.75 + mid,
  generate(n, variant, which, morph) {
    const splines = [];
    const bulge = 0.09 + variant * 0.05 + morph * 0.04;
    const inner = 0.66;
    const steps = 8;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const half = (Math.PI / n) * 0.88;
      const tip = [Math.cos(a), Math.sin(a)];
      const bl = [Math.cos(a - half) * inner, Math.sin(a - half) * inner];
      const br = [Math.cos(a + half) * inner, Math.sin(a + half) * inner];
      const mid = [Math.cos(a) * (inner + 1) * 0.5, Math.sin(a) * (inner + 1) * 0.5];
      const px = Math.cos(a + Math.PI / 2) * bulge;
      const py = Math.sin(a + Math.PI / 2) * bulge;
      const left = quad(bl, [mid[0] + px, mid[1] + py], tip, steps);
      const right = quad(tip, [mid[0] - px, mid[1] - py], br, steps);
      const poly = left.concat(right.slice(1));
      poly.push(bl);
      splines.push({ pts: poly, closed: true, ringFill: false });
    }
    splines.push({ pts: circle(inner * 0.96), closed: true, ringFill: true });
    return splines;
  }
});

// 2. 연꽃 (LOTUS)
registerMandalaShape({
  id: "LOTUS",
  name: "🪷 연꽃 (Lotus)",
  defaultWeight: 0.80,
  midBias: (mid) => 0.8 + mid * 0.6,
  generate(n, variant, which, morph) {
    const splines = [];
    const inner = 0.52;
    const steps = 10;
    const width = (Math.PI / n) * (1.1 + variant * 0.35);
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const tipR = 1.0 + morph * 0.12;
      const tip = [Math.cos(a) * tipR, Math.sin(a) * tipR];
      const bl = [Math.cos(a - width) * inner, Math.sin(a - width) * inner];
      const br = [Math.cos(a + width) * inner, Math.sin(a + width) * inner];
      const ctrlR = inner + (tipR - inner) * 0.62;
      const cl = [Math.cos(a - width * 1.15) * ctrlR, Math.sin(a - width * 1.15) * ctrlR];
      const cr = [Math.cos(a + width * 1.15) * ctrlR, Math.sin(a + width * 1.15) * ctrlR];
      const left = quad(bl, cl, tip, steps);
      const right = quad(tip, cr, br, steps);
      const poly = left.concat(right.slice(1));
      poly.push(bl);
      splines.push({ pts: poly, closed: true });
    }
    return splines;
  }
});

// 3. 전통 기와 (TILE)
registerMandalaShape({
  id: "TILE",
  name: "🏛️ 기와 (Tile)",
  defaultWeight: 0.50,
  midBias: (mid) => 1.15 - mid * 0.45,
  generate(n, variant, which, morph) {
    const splines = [
      { pts: circle(1.0), closed: true, ringFill: true },
      { pts: circle(0.9), closed: true, ringFill: true }
    ];
    const curl = 0.5 + variant * 0.3 + morph * 0.2;
    const bowl = (TAU / n) * (0.42 + curl * 0.2);
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const arc = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const ang = a - Math.PI / 2 + (Math.PI * s) / steps;
        arc.push([cx + Math.cos(ang) * bowl, cy + Math.sin(ang) * bowl]);
      }
      arc.push([cx + Math.cos(a - Math.PI / 2) * bowl, cy + Math.sin(a - Math.PI / 2) * bowl]);
      splines.push({ pts: arc, closed: true });

      const nose = 1 + bowl * 0.95;
      const nx = Math.cos(a) * nose, ny = Math.sin(a) * nose;
      const nr = bowl * 0.32;
      const noseCircle = [];
      for (let k = 0; k <= 16; k++) {
        noseCircle.push([nx + Math.cos((TAU * k) / 16) * nr, ny + Math.sin((TAU * k) / 16) * nr]);
      }
      splines.push({ pts: noseCircle, closed: true });
    }
    return splines;
  }
});

// 4. 만화경 별 (STAR)
registerMandalaShape({
  id: "STAR",
  name: "✨ 만화경 별 (Star)",
  defaultWeight: 0.70,
  midBias: (mid) => 0.7 + mid * 0.75,
  generate(n, variant, which, morph) {
    const splines = [];
    const inner = 0.48 + variant * 0.18;
    const midR = 0.78 + morph * 0.1;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const stepA = Math.PI / n;
      const poly = [
        [Math.cos(a) * 1.08, Math.sin(a) * 1.08],
        [Math.cos(a + stepA * 0.55) * midR, Math.sin(a + stepA * 0.55) * midR],
        [Math.cos(a) * inner, Math.sin(a) * inner],
        [Math.cos(a - stepA * 0.55) * midR, Math.sin(a - stepA * 0.55) * midR],
        [Math.cos(a) * 1.08, Math.sin(a) * 1.08],
      ];
      splines.push({ pts: poly, closed: true });
    }
    return splines;
  }
});

// 5. 형이상 (META)
registerMandalaShape({
  id: "META",
  name: "🔮 형이상 (Meta)",
  defaultWeight: 0.55,
  midBias: (mid) => 0.7 + mid * 0.85,
  generate(n, variant, which, morph) {
    const splines = [];
    if (which % 3 === 0) {
      const s = (TAU / n) * (0.32 + morph * 0.1);
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const outward = i % 2 === 0;
        const tipR = 1 + (outward ? s : -s * 0.85);
        const baseR = 1 + (outward ? -s * 0.25 : s * 0.2);
        const spread = (Math.PI / n) * 0.7;
        splines.push({
          pts: [
            [Math.cos(a) * tipR, Math.sin(a) * tipR],
            [Math.cos(a - spread) * baseR, Math.sin(a - spread) * baseR],
            [Math.cos(a + spread) * baseR, Math.sin(a + spread) * baseR],
            [Math.cos(a) * tipR, Math.sin(a) * tipR],
          ],
          closed: true
        });
      }
      splines.push({ pts: circle(0.9), closed: true, ringFill: true });
    } else if (which % 3 === 1) {
      const cr = (TAU / n) * 0.48;
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const cx = Math.cos(a), cy = Math.sin(a);
        const cPts = [];
        for (let k = 0; k <= 18; k++) {
          cPts.push([cx + Math.cos((TAU * k) / 18) * cr, cy + Math.sin((TAU * k) / 18) * cr]);
        }
        splines.push({ pts: cPts, closed: true });
      }
    } else {
      const inner = 0.78 - morph * 0.06;
      for (let i = 0; i < n; i++) {
        const a0 = (TAU * i) / n;
        const a1 = (TAU * (i + 0.65)) / n;
        splines.push({
          pts: [
            [Math.cos(a0) * inner, Math.sin(a0) * inner],
            [Math.cos(a0), Math.sin(a0)],
            [Math.cos(a1), Math.sin(a1)],
            [Math.cos(a1) * inner, Math.sin(a1) * inner],
            [Math.cos(a0) * inner, Math.sin(a0) * inner],
          ],
          closed: true
        });
      }
    }
    return splines;
  }
});

// 6. 기하학 (GEO)
registerMandalaShape({
  id: "GEO",
  name: "📐 기하학 (Geo)",
  defaultWeight: 0.45,
  midBias: (mid) => 1.1 - mid * 0.3,
  generate(n, variant, which, morph) {
    if (which % 3 === 0) {
      const spread = (Math.PI / n) * 0.78;
      const fat = 0.08 + morph * 0.04;
      const splines = [];
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        splines.push({
          pts: [
            [Math.cos(a) * (1 + fat), Math.sin(a) * (1 + fat)],
            [Math.cos(a + spread), Math.sin(a + spread)],
            [Math.cos(a) * (1 - fat), Math.sin(a) * (1 - fat)],
            [Math.cos(a - spread), Math.sin(a - spread)],
            [Math.cos(a) * (1 + fat), Math.sin(a) * (1 + fat)],
          ],
          closed: true
        });
      }
      return splines;
    }
    if (which % 3 === 1) {
      const inner = 0.78 - morph * 0.06;
      const pts = [];
      for (let i = 0; i <= n * 2; i++) {
        const a = (TAU * i) / (n * 2);
        const rr = i % 2 === 0 ? 1.0 : inner;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      return [{ pts, closed: true, ringFill: true }];
    }
    const k = Math.max(2, Math.floor(n / 3));
    const pts = [];
    let idx = 0;
    for (let i = 0; i <= n; i++) {
      const a = (TAU * idx) / n - Math.PI / 2;
      pts.push([Math.cos(a), Math.sin(a)]);
      idx = (idx + k) % n;
    }
    return [{ pts, closed: true, ringFill: true }];
  }
});

// 7. 신성 기하학 파동 (SACRED)
registerMandalaShape({
  id: "SACRED",
  name: "🕸️ 신성파동 (Wave)",
  defaultWeight: 0.60,
  midBias: (mid) => 0.85 + mid * 0.4,
  generate(n, variant, which, morph) {
    const splines = [];
    const lobes = n;
    const pts = [];
    const steps = lobes * 12;
    const amp = 0.14 + variant * 0.08 + morph * 0.06;
    for (let i = 0; i <= steps; i++) {
      const t = (TAU * i) / steps;
      const r = 0.9 + Math.sin(t * lobes) * amp + Math.cos(t * lobes * 2) * (amp * 0.4);
      pts.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
    splines.push({ pts, closed: true, ringFill: true });

    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const r0 = 0.68;
      const r1 = 0.9 + amp;
      const w = (Math.PI / n) * 0.45;
      splines.push({
        pts: [
          [Math.cos(a) * r0, Math.sin(a) * r0],
          [Math.cos(a - w) * ((r0 + r1) * 0.5), Math.sin(a - w) * ((r0 + r1) * 0.5)],
          [Math.cos(a) * r1, Math.sin(a) * r1],
          [Math.cos(a + w) * ((r0 + r1) * 0.5), Math.sin(a + w) * ((r0 + r1) * 0.5)],
          [Math.cos(a) * r0, Math.sin(a) * r0],
        ],
        closed: true
      });
    }
    return splines;
  }
});

// 8. 불꽃 / 물방울 (FLAME)
registerMandalaShape({
  id: "FLAME",
  name: "🔥 불꽃물방울 (Drop)",
  defaultWeight: 0.65,
  midBias: (mid) => 0.75 + mid * 0.7,
  generate(n, variant, which, morph) {
    const splines = [];
    const inner = 0.62;
    const twist = (variant - 0.5) * (TAU / n) * 0.8 + morph * 0.15;
    const steps = 9;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const tip = [Math.cos(a + twist) * 1.06, Math.sin(a + twist) * 1.06];
      const base = [Math.cos(a) * inner, Math.sin(a) * inner];
      const spread = (Math.PI / n) * 0.75;
      const c1 = [Math.cos(a - spread) * 0.85, Math.sin(a - spread) * 0.85];
      const c2 = [Math.cos(a + spread) * 0.85, Math.sin(a + spread) * 0.85];
      const left = quad(base, c1, tip, steps);
      const right = quad(tip, c2, base, steps);
      const poly = left.concat(right.slice(1));
      splines.push({ pts: poly, closed: true });
    }
    return splines;
  }
});
