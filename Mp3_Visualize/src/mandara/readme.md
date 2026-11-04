1: 기존 src/mandara/shapes.js 파일에 쉐이프 추가하기가장 간단하게 기존 파일 안에서 모양을 늘리고 싶을 때 사용합니다.파일 열기:src/mandara/shapes.js 파일을 텍스트 에디터(VS Code, 메모장 등)로 엽니다.   코드 추가:파일의 가장 아래(또는 원하는 위치)에 아래 양식에 맞춰 registerMandalaShape({...}) 블록을 작성하고 저장합니다.   JavaScript// src/mandara/shapes.js 맨 아래에 추가하는 예시
registerMandalaShape({
  id: "MY_CUSTOM_SHAPE",             // 고유한 영문 아이디 (중복되면 안 됨)
  name: "⭐ 내 커스텀 별 (Custom Star)", // 우측 패널 슬라이더에 표시될 이름
  defaultWeight: 0.80,              // 기본 출현 비중 (0.0 ~ 1.0)
  midBias: (mid) => 0.7 + mid * 0.5,  // 오디오 중음(Mid)에 따른 출현 확률 가중치
  
  // 쉐이프를 그려내는 핵심 함수
  generate(n, variant, which, morph) {
    const { TAU, quad, circle, polygon } = window.MandalaUtils;
    const splines = [];

    // n: 대칭축 개수 (예: 12방향)
    // variant: 0~1 사이의 무작위 변형값 (모양마다 형태를 조금씩 다르게 만듦)
    // morph: 오디오(중음) 주파수에 따라 실시간으로 변하는 수치 (0 ~ 1)
    
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const r = 1.0 + morph * 0.1; // 음악 비트에 맞춰 크기가 미세하게 숨쉼

      // 각 쉐이프(폴리곤)의 점 좌표 배열 지정 (closed: true면 내부 그라디언트 채움 적용)
      splines.push({
        pts: [
          [Math.cos(a) * 0.4, Math.sin(a) * 0.4],
          [Math.cos(a - 0.2) * r, Math.sin(a - 0.2) * r],
          [Math.cos(a) * (r * 1.2), Math.sin(a) * (r * 1.2)],
          [Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r],
          [Math.cos(a) * 0.4, Math.sin(a) * 0.4],
        ],
        closed: true,
        ringFill: false // true면 원형 방사형 그라디언트, false면 입체 방향성 그라디언트
      });
    }

    return splines; // 생성된 도형 데이터 반환
  }
});
방법 2: 새로운 .js 파일을 만들어 추가하기 (가장 추천하는 모듈형 관리)코드가 섞이지 않도록 새로운 모양들을 별도의 파일로 깔끔하게 분리하고 싶을 때 사용합니다.새 파일 생성:src/mandara/ 폴더 안에 새로운 자바스크립트 파일(예: my_new_shapes.js)을 만듭니다.코드 작성:새로 만든 파일 안에 아래와 같이 작성하고 저장합니다.   JavaScript// src/mandara/my_new_shapes.js 파일 내용
(function() {
  // 공통 헬퍼 가져오기
  const { TAU, quad, circle, polygon } = window.MandalaUtils;

  registerMandalaShape({
    id: "ANOTHER_SHAPE",
    name: "🌸 나만의 꽃 (My Flower)",
    defaultWeight: 0.75,
    midBias: (mid) => 0.8 + mid * 0.4,
    generate(n, variant, which, morph) {
      const splines = [];
      // 여기에 원하는 기하학 / 꽃잎 / 선 수식 작성
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        splines.push({
          pts: circle(0.8, 16, a), // 예시: 작은 원들을 대칭으로 배치
          closed: true,
          ringFill: true
        });
      }
      return splines;
    }
  });
})();
index.html에 스크립트 연결 등록하기:메인 파일인 index.html을 열고, 하단에 있는 <script> 로딩 영역을 찾습니다.   기존에 있던 shapes.js 아래에 새로 만든 파일 경로를 <script> 태그로 한 줄 추가해 줍니다.   HTML<!-- index.html 하단 스크립트 영역 -->
<script src="src/mandara/utils.js"></script>
<script src="src/mandara/shapes.js"></script>
<script src="src/mandara/custom_shapes.js"></script>
<!-- 👇 여기에 새로 만든 파일 추가! -->
<script src="src/mandara/my_new_shapes.js"></script>
💡 만다라 느낌을 살리는 쉐이프 제작 팁 (복합 중첩 구조 만들기)단순한 선 하나만 그리면 만다라 특유의 화려함이 살지 않습니다. 하나의 generate 함수 안에서 여러 번 splines.push(...)를 호출하여 아래와 같이 복합 레이어를 구성하는 것이 좋습니다:   외곽 테두리 링: circle(1.0, 64) 등을 이용해 전체 프레임 잡기   중간 메인 모티프: 대칭축(n)에 맞춘 꽃잎이나 다이아몬드 도형 반복 배치 (여기에 closed: true와 ringFill: false 적용)   안쪽 코어 톱니/웹: 촘촘한 기하학 톱니바퀴나 방사형 살(Strut)을 추가로 push하여 안쪽을 채우기
