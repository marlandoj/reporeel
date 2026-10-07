"""Subprocess lifecycle tests; no browser or model needed."""
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

RUNNER = Path(__file__).resolve().parents[1] / 'scripts/render-huashu.py'


class LifecycleTests(unittest.TestCase):
    def test_nonzero_child_fails(self):
        spec = importlib.util.spec_from_file_location('runner', RUNNER)
        runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runner)
        with self.assertRaises(RuntimeError):
            runner.run([sys.executable, '-c', 'raise SystemExit(7)'])
        self.assertIsNone(runner.active)

    def test_cancellation_kills_descendants(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = Path(tmp) / 'pid'
            child = "import subprocess,time,pathlib; p=subprocess.Popen(['sleep','60']); pathlib.Path(%r).write_text(str(p.pid)); time.sleep(60)" % str(pidfile)
            launcher = "import runpy; r=runpy.run_path(%r); r['run'](%r)" % (str(RUNNER), [sys.executable, '-c', child])
            proc = subprocess.Popen([sys.executable, '-c', launcher])
            try:
                deadline = time.monotonic() + 5
                while not pidfile.exists() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue(pidfile.exists())
                pid = int(pidfile.read_text())
                proc.send_signal(signal.SIGTERM)
                self.assertEqual(proc.wait(timeout=5), 143)
                # A killed descendant may briefly remain as an adopted zombie.
                stat = Path(f'/proc/{pid}/stat')
                deadline = time.monotonic() + 3
                while stat.exists() and stat.read_text().split()[2] != 'Z' and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue(not stat.exists() or stat.read_text().split()[2] == 'Z')
            finally:
                if proc.poll() is None:
                    proc.kill()
                    proc.wait()


if __name__ == '__main__':
    unittest.main()
