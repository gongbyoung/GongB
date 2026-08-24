// styles/ballad001.js
// 발라드 스타일: 부드럽고 감성적인 모션

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['ballad001'] = {
        name: 'Ballad 001',
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
                    const offsetY = (1 - t) * 60;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'softScale': {
                name: '소프트 스케일',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.7 + 0.3 * easeInOutCubic(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'waveSoft': {
                name: '부드러운 웨이브',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 3) * 20 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },
            'breathe': {
                name: '숨쉬는 효과',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.9 + 0.1 * Math.sin(time * 3);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'glowFade': {
                name: '글로우 페이드',
                apply: function(led, time, ctx, state) {
                    const fadeDuration = 0.5;
                    const t = Math.min(1, (time - led.start) / fadeDuration);
                    const opacity = t;
                    const scale = 1 + Math.sin(time * 4) * 0.02;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'softDrop': {
                name: '부드러운 하강',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * -80;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'gentleRotate': {
                name: '부드러운 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 180;
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
