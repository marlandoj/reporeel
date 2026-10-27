#!/bin/bash
# Provision (or repair) the Huashu Keynote browser on a RepoReel host.
# Idempotent: safe to re-run. Run as the same user / with the same HOME and
# PLAYWRIGHT_BROWSERS_PATH the reporeel service runs with, or the browser
# lands in a cache the service never reads (see docs/huashu.md).
#
# Why this exists: on 2026-10-26 the Playwright browser cache on the live
# host was emptied and every Keynote job failed at the first scene, while
# /healthz still reported huashu:true (it only checked the checkout).
# checkHuashu now probes for the browser; this script restores it.
#
# Usage:
#   HUASHU_PYTHON=/path/to/huashu-venv/bin/python scripts/provision-huashu.sh
set -euo pipefail

PYTHON="${HUASHU_PYTHON:-python3}"

if ! "$PYTHON" -c 'import playwright' 2>/dev/null; then
  echo "playwright is not importable by $PYTHON" >&2
  echo "Create the venv first (docs/huashu.md):" >&2
  echo "  uv pip install --python <venv>/bin/python playwright==1.63.0" >&2
  exit 1
fi

echo "==> Installing Playwright Chromium (full build + headless shell) via $PYTHON"
"$PYTHON" -m playwright install chromium

echo "==> Installed browsers"
"$PYTHON" -m playwright install --dry-run chromium | grep -A1 'Install location' || true

echo "PROVISION OK — restart reporeel (or wait for the next /healthz poll);"
echo "checkHuashu now fails closed when no usable browser is present."
