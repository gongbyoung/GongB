// styles/newage001.js
// 뉴에이지 스타일: 몽환적이고 부드러운 플로우

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['newage001'] = {
        name: 'New Age 001',
        presets: {
            'etherealFade': {
                name: '몽환적 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 1.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    const opacity = t * 0.8 + 0.2; // 최소 투명도 유지
                    return { opacity: opacity, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleWave': {
                name: '부드러운 웨이브',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 5) * 25 * (1 - t);
                    const offsetY = Math.cos(t * Math.PI * 4) * 15 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'breathingGlow': {
                name: '숨쉬는 글로우',
                apply: function(led, time, ctx, state) {
                    const fadeDuration = 0.5;
                    const t = Math.min(1, (time - led.start) / fadeDuration);
                    const opacity = t;
                    const scale = 1 + Math.sin(time * 2) * 0.05;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'slowSpiral': {
                name: '느린 나선형',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 360;
                    const scale = 0.8 + 0.2 * t;
                    return { opacity: 1, scale: scale, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'softFocus': {
                name: '소프트 포커스',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 1 + (1 - t) * 0.3; // 점점 원래 크기로
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'floatAround': {
                name: '떠다니기',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(time * 1.5) * 10;
                    const offsetY = Math.cos(time * 1.8) * 8;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'dreamyRise': {
                name: '꿈결 상승',
                apply: function(led, time, ctx, state) {
                    const duration = 0.9;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * 100;
                    const opacity = t;
                    return { opacity: opacity, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'aurora': {
                name: '오로라',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = Math.sin(t * Math.PI * 8) * 30 * (1 - t);
                    const scale = 1 + Math.sin(t * Math.PI * 6) * 0.1;
                    return { opacity: 1, scale: scale, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
