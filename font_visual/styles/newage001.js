// styles/newage001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['newage001'] = {
        name: 'New Age 001',
        backgroundColor: '#0f1a2a',
        textColor: 'rgba(255,255,255,0.2)',
        glowColor: '#88ccff',
        layout: function(leds, canvas, ctx) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            leds.forEach((led, i) => {
                const angle = i * 0.3;
                const radius = i * 1.5;
                led.baseX = centerX + Math.cos(angle) * radius;
                led.baseY = centerY + Math.sin(angle) * radius;
            });
        },
        presets: {
            'etherealFade': {
                name: '몽환적 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 1.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t * 0.8 + 0.2, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleWave': {
                name: '부드러운 웨이브',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(t * Math.PI * 5) * 25 * (1 - t),
                        offsetY: Math.cos(t * Math.PI * 4) * 15 * (1 - t)
                    };
                }
            },
            'breathingGlow': {
                name: '숨쉬는 글로우',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1 + Math.sin(time * 2) * 0.05, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'slowSpiral': {
                name: '느린 나선형',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.8 + 0.2 * t, rotation: (1 - t) * 360, offsetX: 0, offsetY: 0 };
                }
            },
            'floatAround': {
                name: '떠다니기',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(time * 1.5) * 10,
                        offsetY: Math.cos(time * 1.8) * 8
                    };
                }
            },
            'aurora': {
                name: '오로라',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1 + Math.sin(t * Math.PI * 6) * 0.1,
                        rotation: Math.sin(t * Math.PI * 8) * 30 * (1 - t),
                        offsetX: 0,
                        offsetY: 0
                    };
                }
            }
        }
    };
})();
