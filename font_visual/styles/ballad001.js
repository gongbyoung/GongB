// styles/ballad001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['ballad001'] = {
        name: 'Ballad 001',
        backgroundColor: '#0d1a2d',
        textColor: 'rgba(255,255,255,0.2)',
        glowColor: '#aaccff',
        layout: function(leds, canvas, ctx) {
            const rows = 5;
            const perRow = Math.ceil(leds.length / rows);
            const spacingX = canvas.width / perRow;
            const spacingY = canvas.height / rows;
            leds.forEach((led, i) => {
                const row = Math.floor(i / perRow);
                const col = i % perRow;
                led.baseX = col * spacingX + spacingX / 2;
                led.baseY = row * spacingY + spacingY / 2 + Math.sin(col * 0.5) * 30;
            });
        },
        presets: {
            'slowFadeIn': {
                name: '느린 페이드 인',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleRise': {
                name: '부드러운 상승',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: (1 - t) * 60 };
                }
            },
            'softScale': {
                name: '소프트 스케일',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.7 + 0.3 * easeInOutCubic(t), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'breathe': {
                name: '숨쉬는 효과',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.9 + 0.1 * Math.sin(time * 3), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleRotate': {
                name: '부드러운 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 180, offsetX: 0, offsetY: 0 };
                }
            },
            'glowFade': {
                name: '글로우 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1 + Math.sin(time * 4) * 0.02, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
