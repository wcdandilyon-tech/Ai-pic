import { buildPrompt, STYLES, DETAIL_FIELDS } from './lib/prompt.js';

const $ = (s) => document.querySelector(s);
const form = $('#form');

// With the Node server, settings come from /api/config. On a static host
// (GitHub Pages) there is no server, so the browser calls the image service.
const POLLINATIONS_URL = 'https://image.pollinations.ai';
let cfg;
try {
  const r = await fetch('api/config');
  if (!r.ok) throw new Error();
  cfg = await r.json();
} catch {
  cfg = {
    backend: 'pollinations',
    allowNsfw: true,
    static: true,
    styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.label])),
    fields: DETAIL_FIELDS,
  };
}
$('#backend').textContent = `backend: ${cfg.backend}`;
$('#nsfw-wrap').hidden = !cfg.allowNsfw;

for (const [key, label] of Object.entries(cfg.styles)) {
  $('#style').append(new Option(label, key));
}
for (const [key, label] of cfg.fields) {
  const l = document.createElement('label');
  l.textContent = label;
  const input = document.createElement('input');
  input.name = `d_${key}`;
  l.append(input);
  $('#fields').append(l);
}

function readForm() {
  const f = new FormData(form);
  const details = {};
  for (const [key] of cfg.fields) details[key] = f.get(`d_${key}`);
  const [width, height] = f.get('size').split('x').map(Number);
  return {
    prompt: f.get('prompt'),
    style: f.get('style'),
    details,
    negative: f.get('negative'),
    nsfw: cfg.allowNsfw && f.get('nsfw') === 'on',
    width, height,
    steps: Number(f.get('steps')),
    cfg: Number(f.get('cfg')),
    seed: Number(f.get('seed')),
    count: Number(f.get('count')),
    sampler: f.get('sampler'),
  };
}

function showError(msg) {
  $('#error').hidden = !msg;
  $('#error').textContent = msg || '';
}

function updatePreview() {
  const b = buildPrompt(readForm());
  $('#preview').textContent = b.ok ? `PROMPT:\n${b.positive}\n\nNEGATIVE:\n${b.negative}` : b.error;
}
form.addEventListener('input', updatePreview);
updatePreview();

async function generateOnServer(body) {
  const r = await fetch('api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}

export function pollinationsUrl(built, body, seed) {
  const q = new URLSearchParams({
    width: body.width,
    height: body.height,
    seed,
    model: 'flux',
    negative_prompt: built.negative,
    nologo: 'true',
    private: 'true',
    enhance: 'false',
    safe: body.nsfw ? 'false' : 'true',
  });
  return `${POLLINATIONS_URL}/prompt/${encodeURIComponent(built.positive)}?${q}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error('The image service failed or is busy. Try again in a moment.'));
    img.src = src;
  });
}

async function generateInBrowser(body, built) {
  const count = Math.min(4, Math.max(1, body.count || 1));
  const seed = body.seed >= 0 ? body.seed : Math.floor(Math.random() * 2 ** 31);
  const images = [];
  // One at a time: the free tier rate-limits parallel requests.
  for (let i = 0; i < count; i++) images.push(await loadImage(pollinationsUrl(built, body, seed + i)));
  return { images, seed };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const body = readForm();
  const local = buildPrompt(body);
  if (!local.ok) return showError(local.error);

  $('#go').disabled = true;
  $('#go').textContent = 'Generating…';
  try {
    const data = cfg.static ? await generateInBrowser(body, local) : await generateOnServer(body);
    data.images.forEach((src, i) => {
      const fig = document.createElement('figure');
      const img = new Image();
      img.src = src;
      img.alt = body.prompt;
      const cap = document.createElement('figcaption');
      const seed = document.createElement('span');
      seed.textContent = `seed ${data.seed + i}`;
      const dl = document.createElement('a');
      dl.href = src;
      if (src.startsWith('data:')) {
        dl.download = `ai-pic-${data.seed + i}.${src.slice(11, src.indexOf(';')).replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`;
      } else {
        dl.target = '_blank'; // cross-origin: open full size, then save
        dl.rel = 'noopener';
      }
      dl.textContent = 'Download';
      cap.append(seed, dl);
      fig.append(img, cap);
      $('#results').prepend(fig);
    });
  } catch (err) {
    showError(err.message);
  } finally {
    $('#go').disabled = false;
    $('#go').textContent = 'Generate';
  }
});
