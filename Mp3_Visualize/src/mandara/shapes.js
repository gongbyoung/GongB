// ============================================================================
// [무한만다라 고밀도 복합 쉐이프 모음 - src/mandara/shapes.js]
// 하나의 쉐이프 호출 내에서 수십 개의 서브 층과 정교한 디테일이 중첩됩니다.
// ============================================================================

const { TAU, quad, circle, polygon } = window.MandalaUtils;

// 1. [고밀도 복합 1] 진짜 기와 & 기와골 복합 레이어 (TILE_COMPLEX)
registerMandalaShape({
  id: "TILE_COMPLEX",
  name: "🏛️ 전통 기와 레이스 (Tile Complex)",
  defaultWeight: 0.85,
  midBias: (mid) => 0.8 + mid * 0.6,
  generate(n, variant, which, morph) {
    const splines = [];
    // 외곽 테두리 링 3중 중첩
    splines.push({ pts: circle(1.0, 64), closed: true, ringFill: false });
    splines.push({ pts: circle(0.96, 64), closed: true, ringFill: true });
    splines.push({ pts: circle(0.92, 64), closed: true, ringFill: false });

    const bowl = (TAU / n) * (0.4 + variant * 0.2);
    // 수십 개의 기와 수직 기와골 연속 표현
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const cx = Math.cos(a), cy = Math.sin(a);
      const arc = [];
      for (let s = 0; s <= 12; s++) {
        const ang = a - Math.PI / 2 + (Math.PI * s) / 12;
        arc.push([cx + Math.cos(ang) * bowl * 0.9, cy + Math.sin(ang) * bowl * 0.9]);
      }
      splines.push({ pts: arc, closed: true });

      // 안쪽으로 연속 파고드는 기와골 서브 층 (수십 개 중첩)
      for (let sub = 1; sub <= 4; sub++) {
        const subR = 1.0 - sub * 0.15;
        const subPts = [];
        for (let k = 0; k <= 12; k++) {
          const ang = (TAU * k) / 12;
          subPts.push([Math.cos(a) * subR + Math.cos(ang) * (bowl * 0.25), Math.sin(a) * subR + Math.sin(ang) * (bowl * 0.25)]);
        }
        splines.push({ pts: subPts, closed: true, ringFill: true });
      }
    }
    return splines;
  }
});

// 2. [고밀도 복합 2] 겹겹이 밀집된 연꽃 만다라 (LOTUS_DENSE)
registerMandalaShape({
  id: "LOTUS_DENSE",
  name: "🪷 고밀도 천층 연꽃 (Lotus Dense)",
  defaultWeight: 0.90,
  midBias: (mid) => 0.75 + mid * 0.8,
  generate(n, variant, which, morph) {
    const splines = [];
    const layers = 4; // 4겹의 레이어가 안쪽으로 연속 배치
    for (let l = 0; l < layers; l++) {
      const scale = 1.0 - l * 0.18;
      const count = n + l * 4;
      const rotOffset = l * (Math.PI / count);
      for (let i = 0; i < count; i++) {
        const a = rotOffset + (TAU * i) / count;
        const tipR = (1.05 - l * 0.15 + morph * 0.08) * scale;
        const baseR = (0.4 + l * 0.1) * scale;
        const width = (Math.PI / count) * 0.85;

        const tip = [Math.cos(a) * tipR, Math.sin(a) * tipR];
        const b1 = [Math.cos(a - width) * baseR, Math.sin(a - width) * baseR];
        const b2 = [Math.cos(a + width) * baseR, Math.sin(a + width) * baseR];
        const ctrl = [Math.cos(a) * ((baseR + tipR) * 0.5), Math.sin(a) * ((baseR + tipR) * 0.5)];

        const left = quad(b1, ctrl, tip, 6);
        const right = quad(tip, ctrl, b2, 6);
        const poly = left.concat(right.slice(1));
        poly.push(b1);
        splines.push({ pts: poly, closed: true });
      }
    }
    // 아주 작은 중심 코어 환형 추가
    splines.push({ pts: circle(0.15, 32), closed: true, ringFill: true });
    return splines;
  }
});

