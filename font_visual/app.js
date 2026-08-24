// 프리셋 선택 UI
const presetSelect = document.getElementById('presetSelect');
Object.keys(MotionPresets).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = MotionPresets[key].name;
    presetSelect.appendChild(opt);
});

// 렌더링 시 프리셋 적용
function render() {
    const preset = MotionPresets[presetSelect.value];
    allLeds.forEach(led => {
        const isActive = led.start <= currentTime;
        if (isActive) {
            const transform = preset.onUpdate(led, currentTime);
            ctx.save();
            ctx.globalAlpha = transform.opacity;
            ctx.translate(led.x, led.y);
            ctx.rotate(transform.rotation * Math.PI / 180);
            ctx.scale(transform.scale, transform.scale);
            ctx.fillStyle = led.color;
            ctx.fillText(led.char, 0, 0);
            ctx.restore();
        } else {
            // 비활성 상태 (외곽선)
        }
    });
}
