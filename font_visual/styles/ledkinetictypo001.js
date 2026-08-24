// styles/ledkinetictypo001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['ledkinetictypo001'] = {
        name: 'LED Kinetic Typo 001',
        backgroundColor: '#000000',
        textColor: 'rgba(255,255,255,0.3)',
        glowColor: '#ffd700',
        layout: function(leds, canvas, ctx) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.min(canvas.width, canvas.height) * 0.45;
            leds.forEach(led => {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * maxRadius;
                led.baseX = centerX + Math.cos(angle) * dist;
                led.baseY = centerY + Math.sin(angle) * dist;
            });
        },
        presets: {
            'static': {
                name: '기본 점등',
                apply: function(led, time, ctx, state) {
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'fadeIn': {
                name: '페이드 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'popIn': {
                name: '팝 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 1 + 0.3 * easeOutBack(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'bounceIn': {
                name: '바운스 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = easeOutBounce(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'rotateIn': {
                name: '회전 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 360, offsetX: 0, offsetY: 0 };
                }
            },
            'glowPulse': {
                name: '글로우 펄스',
                apply: function(led, time, ctx, state) {
                    const fadeDuration = 0.2;
                    const fadeT = Math.min(1, (time - led.start) / fadeDuration);
                    const opacity = fadeT;
                    const scale = 1 + Math.sin(time * 5) * 0.03;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'waveIn': {
                name: '웨이브 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 6) * 20 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },
            'slideUp': {
                name: '슬라이드 업',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * 80;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'zoomIn': {
                name: '줌 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.35;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.2 + 0.8 * t;
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
