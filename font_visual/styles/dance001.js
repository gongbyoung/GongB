// styles/dance001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['dance001'] = {
        name: 'Dance 001',
        backgroundColor: '#1a0030',
        textColor: 'rgba(255,255,255,0.25)',
        glowColor: '#ff00cc',
        layout: function(leds, canvas, ctx) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(canvas.width, canvas.height) * 0.35;
            leds.forEach((led, i) => {
                const angle = (i / leds.length) * Math.PI * 2;
                led.baseX = centerX + Math.cos(angle) * radius;
                led.baseY = centerY + Math.sin(angle) * radius;
            });
        },
        presets: {
            'bounceIn': {
                name: '바운스 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = easeOutBounce(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'spinIn': {
                name: '회전 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 720, offsetX: 0, offsetY: 0 };
                }
            },
            'waveIn': {
                name: '웨이브 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(t * Math.PI * 6) * 30 * (1 - t),
                        offsetY: 0
                    };
                }
            }
        }
    };
})();
