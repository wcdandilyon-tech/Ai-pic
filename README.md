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

Pictures work out of the box. By default Ai-pic uses **Pollinations**, a free
hosted image service, so you don't need an API key or a GPU. Set
`POLLINATIONS_MODEL` to change its model (default `flux`). The free tier is
rate-limited, so images are made one after another.

For full control over models, set `BACKEND=a1111` and run your own
**AUTOMATIC1111** or **SD WebUI Forge** server with `--api` (default URL
`http://127.0.0.1:7860`). Anime checkpoints such as Illustrious, Pony, or
Animagine XL fit the default "Anime" style.

## NSFW mode

The NSFW toggle is shown by default (set `ALLOW_NSFW=false` to hide it). When
you tick it, the SFW negative tags are removed, adult tags are added, and the
hosted service's safety filter is turned off.

**Adults only.** A filter that you can't turn off blocks any prompt that refers
to a minor (for example *loli*, *teen*, *schoolgirl*, or ages under 18), in
every mode. The server enforces the filter too, so editing the browser code
won't get around it. Terms that describe minors are always added to the
negative prompt.