// 3. [고밀도 복합 3] 크리스탈 다이아몬드 로제타 (DIAMOND_ROSETTE)
registerMandalaShape({
  id: "DIAMOND_ROSETTE",
  name: "💎 크리스탈 로제타 (Diamond Rosette)",
  defaultWeight: 0.80,
  midBias: (mid) => 0.7 + mid * 0.9,
  generate(n, variant, which, morph) {
    const splines = [];
    const rOuter = 1.05 + morph * 0.1;
    const rMid = 0.72;
    const rInner = 0.38;
    const half = (Math.PI / n) * 0.75;

    // 외곽 다이아몬드 스파이크
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
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

    // 중간 선에 걸치는 촘촘한 기하 톱니 레이어 (수십 개 연속 반복)
    const nSub = n * 2;
    const subPts = [];
    for (let i = 0; i <= nSub; i++) {
      const a = (TAU * i) / nSub;
      const rr = i % 2 === 0 ? rMid * 0.95 : rInner * 1.25;
      subPts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    splines.push({ pts: subPts, closed: true, ringFill: true });
    splines.push({ pts: circle(rInner * 0.85, 28), closed: true, ringFill: false });
    return splines;
  }
});

// 4. [고밀도 복합 4] 네온 메타트론 웹 (METATRON_WEB)
registerMandalaShape({
  id: "METATRON_WEB",
  name: "🕸️ 신성 메타트론 웹 (Metatron Web)",
  defaultWeight: 0.75,
  midBias: (mid) => 0.8 + mid * 0.7,
  generate(n, variant, which, morph) {
    const splines = [];
    const count = Math.max(4, Math.floor(n / 1.5));

    // 다중 회전 프레임 3중 중첩
    for (let layer = 0; layer < 3; layer++) {
      const rot = layer * 0.35;
      const r = 1.0 - layer * 0.28 + morph * 0.05;
      const poly = [];
      for (let i = 0; i <= count; i++) {
        const a = rot + (TAU * i) / count;
        poly.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      splines.push({ pts: poly, closed: true, ringFill: layer === 1 });
    }

    // 안쪽 방사형 연결 살 (스트럿) 수십 개
    for (let i = 0; i < n * 2; i++) {
      const a = (TAU * i) / (n * 2);
      splines.push({
        pts: [
          [Math.cos(a) * 0.25, Math.sin(a) * 0.25],
          [Math.cos(a) * 0.92, Math.sin(a) * 0.92]
        ],
        closed: false
      });
    }
    return splines;
  }
});

// 5. [고밀도 복합 5] 소용돌이 플레어 (SPIRAL_COMPLEX)
registerMandalaShape({
  id: "SPIRAL_COMPLEX",
  name: "🌪️ 소용돌이 플레어 (Spiral Complex)",
  defaultWeight: 0.75,
  midBias: (mid) => 0.6 + mid * 1.1,
  generate(n, variant, which, morph) {
    const splines = [];
    const twist = 0.75 + variant * 0.3 + morph * 0.25;

    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const p0 = [Math.cos(a) * 0.3, Math.sin(a) * 0.3];
      const pMid = [Math.cos(a + twist * 0.5) * 0.75, Math.sin(a + twist * 0.5) * 0.75];
      const pTip = [Math.cos(a + twist) * 1.08, Math.sin(a + twist) * 1.08];
      const pBack = [Math.cos(a + twist * 0.35) * 0.65, Math.sin(a + twist * 0.35) * 0.65];

      const side1 = quad(p0, pMid, pTip, 8);
      const side2 = quad(pTip, pBack, p0, 8);
      splines.push({ pts: side1.concat(side2.slice(1)), closed: true });
    }

    // 안쪽 역회전 톱니 레이어 추가
    const innerPts = [];
    const innerN = n * 2;
    for (let i = 0; i <= innerN; i++) {
      const a = - (TAU * i) / innerN;
      const rr = i % 2 === 0 ? 0.42 : 0.28;
      innerPts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    splines.push({ pts: innerPts, closed: true, ringFill: true });
    return splines;
  }
});
