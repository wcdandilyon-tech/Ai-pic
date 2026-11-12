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
