// styles/sleeping001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['sleeping001'] = {
        name: 'Sleeping 001',
        backgroundColor: '#0a0a14',
        textColor: 'rgba(255,255,255,0.2)',
        glowColor: '#8888cc',
        layout: function(leds, canvas, ctx) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            leds.forEach(led => {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 60;
                led.baseX = centerX + Math.cos(angle) * dist;
                led.baseY = centerY + Math.sin(angle) * dist;
            });
        },
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
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'breathSlow': {
                name: '느린 호흡',
                apply: function(led, time, ctx, state) {
                    const duration = 1.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1 + Math.sin(time * 1.2) * 0.03, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleDrift': {
                name: '잔잔한 표류',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(time * 0.5) * 8,
                        offsetY: Math.cos(time * 0.7) * 6
                    };
                }
            },
            'slowRise': {
                name: '천천히 상승',
                apply: function(led, time, ctx, state) {
                    const duration = 1.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: (1 - t) * 40 };
                }
            },
            'dimGlow': {
                name: '희미한 글로우',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t * 0.5, scale: 1 + Math.sin(time * 1.5) * 0.02, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'quietSpin': {
                name: '조용한 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 1.0;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 30, offsetX: 0, offsetY: 0 };
                }
            },
            'peacefulAppear': {
                name: '평온한 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 0.9 + 0.1 * t, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
