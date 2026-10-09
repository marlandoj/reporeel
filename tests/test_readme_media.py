import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'skills/reporeel/scripts/readme_media.py'
spec = importlib.util.spec_from_file_location('readme_media', HELPER)
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)
URL = 'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789abc'


class ReadmeTests(unittest.TestCase):
    def test_edit_preserves_content_and_is_repeatable(self):
        for nl in ['\n', '\r\n']:
            original = f'# Repository{nl}{nl}Existing content and license.{nl}'
            once = media.update_readme(original, URL)
            self.assertTrue(once.startswith(original))
            self.assertEqual(once, media.update_readme(once, URL))
            after = once + f'{nl}## License{nl}Keep me{nl}'
            replacement = URL.replace('12345678-', '87654321-')
            edited = media.update_readme(after, replacement)
            self.assertIn(replacement, edited)
            self.assertNotIn(URL, edited)
            self.assertTrue(edited.endswith(f'{nl}## License{nl}Keep me{nl}'))

    def test_invalid_urls_and_broken_markers_fail(self):
        for url in ['https://github.com/o/r/blob/main/video.mp4',
                    URL + '?token=secret', URL + '\n# injected',
                    URL.replace('github.com', 'github.com.evil.test'),
                    URL.replace('https://', 'http://'),
                    URL.replace('github.com', 'user@github.com')]:
            with self.assertRaises(ValueError):
                media.update_readme('# Repo', url)
        for original in [media.START, media.END, media.END + media.START,
                         media.START + media.END + media.START + media.END]:
            with self.assertRaises(ValueError):
                media.update_readme(original, URL)

    def test_cli_preview_does_not_write_and_write_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            readme = Path(tmp) / 'README.md'
            readme.write_bytes(b'# Repo\r\n\r\nOriginal\r\n')
            cmd = [sys.executable, str(HELPER), 'embed', '--readme', str(readme), '--attachment-url', URL]
            before = readme.read_bytes()
            preview = subprocess.run(cmd, capture_output=True, check=True)
            self.assertEqual(before, readme.read_bytes())
            self.assertIn(URL.encode(), preview.stdout)
            subprocess.run(cmd + ['--write'], capture_output=True, check=True)
            written = readme.read_bytes()
            self.assertIn(b'\r\n', written)
            result = subprocess.run(cmd + ['--write'], capture_output=True, check=True)
            self.assertFalse(json.loads(result.stdout)['changed'])
            self.assertEqual(written, readme.read_bytes())
            failed = subprocess.run(cmd[:-1] + ['https://example.com/video.mp4', '--write'], capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertEqual(written, readme.read_bytes())

    def test_symlink_is_not_modified(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = Path(tmp) / 'original.md'
            original.write_text('Keep me')
            link = Path(tmp) / 'README.md'
            link.symlink_to(original)
            result = subprocess.run([sys.executable, str(HELPER), 'embed', '--readme', str(link),
                                     '--attachment-url', URL, '--write'], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(original.read_text(), 'Keep me')


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe required')
class MediaTests(unittest.TestCase):
    def test_real_bundle_is_playable_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'input.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                            'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i',
                            'sine=frequency=440:sample_rate=44100', '-t', '2',
                            '-c:v', 'libx264', '-threads', '1', '-c:a', 'aac', str(source)], check=True)
            captions = root / 'out.srt'
            captions.write_text('1\n00:00:00,000 --> 00:00:01,000\nExample\n')
            script = root / 'script.json'
            script.write_text(json.dumps({'scenes': [{'narration': 'Example narration.'}]}))
            output = root / 'bundle'
            cmd = [sys.executable, str(HELPER), 'prepare', '--video', str(source),
                   '--out-dir', str(output), '--title', 'Example', '--max-bytes', '500000',
                   '--captions', str(captions), '--script', str(script)]
            subprocess.run(cmd, check=True, capture_output=True)
            manifest = json.loads((output / 'manifest.json').read_text())
            self.assertLessEqual(manifest['sizeBytes'], 500000)
            self.assertAlmostEqual(manifest['durationSeconds'], 2, delta=0.15)
            self.assertEqual((output / 'transcript.txt').read_text(), 'Example narration.\n')
            self.assertEqual((output / 'captions.srt').read_bytes(), captions.read_bytes())
            data = (output / 'movie.mp4').read_bytes()
            self.assertLess(data.index(b'moov'), data.index(b'mdat'))
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(output / 'movie.mp4'),
                            '-f', 'null', '-'], check=True, capture_output=True)
            before = (output / 'manifest.json').read_bytes()
            self.assertNotEqual(subprocess.run(cmd, capture_output=True).returncode, 0)
            self.assertEqual(before, (output / 'manifest.json').read_bytes())
            self.assertEqual(sorted(p.name for p in output.iterdir()),
                             sorted(manifest['files'] + ['manifest.json']))


if __name__ == '__main__':
    unittest.main()
