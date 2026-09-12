import os
import sys
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def parse_srt(srt_filepath):
    with open(srt_filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = re.compile(
        r'(\d+)\s*\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n([\s\S]*?)(?=\n\n|\n*$)'
    )
    def time_to_ms(t_str):
        h, m, s_ms = t_str.split(':')
        s, ms = s_ms.split(',')
        return int(h)*3600000 + int(m)*60000 + int(s)*1000 + int(ms)

    subtitles = []
    for match in pattern.finditer(content):
        subtitles.append({
            'start': time_to_ms(match.group(2)),
            'end': time_to_ms(match.group(3)),
            'text': match.group(4).replace('\n', ' ').strip()
        })
    return subtitles

def create_calligraphy_video(srt_file, output_mp4, width=1280, height=720, fps=30):
    subtitles = parse_srt(srt_file)
    total_duration_ms = subtitles[-1]['end'] + 1000
    total_frames = int((total_duration_ms / 1000.0) * fps)

    font_path = "C:/Windows/Fonts/batang.ttc" if os.path.exists("C:/Windows/Fonts/batang.ttc") else "C:/Windows/Fonts/malgun.ttf"
    font = ImageFont.truetype(font_path, 64)

    # FFmpeg 파이프 프로세스를 통한 H.264 MP4 직접 저장
    ffmpeg_cmd = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-s', f'{width}x{height}', '-pix_fmt', 'rgba', '-r', str(fps),
        '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-preset', 'fast', '-crf', '18', output_mp4
    ]
    process = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

    for frame_idx in range(total_frames):
        current_ms = int((frame_idx / fps) * 1000)
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        active_sub = next((s for s in subtitles if s['start'] <= current_ms <= s['end']), None)

        if active_sub:
            text = active_sub['text']
            sub_duration = active_sub['end'] - active_sub['start']
            write_duration = min(1200, sub_duration * 0.5)
            progress = min(1.0, (current_ms - active_sub['start']) / write_duration)

            bbox = font.getbbox(text)
            text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            text_x, text_y = (width - text_w) // 2, int(height * 0.8)

            txt_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            txt_draw = ImageDraw.Draw(txt_layer)
            txt_draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

            if progress < 1.0:
                mask = Image.new('L', (width, height), 0)
                mask_draw = ImageDraw.Draw(mask)
                clip_w = int((text_w + 40) * progress)
                mask_draw.rectangle([text_x - 20, text_y - 20, text_x - 20 + clip_w, text_y + text_h + 20], fill=255)
                txt_layer.putalpha(mask)

            img.paste(txt_layer, (0, 0), txt_layer)

        process.stdin.write(img.tobytes())

    process.stdin.close()
    process.wait()
    print(f"✨ 비디오 생성 완료: {output_mp4}")

if __name__ == '__main__':
    create_calligraphy_video('sample.srt', 'calligraphy_output.mp4')
