// styles/you004.js - YOU 004 한획쓰기 (진짜 붓글씨)
// ㄱ, ㅏ, ㅁ을 한 획에 이어서 쓰는 진짜 한획쓰기 엔진
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    // === 자모 한획 경로 정의 ===
    // 각 자모를 0~1 정규화된 좌표에서 한 번에 그리는 경로
    // 전서체 느낌: 직선 + 곡선, 모서리는 둥글게
    const JAMO_ONE_STROKE_PATHS = {
        // 초성
        'ㄱ': [{x:0.1,y:0.2},{x:0.9,y:0.2},{x:0.9,y:0.9}], // 가로 -> 세로
        'ㄴ': [{x:0.2,y:0.1},{x:0.2,y:0.9},{x:0.9,y:0.9}],
        'ㄷ': [{x:0.1,y:0.15},{x:0.9,y:0.15},{x:0.1,y:0.5},{x:0.9,y:0.5},{x:0.9,y:0.9},{x:0.1,y:0.9}],
        'ㄹ': [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.45},{x:0.1,y:0.45},{x:0.1,y:0.9},{x:0.9,y:0.9}],
        'ㅁ': [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9},{x:0.1,y:0.1}],
        'ㅂ': [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9},{x:0.1,y:0.1},{x:0.1,y:0.5},{x:0.9,y:0.5}],
        'ㅅ': [{x:0.05,y:0.5},{x:0.5,y:0.1},{x:0.95,y:0.5},{x:0.5,y:0.5},{x:0.5,y:0.9}],
        'ㅇ': [{x:0.5,y:0.05},{x:0.9,y:0.2},{x:0.9,y:0.8},{x:0.5,y:0.95},{x:0.1,y:0.8},{x:0.1,y:0.2},{x:0.5,y:0.05}],
        'ㅈ': [{x:0.05,y:0.5},{x:0.5,y:0.1},{x:0.95,y:0.5},{x:0.5,y:0.5},{x:0.5,y:0.9},{x:0.3,y:0.7},{x:0.7,y:0.7}],
        'ㅊ': [{x:0.05,y:0.5},{x:0.5,y:0.1},{x:0.95,y:0.5},{x:0.5,y:0.5},{x:0.5,y:0.9},{x:0.2,y:0.3},{x:0.8,y:0.3}],
        'ㅋ': [{x:0.1,y:0.2},{x:0.9,y:0.2},{x:0.1,y:0.5},{x:0.9,y:0.5},{x:0.1,y:0.8},{x:0.9,y:0.8}],
        'ㅌ': [{x:0.1,y:0.15},{x:0.9,y:0.15},{x:0.5,y:0.15},{x:0.5,y:0.9},{x:0.1,y:0.5},{x:0.9,y:0.5}],
        'ㅍ': [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9},{x:0.1,y:0.5},{x:0.9,y:0.5},{x:0.5,y:0.1},{x:0.5,y:0.9}],
        'ㅎ': [{x:0.1,y:0.2},{x:0.9,y:0.2},{x:0.5,y:0.2},{x:0.5,y:0.6},{x:0.1,y:0.6},{x:0.9,y:0.6},{x:0.5,y:0.6},{x:0.5,y:0.95},{x:0.3,y:0.85},{x:0.7,y:0.85}],

        // 중성 - 한획으로 이어쓰기
        'ㅏ': [{x:0.3,y:0.05},{x:0.3,y:0.95},{x:0.3,y:0.5},{x:0.85,y:0.5}], // 세로 + 가로
        'ㅓ': [{x:0.7,y:0.05},{x:0.7,y:0.95},{x:0.15,y:0.5},{x:0.7,y:0.5}],
        'ㅗ': [{x:0.05,y:0.6},{x:0.95,y:0.6},{x:0.5,y:0.6},{x:0.5,y:0.95}],
        'ㅜ': [{x:0.05,y:0.4},{x:0.95,y:0.4},{x:0.5,y:0.4},{x:0.5,y:0.05}],
        'ㅡ': [{x:0.05,y:0.5},{x:0.95,y:0.5}],
        'ㅣ': [{x:0.5,y:0.05},{x:0.5,y:0.95}],
        'ㅑ': [{x:0.3,y:0.05},{x:0.3,y:0.95},{x:0.3,y:0.3},{x:0.85,y:0.3},{x:0.3,y:0.65},{x:0.85,y:0.65}],
        'ㅕ': [{x:0.7,y:0.05},{x:0.7,y:0.95},{x:0.15,y:0.3},{x:0.7,y:0.3},{x:0.15,y:0.65},{x:0.7,y:0.65}],
        'ㅛ': [{x:0.05,y:0.35},{x:0.95,y:0.35},{x:0.05,y:0.6},{x:0.95,y:0.6},{x:0.5,y:0.6},{x:0.5,y:0.95}],
        'ㅠ': [{x:0.05,y:0.4},{x:0.95,y:0.4},{x:0.05,y:0.65},{x:0.95,y:0.65},{x:0.5,y:0.65},{x:0.5,y:0.05}],

        // 받침도 한획으로
        'ㄲ': [{x:0.1,y:0.1},{x:0.5,y:0.1},{x:0.5,y:0.9},{x:0.6,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9}],
    };

    // 한글 음절 -> 초중종성 분해 후 각각 한획 경로로 변환
    function getHangeulStrokePath(syllable) {
        const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
        const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        
        const code = syllable.charCodeAt(0);
        if (code < 0xAC00 || code > 0xD7A3) return null;
        const base = code - 0xAC00;
        const cho = CHO[Math.floor(base / (21*28))];
        const jung = JUNG[Math.floor((base % (21*28)) / 28)];
        const jong = JONG[base % 28];

        // 각 자모의 경로를 한 글자 공간 안에서 배치
        // 초성: 왼쪽 위, 중성: 오른쪽, 종성: 아래
        const paths = [];
        
        if (JAMO_ONE_STROKE_PATHS[cho]) {
            const p = JAMO_ONE_STROKE_PATHS[cho].map(pt => ({
                x: pt.x * 0.55 + 0.02,
                y: pt.y * 0.55 + 0.02,
                jamo: 'cho'
            }));
            paths.push(...p, {break:true}); // 한획 끝나고 붓을 뗌
        }
        if (JAMO_ONE_STROKE_PATHS[jung]) {
            // 중성은 초성 오른쪽에
            const isVerticalJung = ['ㅏ','ㅓ','ㅑ','ㅕ','ㅣ'].includes(jung);
            const p = JAMO_ONE_STROKE_PATHS[jung].map(pt => ({
                x: isVerticalJung ? pt.x * 0.42 + 0.58 : pt.x * 0.9 + 0.05,
                y: isVerticalJung ? pt.y * 0.9 + 0.05 : pt.y * 0.55 + 0.02,
                jamo: 'jung'
            }));
            paths.push(...p, {break:true});
        }
        if (jong && JAMO_ONE_STROKE_PATHS[jong]) {
            const p = JAMO_ONE_STROKE_PATHS[jong].map(pt => ({
                x: pt.x * 0.9 + 0.05,
                y: pt.y * 0.35 + 0.62,
                jamo: 'jong'
            }));
            paths.push(...p);
        }
        
        return paths;
    }

    window.TypoMotionStyles['you004'] = {
        name: 'YOU 004 - 한획쓰기',
        description: 'ㄱ,ㅏ,ㅁ을 한 획에 이어서 쓰는 진짜 붓글씨. 폰트 무시하고 경로로 그림',
        presets: {
            'oneStroke': {
                name: '한획쓰기 (한글)',
                apply: function(led, time, ctx, state) {
                    // 한 글자당 1.2초에 걸쳐 한획으로
                    const t = Math.min(1, Math.max(0, (time - led.start) / 1.2));
                    // 붓글씨는 처음엔 느리게, 끝엔 꾹
                    const e = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
                    
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: 0,
                        strokeProgress: t, // 0~1: 획이 얼마나 그려졌는지
                        isOneStroke: true,
                        char: led.char
                    };
                }
            },
            'oneStrokeSeal': {
                name: '한획쓰기 전서체',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, Math.max(0, (time - led.start) / 1.8));
                    const e = typeof easeOutElastic === 'function' ? easeOutElastic(t) : t;
                    
                    return {
                        opacity: 1,
                        scale: 0.85 + e * 0.15,
                        rotation: (1 - e) * 2,
                        offsetX: 0,
                        offsetY: (1 - e) * -10,
                        strokeProgress: t,
                        isOneStroke: true,
                        isSeal: true,
                        char: led.char
                    };
                }
            },
            'oneStrokeFast': {
                name: '한획쓰기 흘림',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, Math.max(0, (time - led.start) / 0.7));
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: (1 - t) * -8,
                        offsetX: (1 - t) * -20,
                        offsetY: 0,
                        strokeProgress: t,
                        isOneStroke: true,
                        isCursive: true,
                        char: led.char
                    };
                }
            }
        }
    };

    // === 진짜 한획쓰기 렌더러 ===
    window.drawOneStrokeChar = function(ctx, ch, x, y, size, progress, options) {
        options = options || {};
        const path = getHangeulStrokePath(ch);
        if (!path) {
            // 한글이 아니면 그냥 일반 글자
            ctx.save();
            ctx.font = `900 ${size}px Noto Serif KR, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#111';
            ctx.fillText(ch, x, y);
            ctx.restore();
            return;
        }

        // progress 0~1을 전체 경로 길이에 매핑
        // path에는 {break:true}가 있어서 붓을 떼는 지점 표시
        let totalPoints = path.filter(p => !p.break).length;
        let drawCount = Math.floor(progress * totalPoints);
        
        // 붓 설정: 전서체는 두껍고 뭉툭하게
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let currentStroke = [];
        let drawn = 0;
        let lastPos = null;

        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            if (pt.break) {
                // 붓을 뗌 - 지금까지 모은 획을 그림
                if (currentStroke.length > 1 && drawn < drawCount) {
                    drawSingleBrushStroke(ctx, currentStroke, x, y, size, options, Math.min(1, (drawCount - drawn) / currentStroke.length));
                }
                drawn += currentStroke.length;
                currentStroke = [];
                lastPos = null;
                continue;
            }
            
            if (drawn + currentStroke.length >= drawCount) break;
            currentStroke.push(pt);
        }
        
        // 마지막 획
        if (currentStroke.length > 1) {
            drawSingleBrushStroke(ctx, currentStroke, x, y, size, options, 1);
        }

        ctx.restore();
    };

    function drawSingleBrushStroke(ctx, stroke, cx, cy, size, options, localProgress) {
        if (stroke.length < 2) return;
        
        const ptsToDraw = Math.floor(stroke.length * localProgress);
        if (ptsToDraw < 2) return;

        ctx.beginPath();
        
        // 붓의 굵기: 시작은 가늘고, 중간은 두껍고, 끝은 다시 가늘게 (전서체 특징)
        // pressure 곡선
        const baseThick = options.isSeal ? size * 0.09 : size * 0.06;
        
        // 경로를 따라 그리기
        for (let i = 0; i < ptsToDraw; i++) {
            const pt = stroke[i];
            const px = cx + (pt.x - 0.5) * size;
            const py = cy + (pt.y - 0.5) * size;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                // 곡선으로 부드럽게
                const prev = stroke[i-1];
                const prevX = cx + (prev.x - 0.5) * size;
                const prevY = cy + (prev.y - 0.5) * size;
                const midX = (prevX + px) / 2;
                const midY = (prevY + py) / 2;
                ctx.quadraticCurveTo(prevX, prevY, midX, midY);
            }
        }

        // 붓의 농담
        let thick = baseThick;
        if (options.isSeal) thick = baseThick * (0.9 + Math.sin(localProgress * Math.PI) * 0.3);
        if (options.isCursive) thick = baseThick * (1.2 - localProgress * 0.4);

        ctx.lineWidth = thick;
        
        if (options.isSeal) {
            ctx.strokeStyle = '#0a0a0a';
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = size * 0.02;
        } else {
            ctx.strokeStyle = '#111';
        }
        
        ctx.stroke();

        // 붓 끝의 먹 방울 (전서체 특징)
        if (localProgress > 0.92 && options.isSeal) {
            const last = stroke[ptsToDraw - 1];
            const lx = cx + (last.x - 0.5) * size;
            const ly = cy + (last.y - 0.5) * size;
            ctx.beginPath();
            ctx.arc(lx, ly, thick * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
        }
    }

    // 외부에서 경로 접근 가능하게
    window.JAMO_ONE_STROKE_PATHS = JAMO_ONE_STROKE_PATHS;
    window.getHangeulStrokePath = getHangeulStrokePath;
})();
