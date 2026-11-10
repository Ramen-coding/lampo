# Demo video

`docs/lampo-demo.mp4` and `docs/lampo-demo.gif` are rendered from `demo.html`, an animated
mock-up of the app screens (same colours, texts and layout as `src/`). It uses made-up data,
like the in-app demo node.

To render it again after changing the UI (needs Playwright with Chromium, and ffmpeg):

```bash
node scripts/demo-video/record.js docs/lampo-demo.mp4
ffmpeg -i docs/lampo-demo.mp4 -vf "fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" docs/lampo-demo.gif
```

`AT=5,18 node scripts/demo-video/record.js` saves single frames to the temp folder instead, for a quick check.
