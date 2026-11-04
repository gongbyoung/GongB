새로운 쉐이프(모양)를 추가하는 방법
src/mandara/custom_shapes.js (또는 shapes.js) 파일을 VS Code나 메모장으로 열고 아래 템플릿을 복사해서 맨 아래에 붙여넣기만 하면, 우측 컨트롤 패널에 슬라이더가 자동 생성되고 만다라에 즉시 반영.

JavaScript
// src/mandara/custom_shapes.js 에 추가하는 예시
registerMandalaShape({
  id: "MY_NEW_SHAPE",               // 고유 영문 ID
  name: "💎 크리스탈 링 (Crystal)",  // 우측 UI 슬라이더에 표시될 이름
  defaultWeight: 0.75,              // 초기 출현 비중 (0.0 ~ 1.0)
  midBias: (mid) => 0.8 + mid * 0.5, // 오디오 중음(Mid)에 따른 출현 확률 가중치

  // n: 대칭축 개수, variant: 랜덤 변형값(0~1), which: 타입 번호, morph: 오디오 반응값(0~1)
  generate(n, variant, which, morph) {
    const { TAU, quad, circle } = window.MandalaUtils;
    const splines = [];

    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const spread = (Math.PI / n) * 0.6;
      const innerR = 0.6;
      const outerR = 1.0 + morph * 0.15; // 오디오에 맞춰 끝부분이 늘어남

      // 닫힌 다각형 좌표 배열 (closed: true 로 설정하면 도형 내부에 독립 그라디언트가 채워짐)
      splines.push({
        pts: [
          [Math.cos(a) * innerR, Math.sin(a) * innerR],
          [Math.cos(a - spread) * 0.85, Math.sin(a - spread) * 0.85],
          [Math.cos(a) * outerR, Math.sin(a) * outerR],
          [Math.cos(a + spread) * 0.85, Math.sin(a + spread) * 0.85],
          [Math.cos(a) * innerR, Math.sin(a) * innerR],
        ],
        closed: true
      });
    }
    return splines;
  }
});
팁:もし 파일 자체를 여러 개(shape_pack2.js, shape_pack3.js 등)로 나누어 관리시는 src/mandara/ 폴더에 파일을 넣으신 뒤, index.html 하단의 <script src="src/mandara/custom_shapes.js"></script> 바로 아래에 <script src="src/mandara/새파일이름.js"></script> 한 줄만 추가
