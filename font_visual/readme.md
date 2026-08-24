project/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── utils.js        # 공통 유틸리티 (SRT 파싱, 한글 분해, 이징 등)
│   ├── colorStyles.js  # 색상 스타일 정의
│   ├── recorder.js     # MP4 저장
│   └── app.js          # 메인 컨트롤러 (UI, 렌더링, 타이머)
├── styles/             # ★ 스타일별 타이포 모션 파일들
│   ├── drive001.js
│   ├── dance001.js
│   ├── ballad001.js
│   ├── rock001.js
│   ├── newage001.js
│   ├── traditional001.js
│   └── sleeping001.js
└── README.md           # 개발 가이드

전역 객체
이름	타입	설명
window.TypoMotionStyles	Object	스타일 파일들이 등록되는 글로벌 스토어
window.TypoMotionStyles[styleId]	Object	특정 스타일의 정보와 프리셋들
window.TypoMotionStyles[styleId].presets	Object	모션 프리셋 모음 (키: 프리셋 id)
window.TypoMotionStyles[styleId].presets[presetId]	Object	단일 모션 프리셋

공통 유틸리티 함수 (utils.js)
함수	설명
timeToSeconds(srtTimeStr)	"00:00:03,500" → 초(float) 변환
parseSRT(content)	SRT 문자열을 큐 배열로 파싱
formatTime(seconds)	초 → "00:00.00" 표시용
decomposeKorean(syllable)	한글 음절 → [초성, 중성, 종성] 배열
easeOutBounce(p)	바운스 이징
easeOutBack(p)	백 이징
easeOutElastic(p)	탄성 이징
easeInOutCubic(p)	부드러운 인아웃

색상 스타일 (colorStyles.js)
함수	설명
getColorForCue(index, styleName)	큐 인덱스와 스타일명으로 색상 반환
스타일명: 'harmony', 'monochrome', 'pastel', 'neon', 'primary'	
메인 상태 변수 (app.js에서 관리)
변수	설명
allLeds	현재 화면의 모든 자모 LED 객체 배열
currentTime	현재 재생/타임라인 시간
currentFont	현재 선택된 폰트
currentFontSize	현재 폰트 크기
scatterAmount	흩어짐 정도 (0~1)
currentColorStyle	현재 색상 스타일
currentStyleId	로드된 타이포 스타일 ID
currentPresetId	선택된 모션 프리셋 ID
핵심 함수 (app.js)
함수	설명
loadSRT(content)	SRT 로드 시 처리
buildAllLeds()	음절별 자모 LED 생성
assignInitialPositions()	LED 초기 랜덤 배치
avoidOverlaps()	LED 겹침 회피
render()	캔버스 렌더링
applyMotionPreset(led, time)	현재 프리셋을 LED에 적용하여 변형 반환
loadStyle(styleId)	스타일 JS 파일을 동적으로 로드
populatePresetSelect()	로드된 스타일의 프리셋들을 UI 드롭다운에 추가
