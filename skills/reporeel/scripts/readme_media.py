#!/usr/bin/env python3
"""Prepare browser-compatible README movies and update a bounded Markdown block."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

START = '<!-- reporeel:start -->'
END = '<!-- reporeel:end -->'


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                           '-of', 'json', str(path)]))


def duration(info):
    value = float(info['format']['duration'])
    if not math.isfinite(value) or value <= 0:
        raise ValueError('Media must have a positive finite duration')
    return value


def prepare(args):
    source = args.video.resolve(strict=True)
    dest = args.out_dir.resolve()
    if dest.exists():
        raise ValueError('Output directory already exists; use a new versioned directory')
    if args.max_bytes < 100_000 or args.max_bytes > 100_000_000:
        raise ValueError('max-bytes must be between 100000 and 100000000')
    info = probe(source)
    seconds = duration(info)
    if not any(s['codec_type'] == 'video' for s in info['streams']):
        raise ValueError('Input has no video stream')
    if not any(s['codec_type'] == 'audio' for s in info['streams']):
        raise ValueError('Narrated movie must have an audio stream')
    # Reserve room for AAC audio and MP4 overhead. Verify actual size afterward.
    bitrate = min(5_000_000, int(args.max_bytes * 8 * 0.94 / seconds) - 128_000)
    if bitrate < 150_000:
        raise ValueError('Movie is too long for this upload budget; shorten it or raise max-bytes')
    transcript = None
    if args.script:
        script = json.loads(args.script.read_text(encoding='utf-8'))
        transcript = '\n\n'.join(scene['narration'] for scene in script['scenes']) + '\n'
    if args.captions and not args.captions.is_file():
        raise ValueError('Caption file does not exist')
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.reporeel-', dir=dest.parent) as tmp:
        root = Path(tmp)
        movie = root / 'movie.mp4'
        common = ['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-map', '0:v:0',
                  '-vf', "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
                  '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                  '-threads', '2', '-b:v', str(bitrate), '-passlogfile', str(root / 'encode')]
        run(common + ['-pass', '1', '-an', '-f', 'null', '/dev/null'])
        run(common + ['-pass', '2', '-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k',
                      '-movflags', '+faststart', '-map_metadata', '-1', str(movie)])
        output = probe(movie)
        if movie.stat().st_size > args.max_bytes:
            raise ValueError('Encoded movie exceeds upload budget; shorten it or increase max-bytes')
        video = next(s for s in output['streams'] if s['codec_type'] == 'video')
        audio = next(s for s in output['streams'] if s['codec_type'] == 'audio')
        if video['codec_name'] != 'h264' or audio['codec_name'] != 'aac':
            raise ValueError('Unexpected output codecs')
        if abs(duration(output) - seconds) > max(0.5, seconds * 0.01):
            raise ValueError('Encoded movie duration differs from source')
        run(['ffmpeg', '-v', 'error', '-y', '-ss', str(min(1, seconds / 2)), '-i', str(movie),
             '-frames:v', '1', '-threads', '1', str(root / 'poster.jpg')])
        if args.captions:
            shutil.copyfile(args.captions, root / 'captions.srt')
        if transcript is not None:
            (root / 'transcript.txt').write_text(transcript, encoding='utf-8')
        manifest = {'schemaVersion': 1, 'title': args.title, 'durationSeconds': duration(output),
                    'sizeBytes': movie.stat().st_size, 'maxBytes': args.max_bytes,
                    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'movieSha256': hashlib.sha256(movie.read_bytes()).hexdigest(),
                    'width': video['width'], 'height': video['height'],
                    'files': ['movie.mp4', 'poster.jpg'] + (['captions.srt'] if args.captions else [])
                             + (['transcript.txt'] if transcript is not None else [])}
        (root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        for log in root.glob('encode*'):
            log.unlink()
        root.rename(dest)
    print(json.dumps({'bundle': str(dest), **manifest}, indent=2))


def attachment_url(value):
    url = urlsplit(value)
    modern = url.hostname == 'github.com' and re.fullmatch(
        r'/user-attachments/assets/[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', url.path)
    legacy = url.hostname == 'user-images.githubusercontent.com' and re.fullmatch(
        r'/[0-9]+/[A-Za-z0-9._-]+\.(mp4|mov|webm)', url.path)
    if (not (modern or legacy) or url.scheme != 'https' or url.netloc != url.hostname
            or url.query or url.fragment or any(c.isspace() for c in value)):
        raise ValueError('Use the canonical video attachment URL returned by GitHub’s uploader')
    return value


def update_readme(text, url):
    attachment_url(url)
    newline = '\r\n' if '\r\n' in text else '\n'
    block = newline.join([START, '## Repository movie', '', url, '', END])
    starts, ends = text.count(START), text.count(END)
    if starts == ends == 0:
        return text + (newline if text.endswith(newline) else newline * 2) + block + newline
    if starts != 1 or ends != 1 or text.index(END) < text.index(START):
        raise ValueError('README has duplicate or malformed RepoReel markers; resolve them manually')
    return text[:text.index(START)] + block + text[text.index(END) + len(END):]


def embed(args):
    if args.readme.is_symlink():
        raise ValueError('README must be a regular file, not a symlink')
    with args.readme.open(encoding='utf-8', newline='') as handle:
        original = handle.read()
    updated = update_readme(original, args.attachment_url)
    if args.write:
        # Replace atomically in the same filesystem, preserving permissions.
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='',
                                         dir=args.readme.parent, delete=False) as handle:
            temp = Path(handle.name)
            handle.write(updated)
        try:
            temp.chmod(args.readme.stat().st_mode)
            temp.replace(args.readme)
        finally:
            temp.unlink(missing_ok=True)
        print(json.dumps({'readme': str(args.readme), 'changed': original != updated,
                          'playbackVerification': 'pending-browser-check'}))
    else:
        sys.stdout.write(updated)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    pack = commands.add_parser('prepare', help='Create a new upload bundle; never overwrite a previous run')
    pack.add_argument('--video', type=Path, required=True)
    pack.add_argument('--out-dir', type=Path, required=True)
    pack.add_argument('--title', required=True)
    pack.add_argument('--max-bytes', type=int, default=9_500_000)
    pack.add_argument('--captions', type=Path)
    pack.add_argument('--script', type=Path, help='RepoReel script.json, for a readable narration transcript')
    pack.set_defaults(action=prepare)
    md = commands.add_parser('embed', help='Preview README output, or explicitly write its managed movie block')
    md.add_argument('--readme', type=Path, required=True)
    md.add_argument('--attachment-url', required=True)
    md.add_argument('--write', action='store_true')
    md.set_defaults(action=embed)
    args = parser.parse_args()
    try:
        args.action(args)
    except (ValueError, OSError, KeyError, StopIteration, subprocess.CalledProcessError) as error:
        # Do not echo child command arguments or arbitrary provider output.
        print(f'error: {error if not isinstance(error, subprocess.CalledProcessError) else "Media tool failed; inspect the input and local ffmpeg installation"}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
