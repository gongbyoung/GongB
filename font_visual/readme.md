# 타이포그래피 가이드 (v2.0)

이 문서는 새로운 스타일을 만들거나, 다른 세션에서 이어서 개발할 때 사용하기 위한 핵심 자료입니다.

## 📁 프로젝트 구조
project/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── utils.js         # 공통 유틸리티 (SRT 파싱, 한글 분해, 이징)
│   ├── colorStyles.js   # 색상 스타일 정의
│   ├── recorder.js      # MP4 저장
│   └── app.js           # 메인 컨트롤러 (UI, 렌더링, 타이머, 잔상효과)
├── styles/              # ★ 스타일별 타이포 모션 파일들
│   ├── drive001.js
│   ├── dance001.js
│   └── ...
└── readme.md            # 이 파일

## 🧰 전역 변수 (app.js에서 관리, 스타일 파일에서 읽기 가능)
- `allLeds`: 현재 화면의 모든 LED 객체 배열
- `currentTime`: 현재 재생/타임라인 시간 (초)
- `currentFont`: 현재 폰트 문자열
- `currentFontSize`: 폰트 크기 (px)
- `scatterAmount`: 흩어짐 정도 (0 ~ 1)
- `rangeAmount`: 범위 (0 ~ 1) - 슬라이더로 조절
- `intensityAmount`: 강도 (0 ~ 1) - 슬라이더로 조절
- `trailAmount`: 잔상(트레일) (0 ~ 1) - 슬라이더로 조절
- `currentColorStyle`: 색상 스타일명
- `currentStyleId`: 현재 로드된 타이포 스타일 ID
- `currentPresetId`: 선택된 모션 프리셋 ID
- `currentUnit`: 진행 단위 ('jamo', 'char', 'word', 'sentence')

## 📦 스타일 파일 작성 템플릿
```javascript
// styles/newStyleId.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};
    window.TypoMotionStyles['newStyleId'] = {
        name: '표시 이름',
        backgroundColor: '#000000', // 배경색 (Hex)
        textColor: 'rgba(255,255,255,0.3)', // 비활성 텍스트 색
        glowColor: '#ffd700', // 활성 시 글로우 색
        layout: function(leds, canvas, ctx) {
            // 배치 로직: leds 배열의 baseX, baseY를 설정합니다.
            // (주의: led.x, led.y를 직접 수정하면 안 됩니다. app.js가 계산합니다)
            leds.forEach((led, i) => {
                led.baseX = ...;
                led.baseY = ...;
            });
        },
        presets: {
            'presetId': {
                name: '프리셋 이름',
                apply: function(led, time, ctx, state) {
                    // led: { char, start, end, color, x, y, baseX, baseY, cueIdx, ... }
                    // time: 현재 재생 시간(초)
                    // ctx: CanvasRenderingContext2D
                    // state: { currentFont, currentFontSize, scatterAmount, rangeAmount, intensityAmount, trailAmount }
                    
                    // 예시: 강도에 따라 흔들림 조절
                    const intensity = state.intensityAmount || 0.5; 
                    const offsetX = Math.sin(time * 10) * 10 * intensity;
                    
                    // 반드시 반환해야 하는 객체
                    return { 
                        opacity: 1, 
                        scale: 1, 
                        rotation: 0, 
                        offsetX: offsetX, 
                        offsetY: 0 
                    };
                }
            }
        }
    };
})();
