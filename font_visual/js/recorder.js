// js/recorder.js
// MP4 저장 기능

function getSupportedMimeType() {
    const types = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    for (const t of types) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return 'video/webm';
}

async function startRecording(canvas, audioEl, audioCtx, audioDest, maxTime) {
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

    const canvasStream = canvas.captureStream(60);
    let combinedStream = canvasStream;
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
    }

    const mimeType = getSupportedMimeType();
    const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000
    });

    const chunks = [];
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kinetic_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    mediaRecorder.start(1000);

    if (audioEl.src && audioCtx) {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => {});
    }

    return mediaRecorder;
}
