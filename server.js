// Zero-dependency server: serves the UI and proxies generation requests to an
// image backend. Supported backends:
//   a1111 - AUTOMATIC1111 / SD WebUI Forge API (/sdapi/v1/txt2img), run locally
//   mock  - returns a placeholder SVG, for trying the UI without a GPU
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, STYLES, DETAIL_FIELDS } from './lib/prompt.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const BACKEND = process.env.BACKEND || 'a1111';
const A1111_URL = (process.env.A1111_URL || 'http://127.0.0.1:7860').replace(/\/$/, '');
const ALLOW_NSFW = process.env.ALLOW_NSFW === 'true';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const clamp = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 1e6) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('Request too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

async function generateA1111(params) {
  const r = await fetch(`${A1111_URL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: params.positive,
      negative_prompt: params.negative,
      width: params.width,
      height: params.height,
      steps: params.steps,
      cfg_scale: params.cfg,
      seed: params.seed,
      batch_size: params.count,
      sampler_name: params.sampler,
    }),
  });
  if (!r.ok) throw new Error(`Backend returned ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  let seed = params.seed;
  try { seed = JSON.parse(data.info).seed; } catch {}
  return { images: data.images.map((b64) => `data:image/png;base64,${b64}`), seed };
}

function generateMock(params) {
  const seed = params.seed >= 0 ? params.seed : Math.floor(Math.random() * 2 ** 31);
  const images = Array.from({ length: params.count }, (_, i) => {
    const hue = (seed + i * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,60%)"/><stop offset="1" stop-color="hsl(${(hue + 90) % 360},70%,35%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="28" text-anchor="middle">mock image ${i + 1}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  });
  return { images, seed };
}

async function handleGenerate(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const nsfw = ALLOW_NSFW && body.nsfw === true;
  const built = buildPrompt({ ...body, nsfw });
  if (!built.ok) return sendJson(res, 400, { error: built.error });

  const params = {
    ...built,
    width: clamp(body.width, 256, 2048, 832),
    height: clamp(body.height, 256, 2048, 1216),
    steps: clamp(body.steps, 1, 100, 28),
    cfg: clamp(body.cfg, 1, 20, 7),
    seed: Math.trunc(clamp(body.seed, -1, 2 ** 32 - 1, -1)),
    count: clamp(body.count, 1, 4, 1),
    sampler: typeof body.sampler === 'string' ? body.sampler.slice(0, 64) : 'Euler a',
  };

  try {
    const out = BACKEND === 'mock' ? generateMock(params) : await generateA1111(params);
    sendJson(res, 200, { ...out, positive: built.positive, negative: built.negative, nsfw });
  } catch (e) {
    sendJson(res, 502, { error: `Generation failed: ${e.message}` });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = url.pathname === '/' ? '/public/index.html' : url.pathname;
  if (!path.startsWith('/public/') && !path.startsWith('/lib/')) path = '/public' + path;
  const file = normalize(join(ROOT, path));
  const allowed = [join(ROOT, 'public') + '/', join(ROOT, 'lib') + '/'];
  if (!allowed.some((dir) => file.startsWith(dir))) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

export const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'GET' && req.url === '/api/config') {
    return sendJson(res, 200, {
      backend: BACKEND,
      allowNsfw: ALLOW_NSFW,
      styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.label])),
      fields: DETAIL_FIELDS,
    });
  }
  if (req.method === 'GET') return serveStatic(req, res);
  sendJson(res, 405, { error: 'Method not allowed' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Ai-pic running at http://localhost:${PORT}  (backend: ${BACKEND}, nsfw: ${ALLOW_NSFW})`);
  });
}
