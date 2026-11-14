#!/usr/bin/env bash
# Prepare a video for ScrollScrub: every frame is a keyframe, so any seek is
# instant, and the moov atom sits at the front so it starts without a full download.
#   scripts/make-scrub-video.sh input.mov public/menu/hero-scrub.mp4 [height=1080]
set -euo pipefail
in="${1:?input video}"; out="${2:?output mp4}"; h="${3:-1080}"
ffmpeg -y -loglevel error -i "$in" -an \
  -vf "scale=-2:min(${h}\,ih),fps=30" \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
  -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart "$out"
ls -lh "$out" | awk '{print "wrote", $5, $9}'
