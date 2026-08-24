// styles/rock001.js
// 락 스타일: 강렬하고 임팩트 있는 모션

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['rock001'] = {
        name: 'Rock 001',
        presets: {
            'heavyDrop': {
                name: '헤비 드롭',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - easeOutBounce(t)) * -300;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'shakeViolent': {
                name: '격렬한 흔들림',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 20) * 30 * (1 - t);
                    const offsetY = Math.cos(t * Math.PI * 16) * 20 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'spinCrash': {
                name: '회전 충돌',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 720;
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'explodeIn': {
                name: '폭발 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.2 + 0.8 * easeOutBack(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'glitchRock': {
                name: '글리치',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = (Math.random() - 0.5) * 40 * (1 - t);
                    const offsetY = (Math.random() - 0.5) * 40 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'fastFlicker': {
                name: '빠른 깜빡임',
                apply: function(led, time, ctx, state) {
                    const duration = 0.25;
                    const t = Math.min(1, (time - led.start) / duration);
                    const opacity = Math.abs(Math.sin(t * Math.PI * 10));
                    return { opacity: opacity, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'slamZoom': {
                name: '강한 줌',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.1 + 0.9 * easeInBack(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'thrash': {
                name: '트래시',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = Math.sin(t * Math.PI * 15) * 30 * (1 - t);
                    const offsetX = Math.cos(t * Math.PI * 12) * 20 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: offsetX, offsetY: 0 };
                }
            }
        }
    };
})();
