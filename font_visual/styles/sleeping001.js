// styles/sleeping001.js
// 수면 스타일: 극도로 차분하고 이완된 모션

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['sleeping001'] = {
        name: 'Sleeping 001',
        presets: {
            'superSlowFade': {
                name: '초느린 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 2.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t * 0.6, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'stillCalm': {
                name: '고요함',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    const opacity = t;
                    return { opacity: opacity, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'breathSlow': {
                name: '느린 호흡',
                apply: function(led, time, ctx, state) {
                    const duration = 1.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 1 + Math.sin(time * 1.2) * 0.03;
                    const opacity = t;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleDrift': {
                name: '잔잔한 표류',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(time * 0.5) * 8;
                    const offsetY = Math.cos(time * 0.7) * 6;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'slowRise': {
                name: '천천히 상승',
                apply: function(led, time, ctx, state) {
                    const duration = 1.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * 40;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'dimGlow': {
                name: '희미한 글로우',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    const opacity = t * 0.5;
                    const scale = 1 + Math.sin(time * 1.5) * 0.02;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'quietSpin': {
                name: '조용한 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 30;
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'peacefulAppear': {
                name: '평온한 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.9 + 0.1 * t;
                    const opacity = t;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
