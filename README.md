# Ai-pic

A web UI for making detailed images from a text prompt. It's tuned for anime
characters but works for any subject. You write a short idea, optionally fill
in detail fields (hair, eyes, outfit, pose, setting, lighting, camera…), pick a
style preset, and Ai-pic turns it into a full Stable Diffusion prompt with
quality tags and a matching negative prompt. Then it generates the image.

## Run it

Requires Node 22+. No npm dependencies.

```bash
cp .env.example .env
npm start            # http://localhost:3000
npm run mock         # try the UI without a GPU (placeholder images)
npm test
```

### Image backend

Ai-pic sends requests to an **AUTOMATIC1111** or **SD WebUI Forge** server
started with `--api` (the default URL is `http://127.0.0.1:7860`). Load whatever
checkpoint you like there. Anime models such as Illustrious, Pony, or Animagine
XL fit the default "Anime" style.

## NSFW mode

Set `ALLOW_NSFW=true` in `.env` to show the NSFW toggle. It's off by default.
When it's on, the SFW negative tags are removed and adult tags are added.

**Adults only.** A filter that you can't turn off blocks any prompt that refers
to a minor (for example *loli*, *teen*, *schoolgirl*, or ages under 18), in
every mode. The server enforces the filter too, so editing the browser code
won't get around it. Terms that describe minors are always added to the
negative prompt.
