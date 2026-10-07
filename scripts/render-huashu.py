#!/usr/bin/env python3
"""Run the upstream renderer, then mux timed narration and captions.
Child process groups are killed on cancellation, failure, or timeout.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile

active = None


def stop_children():
    if active is not None:
        try:
            os.killpg(active.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        active.wait()


def cancel(signum, _frame):
    stop_children()
    raise SystemExit(128 + signum)


for sig in (signal.SIGTERM, signal.SIGINT):
    signal.signal(sig, cancel)


def run(args, cwd=None):
    global active
    try:
        active = subprocess.Popen(args, cwd=cwd, start_new_session=True, stdout=sys.stderr)
        code = active.wait(timeout=600)
        if code:
            raise RuntimeError(f"{Path(args[0]).name} exited {code}")
    finally:
        stop_children()
        active = None


def main():
    job, root = map(lambda p: Path(p).resolve(), sys.argv[1:3])
    plan = json.loads((job / "huashu/plan.json").read_text())
    total = sum(s['frames'] for s in plan['scenes'])
    done = 0
    # Bulky intermediate clips are disposable, never retained in job storage.
    with tempfile.TemporaryDirectory(prefix='reporeel-huashu-') as tmp:
        work = Path(tmp)
        for i, scene in enumerate(plan['scenes']):
            spec = job / f'huashu/scene-{i}.json'
            spec.write_text(json.dumps(scene['spec']))
            silent = work / f'silent-{i}.mp4'
            run([sys.executable, str(root / 'scripts/engine/render.py'), '--spec', str(spec), '--out', str(silent)])
            audio = (job / scene['audio']).resolve()
            if not audio.is_relative_to(job):
                raise ValueError('Narration path must stay inside the job directory')
            run(['ffmpeg', '-y', '-v', 'error', '-i', str(silent), '-i', str(audio),
                 '-filter_complex', '[1:a]adelay=400:all=1,apad[a]', '-map', '0:v', '-map', '[a]',
                 '-t', str(scene['spec']['duration']), '-c:v', 'copy', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', str(work / f'clip-{i}.mkv')])
            done += scene['frames']
            print(f'REPOREEL_PROGRESS {done} {total}', flush=True)
        (work / 'clips.txt').write_text(''.join(f"file 'clip-{i}.mkv'\n" for i in range(len(plan['scenes']))))
        filters = []
        if plan['captions']:
            # Fixed filter path: job paths and user text never enter ffmpeg syntax.
            (work / 'captions.srt').write_text((job / 'out.srt').read_text())
            margin = round(plan['height'] * 0.08)
            font_size = 20 if plan['width'] > plan['height'] else 9
            filters = ['-vf', f"subtitles=captions.srt:force_style='FontName=DejaVu Sans,FontSize={font_size},Alignment=2,MarginV={round(margin * 288 / plan['height'])},Outline=2'", '-c:v', 'libx264', '-preset', 'fast', '-crf', '20']
        else:
            filters = ['-c:v', 'copy']
        run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '1', '-i', 'clips.txt', *filters,
             '-c:a', 'aac', '-b:a', '192k', '-t', str(plan['total']), '-movflags', '+faststart', str(work / 'out.mp4')], cwd=work)
        probe = subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(work / 'out.mp4')])
        info = json.loads(probe)
        if {s['codec_type'] for s in info['streams']} != {'video', 'audio'}:
            raise RuntimeError('Output must contain video and narration')
        if abs(float(info['format']['duration']) - plan['total']) > 0.15:
            raise RuntimeError('Output duration differs from narration timeline')
        import shutil
        staged = job / '.huashu-out.mp4'
        try:
            shutil.copyfile(work / 'out.mp4', staged)
            staged.replace(job / 'out.mp4')
        finally:
            staged.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
