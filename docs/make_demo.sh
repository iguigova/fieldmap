#!/usr/bin/env bash
# Turns the frames docs/demo.playwright.js records into docs/demo.gif: ten
# frames a second, 800 pixels wide, one palette built from every frame.
# Usage: make_demo.sh [frames-dir], docs/frames by default.
set -euo pipefail

DOCS=$(dirname "$0")
FRAMES=${1:-$DOCS/frames}
OUT=$DOCS/demo.gif
SCALE="fps=10,scale=800:-1:flags=lanczos"

ffmpeg -loglevel error -y -framerate 10 -i "$FRAMES/f%04d.png" \
  -vf "$SCALE,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$OUT"
echo "$OUT: $(du -h "$OUT" | cut -f1)"
