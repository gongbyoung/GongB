root/
├── assets/ 기본 이미지, 음악
│  
├── src/
│   ├── main.js              # 코어 매니저 및 글로벌 라우터
│   ├── core/
│   │   ├── AudioAnalyzer.js # 오디오 주파수 분석 코어
│   │   ├── SketchManager.js # 스케치 전환 관리자
│   │   ├── VideoRecorder.js # 영상 녹화기
│   │   ├── WordVisualMatcher.js
│   │   └── LyricSync.js     # SRT 자막 싱크 매니저
│   └── sketches/
│       └──  👈 [본 스케치 파일]

2. 주요 클래스 및 변수 (Class & State Variables)스케치 메인 클래스: PumpRhythmHighwaySketch변수명타입설명containerHTMLElement / String캔버스가 삽입될 DOM 컨테이너canvas / ctxHTMLCanvasElement / CanvasRenderingContext2D2D 렌더링 캔버스 및 ContexttimeNumber60FPS 애니메이션 타이머 틱versionString스케치 버전 정보 (Ver 27.0 - SRT Calligraphy)laneCountNumber총 레인 수 (11개: 5 드럼 + 5 베이스 + 1 기타)bg169 / bg916HTMLImageElement16:9 및 9:16 배경 이미지 객체stringVibrationArray중앙 메탈 현들의 실시간 진동 폭 값 배열selectedRatioString화면 비율 모드 ('full', '16:9', '9:16')notes / particles / hitEffectsArray하이웨이 노트, 파티클, 충격파 관리 배열⚙️ 3. 주요 함수 및 인수 목록 (Functions & Arguments)① 생성자 및 초기화constructor(container)인수: container (DOM 요소 또는 ID 문자열)설명: 캔버스 생성, 이미지 자산 로드 및 UI 관제탑의 Export 비율 버튼 수동 감지 리스너를 등록합니다.init()설명: 초기 실행 함수로 내부적으로 resize()를 호출합니다.resize(w, h)인수: w (너비, 선택), h (높이, 선택)설명: 캔버스의 크기를 컨테이너 크기에 맞춰 동적으로 조절합니다.② 유틸리티 및 변환 함수hexToRgb(hex)인수: hex (String, 예: #ff3c50)반환: RGB 문자열 (예: "255, 60, 80")설명: HEX 컬러 코드를 캔버스 RGBA 포맷으로 변환합니다.getBandAverage(spectrum, startBin, endBin)인수:spectrum (Float32Array): 64채널 주파수 스펙트럼 데이터startBin (Number): 분석 시작 주파수 인덱스endBin (Number): 분석 종료 주파수 인덱스반환: Number (평균 음압 수치)설명: 특정 주파수 대역의 평균 에너지를 추출합니다.getGlobalShape(seed)인수: seed (Number: 관제탑 Shuffle 슬라이더 값)반환: Number (0~4 모양 인덱스)설명: 슬라이더 수치에 따라 전체 노트 모양을 일괄 통일(사각, 라운드, 원, 다이아몬드, 별)시킵니다.③ 시각 효과 및 파티클 함수spawnHitParticles(x, y, color, count, scaleFactor)인수: 위치 좌표(x, y), 색상(color), 개수(count), 크기 배율(scaleFactor)설명: 노트 타격 시 사방으로 튀는 스파크 파티클을 생성합니다.spawnHitEffect(x, y, color, scaleFactor)인수: 위치 좌표(x, y), 색상(color), 크기 배율(scaleFactor)설명: 타격 지점에 확장되는 충격파 링 이펙트를 생성합니다.drawNoteShape(ctx, shapeType, x, y, w, h, color)인수: 렌더링 Context(ctx), 모양 타입(shapeType), 위치(x, y), 크기(w, h), 색상(color)설명: 지정된 형태의 노트 블록을 캔버스에 그립니다.④ 메인 렌더링 틱 루프update(audioData)인수: audioData (Object: 실시간 음압, 스펙트럼, 자막 정보가 담긴 객체)설명: 매 프레임(60FPS) 호출되는 핵심 렌더링 엔진입니다.레터박스 뷰포트 계산: Full, 16:9, 9:16 비율에 맞춘 화면 영역 크롭 및 클리핑배경 이미지 렌더링: 비율별 올바른 배경화면 출력중앙 메탈 현 연동: Bass/Other 음압에 따른 현 진동 물리 시뮬레이션드럼/피아노 연주 시뮬레이션: Drums 볼륨에 따른 스틱 타격 및 Vocals/Other에 따른 건반 바운스 연출SRT 캘리그래피 자막 출력: window.currentSubtitleText 데이터를 받아 화면 상단에 한지/먹물 느낌의 폰트로 실시간 렌더링⑤ 소멸자destroy()설명: 스케치 종료 시 캔버스 DOM 요소를 안전하게 제거하고 메모리를 해제합니다.🎛️ 관제탑 컨트롤러 연동 가이드Shuffle (Seed): 전체 노트 모양 일괄 통일 (사각, 라운드, 원형, 다이아몬드, 별형)Range (Scatter): 음원 분석 감도 (Noise Gate Threshold) 조절Scale (Glow): 노트 크기 및 타격 스파크 규모 조절Volume (Gain): 전체 악기 오디오 반응 감도 증폭Gauge: 중앙 현들의 간격 및 원근감 조절Export Setting (Full / 16:9 / 9:16): 화면 비율 및 배경 이미지 실시간 전환
