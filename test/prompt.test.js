import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, findMinorReference } from '../lib/prompt.js';

test('builds a detailed anime prompt from fields', () => {
  const r = buildPrompt({ prompt: 'woman in a cafe', style: 'anime', details: { hair: 'long silver hair', eyes: 'red eyes' } });
  assert.ok(r.ok);
  assert.match(r.positive, /anime art style/);
  assert.match(r.negative, /photorealistic/);
  assert.match(r.positive, /woman in a cafe, long silver hair, red eyes/);
  assert.match(r.negative, /nsfw/); // SFW by default
  assert.match(r.negative, /loli/); // always steer away from minors
});

test('nsfw mode adds adult tags and drops the sfw negatives', () => {
  const r = buildPrompt({ prompt: 'woman on a beach', nsfw: true });
  assert.ok(r.ok);
  assert.match(r.positive, /\badult\b/);
  assert.doesNotMatch(r.negative, /\bnsfw\b/);
});

test('blocks references to minors in every mode', () => {
  for (const p of ['a loli', 'schoolgirl outfit', '15 year old girl', 'teen girl', '12yo']) {
    assert.equal(buildPrompt({ prompt: p }).ok, false, p);
    assert.equal(buildPrompt({ prompt: p, nsfw: true }).ok, false, p);
  }
  assert.equal(buildPrompt({ prompt: 'woman', details: { extra: 'underage' } }).ok, false);
});

test('does not flag adult ages or unrelated words', () => {
  for (const p of ['25 year old woman', 'canteen', 'kidney bean salad', '100 years old vampire']) {
    assert.equal(findMinorReference(p), null, p);
  }
});

test('empty prompt is rejected', () => {
  assert.equal(buildPrompt({}).ok, false);
});
