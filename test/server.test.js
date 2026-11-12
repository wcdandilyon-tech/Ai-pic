import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.BACKEND = 'mock';
process.env.ALLOW_NSFW = 'true';
const { server } = await import('../server.js');

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const gen = (body) => fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify(body) });

test('generates mock images', async () => {
  const r = await gen({ prompt: 'woman', count: 2 });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.images.length, 2);
});

test('server enforces the minor filter', async () => {
  const r = await gen({ prompt: 'loli', nsfw: true });
  assert.equal(r.status, 400);
});

test('serves UI but not source outside public/lib', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/lib/prompt.js`)).status, 200);
  for (const path of ['/public/../server.js', '/lib/../.env', '/../package.json']) {
    const status = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
    });
    assert.notEqual(status, 200, path);
  }
});

test('pollinations backend builds the right request', async () => {
  // Fake image service standing in for image.pollinations.ai
  let seen;
  const fake = http.createServer((req, res) => {
    seen = new URL(req.url, 'http://x');
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(Buffer.from([0xff, 0xd8, 0xff]));
  });
  await new Promise((r) => fake.listen(0, r));
  const { spawn } = await import('node:child_process');
  const port = 30000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, BACKEND: 'pollinations', PORT: String(port),
      POLLINATIONS_URL: `http://127.0.0.1:${fake.address().port}`, ALLOW_NSFW: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((r) => child.stdout.once('data', r));
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'woman', nsfw: true, seed: 42, width: 512, height: 768, count: 2 }),
    });
    const d = await r.json();
    assert.equal(r.status, 200, d.error);
    assert.equal(d.images.length, 2);
    assert.ok(d.images[0].startsWith('data:image/jpeg;base64,'));
    assert.equal(d.nsfw, true); // NSFW allowed by default
    assert.equal(seen.searchParams.get('safe'), 'false');
    assert.equal(seen.searchParams.get('seed'), '43');
    assert.equal(seen.searchParams.get('width'), '512');
    assert.match(decodeURIComponent(seen.pathname), /adult woman.*woman/);
  } finally {
    child.kill();
    fake.close();
  }
});
