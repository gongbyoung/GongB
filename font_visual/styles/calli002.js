// styles/calli001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    // 45도 편봉 붓털 다발 고정 테이블
    const BRISTLE_COUNT = 32;
    const bristles = Array.from({ length: BRISTLE_COUNT }, (_, i) => ({
        offset: (i / (BRISTLE_COUNT - 1)) * 2 - 1,
        thickness: 0.8 + Math.random() * 0.8
    }));

    // 핵심 자소 뼈대 데이터 (utils.js로 분리하거나 스타일에 내장)
    const SKELETON = {
        '한': [
            [[0.4, 0.15, 0.8], [0.55, 0.18, 1.4], [0.65, 0.22, 0.4]],
            [[0.15, 0.40, 1.3], [0.50, 0.38, 0.7], [0.85, 0.40, 1.4]],
            [[0.5, 0.52, 1.0], [0.8, 0.72, 1.3], [0.5, 0.92, 0.8], [0.2, 0.72, 1.3], [0.5, 0.52, 1.0]],
            [[0.85, 0.08, 1.6], [0.86, 0.50, 0.8], [0.85, 0.95, 0.3]],
            [[0.86, 0.50, 1.1], [0.98, 0.52, 1.3]],
            [[0.22, 0.65, 1.1], [0.24, 0.90, 1.8], [0.75, 0.88, 1.2], [0.85, 0.80, 0.3]]
        ],
        '글': [
            [[0.15, 0.22, 1.4], [0.82, 0.18, 0.8], [0.86, 0.26, 1.8], [0.75, 0.55, 0.4]],
            [[0.08, 0.65, 1.4], [0.50, 0.62, 0.7], [0.92, 0.66, 1.5], [0.98, 0.64, 0.3]],
            [[0.20, 0.75, 1.1], [0.80, 0.73, 1.4], [0.80, 0.84, 0.8], [0.22, 0.86, 1.3], 
             [0.22, 0.95, 0.8], [0.85, 0.94, 1.5], [0.92, 0.90, 0.3]]
        ]
        // 추가 글자 데이터 확장 가능
    };

    window.TypoMotionStyles['calli002'] = {
        name: '수묵 캘리그라피 (Brush Ink)',
        backgroundColor: '#fbf8f0', // 전통 한지 톤
        textColor: 'rgba(28, 26, 24, 0.15)', // 비활성 글자 은은한 먹선
        glowColor: '#1a1816', // 활성 시 농묵 색상

        // 1. 배치 로직: 자간과 여백 자동 계산
        layout: function(leds, canvas, ctx) {
            const padding = 60;
            const total = leds.length;
            const charSize = Math.min((canvas.width - padding * 2) / (total || 1), 160);
            const startX = (canvas.width - (total * charSize)) / 2;
            const startY = (canvas.height - charSize) / 2;

            leds.forEach((led, i) => {
                led.baseX = startX + i * charSize;
                led.baseY = startY;
                led.size = charSize;
            });
        },

        // 2. 프리셋 및 실시간 렌더링
        presets: {
            'ink_flow': {
                name: '순차적 붓 쓰기 (Stroke Animation)',
                apply: function(led, time, ctx, state) {
                    // 기본 트랜스폼 상태 반환
                    const duration = Math.max(led.end - led.start, 0.1);
                    const progress = Math.min(Math.max((time - led.start) / duration, 0), 1);

                    // 활성화 전이면 투명도 낮춤
                    if (progress <= 0) {
                        return { opacity: 0.1, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                    }

                    // 캘리그라피 커스텀 드로잉 실행
                    renderCalligraphyChar(led, progress, ctx, state);

                    return { 
                        opacity: 1, 
                        scale: 1, 
                        rotation: 0, 
                        offsetX: 0, 
                        offsetY: 0,
                        skipDefaultText: true // app.js의 기본 ctx.fillText를 건너뛰도록 신호 전달
                    };
                }
            }
        }
    };

    // =========================================================================
    // 캘리그라피 내부 드로잉 헬퍼
    // =========================================================================
    function renderCalligraphyChar(led, progress, ctx, state) {
        const strokes = SKELETON[led.char];
        if (!strokes) return; // 등록되지 않은 글자는 기본 폰트로 폴백

        const slantAngle = Math.PI * 0.23; // 45도 편봉 각도
        const baseSize = (state.currentFontSize || 100) * 0.12;
        const pressureScale = 1.0 + (state.intensityAmount || 0.5) * 1.5;
        const dryFactor = (state.rangeAmount || 0.5) * 1.2;
        const jitterAmount = (state.scatterAmount || 0.2) * 0.5;

        // 전체 획 수 기준 현재 진행도 분할
        const totalStrokes = strokes.length;
        const currentStrokeLimit = progress * totalStrokes;

        strokes.forEach((stroke, sIdx) => {
            if (sIdx > currentStrokeLimit) return; // 아직 안 쓴 획

            const strokeProgress = Math.min(Math.max(currentStrokeLimit - sIdx, 0), 1);
            const drawCount = Math.floor((stroke.length - 1) * strokeProgress);
            const partialT = ((stroke.length - 1) * strokeProgress) % 1;

            // 지나온 구간 그리기
            for (let i = 0; i < drawCount; i++) {
                drawSegment(ctx, stroke[i], stroke[i + 1], 1, led, baseSize, pressureScale, dryFactor, jitterAmount, slantAngle);
            }
            // 현재 그려지는 중인 구간
            if (drawCount < stroke.length - 1 && partialT > 0) {
                drawSegment(ctx, stroke[drawCount], stroke[drawCount + 1], partialT, led, baseSize, pressureScale, dryFactor, jitterAmount, slantAngle);
            }
        });
    }

    function drawSegment(ctx, p1, p2, limitT, led, baseSize, pressureScale, dryFactor, jitterAmount, slantAngle) {
        const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * led.size;
        const steps = Math.max(Math.ceil(dist / 2), 1);

        for (let i = 0; i <= steps * limitT; i++) {
            const t = i / steps;
            const nx = p1[0] + (p2[0] - p1[0]) * t;
            const ny = p1[1] + (p2[1] - p1[1]) * t;
            const nw = p1[2] + (p2[2] - p1[2]) * t;

            const curX = led.baseX + nx * led.size;
            const curY = led.baseY + ny * led.size;
            const curW = Math.pow(nw, pressureScale) * baseSize;

            // 45도 편봉 브러시 투영
            for (let b of bristles) {
                if (dryFactor > 0.5 && Math.random() < (dryFactor - 0.5)) continue; // 갈필

                const d = (b.offset + (Math.random() - 0.5) * jitterAmount) * curW;
                const bx = curX + Math.cos(slantAngle) * d;
                const by = curY + Math.sin(slantAngle) * d;

                ctx.fillStyle = 'rgba(22, 20, 18, 0.45)';
                ctx.beginPath();
                ctx.ellipse(bx, by, b.thickness * 1.6, b.thickness * 0.9, slantAngle, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
})();
