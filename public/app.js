import { buildPrompt } from '/lib/prompt.js';

const $ = (s) => document.querySelector(s);
const form = $('#form');

const cfg = await fetch('/api/config').then((r) => r.json());
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const body = readForm();
  const local = buildPrompt(body);
  if (!local.ok) return showError(local.error);

  $('#go').disabled = true;
  $('#go').textContent = 'Generating…';
  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
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
      dl.download = `ai-pic-${data.seed + i}.${src.slice(11, src.indexOf(';')).replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`;
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
